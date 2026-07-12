"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminSession } from "@/lib/auth/session";
import { isCounterMetric } from "@/lib/campaign/campaign";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { cleanText } from "@/lib/utils/format";

function backToCampaign({
  message,
  level = "ok",
  dept,
}: {
  message: string;
  level?: "ok" | "error";
  dept?: string;
}): never {
  const params = new URLSearchParams();
  params.set("level", level);
  params.set("message", message);
  if (dept) {
    params.set("dept", dept);
  }
  redirect(`/campaign?${params.toString()}`);
}

function parseBool(value: FormDataEntryValue | null) {
  return value === "true" || value === "1" || value === "on";
}

export async function toggleParticipantAction(formData: FormData) {
  const campaignId = cleanText(formData.get("campaignId"));
  const memberId = cleanText(formData.get("memberId"));
  const field = cleanText(formData.get("field")); // "registered" | "participated"
  const next = parseBool(formData.get("next"));
  const dept = cleanText(formData.get("dept")) || undefined;

  if (!campaignId || !memberId || (field !== "registered" && field !== "participated")) {
    backToCampaign({ level: "error", message: "잘못된 요청입니다.", dept });
  }

  await requireAdminSession();
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  // 무결성 규칙: 참여는 접수를 전제(참여 ON → 접수 ON), 접수 OFF → 참여도 OFF.
  const patch: Record<string, unknown> = {};
  if (field === "registered") {
    patch.registered = next;
    patch.registered_at = next ? now : null;
    if (!next) {
      patch.participated = false;
      patch.participated_at = null;
    }
  } else {
    patch.participated = next;
    patch.participated_at = next ? now : null;
    if (next) {
      patch.registered = true;
      patch.registered_at = now;
    }
  }

  const { error } = await admin
    .from("campaign_participants")
    .upsert(
      { campaign_id: campaignId, member_id: memberId, ...patch },
      { onConflict: "campaign_id,member_id" },
    );

  if (error) {
    backToCampaign({ level: "error", message: `저장 실패: ${error.message}`, dept });
  }

  revalidatePath("/campaign");
  backToCampaign({
    message: field === "registered" ? "접수 상태가 저장되었습니다." : "참여 상태가 저장되었습니다.",
    dept,
  });
}

export async function addCounterAction(formData: FormData) {
  const campaignId = cleanText(formData.get("campaignId"));
  const metric = cleanText(formData.get("metric"));
  const note = cleanText(formData.get("note")) || null;
  const leaderName = cleanText(formData.get("leader_name")) || null;
  const targetName = cleanText(formData.get("target_name")) || null;
  const rawDelta = Number.parseInt(cleanText(formData.get("delta")) || "1", 10);

  if (!campaignId || !isCounterMetric(metric)) {
    backToCampaign({ level: "error", message: "잘못된 요청입니다." });
  }
  const delta = Number.isFinite(rawDelta) && rawDelta !== 0 ? rawDelta : 1;

  const { user } = await requireAdminSession();
  const admin = createSupabaseAdminClient();

  // 합계가 0 미만으로 내려가지 않도록 방지(되돌리기 −1 대비).
  if (delta < 0) {
    const { data: rows, error: sumError } = await admin
      .from("campaign_counter_logs")
      .select("delta")
      .eq("campaign_id", campaignId)
      .eq("metric", metric);

    if (sumError) {
      backToCampaign({ level: "error", message: `조회 실패: ${sumError.message}` });
    }
    const current = (rows ?? []).reduce((sum, r) => sum + (r.delta as number), 0);
    if (current + delta < 0) {
      backToCampaign({ level: "error", message: `${metric} 합계는 0 미만이 될 수 없습니다.` });
    }
  }

  const { error } = await admin.from("campaign_counter_logs").insert({
    campaign_id: campaignId,
    metric,
    delta,
    note,
    leader_name: leaderName,
    target_name: targetName,
    created_by: user.id,
  });

  if (error) {
    backToCampaign({ level: "error", message: `저장 실패: ${error.message}` });
  }

  revalidatePath("/campaign");
  backToCampaign({ message: `${metric} ${delta > 0 ? "+" : ""}${delta} 반영되었습니다.` });
}

export async function deleteCounterAction(formData: FormData) {
  const logId = cleanText(formData.get("logId"));
  if (!logId) {
    backToCampaign({ level: "error", message: "삭제할 항목을 찾지 못했습니다." });
  }

  await requireAdminSession();
  const admin = createSupabaseAdminClient();

  const { error } = await admin.from("campaign_counter_logs").delete().eq("id", logId);

  if (error) {
    backToCampaign({ level: "error", message: `삭제 실패: ${error.message}` });
  }

  revalidatePath("/campaign");
  backToCampaign({ message: "명단에서 삭제되었습니다." });
}

export async function updateGoalsAction(formData: FormData) {
  const campaignId = cleanText(formData.get("campaignId"));
  if (!campaignId) {
    backToCampaign({ level: "error", message: "캠페인을 찾지 못했습니다." });
  }

  await requireAdminSession();
  const admin = createSupabaseAdminClient();

  const toGoal = (key: string) => Math.max(0, Number.parseInt(cleanText(formData.get(key)) || "0", 10) || 0);

  const { error } = await admin
    .from("campaigns")
    .update({
      goal_registration: toGoal("goal_registration"),
      goal_participation: toGoal("goal_participation"),
      goal_evangelism: toGoal("goal_evangelism"),
      goal_invitation: toGoal("goal_invitation"),
    })
    .eq("id", campaignId);

  if (error) {
    backToCampaign({ level: "error", message: `목표 저장 실패: ${error.message}` });
  }

  revalidatePath("/campaign");
  backToCampaign({ message: "목표가 저장되었습니다." });
}
