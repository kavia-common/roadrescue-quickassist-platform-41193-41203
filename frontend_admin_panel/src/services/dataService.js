import { createClient } from "@supabase/supabase-js";

const LS_KEYS = {
  session: "rrqa.session",
  users: "rrqa.users",
  requests: "rrqa.requests",
  fees: "rrqa.fees",
  seeded: "rrqa.seeded",

  // Demo admin session (explicitly separate from mock-mode rrqa.session)
  demoAdminSession: "admin_session",
};

const DEMO_ADMIN = {
  id: "demo-admin",
  email: "demo@roadrescue.local",
  role: "admin",
  full_name: "Demo Admin",
};

const DEMO_CREDENTIALS = {
  email: "demo@roadrescue.local",
  password: "demo123",
};

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function ensureSeedData() {
  const seeded = readJson(LS_KEYS.seeded, false);
  if (seeded) return;

  const users = [
    { id: uid("u"), email: "user@example.com", password: "password123", role: "user", approved: true },
    {
      id: uid("m"),
      email: "mech@example.com",
      password: "password123",
      role: "mechanic",
      approved: false,
      profile: { name: "Alex Mechanic", serviceArea: "Downtown" },
    },
    { id: uid("a"), email: "admin@example.com", password: "password123", role: "admin", approved: true },
  ];

  const now = new Date().toISOString();
  const requests = [
    {
      id: uid("req"),
      createdAt: now,
      userId: users[0].id,
      userEmail: users[0].email,
      vehicle: { make: "Toyota", model: "Corolla", year: "2016", plate: "ABC-123" },
      issueDescription: "Car won't start, clicking noise.",
      contact: { name: "Sam Driver", phone: "555-0101" },
      status: "Submitted",
      assignedMechanicId: null,
      assignedMechanicEmail: null,
      notes: [],
    },
    {
      id: uid("req"),
      createdAt: now,
      userId: users[0].id,
      userEmail: users[0].email,
      vehicle: { make: "Honda", model: "Civic", year: "2018", plate: "XYZ-987" },
      issueDescription: "Flat tire on rear left.",
      contact: { name: "Sam Driver", phone: "555-0101" },
      status: "Completed",
      assignedMechanicId: users[1].id,
      assignedMechanicEmail: users[1].email,
      notes: [{ id: uid("n"), at: now, by: "mech@example.com", text: "Completed (demo)." }],
    },
  ];

  writeJson(LS_KEYS.users, users);
  writeJson(LS_KEYS.requests, requests);
  writeJson(LS_KEYS.fees, { baseFee: 25, perMile: 2.0, afterHoursMultiplier: 1.25 });
  writeJson(LS_KEYS.seeded, true);
}

function getSupabaseEnv() {
  const url = process.env.REACT_APP_SUPABASE_URL;
  const key = process.env.REACT_APP_SUPABASE_KEY;
  return { url, key };
}

// PUBLIC_INTERFACE
function isSupabaseConfigured() {
  /** Returns true only when required REACT_APP_ Supabase env vars are present (React build-time). */
  const { url, key } = getSupabaseEnv();
  return Boolean(url && key);
}

// PUBLIC_INTERFACE
function isDemoEnabled() {
  /**
   * Returns true when demo admin mode should be enabled.
   *
   * IMPORTANT:
   * - Demo mode is an explicit opt-in via env flag only.
   * - When Supabase is NOT configured, the app runs in "mock mode" (seeded localStorage),
   *   and should continue to accept the documented mock admin credentials:
   *   `admin@example.com` / `password123`.
   *
   * This avoids accidentally forcing demo-only credentials in environments where Supabase
   * isn't configured (local development / demos), which previously caused login failures.
   */
  const flag = process.env.REACT_APP_DEMO_ADMIN_ENABLED;
  return flag === "true";
}

function getSupabase() {
  const { url, key } = getSupabaseEnv();
  if (!url || !key) return null;

  try {
    return createClient(url, key);
  } catch {
    return null;
  }
}

function getLocalSession() {
  return readJson(LS_KEYS.session, null);
}
function setLocalSession(session) {
  writeJson(LS_KEYS.session, session);
}
function clearLocalSession() {
  window.localStorage.removeItem(LS_KEYS.session);
}
function getLocalUsers() {
  return readJson(LS_KEYS.users, []);
}
function setLocalUsers(users) {
  writeJson(LS_KEYS.users, users);
}
function getLocalRequests() {
  return readJson(LS_KEYS.requests, []);
}
function setLocalRequests(reqs) {
  writeJson(LS_KEYS.requests, reqs);
}
function getLocalFees() {
  return readJson(LS_KEYS.fees, { baseFee: 25, perMile: 2.0, afterHoursMultiplier: 1.25 });
}
function setLocalFees(fees) {
  writeJson(LS_KEYS.fees, fees);
}

