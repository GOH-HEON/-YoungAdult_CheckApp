import Link from "next/link";

import { ChairboardEditor } from "@/components/chairboard/chairboard-editor";
import { PageTitle } from "@/components/ui/page-title";
import { canWrite, requireChairboardSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ChairboardPageProps = {
  searchParams: Promise<{
    level?: "ok" | "error";
    message?: string;
    noteId?: string;
    new?: string;
  }>;
};

type ChairboardNoteRow = {
  id: string;
  title: string;
  content_html: string;
  created_at: string;
  updated_at: string;
};

function formatUpdatedAt(value: string | null | undefined) {
  if (!value) {
    return "아직 저장된 문서가 없습니다.";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "최근 저장 시각을 확인할 수 없습니다.";
  }

  return `최근 저장: ${new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)}`;
}

function formatNoteStamp(note: ChairboardNoteRow) {
  const source = note.updated_at ?? note.created_at;
  const date = new Date(source);

  if (Number.isNaN(date.getTime())) {
    return "날짜 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function stripHtmlPreview(html: string) {
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return "내용 없음";
  }

  return text.length > 56 ? `${text.slice(0, 56)}…` : text;
}

export default async function ChairboardPage({ searchParams }: ChairboardPageProps) {
  const params = await searchParams;
  const { supabase, appUser } = await requireChairboardSession();
  const chairboardSupabase = canWrite(appUser) ? createSupabaseAdminClient() : supabase;

  const { data, error } = await chairboardSupabase
    .from("chairboard_notes")
    .select("id, title, content_html, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(20);

  const notes = (data as ChairboardNoteRow[] | null) ?? [];
  const isDraft = params.new === "1";
  const requestedNoteId = params.noteId?.trim() ?? "";
  const selectedNote = isDraft
    ? null
    : notes.find((note) => note.id === requestedNoteId) ?? notes[0] ?? null;
  const selectedNoteLabel = isDraft ? "새 메모" : selectedNote?.title ?? "회장단 임원모임 메모";
  const selectedContentHtml = isDraft ? "<p><br/></p>" : selectedNote?.content_html ?? "<p><br/></p>";
  const updatedAtLabel = isDraft
    ? "새 메모를 시작합니다."
    : formatUpdatedAt(selectedNote?.updated_at);

  return (
    <div className="space-y-6">
      <PageTitle
        title="회장단 임원모임 정리"
        description="회장단 전용 무지 캔버스입니다. 왼쪽에서 저장된 메모를 다시 열어볼 수 있습니다."
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

      {error ? (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          메모 데이터를 불러오지 못했습니다: {error.message}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">저장된 메모</p>
              <p className="text-xs text-slate-500">{notes.length}개</p>
            </div>
            <Link
              href="/chairboard?new=1"
              className={[
                "rounded-lg px-3 py-2 text-xs font-semibold transition",
                isDraft
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              새 메모
            </Link>
          </div>

          <div className="space-y-2">
            {notes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                아직 저장된 메모가 없습니다.
              </div>
            ) : (
              notes.map((note) => {
                const active = !isDraft && selectedNote?.id === note.id;

                return (
                  <Link
                    key={note.id}
                    href={`/chairboard?noteId=${note.id}`}
                    className={[
                      "block rounded-xl border px-4 py-3 transition",
                      active
                        ? "border-[#2563eb] bg-[#eff6ff] text-[#1d4ed8]"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{note.title}</p>
                        <p className="mt-1 max-h-[2.8rem] overflow-hidden text-xs leading-5 text-slate-500">
                          {stripHtmlPreview(note.content_html)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-white/80 px-2 py-1 text-[11px] font-semibold text-slate-500">
                        {formatNoteStamp(note)}
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </aside>

        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.06)]">
            <span className="font-semibold text-slate-900">{selectedNoteLabel}</span>
            <span className="ml-2">{updatedAtLabel}</span>
          </div>

          <ChairboardEditor
            key={selectedNote?.id ?? (isDraft ? "new-draft" : "empty-draft")}
            noteId={selectedNote?.id ?? null}
            title={selectedNote?.title ?? "회장단 임원모임 메모"}
            contentHtml={selectedContentHtml}
            updatedAtLabel={updatedAtLabel}
          />
        </div>
      </div>
    </div>
  );
}
