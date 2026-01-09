import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { dataService } from "../services/dataService";

// PUBLIC_INTERFACE
export function LoginPage({ onAuthed }) {
  /** Admin login page. */
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoError, setDemoError] = useState("");

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

  // PUBLIC_INTERFACE
  const signInDemoAdmin = async () => {
    setDemoError("");
    setDemoBusy(true);
    try {
      // Try Supabase sign-in with demo creds if available, otherwise set local demo session.
      let demoResult = null;
      if (dataService.isSupabaseConfigured?.() && dataService.getSupabaseClient?.()) {
        // Try magic link or (if implemented) passwordless login for admin@roadrescue.demo
        const supabase = dataService.getSupabaseClient();
        // Try basic signInWithPassword with a known demo password.
        // Set the demo admin password here (must match backend pre-seeded demo user if available)
        const knownDemoPassword = "demoadmin123";
        const { data, error } = await supabase.auth.signInWithPassword({
          email: "admin@roadrescue.demo",
          password: knownDemoPassword,
        });
        if (error) {
          // fallback: magic link flow
          const { error: magicErr } = await supabase.auth.signInWithOtp({
            email: "admin@roadrescue.demo",
            options: {
              shouldCreateUser: false,
              // redirectTo: process.env.REACT_APP_FRONTEND_URL + "/dashboard"
            },
          });
          if (magicErr)
            throw new Error(
              "Unable to sign in to demo. The demo admin Supabase account may not exist, or email magic link couldn't be sent."
            );
          demoResult = "Check your email for the demo admin login link.";
          setDemoError("Demo admin requires magic link (check admin@roadrescue.demo inbox).");
          setDemoBusy(false);
          return;
        }
        // Success: let flow continue, data.user now present.
        demoResult = data.user;
        if (!demoResult) throw new Error("Unexpected error: no demo user session returned.");
        onAuthed?.({ id: data.user.id, email: data.user.email, role: "admin", approved: true });
        navigate("/dashboard");
        setDemoBusy(false);
        return;
      }
      // else use mock/demo mode, fallback to localStorage session
      await dataService.setDemoAdminSession?.();
      onAuthed?.({ id: "demo-admin", email: "admin@roadrescue.demo", role: "admin", approved: true });
      navigate("/dashboard");
    } catch (err) {
      setDemoError(err.message || "Could not sign into demo admin.");
    } finally {
      setDemoBusy(false);
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
          <>
            Demo admin: <span style={{ fontFamily: "monospace" }}>admin@example.com / password123</span>
            <br />
            <span style={{ fontFamily: "monospace" }}>Demo sign-in&nbsp;→&nbsp;admin@roadrescue.demo</span>
          </>
        }
      >
        <form className="form" onSubmit={submit} style={{ marginBottom: 18 }}>
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
            <Button type="submit" disabled={busy}>
              {busy ? "Signing in..." : "Sign in"}
            </Button>
          </div>
        </form>
        <div className="row" style={{ marginBottom: 10, marginTop: 2 }}>
          <Button
            type="button"
            variant="secondary"
            onClick={signInDemoAdmin}
            disabled={demoBusy}
            style={{
              fontWeight: 900,
              boxShadow: "var(--shadow)",
              background:
                "linear-gradient(90deg, rgba(245,158,11,0.14), rgba(37,99,235,0.13))",
              color: "#1D4ED8",
            }}
          >
            {demoBusy ? "Signing in as demo admin…" : "Demo Admin Sign-In"}
          </Button>
        </div>
        <div style={{ marginBottom: 0, marginTop: 0 }}>
          <span style={{ fontSize: 13, color: "#EF4444", fontWeight: 600 }}>
            Demo-only access &mdash; not real authentication.
          </span>
        </div>
        {demoError ? <div className="alert alert-error" style={{ marginTop: 10 }}>{demoError}</div> : null}
        <div style={{ color: "var(--muted)", marginTop: 10, fontSize: 12 }}>
          The "Demo Admin Sign-In" button logs you in as <b>admin@roadrescue.demo</b>.<br />
          In demo/dev mode, this session exists only in this browser and may not persist.<br />
          <b>For presentation/testing ONLY — <span style={{ color: "#EF4444" }}>do not use for production</span>.</b>
        </div>
      </Card>
    </div>
  );
}
