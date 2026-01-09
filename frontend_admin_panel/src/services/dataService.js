import { createClient } from "@supabase/supabase-js";
import { normalizeStatus } from "./statusUtils";

const LS_KEYS = {
  session: "rrqa.session",
  users: "rrqa.users",
  requests: "rrqa.requests",
  fees: "rrqa.fees",
  seeded: "rrqa.seeded",

  // Hardcoded DEMO bypass (explicitly not tied to Supabase/env).
  demoAdminSession: "rrqa.demo_admin_session",
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
    { id: uid("m"), email: "mech@example.com", password: "password123", role: "mechanic", approved: false, profile: { name: "Alex Mechanic", serviceArea: "Downtown" } },
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

/**
 * Hardcoded DEMO admin session helpers.
 * These are intentionally independent of Supabase/env.
 */
function getDemoAdminSession() {
  return readJson(LS_KEYS.demoAdminSession, null);
}
function setDemoAdminSession(session) {
  writeJson(LS_KEYS.demoAdminSession, session);
}
function clearDemoAdminSession() {
  window.localStorage.removeItem(LS_KEYS.demoAdminSession);
}

// PUBLIC_INTERFACE
function isDemoAdminActive() {
  /** Returns true when the app is currently in hardcoded DEMO admin mode. */
  const s = getDemoAdminSession();
  return Boolean(s && s.userId);
}

// PUBLIC_INTERFACE
function startDemoAdminSession() {
  /**
   * Enables hardcoded DEMO admin mode.
   * This bypasses Supabase auth/profile checks and guarantees an admin user for navigation.
   */
  const demoUser = { userId: "demo_admin", email: "demo-admin@roadrescue.local", role: "admin" };
  setDemoAdminSession(demoUser);
  return demoUser;
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

/**
 * Admin panel must not depend on `profiles.email` existing.
 * Some deployments intentionally omit it, and RLS should not require it for admin reads.
 *
 * This helper returns a stable "identifier" string for UI display purposes.
 */
function bestEffortUserIdentifier(row) {
  if (!row) return "unknown";
  // Prefer email when present, but fall back safely.
  const email = row.email || row.user_email || row.userEmail || null;
  if (email) return email;
  const display = row.display_name || row.displayName || row.full_name || row.fullName || null;
  if (display) return display;
  return row.id ? `user:${String(row.id).slice(0, 8)}` : "unknown";
}

async function supaGetUserRole(supabase, userId, email) {
  try {
    // IMPORTANT: don't require selecting email here; it may not exist in `profiles`.
    const { data, error } = await supabase.from("profiles").select("role,approved").eq("id", userId).maybeSingle();
    if (error) return { role: "user", approved: true };
    if (!data) {
      // Insert row without relying on an email column.
      // If an `email` column does exist, inserting it is fine; if not, Postgres will ignore unknown keys? (it won't)
      // So we only insert the minimal required columns here.
      await supabase.from("profiles").insert({ id: userId, role: "user", approved: true });
      return { role: "user", approved: true };
    }
    return { role: data.role || "user", approved: data.approved ?? true };
  } catch {
    return { role: "user", approved: true };
  }
}

async function supaGetProfile(supabase, userId) {
  try {
    // IMPORTANT:
    // - don't select email; schema may not have it.
    // - don't select `profile`; column does not exist in the canonical schema.
    const { data, error } = await supabase
      .from("profiles")
      .select("id,role,approved,display_name,full_name,phone,created_at")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      // Create a default profile row if missing; policies should allow self-insert by id=auth.uid().
      const { data: inserted, error: insertError } = await supabase
        .from("profiles")
        .insert({ id: userId, role: "user", approved: true })
        .select("id,role,approved,display_name,full_name,phone,created_at")
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
  async getCurrentSession() {
    /**
     * Returns the current Supabase auth session and user.
     * In mock mode (or when not authenticated), returns { session: null, user: null }.
     *
     * NOTE: This method is used by the admin auth gate; keep the shape stable.
     */
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
     * Fetches the current user's profile from `public.profiles` where id = auth.uid().
     * Returns a minimal shape: { id, role, full_name } (null when not authenticated / not configured).
     */
    const supabase = getSupabase();
    if (!supabase) return null;

    const { session, user } = await this.getCurrentSession();
    if (!session || !user) return null;

    // IMPORTANT: Fetch by uid explicitly (not by email) to match RLS policies and the requirement.
    const { data, error } = await supabase
      .from("profiles")
      .select("id,role,full_name,display_name")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw new Error(error.message || "Could not load profile.");
    return data ? { id: data.id, role: data.role || null, full_name: data.full_name || data.display_name || null } : null;
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
      // Prefer the "mechanic portal" schema (`requester_id`, `assigned_mechanic_id`, `submitted_at`, etc).
      // Fall back to legacy columns if present.
      const insertPayload = {
        created_at: nowIso, // legacy (safe if exists)
        submitted_at: nowIso, // newer schema
        requester_id: user.id,
        user_id: user.id, // legacy deployments
        user_email: user.email, // optional; may exist in some schemas

        // Vehicle: try JSON vehicle, plus allow flat columns if the DB expects those.
        vehicle,
        vehicle_make: vehicle?.make || null,
        vehicle_model: vehicle?.model || null,
        vehicle_year: vehicle?.year ? Number(vehicle.year) : null,
        vehicle_plate: vehicle?.plate || null,

        issue_description: issueDescription,
        contact,
        status: "open",

        mechanic_id: null,
        assigned_mechanic_id: null,
        assigned_mechanic_email: null,
        notes: [],
      };

      const { data, error } = await supabase.from("requests").insert(insertPayload).select().maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) throw new Error("Failed to insert request.");

      return {
        id: data.id,
        createdAt: data.submitted_at || data.created_at,
        userId: data.requester_id || data.user_id,
        userEmail: data.user_email || "",
        vehicle: data.vehicle || vehicle,
        issueDescription: data.issue_description || "",
        contact: data.contact || contact,
        status: data.status,
        assignedMechanicId: data.assigned_mechanic_id ?? data.mechanic_id ?? null,
        assignedMechanicEmail: data.assigned_mechanic_email ?? null,
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
    ensureSeedData();

    // If DEMO mode is active, don't allow normal credentials to override it implicitly.
    // Users can explicitly log out to exit demo mode.
    if (isDemoAdminActive()) {
      const s = getDemoAdminSession();
      return { id: s.userId, email: s.email, role: "admin", approved: true, demo: true };
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
    // Always clear DEMO mode as part of logout.
    clearDemoAdminSession();

    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut();
      return;
    }
    clearLocalSession();
  },

  // PUBLIC_INTERFACE
  async getCurrentUser() {
    ensureSeedData();

    // DEMO mode bypass: treat as authenticated admin regardless of Supabase/env.
    const demo = getDemoAdminSession();
    if (demo?.userId) {
      return { id: demo.userId, email: demo.email, role: "admin", approved: true, demo: true };
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
    /**
     * Admin list of profiles.
     *
     * IMPORTANT:
     * - Do not depend on `profiles.email` being present.
     * - Do not reference `profiles.profile` (non-existent in canonical schema).
     * - Admin RLS is expected to allow selecting all rows.
     */
    ensureSeedData();
    const supabase = getSupabase();
    if (supabase) {
      // Select only known columns. Avoid depending on any optional JSON `profile` column.
      // Also avoid hard failing on ordering by a column that may not exist in older schemas.
      const { data, error } = await supabase.from("profiles").select("id,role,approved,display_name,full_name,phone,created_at");
      if (error) throw new Error(error.message);

      const mapped = (data || []).map((u) => ({
        id: u.id,
        email: bestEffortUserIdentifier(u), // UI shows "Email", but we use best-effort identifier
        role: u.role,
        approved: u.approved,
        displayName: u.display_name || u.full_name || null,
        phone: u.phone || null,
        createdAt: u.created_at || null,
      }));

      // Prefer server-side ordering when available; otherwise do a stable client sort.
      mapped.sort((a, b) => {
        const ad = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bd = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (ad !== bd) return bd - ad;
        return String(a.email).localeCompare(String(b.email));
      });

      return mapped;
    }

    // Mock mode retains the existing local behavior (it still uses the demo's `profile` object).
    return getLocalUsers().map((u) => ({ id: u.id, email: u.email, role: u.role, approved: u.approved, profile: u.profile }));
  },

  // PUBLIC_INTERFACE
  async approveMechanic(userId) {
    /**
     * Approves a mechanic account.
     *
     * Supabase schema expectation (per requirements/RLS docs):
     * - `profiles.role` remains 'mechanic'
     * - `profiles.approved` becomes true
     *
     * Mock mode keeps the existing local behavior but aligns role value to 'mechanic'.
     */
    ensureSeedData();
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.from("profiles").update({ approved: true, role: "mechanic" }).eq("id", userId);
      if (error) throw new Error(error.message);
      return true;
    }

    const users = getLocalUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx < 0) throw new Error("User not found.");
    users[idx] = { ...users[idx], approved: true, role: "mechanic" };
    setLocalUsers(users);
    return true;
  },

  // PUBLIC_INTERFACE
  async listRequests() {
    /**
     * Lists all requests (admin view).
     *
     * IMPORTANT:
     * - Keep this aligned with the mechanic portal normalization so counts match.
     * - Support both schema variants:
     *   - newer: requester_id / assigned_mechanic_id / submitted_at, accepted_at...
     *   - older: user_id / mechanic_id / created_at
     */
    ensureSeedData();
    const supabase = getSupabase();
    if (supabase) {
      // Prefer submitted_at ordering; fall back to created_at if it's the only thing available.
      const { data, error } = await supabase.from("requests").select("*").order("submitted_at", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw new Error(error.message);

      return (data || []).map((r) => {
        const vehicle =
          r.vehicle ||
          (r.vehicle_make || r.vehicle_model || r.vehicle_year || r.vehicle_plate
            ? {
                make: r.vehicle_make || "",
                model: r.vehicle_model || "",
                year: r.vehicle_year != null ? String(r.vehicle_year) : "",
                plate: r.vehicle_plate || "",
              }
            : { make: "", model: "", year: "", plate: "" });

        // Map DB status values to canonical UI tokens.
        // Mechanic portal expects: open | assigned | in_progress | completed | cancelled
        const dbStatus = String(r.status || "open").toLowerCase();
        const statusToUi = {
          new: "OPEN",
          pending: "OPEN",
          open: "OPEN",
          assigned: "ASSIGNED",
          accepted: "ASSIGNED",
          arrived: "EN_ROUTE",
          in_progress: "WORKING",
          completed: "COMPLETED",
          cancelled: "CANCELLED",
        };

        // Prefer newer schema columns; fall back to older ones.
        const requesterId = r.requester_id ?? r.user_id ?? r.userId ?? null;
        const assignedMechanicId = r.assigned_mechanic_id ?? r.mechanic_id ?? r.assigned_mechanic_id ?? null;

        // IMPORTANT: user email may not exist; present a stable display string instead.
        const userIdentifier = bestEffortUserIdentifier({
          id: requesterId,
          user_email: r.user_email,
          userEmail: r.userEmail,
        });

        return {
          id: r.id,
          createdAt: r.submitted_at || r.created_at || r.createdAt,
          userId: requesterId,
          userEmail: userIdentifier,
          vehicle,
          issueDescription: r.issue_description || r.issueDescription || "",
          contact: r.contact || { name: "", phone: "" },
          status: normalizeStatus(statusToUi[dbStatus] || r.status),
          assignedMechanicId,
          assignedMechanicEmail: r.assigned_mechanic_email ?? null,
          notes: r.notes || [],
          address: r.address || null,
          latitude: r.latitude ?? null,
          longitude: r.longitude ?? null,
          assignedAt: r.accepted_at || r.assigned_at || null,
          completedAt: r.completed_at || null,
        };
      });
    }

    return getLocalRequests()
      .slice()
      .map((r) => ({ ...r, status: normalizeStatus(r.status) }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  // PUBLIC_INTERFACE
  async updateRequest(requestId, patch) {
    /**
     * Admin updates an existing request.
     *
     * IMPORTANT:
     * - Supabase expects `requests.status` as: open | assigned | in_progress | completed | cancelled
     * - UI uses canonical tokens: OPEN | ASSIGNED | EN_ROUTE | WORKING | COMPLETED
     * This function accepts either and writes the correct DB value.
     */
    ensureSeedData();
    const supabase = getSupabase();

    const mapUiStatusToDb = (raw) => {
      if (raw === undefined || raw === null) return undefined;
      const s = normalizeStatus(raw);
      const mapping = {
        OPEN: "open",
        ASSIGNED: "assigned",
        EN_ROUTE: "arrived",
        WORKING: "in_progress",
        COMPLETED: "completed",
        CANCELLED: "cancelled",
      };
      return mapping[s] || String(raw).toLowerCase();
    };

    if (supabase) {
      const update = {};

      if (patch.status !== undefined) update.status = mapUiStatusToDb(patch.status);

      // Support both schema variants for mechanic assignment.
      if (patch.assignedMechanicId !== undefined) {
        update.assigned_mechanic_id = patch.assignedMechanicId;
        update.mechanic_id = patch.assignedMechanicId;
      }
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
  isDemoAdminActive,

  // PUBLIC_INTERFACE
  async demoAdminLogin() {
    /**
     * Hardcoded, in-app DEMO login.
     * Guarantees an admin user and does not depend on env vars or Supabase.
     */
    startDemoAdminSession();
    const s = getDemoAdminSession();
    return { id: s.userId, email: s.email, role: "admin", approved: true, demo: true };
  },

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

    return await supaGetProfile(supabase, user.id);
  },
};
