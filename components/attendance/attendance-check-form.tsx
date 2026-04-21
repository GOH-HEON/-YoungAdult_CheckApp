"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ATTENDANCE_STATUS_OPTIONS, type AttendanceStatus } from "@/lib/constants/domain";

type AttendanceMember = {
  id: string;
  name: string;
  gender: "형제" | "자매";
  departmentName: string;
};

type ExistingRecord = {
  member_id: string;
  status: AttendanceStatus;
  note: string | null;
};

type AttendanceFormProps = {
  meetingTypeId?: number;
  meetingTypeName?: string;
  meetingDate: string;
  members: AttendanceMember[];
  existingRecords: ExistingRecord[];
};

type RowState = {
  status: AttendanceStatus | "";
  note: string;
};

export function AttendanceCheckForm({
  meetingTypeId,
  meetingTypeName,
  meetingDate,
  members,
  existingRecords,
}: AttendanceFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [missingIds, setMissingIds] = useState<string[]>([]);

  const initialRows = useMemo(() => {
    const byMemberId = new Map(existingRecords.map((record) => [record.member_id, record]));

    return members.reduce<Record<string, RowState>>((acc, member) => {
      const record = byMemberId.get(member.id);
      acc[member.id] = {
        status: record?.status ?? "",
        note: record?.note ?? "",
      };
      return acc;
    }, {});
  }, [existingRecords, members]);

  const [rows, setRows] = useState<Record<string, RowState>>(initialRows);

  function updateStatus(memberId: string, status: AttendanceStatus) {
    setRows((prev) => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        status,
      },
    }));
  }

  function updateNote(memberId: string, note: string) {
    setRows((prev) => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        note,
      },
    }));
  }

  async function handleSave() {
    setIsSaving(true);
    setMessage(null);

    const payload = {
      meetingTypeId,
      meetingTypeName: meetingTypeName ?? "",
      meetingDate,
      rows: members.map((member) => ({
        memberId: member.id,
        status: rows[member.id]?.status ?? "",
        note: rows[member.id]?.note ?? "",
      })),
    };

    try {
      const response = await fetch("/api/attendance/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as {
        ok: boolean;
        message?: string;
        missingMemberIds?: string[];
        savedCount?: number;
      };

      if (!response.ok || !result.ok) {
        setMessage(result.message ?? "출석 저장 중 오류가 발생했습니다.");
        setIsSaving(false);
        return;
      }

      setMissingIds(result.missingMemberIds ?? []);
      setMessage(
        `출석 저장 완료: ${result.savedCount ?? 0}명 저장, 누락 ${result.missingMemberIds?.length ?? 0}명`,
      );
      router.refresh();
    } catch {
      setMessage("출석 저장 요청에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-slate-900">
          출석 상태 선택
          <span className="ml-2 text-sm font-normal text-slate-600">
            ({meetingTypeName?.trim() || `모임 ID ${meetingTypeId ?? "-"}`}, {meetingDate})
          </span>
        </h3>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isSaving ? "저장 중..." : "출석 저장"}
        </button>
      </div>

      {message ? (
        <p className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-100 text-left text-slate-700">
            <tr>
              <th className="px-3 py-2">이름</th>
              <th className="px-3 py-2">성별</th>
              <th className="px-3 py-2">소속부서</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2">비고</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.map((member) => {
              const row = rows[member.id];
              const isMissing = !row?.status || missingIds.includes(member.id);

              return (
                <tr key={member.id} className={isMissing ? "bg-amber-50" : "bg-white"}>
                  <td className="px-3 py-2 font-medium text-slate-900">{member.name}</td>
                  <td className="px-3 py-2">{member.gender}</td>
                  <td className="px-3 py-2">{member.departmentName}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {ATTENDANCE_STATUS_OPTIONS.map((status) => {
                        const active = row?.status === status;

                        return (
                          <button
                            key={status}
                            type="button"
                            onClick={() => updateStatus(member.id, status)}
                            className={[
                              "rounded-lg border px-2 py-1 text-xs font-semibold",
                              active
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-300 bg-white text-slate-700",
                            ].join(" ")}
                          >
                            {status}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={row?.note ?? ""}
                      onChange={(event) => updateNote(member.id, event.target.value)}
                      className="w-full min-w-44 rounded-lg border border-slate-300 px-2 py-1"
                      placeholder="비고"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
