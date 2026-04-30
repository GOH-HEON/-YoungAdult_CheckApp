"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/ui/icon";

const navItems = [
  { href: "/dashboard", label: "대시보드", icon: "dashboard", requiresWrite: false },
  { href: "/members", label: "형제/자매 명단", icon: "members", requiresWrite: false },
  { href: "/members/new", label: "명단 등록", icon: "newcomer", requiresWrite: true },
  { href: "/leaders", label: "임원모임 기록", icon: "events", requiresWrite: false },
  { href: "/attendance/check", label: "출석 체크", icon: "attendance", requiresWrite: true },
  { href: "/attendance/view", label: "출석 조회", icon: "view-attendance", requiresWrite: false },
  { href: "/attendance/print", label: "출석부 인쇄", icon: "reports", requiresWrite: false },
  { href: "/newcomers", label: "새가족", icon: "plus-user", requiresWrite: false },
  { href: "/reports", label: "리포트", icon: "reports", requiresWrite: false },
  { href: "/settings", label: "설정", icon: "settings", requiresWrite: true },
] as const;

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ canWrite }: { canWrite: boolean }) {
  const pathname = usePathname();
  const visibleNavItems = navItems.filter((item) => !item.requiresWrite || canWrite);

  return (
    <nav aria-label="관리자 메뉴" className="space-y-2">
      <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
        Workspace
      </div>
      <ul className="flex flex-col gap-1">
        {visibleNavItems.map((item) => {
          const active = isActivePath(pathname, item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={[
                  "group relative flex items-center gap-3 rounded-r-2xl px-4 py-3 text-sm font-medium transition-colors duration-200",
                  active
                    ? "bg-[#eff6ff] text-[#2563eb] shadow-[0_1px_0_rgba(37,99,235,0.08)] before:absolute before:inset-y-0 before:left-0 before:w-1 before:rounded-r-full before:bg-[#2563eb]"
                    : "mx-1 text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                ].join(" ")}
              >
                <span className={active ? "text-[#2563eb]" : "text-slate-400 group-hover:text-slate-600"}>
                  <Icon name={item.icon} className="h-5 w-5" filled={active && item.icon === "dashboard"} />
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
