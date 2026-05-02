import Link from "next/link";

import { AdminNav } from "@/components/layout/admin-nav";
import { Icon } from "@/components/ui/icon";
import { signOutAction } from "@/lib/auth/actions";

function getInitials(name: string) {
  const compact = name.trim().replace(/\s+/g, " ");
  if (!compact) return "A";

  const parts = compact.split(" ");
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  return compact.slice(0, 2).toUpperCase();
}

export function AdminShell({
  children,
  userDisplayName,
  userEmail,
  canWrite,
  canAccessChairboard,
}: {
  children: React.ReactNode;
  userDisplayName: string;
  userEmail: string;
  canWrite: boolean;
  canAccessChairboard: boolean;
}) {
  const initials = getInitials(userDisplayName);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col lg:flex-row">
        <aside className="border-b border-slate-200 bg-white/95 px-4 py-6 backdrop-blur-xl lg:sticky lg:top-0 lg:h-screen lg:w-[300px] lg:flex-none lg:border-b-0 lg:border-r lg:px-6">
          <div className="mb-8 flex items-center gap-3 px-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 via-blue-900 to-cyan-700 text-sm font-bold text-white shadow-[0_10px_25px_-8px_rgba(15,23,42,0.45)]">
              YH
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-[#2563eb]">YouthHub</h1>
              <p className="text-xs font-medium text-slate-500">Church Management</p>
            </div>
          </div>

          <AdminNav canWrite={canWrite} canAccessChairboard={canAccessChairboard} />

          <div className="mt-10 space-y-4">
            {canWrite ? (
              <Link
                href="/attendance/check"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2563eb] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_25px_-10px_rgba(37,99,235,0.7)] transition hover:bg-[#1d4ed8] active:scale-[0.99]"
              >
                <Icon name="quick-attendance" className="h-5 w-5" filled />
                Quick Attendance
              </Link>
            ) : null}

            <div className="space-y-1 px-2">
              <a
                href="#"
                className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
              >
                <Icon name="help" className="h-5 w-5" />
                Support
              </a>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-sm text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <Icon name="logout" className="h-5 w-5" />
                  Log Out
                </button>
              </form>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 px-4 py-4 shadow-[0_1px_0_rgba(15,23,42,0.02)] backdrop-blur-xl sm:px-6 xl:px-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <label className="relative w-full max-w-[520px]">
                <Icon
                  name="search"
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  placeholder="멤버, 행사, 리포트를 검색..."
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-11 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#2563eb] focus:bg-white focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                />
              </label>

              <div className="flex items-center justify-between gap-4 xl:justify-end">
                <div className="flex items-center gap-1 text-slate-500">
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-slate-100 hover:text-slate-900"
                    aria-label="알림"
                  >
                    <Icon name="notifications" className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-slate-100 hover:text-slate-900"
                    aria-label="도움말"
                  >
                    <Icon name="help" className="h-5 w-5" />
                  </button>
                </div>

                <div className="hidden h-8 w-px bg-slate-200 xl:block" />

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{userDisplayName}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                      {userEmail ? userEmail : "ADMIN"}
                    </p>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-slate-800 text-xs font-bold text-white shadow-sm">
                    {initials}
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-8 sm:px-6 xl:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
