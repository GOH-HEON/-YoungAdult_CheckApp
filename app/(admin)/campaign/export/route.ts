import { createPageReadClient, getRouteHandlerSession } from "@/lib/auth/session";
import { achievementRate, progressWidth, type CounterMetric } from "@/lib/campaign/campaign";

// 목표대비 달성 화면을 모바일 최적화 정적 HTML로 내보내기(다운로드).
// 본 페이지 컴포넌트는 그대로 두고, 이 라우트가 별도의 모바일용 HTML을 생성한다.

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type ParticipantRow = {
  registered: boolean;
  participated: boolean;
  name: string;
  gender: "형제" | "자매";
  department_name: string | null;
};

type CounterLog = {
  metric: CounterMetric;
  delta: number;
  leader_name: string | null;
  target_name: string | null;
  created_at: string;
};

const TONES: Record<string, string> = {
  접수: "#2563eb",
  참여: "#059669",
  전도: "#7c3aed",
  권유: "#d97706",
};

function card(label: string, achieved: number, goal: number) {
  const color = TONES[label] ?? "#2563eb";
  const rate = achievementRate(achieved, goal);
  const width = progressWidth(achieved, goal);
  return `
    <div class="card">
      <div class="card-label">${esc(label)}</div>
      <div class="card-value">${achieved}<span>/ ${goal}명</span></div>
      <div class="card-rate" style="color:${color}">${rate === null ? "—" : rate.toFixed(1) + "% 달성"}</div>
      <div class="bar"><i style="width:${width}%;background:${color}"></i></div>
    </div>`;
}

