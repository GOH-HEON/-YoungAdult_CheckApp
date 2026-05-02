import "server-only";

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

type JsonObject = Record<string, unknown>;

export type GoogleCalendarConfig = {
  calendarId: string;
  timeZone: string;
  clientId: string;
  clientSecret: string;
  tokenUri: string;
  refreshToken: string;
};

export type GoogleCalendarSummary = {
  id: string;
  summary: string;
  description: string | null;
  timeZone: string | null;
  accessRole: string | null;
  primary: boolean;
};

export type GoogleCalendarEvent = {
  id: string;
  htmlLink: string | null;
  summary: string;
  description: string | null;
  location: string | null;
  status: string | null;
  eventType: string | null;
  start: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  end: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
};

export type GoogleCalendarEventsResult = {
  summary: GoogleCalendarSummary | null;
  events: GoogleCalendarEvent[];
};

function readEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

async function readJsonSource(value: string, label: string) {
  if (!value) {
    throw new Error(`${label} 값이 비어 있습니다.`);
  }

  if (value.startsWith("{") || value.startsWith("[")) {
    return JSON.parse(value) as JsonObject;
  }

  if (existsSync(value)) {
    const content = await readFile(value, "utf8");
    return JSON.parse(content) as JsonObject;
  }

  return JSON.parse(value) as JsonObject;
}

function getRequiredEnv(name: string) {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`${name} 환경변수가 필요합니다.`);
  }

  return value;
}

export async function getGoogleCalendarConfig(): Promise<GoogleCalendarConfig> {
  const calendarId = getRequiredEnv("GOOGLE_CALENDAR_ID");
  const timeZone = readEnv("GOOGLE_CALENDAR_TIMEZONE") || "Asia/Seoul";
  const credentialsSource = readEnv("GOOGLE_CALENDAR_CREDENTIALS");
  const tokenSource = readEnv("GOOGLE_CALENDAR_TOKEN");

  if (!credentialsSource) {
    throw new Error("GOOGLE_CALENDAR_CREDENTIALS 환경변수가 필요합니다.");
  }

  if (!tokenSource) {
    throw new Error("GOOGLE_CALENDAR_TOKEN 환경변수가 필요합니다.");
  }

  const credentials = await readJsonSource(credentialsSource, "GOOGLE_CALENDAR_CREDENTIALS");
  const token = await readJsonSource(tokenSource, "GOOGLE_CALENDAR_TOKEN");

  const installed = (credentials.installed ?? credentials.web ?? credentials) as JsonObject;
  const clientId = String(installed.client_id ?? "").trim();
  const clientSecret = String(installed.client_secret ?? "").trim();
  const tokenUri = String(installed.token_uri ?? "https://oauth2.googleapis.com/token").trim();
  const refreshToken = String(token.refresh_token ?? "").trim();

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth client_id/client_secret를 읽지 못했습니다.");
  }

  if (!refreshToken) {
    throw new Error("Google refresh_token을 찾지 못했습니다.");
  }

  return {
    calendarId,
    timeZone,
    clientId,
    clientSecret,
    tokenUri,
    refreshToken,
  };
}

async function fetchGoogleAccessToken(config: GoogleCalendarConfig) {
  const response = await fetch(config.tokenUri, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  const payload = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    const reason = payload.error_description || payload.error || `HTTP ${response.status}`;
    throw new Error(`Google access token 발급 실패: ${reason}`);
  }

  return payload.access_token;
}

async function googleCalendarFetch<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const payload = (await response.json()) as T & {
    error?: {
      message?: string;
      status?: string;
      code?: number;
    };
  };

  if (!response.ok) {
    const message = payload.error?.message || `HTTP ${response.status}`;
    throw new Error(`Google Calendar API 호출 실패: ${message}`);
  }

  return payload;
}

export async function loadGoogleCalendarEvents(options?: {
  daysBack?: number;
  daysAhead?: number;
  maxResults?: number;
}) {
  const config = await getGoogleCalendarConfig();
  const accessToken = await fetchGoogleAccessToken(config);

  const daysBack = options?.daysBack ?? 7;
  const daysAhead = options?.daysAhead ?? 60;
  const maxResults = options?.maxResults ?? 100;

  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setDate(timeMin.getDate() - daysBack);
  const timeMax = new Date(now);
  timeMax.setDate(timeMax.getDate() + daysAhead);

  const summaryUrl = new URL(
    `https://www.googleapis.com/calendar/v3/users/me/calendarList/${encodeURIComponent(config.calendarId)}`,
  );
  const eventsUrl = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events`,
  );

  eventsUrl.searchParams.set("singleEvents", "true");
  eventsUrl.searchParams.set("orderBy", "startTime");
  eventsUrl.searchParams.set("maxResults", String(maxResults));
  eventsUrl.searchParams.set("timeMin", timeMin.toISOString());
  eventsUrl.searchParams.set("timeMax", timeMax.toISOString());

  const [summaryResponse, eventsResponse] = await Promise.all([
    googleCalendarFetch<{
      id: string;
      summary: string;
      description?: string | null;
      timeZone?: string | null;
      accessRole?: string | null;
      primary?: boolean;
    }>(summaryUrl.toString(), accessToken).catch(() => null),
    googleCalendarFetch<{
      items?: GoogleCalendarEvent[];
      summary?: string;
      description?: string | null;
      timeZone?: string | null;
    }>(eventsUrl.toString(), accessToken),
  ]);

  return {
    summary: summaryResponse
      ? {
          id: summaryResponse.id,
          summary: summaryResponse.summary,
          description: summaryResponse.description ?? null,
          timeZone: summaryResponse.timeZone ?? null,
          accessRole: summaryResponse.accessRole ?? null,
          primary: Boolean(summaryResponse.primary),
        }
      : null,
    events: eventsResponse.items ?? [],
  } satisfies GoogleCalendarEventsResult;
}
