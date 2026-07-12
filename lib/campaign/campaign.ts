// 목표대비 달성 도메인 공용 타입/유틸 (서버·클라이언트 공용, "use client" 없음)

export type CounterMetric = "전도" | "권유";

export const COUNTER_METRICS: CounterMetric[] = ["전도", "권유"];

export function isCounterMetric(value: unknown): value is CounterMetric {
  return value === "전도" || value === "권유";
}

export type Campaign = {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  goal_registration: number;
  goal_participation: number;
  goal_evangelism: number;
  goal_invitation: number;
  is_active: boolean;
};

export type ParticipantRow = {
  id: string;
  member_id: string;
  registered: boolean;
  participated: boolean;
  name: string;
  gender: "형제" | "자매";
  department_name: string | null;
};

export type CounterLogRow = {
  id: string;
  metric: CounterMetric;
  delta: number;
  note: string | null;
  leader_name: string | null;
  target_name: string | null;
  created_at: string;
  actor_name: string | null;
};

// 달성률(%): 목표 0 이하이면 null(0 나눗셈 방지). 소수 1자리.
export function achievementRate(achieved: number, goal: number): number | null {
  if (!Number.isFinite(goal) || goal <= 0) {
    return null;
  }
  return Math.round((achieved / goal) * 1000) / 10;
}

// 진행 바 폭(%): 0~100 사이로 클램프.
export function progressWidth(achieved: number, goal: number): number {
  if (!Number.isFinite(goal) || goal <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((achieved / goal) * 100)));
}

export function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${rate.toFixed(1)}% 달성`;
}
