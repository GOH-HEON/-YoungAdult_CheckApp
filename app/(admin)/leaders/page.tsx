import Link from "next/link";

import { LeadershipMeetingEditor } from "@/components/leaders/leadership-meeting-editor";
import { PageTitle } from "@/components/ui/page-title";
import { canWrite, createPageReadClient, requireSession } from "@/lib/auth/session";
import { type LeadershipNoteCategory, type LeadershipVisitStatus } from "@/lib/constants/domain";
import { compareDepartmentName } from "@/lib/utils/department-order";
import { formatDate, formatDateInputValue } from "@/lib/utils/format";

type LeadersPageProps = {
  searchParams: Promise<{
    date?: string;
    level?: "ok" | "error";
    message?: string;
  }>;
};

type MemberRow = {
  id: string;
  name: string;
  departments: {
    name: string;
  } | null;
};

type DepartmentRow = {
  id: number;
  name: string;
};

type LeadershipMeetingRow = {
  id: string;
  meeting_date: string;
  title: string;
};

type LeadershipItemRow = {
  id: string;
  meeting_id?: string;
  member_id: string | null;
  category: LeadershipNoteCategory;
  content: string;
  department_name: string | null;
  member_name: string | null;
  status: LeadershipVisitStatus | null;
  due_date: string | null;
  created_at: string;
  members: {
    name: string;
    departments: {
      name: string;
    } | null;
  } | null;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDateParam(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return DATE_PATTERN.test(trimmed) ? trimmed : formatDateInputValue();
}

function meetingPreviewText(items: LeadershipItemRow[]) {
  if (items.length === 0) {
    return "아직 기록된 안건이 없습니다.";
  }

  const preview = items
    .slice(0, 2)
    .map((item) => item.content)
    .join(" / ")
    .replace(/\s+/g, " ")
    .trim();

  return preview.length > 72 ? `${preview.slice(0, 72)}...` : preview;
}

export default async function LeadersPage({ searchParams }: LeadersPageProps) {
  const params = await searchParams;
  const selectedDate = normalizeDateParam(params.date);
  const session = await requireSession();
  const { appUser } = session;
  const supabase = createPageReadClient(appUser, session.supabase);
  const canManage = canWrite(appUser);

  const [
    { data: members, error: membersError },
    { data: departments, error: departmentsError },
    { data: currentMeeting, error: currentMeetingError },
    { data: recentMeetings, error: recentMeetingsError },
    { data: recentItems, error: recentItemsError },
  ] = await Promise.all([
    supabase.from("members").select("id, name, department_id, departments(name)").eq("is_active", true).order("name"),
    supabase.from("departments").select("id, name").eq("is_active", true).order("name"),
    supabase
      .from("leadership_meetings")
      .select("id, meeting_date, title")
      .eq("meeting_date", selectedDate)
      .maybeSingle(),
    supabase.from("leadership_meetings").select("id, meeting_date, title").order("meeting_date", { ascending: false }).limit(8),
    supabase
      .from("leadership_items")
      .select("id, meeting_id, category, content, department_name, member_name, status, due_date, created_at")
      .order("created_at", { ascending: false })
      .limit(48),
  ]);

  const { data: currentItems, error: currentItemsError } = currentMeeting
    ? await supabase
        .from("leadership_items")
        .select("id, member_id, category, content, department_name, member_name, status, due_date, created_at, members(name, departments(name))")
        .eq("meeting_id", currentMeeting.id)
        .order("created_at", { ascending: true })
    : { data: [], error: null };

  const sortedDepartments = [...((departments as DepartmentRow[] | null) ?? [])].sort((a, b) =>
    compareDepartmentName(a.name, b.name),
  );

  const sortedMembers = [...((members as MemberRow[] | null) ?? [])].sort((a, b) => {
    const departmentDiff = compareDepartmentName(a.departments?.name ?? null, b.departments?.name ?? null);
    if (departmentDiff !== 0) {
      return departmentDiff;
    }

    return a.name.localeCompare(b.name, "ko");
  });

  const recentItemRows = (recentItems as LeadershipItemRow[] | null) ?? [];
  const recentItemsByMeetingId = recentItemRows.reduce((groupedItems, item) => {
    if (!item.meeting_id) {
      return groupedItems;
    }

    const nextItems = groupedItems.get(item.meeting_id) ?? [];
    nextItems.push(item);
    groupedItems.set(item.meeting_id, nextItems);
    return groupedItems;
  }, new Map<string, LeadershipItemRow[]>());

  const errors = [
    membersError ? `부서원 조회 오류: ${membersError.message}` : null,
    departmentsError ? `부서 조회 오류: ${departmentsError.message}` : null,
    currentMeetingError ? `선택 회의 조회 오류: ${currentMeetingError.message}` : null,
    currentItemsError ? `선택 회의 기록 조회 오류: ${currentItemsError.message}` : null,
    recentMeetingsError ? `최근 회의 조회 오류: ${recentMeetingsError.message}` : null,
    recentItemsError ? `누적 기록 조회 오류: ${recentItemsError.message}` : null,
  ].filter(Boolean) as string[];

  const needsSchemaSetup = errors.some(
    (message) => message.includes("relation") || message.includes("does not exist") || message.includes("schema cache"),
  );

  return (
    <div className="space-y-8">
      <PageTitle
        title="임원모임 기록"
        description="회의 날짜별 안건을 작성하고, 필요한 수정까지 마친 뒤 한 번에 저장합니다."
      />

      {params.message ? (
        <div
          className={[
            "rounded-xl border px-4 py-3 text-sm",
            params.level === "error"
              ? "border-rose-300 bg-rose-50 text-rose-700"
              : "border-emerald-300 bg-emerald-50 text-emerald-700",
          ].join(" ")}
        >
          {params.message}
        </div>
      ) : null}

      {errors.length > 0 ? (
        <section className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <p className="font-semibold">임원모임 데이터를 읽는 중 문제가 있었습니다.</p>
          <ul className="list-disc space-y-1 pl-5">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
          {needsSchemaSetup ? (
            <p className="text-rose-800">
              `leadership_meetings`, `leadership_items` 테이블이 아직 없으면 [supabase/schema.sql](/Users/goheon/Desktop/vibe%20coding/YoungAdult_CheckApp/supabase/schema.sql)과 [supabase/rls.sql](/Users/goheon/Desktop/vibe%20coding/YoungAdult_CheckApp/supabase/rls.sql)을 Supabase에 반영해 주세요.
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-4 self-start rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-28">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-slate-900">저장된 기록</h3>
              <p className="text-sm text-slate-500">{recentMeetings?.length ?? 0}개</p>
            </div>
            <Link
              href={`/leaders?date=${formatDateInputValue()}`}
              className={[
                "inline-flex min-w-[112px] items-center justify-center rounded-xl border border-[#2563eb] bg-[#2563eb] px-4 py-3 text-sm font-bold text-white shadow-sm transition",
                "hover:bg-[#1d4ed8] hover:shadow-md active:translate-y-[1px] active:scale-[0.98]",
                selectedDate === formatDateInputValue() ? "ring-2 ring-[#2563eb]/15" : "",
              ].join(" ")}
            >
              새 기록
            </Link>
          </div>

          <div className="space-y-3">
            {((recentMeetings as LeadershipMeetingRow[] | null) ?? []).map((meeting) => {
              const meetingItems = recentItemsByMeetingId.get(meeting.id) ?? [];
              const active = meeting.meeting_date === selectedDate;

              return (
                <Link
                  key={meeting.id}
                  href={`/leaders?date=${meeting.meeting_date}`}
                  className={[
                    "block rounded-2xl border px-4 py-4 transition active:translate-y-[1px] active:scale-[0.99]",
                    active
                      ? "border-[#2563eb] bg-[#eff6ff] text-[#1d4ed8]"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-slate-900">
                        {formatDate(meeting.meeting_date)} 임원모임
                      </p>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-500">{meeting.title}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white/80 px-3 py-1.5 text-xs font-bold text-slate-500">
                      {meetingItems.length}건
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{meetingPreviewText(meetingItems)}</p>
                </Link>
              );
            })}
            {(recentMeetings?.length ?? 0) === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                아직 저장된 임원모임 회차가 없습니다.
              </p>
            ) : null}
          </div>
        </aside>

        <div className="space-y-8">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <form className="flex flex-wrap items-end gap-3">
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">회의 날짜</span>
                  <input
                    type="date"
                    name="date"
                    defaultValue={selectedDate}
                    className="rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8] active:translate-y-[1px] active:scale-[0.98]"
                >
                  불러오기
                </button>
              </form>

              <div className="rounded-lg bg-slate-50 px-4 py-2 text-sm text-slate-600">
                {currentMeeting
                  ? `${formatDate(currentMeeting.meeting_date)} 회의 기록 ${currentItems?.length ?? 0}건`
                  : `${formatDate(selectedDate)} 회의는 아직 기록이 없습니다. 전체 저장 시 자동 생성됩니다.`}
              </div>
            </div>
          </section>

          <LeadershipMeetingEditor
            selectedDate={selectedDate}
            canManage={canManage}
            departments={sortedDepartments}
            members={sortedMembers.map((member) => ({
              id: member.id,
              name: member.name,
              departmentName: member.departments?.name ?? null,
            }))}
            currentItems={(currentItems as LeadershipItemRow[] | null) ?? []}
          />
        </div>
      </div>
    </div>
  );
}
