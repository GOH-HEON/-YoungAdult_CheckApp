import { PageTitle } from "@/components/ui/page-title";
import { addCounterAction, updateGoalsAction } from "@/app/(admin)/campaign/actions";
import {
  ParticipationDepartments,
  type DeptGroup,
} from "@/app/(admin)/campaign/_components/participation-departments";
import { canWrite, createPageReadClient, requireSession } from "@/lib/auth/session";
import {
  achievementRate,
  formatRate,
  progressWidth,
  type Campaign,
  type CounterLogRow,
  type CounterMetric,
  type ParticipantRow,
} from "@/lib/campaign/campaign";
import { compareDepartmentName } from "@/lib/utils/department-order";

type CampaignPageProps = {
  searchParams: Promise<{
    dept?: string;
    level?: "ok" | "error";
    message?: string;
  }>;
};

type RawParticipant = {
  id: string;
  member_id: string;
  registered: boolean;
  participated: boolean;
  members: {
    name: string;
    gender: "형제" | "자매";
    department_id: number | null;
    departments: { name: string } | null;
  } | null;
};

type RawCounterLog = {
  id: string;
  metric: CounterMetric;
  delta: number;
  note: string | null;
  leader_name: string | null;
  target_name: string | null;
  created_at: string;
  users: { name: string | null } | null;
};

type DepartmentRow = { id: number; name: string };

function compareGenderOrder(a: "형제" | "자매", b: "형제" | "자매") {
  if (a === b) return 0;
  return a === "형제" ? -1 : 1;
}

const CARD_STYLES = {
  blue: { fill: "bg-blue-600", text: "text-blue-700", track: "bg-blue-100" },
  emerald: { fill: "bg-emerald-600", text: "text-emerald-700", track: "bg-emerald-100" },
  violet: { fill: "bg-violet-600", text: "text-violet-700", track: "bg-violet-100" },
  amber: { fill: "bg-amber-500", text: "text-amber-600", track: "bg-amber-100" },
} as const;

function SummaryCard({
  label,
  badge,
  achieved,
  goal,
  tone,
}: {
  label: string;
  badge: "목록" | "카운터";
  achieved: number;
  goal: number;
  tone: keyof typeof CARD_STYLES;
}) {
  const style = CARD_STYLES[tone];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
        {label}
        <span
          className={[
            "ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold",
            badge === "목록" ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700",
          ].join(" ")}
        >
          {badge}
        </span>
      </div>
      <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
        {achieved}
        <span className="text-base font-semibold text-slate-400"> / {goal}명</span>
      </p>
      <p className={["mt-0.5 text-sm font-bold", style.text].join(" ")}>{formatRate(achievementRate(achieved, goal))}</p>
      <div className={["mt-3 h-2 overflow-hidden rounded-full", style.track].join(" ")}>
        <div className={["h-full rounded-full", style.fill].join(" ")} style={{ width: `${progressWidth(achieved, goal)}%` }} />
      </div>
    </div>
  );
}

