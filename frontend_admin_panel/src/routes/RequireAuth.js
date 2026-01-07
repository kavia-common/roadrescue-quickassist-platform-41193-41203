import React, { useEffect, useMemo, useState } from "react";
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
   * - In Supabase mode: wait for auth session to resolve, then fetch `public.profiles` for auth.uid()
   *   and allow access only when `profile.role === 'admin'`.
   * - In mock mode (no Supabase env): preserve the existing behavior using the `user` prop.
   *
   * Also:
   * - subscribes to Supabase auth state changes and re-fetches profile
   * - provides loading and retry UI
   * - emits minimal console.debug logs for uid + role (no secrets)
   */
  const location = useLocation();

  const isSupa = dataService.isSupabaseConfigured?.() && Boolean(dataService.getSupabaseClient?.());
  const supabase = useMemo(() => (isSupa ? dataService.getSupabaseClient() : null), [isSupa]);

  const [loading, setLoading] = useState(Boolean(isSupa));
  const [error, setError] = useState("");
  const [sessionUser, setSessionUser] = useState(null); // supabase auth user
  const [profile, setProfile] = useState(null); // profiles row

  const canAccess = useMemo(() => {
    if (!isSupa) return Boolean(user); // keep existing fallback behavior
    return Boolean(profile && profile.role === "admin");
  }, [isSupa, user, profile]);

  const loadSupabaseAuthAndProfile = async () => {
    if (!supabase) return;

    setLoading(true);
    setError("");

    try {
      // Prefer session first to quickly resolve uid.
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const session = sessionData?.session || null;
      const u = session?.user || null;

      if (!u) {
        // If no session, double-check getUser for completeness.
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        setSessionUser(userData?.user || null);
        setProfile(null);
        console.debug("[admin-auth] uid:", userData?.user?.id || null, "role:", null);
        return;
      }

      setSessionUser(u);
      console.debug("[admin-auth] uid:", u.id);

      const p = await dataService.getMyProfile();
      setProfile(p);
      console.debug("[admin-auth] uid:", u.id, "role:", p?.role || null);
    } catch (e) {
      setError(e?.message || "Could not verify your access. Please try again.");
      setSessionUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;
    let sub;

    (async () => {
      await loadSupabaseAuthAndProfile();

      // Subscribe to auth events (sign-in/out/token refresh) and re-check profile.
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mounted) return;
        console.debug("[admin-auth] auth event:", event, "uid:", session?.user?.id || null);

        // Always re-check profile on auth changes; role updates require a re-fetch.
        await loadSupabaseAuthAndProfile();
      });
      sub = data?.subscription;
    })();

    return () => {
      mounted = false;
      sub?.unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

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
    if (error) {
      return <Blocked title="Could not verify access" detail={error} onRetry={loadSupabaseAuthAndProfile} />;
    }

    // Note: profile may be null if RLS blocks reads or row doesn't exist.
    return (
      <Blocked
        title="Access restricted"
        detail={
          profile
            ? `Your account role is '${profile.role || "unknown"}'. This portal is for admins only.`
            : "We couldn't load your profile. This can happen if the profile row doesn't exist or access is restricted."
        }
        onRetry={loadSupabaseAuthAndProfile}
      />
    );
  }

  return children;
}
