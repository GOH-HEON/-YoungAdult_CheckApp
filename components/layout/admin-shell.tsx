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
}: {
  children: React.ReactNode;
  userDisplayName: string;
  userEmail: string;
  canWrite: boolean;
}) {
  const initials = getInitials(userDisplayName);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-[0_1px_0_rgba(15,23,42,0.02)] backdrop-blur-xl sm:px-6 xl:px-8">
        <div className="mx-auto flex w-full max-w-[1920px] flex-col gap-3 xl:flex-row xl:items-center">
          <div className="flex shrink-0 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 via-blue-900 to-cyan-700 text-xs font-bold text-white shadow-[0_10px_25px_-10px_rgba(15,23,42,0.5)]">
                YH
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-[#2563eb]">YouthHub</h1>
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">Church Management</p>
              </div>
            </div>

            <div className="flex items-center gap-2 xl:hidden">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
                {initials}
              </div>
              <Link
                href="/account/password"
                className="rounded-lg px-2 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                비밀번호
              </Link>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 active:scale-[0.98]"
                  aria-label="로그아웃"
                >
                  <Icon name="logout" className="h-5 w-5" />
                </button>
              </form>
            </div>
          </div>

          <AdminNav canWrite={canWrite} />

          <div className="hidden shrink-0 items-center gap-3 xl:flex">
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900">{userDisplayName}</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                {userEmail ? userEmail : "ADMIN"}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-slate-800 text-xs font-bold text-white shadow-sm">
              {initials}
            </div>
            <div className="flex flex-col items-stretch gap-1">
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 active:scale-[0.98]"
                >
                  <Icon name="logout" className="h-5 w-5" />
                  Log Out
                </button>
              </form>
              <Link
                href="/account/password"
                className="rounded-lg px-3 py-1.5 text-center text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                비밀번호 변경
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1920px] px-4 py-6 sm:px-6 xl:px-8">{children}</main>
    </div>
  );
}
