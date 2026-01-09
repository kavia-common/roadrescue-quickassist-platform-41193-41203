import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { useAuth } from "../auth/AuthContext";

// PUBLIC_INTERFACE
export function LoginPage() {
  /** Admin login page (DEMO ONLY hardcoded credentials; no external auth). */
  const navigate = useNavigate();
  const { login, demoCredentials } = useAuth();

  const [email, setEmail] = useState(demoCredentials.email);
  const [password, setPassword] = useState(demoCredentials.password);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const hint = useMemo(() => {
    return `DEMO ONLY: ${demoCredentials.email} / ${demoCredentials.password}`;
  }, [demoCredentials.email, demoCredentials.password]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) return setError("Email is required.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");

    setBusy(true);
    try {
      const u = await login(email.trim(), password);
      if (u.role !== "admin") throw new Error("This portal is for admins only.");
      navigate("/dashboard");
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
        <p className="lead">Manage approvals, requests, fees, and basic analytics.</p>
      </div>

      <Card title="Login" subtitle={hint}>
        <div className="alert alert-info" style={{ marginBottom: 12 }}>
          <strong>DEMO ONLY:</strong> This login is hardcoded in the client and is not secure. Remove before production.
        </div>

        <form className="form" onSubmit={submit}>
          <Input label="Email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Password" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

          {error ? <div className="alert alert-error">{error}</div> : null}

          <div className="row">
            <Button type="submit" disabled={busy}>
              {busy ? "Signing in..." : "Sign in"}
            </Button>

            <Button
              variant="ghost"
              type="button"
              disabled={busy}
              onClick={() => {
                setEmail(demoCredentials.email);
                setPassword(demoCredentials.password);
                setError("");
              }}
            >
              Fill demo creds
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
