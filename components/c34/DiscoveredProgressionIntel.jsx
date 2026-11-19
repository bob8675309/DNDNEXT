// C34 T46-P2: UNMOUNTED research-only player-specific discovery display.
// This module is never imported by the production /npcs, map, town or _app.
// The existing source-original PR #345 NPC profile and private dossier are
// separate authority surfaces. This uses the T46 per-user safe projection\n// AND ONLY the published public clue from source-original #345 Stage3.\n// A deployment MUST atomically install Stage3; Stage1's legacy secret field\n// is unsafe. This candidate is intentionally unmounted until that cutover.
import { useCallback, useEffect, useRef, useState } from "react";

const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isId=value=>ID.test(String(value||""));
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const safeText=(v,max=120)=>typeof v==="string"?v.slice(0,max):"";

export function sanitizeDiscoveredProgression(raw,requestedId) {
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
     !isId(requestedId)||String(raw.characterId||"").toLowerCase()!==String(requestedId).toLowerCase())
    return null;
  const next={};
  if(raw.class&&typeof raw.class==="object"&&!Array.isArray(raw.class)&&
     typeof raw.class.name==="string"&&raw.class.name.trim()) {
    next.class={name:safeText(raw.class.name).trim(),
      source:safeText(raw.class.source,30)};
  }
  if(own(raw,"level")&&Number.isSafeInteger(raw.level)&&raw.level>=1&&raw.level<=20)
    next.level=raw.level;
  if(own(raw,"xp")&&Number.isSafeInteger(raw.xp)&&raw.xp>=0)
    next.xp=raw.xp;
  return Object.keys(next).length?next:null;
}

// This property is curated by original #345 Stage3 from
// public.character_public_secret_revelations, NOT characters.secret and
// NOT character_sheets.sheet.profileReveal.secret. Its server function must
// be source-verified as Stage3 BEFORE this research UI is ever mounted.
export function sanitizeStage3PublishedClue(raw,requestedId) {
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||
     String(raw.id||"").toLowerCase()!==String(requestedId||"").toLowerCase())
    return null;
  const clue=raw.lore?.secret;
  return typeof clue==="string"&&clue.trim()?clue.trim().slice(0,1200):null;
}

export default function DiscoveredProgressionIntel({client,characterId}) {
  const [epoch,setEpoch]=useState(0);
  const [refresh,setRefresh]=useState(0);
  const [result,setResult]=useState(null);
  const [loading,setLoading]=useState(false);
  const sequence=useRef(0);
  const sessionId=useRef(null);
  const clear=useCallback(()=>{
    sequence.current+=1;
    setResult(null);
    setLoading(false);
  },[]);
  useEffect(()=>{
    if(!client?.auth?.onAuthStateChange)return undefined;
    const {data}=client.auth.onAuthStateChange((event,session)=>{
      const newId=session?.user?.id||null;
      const priorId=sessionId.current;
      sessionId.current=newId;
      if(event==="SIGNED_OUT"||(priorId!==null&&priorId!==newId))
        clear();
      if(["SIGNED_OUT","SIGNED_IN","INITIAL_SESSION","TOKEN_REFRESHED","USER_UPDATED"].includes(event))
        setEpoch(e=>e+1);
      // Critically, do not call getSession/getUser/RPC inside this callback.
    });
    return ()=>data?.subscription?.unsubscribe();
  },[client,clear]);
  useEffect(()=>{
    clear();
    if(!client?.rpc||!client?.auth?.getUser||!isId(characterId))
      return undefined;
    const generation=++sequence.current;
    let active=true;
    setLoading(true);
    (async()=>{
      try {
        const first=await client.auth.getUser();
        const actor=first?.data?.user?.id;
        if(!isId(actor)||first.error)return;
        // Both responses come from signed server functions. Only Stage3's
        // sanitized, explicitly GM-PUBLISHED clue is considered; the raw
        // character, GM dossier, private Story and Sheet are NEVER queried.
        const [response,publicProfile]=await Promise.all([
          client.rpc("c34_t46_get_progression_discoveries_v1",{
            p_character_id:characterId
          }),
          client.rpc("get_npc_profile_visible_v1",{
            p_character_id:characterId
          })
        ]);
        const last=await client.auth.getUser();
        if(!active||sequence.current!==generation||
           last.error||last.data?.user?.id!==actor)return;
        setResult({
          intel:response.error?null:sanitizeDiscoveredProgression(response.data,characterId),
          published:publicProfile.error?null:sanitizeStage3PublishedClue(publicProfile.data,characterId)
        });
      } catch { /* fail closed; do not surface raw SQL/auth errors */ }
      finally {
        if(active&&sequence.current===generation)setLoading(false);
      }
    })();
    return ()=>{active=false;sequence.current+=1;};
  },[client,characterId,epoch,refresh,clear]);
  return (
    <section aria-label="Discovered character intel" data-testid="t46-intel"
      className="card bg-dark text-light border-secondary mt-3">
      <header className="card-header d-flex align-items-center justify-content-between gap-2">
        <strong>Discovered Intel</strong>
        <button type="button" className="btn btn-sm btn-outline-light"
          onClick={()=>{clear();setRefresh(n=>n+1);}}>Refresh discoveries</button>
      </header>
      <div className="card-body">
        {loading?<p role="status">Checking discovered details…</p>:<>
          {result?.published?
            <p data-testid="t46-curated-public-clue" className="small mb-3">
              <strong>Discovered clue:</strong> {result.published}
            </p>:null}
          {result?.intel?
            <dl className="mb-0">
              {result.intel.class?<><dt>Class</dt><dd>{result.intel.class.name}</dd></>:null}
              {own(result.intel,"level")?<><dt>Level</dt><dd>{result.intel.level}</dd></>:null}
              {own(result.intel,"xp")?<><dt>Experience points</dt><dd>{result.intel.xp.toLocaleString("en-US")}</dd></>:null}
            </dl>:
            <p data-testid="t46-undiscovered" className="small text-secondary mb-0">
              No progression details discovered.
            </p>}
        </>}
      </div>
    </section>
  );
}
