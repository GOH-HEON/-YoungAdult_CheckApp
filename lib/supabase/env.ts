type SupabasePublicEnv = {
  url: string;
  anonKey: string;
};

type PublicEnvName = "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY";
type ServerEnvName = "SUPABASE_SERVICE_ROLE_KEY";

function readEnv(name: PublicEnvName | ServerEnvName) {
  return process.env[name]?.trim() ?? "";
}

export function hasSupabaseEnv() {
  return Boolean(readEnv("NEXT_PUBLIC_SUPABASE_URL") && readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
}

export function getSupabasePublicEnv(): SupabasePublicEnv {
  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!url || !anonKey) {
    throw new Error(
      "Supabase 환경변수가 누락되었습니다. NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정하세요.",
    );
  }

  return { url, anonKey };
}

export function hasSupabaseServiceRoleEnv() {
  return Boolean(readEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

export function getSupabaseServiceRoleKey() {
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY가 누락되었습니다. 서버 전용 환경변수에 설정해 주세요.",
    );
  }

  return serviceRoleKey;
}
