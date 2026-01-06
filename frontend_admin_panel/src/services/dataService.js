import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "../theme";

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

function getSupabase() {
  if (!isSupabaseConfigured()) return null;
  try {
    return createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_KEY);
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

// PUBLIC_INTERFACE
export const dataService = {
  /** Admin facade: users, approvals, requests, fees (Supabase optional). */

  // PUBLIC_INTERFACE
  async login(email, password) {
    ensureSeedData();
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
};
