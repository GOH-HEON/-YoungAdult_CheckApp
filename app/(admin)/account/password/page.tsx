import Link from "next/link";

import { updateCurrentPasswordAction } from "@/app/(admin)/account/password/actions";
import { requireSession } from "@/lib/auth/session";

type PasswordPageProps = {
  searchParams: Promise<{
    level?: "ok" | "error";
    message?: string;
  }>;
};

export default async function PasswordPage({ searchParams }: PasswordPageProps) {
  const params = await searchParams;
  const { user } = await requireSession();

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <div>
        <p className="text-sm font-semibold text-[#2563eb]">계정 관리</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">비밀번호 변경</h2>
        <p className="mt-2 text-sm text-slate-500">{user.email} 계정의 로그인 비밀번호를 변경합니다.</p>
      </div>

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

      <form action={updateCurrentPasswordAction} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-slate-700">새 비밀번호</span>
          <input
            name="password"
            type="password"
            minLength={6}
            required
            autoComplete="new-password"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-slate-700">새 비밀번호 확인</span>
          <input
            name="confirmPassword"
            type="password"
            minLength={6}
            required
            autoComplete="new-password"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
          />
        </label>

        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
          비밀번호는 6자 이상이며 영문자와 특수문자를 포함해야 합니다.
        </p>

        <div className="flex items-center justify-end gap-2">
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            취소
          </Link>
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98]"
          >
            변경 저장
          </button>
        </div>
      </form>
    </div>
  );
}
