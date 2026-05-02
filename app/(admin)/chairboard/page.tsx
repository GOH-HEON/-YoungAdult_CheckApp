import { ChairboardEditor } from "@/components/chairboard/chairboard-editor";
import { PageTitle } from "@/components/ui/page-title";
import { requireChairboardSession } from "@/lib/auth/session";

type ChairboardPageProps = {
  searchParams: Promise<{
    level?: "ok" | "error";
    message?: string;
  }>;
};

type ChairboardNoteRow = {
  id: string;
  title: string;
  content_html: string;
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

export default async function ChairboardPage({ searchParams }: ChairboardPageProps) {
  const params = await searchParams;
  const { supabase } = await requireChairboardSession();

  const { data, error } = await supabase
    .from("chairboard_notes")
    .select("id, title, content_html, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestNote = (data as ChairboardNoteRow | null) ?? null;

  return (
    <div className="space-y-6">
      <PageTitle
        title="회장단 임원모임 정리"
        description="회장단 전용 무지 캔버스입니다. 필요한 내용만 자유롭게 기록해 주세요."
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

      <ChairboardEditor
        noteId={latestNote?.id ?? null}
        title={latestNote?.title ?? "회장단 임원모임 메모"}
        contentHtml={latestNote?.content_html ?? "<p><br/></p>"}
        updatedAtLabel={formatUpdatedAt(latestNote?.updated_at)}
      />
    </div>
  );
}
