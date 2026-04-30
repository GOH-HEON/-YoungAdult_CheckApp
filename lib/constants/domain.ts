export const GENDER_OPTIONS = ["형제", "자매"] as const;

export const ATTENDANCE_STATUS_OPTIONS = [
  "정상출석",
  "지각",
  "결석",
  "행사",
] as const;

export const LEADERSHIP_NOTE_CATEGORY_OPTIONS = [
  "부서원 근황",
  "부서원 심방계획",
  "전도인 전달사항",
  "교회 및 청년회 관련광고",
] as const;

export const LEADERSHIP_VISIT_STATUS_OPTIONS = ["예정", "진행중", "완료"] as const;

export type Gender = (typeof GENDER_OPTIONS)[number];
export type AttendanceStatus = (typeof ATTENDANCE_STATUS_OPTIONS)[number];
export type LeadershipNoteCategory = (typeof LEADERSHIP_NOTE_CATEGORY_OPTIONS)[number];
export type LeadershipVisitStatus = (typeof LEADERSHIP_VISIT_STATUS_OPTIONS)[number];
