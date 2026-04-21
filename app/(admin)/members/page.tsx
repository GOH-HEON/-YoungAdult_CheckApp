import Link from "next/link";
import { PageTitle } from "@/components/ui/page-title";
import { deleteMemberAction, toggleMemberActiveAction } from "@/app/(admin)/members/actions";
import { requireSession } from "@/lib/auth/session";
import { compareDepartmentName } from "@/lib/utils/department-order";
import { formatDate, maskPhone } from "@/lib/utils/format";

type MembersPageProps = {
  searchParams: Promise<{
    q?: string;
    gender?: string;
    departmentId?: string;
    active?: "all" | "active" | "inactive";
    level?: "ok" | "error";
    message?: string;
  }>;
};

type MemberRow = {
  id: string;
  name: string;
  gender: "형제" | "자매";
  birth_year: number;
  salvation_date: string | null;
  phone: string | null;
  is_active: boolean;
  department_id: number | null;
  departments: { name: string } | null;
};

type DepartmentRow = {
  id: number;
  name: string;
};

function compareGenderOrder(a: "형제" | "자매", b: "형제" | "자매") {
  if (a === b) {
    return 0;
  }
  return a === "형제" ? -1 : 1;
}

export default async function MembersPage({ searchParams }: MembersPageProps) {
  const params = await searchParams;
  const { supabase } = await requireSession();

  const q = params.q?.trim() ?? "";
  const gender = params.gender === "형제" || params.gender === "자매" ? params.gender : "";
  const departmentId = Number.parseInt(params.departmentId ?? "", 10);
  const activeFilter = params.active ?? "all";

  let membersQuery = supabase
    .from("members")
    .select("id, name, gender, birth_year, salvation_date, phone, is_active, department_id, departments(name)")
    .order("name");

  if (q) {
    membersQuery = membersQuery.ilike("name", `%${q}%`);
  }
  if (gender) {
    membersQuery = membersQuery.eq("gender", gender);
  }
  if (!Number.isNaN(departmentId)) {
    membersQuery = membersQuery.eq("department_id", departmentId);
  }
  if (activeFilter === "active") {
    membersQuery = membersQuery.eq("is_active", true);
  } else if (activeFilter === "inactive") {
    membersQuery = membersQuery.eq("is_active", false);
  }

  const [{ data: members, error: memberError }, { data: departments, error: departmentError }] =
    await Promise.all([
      membersQuery,
      supabase.from("departments").select("id, name").order("name"),
    ]);

  const sortedDepartments = [...((departments as DepartmentRow[] | null) ?? [])].sort((a, b) =>
    compareDepartmentName(a.name, b.name),
  );

  const sortedMembers = [...((members as MemberRow[] | null) ?? [])].sort((a, b) => {
    const depDiff = compareDepartmentName(a.departments?.name ?? null, b.departments?.name ?? null);
    if (depDiff !== 0) {
      return depDiff;
    }

    const genderDiff = compareGenderOrder(a.gender, b.gender);
    if (genderDiff !== 0) {
      return genderDiff;
    }

    return a.name.localeCompare(b.name, "ko");
  });

  return (
    <div className="space-y-6">
      <PageTitle
        title="형제/자매 명단"
        description="명단 조회, 검색/필터, 비활성 처리를 한 화면에서 관리합니다."
      />

      {params.message ? (
        <div
          className={[
            "rounded-xl border px-4 py-3 text-sm",
            params.level === "error"
              ? "border-rose-300 bg-rose-50 text-rose-700"
              : "border-emerald-300 bg-emerald-50 text-emerald-700",
          ].join(" ")}
        >
          {params.message}
        </div>
      ) : null}

      <form className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-4">
        <label className="space-y-1 text-sm sm:col-span-2">
          <span className="font-medium text-slate-700">이름 검색</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="이름 입력"
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">성별</span>
          <select name="gender" defaultValue={gender} className="w-full rounded-lg border border-slate-300 px-3 py-2">
            <option value="">전체</option>
            <option value="형제">형제</option>
            <option value="자매">자매</option>
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">소속부서</span>
          <select
            name="departmentId"
            defaultValue={!Number.isNaN(departmentId) ? String(departmentId) : ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="">전체</option>
            {sortedDepartments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-700">활성 상태</span>
          <select name="active" defaultValue={activeFilter} className="w-full rounded-lg border border-slate-300 px-3 py-2">
            <option value="all">전체</option>
            <option value="active">활성</option>
            <option value="inactive">비활성</option>
          </select>
        </label>

        <div className="flex items-end gap-2 sm:col-span-3">
          <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
            필터 적용
          </button>
          <Link
            href="/members"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          >
            초기화
          </Link>
          <Link
            href="/members/new"
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
          >
            새 명단 등록
          </Link>
        </div>
      </form>

      {memberError ? (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          명단 조회 오류: {memberError.message}
        </p>
      ) : null}
      {departmentError ? (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          소속부서 조회 오류: {departmentError.message}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-100 text-left text-slate-700">
            <tr>
              <th className="px-3 py-2">이름</th>
              <th className="px-3 py-2">성별</th>
              <th className="px-3 py-2">생년</th>
              <th className="px-3 py-2">구원일</th>
              <th className="px-3 py-2">연락처</th>
              <th className="px-3 py-2">소속부서</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {sortedMembers.map((member) => (
              <tr key={member.id}>
                <td className="px-3 py-2 font-medium text-slate-900">{member.name}</td>
                <td className="px-3 py-2">{member.gender}</td>
                <td className="px-3 py-2">{member.birth_year}</td>
                <td className="px-3 py-2">{formatDate(member.salvation_date)}</td>
                <td className="px-3 py-2">{maskPhone(member.phone)}</td>
                <td className="px-3 py-2">{member.departments?.name ?? "-"}</td>
                <td className="px-3 py-2">
                  <span
                    className={[
                      "rounded-full px-2 py-1 text-xs font-semibold",
                      member.is_active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-600",
                    ].join(" ")}
                  >
                    {member.is_active ? "활성" : "비활성"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/members/${member.id}/edit`}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700"
                    >
                      수정
                    </Link>
                    <form action={toggleMemberActiveAction}>
                      <input type="hidden" name="id" value={member.id} />
                      <input type="hidden" name="is_active" value={String(member.is_active)} />
                      <button
                        type="submit"
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700"
                      >
                        {member.is_active ? "비활성" : "활성"}
                      </button>
                    </form>
                    <form action={deleteMemberAction}>
                      <input type="hidden" name="id" value={member.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700"
                      >
                        삭제
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sortedMembers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          조건에 해당하는 형제/자매가 없습니다.
        </p>
      ) : null}
    </div>
  );
}
