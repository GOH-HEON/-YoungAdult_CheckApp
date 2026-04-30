import Link from "next/link";

import {
  deleteLeadershipItemAction,
  updateLeadershipVisitStatusAction,
} from "@/app/(admin)/leaders/actions";
import { LeadershipItemForm } from "@/components/leaders/leadership-item-form";
import {
  LEADERSHIP_VISIT_STATUS_OPTIONS,
  LEADERSHIP_NOTE_CATEGORY_OPTIONS,
  type LeadershipNoteCategory,
  type LeadershipVisitStatus,
} from "@/lib/constants/domain";
import { canWrite, requireSession } from "@/lib/auth/session";
import { compareDepartmentName } from "@/lib/utils/department-order";
import { formatDate, formatDateInputValue } from "@/lib/utils/format";
import { PageTitle } from "@/components/ui/page-title";

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
  leadership_meetings: {
    meeting_date: string;
  } | null;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const categoryMeta: Array<{
  value: LeadershipNoteCategory;
  title: string;
  description: string;
  placeholder: string;
  accentClassName: string;
}> = [
  {
    value: "부서원 근황",
    title: "부서원 근황",
    description: "개인 소식, 기도제목, 변화된 상황을 짧게 계속 누적합니다.",
    placeholder: "예: 새 직장 적응 중이며 주일 오전 봉사로 피곤함이 있어 기도 필요",
    accentClassName: "border-blue-200 bg-blue-50/70",
  },
  {
    value: "부서원 심방계획",
    title: "부서원 심방계획",
    description: "심방 예정자와 일정, 목표를 남기고 상태를 계속 갱신합니다.",
    placeholder: "예: 다음 주 화요일 저녁 카페 심방 예정, 최근 예배 결석 사유 확인",
    accentClassName: "border-amber-200 bg-amber-50/70",
  },
  {
    value: "전도인 전달사항",
    title: "전도인 전달사항",
    description: "임원들에게 전달할 지침, 공지, 방향을 회차별로 축적합니다.",
    placeholder: "예: 새가족 정착 체크를 이번 달에는 부서별로 나누어 진행",
    accentClassName: "border-emerald-200 bg-emerald-50/70",
  },
  {
    value: "교회 및 청년회 관련광고",
    title: "교회 및 청년회 관련광고",
    description: "행사, 일정, 광고 문안을 한 곳에 모아 두고 재확인합니다.",
    placeholder: "예: 다음 주 토요일 청년회 연합체육대회 광고를 주일 광고 시간에 안내",
    accentClassName: "border-violet-200 bg-violet-50/70",
  },
];

function normalizeDateParam(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return DATE_PATTERN.test(trimmed) ? trimmed : formatDateInputValue();
}

function memberLabel(item: LeadershipItemRow) {
  const memberName = item.member_name ?? item.members?.name ?? null;
  const departmentName = item.department_name ?? item.members?.departments?.name ?? null;

  if (!memberName && !departmentName) {
    return "공통 안건";
  }

  if (memberName && departmentName) {
    return `${memberName} · ${departmentName}`;
  }

  return memberName ?? departmentName ?? "공통 안건";
}

