// C34 T28-P2 RESEARCH ONLY. The original utils/useWallet.js is unchanged.
// Source-derived useWallet API: actor and Admin-selected wallet owner are separately scoped.
// NEVER import into the active application until signed browser, wallet_set and role review.
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { createT28P2CommerceGuardCandidate } from "./t28P2CommerceGuardCandidate.mjs";

export default function useWalletT28P2Research(userId) {
  const [uid, setUid] = useState(null);
  const [gp, setGp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const lastCommittedGp = useRef(null);
  const guardRef = useRef(null);
  if (!guardRef.current) {
    guardRef.current = createT28P2CommerceGuardCandidate({
      readStock: async () => [],
      readWallet: async target => {
        const {data,error} = await supabase.rpc("wallet_get",{p_user:target||null});
        if (error) throw error;
        return Number.isFinite(data) ? Number(data) : 0;
      },
      onStock: () => {},
      onWallet: value => { lastCommittedGp.current = value; setGp(value); },
      onError: error => setErr(String(error?.message || "Failed to load wallet."))
    });
  }
  const guard = guardRef.current;
  // Keep the selector current before an imperative refresh() can observe it.
  const userIdRef = useRef(userId || null);
  userIdRef.current = userId || null;

  useEffect(() => {
    let live = true;
    let authEventSeen = false;
    const handleAuth = (event, session) => {
      if (!live) return;
      authEventSeen = true;
      const next = session?.user?.id || null;
      if (event === "SIGNED_OUT" || event === "USER_UPDATED") guard.revoke();
      const prior = guard.snapshot().actorId;
      guard.observeActor(next);
      guard.selectWalletTarget(userIdRef.current);
      if (prior !== next || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setUid(next);
        lastCommittedGp.current = null;
        setGp(null);
        setErr("");
      }
      if (!next) setLoading(false);
      else if (prior !== next || event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        setLoading(true);
        void guard.loadWallet().then(result => {
          if (live && result.committed) setLoading(false);
        });
      }
    };
    const {data} = supabase.auth.onAuthStateChange(handleAuth);
    void supabase.auth.getSession().then(({data:sessionData,error}) => {
      // The async snapshot may be older than a SIGNED_OUT/IN event; never revive it.
      if (!live || authEventSeen) return;
      if (error) {
        setErr(String(error.message || error));
        setLoading(false);
        return;
      }
      handleAuth("INITIAL_SESSION",sessionData?.session || null);
    }).catch(error => {
      if (live && !authEventSeen) {
        setErr(String(error?.message || error));
        setLoading(false);
      }
    });
    return () => {
      live = false;
      data?.subscription?.unsubscribe();
      guard.dispose();
    };
  }, [guard]);

  useEffect(() => {
    guard.selectWalletTarget(userId || null);
    if (!guard.snapshot().actorId) return;
    setErr("");
    setLoading(true);
    let live = true;
    void guard.loadWallet().then(result => {
      if (live && result.committed) setLoading(false);
    });
    return () => {live = false};
  }, [guard,userId]);

  const refresh = async () => {
    guard.selectWalletTarget(userIdRef.current);
    const result = await guard.loadWallet();
    if (result.error && !guard.snapshot().stopped) throw result.error;
    return result.committed ? lastCommittedGp.current : null;
  };
  const set = async amount => {
    guard.selectWalletTarget(userIdRef.current);
    const start = guard.snapshot();
    if (!start.actorId) return {data:null,error:new Error("Sign in to edit wallet")};
    const {data,error} = await supabase.rpc("wallet_set",{
      p_user:userIdRef.current||null,p_amount:Number(amount)
    });
    const end = guard.snapshot();
    if (start.actorId === end.actorId && start.actorEpoch === end.actorEpoch &&
        start.targetEpoch === end.targetEpoch && start.targetUserId === end.targetUserId &&
        !end.stopped && !error) {
      const nextGp = Number.isFinite(data) ? Number(data) : null;
      lastCommittedGp.current = nextGp;
      setGp(nextGp);
    }
    return {data,error};
  };

  const label = useMemo(() => {
    if (gp == null) return "GP: …";
    if (Number(gp) === -1) return "GP: ∞";
    const n = Number(gp);
    if (!Number.isFinite(n)) return "GP: 0";
    const s = String(n);
    return "GP: "+(s.endsWith(".0") ? s.slice(0,-2) : s);
  },[gp]);

  return {uid,gp,loading,err,label,refresh,set};
}
