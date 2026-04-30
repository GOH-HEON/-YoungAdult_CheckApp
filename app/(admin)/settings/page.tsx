import { PageTitle } from "@/components/ui/page-title";
import { requireAdminSession } from "@/lib/auth/session";
import {
  createDepartmentAction,
  createMeetingTypeAction,
  updateDepartmentAction,
  updateMeetingTypeAction,
} from "@/app/(admin)/settings/actions";

type SettingsPageProps = {
  searchParams: Promise<{
    level?: "ok" | "error";
    message?: string;
  }>;
};

type DepartmentRow = {
  id: number;
  name: string;
  is_active: boolean;
};

type MeetingTypeRow = {
  id: number;
  name: string;
  is_active: boolean;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const { supabase } = await requireAdminSession();

  const [{ data: departments, error: departmentError }, { data: meetingTypes, error: meetingTypeError }] =
    await Promise.all([
      supabase.from("departments").select("id, name, is_active").order("name"),
      supabase.from("meeting_types").select("id, name, is_active").order("name"),
    ]);

  return (
    <div className="space-y-6">
      <PageTitle
        title="설정"
        description="소속부서와 모임 종류를 추가/수정하고 활성 상태를 관리합니다."
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

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-lg font-semibold text-slate-900">소속부서 관리</h3>
        <form action={createDepartmentAction} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            name="name"
            required
            placeholder="새 소속부서 이름"
            className="min-w-56 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
          >
            소속부서 추가
          </button>
        </form>
        {departmentError ? (
          <p className="mt-3 text-sm text-rose-600">
            소속부서 조회 오류: {departmentError.message}
          </p>
        ) : null}
        <div className="mt-4 space-y-2">
          {((departments as DepartmentRow[] | null) ?? []).map((department) => (
            <form
              key={department.id}
              action={updateDepartmentAction}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3"
            >
              <input name="id" type="hidden" value={department.id} />
              <input
                name="name"
                defaultValue={department.name}
                required
                className="min-w-56 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="is_active"
                  defaultChecked={department.is_active}
                  className="h-4 w-4"
                />
                활성
              </label>
              <button
                type="submit"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                저장
              </button>
            </form>
          ))}
          {(departments?.length ?? 0) === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-600">
              등록된 소속부서가 없습니다.
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-lg font-semibold text-slate-900">모임 종류 관리</h3>
        <form action={createMeetingTypeAction} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            name="name"
            required
            placeholder="새 모임 종류 이름"
            className="min-w-56 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
          >
            모임 종류 추가
          </button>
        </form>
        {meetingTypeError ? (
          <p className="mt-3 text-sm text-rose-600">
            모임 종류 조회 오류: {meetingTypeError.message}
          </p>
        ) : null}
        <div className="mt-4 space-y-2">
          {((meetingTypes as MeetingTypeRow[] | null) ?? []).map((meetingType) => (
            <form
              key={meetingType.id}
              action={updateMeetingTypeAction}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3"
            >
              <input name="id" type="hidden" value={meetingType.id} />
              <input
                name="name"
                defaultValue={meetingType.name}
                required
                className="min-w-56 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="is_active"
                  defaultChecked={meetingType.is_active}
                  className="h-4 w-4"
                />
                활성
              </label>
              <button
                type="submit"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                저장
              </button>
            </form>
          ))}
          {(meetingTypes?.length ?? 0) === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-600">
              등록된 모임 종류가 없습니다.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
