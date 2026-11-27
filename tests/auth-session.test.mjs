import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { compileFunction } from "node:vm";
import { createServerClient, createChunks } from "@supabase/ssr";
import { NextRequest } from "next/server.js";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const storageKey = "sb-login-test-auth-token";
const preferenceKey = "youngadult-remember-login";
const thirtyDays = 30 * 24 * 60 * 60;

// Compile the app's TypeScript with its installed compiler; only external I/O
// is replaced. Cookie serialization and Supabase Auth remain real SDK code.
function createLoader(stubs) {
  const cache = new Map();
  function load(relativePath) {
    const filename = path.resolve(root, relativePath);
    if (cache.has(filename)) return cache.get(filename).exports;
    const compiledModule = { exports: {} };
    cache.set(filename, compiledModule);
    const require = createRequire(filename);
    const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    });
    compileFunction(outputText, ["require", "module", "exports"], { filename })(
      (specifier) => {
        if (Object.hasOwn(stubs, specifier)) return stubs[specifier];
        if (specifier.startsWith("@/")) return load(`${specifier.slice(2)}.ts`);
        return require(specifier);
      },
      compiledModule,
      compiledModule.exports,
    );
    return compiledModule.exports;
  }
  return load;
}

function cookieStore(initial = []) {
  const values = new Map(initial.map((cookie) => [cookie.name, { ...cookie }]));
  const writes = [];
  return {
    writes,
    get: (name) => values.get(name),
    getAll: () => [...values.values()],
    set(nameOrCookie, value, options) {
      const cookie = typeof nameOrCookie === "string"
        ? { name: nameOrCookie, value, ...options }
        : { ...nameOrCookie };
      values.set(cookie.name, cookie);
      writes.push(cookie);
    },
  };
}

function makeToken(expiresAt) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "00000000-0000-4000-8000-000000000001", exp: expiresAt, role: "authenticated" })}.test-signature`;
}

function harness({ remembered, expired = false, initialSession = false, padding = 0, failPassword = false, failRefresh = false, failLogout = false, active = true } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "auth-test@example.invalid",
    app_metadata: {},
    user_metadata: { padding: "x".repeat(padding) },
    created_at: "2026-01-01T00:00:00Z",
  };
  const session = {
    access_token: makeToken(now + 3600),
    refresh_token: "test-new-refresh-token",
    expires_in: 3600,
    token_type: "bearer",
    user,
  };
  const profile = { id: user.id, name: "테스트", email: user.email, role: "admin", is_active: active, is_personal_notes_owner: false };
  const calls = [];
  const fetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    calls.push({ path: url.pathname, grant: url.searchParams.get("grant_type"), scope: url.searchParams.get("scope") });
    if (url.pathname === "/auth/v1/token") {
      if ((url.searchParams.get("grant_type") === "password" && failPassword) ||
          (url.searchParams.get("grant_type") === "refresh_token" && failRefresh)) {
        return Response.json({ msg: "Invalid test credentials", error_code: failRefresh ? "refresh_token_not_found" : "invalid_credentials" }, { status: 400 });
      }
      return Response.json(session);
    }
    if (url.pathname === "/auth/v1/user") return Response.json(user);
    if (url.pathname === "/auth/v1/logout") {
      if (failLogout) return Response.json({ msg: "Test auth service unavailable" }, { status: 500 });
      return new Response(null, { status: 204 });
    }
    if (url.pathname === "/rest/v1/users") return Response.json(profile);
    throw new Error(`Unexpected test network request: ${url.pathname}`);
  };
  const initial = [];
  if (initialSession) {
    const saved = {
      ...session,
      access_token: makeToken(expired ? now - 60 : now + 3600),
      refresh_token: "test-old-refresh-token",
      expires_at: expired ? now - 60 : now + 3600,
    };
    initial.push(...createChunks(storageKey, `base64-${Buffer.from(JSON.stringify(saved)).toString("base64url")}`));
  }
  if (remembered !== undefined) initial.push({ name: preferenceKey, value: remembered ? "1" : "0" });
  const store = cookieStore(initial);
  const redirect = (url) => { throw Object.assign(new Error("Test redirect"), { redirectUrl: url }); };
  const load = createLoader({
    "server-only": {},
    "next/headers": { cookies: async () => store, headers: async () => new Headers() },
    "next/navigation": { redirect },
    "@supabase/ssr": {
      createServerClient: (url, key, options) => createServerClient(url, key, { ...options, global: { fetch } }),
    },
    "@/lib/supabase/env": {
      getSupabasePublicEnv: () => ({ url: "https://login-test.supabase.co", anonKey: "test-public-key" }),
      hasSupabaseEnv: () => true,
      hasSupabaseServiceRoleEnv: () => false,
    },
    "@/lib/supabase/admin": {
      createSupabaseAdminClient: () => ({
        from: () => ({
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }),
          insert: async () => ({ error: null }),
        }),
      }),
    },
  });
  const request = (pathname = "/attendance/print") => new NextRequest(`https://app.example.invalid${pathname}`, {
    headers: { cookie: initial.map(({ name, value }) => `${name}=${value}`).join("; ") },
  });
  return { load, store, calls, request, user };
}