export async function GET(request: Request) {
  const { user, appUser, supabase } = await getRouteHandlerSession();
  if (!user) {
    return Response.redirect(new URL("/login", request.url));
  }
  const client = createPageReadClient(appUser, supabase);

  const { data: campaignData } = await client
    .from("campaigns")
    .select(
      "id, name, start_date, end_date, goal_registration, goal_participation, goal_evangelism, goal_invitation",
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const campaign = campaignData as {
    id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    goal_registration: number;
    goal_participation: number;
    goal_evangelism: number;
    goal_invitation: number;
  } | null;

  const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

  if (!campaign) {
    const empty = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>목표대비 달성</title></head><body style="font-family:sans-serif;padding:24px">활성 캠페인이 없습니다.</body></html>`;
    return new Response(empty, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const [{ data: participantData }, { data: counterData }, { data: memberData }] = await Promise.all([
    client
      .from("campaign_participants")
      .select("registered, participated, members(name, gender, department_id, departments(name))")
      .eq("campaign_id", campaign.id),
    client
      .from("campaign_counter_logs")
      .select("metric, delta, leader_name, target_name, created_at")
      .eq("campaign_id", campaign.id),
    client.from("members").select("name, departments(name)").eq("is_active", true),
  ]);

  const participants: ParticipantRow[] = (
    (participantData as
      | { registered: boolean; participated: boolean; members: { name: string; gender: "형제" | "자매"; departments: { name: string } | null } | null }[]
      | null) ?? []
  ).map((row) => ({
    registered: row.registered,
    participated: row.participated,
    name: row.members?.name ?? "-",
    gender: row.members?.gender ?? "형제",
    department_name: row.members?.departments?.name ?? null,
  }));

  const logs: CounterLog[] = (counterData as CounterLog[] | null) ?? [];

  const leaderDeptByName = new Map<string, string>();
  for (const m of (memberData as { name: string | null; departments: { name: string } | null }[] | null) ?? []) {
    if (m.name && m.departments?.name) leaderDeptByName.set(m.name, m.departments.name);
  }

  const registeredCount = participants.filter((p) => p.registered).length;
  const participatedCount = participants.filter((p) => p.participated).length;
  const evangelismTotal = logs.filter((l) => l.metric === "전도").reduce((s, l) => s + l.delta, 0);
  const invitationTotal = logs.filter((l) => l.metric === "권유").reduce((s, l) => s + l.delta, 0);

  const counterRows = (metric: CounterMetric) =>
    logs
      .filter((l) => l.metric === metric && l.delta > 0)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const counterHtml = (metric: CounterMetric, color: string) => {
    const rows = counterRows(metric);
    return `
      <h2 style="border-color:${color}">${esc(metric)} 명단 <span class="count">${rows.length}건</span></h2>
      ${
        rows.length === 0
          ? '<p class="empty">기록이 없습니다.</p>'
          : `<table>
              <thead><tr><th>#</th><th>부서</th><th>인도자</th><th>${esc(metric)}대상자</th></tr></thead>
              <tbody>
                ${rows
                  .map((r, i) => {
                    const dept = r.leader_name ? leaderDeptByName.get(r.leader_name) ?? "" : "";
                    return `<tr>
                      <td>${i + 1}</td>
                      <td>${esc(dept || "-")}</td>
                      <td class="nm">${esc(r.leader_name || "-")}</td>
                      <td class="nm">${esc(r.target_name || "-")}</td>
                    </tr>`;
                  })
                  .join("")}
              </tbody>
            </table>`
      }`;
  };

  const period = campaign.start_date ? `${campaign.start_date} ~ ${campaign.end_date ?? ""}` : "";

  const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>목표대비 달성 · ${esc(campaign.name)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;-webkit-text-size-adjust:100%}
  body{font-family:"Apple SD Gothic Neo","Malgun Gothic",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f1f5f9;color:#0f172a;line-height:1.45;font-size:15px}
  .wrap{max-width:480px;margin:0 auto;padding:16px 14px 40px}
  header{margin-bottom:14px}
  h1{font-size:22px;font-weight:800;letter-spacing:-.02em}
  .camp{margin-top:4px;font-size:13px;font-weight:600;color:#334155}
  .camp .dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#059669;margin-right:5px}
  .ts{margin-top:2px;font-size:11px;color:#94a3b8}
  .cards{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0}
  .card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:13px 13px 12px}
  .card-label{font-size:13px;font-weight:700;color:#64748b}
  .card-value{margin-top:6px;font-size:24px;font-weight:800;letter-spacing:-.02em}
  .card-value span{font-size:12px;font-weight:600;color:#94a3b8;margin-left:2px}
  .card-rate{margin-top:1px;font-size:12px;font-weight:700}
  .bar{height:7px;border-radius:99px;background:#eef2f7;overflow:hidden;margin-top:9px}
  .bar.sm{height:5px;margin-top:5px}
  .bar>i{display:block;height:100%;border-radius:99px}
  h2{font-size:16px;font-weight:800;margin:22px 0 10px;padding-left:9px;border-left:4px solid #2563eb}
  h2 .count{font-size:12px;font-weight:600;color:#94a3b8}
  .dept{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:9px}
  .dept-head{display:flex;justify-content:space-between;font-size:14px}
  .dept-head span{color:#64748b;font-size:12px}
  .dept-line{margin-top:8px;font-size:12px;color:#475569}
  details.roster{background:#fff;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:8px;overflow:hidden}
  details.roster summary{padding:12px 14px;font-weight:700;font-size:14px;cursor:pointer;list-style:none}
  details.roster summary::-webkit-details-marker{display:none}
  details.roster summary:after{content:"▾";float:right;color:#94a3b8}
  details.roster[open] summary:after{content:"▴"}
  details.roster summary span{font-weight:500;font-size:12px;color:#94a3b8}
  table{width:100%;border-collapse:collapse;font-size:13px}
  thead th{text-align:left;font-size:11px;font-weight:700;color:#64748b;background:#f8fafc;padding:8px 10px;border-top:1px solid #e2e8f0}
  tbody td{padding:9px 10px;border-top:1px solid #f1f5f9}
  td.nm{font-weight:700}
  .badge{display:inline-block;min-width:40px;text-align:center;border-radius:7px;padding:3px 7px;font-size:11px;font-weight:700}
  .badge.on{background:#ecfdf5;color:#059669}
  .badge.off{background:#f8fafc;color:#cbd5e1}
  .empty{color:#94a3b8;font-size:13px;padding:6px 2px}
  .foot{margin-top:26px;text-align:center;font-size:11px;color:#cbd5e1}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>목표대비 달성</h1>
    <div class="camp"><span class="dot"></span>${esc(campaign.name)}${period ? " · " + esc(period) : ""}</div>
    <div class="ts">추출 시각: ${esc(now)}</div>
  </header>

  <div class="cards">
    ${card("접수", registeredCount, campaign.goal_registration)}
    ${card("참여", participatedCount, campaign.goal_participation)}
    ${card("전도", evangelismTotal, campaign.goal_evangelism)}
    ${card("권유", invitationTotal, campaign.goal_invitation)}
  </div>

  ${counterHtml("전도", "#7c3aed")}
  ${counterHtml("권유", "#d97706")}

  <div class="foot">YouthHub · 목표대비 달성 내보내기</div>
</div>
</body>
</html>`;

  const fileName = `목표대비달성_${campaign.name}_${new Date().toISOString().slice(0, 10)}.html`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}
