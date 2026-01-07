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

  // Core login logic; distinguishes credential path vs. demo.
  // Canonical credential login. Demo session bypass will use a different codepath.
  const completeLogin = async (emailValue, passwordValue) => {
    // In non-demo (Supabase or mock) mode, attempt login and profile load as usual.
    const u = await dataService.login(emailValue.trim(), passwordValue);

    // Step 2: load profile and check admin rights.
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

  // True Demo Admin login: this directly creates demo admin session, does not call credential auth
  const demoLogin = async () => {
    setError("");
    setBusy(true);
    try {
      if (!demoEnabled) {
        setError("Demo mode is not enabled.");
        setBusy(false);
        return;
      }
      // Diagnostic logging for troubleshooting
      if (process.env.NODE_ENV !== "production") {
        //eslint-disable-next-line
        console.info("[DEMO] Attempting demo admin login flow");
      }
      // For demo mode: call dataService to persist and use Demo Admin session directly
      await dataService.createDemoAdminSession?.();
      // Defensive: wait a microtask to ensure localStorage is flushed before reading.
      await Promise.resolve();
      const currentUser = await dataService.getCurrentUser();
      if (!currentUser || currentUser.role !== "admin") {
        throw new Error(
          "Demo session did not persist correctly. Please clear your browser storage and try again. (No admin session found.)"
        );
      }
      onAuthed?.(currentUser);
      if (process.env.NODE_ENV !== "production") {
        //eslint-disable-next-line
        console.info("[DEMO] Navigating to /dashboard after demo session set");
      }
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err && err.message ? err.message : "Demo login failed.");
    } finally {
      setBusy(false);
    }
  };

  // Normal submit: block credential login when demo is enabled!
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    // If demo mode is enabled, always block regular credential login and show clear instructions.
    if (demoEnabled) {
      setError(
        "Demo mode is enabled. Please use the 'Login as Demo Admin' button below. Email/password Sign In is disabled in demo mode."
      );
      return;
    }
    if (!email.trim()) return setError("Email is required.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    setBusy(true);
    try {
      await completeLogin(email, password);
    } catch (err) {
      // Only show literal credential error outside demo mode
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

      {/* New: Demo diagnosis banner at top */}
      {demoEnabled && (
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          <div>
            <strong>Demo mode is ON.</strong> (<code>REACT_APP_DEMO_ADMIN_ENABLED</code> =
            <span style={{ fontWeight: 800, color: "#92400E", margin: "0 4px" }}>
              {String(process.env.REACT_APP_DEMO_ADMIN_ENABLED)}
            </span>)
            <br />
            This enables the <span style={{fontWeight: 900}}>Login as Demo Admin</span> button below.
          </div>
        </div>
      )}
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
          {/* In demo mode, do not allow normal Sign In; disable inputs and show message. */}
          <Input
            label="Email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={demoEnabled}
            hint={demoEnabled ? "Disabled in demo mode." : undefined}
          />
          <Input
            label="Password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={demoEnabled}
            hint={demoEnabled ? "Disabled in demo mode." : undefined}
          />

          {error ? <div className="alert alert-error">{error}</div> : null}

          <div className="row">
            <Button
              type="submit"
              disabled={busy || demoEnabled}
              style={
                demoEnabled
                  ? {
                      opacity: 0.5,
                      cursor: "not-allowed",
                    }
                  : undefined
              }
              onClick={(e) => {
                // Force credential path never to fire in demo mode,
                // even if handler is accidentally enabled by test/automation.
                if (demoEnabled) {
                  e.preventDefault();
                  setError(
                    "Demo mode is enabled. Please use the 'Login as Demo Admin' button below. Email/password Sign In is disabled in demo mode."
                  );
                  return;
                }
              }}
              aria-disabled={demoEnabled ? "true" : undefined}
              tabIndex={demoEnabled ? -1 : undefined}
            >
              {busy ? "Signing in..." : "Sign in"}
            </Button>
            {demoEnabled ? (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={async () => {
                  setError("");
                  setBusy(true);
                  try {
                    await demoLogin();
                  } catch (err) {
                    setError(err && err.message ? err.message : "Demo login failed.");
                  } finally {
                    setBusy(false);
                  }
                }}
                style={{ border: "1px solid rgba(245,158,11,0.35)" }}
                data-testid="demo-admin-login-btn"
              >
                Login as Demo Admin ({DEMO.email} / {DEMO.password})
              </Button>
            ) : null}
          </div>

          {demoEnabled ? (
            <div className="hint" style={{ marginTop: 6 }}>
              <strong>Demo credentials:</strong> {DEMO.email} / {DEMO.password}.
              <br />
              <span>
                Email and password fields are disabled – use the one-click demo login above, which stores a local admin session as <code>{dataService.demoSessionKey}</code>.
              </span>
            </div>
          ) : null}
        </form>
      </Card>
    </div>
  );
}
