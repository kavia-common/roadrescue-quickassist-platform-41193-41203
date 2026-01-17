import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { dataService } from "../services/dataService";

/**
 * PUBLIC_INTERFACE
 */
// PUBLIC_INTERFACE
export function useSupabaseRealtimeRefresh({
  /**
   * Tables to subscribe to for realtime updates.
   * Example: [{ schema: "public", table: "requests" }, { schema: "public", table: "profiles" }]
   */
  tables,
  /**
   * Callback invoked when any subscribed table changes.
   * This should typically call the page's `load()` method.
   */
  onChange,
  /**
   * Polling fallback interval (ms). Set 0/false to disable polling.
   * Polling is useful when realtime isn't enabled or RLS prevents realtime delivery.
   */
  pollIntervalMs = 15000,
  /**
   * Enable/disable realtime subscriptions. When false, only polling/manual refresh are used.
   */
  enableRealtime = true,
} = {}) {
  const [lastRefreshAt, setLastRefreshAt] = useState(null);
  const [realtimeStatus, setRealtimeStatus] = useState("idle"); // idle | connected | disabled | error
  const [realtimeError, setRealtimeError] = useState("");

  const stableTables = useMemo(() => {
    const arr = Array.isArray(tables) ? tables : [];
    // Normalize and provide stable identity for effect deps.
    return arr
      .filter((t) => t && t.table)
      .map((t) => ({
        schema: t.schema || "public",
        table: t.table,
      }));
  }, [tables]);

  const changeHandlerRef = useRef(onChange);
  useEffect(() => {
    changeHandlerRef.current = onChange;
  }, [onChange]);

  const refresh = useCallback(async () => {
    try {
      setRealtimeError("");
      await changeHandlerRef.current?.();
      setLastRefreshAt(new Date());
    } catch (e) {
      // This is a page-provided load error; surface it here as a helper string.
      setRealtimeError(e?.message || "Refresh failed.");
      setLastRefreshAt(new Date());
    }
  }, []);

  useEffect(() => {
    const supabase = dataService.getSupabaseClient?.();
    const configured = dataService.isSupabaseConfigured?.();

    if (!configured || !supabase) {
      setRealtimeStatus("disabled");
      return undefined;
    }

    if (!enableRealtime || !stableTables.length) {
      setRealtimeStatus("disabled");
      return undefined;
    }

    setRealtimeStatus("idle");
    setRealtimeError("");

    // One channel per page; subscribe to multiple tables via .on(...)
    const channel = supabase.channel(`admin-panel-realtime:${stableTables.map((t) => t.table).join(",")}`);

    stableTables.forEach((t) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: t.schema, table: t.table },
        async () => {
          // Trigger page reload on any insert/update/delete.
          await refresh();
        }
      );
    });

    channel.subscribe((status, err) => {
      if (status === "SUBSCRIBED") {
        setRealtimeStatus("connected");
      } else if (status === "CHANNEL_ERROR") {
        setRealtimeStatus("error");
        setRealtimeError(err?.message || "Realtime channel error.");
      } else if (status === "TIMED_OUT") {
        setRealtimeStatus("error");
        setRealtimeError("Realtime subscription timed out.");
      }
    });

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
    };
  }, [enableRealtime, refresh, stableTables]);

  useEffect(() => {
    const configured = dataService.isSupabaseConfigured?.();
    if (!configured) return undefined;

    if (!pollIntervalMs) return undefined;

    const id = window.setInterval(() => {
      // Polling fallback in case realtime isn't delivering.
      refresh();
    }, pollIntervalMs);

    return () => window.clearInterval(id);
  }, [pollIntervalMs, refresh]);

  return {
    refresh,
    lastRefreshAt,
    realtimeStatus,
    realtimeError,
  };
}
