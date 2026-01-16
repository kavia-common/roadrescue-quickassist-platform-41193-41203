import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { useAuth } from "../../hooks/useAuth";
import { dataService } from "../../services/dataService";

/**
 * Admin-only login screen.
 * This replaces the previous generic LoginPage flow for the /admin route.
 *
 * Password reset/recovery notes (Supabase):
 * - Email link can return with:
 *    1) hash tokens: #access_token=...&type=recovery
 *    2) query params: ?type=recovery&access_token=...
 *    3) PKCE flow: ?code=... (requires exchangeCodeForSession)
 *
 * This component handles all three and provides a robust "set new password" UX.
 */

// PUBLIC_INTERFACE
export function AdminAuth() {
  /** Admin portal login + password reset/recovery handler. */
  const navigate = useNavigate();
  const { signIn, signInWithGoogle, requestPasswordReset, updatePassword, user, isAdmin, loading } = useAuth();

  // Default email is set for convenience; do not prefill password.
  const [email, setEmail] = useState("shanmugasundaramdm@gmail.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  // Password reset flow UI state
  const [mode, setMode] = useState("login"); // "login" | "setNewPassword"

  // Recovery: new password form
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // Recovery: whether we've exchanged a `code` for a session (PKCE) and/or have a usable session.
  const [recoveryReady, setRecoveryReady] = useState(false);

  const supabaseConfigured = useMemo(() => dataService.isSupabaseConfigured?.(), []);

  useEffect(() => {
    // If already signed in and admin, go straight to dashboard.
    if (!loading && user && isAdmin) {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    // Detect recovery mode from URL (hash OR query).
    const hash = window.location.hash || "";
    const search = window.location.search || "";

    const paramsFromHash = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const paramsFromSearch = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

    const type = (paramsFromSearch.get("type") || paramsFromHash.get("type") || "").toLowerCase();
    const hasRecoveryType = type === "recovery";

    const hasAccessToken = Boolean(paramsFromSearch.get("access_token") || paramsFromHash.get("access_token"));
    const hasRefreshToken = Boolean(paramsFromSearch.get("refresh_token") || paramsFromHash.get("refresh_token"));

    // PKCE flow often returns `?code=...`
    const hasCode = Boolean(paramsFromSearch.get("code"));

    const shouldEnterRecoveryUI = hasRecoveryType || hasAccessToken || hasCode || hasRefreshToken;

    if (shouldEnterRecoveryUI) {
      setMode("setNewPassword");
      setStatus({
        type: "info",
        message: "Recovery link detected. Please set a new password to continue.",
      });
    }
  }, []);

  useEffect(() => {
    // Robust recovery handling:
    // - If Supabase returns with `?code=...`, exchange it for a session before calling updateUser().
    // - If it returns with tokens in hash/query, Supabase JS may already initialize the session.
    //
    // We also show a helpful error if Supabase isn't configured (prevents confusing 404-ish outcomes).
    if (mode !== "setNewPassword") return;

    let cancelled = false;

    (async () => {
      if (!supabaseConfigured) {
        setRecoveryReady(false);
        setStatus({
          type: "error",
          message: "Supabase is not configured for this app. Password recovery cannot be completed.",
        });
        return;
      }

      const supabase = dataService.getSupabaseClient?.();
      if (!supabase) {
        setRecoveryReady(false);
        setStatus({
          type: "error",
          message: "Supabase client is unavailable. Please check configuration and try again.",
        });
        return;
      }

      setBusy(true);
      try {
        const qs = new URLSearchParams(window.location.search.startsWith("?") ? window.location.search.slice(1) : window.location.search);
        const code = qs.get("code");

        if (code) {
          // PKCE exchange
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw new Error(error.message || "Could not validate the recovery link.");
        } else {
          // For token-in-hash flows, try to resolve the session (Supabase JS will parse the URL on init).
          // If there's no session, updatePassword will fail; we handle that with a clear message.
          await dataService.getCurrentSession();
        }

        if (cancelled) return;
        setRecoveryReady(true);
      } catch (e) {
        if (cancelled) return;
        setRecoveryReady(false);
        setStatus({
          type: "error",
          message:
            e?.message ||
            "Could not validate the recovery link. The link may be expired. Please request a new password reset email.",
        });
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, supabaseConfigured]);

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

  const onForgotPassword = async () => {
    setStatus({ type: "", message: "" });

    if (!email.trim()) {
      setStatus({ type: "error", message: "Enter your email above, then click Forgot password?." });
      return;
    }

    setBusy(true);
    try {
      const { error } = await requestPasswordReset(email.trim());
      if (error) {
        setStatus({ type: "error", message: error.message || "Could not start password reset." });
        return;
      }

      setStatus({
        type: "info",
        message: "Reset email sent (if the account exists). Open the email link to continue at /auth/callback → /reset-password.",
      });
    } catch (err) {
      setStatus({ type: "error", message: err?.message || "An unexpected error occurred." });
    } finally {
      setBusy(false);
    }
  };

  const onGoogleSignIn = async () => {
    setStatus({ type: "", message: "" });
    setBusy(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setStatus({ type: "error", message: error.message || "Could not start Google sign-in." });
        return;
      }

      // Typically, the browser redirects away immediately; this is a fallback message.
      setStatus({ type: "info", message: "Redirecting to Google…" });
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
    if (!recoveryReady) {
      return setStatus({
        type: "error",
        message: "Recovery session is not ready. Please open the recovery link again, or request a new password reset email.",
      });
    }

    setBusy(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) {
        setStatus({ type: "error", message: error.message || "Could not update password." });
        return;
      }

      // Remove hash/query to prevent "recovery" mode sticking on refresh.
      // Redirect to /admin after password update (login screen), matching the requested flow.
      window.history.replaceState(null, document.title, "/admin");

      setNewPassword("");
      setConfirmNewPassword("");

      setStatus({ type: "info", message: "Password updated. Redirecting to admin login…" });
      navigate("/admin", { replace: true });
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
                <Button type="submit" disabled={busy} style={{ width: "100%" }}>
                  {busy ? "Signing in..." : "Sign in"}
                </Button>
              </div>

              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={onGoogleSignIn}
                style={{
                  width: "100%",
                  justifyContent: "center",
                  marginTop: 10,
                  paddingTop: 12,
                  paddingBottom: 12,
                  fontSize: 15,
                  fontWeight: 1000,
                  borderColor: "rgba(37,99,235,0.20)",
                  background: "linear-gradient(180deg, rgba(37,99,235,0.06), rgba(255,255,255,0))",
                }}
              >
                Continue with Google
              </Button>

              {/* FORCE VISIBILITY: always-visible, large, prominent button directly under Sign in. */}
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={onForgotPassword}
                style={{
                  width: "100%",
                  justifyContent: "center",
                  marginTop: 12,
                  paddingTop: 12,
                  paddingBottom: 12,
                  fontSize: 15,
                  fontWeight: 1000,
                }}
              >
                Forgot password?
              </Button>

              <div className="row" style={{ marginTop: 10 }}>
                <Button type="button" variant="ghost" disabled={busy} onClick={() => setStatus({ type: "", message: "" })} style={{ width: "100%" }}>
                  Clear
                </Button>
              </div>
            </form>
          ) : (
            <form className="form" onSubmit={submitSetNewPassword}>
              <div className="alert alert-info" style={{ display: "grid", gap: 8 }}>
                <div>You opened a Supabase recovery link.</div>
                <div style={{ fontSize: 13, opacity: 0.95 }}>
                  Set a new password below. If the link is expired, go back to /admin and request a new reset email.
                </div>
              </div>

              {!recoveryReady ? (
                <div className={`alert ${status.type === "error" ? "alert-error" : "alert-info"}`}>
                  {busy ? "Validating recovery link…" : status.message || "Preparing recovery session…"}
                </div>
              ) : null}

              <Input
                label="New password"
                name="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                hint="Minimum 6 characters (Supabase default)."
                disabled={busy || !recoveryReady}
              />
              <Input
                label="Confirm new password"
                name="confirmNewPassword"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
                disabled={busy || !recoveryReady}
              />

              {status.message ? (
                <div className={`alert ${status.type === "error" ? "alert-error" : "alert-info"}`}>{status.message}</div>
              ) : null}

              <div className="row">
                <Button type="submit" disabled={busy || !recoveryReady}>
                  {busy ? "Updating..." : "Update password"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    // Best-effort: remove recovery params and go back to login UI.
                    window.history.replaceState(null, document.title, "/admin");
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
