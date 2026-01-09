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

// PUBLIC_INTERFACE
export function RequireAuth({ user, children }) {
  /**
   * Admin route guard.
   *
   * Required behavior (per request):
   * - Fetch Supabase session via `supabase.auth.getSession()`
   * - Check `session.user.app_metadata.role === 'admin'`
   * - If missing session or not admin, redirect to `/login`
   *
   * Notes:
   * - In mock mode (no Supabase configured), we preserve existing behavior using the `user` prop.
   * - Redirect happens inside `useEffect` to avoid premature redirects during initial render.
   */
  const navigate = useNavigate();
  const location = useLocation();

  const isSupa = dataService.isSupabaseConfigured?.() && Boolean(dataService.getSupabaseClient?.());
  const supabase = useMemo(() => (isSupa ? dataService.getSupabaseClient() : null), [isSupa]);

  const [checking, setChecking] = useState(Boolean(isSupa));

  useEffect(() => {
    if (!isSupa) return;

    let mounted = true;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error) {
          navigate("/login", { replace: true, state: { from: location.pathname } });
          return;
        }

        const session = data?.session || null;
        const role = session?.user?.app_metadata?.role;

        if (!session || role !== "admin") {
          navigate("/login", { replace: true, state: { from: location.pathname } });
          return;
        }

        // Admin session OK; allow route rendering.
        setChecking(false);
      } catch {
        if (!mounted) return;
        navigate("/login", { replace: true, state: { from: location.pathname } });
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isSupa, supabase, navigate, location.pathname]);

  // Mock mode: preserve original behavior (admin user object is provided by App.js).
  if (!isSupa) {
    if (!user) {
      navigate("/login", { replace: true, state: { from: location.pathname } });
      return null;
    }
    return children;
  }

  if (checking) return <LoadingGate message="Verifying admin access…" />;

  return children;
}

