import React, { useEffect, useState } from "react";
import { Card } from "../components/ui/Card";
import { Table } from "../components/ui/Table";
import { Button } from "../components/ui/Button";
import { dataService } from "../services/dataService";

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

  const load = async () => {
    setError("");
    try {
      const list = await dataService.listUsers();
      setRows(list);
    } catch (e) {
      setError(e.message || "Could not load users.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  // PUBLIC_INTERFACE
  const onApprove = async (userId) => {
    /** Approves a mechanic by updating `public.profiles` and then refreshes the list. */
    setError("");
    setBusyId(userId);

    // Snapshot for rollback in case the Supabase update fails.
    const prevRows = rows;

    try {
      // Optimistic UI: immediately reflect "Approved" and hide/disable button
      // while the network request is in-flight.
      setRows((curr) =>
        curr.map((r) =>
          r.id !== userId
            ? r
            : {
                ...r,
                approved: true,
                mechanic_status: "approved",
                approved_at: new Date().toISOString(),
              }
        )
      );

      await dataService.approveMechanic(userId);

      // Refresh list after success to ensure we show the latest server state.
      await load();
    } catch (e) {
      // Roll back optimistic state on failure.
      setRows(prevRows);
      setError(e.message || "Could not approve mechanic.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="container">
      <div className="hero">
        <h1 className="h1">User Management</h1>
        <p className="lead">Approve mechanics before they can fully operate.</p>
      </div>

      <Card title="Users" subtitle="Mechanics with approved=false should be reviewed and approved.">
        {error ? <div className="alert alert-error">{error}</div> : null}
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
                  <Button size="sm" onClick={() => onApprove(r.id)} disabled={busyId === r.id}>
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
