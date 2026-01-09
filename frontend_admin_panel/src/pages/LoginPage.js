import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { dataService } from "../services/dataService";

function isTruthyEnv(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

// PUBLIC_INTERFACE
export function LoginPage({ onAuthed }) {
  /** Admin login page. */
  const navigate = useNavigate();

  // Default visible values remain as the existing demo (useful for mock mode),
  // while the DEMO button uses env-provided credentials (for Supabase mode).
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // DEMO login is gated behind an env flag so it can't be accidentally enabled in production.
  // Expected env vars:
  // - REACT_APP_DEMO_ADMIN_ENABLED=true|false
  // - REACT_APP_DEMO_ADMIN_EMAIL=...
  // - REACT_APP_DEMO_ADMIN_PASSWORD=...
  const demoEnabled = useMemo(() => isTruthyEnv(process.env.REACT_APP_DEMO_ADMIN_ENABLED), []);
  const demoEmail = process.env.REACT_APP_DEMO_ADMIN_EMAIL || "";
  const demoPassword = process.env.REACT_APP_DEMO_ADMIN_PASSWORD || "";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) return setError("Email is required.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    setBusy(true);
    try {
      const u = await dataService.login(email.trim(), password);
      if (u.role !== "admin") throw new Error("This portal is for admins only.");
      onAuthed?.(u);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  const demoLogin = async () => {
    setError("");

    if (!dataService.isSupabaseConfigured?.()) {
      // Keep behavior strict: DEMO button is intended for Supabase login with preset creds.
      // Mock-mode already pre-fills the form with demo credentials.
      return setError("DEMO login requires Supabase configuration (REACT_APP_SUPABASE_URL/KEY).");
    }

    if (!demoEmail.trim() || !demoPassword) {
      return setError("DEMO credentials are not configured (REACT_APP_DEMO_ADMIN_EMAIL/PASSWORD).");
    }

    setBusy(true);
    try {
      const u = await dataService.login(demoEmail.trim(), demoPassword);
      if (u.role !== "admin") throw new Error("This portal is for admins only.");
      onAuthed?.(u);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "DEMO login failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container">
      <div className="hero">
        <h1 className="h1">Admin Panel</h1>
        <p className="lead">Manage approvals, requests, fees, and basic analytics.</p>
      </div>

      <Card
        title="Login"
        subtitle={
          demoEnabled
            ? "Use your admin credentials or the DEMO button (if enabled)."
            : "Demo admin: admin@example.com / password123"
        }
      >
        <form className="form" onSubmit={submit}>
          <Input label="Email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input
            label="Password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error ? <div className="alert alert-error">{error}</div> : null}
          <div className="row">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button type="submit" disabled={busy}>
                {busy ? "Signing in..." : "Sign in"}
              </Button>

              {demoEnabled ? (
                <Button type="button" variant="secondary" disabled={busy} onClick={demoLogin}>
                  DEMO login
                </Button>
              ) : null}
            </div>

            {demoEnabled ? (
              <div className="hint" style={{ marginTop: 6 }}>
                DEMO login uses <code>REACT_APP_DEMO_ADMIN_EMAIL</code> / <code>REACT_APP_DEMO_ADMIN_PASSWORD</code>.
              </div>
            ) : null}
          </div>
        </form>
      </Card>
    </div>
  );
}
