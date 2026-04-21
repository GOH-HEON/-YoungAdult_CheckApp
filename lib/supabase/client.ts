"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createSupabaseBrowserClient() {
  if (client) {
    return client;
  }

  const { url, anonKey } = getSupabasePublicEnv();
  client = createBrowserClient(url, anonKey);
  return client;
}
