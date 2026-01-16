import { createClient } from "@supabase/supabase-js";

/**
 * Centralized Supabase client creation.
 *
 * IMPORTANT:
 * - This file MUST be the only place `createClient()` is called in this app.
 * - Re-using a single client instance prevents multiple GoTrueClient instances
 *   and avoids the "Multiple GoTrueClient instances" warning.
 */

function getSupabaseEnv() {
  const url = process.env.REACT_APP_SUPABASE_URL;
  const key = process.env.REACT_APP_SUPABASE_KEY;
  return { url, key };
}

// Keep a single client instance per browser session/module load.
let _client = null;

// PUBLIC_INTERFACE
export function isSupabaseConfigured() {
  /** Returns true only when required REACT_APP_ Supabase env vars are present (React build-time). */
  const { url, key } = getSupabaseEnv();
  return Boolean(url && key);
}

// PUBLIC_INTERFACE
export function getSupabaseClient() {
  /**
   * Returns a singleton Supabase client when configured, otherwise null.
   * This ensures only ONE GoTrueClient exists per browser session.
   */
  if (!isSupabaseConfigured()) return null;
  if (_client) return _client;

  const { url, key } = getSupabaseEnv();

  try {
    _client = createClient(url, key);
    return _client;
  } catch (e) {
    console.warn("[supabase/client] Failed to create Supabase client:", e?.message || e);
    _client = null;
    return null;
  }
}
