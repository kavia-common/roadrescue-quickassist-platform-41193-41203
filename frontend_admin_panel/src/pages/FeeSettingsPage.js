import React, { useEffect, useState } from "react";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { dataService } from "../services/dataService";

// PUBLIC_INTERFACE
export function FeeSettingsPage() {
  /** Fee parameter management: base fee, per-mile fee, after-hours multiplier. */
  const [fees, setFees] = useState({ baseFee: 25, perMile: 2.0, afterHoursMultiplier: 1.25 });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const f = await dataService.getFees();
        if (mounted) setFees(f);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");

    const baseFee = Number(fees.baseFee);
    const perMile = Number(fees.perMile);
    const afterHoursMultiplier = Number(fees.afterHoursMultiplier);
    if (Number.isNaN(baseFee) || baseFee < 0) return setError("Base fee must be a valid number >= 0.");
    if (Number.isNaN(perMile) || perMile < 0) return setError("Per-mile fee must be a valid number >= 0.");
    if (Number.isNaN(afterHoursMultiplier) || afterHoursMultiplier < 1) return setError("After-hours multiplier must be >= 1.0.");

    setBusy(true);
    try {
      await dataService.setFees({ baseFee, perMile, afterHoursMultiplier });
      setMsg("Fees saved.");
    } catch (e2) {
      setError(e2.message || "Could not save fees.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container">
      <div className="hero">
        <h1 className="h1">Fee Settings</h1>
        <p className="lead">Simple numeric parameters stored in the data layer.</p>
      </div>

      <Card title="Fees" subtitle="Used for pricing logic later (MVP stores values only).">
        <form className="form" onSubmit={save}>
          <Input
            label="Base fee ($)"
            name="baseFee"
            type="number"
            value={String(fees.baseFee)}
            onChange={(e) => setFees((f) => ({ ...f, baseFee: e.target.value }))}
            required
          />
          <Input
            label="Per-mile fee ($)"
            name="perMile"
            type="number"
            value={String(fees.perMile)}
            onChange={(e) => setFees((f) => ({ ...f, perMile: e.target.value }))}
            required
          />
          <Input
            label="After-hours multiplier"
            name="afterHoursMultiplier"
            type="number"
            value={String(fees.afterHoursMultiplier)}
            onChange={(e) => setFees((f) => ({ ...f, afterHoursMultiplier: e.target.value }))}
            required
            hint="Example: 1.25 for +25%."
          />

          {msg ? <div className="alert">{msg}</div> : null}
          {error ? <div className="alert alert-error">{error}</div> : null}

          <div className="row">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving..." : "Save fees"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
