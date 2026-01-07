import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { dataService } from "../services/dataService";

// PUBLIC_INTERFACE
export function DashboardPage() {
  /** Admin KPIs dashboard. */
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");
  const [authChecking, setAuthChecking] = useState(true);

  // ✅ ADMIN AUTH GUARD
  // Uses existing Supabase-aware helpers (and stays compatible with mock mode).
  useEffect(() => {
    let mounted = true;

    (async () => {
      setAuthChecking(true);
      setError("");

      try {
        // In mock mode this will resolve { session: null, userId: null }.
        const { session, user } = await dataService.getCurrentSession();
        const isSupabaseMode = dataService.isSupabaseConfigured?.() && Boolean(dataService.getSupabaseClient?.());

        // If we are in Supabase mode, enforce admin role using profiles.
        // In mock mode, RequireAuth already gated access using the user prop in App.js.
        if (isSupabaseMode) {
          const uid = user?.id || session?.user?.id || null;
          if (!uid) {
            // Not signed in -> send to login route used by this admin panel.
            if (mounted) navigate("/login", { replace: true });
            return;
          }

          const profile = await dataService.getCurrentProfile();
          const role = profile?.role || null;

          // Block if not admin.
          if (role !== "admin") {
            alert("This portal is for admins only");
            await dataService.logout();
            if (mounted) navigate("/login", { replace: true });
            return;
          }
        }
      } catch (e) {
        // Minimal defensive error handling: show banner, but don't crash page.
        if (mounted) setError(e?.message || "Could not verify admin access.");
      } finally {
        if (mounted) setAuthChecking(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  // 🔹 DASHBOARD DATA LOADING
  useEffect(() => {
    let mounted = true;

    (async () => {
      setError("");
      try {
        const [u, r] = await Promise.all([dataService.listUsers(), dataService.listRequests()]);

        if (mounted) {
          setUsers(u);
          setRequests(r);
        }
      } catch (e) {
        if (mounted) setError(e.message || "Could not load dashboard.");
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // 🔹 KPI CALCULATIONS
  const kpis = useMemo(() => {
    const totalUsers = users.filter((u) => u.role === "user").length;
    const totalMechanics = users.filter((u) => u.role === "mechanic" || u.role === "approved_mechanic").length;
    const openRequests = requests.filter((r) => r.status !== "Completed").length;
    const completedRequests = requests.filter((r) => r.status === "Completed").length;

    return { totalUsers, totalMechanics, openRequests, completedRequests };
  }, [users, requests]);

  if (authChecking) {
    return (
      <div className="container">
        <div className="skeleton" role="status" aria-live="polite">
          Verifying admin access…
        </div>
      </div>
    );
  }

  // 🔹 UI
  return (
    <div className="container">
      <div className="hero">
        <h1 className="h1">Dashboard</h1>
        <p className="lead">Quick view of platform activity.</p>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="grid4" style={{ marginBottom: 12 }}>
        <div className="kpi">
          <div className="kpi-label">Total users</div>
          <div className="kpi-value">{kpis.totalUsers}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Total mechanics</div>
          <div className="kpi-value">{kpis.totalMechanics}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Open requests</div>
          <div className="kpi-value">{kpis.openRequests}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Completed</div>
          <div className="kpi-value">{kpis.completedRequests}</div>
        </div>
      </div>

      <Card title="Notes" subtitle="This MVP uses manual forms and basic persistence (mock or Supabase).">
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>
            Approve mechanics in <strong>Users</strong>.
          </li>
          <li>
            Manage statuses and reassignment in <strong>Requests</strong>.
          </li>
          <li>
            Set fee parameters in <strong>Fees</strong>.
          </li>
        </ul>
      </Card>
    </div>
  );
}
