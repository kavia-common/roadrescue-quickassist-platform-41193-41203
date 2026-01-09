import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { dataService } from "../services/dataService";

// PUBLIC_INTERFACE
export function LoginPage({ onAuthed }) {
  /** Admin login page with an always-available hardcoded DEMO login. */
  const navigate = useNavigate();

  // Keep the current defaults for convenience (mock mode).
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    try {
      const u = await dataService.demoAdminLogin();
      onAuthed?.(u);
      // Guarantee navigation to dashboard regardless of env/Supabase/RLS.
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

      <Card title="Login" subtitle="Use your admin credentials, or use the built-in DEMO login (always available).">
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

              <Button type="button" variant="secondary" disabled={busy} onClick={demoLogin}>
                DEMO login
              </Button>
            </div>

            <div className="hint" style={{ marginTop: 6 }}>
              DEMO login is fully in-app and does not require Supabase configuration or environment variables.
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}
