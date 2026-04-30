import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseServiceRoleEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "viewer" | "staff";

export type AppUserRow = {
  id: string;
  role: AppRole;
  is_active: boolean;
  name: string | null;
};

export type SessionContext = {
  user: User;
  appUser: AppUserRow | null;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
};

function isReadableRole(role: string): role is AppRole {
  return role === "admin" || role === "viewer" || role === "staff";
}

export function canWriteByRole(role: string) {
  return role === "admin";
}

export function canReadByRole(role: string) {
  return isReadableRole(role);
}

export function canWrite(appUser: AppUserRow | null) {
  return Boolean(appUser && appUser.is_active && canWriteByRole(appUser.role));
}

async function readAppUser(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("users")
    .select("id, role, is_active, name")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return (data as AppUserRow | null) ?? null;
}

async function readAppUserByAdminClient(userId: string) {
  if (!hasSupabaseServiceRoleEnv()) {
    return null;
  }

  const adminSupabase = createSupabaseAdminClient();
  const { data } = await adminSupabase
    .from("users")
    .select("id, role, is_active, name")
    .eq("id", userId)
    .maybeSingle();

  return (data as AppUserRow | null) ?? null;
}

async function bootstrapFirstAdminUserIfNeeded(user: User) {
  if (!hasSupabaseServiceRoleEnv()) {
    return null;
  }

  const adminSupabase = createSupabaseAdminClient();
  const { count } = await adminSupabase
    .from("users")
    .select("id", { head: true, count: "exact" });

  if ((count ?? 0) > 0) {
    return readAppUserByAdminClient(user.id);
  }

  const { data } = await adminSupabase
    .from("users")
    .upsert(
      {
        id: user.id,
        email: user.email ?? "",
        name: (user.user_metadata?.name as string | undefined) ?? null,
        role: "admin",
        is_active: true,
      },
      { onConflict: "id" },
    )
    .select("id, role, is_active, name")
    .maybeSingle();

  return (data as AppUserRow | null) ?? null;
}

async function resolveAppUser(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  user: User,
) {
  const primary = await readAppUser(supabase, user.id);
  if (primary) {
    return primary;
  }

  const bootstrapped = await bootstrapFirstAdminUserIfNeeded(user);
  if (bootstrapped) {
    return bootstrapped;
  }

  return readAppUserByAdminClient(user.id);
}

export async function requireSession(): Promise<SessionContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const appUser = await resolveAppUser(supabase, user);

  if (!appUser) {
    await supabase.auth.signOut();
    redirect("/login?error=사용자 계정 매핑이 필요합니다. 관리자에게 문의해 주세요.");
  }

  if (!appUser.is_active || !canReadByRole(appUser.role)) {
    await supabase.auth.signOut();
    redirect("/login?error=권한이 없는 계정입니다.");
  }

  return { user, appUser, supabase };
}

export async function requireAdminSession(): Promise<SessionContext> {
  const session = await requireSession();

  if (!canWrite(session.appUser)) {
    redirect("/dashboard?level=error&message=읽기 전용 계정은 수정할 수 없습니다.");
  }

  return session;
}

export async function getRouteHandlerSession() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, appUser: null };
  }

  const appUser = await resolveAppUser(supabase, user);

  if (!appUser) {
    return { supabase, user: null, appUser: null };
  }

  if (!appUser.is_active || !canReadByRole(appUser.role)) {
    return { supabase, user: null, appUser };
  }

  return { supabase, user, appUser };
}
