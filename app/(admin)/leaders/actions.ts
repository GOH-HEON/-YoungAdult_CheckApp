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

type LeadershipPayloadItem = {
  id?: string | null;
  category?: string | null;
  departmentName?: string | null;
  memberName?: string | null;
  memberId?: string | null;
  content?: string | null;
  status?: string | null;
  dueDate?: string | null;
};

type LeadershipBatchPayload = {
  newItems?: LeadershipPayloadItem[];
  updatedItems?: LeadershipPayloadItem[];
  deletedItemIds?: string[];
};

function validatePayloadItem(item: LeadershipPayloadItem, index: number) {
  const category = cleanText(item.category ?? "");
  const content = cleanText(item.content ?? "");
  const statusValue = cleanText(item.status ?? "");

  if (!isLeadershipCategory(category)) {
    throw new Error(`${index + 1}번 항목의 안건 분류가 올바르지 않습니다.`);
  }

  if (!content) {
    throw new Error(`${index + 1}번 항목의 기록 내용을 입력해 주세요.`);
  }

  const normalizedStatus =
    category === "부서원 심방계획"
      ? isLeadershipVisitStatus(statusValue)
        ? statusValue
        : null
      : null;

  if (category === "부서원 심방계획" && !normalizedStatus) {
    throw new Error(`${index + 1}번 심방계획 항목의 진행 상태를 선택해 주세요.`);
  }

  return {
    id: cleanText(item.id ?? "") || null,
    category,
    departmentName: cleanText(item.departmentName ?? "") || null,
    memberName: cleanText(item.memberName ?? "") || null,
    memberId: cleanText(item.memberId ?? "") || null,
    content,
    status: normalizedStatus,
    dueDate: cleanText(item.dueDate ?? "") || null,
  } as const;
}

async function resolveLeadershipMemberId({
  memberId,
  memberName,
  departmentName,
  supabase,
}: {
  memberId: string | null;
  memberName: string | null;
  departmentName: string | null;
  supabase: LeadershipSupabase;
}) {
  if (memberId) {
    return memberId;
  }

  if (!memberName) {
    return null;
  }

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

  return narrowedMembers.length === 1 ? (narrowedMembers[0]?.id ?? null) : null;
}

