import { PageTitle } from "@/components/ui/page-title";
import { createNewcomerAction } from "@/app/(admin)/newcomers/actions";
import { canWrite, requireSession } from "@/lib/auth/session";
import { formatDate, maskPhone } from "@/lib/utils/format";

type NewcomersPageProps = {
  searchParams: Promise<{
    level?: "ok" | "error";
    message?: string;
  }>;
};

type DepartmentRow = {
  id: number;
  name: string;
};

type NewcomerRow = {
  id: string;
  inviter_name: string | null;
  notes: string | null;
  registered_at: string;
  members: {
    id: string;
    name: string;
    gender: "형제" | "자매";
    birth_year: number;
    salvation_date: string | null;
    phone: string | null;
    departments: {
      name: string;
    } | null;
  } | null;
};

export default async function NewcomersPage({ searchParams }: NewcomersPageProps) {
  const params = await searchParams;
  const { supabase, appUser } = await requireSession();
  const canManage = canWrite(appUser);

  const [{ data: departments, error: departmentError }, { data: newcomers, error: newcomersError }] =
    await Promise.all([
      supabase.from("departments").select("id, name").eq("is_active", true).order("name"),
      supabase
        .from("newcomer_profiles")
        .select(
          "id, inviter_name, notes, registered_at, members(id, name, gender, birth_year, salvation_date, phone, departments(name))",
        )
        .order("registered_at", { ascending: false })
        .limit(30),
    ]);

  return (
    <div className="space-y-6">
      <PageTitle
        title="새가족 관리"
        description="새가족 등록 시 members + newcomer_profiles를 함께 저장합니다."
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

      {canManage ? (
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-lg font-semibold text-slate-900">새가족 등록</h3>
          {departmentError ? (
            <p className="mt-2 text-sm text-rose-600">소속부서 조회 오류: {departmentError.message}</p>
          ) : null}
          <form action={createNewcomerAction} className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">이름</span>
              <input name="name" required className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">성별</span>
              <select name="gender" required className="w-full rounded-lg border border-slate-300 px-3 py-2">
                <option value="형제">형제</option>
                <option value="자매">자매</option>
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">생년</span>
              <input
                name="birth_year"
                type="number"
                min={1950}
                max={2100}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">구원일</span>
              <input name="salvation_date" type="date" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">연락처</span>
              <input
                name="phone"
                placeholder="010-1234-5678"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">소속부서</span>
              <select name="department_id" required className="w-full rounded-lg border border-slate-300 px-3 py-2">
                {((departments as DepartmentRow[] | null) ?? []).map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="font-medium text-slate-700">인도자</span>
              <input name="inviter_name" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="font-medium text-slate-700">특이사항</span>
              <textarea name="notes" rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <button type="submit" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white md:col-span-2">
              새가족 등록
            </button>
          </form>
        </section>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          읽기 전용 계정은 새가족 등록/수정 기능을 사용할 수 없습니다.
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-lg font-semibold text-slate-900">최근 등록 새가족</h3>
        {newcomersError ? (
          <p className="mt-2 text-sm text-rose-600">새가족 조회 오류: {newcomersError.message}</p>
        ) : null}
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100 text-left text-slate-700">
              <tr>
                <th className="px-3 py-2">등록일</th>
                <th className="px-3 py-2">이름</th>
                <th className="px-3 py-2">성별</th>
                <th className="px-3 py-2">생년</th>
                <th className="px-3 py-2">연락처</th>
                <th className="px-3 py-2">소속부서</th>
                <th className="px-3 py-2">인도자</th>
                <th className="px-3 py-2">특이사항</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {((newcomers as NewcomerRow[] | null) ?? []).map((profile) => (
                <tr key={profile.id}>
                  <td className="px-3 py-2">{formatDate(profile.registered_at)}</td>
                  <td className="px-3 py-2 font-medium text-slate-900">
                    {profile.members?.name ?? "-"}
                    <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">새가족</span>
                  </td>
                  <td className="px-3 py-2">{profile.members?.gender ?? "-"}</td>
                  <td className="px-3 py-2">{profile.members?.birth_year ?? "-"}</td>
                  <td className="px-3 py-2">{maskPhone(profile.members?.phone)}</td>
                  <td className="px-3 py-2">{profile.members?.departments?.name ?? "-"}</td>
                  <td className="px-3 py-2">{profile.inviter_name ?? "-"}</td>
                  <td className="px-3 py-2">{profile.notes ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
