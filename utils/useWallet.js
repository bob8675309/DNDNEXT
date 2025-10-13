// /utils/useWallet.js
// Hook for reading and changing GP (player wallet).
// - For a normal player (no userId passed): uses RPC wallet_get() to read own GP
// - For admin viewing another user (userId passed): reads/writes that wallet
// - Supports -1 (infinite) semantics on the server

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";

export default function useWallet(userId = null) {
  const [uid, setUid] = useState(null);
  const [gp, setGp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const me = sess?.session?.user?.id || null;
      setUid(me);

      // Read wallet
      if (userId && userId !== me) {
        // Admin peeking another user
        const { data, error } = await supabase
          .from("player_wallets")
          .select("gp")
          .eq("user_id", userId)
          .maybeSingle();
        if (error) throw error;
        setGp(Number(data?.gp ?? 0));
      } else {
        // Self
        const { data, error } = await supabase.rpc("wallet_get");
        if (error) throw error;
        setGp(Number(data ?? 0));
      }
    } catch (e) {
      setErr(e.message || "Wallet error");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
    // live updates when the row changes
    const ch = supabase
      .channel("wallet-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "player_wallets" },
        refresh
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [refresh]);

  // Spend GP (negative add); server enforces rules and infinite wallet
  const spend = useCallback(
    async (amount) => {
      setErr("");
      if (!amount || amount <= 0) return { data: gp };
      if (gp === -1) return { data: -1 }; // infinite; server will accept anyway
      try {
        const { data, error } = await supabase.rpc("wallet_add", {
          p_user: userId || uid,
          p_delta: -Math.abs(Number(amount)),
        });
        if (error) throw error;
        await refresh();
        return { data };
      } catch (e) {
        setErr(e.message || "Spend failed");
        return { error: e };
      }
    },
    [uid, userId, gp, refresh]
  );

  // Grant (or remove) GP as admin (positive or negative delta)
  const grant = useCallback(
    async (delta) => {
      setErr("");
      try {
        const { data, error } = await supabase.rpc("wallet_add", {
          p_user: userId || uid,
          p_delta: Number(delta || 0),
        });
        if (error) throw error;
        await refresh();
        return { data };
      } catch (e) {
        setErr(e.message || "Grant failed");
        return { error: e };
      }
    },
    [uid, userId, refresh]
  );

  // Force a wallet to infinite (-1)
  const setInfinite = useCallback(async () => {
    setErr("");
    try {
      const { data, error } = await supabase.rpc("wallet_set", {
        p_user: userId || uid,
        p_amount: -1,
      });
      if (error) throw error;
      await refresh();
      return { data };
    } catch (e) {
      setErr(e.message || "Set infinite failed");
      return { error: e };
    }
  }, [uid, userId, refresh]);

  return { uid, gp, loading, err, refresh, spend, grant, setInfinite };
}
