import Link from "next/link";

import { AutoPrintTrigger } from "@/components/ui/auto-print-trigger";
import { PageTitle } from "@/components/ui/page-title";
import { PrintTrigger } from "@/components/ui/print-trigger";
import { createPageReadClient, requireSession } from "@/lib/auth/session";
import { LEADERSHIP_NOTE_CATEGORY_OPTIONS, type LeadershipNoteCategory, type LeadershipVisitStatus } from "@/lib/constants/domain";
import { formatDate, formatDateInputValue } from "@/lib/utils/format";

type LeadersPrintPageProps = {
  searchParams: Promise<{
    date?: string;
    autoprint?: string;
  }>;
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
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const categoryTitleMap: Record<LeadershipNoteCategory, string> = {
  "부서원 근황": "부서원 근황",
  "부서원 심방계획": "부서원 심방계획",
  "전도인 전달사항": "전도인 전달사항",
  "교회 및 청년회 관련광고": "교회 및 청년회 관련광고",
};

function normalizeDateParam(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return DATE_PATTERN.test(trimmed) ? trimmed : formatDateInputValue();
}

function personLabel(item: LeadershipItemRow) {
  const departmentName = item.department_name ?? item.members?.departments?.name ?? "";
  const memberName = item.member_name ?? item.members?.name ?? "";

  if (!departmentName && !memberName) {
    return "공통 안건";
  }

  if (departmentName && memberName) {
    return `${departmentName} / ${memberName}`;
  }

  return departmentName || memberName;
}

function groupedItems(items: LeadershipItemRow[]) {
  return LEADERSHIP_NOTE_CATEGORY_OPTIONS.map((category) => ({
    category,
    title: categoryTitleMap[category],
    items: items.filter((item) => item.category === category),
  }));
}

export default async function LeadersPrintPage({ searchParams }: LeadersPrintPageProps) {
  const params = await searchParams;
  const selectedDate = normalizeDateParam(params.date);
  const shouldAutoPrint = params.autoprint === "1";
  const session = await requireSession();
  const supabase = createPageReadClient(session.appUser, session.supabase);

  const { data: meeting } = await supabase
    .from("leadership_meetings")
    .select("id, meeting_date, title")
    .eq("meeting_date", selectedDate)
    .maybeSingle();

  const { data: items } = meeting
    ? await supabase
        .from("leadership_items")
        .select("id, category, content, department_name, member_name, status, due_date, created_at, members(name, departments(name))")
        .eq("meeting_id", (meeting as LeadershipMeetingRow).id)
        .order("created_at", { ascending: true })
    : { data: [] };

  const itemRows = (items as LeadershipItemRow[] | null) ?? [];
  const sections = groupedItems(itemRows);

  return (
    <div className="leaders-print-root space-y-6">
      {shouldAutoPrint ? <AutoPrintTrigger /> : null}

      <div className="no-print">
        <PageTitle
          title="임원 배포용 PDF"
          description="현재 회의 기록을 배포용 문서 형식으로 정리해 PDF로 저장하거나 인쇄합니다."
        />
      </div>

      <section className="no-print rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <form className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">회의 날짜</span>
              <input
                type="date"
                name="date"
                defaultValue={selectedDate}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2"
              />
            </label>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
            >
              문서 불러오기
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/leaders?date=${selectedDate}`}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
            >
              기록 페이지로 돌아가기
            </Link>
            <PrintTrigger
              label="PDF 다운로드"
              className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white"
            />
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-500">브라우저 인쇄 창에서 대상 또는 프린터를 PDF 저장으로 선택하면 됩니다.</p>
      </section>

      <section className="print-sheet rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
        <div className="border-b border-slate-300 pb-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">Leadership Meeting Notes</p>
              <h2 className="mt-2 text-3xl font-bold text-slate-950">임원모임 배포용 기록</h2>
            </div>
            <div className="text-right text-sm text-slate-600">
              <p>회의 날짜: {formatDate(selectedDate)}</p>
              <p>기록 건수: {itemRows.length}건</p>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {meeting ? (meeting as LeadershipMeetingRow).title : `${formatDate(selectedDate)} 회의 기록`}
          </p>
        </div>

        {itemRows.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            저장된 회의 기록이 없습니다. 먼저 기록을 저장한 뒤 PDF를 내려받아 주세요.
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {sections.map((section) => (
              <section key={section.category} className="break-inside-avoid space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-300" />
                  <h3 className="text-lg font-bold text-slate-950">{section.title}</h3>
                  <div className="h-px flex-1 bg-slate-300" />
                </div>

                {section.items.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    기록된 내용이 없습니다.
                  </p>
                ) : (
                  <table className="w-full border-collapse border border-slate-300 text-sm">
                    <colgroup>
                      <col style={{ width: "7%" }} />
                      <col style={{ width: "21%" }} />
                      <col style={{ width: "50%" }} />
                      <col style={{ width: "22%" }} />
                    </colgroup>
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-slate-300 px-3 py-2 text-center font-semibold text-slate-700">번호</th>
                        <th className="border border-slate-300 px-3 py-2 text-center font-semibold text-slate-700">대상</th>
                        <th className="border border-slate-300 px-3 py-2 text-center font-semibold text-slate-700">내용</th>
                        <th className="border border-slate-300 px-3 py-2 text-center font-semibold text-slate-700">비고</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.items.map((item, index) => (
                        <tr key={item.id} className="align-top">
                          <td className="border border-slate-300 px-3 py-3 text-center font-semibold text-slate-600">
                            {index + 1}
                          </td>
                          <td className="border border-slate-300 px-3 py-3 text-slate-700">
                            {personLabel(item)}
                          </td>
                          <td className="border border-slate-300 px-3 py-3 whitespace-pre-wrap leading-6 text-slate-800">
                            {item.content}
                          </td>
                          <td className="border border-slate-300 px-3 py-3 text-slate-600">
                            <div className="space-y-1">
                              {item.status ? <p>상태: {item.status}</p> : null}
                              {item.due_date ? <p>예정일: {formatDate(item.due_date)}</p> : null}
                              {!item.status && !item.due_date ? <p>-</p> : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            ))}
          </div>
        )}
      </section>

      <style>{`
        @page {
          size: A4 portrait;
          margin: 10mm;
        }

        @media print {
          header,
          aside {
            display: none !important;
          }

          main {
            border: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          .no-print {
            display: none !important;
          }

          .leaders-print-root {
            margin: 0 !important;
            padding: 0 !important;
            font-size: 11px !important;
            line-height: 1.35 !important;
          }

          .print-sheet {
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
          }

          .break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