function getDemoAdminSession() {
  return readJson(LS_KEYS.demoAdminSession, null);
}
function setDemoAdminSession(session) {
  writeJson(LS_KEYS.demoAdminSession, session);
}
function clearDemoAdminSession() {
  window.localStorage.removeItem(LS_KEYS.demoAdminSession);
}

async function supaGetUserRole(supabase, userId, email) {
  try {
    const { data, error } = await supabase.from("profiles").select("role,approved").eq("id", userId).maybeSingle();

    // IMPORTANT:
    // Do not silently downgrade to role='user' on read errors. That masks the true cause (often RLS),
    // and incorrectly blocks real admins.
    if (error) {
      throw new Error(error.message || "Could not read profiles.role for current user.");
    }

    if (!data) {
      // Try to self-create a profile row if policies allow (id must equal auth.uid()).
      const { error: insertError } = await supabase.from("profiles").insert({ id: userId, email, role: "user", approved: true });
      if (insertError) {
        throw new Error(
          insertError.message || "Profile row is missing and could not be created. Check profiles table schema and RLS policies."
        );
      }
      return { role: "user", approved: true };
    }

    return { role: data.role || "user", approved: data.approved ?? true };
  } catch (e) {
    // Bubble up a useful message for UI to present.
    throw new Error(
      e?.message ||
        "Could not verify your role. Ensure a public.profiles row exists with id = auth.uid() and role = 'admin', and that RLS permits select."
    );
  }
}

async function supaGetProfile(supabase, userId, email) {
  try {
    const { data, error } = await supabase.from("profiles").select("id,email,role,approved,profile").eq("id", userId).maybeSingle();
    if (error) throw error;
    if (!data) {
      // Create a default profile row if missing; policies should allow self-insert by id=auth.uid().
      const { data: inserted, error: insertError } = await supabase
        .from("profiles")
        .insert({ id: userId, email, role: "user", approved: true })
        .select("id,email,role,approved,profile")
        .maybeSingle();
      if (insertError) throw insertError;
      return inserted || null;
    }
    return data;
  } catch (e) {
    // Let caller decide how to surface errors.
    throw new Error(e?.message || "Could not load profile.");
  }
}

/**
 * PUBLIC_INTERFACE
 */
/**
 * Standalone helpers (requested for debug instrumentation).
 * These are additive and simply call through to `dataService` so existing imports continue working.
 */

// PUBLIC_INTERFACE
export async function getCurrentSession() {
  /** Resolves { session, userId } for the current auth session (userId null when not signed in / not configured). */
  const { session, user } = await dataService.getCurrentSession();
  return { session, userId: user?.id || null };
}

// PUBLIC_INTERFACE
export async function getCurrentProfile() {
  /** Resolves { role, full_name } for the current user or null if not found / not signed in / not configured. */
  const p = await dataService.getCurrentProfile();
  if (!p) return null;
  return { role: p.role || null, full_name: p.full_name || null };
}

