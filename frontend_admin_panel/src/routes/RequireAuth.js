import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

/**
 * Legacy route guard for the old non-/admin route group (e.g. /dashboard, /users).
 *
 * IMPORTANT:
 * - Per request, admin gating must use ONLY `useAuth().isAdmin`, which in Supabase mode
 *   is derived ONLY from `public.admins` (no app_metadata/profile/user_roles checks).
 * - If not admin, redirect to /admin.
 */

// PUBLIC_INTERFACE
export function RequireAuth({ user, children }) {
  /**
   * Guards legacy (non-/admin) routes.
   *
   * - In Supabase mode: uses global auth state from AuthProvider (session + isAdmin).
   * - In mock mode: uses the legacy `user` prop (admin if user.role === "admin") via AuthProvider's isAdmin.
   */
  const location = useLocation();
  const { loading, isAdmin, user: authUser } = useAuth();

  if (loading) {
    return (
      <div className="container">
        <div className="skeleton" role="status" aria-live="polite">
          Checking access…
        </div>
      </div>
    );
  }

  // Prefer AuthProvider state; keep `user` prop only as a last-resort compatibility hint.
  const hasUser = Boolean(authUser || user);

  // Not signed in -> legacy goes to /login (keeps original legacy flow intact).
  if (!hasUser) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  // Signed in but not admin -> redirect to /admin (requested).
  if (!isAdmin) return <Navigate to="/admin" replace state={{ from: location.pathname }} />;

  return children;
}
