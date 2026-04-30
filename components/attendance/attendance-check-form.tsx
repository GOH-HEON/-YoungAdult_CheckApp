"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ATTENDANCE_STATUS_OPTIONS, type AttendanceStatus } from "@/lib/constants/domain";
import { parseAttendanceWorkbook } from "@/lib/attendance/workbook";

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
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus | "">("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  function toggleSelectedMember(memberId: string) {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId],
    );
  }

  function selectAllMembers() {
    setSelectedMemberIds(members.map((member) => member.id));
  }

  function clearSelectedMembers() {
    setSelectedMemberIds([]);
  }

  function applyBulkStatus() {
    if (!bulkStatus || selectedMemberIds.length === 0) {
      return;
    }

    setRows((prev) => {
      const next = { ...prev };

      selectedMemberIds.forEach((memberId) => {
        next[memberId] = {
          ...next[memberId],
          status: bulkStatus,
        };
      });

      return next;
    });

    setMessage(`${selectedMemberIds.length}명에게 ${bulkStatus} 상태를 화면에만 일괄 적용했습니다.`);
    setSelectedMemberIds([]);
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

  async function handleImportWorkbook() {
    if (!importFile) {
      setMessage("먼저 Import 할 엑셀 파일을 선택해 주세요.");
      return;
    }

    setIsImporting(true);
    setMessage(null);

    try {
      const parsed = parseAttendanceWorkbook(await importFile.arrayBuffer());

      let appliedCount = 0;
      let skippedCount = 0;

      setRows((prev) => {
        const next = { ...prev };

        parsed.rows.forEach((row) => {
          if (!next[row.memberId]) {
            skippedCount += 1;
            return;
          }

          next[row.memberId] = {
            status: row.status,
            note: row.note,
          };
          appliedCount += 1;
        });

        return next;
      });

      setMissingIds([]);
      setImportFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setMessage(
        `엑셀 Import 완료: ${appliedCount}명 상태를 아래 표에 반영했습니다.${skippedCount > 0 ? ` (현재 명단에 없는 ${skippedCount}명은 건너뜀)` : ""} 현재 화면의 모임 종류/날짜 기준으로 검토 후 출석 저장을 눌러 주세요.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "엑셀 Import 중 오류가 발생했습니다.");
    } finally {
      setIsImporting(false);
    }
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
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            출석 상태 선택
            <span className="ml-2 text-sm font-normal text-slate-600">
              ({meetingTypeName?.trim() || `모임 ID ${meetingTypeId ?? "-"}`}, {meetingDate})
            </span>
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            체크한 사람에게만 상태를 화면상으로 일괄 적용할 수 있습니다.
            <br />
            저장은 별도 버튼으로 진행됩니다.
          </p>
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-end">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            <span className="whitespace-nowrap">적용 할 상태</span>
            <select
              value={bulkStatus}
              onChange={(event) => setBulkStatus(event.target.value as AttendanceStatus | "")}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#2563eb] focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
            >
              <option value="">선택</option>
              {ATTENDANCE_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={applyBulkStatus}
            disabled={!bulkStatus || selectedMemberIds.length === 0}
            className="flex min-h-[56px] min-w-[76px] items-center justify-center rounded-lg bg-[#2563eb] px-4 py-2 text-center text-sm font-semibold leading-4 text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>
              일괄
              <br />
              적용
            </span>
          </button>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="text-sm font-medium text-slate-700">
              <span className="mb-1 block">엑셀 Import</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                className="block w-full min-w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
              />
            </label>
            <button
              type="button"
              onClick={handleImportWorkbook}
              disabled={!importFile || isImporting}
              className="flex min-h-[56px] min-w-[76px] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-center text-sm font-semibold leading-4 text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isImporting ? (
                <span>
                  불러오는
                  <br />
                  중...
                </span>
              ) : (
                <span>
                  표에
                  <br />
                  반영
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex min-h-[56px] min-w-[76px] items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-center text-sm font-semibold leading-4 text-white disabled:opacity-60"
          >
            {isSaving ? (
              <span>
                저장
                <br />
                중...
              </span>
            ) : (
              <span>
                출석
                <br />
                저장
              </span>
            )}
          </button>
        </div>
      </div>

      {message ? (
        <p className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          onClick={selectAllMembers}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
        >
          전체 선택
        </button>
        <button
          type="button"
          onClick={clearSelectedMembers}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-50"
        >
          선택 해제
        </button>
        <p className="text-slate-500">
          선택됨: <span className="font-semibold text-slate-900">{selectedMemberIds.length}명</span>
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-100 text-left text-slate-700">
            <tr>
              <th className="w-10 px-2 py-2">
                <span className="sr-only">선택</span>
              </th>
              <th className="px-2 py-2">이름</th>
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
              const isSelected = selectedMemberIds.includes(member.id);

              return (
                <tr
                  key={member.id}
                  className={isMissing ? "bg-amber-50" : "bg-white"}
                >
                  <td className="w-10 px-2 py-2 align-middle">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectedMember(member.id)}
                      className="h-4 w-4 rounded border-slate-300 text-[#2563eb] focus:ring-[#2563eb]"
                      aria-label={`${member.name} 선택`}
                    />
                  </td>
                  <td className="px-2 py-2 font-medium text-slate-900">{member.name}</td>
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
