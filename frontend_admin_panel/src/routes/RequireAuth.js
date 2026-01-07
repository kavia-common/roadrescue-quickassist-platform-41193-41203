import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { dataService } from "../services/dataService";

function LoadingGate({ message = "Checking access…", debugPanel = null }) {
  return (
    <div className="container">
      <div className="skeleton" role="status" aria-live="polite" style={{ position: "relative" }}>
        {message}
        {debugPanel}
      </div>
    </div>
  );
}

function Blocked({ title, detail, onRetry, debugPanel = null }) {
  return (
    <div className="container" style={{ position: "relative" }}>
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">{title}</h2>
            {detail ? <p className="card-subtitle">{detail}</p> : null}
          </div>
          {onRetry ? (
            <div className="card-actions">
              <button className="btn btn-ghost btn-sm" type="button" onClick={onRetry}>
                Retry
              </button>
            </div>
          ) : null}
        </div>
        <div className="card-body">
          <div className="alert alert-info">
            If you believe this is a mistake, confirm your account has <strong>role = admin</strong> in{" "}
            <code>public.profiles</code> and try again.
          </div>
        </div>
      </div>

      {debugPanel}
    </div>
  );
}

function shouldShowDebugPanel() {
  // Prefer NODE_ENV (CRA provides it). Allow env override too.
  const nodeEnv = process.env.NODE_ENV;
  const appEnv = process.env.REACT_APP_NODE_ENV;
  return nodeEnv !== "production" && appEnv !== "production";
}

function AdminDebugPanel({ state }) {
  const visible = shouldShowDebugPanel();
  if (!visible) return null;

  const panelStyle = {
    position: "fixed",
    right: 12,
    bottom: 12,
    zIndex: 9999,
    width: 340,
    maxWidth: "calc(100vw - 24px)",
    borderRadius: 12,
    border: "1px solid rgba(239,68,68,0.30)",
    background: "rgba(17,24,39,0.92)",
    color: "#fff",
    boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
    padding: "10px 12px",
    fontSize: 12,
    lineHeight: 1.35,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  };

  const rowStyle = { display: "flex", justifyContent: "space-between", gap: 12, marginTop: 6 };
  const labelStyle = { color: "rgba(255,255,255,0.75)" };
  const valStyle = { fontWeight: 900, wordBreak: "break-all", textAlign: "right" };

  return (
    <aside aria-label="Admin auth debug panel" style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <div style={{ fontWeight: 1000, letterSpacing: "0.02em" }}>[Admin Debug]</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>dev-only</div>
      </div>

      <div style={rowStyle}>
        <div style={labelStyle}>uid</div>
        <div style={valStyle}>{state.uid ?? "null"}</div>
      </div>
      <div style={rowStyle}>
        <div style={labelStyle}>role</div>
        <div style={valStyle}>{state.role ?? "unknown"}</div>
      </div>
      <div style={rowStyle}>
        <div style={labelStyle}>loading</div>
        <div style={valStyle}>{String(Boolean(state.loading))}</div>
      </div>
      <div style={rowStyle}>
        <div style={labelStyle}>decision</div>
        <div style={valStyle}>{state.decision ?? "deny"}</div>
      </div>

      {state.note ? (
        <div style={{ marginTop: 8, color: "rgba(255,255,255,0.75)" }}>
          <span style={{ fontWeight: 900 }}>note:</span> {state.note}
        </div>
      ) : null}

      <div style={{ marginTop: 8, color: "rgba(255,255,255,0.55)" }}>
        Console helper: <span style={{ color: "#fff", fontWeight: 900 }}>window.__ADMIN_DEBUG()</span>
      </div>
    </aside>
  );
}

