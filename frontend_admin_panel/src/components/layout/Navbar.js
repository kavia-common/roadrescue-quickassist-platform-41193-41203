import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../ui/Button";
import { dataService } from "../../services/dataService";

// PUBLIC_INTERFACE
export function Navbar({ user }) {
  /** Legacy top navbar (kept for backward compatibility). Admin navigation uses the /admin sidebar. */
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
