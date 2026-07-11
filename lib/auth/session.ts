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
  is_personal_notes_owner: boolean;
};

const APP_USER_COLUMNS_WITH_FLAG = "id, role, is_active, name, email, is_personal_notes_owner";
const APP_USER_COLUMNS_BASE = "id, role, is_active, name, email";

// is_personal_notes_owner 컬럼(마이그레이션 07)이 아직 없을 때만 쓰는 레거시 판정식.
// 컬럼이 생기면 이 폴백은 사용되지 않고 정확한 플래그 매칭으로 승격된다.
function legacyPersonalNotesOwner(name: unknown, email: unknown): boolean {
  const normalizedName = typeof name === "string" ? name.trim() : "";
  const localPart = (typeof email === "string" ? email.split("@")[0] : "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalizedName.includes("고헌") || localPart.includes("goheon") || localPart.includes("gohheon");
}

function normalizeAppUser(
  data: Record<string, unknown> | null,
  options: { ownerFromColumn: boolean },
): AppUserRow | null {
  if (!data) {
    return null;
  }

  const isOwner = options.ownerFromColumn
    ? Boolean(data.is_personal_notes_owner)
    : legacyPersonalNotesOwner(data.name, data.email);

  return {
    id: String(data.id),
    role: data.role as AppRole,
    is_active: Boolean(data.is_active),
    name: (data.name as string | null) ?? null,
    is_personal_notes_owner: isOwner,
  };
}

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

export function canAccessPersonalNotes(appUser: AppUserRow | null) {
  // 부분 문자열(name/email includes) 대신 전용 플래그로 정확히 판정한다.
  return Boolean(appUser?.is_active && appUser.is_personal_notes_owner);
}

type UsersReader = {
  from: (table: "users") => {
    select: (columns: string) => {
      eq: (
        column: "id",
        value: string,
      ) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
      };
    };
  };
};

// is_personal_notes_owner 컬럼(마이그레이션 07)이 아직 없을 수 있으므로, 컬럼 포함 조회 실패 시
// 기본 컬럼으로 폴백한다. 폴백 시에는 레거시 판정식으로 소유자를 유지해 접근 회귀를 막고,
// 컬럼이 존재하면 정확한 플래그 매칭으로 자동 승격된다.
async function readAppUserRow(client: UsersReader, userId: string): Promise<AppUserRow | null> {
  const withFlag = await client.from("users").select(APP_USER_COLUMNS_WITH_FLAG).eq("id", userId).maybeSingle();

  if (!withFlag.error) {
    return normalizeAppUser(withFlag.data, { ownerFromColumn: true });
  }

  const base = await client.from("users").select(APP_USER_COLUMNS_BASE).eq("id", userId).maybeSingle();

  if (base.error) {
    return null;
  }

  return normalizeAppUser(base.data, { ownerFromColumn: false });
}

async function readAppUser(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
) {
  return readAppUserRow(supabase as unknown as UsersReader, userId);
}

async function readAppUserByAdminClient(userId: string) {
  if (!hasSupabaseServiceRoleEnv()) {
    return null;
  }

  const adminSupabase = createSupabaseAdminClient();
  return readAppUserRow(adminSupabase as unknown as UsersReader, userId);
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

  if (!canAccessPersonalNotes(session.appUser)) {
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
