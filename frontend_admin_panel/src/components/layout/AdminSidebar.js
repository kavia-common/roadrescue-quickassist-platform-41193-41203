import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Button } from "../ui/Button";
import { useAuth } from "../../hooks/useAuth";

const navItems = [
  { label: "Dashboard", path: "/admin/dashboard" },
  { label: "Users", path: "/admin/users" },
  { label: "Requests", path: "/admin/requests" },
  { label: "Fees", path: "/admin/fees" },
  { label: "Analytics", path: "/admin/analytics" },
  { label: "SMS Demo", path: "/admin/demo-sms" },
];

// PUBLIC_INTERFACE
export function AdminSidebar() {
  /** Sidebar navigation for admin routes. */
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const onSignOut = async () => {
    await signOut();
    navigate("/admin", { replace: true });
  };

  return (
    <aside
      aria-label="Admin sidebar"
      style={{
        width: 260,
        minHeight: "100vh",
        position: "sticky",
        top: 0,
        alignSelf: "flex-start",
        borderRight: "1px solid var(--border)",
        background: "rgba(255,255,255,0.70)",
        backdropFilter: "blur(10px)",
        padding: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 10px 14px" }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 12,
            background: "rgba(37,99,235,0.10)",
            border: "1px solid rgba(37,99,235,0.18)",
            display: "grid",
            placeItems: "center",
            fontWeight: 1000,
            color: "var(--primary)",
          }}
        >
          RR
        </div>
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontWeight: 1000, letterSpacing: "-0.01em" }}>RoadRescue</div>
          <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 900 }}>Admin</div>
        </div>
      </div>

      <nav>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                style={({ isActive }) => ({
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 10px",
                  borderRadius: 12,
                  textDecoration: "none",
                  fontWeight: 900,
                  color: isActive ? "var(--text)" : "var(--muted)",
                  background: isActive ? "rgba(37,99,235,0.10)" : "transparent",
                  border: "1px solid " + (isActive ? "rgba(37,99,235,0.18)" : "transparent"),
                })}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <Button variant="ghost" onClick={onSignOut} style={{ width: "100%", justifyContent: "flex-start" }}>
          Sign out
        </Button>
      </div>
    </aside>
  );
}
