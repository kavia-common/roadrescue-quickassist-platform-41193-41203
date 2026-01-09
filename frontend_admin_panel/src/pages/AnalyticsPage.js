import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "../components/ui/Card";
import { Table } from "../components/ui/Table";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { dataService } from "../services/dataService";
import { normalizeStatus, statusLabel } from "../services/statusUtils";

function bucketDay(iso) {
  const d = new Date(iso);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return key;
}

function Bar({ label, value, max }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 50px", gap: 10, alignItems: "center", margin: "8px 0" }}>
      <div style={{ fontWeight: 900, color: "var(--muted)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div style={{ height: 12, borderRadius: 999, border: "1px solid var(--border)", background: "#fff", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, rgba(37,99,235,0.9), rgba(245,158,11,0.85))" }} />
      </div>
      <div style={{ fontWeight: 1000, textAlign: "right" }}>{value}</div>
    </div>
  );
}

const TIME_RANGE_OPTIONS = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "ytd", label: "Year to date" },
  { value: "all", label: "All time" },
];

const ASSIGNED_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "UNASSIGNED", label: "Unassigned" },
];

const STATUS_FILTER_OPTIONS = ["ALL", "OPEN", "ASSIGNED", "EN_ROUTE", "WORKING", "COMPLETED", "CANCELLED"];

