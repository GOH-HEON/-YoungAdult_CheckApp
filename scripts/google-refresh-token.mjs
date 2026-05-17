import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

function readEnv(name) {
  return process.env[name]?.trim() ?? "";
}

async function readJsonSource(value, label) {
  if (!value) {
    throw new Error(`${label} 값이 비어 있습니다.`);
  }

  if (value.startsWith("{") || value.startsWith("[")) {
    return JSON.parse(value);
  }

  if (existsSync(value)) {
    const content = await readFile(value, "utf8");
    return JSON.parse(content);
  }

  return JSON.parse(value);
}

function getAuthConfig(credentials) {
  const root = credentials.installed ?? credentials.web ?? credentials;
  const clientId = String(root.client_id ?? "").trim();
  const clientSecret = String(root.client_secret ?? "").trim();
  const tokenUri = String(root.token_uri ?? "https://oauth2.googleapis.com/token").trim();
  const authUri = String(root.auth_uri ?? "https://accounts.google.com/o/oauth2/auth").trim();
  const redirectUri = String(root.redirect_uris?.[0] ?? "").trim();

  if (!clientId || !clientSecret) {
    throw new Error("client_id/client_secret를 읽지 못했습니다.");
  }
  if (!redirectUri) {
    throw new Error("credentials의 redirect_uris[0]가 필요합니다.");
  }

  return { clientId, clientSecret, tokenUri, authUri, redirectUri };
}

function buildAuthUrl({ authUri, clientId, redirectUri }) {
  const url = new URL(authUri);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/calendar.readonly");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

async function exchangeCode({ tokenUri, clientId, clientSecret, redirectUri, code }) {
  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const reason = payload.error_description || payload.error || `HTTP ${response.status}`;
    throw new Error(`토큰 교환 실패: ${reason}`);
  }

  return payload;
}

async function main() {
  const credentialsSource = readEnv("GOOGLE_CALENDAR_CREDENTIALS");
  const credentials = await readJsonSource(credentialsSource, "GOOGLE_CALENDAR_CREDENTIALS");
  const config = getAuthConfig(credentials);
  const authCode = process.argv[2]?.trim() || "";

  if (!authCode) {
    console.log("1) 아래 URL로 접속해 Google 로그인/동의를 완료하세요.");
    console.log(buildAuthUrl(config));
    console.log("");
    console.log("2) redirect_uri로 돌아간 URL의 code 값을 복사해 아래처럼 실행하세요.");
    console.log("node scripts/google-refresh-token.mjs '<code>'");
    return;
  }

  const token = await exchangeCode({ ...config, code: authCode });
  const refreshToken = String(token.refresh_token ?? "").trim();
  if (!refreshToken) {
    throw new Error("refresh_token이 응답에 없습니다. prompt=consent로 다시 시도하세요.");
  }

  const output = {
    refresh_token: refreshToken,
    scope: token.scope ?? "https://www.googleapis.com/auth/calendar.readonly",
    token_type: token.token_type ?? "Bearer",
  };

  console.log(JSON.stringify(output));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