// PUBLIC_INTERFACE
export function RequireAuth({ user, children }) {
  /**
   * Admin auth gate.
   *
   * Behavior:
   * - In Supabase mode:
   *   1) Wait for Supabase auth init (getSession + auth state subscription)
   *   2) Fetch `public.profiles` where `id = auth.uid()`
   *   3) Allow access only when `profile.role === 'admin'`
   * - In mock mode (no Supabase env): preserve the existing behavior using the `user` prop.
   *
   * Additive diagnostics (temporary):
   * - On-screen debug panel (dev only) showing uid, role, loading, decision.
   * - Global window.__ADMIN_DEBUG() that logs the same values.
   *
   * Requirements implemented:
   * - Explicit loading/error UI with bounded retries (no indefinite blocking)
   * - Bounded timeout fallback (defaults to 7s) so we can surface "deny" with clear messaging
   * - Re-fetch profile after login navigation via auth change subscription
   */
  const location = useLocation();

  const isSupa = dataService.isSupabaseConfigured?.() && Boolean(dataService.getSupabaseClient?.());
  const supabase = useMemo(() => (isSupa ? dataService.getSupabaseClient() : null), [isSupa]);

  const [loading, setLoading] = useState(Boolean(isSupa));
  const [error, setError] = useState("");
  const [sessionUser, setSessionUser] = useState(null); // Supabase auth user
  const [profile, setProfile] = useState(null); // profiles row {id, role, full_name}
  const [attempt, setAttempt] = useState(0);

  // This becomes true if we hit the bounded timeout; used to show clearer blocked messaging.
  const [timedOut, setTimedOut] = useState(false);

  const retryTimerRef = useRef(null);
  const timeoutRef = useRef(null);

  const uid = sessionUser?.id || null;
  const role = profile?.role ?? null;

  const canAccess = useMemo(() => {
    if (!isSupa) return Boolean(user); // keep existing fallback behavior
    return Boolean(profile && profile.role === "admin");
  }, [isSupa, user, profile]);

  const decision = useMemo(() => {
    if (!isSupa) return user ? "allow" : "deny";
    if (loading) return "deny"; // while loading we still consider decision "pending/deny" (panel shows loading=true)
    return canAccess ? "allow" : "deny";
  }, [isSupa, user, loading, canAccess]);

  const clearRetryTimer = () => {
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  const clearTimeoutTimer = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const logDebug = (payload) => {
    // Temporary debugging as requested (no secrets). Dev-only to avoid production noise.
    if (!shouldShowDebugPanel()) return;
    console.info("[admin-auth]", payload);
  };

  const debugState = useMemo(() => {
    let note = "";
    if (timedOut) note = "Timeout waiting for session/profile; showing best-known values.";
    else if (isSupa && loading) note = "Waiting for Supabase session + profile…";
    return { uid, role: role || "unknown", loading, decision: canAccess ? "allow" : "deny", note };
  }, [uid, role, loading, canAccess, timedOut, isSupa]);

  // Expose a global helper for quick inspection in the console.
  useEffect(() => {
    // PUBLIC_INTERFACE
    window.__ADMIN_DEBUG = () => {
      /** Logs current admin auth debug state (uid/role/loading/decision) to console. */
      // Mirror the panel content
      const payload = {
        uid: debugState.uid ?? null,
        role: debugState.role ?? "unknown",
        loading: Boolean(debugState.loading),
        decision: debugState.decision ?? "deny",
        timedOut: Boolean(timedOut),
        error: error || null,
      };
      console.info("[admin-auth][__ADMIN_DEBUG]", payload);
      return payload;
    };

    return () => {
      try {
        delete window.__ADMIN_DEBUG;
      } catch {
        // ignore
      }
    };
  }, [debugState, timedOut, error]);

  const loadSupabaseAuthAndProfile = useCallback(
    async ({ scheduleRetry } = { scheduleRetry: true }) => {
      if (!supabase) return;

      clearRetryTimer();
      clearTimeoutTimer();

      setTimedOut(false);
      setLoading(true);
      setError("");

      // Bounded fallback so we never spin forever if something is stuck.
      timeoutRef.current = window.setTimeout(() => {
        setTimedOut(true);
        setLoading(false);
        logDebug({
          uid: sessionUser?.id || null,
          role: profile?.role || null,
          hasSession: Boolean(sessionUser),
          note: "Timed out waiting for session/profile.",
        });
      }, 7000);

      try {
        // 1) Wait for session resolution (Supabase init). This is the canonical source.
        const { session, user: sUser } = await dataService.getCurrentSession();

        const hasSession = Boolean(session);
        const currentUid = sUser?.id || null;

        // Debug: session resolved
        logDebug({ uid: currentUid, role: null, hasSession });

        setSessionUser(sUser || null);

        // Not authenticated -> no profile to fetch.
        if (!sUser) {
          setProfile(null);
          return;
        }

        // 2) Fetch profile for auth.uid()
        const p = await dataService.getCurrentProfile();
        setProfile(p);

        // Debug: profile resolved
        logDebug({ uid: currentUid, role: p?.role || null, hasSession });
      } catch (e) {
        setSessionUser(null);
        setProfile(null);
        setError(e?.message || "Could not verify your access. Please try again.");
      } finally {
        // If timeout already fired, keep its state (but clear the timer).
        clearTimeoutTimer();
        setLoading(false);

        // 3) Bounded re-check after initial attempt (existing behavior kept).
        // This addresses cases where navigation happens quickly after login and session/profile propagation lags.
        if (scheduleRetry && attempt < 1) {
          retryTimerRef.current = window.setTimeout(() => {
            setAttempt((a) => a + 1);
          }, 650);
        }
      }
    },
    // Intentionally include these so timeout log reflects latest known values
    [supabase, attempt, sessionUser, profile]
  );

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;
    let sub;

    (async () => {
      await loadSupabaseAuthAndProfile({ scheduleRetry: true });

      // Subscribe to auth events (sign-in/out/token refresh) and re-check profile.
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mounted) return;

        const nextUid = session?.user?.id || null;
        logDebug({ uid: nextUid, role: null, hasSession: Boolean(session), event });

        // Always re-check profile on auth changes; role updates require a re-fetch.
        await loadSupabaseAuthAndProfile({ scheduleRetry: false });
      });

      sub = data?.subscription;
    })();

    return () => {
      mounted = false;
      clearRetryTimer();
      clearTimeoutTimer();
      sub?.unsubscribe?.();
    };
  }, [supabase, loadSupabaseAuthAndProfile]);

  // Trigger one bounded re-check after initial attempt, if needed.
  useEffect(() => {
    if (!supabase) return;
    if (attempt > 0) {
      loadSupabaseAuthAndProfile({ scheduleRetry: false });
    }
  }, [attempt, supabase, loadSupabaseAuthAndProfile]);

  const debugPanel = <AdminDebugPanel state={debugState} />;

  // Mock mode: preserve old redirect behavior.
  if (!isSupa) {
    if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    return (
      <>
        {children}
        {debugPanel}
      </>
    );
  }

  if (loading) return <LoadingGate message="Verifying admin access…" debugPanel={debugPanel} />;

  // Supabase mode: if not authenticated, send to login
  if (!sessionUser) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  // Supabase mode: authenticated but profile missing or not admin -> block
  if (!canAccess) {
    // Keep the existing message wording for non-admins.
    const detail =
      error ||
      (profile
        ? `Your account role is '${profile.role || "unknown"}'. This portal is for admins only.`
        : timedOut
          ? "Timed out waiting for your profile. This can happen if the profile row doesn't exist, RLS blocks reads, or the session isn't persisting."
          : "We couldn't load your profile. This can happen if the profile row doesn't exist or access is restricted.");

    return (
      <Blocked
        title={error ? "Could not verify access" : "Access restricted"}
        detail={detail}
        onRetry={() => loadSupabaseAuthAndProfile({ scheduleRetry: false })}
        debugPanel={debugPanel}
      />
    );
  }

  return (
    <>
      {children}
      {debugPanel}
    </>
  );
}
