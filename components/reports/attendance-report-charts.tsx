"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DateSeriesPoint, MeetingTypeSeriesPoint } from "@/lib/reports/attendance-stats";

type AttendanceReportChartsProps = {
  dateSeries: DateSeriesPoint[];
  meetingTypeSeries: MeetingTypeSeriesPoint[];
};

function percentText(value: unknown) {
  if (typeof value === "number") {
    return `${value}%`;
  }

  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) {
    return `${asNumber}%`;
  }

  return "-";
}

export function AttendanceReportCharts({ dateSeries, meetingTypeSeries }: AttendanceReportChartsProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">날짜별 출석률</h3>
        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer>
            <LineChart data={dateSeries} margin={{ top: 16, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#d4d4d8" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => percentText(value)} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="attendanceRate" name="출석률" stroke="#111111" strokeWidth={3} dot={{ r: 3 }}>
                <LabelList dataKey="attendanceRate" position="top" formatter={(value) => percentText(value)} fontSize={11} />
              </Line>
              <Line type="linear" dataKey="trendLine" name="추세선" stroke="#737373" strokeDasharray="6 3" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-900">모임별 평균 출석률</h3>
        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer>
            <BarChart data={meetingTypeSeries} margin={{ top: 16, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#d4d4d8" strokeDasharray="3 3" />
              <XAxis dataKey="meetingType" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => percentText(value)} contentStyle={{ fontSize: 12 }} />
              <Bar dataKey="attendanceRate" name="출석률" fill="#262626" radius={[8, 8, 0, 0]}>
                <LabelList dataKey="attendanceRate" position="top" formatter={(value) => percentText(value)} fontSize={11} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