export async function saveLeadershipMeetingItemsAction(formData: FormData) {
  const meetingDate = cleanText(formData.get("meetingDate"));
  const payloadText = cleanText(formData.get("payload"));

  if (!meetingDate) {
    redirectLeaders({
      message: "회의 날짜를 먼저 선택해 주세요.",
      level: "error",
    });
  }

  let payload: LeadershipBatchPayload;

  try {
    payload = payloadText ? (JSON.parse(payloadText) as LeadershipBatchPayload) : {};
  } catch {
    redirectLeaders({
      message: "저장할 항목 정보를 읽는 중 오류가 발생했습니다.",
      level: "error",
      date: meetingDate,
    });
  }

  const newItems = (payload.newItems ?? []).map((item, index) => validatePayloadItem(item, index));
  const updatedItems = (payload.updatedItems ?? []).map((item, index) => validatePayloadItem(item, index));
  const deletedItemIds = (payload.deletedItemIds ?? []).map((itemId) => cleanText(itemId)).filter(Boolean);

  if (updatedItems.some((item) => !item.id)) {
    redirectLeaders({
      message: "수정할 항목 정보를 확인해 주세요.",
      level: "error",
      date: meetingDate,
    });
  }

  if (newItems.length === 0 && updatedItems.length === 0 && deletedItemIds.length === 0) {
    redirectLeaders({
      message: "저장할 변경 사항이 없습니다.",
      level: "error",
      date: meetingDate,
    });
  }

  const { supabase, user } = await requireAdminSession();

  try {
    const needsMeetingForMutation = newItems.length > 0 || updatedItems.length > 0;
    const { data: existingMeeting, error: existingMeetingError } = await supabase
      .from("leadership_meetings")
      .select("id")
      .eq("meeting_date", meetingDate)
      .maybeSingle();

    if (existingMeetingError) {
      throw new Error(`임원모임 조회 실패: ${existingMeetingError.message}`);
    }

    const meetingId = needsMeetingForMutation
      ? await findOrCreateLeadershipMeeting({
          meetingDate,
          userId: user.id,
          supabase,
        })
      : existingMeeting?.id ?? null;

    if (!meetingId && (updatedItems.length > 0 || deletedItemIds.length > 0)) {
      throw new Error("저장할 기존 회의 기록을 찾지 못했습니다.");
    }

    for (const item of newItems) {
      const resolvedMemberId = await resolveLeadershipMemberId({
        memberId: item.memberId,
        memberName: item.memberName,
        departmentName: item.departmentName,
        supabase,
      });

      const { error } = await supabase.from("leadership_items").insert({
        meeting_id: meetingId,
        category: item.category,
        member_id: resolvedMemberId,
        department_name: item.departmentName,
        member_name: item.memberName,
        content: item.content,
        status: item.status,
        due_date: item.dueDate,
        created_by: user.id,
      });

      if (error) {
        throw new Error(`기록 저장 실패: ${error.message}`);
      }
    }

    for (const item of updatedItems) {
      const resolvedMemberId = await resolveLeadershipMemberId({
        memberId: item.memberId,
        memberName: item.memberName,
        departmentName: item.departmentName,
        supabase,
      });

      const { error } = await supabase
        .from("leadership_items")
        .update({
          category: item.category,
          member_id: resolvedMemberId,
          department_name: item.departmentName,
          member_name: item.memberName,
          content: item.content,
          status: item.status,
          due_date: item.dueDate,
        })
        .eq("id", item.id as string)
        .eq("meeting_id", meetingId as string);

      if (error) {
        throw new Error(`기록 수정 실패: ${error.message}`);
      }
    }

    if (deletedItemIds.length > 0) {
      const { error } = await supabase
        .from("leadership_items")
        .delete()
        .in("id", deletedItemIds)
        .eq("meeting_id", meetingId as string);

      if (error) {
        throw new Error(`기록 삭제 실패: ${error.message}`);
      }
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
    message: `저장 완료: 추가 ${newItems.length}건, 수정 ${updatedItems.length}건, 삭제 ${deletedItemIds.length}건`,
    date: meetingDate,
  });
}

export async function deleteLeadershipMeetingsAction(formData: FormData) {
  const selectedDate = cleanText(formData.get("selectedDate"));
  const meetingIds = formData
    .getAll("meetingIds")
    .map((value) => cleanText(value))
    .filter(Boolean);

  if (meetingIds.length === 0) {
    redirectLeaders({
      message: "삭제할 기록을 선택해 주세요.",
      level: "error",
      date: selectedDate || undefined,
    });
  }

  const { supabase } = await requireAdminSession();

  const { data: meetings, error: meetingsError } = await supabase
    .from("leadership_meetings")
    .select("id, meeting_date")
    .in("id", meetingIds);

  if (meetingsError) {
    redirectLeaders({
      message: `삭제 대상 기록 확인 실패: ${meetingsError.message}`,
      level: "error",
      date: selectedDate || undefined,
    });
  }

  const deletedMeetingDates = new Set(
    ((meetings as Array<{ id: string; meeting_date: string }> | null) ?? []).map((meeting) => meeting.meeting_date),
  );

  const { error } = await supabase.from("leadership_meetings").delete().in("id", meetingIds);

  if (error) {
    redirectLeaders({
      message: `기록 삭제 실패: ${error.message}`,
      level: "error",
      date: selectedDate || undefined,
    });
  }

  revalidateLeaders();
  redirectLeaders({
    message: `${meetingIds.length}개 기록이 삭제되었습니다.`,
    date: selectedDate && !deletedMeetingDates.has(selectedDate) ? selectedDate : undefined,
  });
}
