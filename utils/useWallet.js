// /utils/useWallet.js
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

/**
 * useWallet()
 * - Player: reads own gp via RPC wallet_get(p_user := null)
 * - Admin with a selected userId: reads that user’s gp via wallet_get(p_user := <uuid>)
 * - Supports -1 (infinite) semantics everywhere.
 */
export default function useWallet(userId) {
  const [uid, setUid] = useState(null);
  const [gp, setGp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setErr(""); setLoading(true);
      const { data: sess } = await supabase.auth.getSession();
      const me = sess?.session?.user?.id || null;
      if (alive) setUid(me);

      // Always pass the parameter; NULL means “self”
      const { data, error } = await supabase.rpc("wallet_get", {
        p_user: userId || null,
      });

      if (alive) {
        if (error) setErr(error.message || "Failed to load wallet.");
        setGp(Number.isFinite(data) ? Number(data) : 0);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  async function refresh() {
    const { data, error } = await supabase.rpc("wallet_get", {
      p_user: userId || null,
    });
    if (error) throw error;
    setGp(Number.isFinite(data) ? Number(data) : 0);
    return data;
  }

  // Spend gp via wallet_add (negative delta). Respects -1 (=infinite).
  async function spend(amount) {
    if (!amount || amount <= 0) return { data: gp, error: null };
    const { data, error } = await supabase.rpc("wallet_add", {
      p_user: userId || null,
      p_delta: -Number(amount),
    });
    if (!error) setGp(Number.isFinite(data) ? Number(data) : gp);
    return { data, error };
  }

  async function add(amount) {
    const { data, error } = await supabase.rpc("wallet_add", {
      p_user: userId || null,
      p_delta: Number(amount),
    });
    if (!error) setGp(Number.isFinite(data) ? Number(data) : gp);
    return { data, error };
  }

  async function set(amount) {
    const { data, error } = await supabase.rpc("wallet_set", {
      p_user: userId || null,
      p_amount: Number(amount),
    });
    if (!error) setGp(Number.isFinite(data) ? Number(data) : gp);
    return { data, error };
  }

  return {
    uid,
    gp,
    loading,
    err,
    refresh,
    spend,
    add,
    set,
  };
}