function CounterPanel({
  campaignId,
  metric,
  index,
  tone,
  achieved,
  goal,
  logs,
  canManage,
}: {
  campaignId: string;
  metric: CounterMetric;
  index: number;
  tone: "violet" | "amber";
  achieved: number;
  goal: number;
  logs: CounterLogRow[];
  canManage: boolean;
}) {
  const style = CARD_STYLES[tone];
  // 카운트된 명단(＋ 추가분). −1 되돌리기(delta<0)는 제외.
  const entries = logs.filter((log) => log.metric === metric && log.delta > 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-4">
        <span
          className={[
            "flex h-6 w-6 items-center justify-center rounded-lg text-xs font-extrabold text-white",
            tone === "violet" ? "bg-violet-600" : "bg-amber-500",
          ].join(" ")}
        >
          {index}
        </span>
        <h3 className="text-lg font-extrabold text-slate-900">{metric}</h3>
        <span className="text-xs text-slate-500">— 전체 단일 카운터</span>
      </div>

      <div className="flex flex-col gap-6 p-6 sm:flex-row">
        <div className="sm:w-56">
          <p className={["text-center text-5xl font-extrabold tracking-tight", style.text].join(" ")}>{achieved}</p>
          <p className="mt-1 text-center text-sm font-semibold text-slate-500">목표 {goal}명</p>
          <div className={["mt-3 h-2.5 overflow-hidden rounded-full", style.track].join(" ")}>
            <div className={["h-full rounded-full", style.fill].join(" ")} style={{ width: `${progressWidth(achieved, goal)}%` }} />
          </div>
          <p className={["mt-1 text-center text-sm font-bold", style.text].join(" ")}>
            {formatRate(achievementRate(achieved, goal))}
          </p>

          {canManage ? (
            <div className="mt-4 space-y-2">
              <form action={addCounterAction} className="space-y-2 rounded-xl border border-slate-200 p-3">
                <input type="hidden" name="campaignId" value={campaignId} />
                <input type="hidden" name="metric" value={metric} />
                <input type="hidden" name="delta" value="1" />
                <input
                  name="leader_name"
                  placeholder="인도자 (선택)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  name="target_name"
                  placeholder={`${metric}대상자 (선택)`}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className={[
                    "w-full rounded-lg py-2.5 text-sm font-bold text-white",
                    tone === "violet" ? "bg-violet-600" : "bg-amber-500",
                  ].join(" ")}
                >
                  ＋ {metric} 추가
                </button>
              </form>
              <form action={addCounterAction}>
                <input type="hidden" name="campaignId" value={campaignId} />
                <input type="hidden" name="metric" value={metric} />
                <input type="hidden" name="delta" value="-1" />
                <button
                  type="submit"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2 text-xs font-bold text-slate-500"
                >
                  −1 되돌리기
                </button>
              </form>
            </div>
          ) : null}
        </div>

        <div className="flex-1 border-slate-200 sm:border-l sm:pl-6">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">{metric} 명단</h4>
            <span className="text-xs font-semibold text-slate-400">{entries.length}건</span>
          </div>
          {entries.length === 0 ? (
            <p className="text-sm text-slate-400">아직 기록이 없습니다.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="w-10 px-3 py-2 font-bold">#</th>
                    <th className="px-3 py-2 font-bold">인도자</th>
                    <th className="px-3 py-2 font-bold">{metric}대상자</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map((log, i) => (
                    <tr key={log.id}>
                      <td className="px-3 py-2 text-slate-400">{entries.length - i}</td>
                      <td className="px-3 py-2 font-semibold text-slate-700">{log.leader_name || "-"}</td>
                      <td className="px-3 py-2 font-semibold text-slate-700">{log.target_name || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {canManage ? (
        <p className="border-t border-slate-100 px-6 py-2 text-center text-xs text-slate-400">
          ＋/− 버튼으로 누적, 모든 변경은 기록에 남습니다
        </p>
      ) : null}
    </section>
  );
}

export default async function CampaignPage({ searchParams }: CampaignPageProps) {
  const params = await searchParams;
  const session = await requireSession();
  const { appUser } = session;
  const supabase = createPageReadClient(appUser, session.supabase);
  const canManage = canWrite(appUser);

  const { data: campaignData, error: campaignError } = await supabase
    .from("campaigns")
    .select(
      "id, name, description, start_date, end_date, goal_registration, goal_participation, goal_evangelism, goal_invitation, is_active",
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const campaign = (campaignData as Campaign | null) ?? null;

  const messageBanner = params.message ? (
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
  ) : null;

  if (campaignError) {
    return (
      <div className="space-y-6">
        <PageTitle title="목표대비 달성" description="접수/참여 · 전도 · 권유 목표대비 달성 현황" />
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          캠페인 조회 오류: {campaignError.message}
          <br />
          <span className="text-rose-600">
            테이블이 아직 생성되지 않았다면 <code>supabase/ops/08_campaign_goal_tracker.sql</code> 마이그레이션을 먼저 적용해 주세요.
          </span>
        </p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="space-y-6">
        <PageTitle title="목표대비 달성" description="접수/참여 · 전도 · 권유 목표대비 달성 현황" />
        {messageBanner}
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          활성 캠페인이 없습니다. 마이그레이션 적용 후 캠페인 1건과 명단(155명)을 시드해 주세요.
        </p>
      </div>
    );
  }

  const [{ data: participantData }, { data: counterData }, { data: departments }] = await Promise.all([
    supabase
      .from("campaign_participants")
      .select("id, member_id, registered, participated, members(name, gender, department_id, departments(name))")
      .eq("campaign_id", campaign.id),
    supabase
      .from("campaign_counter_logs")
      .select("id, metric, delta, note, leader_name, target_name, created_at, users(name)")
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: false }),
    supabase.from("departments").select("id, name").order("name"),
  ]);

  const participants: ParticipantRow[] = ((participantData as RawParticipant[] | null) ?? []).map((row) => ({
    id: row.id,
    member_id: row.member_id,
    registered: row.registered,
    participated: row.participated,
    name: row.members?.name ?? "-",
    gender: row.members?.gender ?? "형제",
    department_name: row.members?.departments?.name ?? null,
  }));

  const logs: CounterLogRow[] = ((counterData as RawCounterLog[] | null) ?? []).map((row) => ({
    id: row.id,
    metric: row.metric,
    delta: row.delta,
    note: row.note,
    leader_name: row.leader_name,
    target_name: row.target_name,
    created_at: row.created_at,
    actor_name: row.users?.name ?? null,
  }));

  const registeredCount = participants.filter((p) => p.registered).length;
  const participatedCount = participants.filter((p) => p.participated).length;
  const evangelismTotal = logs.filter((l) => l.metric === "전도").reduce((s, l) => s + l.delta, 0);
  const invitationTotal = logs.filter((l) => l.metric === "권유").reduce((s, l) => s + l.delta, 0);

  const sortedDepartments = [...((departments as DepartmentRow[] | null) ?? [])].sort((a, b) =>
    compareDepartmentName(a.name, b.name),
  );

  // 부서별 그룹(각 부서 명단 + 진행 집계). 부서 버튼 클릭 시 팝업으로 명단 표시.
  const deptGroups: DeptGroup[] = sortedDepartments
    .map((dept) => {
      const inDept = participants
        .filter((p) => p.department_name === dept.name)
        .sort((a, b) => {
          const gDiff = compareGenderOrder(a.gender, b.gender);
          if (gDiff !== 0) return gDiff;
          return a.name.localeCompare(b.name, "ko");
        });
      return {
        name: dept.name,
        total: inDept.length,
        registered: inDept.filter((p) => p.registered).length,
        done: inDept.filter((p) => p.participated).length,
        members: inDept,
      };
    })
    .filter((d) => d.total > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle title="목표대비 달성" description="접수/참여 · 전도 · 권유 목표대비 달성 현황을 한눈에" />
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500 align-middle" />
          {campaign.name}
          {campaign.start_date ? (
            <span className="ml-2 text-xs font-medium text-slate-400">
              {campaign.start_date} ~ {campaign.end_date ?? ""}
            </span>
          ) : null}
        </div>
      </div>

      {messageBanner}

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="접수" badge="목록" achieved={registeredCount} goal={campaign.goal_registration} tone="blue" />
        <SummaryCard label="참여" badge="목록" achieved={participatedCount} goal={campaign.goal_participation} tone="emerald" />
        <SummaryCard label="전도" badge="카운터" achieved={evangelismTotal} goal={campaign.goal_evangelism} tone="violet" />
        <SummaryCard label="권유" badge="카운터" achieved={invitationTotal} goal={campaign.goal_invitation} tone="amber" />
      </div>

      {/* 목표 설정 (관리자) */}
      {canManage ? (
        <details className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <summary className="cursor-pointer px-6 py-3 text-sm font-semibold text-slate-700">목표 설정</summary>
          <form action={updateGoalsAction} className="grid grid-cols-2 gap-4 border-t border-slate-100 p-6 sm:grid-cols-4">
            <input type="hidden" name="campaignId" value={campaign.id} />
            {[
              { key: "goal_registration", label: "접수 목표", value: campaign.goal_registration },
              { key: "goal_participation", label: "참여 목표", value: campaign.goal_participation },
              { key: "goal_evangelism", label: "전도 목표", value: campaign.goal_evangelism },
              { key: "goal_invitation", label: "권유 목표", value: campaign.goal_invitation },
            ].map((g) => (
              <label key={g.key} className="space-y-1 text-sm">
                <span className="font-medium text-slate-700">{g.label}</span>
                <input
                  type="number"
                  min={0}
                  name={g.key}
                  defaultValue={g.value}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
            ))}
            <div className="col-span-2 sm:col-span-4">
              <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                목표 저장
              </button>
            </div>
          </form>
        </details>
      ) : null}

      {/* 분야 1: 접수/참여 목록 */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-4">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-xs font-extrabold text-white">1</span>
          <h3 className="text-lg font-extrabold text-slate-900">접수 / 참여</h3>
          <span className="text-xs text-slate-500">— 명단 기반, 개인별 접수·참여 체크</span>
          <span className="ml-auto rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">전체 {participants.length}</span>
        </div>

        <ParticipationDepartments
          campaignId={campaign.id}
          canManage={canManage}
          departments={deptGroups}
          initialOpenDept={params.dept ?? null}
        />
      </section>

      {/* 분야 2·3: 전도 / 권유 카운터 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <CounterPanel
          campaignId={campaign.id}
          metric="전도"
          index={2}
          tone="violet"
          achieved={evangelismTotal}
          goal={campaign.goal_evangelism}
          logs={logs}
          canManage={canManage}
        />
        <CounterPanel
          campaignId={campaign.id}
          metric="권유"
          index={3}
          tone="amber"
          achieved={invitationTotal}
          goal={campaign.goal_invitation}
          logs={logs}
          canManage={canManage}
        />
      </div>
    </div>
  );
}