// PUBLIC_INTERFACE
export function AnalyticsPage() {
  /** Admin analytics with filters/search/time range, using existing schema fields only. */
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Controls
  const [timeRange, setTimeRange] = useState("30d");
  const [status, setStatus] = useState("ALL");
  const [assigned, setAssigned] = useState("ALL");
  const [search, setSearch] = useState("");

  // Debounce search to avoid firing a query on every keystroke.
  const searchDebounceRef = useRef(null);

  const load = async ({ reason = "change" } = {}) => {
    setBusy(true);
    setError("");
    try {
      const rows = await dataService.queryRequestsForAnalytics({
        timeRange,
        status,
        assigned,
        search,
        // Keep bounded; enough for bars without overfetching.
        limit: 800,
      });
      setRequests(rows);
    } catch (e) {
      setError(e.message || "Could not load analytics.");
      setRequests([]);
      // Small hint in console for diagnosing schema/RLS
      console.info("[analytics-load-failed]", { reason, timeRange, status, assigned, search });
    } finally {
      setBusy(false);
    }
  };

  // Initial load + reload on non-search control changes.
  useEffect(() => {
    load({ reason: "init" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load({ reason: "filters" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, status, assigned]);

  // Debounced reload on search changes.
  useEffect(() => {
    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = window.setTimeout(() => {
      load({ reason: "search" });
    }, 250);

    return () => {
      if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const kpis = useMemo(() => {
    const total = requests.length;
    const open = requests.filter((r) => !["COMPLETED", "CANCELLED"].includes(normalizeStatus(r.status))).length;
    const completed = requests.filter((r) => normalizeStatus(r.status) === "COMPLETED").length;
    const assignedCount = requests.filter((r) => Boolean(r.assignedMechanicId)).length;
    return { total, open, completed, assigned: assignedCount };
  }, [requests]);

  const daily = useMemo(() => {
    const map = new Map();
    requests.forEach((r) => {
      const day = bucketDay(r.createdAt);
      map.set(day, (map.get(day) || 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, count]) => ({ day, count }));
  }, [requests]);

  const statusCounts = useMemo(() => {
    const counts = {};
    requests.forEach((r) => {
      const s = normalizeStatus(r.status);
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([s, count]) => ({ status: s, count }))
      .sort((a, b) => b.count - a.count);
  }, [requests]);

  const maxDaily = daily.reduce((m, x) => Math.max(m, x.count), 0);
  const maxStatus = statusCounts.reduce((m, x) => Math.max(m, x.count), 0);

  const reset = () => {
    setTimeRange("30d");
    setStatus("ALL");
    setAssigned("ALL");
    setSearch("");
  };

  return (
    <div className="container">
      <div className="hero">
        <h1 className="h1">Analytics</h1>
        <p className="lead">Filter by time range, assignment, status, or search. Charts update from the filtered dataset.</p>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <Card
        title="Filters"
        subtitle="Applies server-side filtering in Supabase mode (bounded) and local filtering in mock mode."
        actions={
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className="badge badge-blue">{busy ? "Loading…" : "Ready"}</span>
            <Button variant="ghost" size="sm" onClick={() => load({ reason: "manual-refresh" })} disabled={busy}>
              Refresh
            </Button>
            <Button variant="secondary" size="sm" onClick={reset} disabled={busy}>
              Reset
            </Button>
          </div>
        }
      >
        <div className="grid2">
          <div>
            <div className="label">Time range</div>
            <select className="input" value={timeRange} onChange={(e) => setTimeRange(e.target.value)} disabled={busy}>
              {TIME_RANGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="hint" style={{ marginTop: 6 }}>
              Uses <code>submitted_at</code> when present, otherwise <code>created_at</code>.
            </div>
          </div>

          <Input
            label="Search"
            name="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Request id, vehicle, plate, address, email..."
            disabled={busy}
            hint="Search is best-effort (UUID id matching is done client-side)."
          />

          <div>
            <div className="label">Status</div>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} disabled={busy}>
              {STATUS_FILTER_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === "ALL" ? "All" : statusLabel(s)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="label">Assigned</div>
            <select className="input" value={assigned} onChange={(e) => setAssigned(e.target.value)} disabled={busy}>
              {ASSIGNED_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="hint" style={{ marginTop: 6 }}>
              Uses <code>assigned_mechanic_id</code> (or legacy <code>mechanic_id</code>).
            </div>
          </div>
        </div>

        <div className="divider" />

        <div className="grid4">
          <div className="kpi">
            <div className="kpi-label">Total (filtered)</div>
            <div className="kpi-value">{kpis.total}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Open</div>
            <div className="kpi-value">{kpis.open}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Assigned</div>
            <div className="kpi-value">{kpis.assigned}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Completed</div>
            <div className="kpi-value">{kpis.completed}</div>
          </div>
        </div>
      </Card>

      <div className="grid2" style={{ marginTop: 12 }}>
        <Card title="Requests per day" subtitle="Counts by created/submitted date (filtered).">
          {daily.length ? daily.map((d) => <Bar key={d.day} label={d.day} value={d.count} max={maxDaily} />) : <div style={{ color: "var(--muted)", fontWeight: 800 }}>No data</div>}
        </Card>

        <Card title="Status breakdown" subtitle="Most common statuses first (filtered).">
          {statusCounts.length ? statusCounts.map((s) => <Bar key={s.status} label={statusLabel(s.status)} value={s.count} max={maxStatus} />) : <div style={{ color: "var(--muted)", fontWeight: 800 }}>No data</div>}
        </Card>
      </div>

      <div style={{ marginTop: 12 }}>
        <Card title="Recent activity" subtitle="Latest matching requests.">
          <Table
            columns={[
              { key: "id", header: "Request", render: (r) => String(r.id).slice(0, 8) },
              { key: "createdAt", header: "Created", render: (r) => (r.createdAt ? new Date(r.createdAt).toLocaleString() : "—") },
              { key: "status", header: "Status", render: (r) => statusLabel(r.status) },
              { key: "userEmail", header: "Customer (email/id)" },
              {
                key: "assigned",
                header: "Assigned",
                render: (r) => (r.assignedMechanicId ? <span className="badge badge-blue">Yes</span> : <span className="badge">No</span>),
              },
            ]}
            rows={requests.slice(0, 25)}
            rowKey={(r) => r.id}
          />
        </Card>
      </div>
    </div>
  );
}
