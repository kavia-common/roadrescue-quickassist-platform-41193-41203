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
  const { signIn, requestPasswordReset, updatePassword, user, isAdmin, loading } = useAuth();

  // Default email is set for convenience; do not prefill password.
  const [email, setEmail] = useState("shanmugasundaramdm@gmail.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  // Password reset flow UI state
  const [mode, setMode] = useState("login"); // "login" | "requestReset" | "setNewPassword"
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  useEffect(() => {
    if (!loading && user && isAdmin) {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    // Supabase password recovery typically returns with URL fragments like:
    // - #access_token=...&type=recovery
    // or query params depending on configuration.
    //
    // We treat either as "recovery mode" and show the "set new password" UI.
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    const lowerHash = hash.toLowerCase();
    const lowerSearch = search.toLowerCase();

    const hasRecovery =
      lowerHash.includes("type=recovery") ||
      lowerSearch.includes("type=recovery") ||
      // Some configurations may return `type=recovery` without the explicit prefix, so this is an extra guard.
      lowerHash.includes("recovery") ||
      lowerSearch.includes("recovery");

    if (hasRecovery) {
      setMode("setNewPassword");
      setStatus({ type: "info", message: "Set a new password for your admin account." });
    }
  }, []);

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

  const submitResetRequest = async (e) => {
    e.preventDefault();
    setStatus({ type: "", message: "" });

    if (!email.trim()) return setStatus({ type: "error", message: "Email is required." });

    setBusy(true);
    try {
      const { error } = await requestPasswordReset(email.trim());
      if (error) {
        setStatus({ type: "error", message: error.message || "Could not start password reset." });
        return;
      }
      setStatus({
        type: "info",
        message: "Password reset email sent (if the account exists). Check your inbox/spam, then follow the link to set a new password.",
      });
      setMode("login");
    } catch (err) {
      setStatus({ type: "error", message: err?.message || "An unexpected error occurred." });
    } finally {
      setBusy(false);
    }
  };

  const submitSetNewPassword = async (e) => {
    e.preventDefault();
    setStatus({ type: "", message: "" });

    if (!newPassword || newPassword.length < 6) {
      return setStatus({ type: "error", message: "New password must be at least 6 characters." });
    }
    if (newPassword !== confirmNewPassword) {
      return setStatus({ type: "error", message: "Passwords do not match." });
    }

    setBusy(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) {
        setStatus({ type: "error", message: error.message || "Could not update password." });
        return;
      }

      // Clear hash + query so reloading doesn't keep the recovery UI.
      // (Supabase may return `type=recovery` in either location.)
      window.history.replaceState(null, document.title, window.location.pathname);

      setNewPassword("");
      setConfirmNewPassword("");
      setMode("login");
      setStatus({ type: "info", message: "Password updated. Please sign in with your new password." });
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
        <Card title="Admin Login" subtitle="Admins only. Sign in via Supabase, or reset your password if needed.">
          {mode === "login" ? (
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
                <Button type="button" variant="ghost" disabled={busy} onClick={() => setStatus({ type: "", message: "" })}>
                  Clear
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setStatus({ type: "", message: "" });
                    setMode("requestReset");
                  }}
                >
                  Forgot password?
                </Button>
              </div>
            </form>
          ) : mode === "requestReset" ? (
            <form className="form" onSubmit={submitResetRequest}>
              <Input
                label="Email"
                name="resetEmail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                hint="We'll send a reset link if this email exists in Supabase Auth."
              />

              {status.message ? (
                <div className={`alert ${status.type === "error" ? "alert-error" : "alert-info"}`}>{status.message}</div>
              ) : null}

              <div className="row">
                <Button type="submit" disabled={busy}>
                  {busy ? "Sending..." : "Send reset email"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setStatus({ type: "", message: "" });
                    setMode("login");
                  }}
                >
                  Back to login
                </Button>
              </div>
            </form>
          ) : (
            <form className="form" onSubmit={submitSetNewPassword}>
              <div className="alert alert-info">
                You opened a Supabase recovery link. Set your new password below, then sign in normally.
              </div>

              <Input
                label="New password"
                name="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                hint="Minimum 6 characters (Supabase default)."
              />
              <Input
                label="Confirm new password"
                name="confirmNewPassword"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
              />

              {status.message ? (
                <div className={`alert ${status.type === "error" ? "alert-error" : "alert-info"}`}>{status.message}</div>
              ) : null}

              <div className="row">
                <Button type="submit" disabled={busy}>
                  {busy ? "Updating..." : "Update password"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setStatus({ type: "", message: "" });
                    setMode("login");
                  }}
                >
                  Back to login
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
