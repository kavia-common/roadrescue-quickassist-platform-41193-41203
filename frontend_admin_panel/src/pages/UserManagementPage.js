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
  const [notice, setNotice] = useState("");
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

  const approve = async (id) => {
    setBusyId(id);
    setError("");
    setNotice("");
    try {
      const result = await dataService.approveMechanic(id);

      // If approveMechanic returns (it didn't throw), it's a success. It also tells us where it persisted.
      if (result?.persisted === "supabase") {
        const retryNote = result?.retried ? " (retried once after schema cache refresh)" : "";
        setNotice(`Approved and persisted to Supabase${retryNote}.`);
      } else {
        // This path is rare because the demo-fallback cases throw with guidance,
        // but keep it defensive in case future changes return demo result without throwing.
        setNotice("Approved in demo/local storage (not persisted to Supabase).");
      }

      await load();
    } catch (e) {
      // The data layer uses explicit error messages to indicate demo fallback vs real failure.
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
        {notice ? <div className="alert alert-info">{notice}</div> : null}
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
