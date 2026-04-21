export const GENDER_OPTIONS = ["형제", "자매"] as const;

export const ATTENDANCE_STATUS_OPTIONS = [
  "정상출석",
  "지각",
  "결석",
  "행사",
] as const;

export type Gender = (typeof GENDER_OPTIONS)[number];
export type AttendanceStatus = (typeof ATTENDANCE_STATUS_OPTIONS)[number];
