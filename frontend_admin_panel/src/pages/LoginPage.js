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

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) return setError("Email is required.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    setBusy(true);
    try {
      // Step 1: authenticate
      const u = await dataService.login(email.trim(), password);

      // Step 2 (canonical): load profile by id=auth.uid() and gate on role='admin'
      // This avoids relying on any fallback role value and ensures we surface RLS/profile issues clearly.
      const profile = await dataService.getCurrentProfile();

      if (!profile) {
        throw new Error(
          "Signed in, but your profile could not be loaded. Ensure public.profiles has a row with id = auth.uid() and role = 'admin', and that RLS permits select."
        );
      }

      if (profile.role !== "admin") {
        throw new Error(`This portal is for admins only. Your role is '${profile.role || "unknown"}'.`);
      }

      onAuthed?.({ ...u, role: "admin" });
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

      <Card title="Login" subtitle="Demo admin: admin@example.com / password123">
        <form className="form" onSubmit={submit}>
          <Input label="Email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Password" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error ? <div className="alert alert-error">{error}</div> : null}
          <div className="row">
            <Button type="submit" disabled={busy}>
              {busy ? "Signing in..." : "Sign in"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
