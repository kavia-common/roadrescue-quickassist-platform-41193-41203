import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { dataService, createDemoAdminSession, getDemoSession, clearDemoSession } from "../services/dataService";

// Demo admin static info
const DEMO = {
  id: "demo-admin",
  email: "demo@admin.local",
  role: "admin",
  full_name: "Demo Admin",
  password: "demo123", // for consistency, not used in hardmode
};

// PUBLIC_INTERFACE
export function LoginPage({ onAuthed }) {
  /** Admin login page with hard demo-only mode. */
  const navigate = useNavigate();

  // Compute demo mode at runtime
  const demoEnabled = useMemo(() => dataService.isDemoEnabled?.() === true, [window.location.href]);

  // ---- All hooks declared once at the top ---
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("password123");

  // Hard redirect: if already have demo admin session, redirect (side effect, not a hook)
  if (demoEnabled && getDemoSession()) {
    setTimeout(() => navigate("/dashboard", { replace: true }), 0);
    return null;
  }

  // DEMO-ONLY RENDER – no email/password fields, no submit
  if (demoEnabled) {
    return (
      <div className="container">
        <div className="hero">
          <h1 className="h1">Admin Panel</h1>
          <p className="lead">
            Manage approvals, requests, fees, and analytics.
          </p>
        </div>
        <Card
          title="DEMO LOGIN"
          subtitle="This demo is locked to one-click admin entry. No password required."
          actions={
            <span
              className="chip"
              style={{
                borderColor: "rgba(245,158,11,0.35)",
                background: "rgba(245,158,11,0.10)",
                color: "#92400E",
              }}
            >
              Demo Mode
            </span>
          }
        >
          {error ? <div className="alert alert-error">{error}</div> : null}
          <div style={{display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start"}}>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                setError("");
                setBusy(true);
                try {
                  clearDemoSession(); // clean out before create, for robustness
                  createDemoAdminSession();
                  await Promise.resolve();
                  if (!getDemoSession()) {
                    setError("Demo session was not set. Please clear browser storage and retry.");
                    setBusy(false);
                    return;
                  }
                  onAuthed?.(getDemoSession());
                  navigate("/dashboard", { replace: true });
                } catch (e) {
                  setError(e.message || "Demo login failed.");
                } finally {
                  setBusy(false);
                }
              }}
              style={{ border: "1px solid rgba(245,158,11,0.35)", minWidth: 220, minHeight: 46, fontWeight: 900, fontSize: 17 }}
              data-testid="demo-admin-login-btn"
            >
              ➡️  Enter Demo Admin
            </Button>
            <div className="hint" style={{ marginTop: 6 }}>
              No email or password required.
              <br />
              This button creates a local admin session (<code>{dataService.demoSessionKey}</code>), then takes you directly to the dashboard.
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // NON-DEMO: Existing behavior (brief, preserves original login flow)
  // These states are very rarely exercised now for prod demos!
  const completeLogin = async (emailValue, passwordValue) => {
    const u = await dataService.login(emailValue.trim(), passwordValue);
    const profile = await dataService.getCurrentProfile();
    if (!profile) throw new Error("Signed in, but your profile could not be loaded. Ensure public.profiles has a row with id = auth.uid() and role = 'admin', and that RLS permits select.");
    if (profile.role !== "admin") throw new Error(`This portal is for admins only. Your role is '${profile.role || "unknown"}'.`);
    onAuthed?.({ ...u, role: "admin" });
    navigate("/dashboard");
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) return setError("Email is required.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    setBusy(true);
    try {
      await completeLogin(email, password);
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container">
      <div className="hero">
        <h1 className="h1">Admin Panel</h1>
        <p className="lead">
          Manage approvals, requests, fees, and analytics.
        </p>
      </div>
      <Card title="Login" subtitle="Enter admin credentials." actions={null}>
        <form className="form" onSubmit={submit} autoComplete="on">
          <div style={{ marginBottom: 12 }}>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
              disabled={busy}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={busy}
            />
          </div>
          {error ? <div className="alert alert-error">{error}</div> : null}
          <div className="row">
            <Button type="submit" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
