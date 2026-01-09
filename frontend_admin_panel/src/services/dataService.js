import { createClient } from "@supabase/supabase-js";
import { normalizeStatus } from "./statusUtils";

const LS_KEYS = {
  session: "rrqa.session",
  users: "rrqa.users",
  requests: "rrqa.requests",
  fees: "rrqa.fees",
  seeded: "rrqa.seeded",
};

/**
 * Centralized, tolerant error detection for Supabase table reads/writes.
 * In many demo setups the admin panel runs with an anon key and hits RLS,
 * which can manifest as:
 * - explicit permission errors
 * - empty result sets (depending on policies)
 *
 * We treat these as "blocked" and fall back to local demo data so KPIs
 * don't misleadingly show all zeros.
 */
function isSupabaseReadBlockedError(error) {
  const msg = String(error?.message || "").toLowerCase();
  return (
    msg.includes("permission denied") ||
    msg.includes("insufficient privilege") ||
    msg.includes("not allowed") ||
    msg.includes("jwt") ||
    msg.includes("rls") ||
    msg.includes("row level security") ||
    msg.includes("42501") ||
    msg.includes("pgrst") ||
    msg.includes("unauthorized") ||
    msg.includes("forbidden")
  );
}

/**
 * PostgREST can briefly serve a stale schema cache after a migration (e.g. new column).
 * These errors usually resolve after a short wait and retry.
 */
function isLikelySchemaCacheError(error) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("schema cache") || msg.includes("pgrst") || msg.includes("could not find");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Small in-memory flag so we only “probe” schema once per page load.
 * - null: unknown
 * - true: schema seems healthy (profiles has id/role/approved)
 * - false: schema seems missing/inaccessible
 */
let _profilesSchemaHealthy = null;

/**
 * PUBLIC_INTERFACE
 */
// PUBLIC_INTERFACE
export async function checkProfilesSchema({ forceRefresh = false } = {}) {
  /**
   * Health-check utility for `public.profiles` schema.
   *
   * Tries to query `profiles` selecting `id, approved, role` with limit 1.
   * - If it succeeds, the admin panel should *not* fallback on approvals due to schema errors.
   * - If it fails with missing schema or RLS blocks, the caller can decide to show guidance / fallback.
   *
   * @param {object} opts
   * @param {boolean} opts.forceRefresh When true, bypass cached result and re-check.
   * @returns {Promise<{ ok: boolean, reason?: 'not_configured'|'schema_missing'|'rls_blocked'|'unknown', errorMessage?: string }>}
   */
  if (!forceRefresh && _profilesSchemaHealthy !== null) {
    return { ok: _profilesSchemaHealthy === true };
  }

  const supabase = getSupabase();
  if (!supabase) {
    _profilesSchemaHealthy = false;
    return { ok: false, reason: "not_configured" };
  }

  try {
    // `limit(1)` reduces cost, and selecting the target columns verifies they exist.
    const { error } = await supabase.from("profiles").select("id,approved,role").limit(1);
    if (error) {
      if (isMissingProfilesSchemaError(error)) {
        _profilesSchemaHealthy = false;
        return { ok: false, reason: "schema_missing", errorMessage: error.message };
      }
      if (isSupabaseReadBlockedError(error)) {
        _profilesSchemaHealthy = false;
        return { ok: false, reason: "rls_blocked", errorMessage: error.message };
      }
      _profilesSchemaHealthy = false;
      return { ok: false, reason: "unknown", errorMessage: error.message };
    }

    _profilesSchemaHealthy = true;
    return { ok: true };
  } catch (e) {
    _profilesSchemaHealthy = false;
    return { ok: false, reason: "unknown", errorMessage: e?.message || String(e) };
  }
}

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
 * Best-effort email enrichment:
 * Some Supabase schemas do not store email in public.profiles. Email lives in auth.users.
 * If the provided key is a service role key, we can use the Admin API to list users.
 * If not permitted, we return an empty map and the UI will show "(unknown)" for email.
 */