async function signIn(app, rememberLogin) {
  const data = new FormData();
  data.set("email", "auth-test@example.invalid");
  data.set("password", "test-password-not-a-real-credential");
  data.set("next", "/attendance/print");
  if (rememberLogin) data.set("rememberLogin", "on");
  await assert.rejects(app.load("app/login/actions.ts").signInAction(data),
    (error) => error.redirectUrl === "/attendance/print");
}

function liveAuthCookies(cookies) {
  return cookies.filter(({ name, value, maxAge }) => name.startsWith(storageKey) && value && maxAge !== 0);
}

test("unchecked login uses session cookies, even after a previous remembered login", async () => {
  const app = harness({ remembered: true });
  await signIn(app, false);
  const authCookies = liveAuthCookies(app.store.writes);
  assert.ok(authCookies.length > 0);
  for (const cookie of authCookies) {
    assert.equal(cookie.maxAge, undefined);
    assert.equal(cookie.expires, undefined);
  }
  assert.equal(app.store.get(preferenceKey).value, "0");
  assert.equal(app.store.get(preferenceKey).maxAge, undefined);
});

test("remembered login stores all chunks and the HttpOnly preference for 30 days", async () => {
  const app = harness({ padding: 9000 });
  await signIn(app, true);
  const authCookies = liveAuthCookies(app.store.writes);
  assert.ok(authCookies.length > 1);
  for (const cookie of authCookies) assert.equal(cookie.maxAge, thirtyDays);
  const preference = app.store.get(preferenceKey);
  assert.equal(preference.value, "1");
  assert.equal(preference.maxAge, thirtyDays);
  assert.equal(preference.httpOnly, true);
  assert.ok(app.store.writes.every(({ value }) => !value.includes("test-password-not-a-real-credential")));
});

test("failed login does not write a remembered preference or authentication cookies", async () => {
  const app = harness({ failPassword: true });
  const data = new FormData();
  data.set("email", "auth-test@example.invalid");
  data.set("password", "invalid-test-password");
  data.set("rememberLogin", "on");
  await assert.rejects(app.load("app/login/actions.ts").signInAction(data),
    (error) => error.redirectUrl.startsWith("/login?error="));
  assert.equal(app.store.writes.length, 0);
});

test("server client renews an expired remembered session with the saved policy", async () => {
  const app = harness({ remembered: true, initialSession: true, expired: true });
  const supabase = await app.load("lib/supabase/server.ts").createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  assert.equal(error, null);
  assert.equal(data.user.id, app.user.id);
  assert.ok(app.calls.some(({ grant }) => grant === "refresh_token"));
  assert.ok(liveAuthCookies(app.store.writes).every(({ maxAge }) => maxAge === thirtyDays));
  assert.equal(app.store.get(preferenceKey).maxAge, thirtyDays);
});

test("proxy returns the refreshed response with every chunk and cache prevention headers", async () => {
  const app = harness({ remembered: true, initialSession: true, expired: true, padding: 9000 });
  const request = app.request();
  const response = await app.load("proxy.ts").proxy(request);
  const authCookies = liveAuthCookies(response.cookies.getAll());
  assert.ok(authCookies.length > 1);
  for (const cookie of authCookies) {
    assert.equal(cookie.maxAge, thirtyDays);
    assert.equal(request.cookies.get(cookie.name).value, cookie.value);
  }
  assert.equal(response.cookies.get(preferenceKey).maxAge, thirtyDays);
  assert.match(response.headers.get("cache-control"), /private.*no-store/);
  assert.equal(response.headers.get("expires"), "0");
  assert.equal(response.headers.get("pragma"), "no-cache");
  assert.ok(response.headers.get("x-middleware-request-cookie"));
});

