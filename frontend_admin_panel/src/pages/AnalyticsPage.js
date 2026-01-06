import React, { useEffect, useMemo, useState } from "react";
import { Card } from "../components/ui/Card";
import { Table } from "../components/ui/Table";
import { dataService } from "../services/dataService";

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

// PUBLIC_INTERFACE
export function AnalyticsPage() {
  /** Basic analytics: daily volume and status breakdown (no external chart libs). */
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setError("");
      try {
        const r = await dataService.listRequests();
        if (mounted) setRequests(r);
      } catch (e) {
        if (mounted) setError(e.message || "Could not load analytics.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

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
      counts[r.status] = (counts[r.status] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [requests]);

  const maxDaily = daily.reduce((m, x) => Math.max(m, x.count), 0);
  const maxStatus = statusCounts.reduce((m, x) => Math.max(m, x.count), 0);

  return (
    <div className="container">
      <div className="hero">
        <h1 className="h1">Analytics</h1>
        <p className="lead">Lightweight analytics with simple visual bars.</p>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="grid2">
        <Card title="Requests per day" subtitle="Counts by created date.">
          {daily.length ? daily.map((d) => <Bar key={d.day} label={d.day} value={d.count} max={maxDaily} />) : <div style={{ color: "var(--muted)", fontWeight: 800 }}>No data</div>}
        </Card>

        <Card title="Status breakdown" subtitle="Most common statuses first.">
          {statusCounts.length ? statusCounts.map((s) => <Bar key={s.status} label={s.status} value={s.count} max={maxStatus} />) : <div style={{ color: "var(--muted)", fontWeight: 800 }}>No data</div>}
        </Card>
      </div>

      <div style={{ marginTop: 12 }}>
        <Card title="Recent activity" subtitle="Latest requests table.">
          <Table
            columns={[
              { key: "id", header: "Request", render: (r) => r.id.slice(0, 8) },
              { key: "createdAt", header: "Created", render: (r) => new Date(r.createdAt).toLocaleString() },
              { key: "status", header: "Status" },
              { key: "userEmail", header: "Customer" },
            ]}
            rows={requests.slice(0, 20)}
            rowKey={(r) => r.id}
          />
        </Card>
      </div>
    </div>
  );
}