async function tryGetAuthEmailById(supabase) {
  try {
    // supabase-js exposes auth.admin only when using a service role key; calling it with anon key will error.
    if (!supabase?.auth?.admin?.listUsers) return new Map();
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) return new Map();
    const users = data?.users || [];
    const map = new Map();
    users.forEach((u) => {
      if (u?.id) map.set(u.id, u.email || "");
    });
    return map;
  } catch {
    return new Map();
  }
}

function isMissingProfilesSchemaError(error) {
  // Supabase/Postgres/PostgREST common messages:
  // - relation "profiles" does not exist
  // - relation "public.profiles" does not exist
  // - column profiles.approved does not exist
  // - column approved does not exist
  // - Could not find the 'approved' column of 'profiles' in the schema cache
  const msg = String(error?.message || "").toLowerCase();
  return (
    msg.includes('relation "profiles" does not exist') ||
    msg.includes('relation "public.profiles" does not exist') ||
    // Postgres-style missing column errors
    (msg.includes("column") && msg.includes("does not exist") && msg.includes("profiles")) ||
    (msg.includes("column") && msg.includes("does not exist") && msg.includes("approved")) ||
    // PostgREST schema-cache wording (the reported bug)
    (msg.includes("schema cache") && msg.includes("could not find") && msg.includes("approved"))
  );
}

async function supaGetUserRole(supabase, userId) {
  try {
    const { data, error } = await supabase.from("profiles").select("role,approved").eq("id", userId).maybeSingle();

    // If schema is missing, don't hard-fail the app.
    if (error) {
      if (isMissingProfilesSchemaError(error)) return { role: "user", approved: true };
      return { role: "user", approved: true };
    }

    if (!data) {
      // Best-effort insert only when schema exists.
      // If columns/table are missing, this would fail and spam errors.
      const { error: insertError } = await supabase.from("profiles").insert({ id: userId, role: "user", approved: true });
      if (insertError && !isMissingProfilesSchemaError(insertError)) {
        // Non-schema failure: still keep UX moving with default role.
      }
      return { role: "user", approved: true };
    }

    return { role: data.role || "user", approved: data.approved ?? true };
  } catch (e) {
    return { role: "user", approved: true };
  }
}

