import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { dataService } from "../services/dataService";
import { useSupabaseRealtimeRefresh } from "../hooks/useSupabaseRealtimeRefresh";

// PUBLIC_INTERFACE
export function DashboardPage() {
  /** Admin KPIs dashboard. */
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const [u, r] = await Promise.all([dataService.listUsers(), dataService.listRequests()]);
    setUsers(u);
    setRequests(r);
  }, []);

  const { refresh, lastRefreshAt, realtimeStatus, realtimeError } = useSupabaseRealtimeRefresh({
    tables: [{ table: "profiles" }, { table: "requests" }],
    onChange: load,
    pollIntervalMs: 15000,
    enableRealtime: true,
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await load();
      } catch (e) {
        if (mounted) setError(e.message || "Could not load dashboard.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [load]);

  const kpis = useMemo(() => {
    const totalUsers = users.filter((u) => u.role === "user").length;
    const totalMechanics = users.filter((u) => u.role === "mechanic").length;
    const pendingMechanics = users.filter((u) => u.role === "mechanic" && u.mechanic_status === "pending").length;

    // Requests are normalized in dataService; OPEN/ASSIGNED/IN_PROGRESS are active.
    const activeRequests = requests.filter((r) => ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(r.status)).length;
    const completedRequests = requests.filter((r) => r.status === "COMPLETED").length;
    return { totalUsers, totalMechanics, pendingMechanics, activeRequests, completedRequests };
  }, [users, requests]);

  return (
    <div className="container">
      <div className="hero" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 className="h1">Dashboard</h1>
          <p className="lead">Quick view of platform activity.</p>
          <div style={{ color: "var(--muted)", fontWeight: 800, fontSize: 12 }}>
            Live updates: {realtimeStatus}
            {lastRefreshAt ? ` • Last refresh: ${lastRefreshAt.toLocaleTimeString()}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button variant="secondary" size="sm" onClick={refresh}>
            Refresh
          </Button>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {realtimeError ? <div className="alert alert-error">Realtime: {realtimeError}</div> : null}

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
          <div className="kpi-label">Pending mechanics</div>
          <div className="kpi-value">{kpis.pendingMechanics}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Active requests</div>
          <div className="kpi-value">{kpis.activeRequests}</div>
        </div>
      </div>

      <div className="grid4" style={{ marginBottom: 12 }}>
        <div className="kpi">
          <div className="kpi-label">Completed requests</div>
          <div className="kpi-value">{kpis.completedRequests}</div>
        </div>
      </div>

      <Card title="Notes" subtitle="This MVP uses manual forms and basic persistence (mock or Supabase).">
        <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text)" }}>
          <li style={{ margin: "8px 0" }}>
            Approve mechanics in <strong>Users</strong>.
          </li>
          <li style={{ margin: "8px 0" }}>
            Manage statuses and reassignment in <strong>Requests</strong>.
          </li>
          <li style={{ margin: "8px 0" }}>
            Set fee parameters in <strong>Fees</strong>.
          </li>
        </ul>
      </Card>
    </div>
  );
}
