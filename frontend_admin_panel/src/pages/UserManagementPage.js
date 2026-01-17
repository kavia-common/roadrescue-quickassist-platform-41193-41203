import React, { useCallback, useEffect, useState } from "react";
import { Card } from "../components/ui/Card";
import { Table } from "../components/ui/Table";
import { Button } from "../components/ui/Button";
import { dataService } from "../services/dataService";
import { useSupabaseRealtimeRefresh } from "../hooks/useSupabaseRealtimeRefresh";

function roleLabel(role) {
  if (role === "approved_mechanic") return "mechanic (approved)";
  return role;
}

// PUBLIC_INTERFACE
export function UserManagementPage() {
  /** Approve mechanics and view users. */
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setError("");
    const list = await dataService.listUsers();
    setRows(list);
  }, []);

  const { refresh, lastRefreshAt, realtimeStatus, realtimeError } = useSupabaseRealtimeRefresh({
    tables: [{ table: "profiles" }],
    onChange: load,
    pollIntervalMs: 15000,
    enableRealtime: true,
  });

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (e) {
        setError(e.message || "Could not load users.");
      }
    })();
  }, [load]);

  const approve = async (id) => {
    setBusyId(id);
    try {
      await dataService.approveMechanic(id);
      await refresh();
    } catch (e) {
      setError(e.message || "Could not approve mechanic.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="container">
      <div className="hero" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 className="h1">User Management</h1>
          <p className="lead">Approve mechanics before they can fully operate.</p>
          <div style={{ color: "var(--muted)", fontWeight: 800, fontSize: 12 }}>
            Live updates: {realtimeStatus}
            {lastRefreshAt ? ` • Last refresh: ${lastRefreshAt.toLocaleTimeString()}` : ""}
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh}>
          Refresh
        </Button>
      </div>

      <Card title="Users" subtitle="Mechanics with approved=false should be reviewed and approved.">
        {error ? <div className="alert alert-error">{error}</div> : null}
        {realtimeError ? <div className="alert alert-error">Realtime: {realtimeError}</div> : null}

        <Table
          columns={[
            { key: "email", header: "Email" },
            { key: "role", header: "Role", render: (r) => roleLabel(r.role) },
            { key: "approved", header: "Approved", render: (r) => (r.approved ? "Yes" : "No") },
            {
              key: "action",
              header: "Action",
              render: (r) =>
                r.role === "mechanic" && !r.approved ? (
                  <Button size="sm" onClick={() => approve(r.id)} disabled={busyId === r.id}>
                    {busyId === r.id ? "Approving..." : "Approve"}
                  </Button>
                ) : (
                  <span style={{ color: "var(--muted)", fontWeight: 800 }}>—</span>
                ),
            },
          ]}
          rows={rows}
          rowKey={(r) => r.id}
        />
      </Card>
    </div>
  );
}
