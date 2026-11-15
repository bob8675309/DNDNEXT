// C34 T26 RESEARCH ONLY — safe non-map Profile + ORIGINAL MerchantPanel.
// No active route imports this. No world-map imports or modifications.
// The shared components/NpcPanel.js still has legacy readers and MUST NOT
// be mounted in this temporary Stage2-protected signed browser test.
import { useEffect, useRef, useState } from "react";
import MerchantPanel from "../MerchantPanel";
import { supabase } from "../../utils/supabaseClient";
import { readNonMapNpcProfileCandidate } from "../../utils/c34/readNonMapNpcProfileCandidate.mjs";

export default function NonMapMerchantShopResearchPanel({
  npc = null, character = null, initialView = "profile", onClose = null,
  isAdmin = false, locations = []
}) {
  const selected = character || npc;
  const selectedId = String(selected?.id || "");
  const selectedKind = String(selected?.kind || selected?.type || "").toLowerCase();
  const [profileState, setProfileState] = useState(null);
  const [view, setView] = useState("profile");
  const [identityEpoch, setIdentityEpoch] = useState(0);
  const [currentActor, setCurrentActor] = useState(null);
  const actorRef = useRef(null);
  const requestRef = useRef(0);

  // Every actor switch invalidates all prior shop/private state immediately.
  // Do not await Supabase calls from onAuthStateChange. A late prior-user RPC
  // cannot install a Profile after logout, account change or USER_UPDATED.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const actor = session?.user?.id || null;
      if (actor === actorRef.current && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      actorRef.current = actor;
      requestRef.current += 1;
      setCurrentActor(actor);
      setProfileState(null);
      setView("profile");
      setIdentityEpoch(value => value + 1);
    });
    return () => data?.subscription?.unsubscribe();
  }, []);

  useEffect(() => {
    const requestId = ++requestRef.current;
    let cancelled = false;
    setProfileState(null);
    setView(initialView === "shop" ? "shop" : "profile");
    const load = async () => {
      if (!selectedId || !["npc", "merchant"].includes(selectedKind)) return;
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      const actor = auth?.user?.id || null;
      if (cancelled || requestId !== requestRef.current) return;
      if (authErr || !actor || actorRef.current !== actor) return;
      const result = await readNonMapNpcProfileCandidate(supabase, selectedId, {
        withDossier: false, withSheet: false, withPrivateBackstory: false
      });
      if (cancelled || requestId !== requestRef.current || actorRef.current !== actor) return;
      if (result.status !== "ok" || !result.profile ||
          String(result.profile.id) !== selectedId ||
          result.profile.kind !== selectedKind) return;
      setProfileState({ actor, characterId: selectedId, profile: result.profile });
    };
    void load();
    return () => { cancelled = true; requestRef.current += 1; };
  }, [selectedId, selectedKind, identityEpoch, initialView]);

  const approved = profileState?.actor && profileState.actor === currentActor &&
    profileState.characterId === selectedId &&
    profileState.profile?.id === selectedId &&
    profileState.profile?.kind === selectedKind
      ? profileState.profile : null;
  const canShop = approved?.kind === "merchant" && approved.storefront_enabled === true;

  if (!approved) {
    return <section className="npc-panel-inner" data-testid="t26-profile-unavailable">
      <p>Public Profile unavailable until the signed server reader authorizes it.</p>
      <button type="button" className="btn btn-sm btn-outline-light"
        onClick={() => onClose?.()}>Close Profile</button>
    </section>;
  }

  if (view === "shop" && canShop) {
    // ORIGINAL current MerchantPanel and MerchantStorefrontView, not a mock.
    // Non-map research intentionally withholds merchant travel/admin writes.
    return <section className="npc-panel-inner" data-testid="t26-real-merchant-shop"
      data-character-id={selectedId} data-actor-id={currentActor}>
      <div className="d-flex justify-content-end gap-2 my-2">
        <button type="button" className="btn btn-sm btn-outline-light"
          onClick={() => setView("profile")}>Return to Profile</button>
        <button type="button" className="btn btn-sm btn-outline-light"
          onClick={() => onClose?.()}>Close Profile</button>
      </div>
      <MerchantPanel key={currentActor + ":" + selectedId}
        merchant={approved} isAdmin={false} locations={locations}
        presentation="panel" onBackToProfile={() => setView("profile")}
        onClose={() => setView("profile")} />
    </section>;
  }

  return <section className="npc-panel-inner" data-testid="t26-safe-merchant-profile"
    data-character-id={selectedId} data-actor-id={currentActor}>
    <div className="d-flex justify-content-between align-items-center my-2">
      <h3 className="h5 mb-0">{approved.name || "Character"}</h3>
      <button type="button" className="btn btn-sm btn-outline-light"
        onClick={() => onClose?.()}>Close Profile</button>
    </div>
    <div className="npc-card">
      <div className="npc-card-title">Description</div>
      <p>{approved.description || "No description yet."}</p>
      {approved.lore?.background ? <p>{approved.lore.background}</p> : null}
    </div>
    <div className="npc-card">
      <div className="npc-card-title">Talk</div>
      {canShop ? <button type="button" className="btn btn-sm btn-warning"
        onClick={() => setView("shop")}>Let me browse your wares.</button> : null}
      <button type="button" className="btn btn-sm btn-primary" disabled>Ask about rumors</button>
    </div>
  </section>;
}
