import type { AttendanceStatus } from "@/lib/constants/domain";

const positiveStatuses: AttendanceStatus[] = ["정상출석", "지각", "행사"];
const scoreWeights: Record<AttendanceStatus, number> = {
  정상출석: 1,
  지각: 0.5,
  결석: 0,
  행사: 0.2,
};

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

export type ScoreMeetingData = {
  id: string;
  meeting_date: string;
};

export type ScoreMemberData = {
  id: string;
  name: string;
  gender: "형제" | "자매";
  departmentName: string;
};

export type MemberScorePoint = {
  memberId: string;
  memberName: string;
  gender: "형제" | "자매";
  departmentName: string;
  totalMeetings: number;
  정상출석: number;
  지각: number;
  결석: number;
  행사: number;
  미기록: number;
  totalScore: number;
  averageScore: number;
  scoreRate: number;
};

export type ScoreOverview = {
  memberCount: number;
  meetingCount: number;
  averageScore: number;
  averageScoreRate: number;
  highestScore: number;
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

export function buildMemberScoreTable(
  members: ScoreMemberData[],
  meetings: ScoreMeetingData[],
  records: AttendanceRecordData[],
): MemberScorePoint[] {
  const totalMeetings = meetings.length;
  const scores = new Map<string, MemberScorePoint>();

  members.forEach((member) => {
    scores.set(member.id, {
      memberId: member.id,
      memberName: member.name,
      gender: member.gender,
      departmentName: member.departmentName,
      totalMeetings,
      정상출석: 0,
      지각: 0,
      결석: 0,
      행사: 0,
      미기록: totalMeetings,
      totalScore: 0,
      averageScore: 0,
      scoreRate: 0,
    });
  });

  records.forEach((record) => {
    const target = scores.get(record.member_id);
    if (!target) {
      return;
    }

    target[record.status] += 1;
  });

  return Array.from(scores.values()).map((item) => {
    const recordedCount = item.정상출석 + item.지각 + item.결석 + item.행사;
    const 미기록 = Math.max(totalMeetings - recordedCount, 0);
    const totalScore = Number(
      (
        item.정상출석 * scoreWeights.정상출석 +
        item.지각 * scoreWeights.지각 +
        item.행사 * scoreWeights.행사 +
        item.결석 * scoreWeights.결석
      ).toFixed(2),
    );
    const averageScore = Number((totalMeetings > 0 ? totalScore / totalMeetings : 0).toFixed(3));
    const scoreRate = Number((averageScore * 100).toFixed(1));

    return {
      ...item,
      미기록,
      totalScore,
      averageScore,
      scoreRate,
    };
  });
}

export function sortMemberScoreTable(
  rows: MemberScorePoint[],
  sortBy:
    | "scoreRateDesc"
    | "scoreRateAsc"
    | "totalScoreDesc"
    | "nameAsc"
    | "absenceDesc"
    | "missingDesc" = "scoreRateAsc",
) {
  const sorted = [...rows];

  sorted.sort((a, b) => {
    switch (sortBy) {
      case "scoreRateDesc":
        return b.scoreRate - a.scoreRate || b.totalScore - a.totalScore || a.memberName.localeCompare(b.memberName, "ko");
      case "totalScoreDesc":
        return b.totalScore - a.totalScore || b.scoreRate - a.scoreRate || a.memberName.localeCompare(b.memberName, "ko");
      case "nameAsc":
        return a.memberName.localeCompare(b.memberName, "ko");
      case "absenceDesc":
        return b.결석 - a.결석 || a.scoreRate - b.scoreRate || a.memberName.localeCompare(b.memberName, "ko");
      case "missingDesc":
        return b.미기록 - a.미기록 || a.scoreRate - b.scoreRate || a.memberName.localeCompare(b.memberName, "ko");
      case "scoreRateAsc":
      default:
        return a.scoreRate - b.scoreRate || b.미기록 - a.미기록 || a.memberName.localeCompare(b.memberName, "ko");
    }
  });

  return sorted;
}

export function buildScoreOverview(rows: MemberScorePoint[]): ScoreOverview {
  if (rows.length === 0) {
    return {
      memberCount: 0,
      meetingCount: 0,
      averageScore: 0,
      averageScoreRate: 0,
      highestScore: 0,
    };
  }

  const totalAverage = rows.reduce((acc, row) => acc + row.averageScore, 0);
  const highestScore = Math.max(...rows.map((row) => row.totalScore));

  return {
    memberCount: rows.length,
    meetingCount: rows[0]?.totalMeetings ?? 0,
    averageScore: Number((totalAverage / rows.length).toFixed(3)),
    averageScoreRate: Number(((totalAverage / rows.length) * 100).toFixed(1)),
    highestScore,
  };
}
