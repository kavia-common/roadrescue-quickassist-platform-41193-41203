import React, { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { dataService } from "../services/dataService";

/**
 * Supabase Auth callback landing page.
 *
 * Supabase (especially for password recovery / PKCE flows) expects the application to
 * receive the redirect, let Supabase parse URL params/hash, and then continue the flow.
 *
 * This page:
 * - Calls supabase.auth.getSession() (which causes Supabase JS to read tokens from URL)
 * - If the URL looks like a recovery flow (type=recovery / access_token / refresh_token / code),
 *   forwards the browser to /reset-password (keeping existing query/hash).
 * - Otherwise, redirects to /admin (admin login).
 */

// PUBLIC_INTERFACE
export function AuthCallbackPage() {
  /** Handles Supabase auth callback and forwards to /reset-password (recovery) or /admin (default). */
  const supabaseConfigured = useMemo(() => dataService.isSupabaseConfigured?.(), []);
  const [status, setStatus] = useState({ ready: false, error: "" });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!supabaseConfigured) {
        // In mock mode, there is no Supabase callback to process.
        if (!cancelled) setStatus({ ready: true, error: "" });
        return;
      }

      const supabase = dataService.getSupabaseClient?.();
      if (!supabase) {
        if (!cancelled) setStatus({ ready: true, error: "Supabase client is unavailable. Please check configuration." });
        return;
      }

      try {
        // Supabase automatically reads tokens from URL hash/query for implicit flows.
        // For PKCE, tokens are exchanged by exchangeCodeForSession() (handled on /reset-password).
        await supabase.auth.getSession();

        if (cancelled) return;
        setStatus({ ready: true, error: "" });
      } catch (e) {
        if (cancelled) return;
        setStatus({ ready: true, error: e?.message || "Could not complete authentication callback." });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabaseConfigured]);

  if (!status.ready) {
    return (
      <div className="container" style={{ paddingTop: 28 }}>
        <div className="hero">
          <h1 className="h1">Completing authentication…</h1>
          <p className="lead">Please wait.</p>
        </div>
        <div className="skeleton">Completing authentication…</div>
      </div>
    );
  }

  // Decide whether this was a recovery flow.
  const hash = window.location.hash || "";
  const search = window.location.search || "";

  const paramsFromHash = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const paramsFromSearch = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  const type = (paramsFromSearch.get("type") || paramsFromHash.get("type") || "").toLowerCase();
  const hasRecoveryType = type === "recovery";
  const hasAccessToken = Boolean(paramsFromSearch.get("access_token") || paramsFromHash.get("access_token"));
  const hasRefreshToken = Boolean(paramsFromSearch.get("refresh_token") || paramsFromHash.get("refresh_token"));
  const hasCode = Boolean(paramsFromSearch.get("code"));
  const looksLikeRecovery = hasRecoveryType || hasAccessToken || hasRefreshToken || hasCode;

  if (looksLikeRecovery) {
    // Keep the original query/hash so /reset-password can exchange `code` or use tokens.
    const suffix = `${window.location.search || ""}${window.location.hash || ""}`;
    window.location.replace(`/reset-password${suffix}`);
    return null;
  }

  // Default: go to admin login screen.
  if (status.error) {
    // Non-fatal: still route user to admin but keep a hint in console.
    // (We avoid blocking navigation on callback errors.)
    // eslint-disable-next-line no-console
    console.warn("[AuthCallbackPage] callback error:", status.error);
  }

  return <Navigate to="/admin" replace />;
}

export default AuthCallbackPage;
