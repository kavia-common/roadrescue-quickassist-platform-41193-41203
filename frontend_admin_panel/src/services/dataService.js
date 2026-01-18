import { getSupabaseClient, isSupabaseConfigured as isSupabaseConfiguredShared } from "../integrations/supabase/client";
import { normalizeStatus } from "./statusUtils";

const LS_KEYS = {
  session: "rrqa.session",
  users: "rrqa.users",
  requests: "rrqa.requests",
  fees: "rrqa.fees",
  seeded: "rrqa.seeded",
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

  // Mock-mode seed data only (NO admin seed; admin must authenticate via Supabase in Supabase mode).
  const users = [
    { id: uid("u"), email: "user@example.com", password: "password123", role: "user", approved: true },
    {
      id: uid("m"),
      email: "mech@example.com",
      password: "password123",
      role: "mechanic",
      // Source of truth for mechanic approval workflow:
      mechanic_status: "pending",
      // Legacy field (kept only for mock/demo compatibility):
      approved: false,
      profile: { name: "Alex Mechanic", serviceArea: "Downtown" },
    },
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

function getSupabase() {
  // Centralized singleton Supabase client.
  return getSupabaseClient();
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

async function supaGetUserRole(supabase, userId, email) {
  try {
    const { data, error } = await supabase.from("profiles").select("role,approved").eq("id", userId).maybeSingle();
    if (error) return { role: "user", approved: true };
    if (!data) {
      await supabase.from("profiles").insert({ id: userId, email, role: "user", approved: true });
      return { role: "user", approved: true };
    }
    return { role: data.role || "user", approved: data.approved ?? true };
  } catch {
    return { role: "user", approved: true };
  }
}

async function supaGetProfile(supabase, userId, email) {
  try {
    // IMPORTANT:
    // - Do NOT select non-existent columns like `profile` or nested `profiles.profile`.
    // - Always select explicit columns that exist on `public.profiles`.
    const profileSelect =
      "id, full_name, email, phone, role, status, mechanic_status, specialization, service_area, approved, approved_at, created_at";

    const { data, error } = await supabase.from("profiles").select(profileSelect).eq("id", userId).maybeSingle();
    if (error) throw error;

    if (!data) {
      // Create a default profile row if missing; policies should allow self-insert by id=auth.uid().
      const { data: inserted, error: insertError } = await supabase
        .from("profiles")
        .insert({ id: userId, email, role: "user", approved: true })
        .select(profileSelect)
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
     *
     * NOTE: This is NOT used for admin gating (admin gating is public.admins only).
     */
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
     * Supabase-only auth enforcement (when configured):
     * - If Supabase env vars are present, we DO NOT fall back to local/mock auth.
     * - This ensures the admin can only log in via Supabase Auth.
     */
    ensureSeedData();
    const supabase = getSupabase();

    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message || "Invalid email or password.");

      const user = data.user;
      const roleInfo = await supaGetUserRole(supabase, user.id, user.email);
      return { id: user.id, email: user.email, role: roleInfo.role, approved: roleInfo.approved };
    }

    // Mock mode remains available only when Supabase is NOT configured.
    const users = getLocalUsers();
    const match = users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!match) throw new Error("Invalid email or password.");
    setLocalSession({ userId: match.id });
    return { id: match.id, email: match.email, role: match.role, approved: match.approved };
  },

  // PUBLIC_INTERFACE
  async signInWithGoogle() {
    /**
     * Starts a Google OAuth sign-in using Supabase.
     *
     * IMPORTANT:
     * - Requires Supabase dashboard config:
     *   Authentication -> Providers -> Google enabled, with valid client ID/secret.
     * - Requires allowed Redirect URLs to include:
     *   - ${REACT_APP_FRONTEND_URL}/auth/callback
     *
     * Behavior:
     * - In Supabase mode, this triggers a full-page redirect to Google.
     * - On return to /auth/callback, we route to /reset-password or / (existing behavior).
     * - AdminAuth also performs an auth/admin check and will redirect admin users to /admin/dashboard.
     */
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");

    const baseUrl = process.env.REACT_APP_FRONTEND_URL || window.location.origin;
    const redirectTo = `${String(baseUrl).replace(/\/$/, "")}/auth/callback`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (error) throw new Error(error.message || "Could not start Google sign-in.");
    return data;
  },

  // PUBLIC_INTERFACE
  async requestPasswordReset(email) {
    /**
     * Sends a Supabase password reset email.
     *
     * IMPORTANT:
     * - The redirect URL must be allowed in Supabase Auth → URL Configuration → Redirect URLs.
     * - The reset email link MUST return to a real frontend route.
     *
     * Env:
     * - REACT_APP_FRONTEND_URL should be set to the deployed frontend origin (e.g. https://admin.example.com)
     *   so the reset link returns to this app.
     */
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");

    const baseUrl = process.env.REACT_APP_FRONTEND_URL || window.location.origin;

    // IMPORTANT:
    // Supabase expects the app to handle auth callbacks. We route reset emails to /auth/callback
    // and then forward to /reset-password once Supabase has parsed tokens / code.
    const redirectTo = `${String(baseUrl).replace(/\/$/, "")}/auth/callback`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw new Error(error.message || "Could not start password reset.");
    return true;
  },

  // PUBLIC_INTERFACE
  async updatePassword(newPassword) {
    /**
     * Updates the current user's password (used after following a reset email link).
     */
    const supabase = getSupabase();
    if (!supabase) throw new Error("Supabase is not configured.");

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message || "Could not update password.");
    return true;
  },

  // PUBLIC_INTERFACE
  async logout() {
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
      // IMPORTANT: Approved select pattern:
      // - Do NOT select non-existent columns like `profile`.
      // - Always select explicit columns from `profiles`.
      const profileSelect =
        "id, full_name, email, phone, role, status, mechanic_status, specialization, service_area, approved, approved_at, created_at";

      const { data, error } = await supabase.from("profiles").select(profileSelect).order("email", { ascending: true });

      if (error) throw new Error(error.message);

      return (data || []).map((u) => ({
        id: u.id,
        email: u.email,
        full_name: u.full_name || null,
        phone: u.phone || null,
        role: u.role,
        status: u.status ?? null,
        mechanic_status: u.mechanic_status ?? null,
        specialization: u.specialization ?? null,
        service_area: u.service_area ?? null,
        approved: u.approved ?? false,
        approved_at: u.approved_at ?? null,
        created_at: u.created_at ?? null,
      }));
    }

    // Mock mode: keep legacy seeded shape, but include mechanic_status for the admin UI.
    return getLocalUsers().map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      // Preferred field for approval flow:
      mechanic_status: u.mechanic_status || (u.approved ? "approved" : "pending"),
      // Legacy field (kept for mock/demo compatibility):
      approved: u.approved,
      profile: u.profile,
    }));
  },

  // PUBLIC_INTERFACE
  async approveMechanic(userId) {
    /**
     * Admin approval (authoritative requirements):
     * - Use `public.profiles` as the only source of truth.
     * - Do NOT touch `role` (role is already 'mechanic').
     * - Run ONLY a single UPDATE setting mechanic_status='approved' (+ updated_at).
     *
     * Equivalent SQL:
     *   UPDATE public.profiles
     *   SET mechanic_status = 'approved', updated_at = now()
     *   WHERE id = <mechanic_user_id>;
     */
    ensureSeedData();
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase
        .from("profiles")
        .update({ mechanic_status: "approved", updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (error) throw new Error(error.message);
      return true;
    }

    // Mock mode: emulate the same column semantics as Supabase mode.
    const users = getLocalUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx < 0) throw new Error("User not found.");

    // Keep legacy `approved` in mock data for backwards compatibility, but set mechanic_status as the primary flag.
    users[idx] = { ...users[idx], mechanic_status: "approved", approved: true };
    setLocalUsers(users);
    return true;
  },

  // PUBLIC_INTERFACE
  async listRequests() {
    ensureSeedData();
    const supabase = getSupabase();
    if (supabase) {
      /**
       * IMPORTANT (alternate query pattern):
       * - Do NOT rely on PostgREST relationship projections like `profiles (...)`.
       * - Instead: select explicit fields from `requests`, then "manual join" profiles by user_id.
       *
       * This works even if no foreign key / relationship is established between requests.user_id and profiles.id.
       */
      const requestSelect =
        "id, status, created_at, user_id, user_email, vehicle, issue_description, contact, assigned_mechanic_id, assigned_mechanic_email, notes";

      const { data: rows, error } = await supabase.from("requests").select(requestSelect).order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      const requestRows = rows || [];

      // Manual join: fetch profiles for the distinct request user IDs.
      // If RLS prevents reading profiles, we fall back to stored user_email on requests.
      const userIds = Array.from(new Set(requestRows.map((r) => r.user_id).filter(Boolean)));

      let profilesById = new Map();
      if (userIds.length) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, email, full_name, phone")
          .in("id", userIds);

        if (profilesError) {
          // Fail soft: admin pages still render using requests.user_email when profiles can't be read.
          console.warn("[dataService.listRequests] Could not load profiles for join; falling back to requests.user_email:", profilesError?.message || profilesError);
        } else {
          profilesById = new Map((profiles || []).map((p) => [p.id, p]));
        }
      }

      // Return shape MUST match frontend expectations used across Dashboard/Requests/Analytics pages.
      return requestRows.map((r) => {
        const profile = profilesById.get(r.user_id) || null;

        return {
          id: r.id,
          createdAt: r.created_at,
          userId: r.user_id,
          // Prefer profile email if available; fallback to stored user_email.
          userEmail: profile?.email || r.user_email,
          vehicle: r.vehicle,
          issueDescription: r.issue_description,
          contact: r.contact,
          status: normalizeStatus(r.status),
          assignedMechanicId: r.assigned_mechanic_id,
          assignedMechanicEmail: r.assigned_mechanic_email,
          notes: r.notes || [],
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
    const defaultFees = { baseFee: 25, perMile: 2.0, afterHoursMultiplier: 1.25 };

    // Always keep a local copy so the UI can persist settings even if the Supabase `fees` table isn't created yet.
    const local = getLocalFees() || defaultFees;

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase.from("fees").select("*").eq("id", "default").maybeSingle();
        if (error || !data) return local;

        const fromDb = {
          baseFee: data.base_fee ?? local.baseFee,
          perMile: data.per_mile ?? local.perMile,
          afterHoursMultiplier: data.after_hours_multiplier ?? local.afterHoursMultiplier,
        };

        // Keep local cache in sync with what we successfully read.
        setLocalFees(fromDb);
        return fromDb;
      } catch {
        return local;
      }
    }

    return local;
  },

  // PUBLIC_INTERFACE
  async setFees(fees) {
    ensureSeedData();

    // Always persist locally so the admin sees the configured values immediately and they survive refresh in all modes.
    setLocalFees(fees);

    const supabase = getSupabase();
    if (supabase) {
      // Best-effort write to Supabase if the `fees` table exists; do not block the UI if it doesn't.
      const { error } = await supabase.from("fees").upsert({
        id: "default",
        base_fee: fees.baseFee,
        per_mile: fees.perMile,
        after_hours_multiplier: fees.afterHoursMultiplier,
      });

      if (error) {
        // Keep the local values (already saved) and surface a clear error for admins who expect DB persistence.
        throw new Error(
          `Could not persist fees to Supabase (local settings were saved). ${error.message || "Supabase error."}`
        );
      }
    }

    return true;
  },

  // PUBLIC_INTERFACE
  isSupabaseConfigured() {
    /** Returns true only when required REACT_APP_ Supabase env vars are present (React build-time). */
    return isSupabaseConfiguredShared();
  },

  // PUBLIC_INTERFACE
  getSupabaseClient() {
    /** Returns the singleton Supabase client when configured, otherwise null (keeps mock/localStorage mode working). */
    return getSupabase();
  },

  // PUBLIC_INTERFACE
  async getMyProfile() {
    /**
     * Loads the currently logged-in user's profile row from `public.profiles` (id = auth.uid()).
     * Returns null when not authenticated or when Supabase isn't configured.
     *
     * NOTE: This is NOT used for admin gating.
     */
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user) return null;

    return await supaGetProfile(supabase, user.id, user.email);
  },
};
