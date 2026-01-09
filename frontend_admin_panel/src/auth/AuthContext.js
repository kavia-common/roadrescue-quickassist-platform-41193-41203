import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * DEMO ONLY AUTH (temporary):
 * This file provides a simple client-side, hardcoded "admin" login to unblock demo usage
 * when Supabase/external auth is not set up.
 *
 * Removal plan:
 * - Delete this file
 * - Remove <AuthProvider> wrapper in App.js
 * - Revert LoginPage to use real auth only (e.g., dataService.login)
 * - Revert Navbar to call dataService.logout (if desired)
 */

const DEMO_ADMIN_EMAIL = "admin@demo.local";
const DEMO_ADMIN_PASSWORD = "demo1234";

const AuthContext = createContext(null);

// PUBLIC_INTERFACE
export function AuthProvider({ children }) {
  /** Provides demo-only admin authentication state for the admin panel. */
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState(null); // "admin" | null

  const login = useCallback(async (email, password) => {
    const e = String(email || "").trim().toLowerCase();
    const p = String(password || "");

    if (e === DEMO_ADMIN_EMAIL && p === DEMO_ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setRole("admin");
      return { email: DEMO_ADMIN_EMAIL, role: "admin", mode: "demo" };
    }

    // Keep this error message explicit so it's obvious this is a demo-only bypass.
    throw new Error("DEMO ONLY: Invalid demo admin credentials.");
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setRole(null);
  }, []);

  const value = useMemo(
    () => ({
      isAuthenticated,
      role,
      mode: "demo",
      login,
      logout,
      demoCredentials: { email: DEMO_ADMIN_EMAIL, password: DEMO_ADMIN_PASSWORD },
    }),
    [isAuthenticated, role, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// PUBLIC_INTERFACE
export function useAuth() {
  /** Hook to access demo-only admin authentication state and actions. */
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider.");
  return ctx;
}
