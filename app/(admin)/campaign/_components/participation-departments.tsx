"use client";

import { useEffect, useState } from "react";

import { toggleParticipantAction } from "@/app/(admin)/campaign/actions";
import { progressWidth, type ParticipantRow } from "@/lib/campaign/campaign";

export type DeptGroup = {
  name: string;
  total: number;
  registered: number;
  done: number;
  members: ParticipantRow[];
};

function ToggleForm({
  campaignId,
  dept,
  memberId,
  field,
  on,
  onLabel,
  offLabel,
  canManage,
}: {
  campaignId: string;
  dept: string;
  memberId: string;
  field: "registered" | "participated";
  on: boolean;
  onLabel: string;
  offLabel: string;
  canManage: boolean;
}) {
  const badgeClass = on
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-50 text-slate-400";

  if (!canManage) {
    return (
      <span className={["inline-block w-24 rounded-lg border py-1.5 text-xs font-bold", badgeClass].join(" ")}>
        {on ? onLabel : offLabel}
      </span>
    );
  }

  return (
    <form action={toggleParticipantAction} className="inline-block">
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="next" value={on ? "false" : "true"} />
      <input type="hidden" name="dept" value={dept} />
      <button type="submit" className={["w-24 rounded-lg border py-1.5 text-xs font-bold transition", badgeClass].join(" ")}>
        {on ? onLabel : offLabel}
      </button>
    </form>
  );
}

export function ParticipationDepartments({
  campaignId,
  canManage,
  departments,
  initialOpenDept,
}: {
  campaignId: string;
  canManage: boolean;
  departments: DeptGroup[];
  initialOpenDept: string | null;
}) {
  const [openDept, setOpenDept] = useState<string | null>(initialOpenDept);
  const current = departments.find((d) => d.name === openDept) ?? null;

  // ESC로 닫기 + 모달 열렸을 때 배경 스크롤 잠금
  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenDept(null);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [current]);

  if (departments.length === 0) {
    return (
      <p className="px-6 py-6 text-sm text-slate-500">
        명단이 아직 시드되지 않았습니다. 캠페인에 명단을 시드해 주세요.
      </p>
    );
  }

  return (
    <>
      <p className="px-6 pt-4 text-xs text-slate-400">부서를 누르면 상세 명단이 팝업으로 열립니다.</p>
      <div className="grid grid-cols-2 gap-3 p-6 pt-3 sm:grid-cols-3 lg:grid-cols-5">
        {departments.map((dept) => (
          <button
            key={dept.name}
            type="button"
            onClick={() => setOpenDept(dept.name)}
            className="rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-400 hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-800">{dept.name}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">{dept.total}명</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">참여 {dept.done} / {dept.total}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-emerald-100">
              <div className="h-full rounded-full bg-emerald-600" style={{ width: `${progressWidth(dept.done, dept.total)}%` }} />
            </div>
            <p className="mt-2 text-[11px] font-semibold text-blue-600">명단 보기 →</p>
          </button>
        ))}
      </div>

      {current ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpenDept(null)} />
          <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h4 className="text-lg font-extrabold text-slate-900">{current.name} 명단</h4>
                <p className="mt-0.5 text-xs text-slate-500">
                  접수 {current.registered} · 참여 {current.done} / 전체 {current.total}명
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenDept(null)}
                aria-label="닫기"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </header>

            <div className="overflow-y-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5 font-bold">이름</th>
                    <th className="px-5 py-2.5 font-bold">성별</th>
                    <th className="px-5 py-2.5 text-center font-bold">접수</th>
                    <th className="px-5 py-2.5 text-center font-bold">참여</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {current.members.map((p) => (
                    <tr key={p.member_id}>
                      <td className="px-5 py-2.5 font-bold text-slate-900">{p.name}</td>
                      <td className="px-5 py-2.5">
                        <span
                          className={[
                            "rounded px-2 py-0.5 text-[11px] font-bold",
                            p.gender === "형제" ? "bg-blue-50 text-blue-700" : "bg-pink-50 text-pink-700",
                          ].join(" ")}
                        >
                          {p.gender}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-center">
                        <ToggleForm
                          campaignId={campaignId}
                          dept={current.name}
                          memberId={p.member_id}
                          field="registered"
                          on={p.registered}
                          onLabel="접수완료"
                          offLabel="미접수"
                          canManage={canManage}
                        />
                      </td>
                      <td className="px-5 py-2.5 text-center">
                        <ToggleForm
                          campaignId={campaignId}
                          dept={current.name}
                          memberId={p.member_id}
                          field="participated"
                          on={p.participated}
                          onLabel="참여완료"
                          offLabel="미참여"
                          canManage={canManage}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
