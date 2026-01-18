import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/Card";
import { Table } from "../components/ui/Table";
import { Button } from "../components/ui/Button";
import { dataService } from "../services/dataService";
import "./UserManagementPage.css";

function normalizeRole(role) {
  if (!role) return "user";
  // Existing data may contain "approved_mechanic" label.
  if (role === "approved_mechanic") return "mechanic";
  return role;
}

function roleLabel(role) {
  const r = normalizeRole(role);
  if (r === "admin") return "admin";
  if (r === "mechanic") return "mechanic";
  return "user";
}

// PUBLIC_INTERFACE
export function UserManagementPage() {
  /** Admin user management: view users and approve mechanics. */
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = async () => {
    setError("");
    try {
      const list = await dataService.listUsers();
      setRows(Array.isArray(list) ? list : []);
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

  const columns = useMemo(
    () => [
      { key: "email", header: "Email" },
      { key: "role", header: "Role", render: (r) => roleLabel(r.role) },
      { key: "approved", header: "Approved", render: (r) => (r.approved ? "Yes" : "No") },
      {
        key: "action",
        header: "Action",
        render: (r) =>
          normalizeRole(r.role) === "mechanic" && !r.approved ? (
            <Button size="sm" onClick={() => approve(r.id)} disabled={busyId === r.id}>
              {busyId === r.id ? "Approving..." : "Approve"}
            </Button>
          ) : (
            <span style={{ color: "var(--muted)", fontWeight: 800 }}>—</span>
          ),
      },
    ],
    [busyId]
  );

  return (
    <div className="container">
      <div className="hero">
        <h1 className="h1">User Management</h1>
        <p className="lead">Review users and approve mechanics before they can fully operate.</p>
      </div>

      <Card title="Users" subtitle="All users in the system.">
        {error ? <div className="alert alert-error">{error}</div> : null}
        <Table columns={columns} rows={rows} rowKey={(r) => r.id} />
      </Card>
    </div>
  );
}
