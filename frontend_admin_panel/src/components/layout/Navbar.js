import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Button } from "../ui/Button";
import { useAuth } from "../../auth/AuthContext";

// PUBLIC_INTERFACE
export function Navbar() {
  /** Admin panel navigation (DEMO auth mode). */
  const navigate = useNavigate();
  const { isAuthenticated, role, logout } = useAuth();

  const isAdmin = isAuthenticated && role === "admin";

  const onLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand">
          RoadRescue <span className="brand-accent">Admin</span>
        </Link>

        <nav className="navlinks" aria-label="Primary navigation">
          {isAdmin ? (
            <>
              <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "navlink active" : "navlink")}>
                Dashboard
              </NavLink>
              <NavLink to="/users" className={({ isActive }) => (isActive ? "navlink active" : "navlink")}>
                Users
              </NavLink>
              <NavLink to="/requests" className={({ isActive }) => (isActive ? "navlink active" : "navlink")}>
                Requests
              </NavLink>
              <NavLink to="/fees" className={({ isActive }) => (isActive ? "navlink active" : "navlink")}>
                Fees
              </NavLink>
              <NavLink to="/analytics" className={({ isActive }) => (isActive ? "navlink active" : "navlink")}>
                Analytics
              </NavLink>
              <NavLink to="/demo-sms" className={({ isActive }) => (isActive ? "navlink active" : "navlink")}>
                SMS Demo
              </NavLink>
            </>
          ) : null}
        </nav>

        <div className="nav-right">
          {isAdmin ? (
            <>
              <span className="chip">Admin</span>
              <Button variant="ghost" onClick={onLogout}>
                Log out
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