test("redirect from login preserves refreshed chunks and cache prevention headers", async () => {
  const app = harness({ remembered: true, initialSession: true, expired: true, padding: 9000 });
  const response = await app.load("proxy.ts").proxy(app.request("/login"));
  assert.equal(response.headers.get("location"), "https://app.example.invalid/dashboard");
  assert.ok(liveAuthCookies(response.cookies.getAll()).length > 1);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal(response.headers.get("pragma"), "no-cache");
  assert.equal(response.cookies.get(preferenceKey).maxAge, thirtyDays);
});

test("refresh without opting in never adds persistent auth cookies", async () => {
  const app = harness({ initialSession: true, expired: true });
  const response = await app.load("proxy.ts").proxy(app.request());
  const authCookies = liveAuthCookies(response.cookies.getAll());
  assert.ok(authCookies.length > 0);
  for (const cookie of authCookies) {
    assert.equal(cookie.maxAge, undefined);
    assert.equal(cookie.expires, undefined);
  }
  assert.equal(response.cookies.get(preferenceKey).value, "0");
});

test("invalid refresh redirects to login and still sends cookie deletions", async () => {
  const app = harness({ remembered: true, initialSession: true, expired: true, failRefresh: true });
  const response = await app.load("proxy.ts").proxy(app.request());
  assert.equal(response.headers.get("location"), "https://app.example.invalid/login?next=%2Fattendance%2Fprint");
  assert.equal(response.cookies.get(storageKey).maxAge, 0);
  assert.match(response.headers.get("cache-control"), /no-store/);
});

test("logout revokes the existing global session and deletes auth chunks and preference", async () => {
  const app = harness({ remembered: true, initialSession: true, padding: 9000 });
  await assert.rejects(app.load("lib/auth/actions.ts").signOutAction(),
    (error) => error.redirectUrl === "/login");
  assert.ok(app.calls.some(({ path, scope }) => path === "/auth/v1/logout" && scope === "global"));
  const deletions = app.store.writes.filter(({ name }) => name.startsWith(storageKey));
  assert.ok(deletions.length > 1);
  assert.ok(deletions.every(({ maxAge }) => maxAge === 0));
  assert.equal(app.store.get(preferenceKey).maxAge, 0);
});

test("logout clears this browser even when remote revocation fails", async (context) => {
  const app = harness({ remembered: true, initialSession: true, padding: 9000, failLogout: true });
  const errorLog = context.mock.method(console, "error", () => {});
  await assert.rejects(app.load("lib/auth/actions.ts").signOutAction(),
    (error) => error.redirectUrl === "/login");
  assert.ok(errorLog.mock.callCount() > 0);
  const remaining = app.store.getAll().filter(({ name, value, maxAge }) =>
    (name.startsWith(storageKey) || name === preferenceKey) && value && maxAge !== 0);
  assert.equal(remaining.length, 0);
});

test("remembered authentication does not bypass the inactive-account check", async () => {
  const app = harness({ remembered: true, initialSession: true, active: false });
  await assert.rejects(app.load("lib/auth/session.ts").requireSession(),
    (error) => error.redirectUrl.startsWith("/login?error="));
  assert.ok(app.calls.some(({ path }) => path === "/auth/v1/user"));
  assert.ok(app.calls.some(({ path }) => path === "/rest/v1/users"));
  assert.ok(app.calls.some(({ path }) => path === "/auth/v1/logout"));
});

test("production cookies use Secure and deletion never becomes a persistent login", () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const { getSessionCookieOptions, getRememberLoginCookie } = harness().load("lib/auth/session-cookies.ts");
    assert.equal(getSessionCookieOptions({ path: "/" }, true).secure, true);
    assert.equal(getRememberLoginCookie(true).secure, true);
    assert.equal(getSessionCookieOptions({ maxAge: 0 }, true).maxAge, 0);
    assert.equal(getSessionCookieOptions({ maxAge: 0 }, false).maxAge, 0);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
