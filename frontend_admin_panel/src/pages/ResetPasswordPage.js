import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { dataService } from "../services/dataService";

/**
 * Dedicated Supabase password reset page.
 *
 * Supabase reset/recovery links must land on a real frontend route.
 * This page supports:
 * - token-in-hash recovery links (#access_token=...&type=recovery)
 * - query param recovery links (?type=recovery&access_token=...)
 * - PKCE links (?code=...) which must be exchanged for a session first
 */

// PUBLIC_INTERFACE
export function ResetPasswordPage() {
  /** Completes Supabase password recovery by setting a new password, then redirects to /admin. */
  const navigate = useNavigate();

  const [busy, setBusy] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const supabaseConfigured = useMemo(() => dataService.isSupabaseConfigured?.(), []);

  useEffect(() => {
    // If this route is opened directly (no tokens), still allow the UI, but show guidance.
    const hash = window.location.hash || "";
    const search = window.location.search || "";

    const paramsFromHash = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const paramsFromSearch = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

    const type = (paramsFromSearch.get("type") || paramsFromHash.get("type") || "").toLowerCase();
    const hasRecoveryType = type === "recovery";
    const hasAccessToken = Boolean(paramsFromSearch.get("access_token") || paramsFromHash.get("access_token"));
    const hasRefreshToken = Boolean(paramsFromSearch.get("refresh_token") || paramsFromHash.get("refresh_token"));
    const hasCode = Boolean(paramsFromSearch.get("code"));

    const looksLikeRecoveryLink = hasRecoveryType || hasAccessToken || hasRefreshToken || hasCode;

    if (!looksLikeRecoveryLink) {
      setStatus({
        type: "info",
        message: "To reset your password, open the password reset link from your email.",
      });
    } else {
      setStatus({
        type: "info",
        message: "Recovery link detected. Please set a new password.",
      });
    }
  }, []);

  useEffect(() => {
    // Validate / prepare recovery session (PKCE exchange if needed).
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
          // Token-in-hash flows: Supabase JS typically parses it automatically; ensure we have best-effort session.
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
  }, [supabaseConfigured]);

  const onSubmit = async (e) => {
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
      await dataService.updatePassword(newPassword);

      // Clear recovery params so refresh doesn't stick in recovery mode.
      window.history.replaceState(null, document.title, "/admin");

      setStatus({ type: "info", message: "Password updated. Redirecting to admin login…" });

      // Redirect to /admin (requested).
      navigate("/admin", { replace: true });
    } catch (err) {
      setStatus({ type: "error", message: err?.message || "Could not update password." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container" style={{ paddingTop: 28 }}>
      <div className="hero">
        <h1 className="h1">Reset Password</h1>
        <p className="lead">Set a new password for your admin account.</p>
      </div>

      <div style={{ maxWidth: 520 }}>
        <Card title="Choose a new password" subtitle="This page is opened from the reset email link.">
          <form className="form" onSubmit={onSubmit}>
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
              <Button type="button" variant="ghost" disabled={busy} onClick={() => navigate("/admin", { replace: true })}>
                Back to admin login
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
