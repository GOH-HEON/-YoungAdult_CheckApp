import Link from "next/link";
import { signInAction } from "@/app/login/actions";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { sanitizeRedirectPath } from "@/lib/utils/format";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeRedirectPath(params.next, "/dashboard");
  const hasEnv = hasSupabaseEnv();

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">관리자 로그인</h1>
        <p className="mt-2 text-sm text-slate-600">
          Supabase Auth 계정으로 로그인한 뒤 관리자 화면에 접근할 수 있습니다.
        </p>
        {!hasEnv ? (
          <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            환경변수(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)를 먼저 설정해 주세요.
          </p>
        ) : null}
        {params.error ? (
          <p className="mt-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {params.error}
          </p>
        ) : null}

        <form action={signInAction} className="mt-6 space-y-4">
          <input name="next" type="hidden" value={nextPath} />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
              이메일
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="admin@example.com"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
              비밀번호
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="********"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
            />
          </div>
          <button
            type="submit"
            disabled={!hasEnv}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            로그인
          </button>
        </form>

        <Link
          href="/dashboard"
          className="mt-4 inline-flex items-center text-sm font-medium text-blue-700 hover:underline"
        >
          로그인 상태라면 대시보드로 이동
        </Link>
      </section>
    </main>
  );
}
