"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/members", label: "형제/자매 명단" },
  { href: "/members/new", label: "명단 등록" },
  { href: "/attendance/check", label: "출석 체크" },
  { href: "/attendance/view", label: "출석 조회" },
  { href: "/attendance/print", label: "출석부 인쇄" },
  { href: "/newcomers", label: "새가족" },
  { href: "/reports", label: "리포트" },
  { href: "/settings", label: "설정" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav>
      <ul className="flex flex-col gap-2">
        {navItems.map((item) => {
          const active = isActivePath(pathname, item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={[
                  "inline-flex w-full rounded-lg px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                ].join(" ")}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
