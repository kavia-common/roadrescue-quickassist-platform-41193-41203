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

const ROLE_TABS = [
  { key: "admin", label: "Admin" },
  { key: "mechanic", label: "Mechanic" },
  { key: "user", label: "User" },
];

// PUBLIC_INTERFACE
export function UserManagementPage() {
  /** Admin user management: view users and approve mechanics; now grouped by role via tabs. */
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const [activeRole, setActiveRole] = useState("admin");
  const [query, setQuery] = useState("");

  // Client-side pagination (keeps existing functionality consistent even if backend returns all users)
  const [page, setPage] = useState(1);
  const pageSize = 10;

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

  // Keep user on page 1 when changing role/search.
  useEffect(() => {
    setPage(1);
  }, [activeRole, query]);

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

  const { counts, filteredForRole, pagedRows, totalPages, pageStart, pageEnd } = useMemo(() => {
    const byRole = { admin: 0, mechanic: 0, user: 0 };

    const normalized = rows.map((r) => ({ ...r, __role: normalizeRole(r.role) }));
    normalized.forEach((r) => {
      if (r.__role === "admin") byRole.admin += 1;
      else if (r.__role === "mechanic") byRole.mechanic += 1;
      else byRole.user += 1;
    });

    const q = query.trim().toLowerCase();
    const roleFiltered = normalized.filter((r) => r.__role === activeRole);
    const searched = q
      ? roleFiltered.filter((r) => {
          const email = (r.email || "").toLowerCase();
          const id = String(r.id || "").toLowerCase();
          return email.includes(q) || id.includes(q);
        })
      : roleFiltered;

    const total = searched.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, pages);

    const startIdx = (safePage - 1) * pageSize;
    const endIdx = Math.min(total, startIdx + pageSize);
    const pageSlice = searched.slice(startIdx, endIdx);

    return {
      counts: byRole,
      filteredForRole: searched,
      pagedRows: pageSlice,
      totalPages: pages,
      pageStart: total ? startIdx + 1 : 0,
      pageEnd: endIdx,
    };
  }, [rows, activeRole, query, page]);

  // If current page got out of range due to data change, snap back.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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

  const cardActions = (
    <div className="roleTabs" role="tablist" aria-label="User roles">
      {ROLE_TABS.map((t) => {
        const active = activeRole === t.key;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            className={["roleTab", active ? "roleTabActive" : ""].join(" ").trim()}
            onClick={() => setActiveRole(t.key)}
          >
            <span>{t.label}</span>
            <span className="roleCount" aria-label={`${counts[t.key]} ${t.label.toLowerCase()} users`}>
              {counts[t.key]}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="container">
      <div className="hero">
        <h1 className="h1">User Management</h1>
        <p className="lead">Review users by role and approve mechanics before they can fully operate.</p>
      </div>

      <Card title="Users" subtitle="Switch roles to view the corresponding list. Search and pagination apply to the active role." actions={cardActions}>
        {error ? <div className="alert alert-error">{error}</div> : null}

        <div className="userMgmtTopRow">
          <div className="userMgmtPageInfo">
            Showing <strong>{pageStart}</strong>–<strong>{pageEnd}</strong> of <strong>{filteredForRole.length}</strong>{" "}
            {activeRole} users
          </div>

          <div className="userMgmtSearch">
            <label className="label" htmlFor="userSearch" style={{ marginBottom: 6 }}>
              Search
            </label>
            <input
              id="userSearch"
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by email or id…"
            />
          </div>
        </div>

        <Table columns={columns} rows={pagedRows} rowKey={(r) => r.id} />

        <div className="userMgmtFooter">
          <div className="userMgmtPageInfo">
            Page <strong>{page}</strong> of <strong>{totalPages}</strong>
          </div>
          <div className="userMgmtPagination">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
