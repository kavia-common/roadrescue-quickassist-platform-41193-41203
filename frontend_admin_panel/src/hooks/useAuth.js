import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { dataService } from "../services/dataService";

/**
 * This hook/provider is an adapter layer that:
 * - Keeps mock/localStorage mode working (no Supabase env)
 * - Uses Supabase session when configured
 * - Exposes a simple "isAdmin" boolean for UI gating (AdminLayout/AdminAuth)
 *
 * NOTE: The attachment references tables like `user_roles` / `mechanics`.
 * This project currently stores roles in `public.profiles.role`, so we use
 * `dataService.getCurrentProfile()` / `RequireAuth`-compatible logic.
 */

const AuthContext = createContext(undefined);

// PUBLIC_INTERFACE
export function AuthProvider({ children }) {
  /** Provides auth state and helpers (signIn/signOut/isAdmin) to the admin panel. */
  const [user, setUser] = useState(null); // Supabase user object (or mock user minimal shape)
  const [session, setSession] = useState(null); // Supabase session when configured
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState(null); // { id, role, full_name } or null
  const [isAdmin, setIsAdmin] = useState(false);

  const supabaseConfigured = useMemo(() => dataService.isSupabaseConfigured?.(), []);

  const refreshProfile = async () => {
    if (!supabaseConfigured) {
      // In mock mode, admin is determined by the mock user's role.
      const u = await dataService.getCurrentUser();
      setProfile(u ? { id: u.id, role: u.role, full_name: null } : null);
      setIsAdmin(Boolean(u && u.role === "admin"));
      return;
    }

    try {
      const p = await dataService.getCurrentProfile();
      setProfile(p);
      setIsAdmin(Boolean(p && p.role === "admin"));
    } catch (e) {
      // Profile read can fail due to RLS or missing row; leave isAdmin false.
      console.warn("[useAuth] could not refresh profile:", e?.message || e);
      setProfile(null);
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        if (!supabaseConfigured) {
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

        await refreshProfile();

        // Subscribe to auth changes (sign-in/out/token refresh) and refresh profile.
        const { data } = supabase.auth.onAuthStateChange(async () => {
          if (!mounted) return;
          const { session: nextSession, user: nextUser } = await dataService.getCurrentSession();
          if (!mounted) return;

          setSession(nextSession);
          setUser(nextUser);
          await refreshProfile();
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
      // In mock mode, dataService returns minimal user already including role.
      if (!supabaseConfigured) {
        setUser(u);
        setProfile(u ? { id: u.id, role: u.role, full_name: null } : null);
        setIsAdmin(Boolean(u && u.role === "admin"));
      } else {
        // Supabase mode: user/session are set by onAuthStateChange, but refresh eagerly.
        const { session: s, user: supaUser } = await dataService.getCurrentSession();
        setSession(s);
        setUser(supaUser);
        await refreshProfile();
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

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      loading,
      signIn,
      signOut,
      isAdmin,

      // Backwards-compat flags from the attachment (not used in this admin panel, but exposed).
      isMechanic: false,
      mechanicStatus: null,
      signUp: async () => ({ error: new Error("Not implemented in admin panel.") }),
      signInWithGoogle: async () => ({ error: new Error("Not implemented in admin panel.") }),
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
