"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { saveLeadershipMeetingItemsAction } from "@/app/(admin)/leaders/actions";
import {
  LeadershipItemForm,
  type DepartmentOption,
  type LeadershipItemDraftInput,
  type MemberOption,
} from "@/components/leaders/leadership-item-form";
import { LeadershipSectionTable } from "@/components/leaders/leadership-section-table";
import {
  LEADERSHIP_NOTE_CATEGORY_OPTIONS,
  LEADERSHIP_VISIT_STATUS_OPTIONS,
  type LeadershipNoteCategory,
  type LeadershipVisitStatus,
} from "@/lib/constants/domain";
import { formatDate } from "@/lib/utils/format";

type LeadershipMeetingEditorProps = {
  selectedDate: string;
  canManage: boolean;
  departments: DepartmentOption[];
  members: MemberOption[];
  currentItems: LeadershipItemRow[];
};

type LeadershipItemRow = {
  id: string;
  member_id: string | null;
  category: LeadershipNoteCategory;
  content: string;
  department_name: string | null;
  member_name: string | null;
  status: LeadershipVisitStatus | null;
  due_date: string | null;
  created_at: string;
  members: {
    name: string;
    departments: {
      name: string;
    } | null;
  } | null;
};

type EditorItem = {
  clientId: string;
  id: string | null;
  category: LeadershipNoteCategory;
  departmentName: string;
  memberName: string;
  memberId: string;
  content: string;
  status: LeadershipVisitStatus | "";
  dueDate: string;
  createdAt: string;
};

