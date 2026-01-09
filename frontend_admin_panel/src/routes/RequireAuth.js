import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

/**
 * DEMO ONLY:
 * This route guard only checks the demo auth context.
 * Remove/revert this file when re-enabling real auth (Supabase) and its richer checks.
 */

// PUBLIC_INTERFACE
export function RequireAuth({ children }) {
  /**
   * Admin auth gate (DEMO ONLY).
   *
   * Allows access only when:
   * - isAuthenticated === true
   * - role === 'admin'
   *
   * Otherwise redirects to /login.
   */
  const location = useLocation();
  const { isAuthenticated, role } = useAuth();

  const isAdmin = isAuthenticated && role === "admin";
  if (!isAdmin) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return <>{children}</>;
}
