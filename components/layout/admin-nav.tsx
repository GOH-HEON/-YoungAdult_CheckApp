"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/ui/icon";

type NavChild = {
  href: string;
  label: string;
  icon: "members" | "newcomer" | "plus-user" | "attendance" | "view-attendance";
  requiresWrite?: boolean;
};

type NavEntry = {
  href?: string;
  label: string;
  icon: "dashboard" | "events" | "members" | "attendance" | "reports" | "settings";
  requiresWrite?: boolean;
  children?: NavChild[];
};

const navEntries: NavEntry[] = [
  { href: "/dashboard", label: "대시보드", icon: "dashboard" },
  { href: "/calendar", label: "교회일정", icon: "events" },
  {
    label: "인원관리",
    icon: "members",
    children: [
      { href: "/members", label: "형제/자매 명단", icon: "members" },
      { href: "/members/new", label: "명단 등록", icon: "newcomer", requiresWrite: true },
      { href: "/newcomers", label: "새 가족", icon: "plus-user" },
    ],
  },
  {
    label: "출석관리",
    icon: "attendance",
    children: [
      { href: "/attendance/check", label: "출석체크", icon: "attendance", requiresWrite: true },
      { href: "/attendance/view", label: "출석조회", icon: "view-attendance" },
    ],
  },
  { href: "/reports", label: "리포트", icon: "reports" },
  { href: "/settings", label: "설정", icon: "settings", requiresWrite: true },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getVisibleChildren(children: NavChild[] | undefined, canWrite: boolean) {
  return (children ?? []).filter((child) => !child.requiresWrite || canWrite);
}

export function AdminNav({ canWrite }: { canWrite: boolean }) {
  const pathname = usePathname();
  const visibleEntries = navEntries.filter((entry) => !entry.requiresWrite || canWrite);

  return (
    <nav aria-label="관리자 메뉴" className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
      {visibleEntries.map((entry) => {
        const children = getVisibleChildren(entry.children, canWrite);
        const active = entry.href
          ? isActivePath(pathname, entry.href)
          : children.some((child) => isActivePath(pathname, child.href));

        if (children.length > 0) {
          return (
            <div key={entry.label} className="group relative shrink-0 py-2">
              <button
                type="button"
                className={[
                  "inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition",
                  active
                    ? "bg-[#2563eb] text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                ].join(" ")}
              >
                <Icon name={entry.icon} className="h-4 w-4" filled={active && entry.icon === "dashboard"} />
                {entry.label}
                <span className="text-xs leading-none opacity-70">▾</span>
              </button>

              <div className="invisible absolute left-0 top-full z-40 min-w-56 rounded-xl border border-slate-200 bg-white p-2 opacity-0 shadow-[0_18px_45px_-18px_rgba(15,23,42,0.35)] transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                {children.map((child) => {
                  const childActive = isActivePath(pathname, child.href);

                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={[
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                        childActive
                          ? "bg-[#eff6ff] text-[#2563eb]"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                      ].join(" ")}
                    >
                      <Icon name={child.icon} className="h-4 w-4" filled={childActive && child.icon === "attendance"} />
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        }

        if (!entry.href) {
          return null;
        }

        return (
          <Link
            key={entry.href}
            href={entry.href}
            className={[
              "inline-flex h-11 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition",
              active ? "bg-[#2563eb] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
            ].join(" ")}
          >
            <Icon name={entry.icon} className="h-4 w-4" filled={active && entry.icon === "dashboard"} />
            {entry.label}
          </Link>
        );
      })}
    </nav>
  );
}
