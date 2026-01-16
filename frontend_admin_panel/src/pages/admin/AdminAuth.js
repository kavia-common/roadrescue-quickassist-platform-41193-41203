import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../hooks/useAuth";

/**
 * Admin-only login screen.
 * This replaces the previous generic LoginPage flow for the /admin route.
 */

// PUBLIC_INTERFACE
export function AdminAuth() {
  /** Admin portal login screen that signs in and then redirects to /admin/dashboard once admin is verified. */
  const navigate = useNavigate();
  const { signIn, user, isAdmin, loading } = useAuth();

  // Per requirement: set admin email + password as defaults for convenience.
  // SECURITY NOTE: Pre-filling real credentials is not recommended for production; included per request.
  const [email, setEmail] = useState("shanmugasundaramdm@gmail.com");
  const [password, setPassword] = useState("JananiMota26@");
  const [showPassword, setShowPassword] = useState(false);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  useEffect(() => {
    if (!loading && user && isAdmin) {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [user, isAdmin, loading, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setStatus({ type: "", message: "" });

    if (!email.trim()) return setStatus({ type: "error", message: "Email is required." });
    if (!password) return setStatus({ type: "error", message: "Password is required." });

    setBusy(true);
    try {
      const { error } = await signIn(email.trim(), password);

      if (error) {
        setStatus({ type: "error", message: error.message || "Login failed." });
        return;
      }

      // We don't navigate immediately; AuthProvider will check role and then AdminLayout/this page redirects.
      setStatus({
        type: "info",
        message: "Signed in. Verifying admin access…",
      });
    } catch (err) {
      setStatus({ type: "error", message: err?.message || "An unexpected error occurred." });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="app-shell">
        <div className="container">
          <div className="skeleton">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 28 }}>
      <div className="hero">
        <h1 className="h1">Admin Portal</h1>
        <p className="lead">Sign in with your admin credentials.</p>
      </div>

      <div style={{ maxWidth: 520 }}>
        <Card title="Admin Login" subtitle="Admins only. Your account must have role = admin in Supabase.">
          <form className="form" onSubmit={submit}>
            <Input label="Email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

            <div className="field">
              <label className="label" htmlFor="password">
                Password <span className="req">*</span>
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }}>
                <input
                  id="password"
                  name="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  required
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowPassword((s) => !s)}>
                  {showPassword ? "Hide" : "Show"}
                </Button>
              </div>

              <div className="hint">Tip: If access is blocked, confirm your profile row has role=admin.</div>
            </div>

            {status.message ? (
              <div className={`alert ${status.type === "error" ? "alert-error" : "alert-info"}`}>{status.message}</div>
            ) : null}

            <div className="row">
              <Button type="submit" disabled={busy}>
                {busy ? "Signing in..." : "Sign in"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => setStatus({ type: "", message: "" })}
              >
                Clear
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
