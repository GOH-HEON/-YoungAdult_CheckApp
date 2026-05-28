import { PageTitle } from "@/components/ui/page-title";
import { requirePersonalNotesSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type LoginHistoryPageProps = {
  searchParams: Promise<{
    level?: "ok" | "error";
    message?: string;
  }>;
};

type LoginHistoryRow = {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string;
  user_role: string | null;
  signed_in_at: string;
  user_agent: string | null;
  ip_address: string | null;
};

function formatSignedInAt(value: string | null | undefined) {
  if (!value) {
    return "날짜 없음";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "날짜 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function shortenUserAgent(value: string | null | undefined) {
  if (!value) {
    return "기기 정보 없음";
  }

  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 80 ? `${compact.slice(0, 80)}…` : compact;
}

function formatUserLabel(row: LoginHistoryRow) {
  return row.user_name?.trim() ? `${row.user_name.trim()} · ${row.user_email}` : row.user_email;
}

export default async function LoginHistoryPage({ searchParams }: LoginHistoryPageProps) {
  const params = await searchParams;
  await requirePersonalNotesSession();
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("login_history")
    .select("id, user_id, user_name, user_email, user_role, signed_in_at, user_agent, ip_address")
    .order("signed_in_at", { ascending: false })
    .limit(100);

  const logs = (data as LoginHistoryRow[] | null) ?? [];
  const latest = logs[0] ?? null;

  return (
    <div className="space-y-6">
      <PageTitle
        title="접속 기록"
        description="고헌 계정 전용 접속 기록입니다. 이 페이지는 본인만 볼 수 있고, 전체 로그인 성공 이력을 확인할 수 있습니다."
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
          접속 기록을 불러오지 못했습니다: {error.message}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">총 기록</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900">{logs.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">최근 접속</p>
          <p className="mt-2 text-base font-semibold text-slate-900">
            {latest ? formatSignedInAt(latest.signed_in_at) : "아직 기록이 없습니다."}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">표시 개수</p>
          <p className="mt-2 text-base font-semibold text-slate-900">최근 100건</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_4px_20px_-2px_rgba(15,23,42,0.06)]">
        <div className="border-b border-slate-200 px-4 py-4">
          <p className="text-sm font-semibold text-slate-900">로그인 성공 이력</p>
          <p className="text-xs text-slate-500">이 표는 앱에 성공적으로 접속한 기록만 보여 줍니다.</p>
        </div>

        {logs.length === 0 ? (
          <div className="px-4 py-8 text-sm text-slate-500">아직 저장된 접속 기록이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">접속 시각</th>
                  <th className="px-4 py-3">사용자</th>
                  <th className="px-4 py-3">역할</th>
                  <th className="px-4 py-3">IP</th>
                  <th className="px-4 py-3">기기 정보</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((row) => (
                  <tr key={row.id} className="align-top hover:bg-slate-50/70">
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-900">
                      {formatSignedInAt(row.signed_in_at)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="font-medium text-slate-900">{formatUserLabel(row)}</div>
                      <div className="mt-1 text-xs text-slate-500">{row.user_id}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {row.user_role?.trim() ? row.user_role : "미지정"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {row.ip_address?.trim() ? row.ip_address : "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{shortenUserAgent(row.user_agent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