const categoryMeta: Array<{
  value: LeadershipNoteCategory;
  title: string;
  description: string;
  placeholder: string;
  accentClassName: string;
}> = [
  {
    value: "부서원 근황",
    title: "부서원 근황",
    description: "개인 소식, 기도제목, 변화된 상황을 적어 두었다가 마지막에 한 번에 저장합니다.",
    placeholder: "예: 새 직장 적응 중이며 주일 오전 봉사로 피곤함이 있어 기도 필요",
    accentClassName: "border-blue-200 bg-blue-50/70",
  },
  {
    value: "부서원 심방계획",
    title: "부서원 심방계획",
    description: "심방 예정자와 일정, 목표를 작성하고 수정한 뒤 전체 저장으로 반영합니다.",
    placeholder: "예: 다음 주 화요일 저녁 카페 심방 예정, 최근 예배 결석 사유 확인",
    accentClassName: "border-amber-200 bg-amber-50/70",
  },
  {
    value: "전도인 전달사항",
    title: "전도인 전달사항",
    description: "임원들에게 전달할 지침과 공지를 회차별로 정리합니다.",
    placeholder: "예: 새가족 정착 체크를 이번 달에는 부서별로 나누어 진행",
    accentClassName: "border-emerald-200 bg-emerald-50/70",
  },
  {
    value: "교회 및 청년회 관련광고",
    title: "교회 및 청년회 관련광고",
    description: "행사 일정과 광고 문안을 모아 두고 저장 전에 함께 검토합니다.",
    placeholder: "예: 다음 주 토요일 청년회 연합체육대회 광고를 주일 광고 시간에 안내",
    accentClassName: "border-violet-200 bg-violet-50/70",
  },
];

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function statusClassName(status: LeadershipVisitStatus | null | "") {
  switch (status) {
    case "예정":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "진행중":
      return "border-amber-200 bg-amber-100 text-amber-800";
    case "완료":
      return "border-emerald-200 bg-emerald-100 text-emerald-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

function sortChronologically(items: EditorItem[]) {
  return [...items].sort((a, b) => {
    if (a.createdAt === b.createdAt) {
      return 0;
    }

    return a.createdAt > b.createdAt ? 1 : -1;
  });
}

function createDraftId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `draft-${crypto.randomUUID()}`;
  }

  return `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function matchMember(members: MemberOption[], memberName: string, departmentName: string) {
  const normalizedMemberName = normalizeText(memberName);
  const normalizedDepartmentName = normalizeText(departmentName);

  if (!normalizedMemberName) {
    return null;
  }

  const filteredMembers = normalizedDepartmentName
    ? members.filter((member) => member.departmentName === normalizedDepartmentName)
    : members;

  const exactMatches = filteredMembers.filter((member) => member.name === normalizedMemberName);
  if (exactMatches.length === 1) {
    return exactMatches[0];
  }

  if (normalizedDepartmentName) {
    return null;
  }

  const globalMatches = members.filter((member) => member.name === normalizedMemberName);
  return globalMatches.length === 1 ? globalMatches[0] : null;
}

function mapToEditorItem(item: LeadershipItemRow): EditorItem {
  return {
    clientId: item.id,
    id: item.id,
    category: item.category,
    departmentName: item.department_name ?? item.members?.departments?.name ?? "",
    memberName: item.member_name ?? item.members?.name ?? "",
    memberId: item.member_id ?? "",
    content: item.content,
    status: item.status ?? "",
    dueDate: item.due_date ?? "",
    createdAt: item.created_at,
  };
}

function comparableItem(item: EditorItem) {
  return {
    category: item.category,
    departmentName: normalizeText(item.departmentName),
    memberName: normalizeText(item.memberName),
    memberId: normalizeText(item.memberId),
    content: normalizeText(item.content),
    status: item.status || null,
    dueDate: normalizeText(item.dueDate) || null,
  };
}

function toPayloadItem(item: EditorItem) {
  return {
    id: item.id,
    category: item.category,
    departmentName: normalizeText(item.departmentName),
    memberName: normalizeText(item.memberName),
    memberId: normalizeText(item.memberId),
    content: normalizeText(item.content),
    status: item.status || null,
    dueDate: normalizeText(item.dueDate) || null,
  };
}

function SaveAllButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className={[
        "inline-flex min-w-[128px] items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition",
        disabled || pending
          ? "cursor-not-allowed bg-slate-300 shadow-none"
          : "bg-[#2563eb] hover:bg-[#1d4ed8] active:translate-y-[1px] active:scale-[0.98]",
      ].join(" ")}
    >
      {pending ? "저장 중..." : "전체 저장"}
    </button>
  );
}

export function LeadershipMeetingEditor({
  selectedDate,
  canManage,
  departments,
  members,
  currentItems,
}: LeadershipMeetingEditorProps) {
  const [items, setItems] = useState(() => currentItems.map(mapToEditorItem));
  const [deletedItemIds, setDeletedItemIds] = useState<string[]>([]);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);

  const initialComparableById = new Map(
    currentItems.map((item) => {
      const mappedItem = mapToEditorItem(item);
      return [item.id, JSON.stringify(comparableItem(mappedItem))] as const;
    }),
  );

  const draftItems = items.filter((item) => !item.id);
  const updatedItems = items.filter((item) => {
    if (!item.id) {
      return false;
    }

    return initialComparableById.get(item.id) !== JSON.stringify(comparableItem(item));
  });
  const updatedItemIds = new Set(updatedItems.map((item) => item.id).filter(Boolean));
  const hasPendingChanges = draftItems.length > 0 || updatedItems.length > 0 || deletedItemIds.length > 0;
  const payload = JSON.stringify({
    newItems: draftItems.map(toPayloadItem),
    updatedItems: updatedItems.map(toPayloadItem),
    deletedItemIds,
  });

  function addDraftItem(draft: LeadershipItemDraftInput) {
    setItems((currentValue) => [
      ...currentValue,
      {
        clientId: createDraftId(),
        id: null,
        category: draft.category,
        departmentName: draft.departmentName,
        memberName: draft.memberName,
        memberId: draft.memberId,
        content: draft.content,
        status: draft.status,
        dueDate: draft.dueDate,
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  function updateItem(clientId: string, nextValue: Partial<EditorItem>) {
    setItems((currentValue) =>
      currentValue.map((item) => (item.clientId === clientId ? { ...item, ...nextValue } : item)),
    );
  }

  function handleDepartmentChange(clientId: string, nextDepartmentName: string) {
    setItems((currentValue) =>
      currentValue.map((item) => {
        if (item.clientId !== clientId) {
          return item;
        }

        const normalizedNextDepartmentName = normalizeText(nextDepartmentName);
        const filteredMembers = normalizedNextDepartmentName
          ? members.filter((member) => member.departmentName === normalizedNextDepartmentName)
          : members;
        const memberStillVisible = !normalizeText(item.memberName)
          ? true
          : filteredMembers.some((member) => member.name === normalizeText(item.memberName));
        const nextMemberName = memberStillVisible ? item.memberName : "";
        const matchedMember = matchMember(members, nextMemberName, nextDepartmentName);

        return {
          ...item,
          departmentName: nextDepartmentName,
          memberName: nextMemberName,
          memberId: matchedMember?.id ?? "",
        };
      }),
    );
  }

  function handleMemberChange(clientId: string, nextMemberName: string) {
    setItems((currentValue) =>
      currentValue.map((item) => {
        if (item.clientId !== clientId) {
          return item;
        }

        const matchedMember = matchMember(members, nextMemberName, item.departmentName);
        return {
          ...item,
          memberName: nextMemberName,
          memberId: matchedMember?.id ?? "",
        };
      }),
    );
  }

  function handleDelete(clientId: string) {
    const targetItem = items.find((item) => item.clientId === clientId);
    if (!targetItem) {
      return;
    }

    if (targetItem.id) {
      setDeletedItemIds((currentValue) =>
        currentValue.includes(targetItem.id as string) ? currentValue : [...currentValue, targetItem.id as string],
      );
    }

    setItems((currentValue) => currentValue.filter((item) => item.clientId !== clientId));

    if (editingClientId === clientId) {
      setEditingClientId(null);
    }
  }

  return (
    <div className="space-y-5">
      {canManage ? (
        <form action={saveLeadershipMeetingItemsAction} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <input type="hidden" name="meetingDate" value={selectedDate} />
          <input type="hidden" name="payload" value={payload} />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-slate-900">한꺼번에 저장</h3>
              <p className="text-sm text-slate-600">
                추가와 수정, 삭제를 먼저 정리한 뒤 마지막에 한 번만 저장하세요.
              </p>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">
                  신규 {draftItems.length}건
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
                  수정 {updatedItems.length}건
                </span>
                <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700">
                  삭제 {deletedItemIds.length}건
                </span>
              </div>
            </div>
            <SaveAllButton disabled={!hasPendingChanges} />
          </div>
        </form>
      ) : null}

      <section className="space-y-5">
        {LEADERSHIP_NOTE_CATEGORY_OPTIONS.map((category) => {
          const meta = categoryMeta.find((entry) => entry.value === category) ?? categoryMeta[0];
          const isMemberCategory = category === "부서원 근황" || category === "부서원 심방계획";
          const isVisitPlan = category === "부서원 심방계획";
          const categoryItems = sortChronologically(items.filter((item) => item.category === category));
          const tableColumns = isMemberCategory
            ? isVisitPlan
              ? [
                  { label: "번호", className: "w-16" },
                  { label: "부서", className: "w-28" },
                  { label: "부서원", className: "w-28" },
                  { label: "내용" },
                  { label: "상태", className: "w-28" },
                  { label: "예정일", className: "w-28" },
                  { label: "관리", className: "w-36" },
                ]
              : [
                  { label: "번호", className: "w-16" },
                  { label: "부서", className: "w-28" },
                  { label: "부서원", className: "w-28" },
                  { label: "내용" },
                  { label: "작성일", className: "w-28" },
                  { label: "관리", className: "w-36" },
                ]
            : [
                { label: "번호", className: "w-16" },
                { label: "내용" },
                { label: "작성일", className: "w-28" },
                { label: "관리", className: "w-36" },
              ];

          return (
            <LeadershipSectionTable
              key={category}
              title={meta.title}
              description={meta.description}
              accentClassName={meta.accentClassName}
              columns={tableColumns}
              items={categoryItems}
              emptyMessage="아직 기록이 없습니다."
              tableClassName="min-w-full text-sm"
              renderRow={(item, index) => {
                const isEditing = editingClientId === item.clientId;
                const itemChanged = item.id ? updatedItemIds.has(item.id) : false;
                const normalizedDepartmentName = normalizeText(item.departmentName);
                const filteredMembers = normalizedDepartmentName
                  ? members.filter((member) => member.departmentName === normalizedDepartmentName)
                  : members;

                return (
                  <tr key={item.clientId} className="align-top">
                    <td className="px-4 py-4 font-semibold text-slate-600">{index + 1}</td>
                    {isMemberCategory ? (
                      <>
                        <td className="px-4 py-4 text-slate-700">
                          {isEditing ? (
                            <input
                              list={`${item.clientId}-departments`}
                              value={item.departmentName}
                              onChange={(event) => handleDepartmentChange(item.clientId, event.target.value)}
                              placeholder="부서 입력"
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                            />
                          ) : (
                            item.departmentName || "공통"
                          )}
                          {isEditing ? (
                            <datalist id={`${item.clientId}-departments`}>
                              {departments.map((department) => (
                                <option key={department.id} value={department.name} />
                              ))}
                            </datalist>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          {isEditing ? (
                            <>
                              <input
                                list={`${item.clientId}-members`}
                                value={item.memberName}
                                onChange={(event) => handleMemberChange(item.clientId, event.target.value)}
                                placeholder="부서원 입력"
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                              />
                              <datalist id={`${item.clientId}-members`}>
                                {filteredMembers.map((member) => (
                                  <option key={member.id} value={member.name}>
                                    {member.departmentName ?? ""}
                                  </option>
                                ))}
                              </datalist>
                            </>
                          ) : (
                            item.memberName || "공통"
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-pre-wrap leading-6 text-slate-700">
                          {isEditing ? (
                            <textarea
                              value={item.content}
                              onChange={(event) => updateItem(item.clientId, { content: event.target.value })}
                              rows={3}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                            />
                          ) : (
                            item.content
                          )}
                        </td>
                        {isVisitPlan ? (
                          <>
                            <td className="px-4 py-4">
                              {isEditing ? (
                                <select
                                  value={item.status || "예정"}
                                  onChange={(event) =>
                                    updateItem(item.clientId, {
                                      status: event.target.value as LeadershipVisitStatus,
                                    })
                                  }
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                >
                                  {LEADERSHIP_VISIT_STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </select>
                              ) : item.status ? (
                                <span
                                  className={[
                                    "rounded-full border px-2 py-1 text-xs font-semibold",
                                    statusClassName(item.status),
                                  ].join(" ")}
                                >
                                  {item.status}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-slate-600">
                              {isEditing ? (
                                <input
                                  type="date"
                                  value={item.dueDate}
                                  onChange={(event) => updateItem(item.clientId, { dueDate: event.target.value })}
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                                />
                              ) : item.dueDate ? (
                                formatDate(item.dueDate)
                              ) : (
                                "-"
                              )}
                            </td>
                          </>
                        ) : (
                          <td className="px-4 py-4 text-slate-600">{formatDate(item.createdAt)}</td>
                        )}
                        <td className="px-4 py-4">
                          {canManage ? (
                            <div className="flex flex-wrap items-center gap-2">
                              {!item.id ? (
                                <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                                  저장 전
                                </span>
                              ) : itemChanged ? (
                                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                                  수정됨
                                </span>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => setEditingClientId(isEditing ? null : item.clientId)}
                                className="text-xs font-semibold text-blue-700 hover:text-blue-800"
                              >
                                {isEditing ? "완료" : "수정"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(item.clientId)}
                                className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                              >
                                삭제
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-4 whitespace-pre-wrap leading-6 text-slate-700">
                          {isEditing ? (
                            <textarea
                              value={item.content}
                              onChange={(event) => updateItem(item.clientId, { content: event.target.value })}
                              rows={3}
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                            />
                          ) : (
                            item.content
                          )}
                        </td>
                        <td className="px-4 py-4 text-slate-600">{formatDate(item.createdAt)}</td>
                        <td className="px-4 py-4">
                          {canManage ? (
                            <div className="flex flex-wrap items-center gap-2">
                              {!item.id ? (
                                <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                                  저장 전
                                </span>
                              ) : itemChanged ? (
                                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                                  수정됨
                                </span>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => setEditingClientId(isEditing ? null : item.clientId)}
                                className="text-xs font-semibold text-blue-700 hover:text-blue-800"
                              >
                                {isEditing ? "완료" : "수정"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(item.clientId)}
                                className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                              >
                                삭제
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                );
              }}
              footer={
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-slate-700">아래 줄 추가</div>
                  <LeadershipItemForm
                    category={category}
                    title={meta.title}
                    submitLabel={
                      category === "부서원 근황"
                        ? "근황 추가"
                        : category === "부서원 심방계획"
                          ? "심방계획 추가"
                          : category === "전도인 전달사항"
                            ? "전달사항 추가"
                            : "광고 추가"
                    }
                    placeholder={meta.placeholder}
                    canManage={canManage}
                    departments={departments}
                    members={members}
                    onAdd={addDraftItem}
                  />
                </div>
              }
            />
          );
        })}
      </section>
    </div>
  );
}
