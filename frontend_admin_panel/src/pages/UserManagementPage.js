import React, { useCallback, useEffect, useState } from "react";
import { Card } from "../components/ui/Card";
import { Table } from "../components/ui/Table";
import { Button } from "../components/ui/Button";
import { dataService } from "../services/dataService";
import { useSupabaseRealtimeRefresh } from "../hooks/useSupabaseRealtimeRefresh";

function roleLabel(role) {
  // `role` is NOT mutated by admin approval (authoritative instructions).
  return role;
}

function mechanicStatusLabel(status) {
  if (!status) return "—";
  if (status === "approved") return "Approved";
  if (status === "pending") return "Pending";
  return String(status);
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

      // After approval, reload from `public.profiles` to ensure the row reflects `mechanic_status='approved'`.
      // (The refresh hook may be time-based; load() is authoritative.)
      await load();

      // Still trigger a refresh tick so any other listeners/UI bits stay consistent.
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

      <Card title="Users" subtitle="Mechanics with status=pending should be reviewed and approved.">
        {error ? <div className="alert alert-error">{error}</div> : null}
        {realtimeError ? <div className="alert alert-error">Realtime: {realtimeError}</div> : null}

        <Table
          columns={[
            { key: "email", header: "Email" },
            { key: "role", header: "Role", render: (r) => roleLabel(r.role) },
            { key: "mechanic_status", header: "Mechanic Status", render: (r) => mechanicStatusLabel(r.mechanic_status) },
            {
              key: "action",
              header: "Action",
              render: (r) =>
                r.role === "mechanic" && r.mechanic_status !== "approved" ? (
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
