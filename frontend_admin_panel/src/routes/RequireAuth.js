import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { dataService, getDemoAdminSession } from "../services/dataService";

function LoadingGate({ message = "Checking access…" }) {
  return (
    <div className="container">
      <div className="skeleton" role="status" aria-live="polite">
        {message}
      </div>
    </div>
  );
}

/**
 * PUBLIC_INTERFACE
 */
export function RequireAuth({ user, children }) {
  /**
   * Admin route guard.
   *
   * Required behavior (per request):
   * - Fetch Supabase session via `supabase.auth.getSession()`
   * - Allow access ONLY when `session.user.email === 'admin@roadrescue.demo'`
   * - If missing session or non-matching email, redirect to `/login`
   *
   * Notes:
   * - In mock mode (no Supabase configured), we preserve existing behavior using the `user` prop.
   * - Redirect happens inside `useEffect` to avoid premature redirects during initial render.
   * - MODIFIED: Accepts localStorage demo session for demo/dev use (email === admin@roadrescue.demo).
   */
  const navigate = useNavigate();
  const location = useLocation();

  const isSupa = dataService.isSupabaseConfigured?.() && Boolean(dataService.getSupabaseClient?.());
  const supabase = useMemo(() => (isSupa ? dataService.getSupabaseClient() : null), [isSupa]);
  const [checking, setChecking] = useState(Boolean(isSupa));
  const [demoAuthed, setDemoAuthed] = useState(null);

  // --- Pure local demo session: grant instant access if found, block all further gating! ---
  useEffect(() => {
    let mounted = true;
    // STEP 1: check for local demo session (always preferred, instant).
    const demo = getDemoAdminSession?.();
    if (demo && demo.user && demo.user.email === "admin@roadrescue.demo") {
      setDemoAuthed(demo);
      setChecking(false);
      return; // Block all async Supabase session checks; demo always grants immediate access.
    }

    // STEP 2: If not demo, check Supabase session (only if Supabase is configured/enabled)
    if (isSupa) {
      (async () => {
        try {
          const { data, error } = await supabase.auth.getSession();
          if (!mounted) return;

          if (error) {
            navigate("/login", { replace: true, state: { from: location.pathname } });
            return;
          }

          const session = data?.session || null;
          const email = session?.user?.email || "";

          if (!session || email !== "admin@roadrescue.demo") {
            // No valid session, no demo override—block access
            navigate("/login", { replace: true, state: { from: location.pathname } });
            return;
          }

          setChecking(false);
        } catch {
          if (!mounted) return;
          navigate("/login", { replace: true, state: { from: location.pathname } });
        }
      })();
    } else {
      // Mock mode (no Supabase): allow only when user or demo session is present.
      if (!user) {
        navigate("/login", { replace: true, state: { from: location.pathname } });
        return;
      }
      // In mock mode, allow; no need to do anything else
    }
    return () => {
      mounted = false;
    };
  }, [isSupa, supabase, navigate, location.pathname, user]);

  if (checking) return <LoadingGate message="Verifying admin access…" />;

  // Show banner and allow for demo session
  if (demoAuthed && demoAuthed.user && demoAuthed.user.email === "admin@roadrescue.demo") {
    return (
      <div>
        <div
          style={{
            minHeight: 0,
            fontSize: 14,
            fontWeight: 700,
            background: "linear-gradient(90deg,#f59e0b22 0 60%,#2563eb18 60% 100%)",
            borderBottom: "2px dotted #F59E0B",
            color: "#B45309",
            padding: 10,
            marginBottom: 8,
            borderRadius: 8,
            letterSpacing: 0,
            textAlign: "center",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          Demo admin session — not a real login (<span style={{ color: "#1D4ED8" }}>admin@roadrescue.demo</span>)
        </div>
        {children}
      </div>
    );
  }

  // For mock mode, allow direct access for pre-authed "admin" users as legacy fallback (but only if no demo session found)
  if (!isSupa) {
    if (!user) {
      navigate("/login", { replace: true, state: { from: location.pathname } });
      return null;
    }
    return children;
  }

  return children;
}

