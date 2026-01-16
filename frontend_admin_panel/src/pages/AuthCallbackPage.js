import React, { useEffect, useMemo } from "react";
import { dataService } from "../services/dataService";

/**
 * Minimal Supabase auth callback page (matches user's required implementation).
 *
 * Supabase expects the SPA to receive the redirect URL and let supabase-js
 * read tokens from the URL (hash/query) via `supabase.auth.getSession()`.
 *
 * Behavior (copy-exact semantics from user spec):
 * - If `data.session` exists => redirect to `/reset-password`
 * - Else => redirect to `/`
 */

// PUBLIC_INTERFACE
export function AuthCallbackPage() {
  /** Supabase callback handler: parses tokens and forwards to reset-password or home. */
  const supabaseConfigured = useMemo(() => dataService.isSupabaseConfigured?.(), []);

  useEffect(() => {
    // In non-supabase/mock mode, nothing to parse; just go home.
    if (!supabaseConfigured) {
      window.location.href = "/";
      return;
    }

    const supabase = dataService.getSupabaseClient?.();
    if (!supabase) {
      window.location.href = "/";
      return;
    }

    // Supabase automatically reads tokens from URL hash/query.
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        // If this was password reset → go to reset screen
        window.location.href = "/reset-password";
      } else {
        // Fallback
        window.location.href = "/";
      }
    });
  }, [supabaseConfigured]);

  return (
    <div style={{ padding: 40 }}>
      <h3>Completing authentication…</h3>
    </div>
  );
}

export default AuthCallbackPage;
