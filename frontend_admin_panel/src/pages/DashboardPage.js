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
    const totalUsers = users.filter((u) => u.role === "user").length;
    const totalMechanics = users.filter((u) => u.role === "mechanic" || u.role === "approved_mechanic").length;
    const openRequests = requests.filter((r) => r.status !== "Completed").length;
    const completedRequests = requests.filter((r) => r.status === "Completed").length;
    return { totalUsers, totalMechanics, openRequests, completedRequests };
  }, [users, requests]);

  // Display demo session info in demo mode (non-intrusively)
  const showDemoDebug = dataService.isDemoEnabled?.() && window.localStorage.getItem(dataService.demoSessionKey);
  return (
    <div className="container">
      <div className="hero">
        <h1 className="h1">Dashboard</h1>
        <p className="lead">Quick view of platform activity.</p>
        {showDemoDebug && (
          <span
            style={{
              display: "inline-block",
              background: "rgba(245,158,11,0.09)",
              color: "#92400E",
              fontWeight: 700,
              fontSize: 13,
              padding: "4px 10px",
              borderRadius: 8,
              border: "1px solid rgba(245,158,11,0.24)",
              marginLeft: 12,
            }}
            title={`DEMO MODE: local demo admin session found in "${dataService.demoSessionKey}".`}
          >
            Demo Mode: Session Active
          </span>
        )}
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
