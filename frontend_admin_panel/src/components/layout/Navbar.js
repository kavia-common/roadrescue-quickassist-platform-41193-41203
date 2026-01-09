import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Button } from "../ui/Button";
import { dataService } from "../../services/dataService";

// PUBLIC_INTERFACE
export function Navbar({ user }) {
  /** Admin panel navigation. */
  const navigate = useNavigate();

  const onLogout = async () => {
    await dataService.logout();
    navigate("/login");
  };

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand">
          RoadRescue <span className="brand-accent">Admin</span>
        </Link>

        <nav className="navlinks" aria-label="Primary navigation">
          {user ? (
            <>
              <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "navlink active" : "navlink")}>
                Dashboard
              </NavLink>
              <NavLink to="/users" className={({ isActive }) => (isActive ? "navlink active" : "navlink")}>
                Users
              </NavLink>
              <NavLink to="/mechanic-approvals" className={({ isActive }) => (isActive ? "navlink active" : "navlink")}>
                Mechanic Approvals
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

            </>
          ) : null}
        </nav>

        <div className="nav-right">
          {user ? (
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
