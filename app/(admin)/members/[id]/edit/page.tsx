import { PageTitle } from "@/components/ui/page-title";
import { updateMemberAction } from "@/app/(admin)/members/actions";
import { requireAdminSession } from "@/lib/auth/session";

export default async function EditMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireAdminSession();

  const [{ data: member, error: memberError }, { data: departments, error: departmentError }] =
    await Promise.all([
      supabase
        .from("members")
        .select("id, name, gender, birth_year, salvation_date, phone, department_id, is_active")
        .eq("id", id)
        .maybeSingle(),
      supabase.from("departments").select("id, name").eq("is_active", true).order("name"),
    ]);

  return (
    <div className="space-y-6">
      <PageTitle
        title="형제/자매 정보 수정"
        description="등록된 형제/자매 정보를 수정하고 활성 상태를 조정합니다."
      />
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

      {!member ? (
        <p className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          해당 형제/자매 정보를 찾을 수 없습니다.
        </p>
      ) : (
        <form action={updateMemberAction} className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <input type="hidden" name="id" value={member.id} />

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">이름</span>
            <input
              name="name"
              required
              defaultValue={member.name}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">성별</span>
            <select
              name="gender"
              required
              defaultValue={member.gender}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
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
              defaultValue={member.birth_year}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">구원일</span>
            <input
              name="salvation_date"
              type="date"
              defaultValue={member.salvation_date ?? ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">연락처</span>
            <input
              name="phone"
              defaultValue={member.phone ?? ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">소속부서</span>
            <select
              name="department_id"
              required
              defaultValue={String(member.department_id)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              {(departments ?? []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="is_active" defaultChecked={member.is_active} className="h-4 w-4" />
            활성 상태
          </label>

          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            수정 저장
          </button>
        </form>
      )}
    </div>
  );
}
