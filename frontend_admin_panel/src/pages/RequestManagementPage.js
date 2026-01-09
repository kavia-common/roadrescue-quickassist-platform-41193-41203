import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/Card";
import { Table } from "../components/ui/Table";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { dataService } from "../services/dataService";
import { normalizeStatus, statusLabel } from "../services/statusUtils";

const STATUS_OPTIONS = ["OPEN", "ASSIGNED", "EN_ROUTE", "WORKING", "COMPLETED"];

function statusPill(status) {
  const canonical = normalizeStatus(status);
  const map = {
    OPEN: { bg: "rgba(37,99,235,0.08)", border: "rgba(37,99,235,0.25)", color: "#1D4ED8" },
    ASSIGNED: { bg: "rgba(37,99,235,0.08)", border: "rgba(37,99,235,0.25)", color: "#1D4ED8" },
    EN_ROUTE: { bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.25)", color: "#92400E" },
    WORKING: { bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.25)", color: "#92400E" },
    COMPLETED: { bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.25)", color: "#065F46" },
  };
  const s = map[canonical] || { bg: "#fff", border: "rgba(229,231,235,1)", color: "var(--text)" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontWeight: 900,
        fontSize: 12,
        border: `1px solid ${s.border}`,
        background: s.bg,
        color: s.color,
      }}
    >
      {statusLabel(canonical)}
    </span>
  );
}

// PUBLIC_INTERFACE
export function RequestManagementPage() {
  /** View/manage all requests: status changes, reassignment, and closing. */
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const [toast, setToast] = useState({ open: false, type: "info", message: "" }); // type: success|error|info

  const [statusById, setStatusById] = useState({});
  const [assignById, setAssignById] = useState({}); // mechanic id

  const mechanics = useMemo(
    () => users.filter((u) => u.role === "approved_mechanic" || (u.role === "mechanic" && u.approved)),
    [users]
  );

  const showToast = (type, message) => {
    setToast({ open: true, type, message });
    window.setTimeout(() => setToast((t) => ({ ...t, open: false })), 2500);
  };

  const load = async () => {
    setError("");
    try {
      const [r, u] = await Promise.all([dataService.listRequests(), dataService.listUsers()]);
      setRequests(r);
      setUsers(u);

      // Initialize editor state
      const s = {};
      const a = {};
      r.forEach((req) => {
        s[req.id] = normalizeStatus(req.status);
        a[req.id] = req.assignedMechanicId || "";
      });
      setStatusById(s);
      setAssignById(a);
    } catch (e) {
      setError(e.message || "Could not load requests.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveRow = async (req) => {
    setBusyId(req.id);
    setError("");
    try {
      const newStatus = normalizeStatus(statusById[req.id] || req.status);
      const newMechId = assignById[req.id] || null;
      const mech = mechanics.find((m) => m.id === newMechId) || null;

      await dataService.updateRequest(req.id, {
        status: newStatus,
        assignedMechanicId: newMechId,
        assignedMechanicEmail: mech ? mech.email : null,
      });

      showToast("success", `Saved request ${req.id.slice(0, 8)}.`);
      await load();
    } catch (e) {
      setError(e.message || "Could not update request.");
      showToast("error", e.message || "Could not update request.");
    } finally {
      setBusyId("");
    }
  };

  const closeRequest = async (req) => {
    setBusyId(req.id);
    setError("");
    try {
      await dataService.updateRequest(req.id, { status: "COMPLETED" });
      showToast("success", `Closed request ${req.id.slice(0, 8)} (Completed).`);
      await load();
    } catch (e) {
      setError(e.message || "Could not close request.");
      showToast("error", e.message || "Could not close request.");
    } finally {
      setBusyId("");
    }
  };

  const toastClass =
    toast.type === "success"
      ? "alert alert-info"
      : toast.type === "error"
        ? "alert alert-error"
        : "alert alert-info";

  return (
    <div className="container">
      {/* lightweight toast (no new deps) */}
      {toast.open ? (
        <div
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            zIndex: 1000,
            width: "min(420px, calc(100% - 32px))",
            boxShadow: "var(--shadow)",
          }}
          className={toastClass}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      ) : null}

      <div className="hero">
        <h1 className="h1">Request Management</h1>
        <p className="lead">Reassign requests, change status, or close cases.</p>
      </div>

      <Card title="All requests" subtitle="Edits are saved per-row.">
        {error ? <div className="alert alert-error">{error}</div> : null}

        <Table
          columns={[
            { key: "id", header: "Request", render: (r) => r.id.slice(0, 8) },
            { key: "createdAt", header: "Created", render: (r) => new Date(r.createdAt).toLocaleString() },
            { key: "vehicle", header: "Vehicle", render: (r) => `${r.vehicle.make} ${r.vehicle.model}` },
            { key: "status", header: "Status", render: (r) => statusPill(r.status) },
            { key: "userEmail", header: "Customer", render: (r) => r.userEmail },
            {
              key: "edit",
              header: "Edit",
              render: (r) => (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <div className="label">Status</div>
                      <select
                        className="input"
                        value={statusById[r.id] || normalizeStatus(r.status)}
                        onChange={(e) => setStatusById((s) => ({ ...s, [r.id]: normalizeStatus(e.target.value) }))}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {statusLabel(s)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="label">Assign mechanic</div>
                      <select
                        className="input"
                        value={assignById[r.id] || ""}
                        onChange={(e) => setAssignById((a) => ({ ...a, [r.id]: e.target.value }))}
                      >
                        <option value="">Unassigned</option>
                        {mechanics.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.email}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Button size="sm" onClick={() => saveRow(r)} disabled={busyId === r.id}>
                      {busyId === r.id ? "Saving..." : "Save"}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => closeRequest(r)} disabled={busyId === r.id}>
                      Close (Completed)
                    </Button>
                  </div>
                </div>
              ),
            },
          ]}
          rows={requests}
          rowKey={(r) => r.id}
        />
      </Card>

      <div style={{ marginTop: 12 }}>
        <Card title="Quick reassign helper" subtitle="Paste request ID and mechanic email to update faster (mock workflow).">
          <QuickReassign mechanics={mechanics} onDone={load} />
        </Card>
      </div>
    </div>
  );
}

function QuickReassign({ mechanics, onDone }) {
  const [requestId, setRequestId] = useState("");
  const [mechanicEmail, setMechanicEmail] = useState("");
  const [status, setStatus] = useState("ASSIGNED");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");
    if (!requestId.trim()) return setError("Request ID is required.");
    setBusy(true);
    try {
      const m = mechanics.find((x) => x.email.toLowerCase() === mechanicEmail.trim().toLowerCase()) || null;
      await dataService.updateRequest(requestId.trim(), {
        assignedMechanicId: m ? m.id : null,
        assignedMechanicEmail: m ? m.email : null,
        status,
      });
      setMsg("Updated.");
      setRequestId("");
      setMechanicEmail("");
      onDone?.();
    } catch (e2) {
      setError(e2.message || "Could not update.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className="grid2">
        <Input label="Request ID" name="rid" value={requestId} onChange={(e) => setRequestId(e.target.value)} placeholder="req_xxx..." required />
        <Input label="Mechanic email (optional)" name="me" value={mechanicEmail} onChange={(e) => setMechanicEmail(e.target.value)} placeholder="approved_mechanic@example.com" />
      </div>
      <div>
        <div className="label">Status</div>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </div>
      {msg ? <div className="alert">{msg}</div> : null}
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="row">
        <Button type="submit" disabled={busy}>
          {busy ? "Updating..." : "Update"}
        </Button>
      </div>
    </form>
  );
}
