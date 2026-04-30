"use client";

import { useId, useMemo, useState } from "react";

import { createLeadershipItemAction } from "@/app/(admin)/leaders/actions";
import {
  LEADERSHIP_VISIT_STATUS_OPTIONS,
  type LeadershipNoteCategory,
} from "@/lib/constants/domain";

type DepartmentOption = {
  id: number;
  name: string;
};

type MemberOption = {
  id: string;
  name: string;
  departmentName: string | null;
};

type LeadershipItemFormProps = {
  category: LeadershipNoteCategory;
  selectedDate: string;
  title: string;
  placeholder: string;
  members: MemberOption[];
  departments: DepartmentOption[];
  canManage: boolean;
};

function normalizeText(value: string) {
  return value.trim();
}

function createSafeId(value: string) {
  return value.replace(/\s+/g, "-");
}

export function LeadershipItemForm({
  category,
  selectedDate,
  title,
  placeholder,
  members,
  departments,
  canManage,
}: LeadershipItemFormProps) {
  const baseId = useId();
  const categoryId = createSafeId(category);
  const departmentListId = `${baseId}-${categoryId}-departments`;
  const memberListId = `${baseId}-${categoryId}-members`;
  const isVisitPlan = category === "부서원 심방계획";
  const allowsMemberSelect = category === "부서원 근황" || isVisitPlan;

  const [departmentName, setDepartmentName] = useState("");
  const [memberName, setMemberName] = useState("");

  const normalizedDepartmentName = normalizeText(departmentName);
  const normalizedMemberName = normalizeText(memberName);

  const selectedDepartment = useMemo(
    () => departments.find((department) => department.name === normalizedDepartmentName) ?? null,
    [departments, normalizedDepartmentName],
  );

  const filteredMembers = useMemo(() => {
    if (!selectedDepartment) {
      return members;
    }

    return members.filter((member) => member.departmentName === selectedDepartment.name);
  }, [members, selectedDepartment]);

  const matchedMember = useMemo(() => {
    if (!normalizedMemberName) {
      return null;
    }

    const exactMatches = filteredMembers.filter((member) => member.name === normalizedMemberName);
    if (exactMatches.length === 1) {
      return exactMatches[0];
    }

    if (selectedDepartment) {
      return null;
    }

    const globalMatches = members.filter((member) => member.name === normalizedMemberName);
    return globalMatches.length === 1 ? globalMatches[0] : null;
  }, [filteredMembers, members, normalizedMemberName, selectedDepartment]);

  const memberPlaceholder = selectedDepartment
    ? `${selectedDepartment.name} 부서원 선택 또는 직접 입력`
    : "부서원을 선택하거나 직접 입력";

  function handleDepartmentChange(nextDepartmentName: string) {
    const normalizedNextDepartmentName = normalizeText(nextDepartmentName);
    const nextDepartment = departments.find((department) => department.name === normalizedNextDepartmentName) ?? null;
    const nextFilteredMembers = nextDepartment
      ? members.filter((member) => member.departmentName === nextDepartment.name)
      : members;

    setDepartmentName(nextDepartmentName);

    if (!normalizeText(memberName)) {
      return;
    }

    const stillVisible = nextFilteredMembers.some((member) => member.name === normalizeText(memberName));
    if (!stillVisible && nextDepartment) {
      setMemberName("");
    }
  }

  if (!canManage) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-600">
        읽기 전용 계정은 임원모임 항목을 등록/수정할 수 없습니다.
      </div>
    );
  }

  return (
    <form action={createLeadershipItemAction} className="mt-4 space-y-3">
      <input type="hidden" name="meetingDate" value={selectedDate} />
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="memberId" value={matchedMember?.id ?? ""} />

      {allowsMemberSelect ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">부서 선택</span>
            <input
              list={departmentListId}
              name="departmentName"
              value={departmentName}
              onChange={(event) => handleDepartmentChange(event.target.value)}
              placeholder="부서를 선택하거나 직접 입력"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
            <datalist id={departmentListId}>
              {departments.map((department) => (
                <option key={department.id} value={department.name} />
              ))}
            </datalist>
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">부서원 선택</span>
            <input
              list={memberListId}
              name="memberName"
              value={memberName}
              onChange={(event) => setMemberName(event.target.value)}
              placeholder={memberPlaceholder}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
            <datalist id={memberListId}>
              {filteredMembers.map((member) => (
                <option key={member.id} value={member.name}>
                  {member.departmentName ?? ""}
                </option>
              ))}
            </datalist>
          </label>
        </div>
      ) : null}

      <label className="space-y-1 text-sm">
        <span className="font-medium text-slate-700">기록 내용</span>
        <textarea
          name="content"
          rows={4}
          required
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
        />
      </label>

      {isVisitPlan ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">진행 상태</span>
            <select
              name="status"
              defaultValue="예정"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              {LEADERSHIP_VISIT_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">예정일</span>
            <input
              name="dueDate"
              type="date"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </label>
        </div>
      ) : null}

      <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
        {title} 저장
      </button>
    </form>
  );
}
