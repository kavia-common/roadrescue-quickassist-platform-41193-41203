import React, { useEffect, useState } from "react";
import { Card } from "../components/ui/Card";
import { Table } from "../components/ui/Table";
import { Button } from "../components/ui/Button";
import { dataService } from "../services/dataService";

function statusBadge(status) {
  const s = String(status || "").toLowerCase();
  if (s === "approved") return <span className="badge badge-green">Approved</span>;
  if (s === "rejected") return <span className="badge badge-amber">Rejected</span>;
  return <span className="badge badge-amber">Pending</span>;
}

// PUBLIC_INTERFACE
export function MechanicApprovalsPage() {
  /** Admin UI for approving/rejecting pending mechanic registrations. */
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = async () => {
    setError("");
    try {
      const list = await dataService.listPendingMechanics();
      setRows(list);
    } catch (e) {
      setError(e?.message || "Could not load pending mechanics.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (id) => {
    setBusyId(id);
    setError("");
    try {
      await dataService.approveMechanicProfile(id);
      await load();
    } catch (e) {
      setError(e?.message || "Could not approve mechanic.");
    } finally {
      setBusyId("");
    }
  };

  const reject = async (id) => {
    setBusyId(id);
    setError("");
    try {
      await dataService.rejectMechanicProfile(id);
      await load();
    } catch (e) {
      setError(e?.message || "Could not reject mechanic.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="container">
      <div className="hero">
        <h1 className="h1">Mechanic Approvals</h1>
        <p className="lead">Review mechanic registrations that are awaiting approval.</p>
      </div>

      <Card title="Pending mechanics" subtitle="Only mechanics with status='approved' should be allowed to access requests.">
        {error ? <div className="alert alert-error">{error}</div> : null}

        <Table
          columns={[
            { key: "displayName", header: "Name", render: (r) => r.displayName || "—" },
            { key: "email", header: "Identifier", render: (r) => r.email || `user:${String(r.id).slice(0, 8)}` },
            { key: "phone", header: "Phone", render: (r) => r.phone || "—" },
            { key: "serviceType", header: "Service type", render: (r) => r.serviceType || "—" },
            { key: "status", header: "Status", render: (r) => statusBadge(r.status) },
            {
              key: "action",
              header: "Action",
              render: (r) => (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Button size="sm" onClick={() => approve(r.id)} disabled={busyId === r.id}>
                    {busyId === r.id ? "Working..." : "Approve"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => reject(r.id)} disabled={busyId === r.id}>
                    Reject
                  </Button>
                </div>
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
