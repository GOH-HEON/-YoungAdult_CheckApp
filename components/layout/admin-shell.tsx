import { AdminNav } from "@/components/layout/admin-nav";
import { signOutAction } from "@/lib/auth/actions";

export function AdminShell({
  children,
  userDisplayName,
  userEmail,
}: {
  children: React.ReactNode;
  userDisplayName: string;
  userEmail: string;
}) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1800px] flex-col gap-4 px-4 py-6 sm:px-6 xl:px-10">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">청년부 출석 관리</h1>
          <p className="mt-1 text-sm text-slate-600">
            {userDisplayName}
            {userEmail ? ` (${userEmail})` : ""} 님으로 로그인됨
          </p>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            로그아웃
          </button>
        </form>
      </header>
      <div className="grid flex-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <AdminNav />
        </aside>
        <main className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {children}
        </main>
      </div>
    </div>
  );
}
