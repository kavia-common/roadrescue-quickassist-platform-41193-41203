import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { AdminSidebar } from "./AdminSidebar";

/**
 * AdminLayout is a UI wrapper + access gate:
 * - If not signed in OR not admin => redirect to /admin
 * - Otherwise => render sidebar + content
 */

// PUBLIC_INTERFACE
export function AdminLayout({ children }) {
  /** Layout wrapper for /admin/* routes enforcing admin access. */
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate("/admin", { replace: true });
    }
  }, [user, loading, isAdmin, navigate]);

  if (loading) {
    return (
      <div className="app-shell">
        <div className="container">
          <div className="skeleton">Loading…</div>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  return (
    <div style={{ display: "flex", minHeight: "100vh", width: "100%" }}>
      <AdminSidebar />
      <main style={{ flex: 1, overflow: "auto" }}>{children}</main>
    </div>
  );
}
