// T28-P1 STRICTLY UNMOUNTED RESEARCH PROBE. Not imported by active routes.
// Original MerchantPanel/useWallet in an intentionally unsafe PERSISTENT owner,
// alongside a separate guarded scratch-only PostgREST candidate. Never deploy.
import { useEffect, useRef, useState } from "react";
import MerchantPanel from "../MerchantPanel";
import useWallet from "../../utils/useWallet";
import { supabase } from "../../utils/supabaseClient";
import { createNonMapActorEpochCandidate } from "../../utils/c34/actorRequestEpochCandidate.mjs";

function UnsafeOriginalPersistentLane({ merchant }) {
  // The original hook and original MerchantPanel are unmodified, genuinely
  // mounted across auth changes: this is a negative control, not the product.
  const wallet = useWallet();
  const [showShop, setShowShop] = useState(false);
  const [lastError, setLastError] = useState("");
  return <section data-testid="t28-unsafe-original">
    <output data-testid="t28-unsafe-wallet">{wallet.loading ? "LOADING" : String(wallet.gp)}</output>
    <button type="button" data-testid="t28-original-refresh-wallet"
      onClick={() => { void wallet.refresh().catch(e => setLastError(String(e?.message || e))); }}>
      Refresh original wallet
    </button>
    <button type="button" data-testid="t28-original-open-shop"
      onClick={() => setShowShop(true)}>Open original merchant shop (unsafe test only)</button>
    <output data-testid="t28-unsafe-error">{lastError}</output>
    {showShop ? <section data-testid="t28-original-mounted-shop">
      <MerchantPanel merchant={merchant} isAdmin={false} locations={[]}
        presentation="panel" onClose={() => setShowShop(false)}
        onBackToProfile={() => setShowShop(false)} />
    </section> : null}
  </section>;
}

export default function T28NonMapPersistentResearchProbe({ merchant, alternateMerchant }) {
  const [actor, setActor] = useState(null);
  const [unsafeVisible, setUnsafeVisible] = useState(true);
  const [selectedId, setSelectedId] = useState(merchant.id);
  const [candidateRows, setCandidateRows] = useState([]);
  const [candidateGp, setCandidateGp] = useState(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const guard = useRef(null);
  const selectedRef = useRef(merchant.id);
  const actorRef = useRef(null);
  if (!guard.current) guard.current = createNonMapActorEpochCandidate();

  useEffect(() => {
    window.__sb = supabase;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Do NOT await an SDK/network call in this synchronous callback.
      const id = session?.user?.id || null;
      if (event === "TOKEN_REFRESHED" && id === actorRef.current) return;
      actorRef.current = id;
      if (event === "SIGNED_OUT" || event === "USER_UPDATED") guard.current.revoke();
      guard.current.observeActor(id);
      if (id) guard.current.selectMerchant(selectedRef.current);
      setActor(id);
      setCandidateRows([]);
      setCandidateGp(null);
      setError("");
      setReady(true);
    });
    return () => {
      data?.subscription?.unsubscribe();
      guard.current.dispose();
      if (window.__sb === supabase) delete window.__sb;
    };
  }, []);

  const chooseMerchant = next => {
    selectedRef.current = next;
    guard.current.selectMerchant(next);
    setSelectedId(next);
    setCandidateRows([]);
  };
  const guardedLoad = () => {
    const stockTicket = guard.current.capture("stock");
    const walletTicket = guard.current.capture("wallet");
    if (!stockTicket || !walletTicket) return;
    // The queries mirror the original current MerchantPanel.fetchStock and
    // useWallet.refresh paths but the ONLY state commits are scope-ticketed.
    void supabase.from("character_stock").select("*")
      .eq("character_id", stockTicket.merchantId)
      .order("display_name", { ascending: true })
      .then(({data,error:readError}) => {
        guard.current.settle(stockTicket, () => {
          if (readError) setError(String(readError.message || readError));
          else setCandidateRows(data || []);
        });
      }).catch(e => { guard.current.settle(stockTicket, () => setError(String(e))); });
    void supabase.rpc("wallet_get",{p_user:null})
      .then(({data,error:readError}) => {
        guard.current.settle(walletTicket, () => {
          if (readError) setError(String(readError.message || readError));
          else setCandidateGp(Number(data));
        });
      }).catch(e => { guard.current.settle(walletTicket, () => setError(String(e))); });
  };
  return <main data-testid="t28-persistent-owner" data-ready={String(ready)}>
    <output data-testid="t28-actor">{actor || "ANON"}</output>
    <button type="button" data-testid="t28-hide-unsafe"
      onClick={() => setUnsafeVisible(false)}>Dispose unsafe negative control</button>
    {unsafeVisible ? <UnsafeOriginalPersistentLane merchant={merchant} /> : null}
    <section data-testid="t28-candidate-scoped" data-merchant-id={selectedId}>
      <button type="button" data-testid="t28-candidate-load" onClick={guardedLoad}>
        Fetch genuine signed guarded stock and wallet
      </button>
      <button type="button" data-testid="t28-switch-merchant"
        onClick={() => chooseMerchant(selectedId === merchant.id ? alternateMerchant.id : merchant.id)}>
        Switch selected merchant
      </button>
      <output data-testid="t28-candidate-wallet">{candidateGp == null ? "NONE" : String(candidateGp)}</output>
      <div data-testid="t28-candidate-stock">
        {candidateRows.map(row => <span key={row.id} data-testid="t28-candidate-item">{row.display_name}</span>)}
      </div>
      <output data-testid="t28-candidate-error">{error}</output>
    </section>
  </main>;
}
