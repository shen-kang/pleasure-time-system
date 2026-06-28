 import { createClient } from "@supabase/supabase-js";
 
 const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
 const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
 
 export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
 
 function makeClient() {
   if (!hasSupabaseConfig) return null;
   return createClient(supabaseUrl, supabaseAnonKey, {
     auth: { persistSession: true, autoRefreshToken: true },
     realtime: { params: { eventsPerSecond: 10 } },
   });
 }
 
 export const supabase = makeClient();
 
 export function getProfileId(): string | null {
   return process.env.NEXT_PUBLIC_APP_PROFILE_ID || null;
 }
