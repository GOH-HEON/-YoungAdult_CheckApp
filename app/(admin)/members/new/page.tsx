import { PageTitle } from "@/components/ui/page-title";
import { createMemberAction } from "@/app/(admin)/members/actions";
import { requireAdminSession } from "@/lib/auth/session";

type DepartmentRow = {
  id: number;
  name: string;
};

export default async function NewMemberPage() {
  const { supabase } = await requireAdminSession();
  const { data: departments, error } = await supabase
    .from("departments")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  return (
    <div className="space-y-6">
      <PageTitle
        title="형제/자매 등록"
        description="새 형제/자매를 등록합니다. 성별은 형제/자매만 사용할 수 있습니다."
      />
      {error ? (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          소속부서 조회 오류: {error.message}
        </p>
      ) : null}

      <form action={createMemberAction} className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
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
            inputMode="numeric"
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

        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="is_active" defaultChecked className="h-4 w-4" />
          활성 상태로 등록
        </label>

        <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          등록 저장
        </button>
      </form>
    </div>
  );
}
