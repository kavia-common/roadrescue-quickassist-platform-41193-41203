import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { dataService } from "../services/dataService";

function LoadingGate({ message = "Checking access…" }) {
  return (
    <div className="container">
      <div className="skeleton" role="status" aria-live="polite">
        {message}
      </div>
    </div>
  );
}

function Blocked({ title, detail, onRetry }) {
  return (
    <div className="container">
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
            If you believe this is a mistake, confirm your account has <strong>role = admin</strong> in <code>public.profiles</code> and try again.
          </div>
        </div>
      </div>
    </div>
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
   * Requirements implemented:
   * - Explicit loading/error UI with bounded retries (no indefinite blocking)
   * - Re-fetch profile after login navigation via auth change subscription
   * - Temporary debug logs (console.info) of { uid, role, hasSession }
   */
  const location = useLocation();

  const isSupa = dataService.isSupabaseConfigured?.() && Boolean(dataService.getSupabaseClient?.());
  const supabase = useMemo(() => (isSupa ? dataService.getSupabaseClient() : null), [isSupa]);

  const [loading, setLoading] = useState(Boolean(isSupa));
  const [error, setError] = useState("");
  const [sessionUser, setSessionUser] = useState(null); // Supabase auth user
  const [profile, setProfile] = useState(null); // profiles row {id, role, full_name}
  const [attempt, setAttempt] = useState(0);

  const retryTimerRef = useRef(null);

  const canAccess = useMemo(() => {
    if (!isSupa) return Boolean(user); // keep existing fallback behavior
    return Boolean(profile && profile.role === "admin");
  }, [isSupa, user, profile]);

  const clearRetryTimer = () => {
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  };

  const logDebug = (payload) => {
    // Temporary debugging as requested (no secrets).
    console.info("[admin-auth]", payload);
  };

  const loadSupabaseAuthAndProfile = useCallback(
    async ({ scheduleRetry } = { scheduleRetry: true }) => {
      if (!supabase) return;

      clearRetryTimer();
      setLoading(true);
      setError("");

      try {
        // 1) Wait for session resolution (Supabase init). This is the canonical source.
        const { session, user: sUser } = await dataService.getCurrentSession();

        const uid = sUser?.id || null;
        const hasSession = Boolean(session);

        // Debug: session resolved
        logDebug({ uid, role: null, hasSession });

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
        logDebug({ uid, role: p?.role || null, hasSession });
      } catch (e) {
        setSessionUser(null);
        setProfile(null);
        setError(e?.message || "Could not verify your access. Please try again.");
      } finally {
        setLoading(false);

        // 3) Bounded loading: if we still don't have a stable answer, re-check shortly once.
        // This addresses cases where navigation happens quickly after login and session/profile propagation lags.
        if (scheduleRetry && attempt < 1) {
          retryTimerRef.current = window.setTimeout(() => {
            setAttempt((a) => a + 1);
          }, 650);
        }
      }
    },
    [supabase, attempt]
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

        const uid = session?.user?.id || null;
        logDebug({ uid, role: null, hasSession: Boolean(session) });

        // Always re-check profile on auth changes; role updates require a re-fetch.
        await loadSupabaseAuthAndProfile({ scheduleRetry: false });
      });

      sub = data?.subscription;
    })();

    return () => {
      mounted = false;
      clearRetryTimer();
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

  // Mock mode: preserve old redirect behavior.
  if (!isSupa) {
    if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    return children;
  }

  if (loading) return <LoadingGate message="Verifying admin access…" />;

  // Supabase mode: if not authenticated, send to login
  if (!sessionUser) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  // Supabase mode: authenticated but profile missing or not admin -> block
  if (!canAccess) {
    // Keep the existing message wording for non-admins.
    const detail =
      error ||
      (profile
        ? `Your account role is '${profile.role || "unknown"}'. This portal is for admins only.`
        : "We couldn't load your profile. This can happen if the profile row doesn't exist or access is restricted.");

    return <Blocked title={error ? "Could not verify access" : "Access restricted"} detail={detail} onRetry={() => loadSupabaseAuthAndProfile({ scheduleRetry: false })} />;
  }

  return children;
}
