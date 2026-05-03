import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseServiceRoleEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "viewer" | "staff" | "chairboard";

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
  return role === "admin" || role === "viewer" || role === "staff" || role === "chairboard";
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

export function canAccessChairboardByRole(role: string) {
  return role === "admin" || role === "chairboard";
}

export function canAccessChairboard(appUser: AppUserRow | null) {
  return Boolean(appUser && appUser.is_active && canAccessChairboardByRole(appUser.role));
}

function getNormalizedEmailLocalPart(email: string | null | undefined) {
  return (email?.split("@")[0] ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function canAccessPersonalNotes(appUser: AppUserRow | null, email: string | null | undefined) {
  if (!appUser?.is_active) {
    return false;
  }

  const name = appUser.name?.trim() ?? "";
  const emailLocalPart = getNormalizedEmailLocalPart(email);

  return name.includes("고헌") || emailLocalPart.includes("goheon") || emailLocalPart.includes("gohheon");
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

async function resolveAppUser(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  user: User,
) {
  const primary = await readAppUser(supabase, user.id);
  if (primary) {
    return primary;
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

export async function requireChairboardSession(): Promise<SessionContext> {
  const session = await requireSession();

  if (!canAccessChairboard(session.appUser)) {
    redirect("/dashboard?level=error&message=회장단 전용 페이지입니다.");
  }

  return session;
}

export async function requirePersonalNotesSession(): Promise<SessionContext> {
  const session = await requireSession();

  if (!canAccessPersonalNotes(session.appUser, session.user.email)) {
    redirect("/dashboard?level=error&message=개인 메모 전용 페이지입니다.");
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

export function createPageReadClient(
  appUser: AppUserRow | null,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  if (canWrite(appUser) || !hasSupabaseServiceRoleEnv()) {
    return supabase;
  }

  // Keep any privileged readonly access explicit at the page level only.
  // Route handlers and server actions must continue using the session client.
  return createSupabaseAdminClient();
}
