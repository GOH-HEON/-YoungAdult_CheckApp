export const DEPARTMENT_ORDER = ["소명부", "보라부", "뿌리부", "은혜부"] as const;

const DEPARTMENT_RANK = new Map<string, number>(
  DEPARTMENT_ORDER.map((name, index) => [name, index + 1]),
);

export function getDepartmentRank(name: string | null | undefined) {
  if (!name) {
    return 999;
  }

  return DEPARTMENT_RANK.get(name) ?? 100;
}

export function compareDepartmentName(a: string | null | undefined, b: string | null | undefined) {
  const rankDiff = getDepartmentRank(a) - getDepartmentRank(b);
  if (rankDiff !== 0) {
    return rankDiff;
  }

  const aa = a ?? "";
  const bb = b ?? "";
  return aa.localeCompare(bb, "ko");
}
