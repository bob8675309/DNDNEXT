// /utils/useWallet.js
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * useWallet
 * - Reads gp from RPC wallet_get()
 * - Live-updates via pg changes on player_wallets
 * - Helpers: add(delta), set(value), spend(amount)  (all server-authoritative)
 * - gp === -1 means "infinite" (client won't block spends)
 */
export default function useWallet() {
  const [uid, setUid] = useState(null);
  const [gp, setGp] = useState(null);     // null=loading, -1=infinite, >=0 numeric
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // --- load current user + wallet
  useEffect(() => {
    let unsub;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user?.id || null;
      setUid(userId);
      if (!userId) { setGp(0); setLoading(false); return; }
      await refresh(userId);

      // live updates (any change to my row)
      const ch = supabase
        .channel("wallet-self")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "player_wallets", filter: `user_id=eq.${userId}` },
          () => refresh(userId)
        )
        .subscribe();
      unsub = () => supabase.removeChannel(ch);
    })();
    return () => unsub?.();
  }, []);

  async function refresh(userId = uid) {
    if (!userId) return;
    setLoading(true);
    setErr("");
    try {
      const { data, error } = await supabase.rpc("wallet_get", { p_user: userId });
      if (error) throw error;
      setGp(typeof data === "number" ? data : 0);
    } catch (e) {
      setErr(e.message || "Wallet load failed.");
    } finally { setLoading(false); }
  }

  // --- mutations
  async function add(delta) {
    if (!uid) return { error: "No user" };
    const { data, error } = await supabase.rpc("wallet_add", { p_user: uid, p_delta: Number(delta) });
    if (!error) setGp(typeof data === "number" ? data : gp);
    return { data, error };
  }
  async function set(value) {
    if (!uid) return { error: "No user" };
    const { data, error } = await supabase.rpc("wallet_set", { p_user: uid, p_amount: Number(value) });
    if (!error) setGp(typeof data === "number" ? data : gp);
    return { data, error };
  }
  async function spend(amount) {
    // client-side guard (server still enforces)
    if (gp !== -1 && Number(amount) > (Number(gp) || 0)) {
      return { error: new Error("Not enough gp") };
    }
    return add(-Math.abs(Number(amount)));
  }

  return useMemo(() => ({
    gp, loading, err, refresh, add, set, spend, uid
  }), [gp, loading, err, uid]);
}
