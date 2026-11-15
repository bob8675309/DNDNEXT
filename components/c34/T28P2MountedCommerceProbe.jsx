// C34 T28-P2 disposable CURRENT Next/React NON-MAP research probe.
// Exact original merchant and wallet product modules remain untouched; only
// source-derived guarded equivalents are mounted on a CI-created route.
import { useEffect, useState } from "react";
import MerchantPanelT28P2Research from "./MerchantPanelT28P2Research";
import useWalletT28P2Research from "../../utils/c34/useWalletT28P2Research";
import {supabase} from "../../utils/supabaseClient";

function WalletPane({targetId}) {
  const wallet=useWalletT28P2Research(targetId);
  const [outcome,setOutcome]=useState("");
  return <section data-testid="t28p2-wallet-owner">
    <output data-testid="t28p2-wallet-value">{wallet.gp == null ? "NONE" : String(wallet.gp)}</output>
    <output data-testid="t28p2-wallet-uid">{wallet.uid || "ANON"}</output>
    <output data-testid="t28p2-wallet-error">{wallet.err}</output>
    <output data-testid="t28p2-wallet-outcome">{outcome}</output>
    <button data-testid="t28p2-wallet-refresh" type="button"
      onClick={() => {void wallet.refresh().then(v=>setOutcome(v==null?"STALE":String(v))).catch(e=>setOutcome("ERROR "+String(e?.message||e)));}}>
      Refresh signed wallet
    </button>
    <button data-testid="t28p2-wallet-set" type="button"
      onClick={() => {void wallet.set(66).then(r=>setOutcome(r.error?"ERROR "+String(r.error.message):"SET "+String(r.data))).catch(e=>setOutcome("ERROR "+String(e?.message||e)));}}>
      Set disposable wallet to 66
    </button>
  </section>;
}
export default function T28P2MountedCommerceProbe({merchant,alternateMerchant}) {
  const [actor,setActor]=useState(null);
  const [ready,setReady]=useState(false);
  const [selected,setSelected]=useState(merchant);
  const [walletTarget,setWalletTarget]=useState(null);
  const [showShop,setShowShop]=useState(true);
  useEffect(()=>{
    let active=true,notified=false;
    window.__sb=supabase;
    const update=(event,session)=>{
      if(!active)return;
      notified=true;
      setActor(session?.user?.id || null);
      if(event==="SIGNED_OUT"||event==="USER_UPDATED")setWalletTarget(null);
      setReady(true);
    };
    const {data}=supabase.auth.onAuthStateChange(update);
    void supabase.auth.getSession().then(({data:result})=>{
      if(active&&!notified)update("INITIAL_SESSION",result?.session||null);
    });
    return ()=>{
      active=false;
      data?.subscription?.unsubscribe();
      if(window.__sb===supabase)delete window.__sb;
    };
  },[]);
  return <main data-testid="t28p2-root" data-ready={String(ready)}>
    <output data-testid="t28p2-actor">{actor||"ANON"}</output>
    <button type="button" data-testid="t28p2-switch-merchant"
      onClick={()=>setSelected(previous=>previous.id===merchant.id?alternateMerchant:merchant)}>
      Switch merchant
    </button>
    <output data-testid="t28p2-merchant-id">{selected.id}</output>
    <button type="button" data-testid="t28p2-select-wallet-self"
      onClick={()=>setWalletTarget(null)}>Wallet owner self</button>
    <button type="button" data-testid="t28p2-select-wallet-other"
      onClick={()=>setWalletTarget(walletTarget===null?"00000000-0000-4000-8000-000000000099":null)}>
      Change selected wallet target
    </button>
    <WalletPane targetId={walletTarget} />
    <button type="button" data-testid="t28p2-shop-toggle" onClick={()=>setShowShop(v=>!v)}>Shop mount toggle</button>
    {showShop?<section data-testid="t28p2-mounted-shop">
      <MerchantPanelT28P2Research merchant={selected} locations={[]} isAdmin={false}
        presentation="panel" onBackToProfile={()=>setShowShop(false)}
        onClose={()=>setShowShop(false)} />
    </section>:null}
  </main>;
}