function statusClassName(status: LeadershipVisitStatus | null) {
  switch (status) {
    case "예정":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "진행중":
      return "border-amber-200 bg-amber-100 text-amber-800";
    case "완료":
      return "border-emerald-200 bg-emerald-100 text-emerald-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

function sortVisitPlans(items: LeadershipItemRow[]) {
  return [...items].sort((a, b) => {
    if (a.due_date && b.due_date && a.due_date !== b.due_date) {
      return a.due_date.localeCompare(b.due_date);
    }
    if (a.due_date && !b.due_date) {
      return -1;
    }
    if (!a.due_date && b.due_date) {
      return 1;
    }
    return a.created_at === b.created_at ? 0 : a.created_at > b.created_at ? -1 : 1;
  });
}

export default async function LeadersPage({ searchParams }: LeadersPageProps) {
  const params = await searchParams;
  const selectedDate = normalizeDateParam(params.date);
  const { supabase, appUser } = await requireSession();
  const canManage = canWrite(appUser);

  const [
    { data: members, error: membersError },
    { data: departments, error: departmentsError },
    { data: currentMeeting, error: currentMeetingError },
    { data: recentMeetings, error: recentMeetingsError },
    { data: recentItems, error: recentItemsError },
    { data: pendingVisitPlans, error: pendingVisitPlansError },
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
      .select(
        "id, category, content, department_name, member_name, status, due_date, created_at, leadership_meetings(meeting_date), members(name, departments(name))",
      )
      .order("created_at", { ascending: false })
      .limit(48),
    supabase
      .from("leadership_items")
      .select(
        "id, category, content, department_name, member_name, status, due_date, created_at, leadership_meetings(meeting_date), members(name, departments(name))",
      )
      .eq("category", "부서원 심방계획")
      .in("status", ["예정", "진행중"])
      .order("created_at", { ascending: false })
      .limit(24),
  ]);

  const { data: currentItems, error: currentItemsError } = currentMeeting
    ? await supabase
        .from("leadership_items")
        .select("id, category, content, department_name, member_name, status, due_date, created_at, members(name, departments(name))")
        .eq("meeting_id", currentMeeting.id)
        .order("created_at", { ascending: false })
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

  const groupedCurrentItems = LEADERSHIP_NOTE_CATEGORY_OPTIONS.map((category) => ({
    category,
    items:
      ((currentItems as LeadershipItemRow[] | null) ?? []).filter((item) => item.category === category),
  }));

  const groupedRecentItems = LEADERSHIP_NOTE_CATEGORY_OPTIONS.map((category) => ({
    category,
    items:
      ((recentItems as LeadershipItemRow[] | null) ?? []).filter((item) => item.category === category).slice(0, 6),
  }));

  const openVisitPlans = sortVisitPlans((pendingVisitPlans as LeadershipItemRow[] | null) ?? []);

  const errors = [
    membersError ? `부서원 조회 오류: ${membersError.message}` : null,
    departmentsError ? `부서 조회 오류: ${departmentsError.message}` : null,
    currentMeetingError ? `선택 회의 조회 오류: ${currentMeetingError.message}` : null,
    currentItemsError ? `선택 회의 기록 조회 오류: ${currentItemsError.message}` : null,
    recentMeetingsError ? `최근 회의 조회 오류: ${recentMeetingsError.message}` : null,
    recentItemsError ? `누적 기록 조회 오류: ${recentItemsError.message}` : null,
    pendingVisitPlansError ? `심방 계획 조회 오류: ${pendingVisitPlansError.message}` : null,
  ].filter(Boolean) as string[];

  const needsSchemaSetup = errors.some(
    (message) => message.includes("relation") || message.includes("does not exist") || message.includes("schema cache"),
  );

  return (
    <div className="space-y-6">
      <PageTitle
        title="임원모임 기록"
        description="회의 날짜별로 안건을 기록하고, 항목별 누적 히스토리와 심방 진행 상태를 함께 관리합니다."
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

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
              <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                불러오기
              </button>
            </form>

            <div className="rounded-lg bg-slate-50 px-4 py-2 text-sm text-slate-600">
              {currentMeeting
                ? `${formatDate(currentMeeting.meeting_date)} 회의 기록 ${currentItems?.length ?? 0}건`
                : `${formatDate(selectedDate)} 회의는 아직 기록이 없습니다. 첫 저장 시 자동 생성됩니다.`}
            </div>
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">최근 회의</h3>
            <span className="text-xs font-medium text-slate-500">빠른 이동</span>
          </div>
          <div className="mt-4 space-y-2">
            {((recentMeetings as LeadershipMeetingRow[] | null) ?? []).map((meeting) => (
              <Link
                key={meeting.id}
                href={`/leaders?date=${meeting.meeting_date}`}
                className={[
                  "block rounded-xl border px-3 py-3 transition",
                  meeting.meeting_date === selectedDate
                    ? "border-blue-200 bg-blue-50 text-blue-800"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                ].join(" ")}
              >
                <div className="text-sm font-semibold">{formatDate(meeting.meeting_date)}</div>
                <div className="mt-1 text-xs text-slate-500">{meeting.title}</div>
              </Link>
            ))}
            {(recentMeetings?.length ?? 0) === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">
                아직 저장된 임원모임 회차가 없습니다.
              </p>
            ) : null}
          </div>
        </aside>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {categoryMeta.map((category) => {
          return (
            <section
              key={category.value}
              className={["rounded-2xl border p-5 shadow-sm", category.accentClassName].join(" ")}
            >
              <div className="space-y-1">
                <h3 className="text-xl font-semibold text-slate-900">{category.title}</h3>
                <p className="text-sm leading-6 text-slate-600">{category.description}</p>
              </div>

              <LeadershipItemForm
                category={category.value}
                selectedDate={selectedDate}
                title={category.title}
                placeholder={category.placeholder}
                canManage={canManage}
                departments={sortedDepartments}
                members={sortedMembers.map((member) => ({
                  id: member.id,
                  name: member.name,
                  departmentName: member.departments?.name ?? null,
                }))}
              />
            </section>
          );
        })}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">선택한 회의 기록</h3>
            <p className="mt-1 text-sm text-slate-500">
              {formatDate(selectedDate)} 회차에 입력된 내용을 안건별로 정리해 둡니다.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {groupedCurrentItems.map(({ category, items }) => (
            <section key={category} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-lg font-semibold text-slate-900">{category}</h4>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {items.length}건
                </span>
              </div>

              <div className="mt-3 space-y-3">
                {items.map((item) => (
                  <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{memberLabel(item)}</p>
                        <p className="mt-1 text-sm leading-6 whitespace-pre-wrap text-slate-700">{item.content}</p>
                      </div>
                      {canManage ? (
                        <form action={deleteLeadershipItemAction}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="meetingDate" value={selectedDate} />
                          <button type="submit" className="text-xs font-semibold text-rose-600 hover:text-rose-700">
                            삭제
                          </button>
                        </form>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{formatDate(item.created_at)}</span>
                      {item.due_date ? <span>예정일 {formatDate(item.due_date)}</span> : null}
                      {item.status ? (
                        <span
                          className={[
                            "rounded-full border px-2 py-1 font-semibold",
                            statusClassName(item.status),
                          ].join(" ")}
                        >
                          {item.status}
                        </span>
                      ) : null}
                    </div>

                    {canManage && item.category === "부서원 심방계획" ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {LEADERSHIP_VISIT_STATUS_OPTIONS.map((status) => (
                          <form key={status} action={updateLeadershipVisitStatusAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="meetingDate" value={selectedDate} />
                            <input type="hidden" name="status" value={status} />
                            <button
                              type="submit"
                              className={[
                                "rounded-full border px-3 py-1 text-xs font-semibold transition",
                                item.status === status
                                  ? statusClassName(status)
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                              ].join(" ")}
                            >
                              {status}
                            </button>
                          </form>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}

                {items.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                    아직 기록이 없습니다.
                  </p>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900">진행 중 심방계획</h3>
          <p className="mt-1 text-sm text-slate-500">완료되지 않은 심방 항목만 따로 모아 봅니다.</p>

          <div className="mt-4 space-y-3">
            {openVisitPlans.map((item) => (
              <article key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{memberLabel(item)}</p>
                  <span className={["rounded-full border px-2 py-1 text-xs font-semibold", statusClassName(item.status)].join(" ")}>
                    {item.status}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{item.content}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>회의 {formatDate(item.leadership_meetings?.meeting_date ?? null)}</span>
                  {item.due_date ? <span>예정일 {formatDate(item.due_date)}</span> : null}
                </div>
              </article>
            ))}
            {openVisitPlans.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                현재 열려 있는 심방계획이 없습니다.
              </p>
            ) : null}
          </div>
        </aside>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-xl font-semibold text-slate-900">누적 히스토리</h3>
          <p className="mt-1 text-sm text-slate-500">각 안건별 최근 기록을 모아 보면서 흐름을 이어갈 수 있습니다.</p>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {groupedRecentItems.map(({ category, items }) => (
              <section key={category} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-lg font-semibold text-slate-900">{category}</h4>
                <div className="mt-3 space-y-3">
                  {items.map((item) => (
                    <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{memberLabel(item)}</p>
                        <Link
                          href={`/leaders?date=${item.leadership_meetings?.meeting_date ?? selectedDate}`}
                          className="text-xs font-semibold text-blue-700 hover:text-blue-800"
                        >
                          회의 보기
                        </Link>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-700">{item.content}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>회의 {formatDate(item.leadership_meetings?.meeting_date ?? null)}</span>
                        {item.due_date ? <span>예정일 {formatDate(item.due_date)}</span> : null}
                        {item.status ? (
                          <span
                            className={[
                              "rounded-full border px-2 py-1 font-semibold",
                              statusClassName(item.status),
                            ].join(" ")}
                          >
                            {item.status}
                          </span>
                        ) : null}
                      </div>
                    </article>
                  ))}
                  {items.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                      아직 누적된 기록이 없습니다.
                    </p>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
