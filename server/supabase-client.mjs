import { createClient } from "@supabase/supabase-js";

export function canUseSupabase(env = process.env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export function runtimeMode(env = process.env) {
  return env.PANDA_RUNTIME_MODE === "supabase" && canUseSupabase(env) ? "supabase" : "local";
}

export function createSupabaseServerClient(env = process.env) {
  if (runtimeMode(env) !== "supabase") return undefined;
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
