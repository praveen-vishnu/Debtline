import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  url &&
    anonKey &&
    url !== "https://your-project-ref.supabase.co" &&
    anonKey !== "your-anon-public-key"
);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey)
  : null;