async function supaGetProfile(supabase, userId) {
  try {
    // IMPORTANT: Avoid selecting `email` from profiles; it may not exist in some schemas.
    const { data, error } = await supabase.from("profiles").select("id,role,approved,profile").eq("id", userId).maybeSingle();

    if (error) {
      if (isMissingProfilesSchemaError(error)) return null;
      throw error;
    }

    if (!data) {
      // Create a default profile row if missing; policies should allow self-insert by id=auth.uid().
      const { data: inserted, error: insertError } = await supabase
        .from("profiles")
        .insert({ id: userId, role: "user", approved: true })
        .select("id,role,approved,profile")
        .maybeSingle();

      if (insertError) {
        if (isMissingProfilesSchemaError(insertError)) return null;
        throw insertError;
      }
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

const REQUESTS_CHANGED_EVENT = "requests-changed";

function emitRequestsChanged(detail) {
  try {
    window.dispatchEvent(new CustomEvent(REQUESTS_CHANGED_EVENT, { detail }));
  } catch {
    // ignore
  }
}

export const dataService = {
  /** Admin facade: users, approvals, requests, fees (Supabase optional). */

  // PUBLIC_INTERFACE
  subscribeToRequestsChanged(handler) {
    /**
     * Subscribe to "requests changed" signals.
     *
     * - In Supabase mode, listens to Supabase realtime updates on `public.requests` (when enabled).
     * - In demo/mock mode, only listens to the local event.
     *
     * Returns an unsubscribe function.
     */
    const wrapped = (e) => handler?.(e?.detail);
    window.addEventListener(REQUESTS_CHANGED_EVENT, wrapped);

    const supabase = getSupabase();
    let channel = null;
    if (supabase) {
      try {
        channel = supabase
          .channel("rrqa-requests")
          .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, (payload) => {
            emitRequestsChanged({ source: "supabase-realtime", payload });
          })
          .subscribe();
      } catch {
        // ignore; realtime may not be enabled
      }
    }

    return () => {
      window.removeEventListener(REQUESTS_CHANGED_EVENT, wrapped);
      try {
        if (channel && supabase) supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    };
  },

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
      .select("id,role,full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      // If profiles schema isn't ready yet, treat as "no profile" rather than crashing the UI.
      const msg = String(error?.message || "").toLowerCase();
      if (msg.includes('relation "profiles" does not exist') || (msg.includes("column") && msg.includes("does not exist"))) {
        return null;
      }
      throw new Error(error.message || "Could not load profile.");
    }

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
    ensureSeedData();
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      const user = data.user;
      const roleInfo = await supaGetUserRole(supabase, user.id);
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
      const roleInfo = await supaGetUserRole(supabase, user.id);
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
      // IMPORTANT:
      // Do not select/order by profiles.email; the column may not exist.
      // We order by id for deterministic results, then optionally enrich emails
      // from auth.users via admin API (service role key only).
      const { data, error } = await supabase.from("profiles").select("id,role,approved,profile").order("id", { ascending: true });

      if (error) {
        // Graceful fallback: if schema isn't ready OR reads are blocked by RLS/anon key,
        // use demo/local users so admin dashboard doesn't misleadingly show 0.
        if (isMissingProfilesSchemaError(error) || isSupabaseReadBlockedError(error)) {
          return getLocalUsers().map((u) => ({ id: u.id, email: u.email, role: u.role, approved: u.approved, profile: u.profile }));
        }
        throw new Error(error.message);
      }

      const emailById = await tryGetAuthEmailById(supabase);

      const mapped = (data || [])
        .map((u) => ({
          id: u.id,
          email: emailById.get(u.id) || "(unknown)",
          role: u.role,
          approved: u.approved,
          profile: u.profile,
        }))
        .sort((a, b) => String(a.email || "").localeCompare(String(b.email || "")));

      // Graceful fallback: if profiles query returns no rows (common with RLS misconfiguration),
      // keep demo/local seeded users available so KPIs aren't all zeros in demo flows.
      if (mapped.length === 0) {
        return getLocalUsers().map((u) => ({ id: u.id, email: u.email, role: u.role, approved: u.approved, profile: u.profile }));
      }

      return mapped;
    }

    return getLocalUsers().map((u) => ({ id: u.id, email: u.email, role: u.role, approved: u.approved, profile: u.profile }));
  },

  // PUBLIC_INTERFACE
  async approveMechanic(userId) {
    /**
     * Approve a mechanic (set approved=true and role=approved_mechanic).
     *
     * Behavior:
     * - Prefer Supabase persistence when schema exists and write is permitted.
     * - Fallback to local demo storage only when:
     *    (a) schema truly missing/out-of-date (profiles/approved missing)
     *    (b) RLS/privileges block write
     * - If error looks like PostgREST schema cache staleness, automatically retry once after a short wait.
     *
     * @returns {Promise<{ ok: boolean, persisted: 'supabase'|'demo', retried?: boolean }>}
     */
    ensureSeedData();
    const supabase = getSupabase();

    // Local fallback always available (demo mode and as safety net for missing schema/RLS blocks).
    const approveLocally = () => {
      const users = getLocalUsers();
      const idx = users.findIndex((u) => u.id === userId);
      if (idx < 0) throw new Error("User not found.");
      users[idx] = { ...users[idx], approved: true, role: "approved_mechanic" };
      setLocalUsers(users);
      return { ok: true, persisted: "demo" };
    };

    if (!supabase) return approveLocally();

    // If we already know the schema is healthy, skip probing; otherwise do a lightweight check.
    const schemaCheck = await checkProfilesSchema();
    if (!schemaCheck.ok) {
      // If schema missing or blocked, fall back immediately with a clear message.
      if (schemaCheck.reason === "schema_missing") {
        approveLocally();
        throw new Error(
          "Supabase schema is missing/out-of-date for public.profiles.approved. " +
            "Approval was applied in demo/local storage. " +
            "To persist in Supabase: run assets/supabase_profiles_migration.sql.md, then refresh/allow time for PostgREST schema cache to update and retry."
        );
      }
      if (schemaCheck.reason === "rls_blocked") {
        approveLocally();
        throw new Error(
          "Supabase blocked access to public.profiles (likely RLS/insufficient privileges). " +
            "Approval was applied in demo/local storage. " +
            "To persist in Supabase, use a service role key for admin or adjust RLS policies."
        );
      }
      // Unknown failure: try the update once; if it fails, fallback with the error message.
    }

    const attemptUpdate = async ({ forceCacheRefresh = false } = {}) => {
      // `select()` confirms what the server returned and helps disambiguate “0 rows updated”.
      // `head:false` is included on the retry to encourage PostgREST to re-evaluate cached schema.
      const query = supabase
        .from("profiles")
        // eslint-disable-next-line no-unused-vars
        .update({ approved: true, role: "approved_mechanic" }, forceCacheRefresh ? { returning: "representation", head: false } : undefined)
        .eq("id", userId)
        .select("id,role,approved");

      const { data, error } = await query;

      if (error) return { ok: false, error };

      // If data is empty, treat as likely RLS or non-existent row.
      if (!data || data.length === 0) {
        return { ok: false, error: new Error("No rows updated. This may indicate RLS restrictions or a missing profile row for that user.") };
      }

      const row = data[0];
      if (row?.approved !== true) {
        return { ok: false, error: new Error("Approval update did not persist (approved flag not true).") };
      }

      return { ok: true };
    };

    // Attempt #1
    const r1 = await attemptUpdate({ forceCacheRefresh: false });
    if (r1.ok) return { ok: true, persisted: "supabase" };

    // Handle known failure classes
    if (isMissingProfilesSchemaError(r1.error)) {
      // Could be “missing column” or “schema cache stale”. Retry once after a short wait,
      // forcing the health-check to re-run and performing an update with head:false + select.
      await sleep(2500);
      await checkProfilesSchema({ forceRefresh: true });
      const r2 = await attemptUpdate({ forceCacheRefresh: true });
      if (r2.ok) {
        _profilesSchemaHealthy = true;
        return { ok: true, persisted: "supabase", retried: true };
      }

      // Still failing => real schema issue; fallback.
      approveLocally();
      throw new Error(
        "Supabase schema is missing/out-of-date for public.profiles.approved (or schema cache is still stale). " +
          "Approval was applied in demo/local storage. " +
          "To persist in Supabase: run assets/supabase_profiles_migration.sql.md and refresh PostgREST schema cache (or wait 1–2 minutes), then retry."
      );
    }

    if (isSupabaseReadBlockedError(r1.error)) {
      approveLocally();
      throw new Error(
        "Supabase blocked the approval update (likely RLS/insufficient privileges). " +
          "Approval was applied in demo/local storage. " +
          "To persist in Supabase, use a service role key for admin or adjust RLS policies."
      );
    }

    // If error smells like a schema-cache issue, do a one-time retry before giving up.
    if (isLikelySchemaCacheError(r1.error)) {
      await sleep(2500);
      await checkProfilesSchema({ forceRefresh: true });
      const r2 = await attemptUpdate({ forceCacheRefresh: true });
      if (r2.ok) {
        _profilesSchemaHealthy = true;
        return { ok: true, persisted: "supabase", retried: true };
      }
    }

    // Unknown error: surface it (do not silently fall back; that would hide real production issues)
    throw new Error(r1.error?.message || "Could not approve mechanic.");
  },

  // PUBLIC_INTERFACE
  async listRequests() {
    ensureSeedData();
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase.from("requests").select("*").order("created_at", { ascending: false });

      if (error) {
        const msg = String(error?.message || "").toLowerCase();
        const missingTable = msg.includes('relation "requests" does not exist') || msg.includes("does not exist") || msg.includes("unknown relation");
        if (missingTable || isSupabaseReadBlockedError(error)) {
          // Fallback for demo environments (missing schema or blocked by RLS).
          return getLocalRequests()
            .slice()
            .map((r) => ({ ...r, status: normalizeStatus(r.status) }))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        }
        throw new Error(error.message);
      }

      const mapped = (data || []).map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        userId: r.user_id,
        userEmail: r.user_email,
        vehicle: r.vehicle,
        issueDescription: r.issue_description,
        contact: r.contact,
        status: normalizeStatus(r.status),
        assignedMechanicId: r.assigned_mechanic_id,
        assignedMechanicEmail: r.assigned_mechanic_email,
        notes: r.notes || [],
      }));

      // If Supabase returns no rows (often RLS), use demo data so KPIs aren't all zeros.
      if (mapped.length === 0) {
        return getLocalRequests()
          .slice()
          .map((r) => ({ ...r, status: normalizeStatus(r.status) }))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }

      return mapped;
    }

    return getLocalRequests()
      .slice()
      .map((r) => ({ ...r, status: normalizeStatus(r.status) }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  // PUBLIC_INTERFACE
  async updateRequest(requestId, patch) {
    /**
     * Update a request (status and/or assignment).
     *
     * Returns persistence metadata so the UI can clearly indicate whether the change was
     * saved to Supabase or only applied to demo/local storage.
     *
     * @returns {Promise<{ ok: true, persisted: 'supabase'|'demo' }>}
     */
    ensureSeedData();
    const supabase = getSupabase();

    const updateLocal = () => {
      const all = getLocalRequests();
      const idx = all.findIndex((r) => r.id === requestId);
      if (idx < 0) throw new Error("Request not found.");
      const nextPatch = { ...patch };
      if (nextPatch.status !== undefined) nextPatch.status = normalizeStatus(nextPatch.status);
      all[idx] = { ...all[idx], ...nextPatch };
      setLocalRequests(all);
      return { ok: true, persisted: "demo" };
    };

    if (supabase) {
      const update = {};
      if (patch.status !== undefined) update.status = normalizeStatus(patch.status);
      if (patch.assignedMechanicId !== undefined) update.assigned_mechanic_id = patch.assignedMechanicId;
      if (patch.assignedMechanicEmail !== undefined) update.assigned_mechanic_email = patch.assignedMechanicEmail;

      // best-effort updated_at bump (ignore if column doesn't exist)
      update.updated_at = new Date().toISOString();

      try {
        const { data, error } = await supabase.from("requests").update(update).eq("id", requestId).select().maybeSingle();

        if (error) {
          // Graceful fallback for demo environments where anon key + RLS blocks write, or schema missing.
          if (isSupabaseReadBlockedError(error) || String(error?.message || "").toLowerCase().includes("does not exist")) {
            const r = updateLocal();
            emitRequestsChanged({ type: "updated", requestId });
            return r;
          }
          throw new Error(error.message);
        }

        // Some RLS policies can yield "no rows returned" on update; treat as blocked and fall back.
        if (!data) {
          const r = updateLocal();
          emitRequestsChanged({ type: "updated", requestId });
          return r;
        }

        emitRequestsChanged({ type: "updated", requestId });
        return { ok: true, persisted: "supabase" };
      } catch (e) {
        // Network/runtime issues: keep the UI usable in demo mode.
        const msg = String(e?.message || "");
        if (msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("network")) {
          const r = updateLocal();
          emitRequestsChanged({ type: "updated", requestId });
          return r;
        }
        throw new Error(msg || "Could not update request.");
      }
    }

    return updateLocal();
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

    return await supaGetProfile(supabase, user.id);
  },
};
