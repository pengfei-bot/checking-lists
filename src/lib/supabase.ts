import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Public Supabase config (anon key is safe in the client).
 * Override with EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
 * (e.g. .env) — defaults bake the "Checking lists" project for web Pages demo.
 */
export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
  "https://lgiqyybjnjfjxixzennr.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnaXF5eWJqbmpmanhpeHplbm5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2OTA4MzMsImV4cCI6MjEwNDI2NjgzM30.fQmSrfAflW-onKDkIGylBfIPD1TpD622ZmoHRsIst6k";

export const SUPABASE_PROJECT_REF = "lgiqyybjnjfjxixzennr";
export const SUPABASE_PROJECT_NAME = "Checking lists";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

export function isCloudConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
