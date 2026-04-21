import type { AttendanceStatus } from "@/lib/constants/domain";

const positiveStatuses: AttendanceStatus[] = ["정상출석", "지각", "행사"];

type MeetingData = {
  id: string;
  meeting_date: string;
  meeting_type_name: string;
};

type AttendanceRecordData = {
  meeting_id: string;
  member_id: string;
  status: AttendanceStatus;
};

type AbsenceRecordData = {
  member_id: string;
  member_name: string;
};

export type DateSeriesPoint = {
  date: string;
  meetingType: string;
  attendanceRate: number;
  trendLine: number;
};

export type MeetingTypeSeriesPoint = {
  meetingType: string;
  attendanceRate: number;
};

export type AbsenceSummaryPoint = {
  memberId: string;
  memberName: string;
  absenceCount: number;
};

export function buildDateSeries(
  meetings: MeetingData[],
  records: AttendanceRecordData[],
  totalTargetMembers: number,
): DateSeriesPoint[] {
  if (meetings.length === 0 || totalTargetMembers <= 0) {
    return [];
  }

  const positiveCountByMeeting = new Map<string, number>();

  records.forEach((record) => {
    if (!positiveStatuses.includes(record.status)) {
      return;
    }

    positiveCountByMeeting.set(record.meeting_id, (positiveCountByMeeting.get(record.meeting_id) ?? 0) + 1);
  });

  const base = meetings.map((meeting) => {
    const attended = positiveCountByMeeting.get(meeting.id) ?? 0;
    const attendanceRate = (attended / totalTargetMembers) * 100;

    return {
      date: meeting.meeting_date,
      meetingType: meeting.meeting_type_name,
      attendanceRate: Number(attendanceRate.toFixed(2)),
      trendLine: 0,
    };
  });

  return addTrendLine(base);
}

function addTrendLine(points: DateSeriesPoint[]) {
  if (points.length === 0) {
    return points;
  }

  const n = points.length;
  const xMean = (n - 1) / 2;
  const yMean = points.reduce((acc, point) => acc + point.attendanceRate, 0) / n;

  let numerator = 0;
  let denominator = 0;

  points.forEach((point, index) => {
    numerator += (index - xMean) * (point.attendanceRate - yMean);
    denominator += (index - xMean) ** 2;
  });

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;

  return points.map((point, index) => ({
    ...point,
    trendLine: Number((intercept + slope * index).toFixed(2)),
  }));
}

export function buildMeetingTypeSeries(
  meetings: MeetingData[],
  records: AttendanceRecordData[],
  totalTargetMembers: number,
): MeetingTypeSeriesPoint[] {
  if (meetings.length === 0 || totalTargetMembers <= 0) {
    return [];
  }

  const meetingTypeByMeetingId = new Map(meetings.map((meeting) => [meeting.id, meeting.meeting_type_name]));
  const aggregate = new Map<string, { totalSlots: number; attended: number }>();

  meetings.forEach((meeting) => {
    const existing = aggregate.get(meeting.meeting_type_name) ?? { totalSlots: 0, attended: 0 };
    aggregate.set(meeting.meeting_type_name, {
      totalSlots: existing.totalSlots + totalTargetMembers,
      attended: existing.attended,
    });
  });

  records.forEach((record) => {
    if (!positiveStatuses.includes(record.status)) {
      return;
    }

    const meetingTypeName = meetingTypeByMeetingId.get(record.meeting_id);
    if (!meetingTypeName) {
      return;
    }

    const existing = aggregate.get(meetingTypeName);
    if (!existing) {
      return;
    }

    aggregate.set(meetingTypeName, {
      ...existing,
      attended: existing.attended + 1,
    });
  });

  return Array.from(aggregate.entries()).map(([meetingType, value]) => ({
    meetingType,
    attendanceRate: Number(((value.attended / value.totalSlots) * 100).toFixed(2)),
  }));
}

export function buildAbsenceSummary(records: AbsenceRecordData[], limit = 10): AbsenceSummaryPoint[] {
  const grouped = new Map<string, AbsenceSummaryPoint>();

  records.forEach((record) => {
    const prev = grouped.get(record.member_id);
    grouped.set(record.member_id, {
      memberId: record.member_id,
      memberName: record.member_name,
      absenceCount: (prev?.absenceCount ?? 0) + 1,
    });
  });

  return Array.from(grouped.values())
    .sort((a, b) => b.absenceCount - a.absenceCount)
    .slice(0, limit);
}
