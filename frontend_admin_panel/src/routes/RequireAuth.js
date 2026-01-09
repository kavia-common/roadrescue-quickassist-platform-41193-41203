import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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

  // --- Demo session fallback support ---
  const [demoAuthed, setDemoAuthed] = useState(null);

  useEffect(() => {
    let mounted = true;
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

          // Email-based demo admin access (no role/app_metadata dependency).
          if (!session || email !== "admin@roadrescue.demo") {
            // Check demo fallback in localStorage
            const demo = (() => {
              try {
                const raw = window.localStorage.getItem("rrqa.demo_admin");
                if (!raw) return null;
                const demoObj = JSON.parse(raw);
                return demoObj && demoObj.user && demoObj.user.email === "admin@roadrescue.demo"
                  ? demoObj
                  : null;
              } catch {
                return null;
              }
            })();
            if (demo) {
              setDemoAuthed(demo);
              setChecking(false);
              return;
            }
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
      // Not Supabase: check demo session in mock mode, then use App.js-provided user
      const demo = (() => {
        try {
          const raw = window.localStorage.getItem("rrqa.demo_admin");
          if (!raw) return null;
          const demoObj = JSON.parse(raw);
          return demoObj && demoObj.user && demoObj.user.email === "admin@roadrescue.demo"
            ? demoObj
            : null;
        } catch {
          return null;
        }
      })();
      if (!user && !demo) {
        navigate("/login", { replace: true, state: { from: location.pathname } });
        return;
      }
      if (demo) setDemoAuthed(demo);
    }
    return () => {
      mounted = false;
    };
  }, [isSupa, supabase, navigate, location.pathname, user]);

  if (checking) return <LoadingGate message="Verifying admin access…" />;

  // If demoAuthed is set, show a demo banner and allow
  if (demoAuthed) {
    return (
      <div>
        <div
          style={{
            minHeight: 0,
            fontSize: 14,
            fontWeight: 700,
            background:
              "linear-gradient(90deg,#f59e0b22 0 60%,#2563eb18 60% 100%)",
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
          Demo-only: Signed in as <span style={{ color: "#1D4ED8" }}>admin@roadrescue.demo</span>{" "}
          (local session, not real authentication)
        </div>
        {children}
      </div>
    );
  }

  // Mock mode: preserve original behavior (admin user object is provided by App.js).
  if (!isSupa) {
    if (!user) {
      navigate("/login", { replace: true, state: { from: location.pathname } });
      return null;
    }
    return children;
  }

  return children;
}

