"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  LEADERSHIP_NOTE_CATEGORY_OPTIONS,
  LEADERSHIP_VISIT_STATUS_OPTIONS,
  type LeadershipNoteCategory,
  type LeadershipVisitStatus,
} from "@/lib/constants/domain";
import { requireAdminSession } from "@/lib/auth/session";
import { cleanText } from "@/lib/utils/format";

type LeadershipSupabase = Awaited<ReturnType<typeof requireAdminSession>>["supabase"];

function redirectLeaders({
  message,
  level = "ok",
  date,
}: {
  message: string;
  level?: "ok" | "error";
  date?: string;
}): never {
  const params = new URLSearchParams();
  params.set("level", level);
  params.set("message", message);
  if (date) {
    params.set("date", date);
  }

  redirect(`/leaders?${params.toString()}`);
}

function isLeadershipCategory(value: string): value is LeadershipNoteCategory {
  return LEADERSHIP_NOTE_CATEGORY_OPTIONS.includes(value as LeadershipNoteCategory);
}

function isLeadershipVisitStatus(value: string): value is LeadershipVisitStatus {
  return LEADERSHIP_VISIT_STATUS_OPTIONS.includes(value as LeadershipVisitStatus);
}

async function findOrCreateLeadershipMeeting({
  meetingDate,
  userId,
  supabase,
}: {
  meetingDate: string;
  userId: string;
  supabase: LeadershipSupabase;
}) {
  const { data: existingMeeting, error: existingMeetingError } = await supabase
    .from("leadership_meetings")
    .select("id")
    .eq("meeting_date", meetingDate)
    .maybeSingle();

  if (existingMeetingError) {
    throw new Error(`임원모임 조회 실패: ${existingMeetingError.message}`);
  }

  if (existingMeeting) {
    return existingMeeting.id;
  }

  const { data: createdMeeting, error: createMeetingError } = await supabase
    .from("leadership_meetings")
    .insert({
      meeting_date: meetingDate,
      title: `청년회 임원모임 (${meetingDate})`,
      created_by: userId,
    })
    .select("id")
    .single();

  if (createMeetingError) {
    throw new Error(`임원모임 생성 실패: ${createMeetingError.message}`);
  }

  return createdMeeting.id;
}

function revalidateLeaders() {
  revalidatePath("/leaders");
}

type MatchedMemberRow = {
  id: string;
  departments: { name: string } | Array<{ name: string }> | null;
};

export async function createLeadershipItemAction(formData: FormData) {
  const meetingDate = cleanText(formData.get("meetingDate"));
  const category = cleanText(formData.get("category"));
  const memberId = cleanText(formData.get("memberId"));
  const departmentName = cleanText(formData.get("departmentName"));
  const memberName = cleanText(formData.get("memberName"));
  const content = cleanText(formData.get("content"));
  const statusValue = cleanText(formData.get("status"));
  const dueDate = cleanText(formData.get("dueDate"));

  if (!meetingDate) {
    redirectLeaders({
      message: "회의 날짜를 먼저 선택해 주세요.",
      level: "error",
    });
  }

  if (!isLeadershipCategory(category)) {
    redirectLeaders({
      message: "안건 분류가 올바르지 않습니다.",
      level: "error",
      date: meetingDate,
    });
  }

  if (!content) {
    redirectLeaders({
      message: "기록 내용을 입력해 주세요.",
      level: "error",
      date: meetingDate,
    });
  }

  const normalizedStatus =
    category === "부서원 심방계획"
      ? isLeadershipVisitStatus(statusValue)
        ? statusValue
        : null
      : null;

  if (category === "부서원 심방계획" && !normalizedStatus) {
    redirectLeaders({
      message: "심방계획 상태를 선택해 주세요.",
      level: "error",
      date: meetingDate,
    });
  }

  const { supabase, user } = await requireAdminSession();

  try {
    let resolvedMemberId = memberId || null;

    if (!resolvedMemberId && memberName) {
      const { data: matchedMembers, error: memberMatchError } = await supabase
        .from("members")
        .select("id, departments(name)")
        .eq("name", memberName)
        .eq("is_active", true);

      if (memberMatchError) {
        throw new Error(`부서원 확인 실패: ${memberMatchError.message}`);
      }

      const narrowedMembers = ((matchedMembers as MatchedMemberRow[] | null) ?? []).filter((matchedMember) => {
        if (!departmentName) {
          return true;
        }

        const departmentValue = Array.isArray(matchedMember.departments)
          ? matchedMember.departments[0]?.name ?? null
          : matchedMember.departments?.name ?? null;

        return departmentValue === departmentName;
      });

      if (narrowedMembers.length === 1) {
        resolvedMemberId = narrowedMembers[0]?.id ?? null;
      }
    }

    const meetingId = await findOrCreateLeadershipMeeting({
      meetingDate,
      userId: user.id,
      supabase,
    });

    const { error } = await supabase.from("leadership_items").insert({
      meeting_id: meetingId,
      category,
      member_id: resolvedMemberId,
      department_name: departmentName || null,
      member_name: memberName || null,
      content,
      status: normalizedStatus,
      due_date: dueDate || null,
      created_by: user.id,
    });

    if (error) {
      redirectLeaders({
        message: `기록 저장 실패: ${error.message}`,
        level: "error",
        date: meetingDate,
      });
    }
  } catch (error) {
    redirectLeaders({
      message: error instanceof Error ? error.message : "기록 저장 중 오류가 발생했습니다.",
      level: "error",
      date: meetingDate,
    });
  }

  revalidateLeaders();
  redirectLeaders({
    message: `${category} 항목이 저장되었습니다.`,
    date: meetingDate,
  });
}

export async function updateLeadershipVisitStatusAction(formData: FormData) {
  const itemId = cleanText(formData.get("id"));
  const meetingDate = cleanText(formData.get("meetingDate"));
  const statusValue = cleanText(formData.get("status"));

  if (!itemId || !meetingDate) {
    redirectLeaders({
      message: "상태 변경에 필요한 정보가 누락되었습니다.",
      level: "error",
      date: meetingDate || undefined,
    });
  }

  if (!isLeadershipVisitStatus(statusValue)) {
    redirectLeaders({
      message: "심방 상태 값이 올바르지 않습니다.",
      level: "error",
      date: meetingDate,
    });
  }

  const { supabase } = await requireAdminSession();
  const { error } = await supabase
    .from("leadership_items")
    .update({ status: statusValue })
    .eq("id", itemId)
    .eq("category", "부서원 심방계획");

  if (error) {
    redirectLeaders({
      message: `심방 상태 변경 실패: ${error.message}`,
      level: "error",
      date: meetingDate,
    });
  }

  revalidateLeaders();
  redirectLeaders({
    message: `심방 상태가 ${statusValue}로 변경되었습니다.`,
    date: meetingDate,
  });
}

export async function deleteLeadershipItemAction(formData: FormData) {
  const itemId = cleanText(formData.get("id"));
  const meetingDate = cleanText(formData.get("meetingDate"));

  if (!itemId) {
    redirectLeaders({
      message: "삭제할 기록을 찾지 못했습니다.",
      level: "error",
      date: meetingDate || undefined,
    });
  }

  const { supabase } = await requireAdminSession();
  const { error } = await supabase.from("leadership_items").delete().eq("id", itemId);

  if (error) {
    redirectLeaders({
      message: `기록 삭제 실패: ${error.message}`,
      level: "error",
      date: meetingDate || undefined,
    });
  }

  revalidateLeaders();
  redirectLeaders({
    message: "기록이 삭제되었습니다.",
    date: meetingDate || undefined,
  });
}
