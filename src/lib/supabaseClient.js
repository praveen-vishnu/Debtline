import { createClient } from "@supabase/supabase-js";

const isPlaceholderValue = (value) => {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "your-anon-public-key" ||
    normalized.includes("your-project-ref") ||
    normalized.includes("your-supabase") ||
    normalized.includes("your-")
  );
};

export const isSupabaseConfigValue = (url, anonKey) =>
  Boolean(url && anonKey && !isPlaceholderValue(url) && !isPlaceholderValue(anonKey));

const viteEnv = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
const url = viteEnv.VITE_SUPABASE_URL || "";
const anonKey = viteEnv.VITE_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = isSupabaseConfigValue(url, anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey)
  : null;
