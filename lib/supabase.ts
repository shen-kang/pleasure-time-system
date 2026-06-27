import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      realtime: { params: { eventsPerSecond: 10 } }
    })
  : null;

export function getProfileId() {
  if (process.env.NEXT_PUBLIC_APP_PROFILE_ID) {
    return process.env.NEXT_PUBLIC_APP_PROFILE_ID;
  }

  if (typeof window === "undefined") {
    return "local-demo";
  }

  const storageKey = "pleasure-time-profile-id";
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;

  const generated = crypto.randomUUID();
  window.localStorage.setItem(storageKey, generated);
  return generated;
}
