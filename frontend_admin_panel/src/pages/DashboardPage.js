import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/Card";
import { dataService } from "../services/dataService";

// PUBLIC_INTERFACE
export function DashboardPage() {
  /** Admin KPIs dashboard. */
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");

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

  const kpis = useMemo(() => {
    /**
     * KPI definitions:
     * - Total users: all non-mechanic accounts (customers + admins). This avoids showing 0 when only admin exists.
     * - Total mechanics: approved mechanics only (role=approved_mechanic OR (role=mechanic && approved=true)).
     * - Open requests: anything not COMPLETED (statuses are normalized in dataService).
     */
    const totalUsers = users.filter((u) => u.role !== "mechanic" && u.role !== "approved_mechanic").length;

    const totalMechanics = users.filter((u) => u.role === "approved_mechanic" || (u.role === "mechanic" && u.approved)).length;

    // requests are normalized in dataService; treat only COMPLETED as closed
    const openRequests = requests.filter((r) => r.status !== "COMPLETED").length;
    const completedRequests = requests.filter((r) => r.status === "COMPLETED").length;
    return { totalUsers, totalMechanics, openRequests, completedRequests };
  }, [users, requests]);

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
        <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text)" }}>
          <li style={{ margin: "8px 0" }}>Approve mechanics in <strong>Users</strong>.</li>
          <li style={{ margin: "8px 0" }}>Manage statuses and reassignment in <strong>Requests</strong>.</li>
          <li style={{ margin: "8px 0" }}>Set fee parameters in <strong>Fees</strong>.</li>
        </ul>
      </Card>
    </div>
  );
}