export const dataService = {
  /** Admin facade: users, approvals, requests, fees (Supabase optional). */

  // PUBLIC_INTERFACE
  isDemoEnabled,

  // PUBLIC_INTERFACE
  createDemoAdminSession() {
    /** Creates and persists the Demo Admin session. Idempotent. Only sets if demo mode is enabled. */
    if (!isDemoEnabled()) throw new Error("Demo Admin mode is not enabled.");
    const session = { ...DEMO_ADMIN };
    setDemoAdminSession(session);
    return session;
  },

  // PUBLIC_INTERFACE
  async getCurrentSession() {
    /**
     * Returns the current auth session and user.
     *
     * Behavior:
     * - In demo mode: reads `admin_session` from localStorage and returns it as authenticated.
     * - In Supabase mode: returns Supabase auth session and user.
     * - Otherwise: returns { session: null, user: null }.
     *
     * NOTE: This method is used by the admin auth gate; keep the shape stable.
     */
    if (isDemoEnabled()) {
      const demoSession = getDemoAdminSession();
      if (!demoSession) return { session: null, user: null };
      // Use a minimal "session-like" object plus a "user-like" object.
      return {
        session: { user: demoSession },
        user: demoSession,
      };
    }

    const supabase = getSupabase();
    if (!supabase) return { session: null, user: null };

    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message || "Could not load session.");

    const session = data?.session || null;
    const user = session?.user || null;
    return { session, user };
  },

  // PUBLIC_INTERFACE
  async getCurrentProfile() {
    /**
     * Fetches the current user's profile.
     *
     * Behavior:
     * - In demo mode: returns the demo admin profile (role='admin').
     * - In Supabase mode: fetches from `public.profiles` where id = auth.uid().
     * - Otherwise: returns null.
     */
    if (isDemoEnabled()) {
      const demoSession = getDemoAdminSession();
      if (!demoSession) return null;
      return { id: demoSession.id, role: "admin", full_name: demoSession.full_name || "Demo Admin", email: demoSession.email };
    }

    const supabase = getSupabase();
    if (!supabase) return null;

    const { session, user } = await this.getCurrentSession();
    if (!session || !user) return null;

    // IMPORTANT: Fetch by uid explicitly (not by email) to match RLS policies and the requirement.
    const { data, error } = await supabase.from("profiles").select("id,role,full_name").eq("id", user.id).maybeSingle();

    if (error) throw new Error(error.message || "Could not load profile.");
    return data ? { id: data.id, role: data.role || null, full_name: data.full_name || null } : null;
  },

  // PUBLIC_INTERFACE
  async createRequest({ user, vehicle, issueDescription, contact }) {
    /**
     * Admin creates a new request for a customer/user.
     * Always set status='open', never send 'id', only valid/null UUIDs for optional fields.
     */
    ensureSeedData();
    const supabase = getSupabase();
    const nowIso = new Date().toISOString();
    const request = {
      id: uid("req"),
      createdAt: nowIso,
      userId: user.id,
      userEmail: user.email,
      vehicle,
      issueDescription,
      contact,
      status: "open",
      assignedMechanicId: null,
      assignedMechanicEmail: null,
      notes: [],
    };

    if (supabase) {
      const insertPayload = {
        created_at: nowIso,
        user_id: user.id,
        user_email: user.email,
        vehicle,
        issue_description: issueDescription,
        contact,
        status: "open",
        assigned_mechanic_id: null,
        assigned_mechanic_email: null,
        notes: [],
      };
      const { data, error } = await supabase.from("requests").insert(insertPayload).select().maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) throw new Error("Failed to insert request.");

      return {
        id: data.id,
        createdAt: data.created_at,
        userId: data.user_id,
        userEmail: data.user_email,
        vehicle: data.vehicle,
        issueDescription: data.issue_description,
        contact: data.contact,
        status: data.status,
        assignedMechanicId: data.assigned_mechanic_id,
        assignedMechanicEmail: data.assigned_mechanic_email,
        notes: data.notes || [],
      };
    }

    // In mock mode, assign a custom string ID.
    const all = getLocalRequests();
    setLocalRequests([request, ...all]);
    return request;
  },

  // PUBLIC_INTERFACE
  async login(email, password) {
    /**
     * Login behavior:
     * - In demo mode: accept only the demo credentials and persist `admin_session`.
     * - In Supabase mode: use supabase.auth.signInWithPassword.
     * - In mock mode: use seeded local users + rrqa.session.
     */
    ensureSeedData();

    if (isDemoEnabled()) {
      const normalized = (email || "").trim().toLowerCase();
      if (normalized !== DEMO_CREDENTIALS.email.toLowerCase() || password !== DEMO_CREDENTIALS.password) {
        throw new Error(
          `Demo mode is enabled. Use ${DEMO_CREDENTIALS.email} / ${DEMO_CREDENTIALS.password} or click "Login as Demo Admin".`
        );
      }
      const session = { ...DEMO_ADMIN };
      setDemoAdminSession(session);
      return { id: session.id, email: session.email, role: "admin", full_name: session.full_name };
    }

    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      const user = data.user;
      const roleInfo = await supaGetUserRole(supabase, user.id, user.email);
      return { id: user.id, email: user.email, role: roleInfo.role, approved: roleInfo.approved };
    }

    const users = getLocalUsers();
    const match = users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!match) throw new Error("Invalid email or password.");
    setLocalSession({ userId: match.id });
    return { id: match.id, email: match.email, role: match.role, approved: match.approved };
  },

  // PUBLIC_INTERFACE
  async logout() {
    /**
     * Logout behavior:
     * - In demo mode: clears demo admin session
     * - In Supabase mode: signs out supabase
     * - In mock mode: clears rrqa.session
     */
    if (isDemoEnabled()) {
      clearDemoAdminSession();
      return;
    }

    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut();
      return;
    }
    clearLocalSession();
  },

  // PUBLIC_INTERFACE
  async getCurrentUser() {
    /**
     * Returns the currently authenticated user.
     *
     * Behavior:
     * - In demo mode: returns demo admin if `admin_session` exists.
     * - In Supabase mode: returns Supabase user with roleInfo.
     * - In mock mode: reads rrqa.session and maps to local user.
     */
    ensureSeedData();

    if (isDemoEnabled()) {
      const demoSession = getDemoAdminSession();
      if (!demoSession) return null;
      return { id: demoSession.id, email: demoSession.email, role: "admin", approved: true, full_name: demoSession.full_name };
    }

    const supabase = getSupabase();
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) return null;
      const roleInfo = await supaGetUserRole(supabase, user.id, user.email);
      return { id: user.id, email: user.email, role: roleInfo.role, approved: roleInfo.approved };
    }

    const session = getLocalSession();
    if (!session?.userId) return null;
    const users = getLocalUsers();
    const u = users.find((x) => x.id === session.userId);
    if (!u) return null;
    return { id: u.id, email: u.email, role: u.role, approved: u.approved };
  },

  // PUBLIC_INTERFACE
  async listUsers() {
    ensureSeedData();
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase.from("profiles").select("id,email,role,approved,profile").order("email", { ascending: true });
      if (error) throw new Error(error.message);
      return (data || []).map((u) => ({ id: u.id, email: u.email, role: u.role, approved: u.approved, profile: u.profile }));
    }

    return getLocalUsers().map((u) => ({ id: u.id, email: u.email, role: u.role, approved: u.approved, profile: u.profile }));
  },

  // PUBLIC_INTERFACE
  async approveMechanic(userId) {
    ensureSeedData();
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.from("profiles").update({ approved: true, role: "approved_mechanic" }).eq("id", userId);
      if (error) throw new Error(error.message);
      return true;
    }

    const users = getLocalUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx < 0) throw new Error("User not found.");
    users[idx] = { ...users[idx], approved: true, role: "approved_mechanic" };
    setLocalUsers(users);
    return true;
  },

  // PUBLIC_INTERFACE
  async listRequests() {
    ensureSeedData();
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase.from("requests").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []).map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        userId: r.user_id,
        userEmail: r.user_email,
        vehicle: r.vehicle,
        issueDescription: r.issue_description,
        contact: r.contact,
        status: r.status,
        assignedMechanicId: r.assigned_mechanic_id,
        assignedMechanicEmail: r.assigned_mechanic_email,
        notes: r.notes || [],
      }));
    }

    return getLocalRequests().slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  // PUBLIC_INTERFACE
  async updateRequest(requestId, patch) {
    ensureSeedData();
    const supabase = getSupabase();
    if (supabase) {
      const update = {};
      if (patch.status !== undefined) update.status = patch.status;
      if (patch.assignedMechanicId !== undefined) update.assigned_mechanic_id = patch.assignedMechanicId;
      if (patch.assignedMechanicEmail !== undefined) update.assigned_mechanic_email = patch.assignedMechanicEmail;
      const { error } = await supabase.from("requests").update(update).eq("id", requestId);
      if (error) throw new Error(error.message);
      return true;
    }

    const all = getLocalRequests();
    const idx = all.findIndex((r) => r.id === requestId);
    if (idx < 0) throw new Error("Request not found.");
    all[idx] = { ...all[idx], ...patch };
    setLocalRequests(all);
    return true;
  },

  // PUBLIC_INTERFACE
  async getFees() {
    ensureSeedData();
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase.from("fees").select("*").eq("id", "default").maybeSingle();
      if (error) return { baseFee: 25, perMile: 2.0, afterHoursMultiplier: 1.25 };
      if (!data) return { baseFee: 25, perMile: 2.0, afterHoursMultiplier: 1.25 };
      return { baseFee: data.base_fee, perMile: data.per_mile, afterHoursMultiplier: data.after_hours_multiplier };
    }
    return getLocalFees();
  },

  // PUBLIC_INTERFACE
  async setFees(fees) {
    ensureSeedData();
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.from("fees").upsert({
        id: "default",
        base_fee: fees.baseFee,
        per_mile: fees.perMile,
        after_hours_multiplier: fees.afterHoursMultiplier,
      });
      if (error) throw new Error(error.message);
      return true;
    }
    setLocalFees(fees);
    return true;
  },

  // PUBLIC_INTERFACE
  isSupabaseConfigured,

  // PUBLIC_INTERFACE
  getSupabaseClient() {
    /** Returns a Supabase client when configured, otherwise null (keeps mock/localStorage mode working). */
    return getSupabase();
  },

  // PUBLIC_INTERFACE
  async getMyProfile() {
    /**
     * Loads the currently logged-in user's profile row from `public.profiles` (id = auth.uid()).
     * Returns null when not authenticated or when Supabase isn't configured.
     */
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return null;

    return await supaGetProfile(supabase, user.id, user.email);
  },
};
