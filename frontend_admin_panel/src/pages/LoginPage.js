import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { dataService } from "../services/dataService";

const DEMO = {
  email: "demo@roadrescue.local",
  password: "demo123",
};

// PUBLIC_INTERFACE
export function LoginPage({ onAuthed }) {
  /** Admin login page (Supabase when configured, demo fallback when enabled/unconfigured). */
  const navigate = useNavigate();

  // Always compute demoEnabled from env at runtime, not at module eval
  const demoEnabled = useMemo(() => dataService.isDemoEnabled?.() === true, [dataService]);

  // For demo: hard-code demo creds, for regular, use mock admin creds.
  const [email, setEmail] = useState(() =>
    demoEnabled ? DEMO.email : "admin@example.com"
  );
  const [password, setPassword] = useState(() =>
    demoEnabled ? DEMO.password : "password123"
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Core login logic; distinguishes credential path vs. demo
  const completeLogin = async (emailValue, passwordValue) => {
    // In demo mode, only allow the specific demo credentials.
    if (demoEnabled) {
      // Only allow demo admin for email and pw, all others must fail with explicit error.
      if (
        emailValue.trim().toLowerCase() !== DEMO.email ||
        passwordValue !== DEMO.password
      ) {
        throw new Error(
          `In Demo mode, only "${DEMO.email}" / "${DEMO.password}" are allowed. Use the 'Login as Demo Admin' button.`
        );
      }
    }
    // Step 1: authenticate
    const u = await dataService.login(emailValue.trim(), passwordValue);

    // Step 2 (canonical): load profile by id=auth.uid() and gate on role='admin'
    // In demo mode, getCurrentProfile() is provided by dataService (local session) and returns role='admin'.
    const profile = await dataService.getCurrentProfile();
    if (!profile) {
      throw new Error(
        "Signed in, but your profile could not be loaded. Ensure public.profiles has a row with id = auth.uid() and role = 'admin', and that RLS permits select."
      );
    }
    if (profile.role !== "admin") {
      throw new Error(
        `This portal is for admins only. Your role is '${profile.role || "unknown"}'.`
      );
    }
    onAuthed?.({ ...u, role: "admin" });
    navigate("/dashboard");
  };

  // Direct demo session creation—never perform normal login logic in demo mode
  const demoLogin = async () => {
    setError("");
    setBusy(true);
    try {
      // Save demo session directly using service interface (no credential check)
      // Only proceed if demoMode is active
      if (!demoEnabled) {
        setError("Demo mode is not enabled.");
        setBusy(false);
        return;
      }
      // Use demo credentials directly
      await completeLogin(DEMO.email, DEMO.password);
    } catch (err) {
      setError(err.message || "Demo login failed.");
    } finally {
      setBusy(false);
    }
  };

  // Normal submit: block credential login when demo is enabled!
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    // When demo is enabled, block form credential login to force the demo flow
    if (demoEnabled) {
      setError("In Demo mode, use the 'Login as Demo Admin' button below.");
      return;
    }
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
          Manage approvals, requests, fees, and basic analytics.
        </p>
      </div>

      <Card
        title="Login"
        subtitle={
          demoEnabled
            ? "Demo mode is enabled. Use the one-click button below to access the admin panel."
            : "Demo admin: admin@example.com / password123"
        }
        actions={
          demoEnabled ? (
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
          ) : null
        }
      >
        <form className="form" onSubmit={submit} autoComplete="on">
          <Input
            label="Email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={demoEnabled}
          />
          <Input
            label="Password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={demoEnabled}
          />

          {error ? <div className="alert alert-error">{error}</div> : null}

          <div className="row">
            <Button type="submit" disabled={busy || demoEnabled}>
              {busy ? "Signing in..." : "Sign in"}
            </Button>
            {demoEnabled ? (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={demoLogin}
                style={{ border: "1px solid rgba(245,158,11,0.35)" }}
              >
                Login as Demo Admin ({DEMO.email} / {DEMO.password})
              </Button>
            ) : null}
          </div>

          {demoEnabled ? (
            <div className="hint" style={{ marginTop: 6 }}>
              Demo credentials: <strong>{DEMO.email}</strong> /{" "}
              <strong>{DEMO.password}</strong>. Session is stored locally in{" "}
              <code>localStorage</code> as <code>admin_session</code>.
            </div>
          ) : null}
        </form>
      </Card>
    </div>
  );
}
