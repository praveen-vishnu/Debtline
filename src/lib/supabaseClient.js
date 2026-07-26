import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Loud, not silent — a missing key produces a confusing blank screen
  // otherwise. Fail with a message that tells you exactly what to fix.
  console.error(
    "Missing Supabase env vars. Copy .env.example to .env and fill in " +
      "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from your Supabase project settings."
  );
}

export const supabase = createClient(url, anonKey);
