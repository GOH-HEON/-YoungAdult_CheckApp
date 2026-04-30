import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const ACCOUNTS_FILE = resolve(ROOT, "private-login-accounts.md");
const ENV_FILE = resolve(ROOT, ".env.local");

function loadEnvFile(content) {
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }

    const eqIndex = line.indexOf("=");
    const key = line.slice(0, eqIndex).trim();
    const value = line.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, "");

    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function ensureEnv() {
  try {
    const envContent = await readFile(ENV_FILE, "utf8");
    loadEnvFile(envContent);
  } catch {
    // Ignore if .env.local is absent or unreadable.
  }
}

function parseAccounts(markdown) {
  const accounts = [];
  let currentGroup = "";

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();

    const groupMatch = line.match(/^##\s+(.+)$/);
    if (groupMatch) {
      currentGroup = groupMatch[1].trim();
      continue;
    }

    const emailMatch = line.match(/^\d+\.\s+([^\s@]+@[^\s@]+)$/);
    if (emailMatch && currentGroup) {
      accounts.push({
        group: currentGroup,
        email: emailMatch[1],
      });
    }
  }

  return accounts;
}

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} 환경변수가 필요합니다.`);
  }
  return value;
}

function deriveDisplayName(group, index) {
  return `${group} ${index}`;
}

async function main() {
  await ensureEnv();

  const url = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const initialPassword = getRequiredEnv("LOGIN_INITIAL_PASSWORD");
  const dryRun = ["1", "true", "yes"].includes((process.env.DRY_RUN ?? "").toLowerCase());

  const markdown = await readFile(ACCOUNTS_FILE, "utf8");
  const accounts = parseAccounts(markdown);

  if (accounts.length !== 23) {
    throw new Error(`계정 수가 23개가 아닙니다. 현재 ${accounts.length}개입니다.`);
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listError) {
    throw new Error(`기존 사용자 조회 실패: ${listError.message}`);
  }

  const usersByEmail = new Map((existingUsers?.users ?? []).map((user) => [user.email ?? "", user]));
  const results = [];

  for (const [index, account] of accounts.entries()) {
    const displayName = deriveDisplayName(account.group, index + 1);
    const existingUser = usersByEmail.get(account.email);

    if (dryRun) {
      results.push({
        email: account.email,
        action: existingUser ? "update" : "create",
        group: account.group,
      });
      continue;
    }

    let userId = existingUser?.id;

    if (existingUser) {
      const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, {
        password: initialPassword,
        email_confirm: true,
        user_metadata: {
          name: displayName,
          group: account.group,
          login_mode: "email-password",
        },
      });

      if (error) {
        throw new Error(`사용자 갱신 실패 (${account.email}): ${error.message}`);
      }

      userId = data.user.id;
      results.push({
        email: account.email,
        action: "updated",
        group: account.group,
      });
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: account.email,
        password: initialPassword,
        email_confirm: true,
        user_metadata: {
          name: displayName,
          group: account.group,
          login_mode: "email-password",
        },
      });

      if (error || !data.user) {
        throw new Error(`사용자 생성 실패 (${account.email}): ${error?.message ?? "알 수 없는 오류"}`);
      }

      userId = data.user.id;
      results.push({
        email: account.email,
        action: "created",
        group: account.group,
      });
    }

    const { error: profileError } = await supabase.from("users").upsert(
      {
        id: userId,
        email: account.email,
        name: displayName,
        role: "staff",
        is_active: true,
      },
      { onConflict: "id" },
    );

    if (profileError) {
      throw new Error(`public.users 저장 실패 (${account.email}): ${profileError.message}`);
    }
  }

  if (dryRun) {
    console.log(JSON.stringify(results, null, 2));
    console.log("DRY_RUN=true 이므로 실제 변경은 하지 않았습니다.");
    return;
  }

  console.log(`완료: ${results.length}개 계정을 생성/갱신했습니다.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
