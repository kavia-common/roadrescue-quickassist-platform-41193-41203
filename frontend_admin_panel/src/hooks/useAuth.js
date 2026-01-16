import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { dataService } from "../services/dataService";

/**
 * This hook/provider is an adapter layer that:
 * - Keeps mock/localStorage mode working (no Supabase env)
 * - Uses Supabase session when configured
 * - Exposes a simple "isAdmin" boolean for UI gating (AdminLayout/AdminAuth)
 *
 * IMPORTANT (EXACT FIX):
 * - In Supabase mode, admin is derived ONLY from:
 *   session.user.app_metadata.role === 'admin'
 * - No DB lookups (profiles/user_roles/etc) for admin gating.
 */

const AuthContext = createContext(undefined);

function checkAdmin(session) {
  // Supabase: role is stored in app_metadata (authoritative for admin gating here)
  return session?.user?.app_metadata?.role === "admin";
}

// PUBLIC_INTERFACE
export function AuthProvider({ children }) {
  /** Provides auth state and helpers (signIn/signOut/isAdmin) to the admin panel. */
  const [user, setUser] = useState(null); // Supabase auth user (or mock user minimal shape)
  const [session, setSession] = useState(null); // Supabase session when configured
  const [loading, setLoading] = useState(true);

  // NOTE: kept for backwards compatibility with existing UI, but NOT used for admin gating.
  const [profile, setProfile] = useState(null); // { id, role, full_name } or null

  const [isAdmin, setIsAdmin] = useState(false);

  const supabaseConfigured = useMemo(() => dataService.isSupabaseConfigured?.(), []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        if (!supabaseConfigured) {
          // Mock mode: preserve old behavior (admin via mock user's role).
          const u = await dataService.getCurrentUser();
          if (!mounted) return;
          setUser(u);
          setSession(null);
          setProfile(u ? { id: u.id, role: u.role, full_name: null } : null);
          setIsAdmin(Boolean(u && u.role === "admin"));
          return;
        }

        // Supabase mode
        const supabase = dataService.getSupabaseClient?.();
        const { session: s, user: u } = await dataService.getCurrentSession();
        if (!mounted) return;

        setSession(s);
        setUser(u);
        setIsAdmin(checkAdmin(s));

        // Subscribe to auth changes (sign-in/out/token refresh)
        const { data } = supabase.auth.onAuthStateChange(async () => {
          if (!mounted) return;

          const { session: nextSession, user: nextUser } = await dataService.getCurrentSession();
          if (!mounted) return;

          setSession(nextSession);
          setUser(nextUser);
          setIsAdmin(checkAdmin(nextSession));
        });

        return () => data?.subscription?.unsubscribe?.();
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PUBLIC_INTERFACE
  const signIn = async (email, password) => {
    /** Signs in using either Supabase auth or mock localStorage mode. */
    try {
      const u = await dataService.login(email, password);

      if (!supabaseConfigured) {
        setUser(u);
        setProfile(u ? { id: u.id, role: u.role, full_name: null } : null);
        setIsAdmin(Boolean(u && u.role === "admin"));
      } else {
        // Supabase mode: refresh session and set isAdmin strictly from app_metadata.
        const { session: s, user: supaUser } = await dataService.getCurrentSession();
        setSession(s);
        setUser(supaUser);
        setIsAdmin(checkAdmin(s));
      }

      return { error: null };
    } catch (e) {
      return { error: new Error(e?.message || "Login failed.") };
    }
  };

  // PUBLIC_INTERFACE
  const signOut = async () => {
    /** Signs out and clears local auth state. */
    await dataService.logout();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
  };

  // PUBLIC_INTERFACE
  const requestPasswordReset = async (email) => {
    /** Starts Supabase password reset flow (sends email). */
    try {
      await dataService.requestPasswordReset(email);
      return { error: null };
    } catch (e) {
      return { error: new Error(e?.message || "Could not start password reset.") };
    }
  };

  // PUBLIC_INTERFACE
  const updatePassword = async (newPassword) => {
    /** Completes password reset by setting a new password for the currently authenticated user. */
    try {
      await dataService.updatePassword(newPassword);
      return { error: null };
    } catch (e) {
      return { error: new Error(e?.message || "Could not update password.") };
    }
  };

  // PUBLIC_INTERFACE
  const signInWithGoogle = async () => {
    /**
     * Starts Google OAuth flow via Supabase.
     * Note: this will redirect the browser away; it may not return control to this function.
     */
    try {
      await dataService.signInWithGoogle();
      return { error: null };
    } catch (e) {
      return { error: new Error(e?.message || "Could not start Google sign-in.") };
    }
  };

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      loading,
      signIn,
      signOut,
      requestPasswordReset,
      updatePassword,
      signInWithGoogle,
      isAdmin,

      // Backwards-compat flags from the attachment (not used in this admin panel, but exposed).
      isMechanic: false,
      mechanicStatus: null,
      signUp: async () => ({ error: new Error("Not implemented in admin panel.") }),
    }),
    [user, session, profile, loading, isAdmin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// PUBLIC_INTERFACE
export function useAuth() {
  /** Access auth state/helpers; must be used within <AuthProvider>. */
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
