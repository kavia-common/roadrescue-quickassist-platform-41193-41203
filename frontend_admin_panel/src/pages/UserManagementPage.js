import React, { useEffect, useState } from "react";
import { Card } from "../components/ui/Card";
import { Table } from "../components/ui/Table";
import { Button } from "../components/ui/Button";
import { dataService } from "../services/dataService";

function roleLabel(role, approved) {
  if (role === "mechanic") return approved ? "mechanic (approved)" : "mechanic (pending)";
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

  const approve = async (id) => {
    setBusyId(id);
    try {
      await dataService.approveMechanic(id);
      await load();
    } catch (e) {
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
            { key: "role", header: "Role", render: (r) => roleLabel(r.role, r.approved) },
            { key: "approved", header: "Approved", render: (r) => (r.approved ? "Yes" : "No") },
            {
              key: "action",
              header: "Action",
              render: (r) =>
                ((r.role === "mechanic" && !r.approved) || r.role === "approved_mechanic") ? (
                  r.role === "approved_mechanic" ? (
                    <span style={{ color: "var(--muted)", fontWeight: 800 }}>Already approved</span>
                  ) : (
                    <Button size="sm" onClick={() => approve(r.id)} disabled={busyId === r.id}>
                      {busyId === r.id ? "Approving..." : "Approve"}
                    </Button>
                  )
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
