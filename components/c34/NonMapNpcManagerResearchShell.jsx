// C34 T24 — research-only non-map NPC manager, UNMOUNTED.
// Local Next.js test route is generated and deleted by T24 runner.
// Original pages/npcs.js, shared NpcPanel, MapPageClient and production SQL
// MUST remain unchanged. This probe is NOT the finished manager UI.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  projectNonMapManagerRosterRow, selectedManagerDisplayRights,
  isCurrentManagerPrivateResponse, projectSelectedEditorNarrative
} from "../../utils/c34/nonMapNpcManagerCandidate.mjs";
import {
  readNonMapNpcProfileCandidate, emptyNpcReaderResult
} from "../../utils/c34/readNonMapNpcProfileCandidate.mjs";

const BLANK=()=>({
  reader:emptyNpcReaderResult("unavailable"),rights:null,editor:null,
});
const short=(v)=>String(v??"");
const validId=(v)=>typeof v==="string"&&/^[0-9a-f-]{36}$/i.test(v);

export default function NonMapNpcManagerResearchShell({
  client, characterId, onAuthorizedPrint, onClearSensitive
}) {
  const [actor,setActor]=useState(null);
  const [epoch,setEpoch]=useState(0);
  const [selectedId,setSelectedId]=useState(characterId||"");
  const [state,setState]=useState(BLANK);
  const [roster,setRoster]=useState([]);
  const [rosterStatus,setRosterStatus]=useState("unavailable");
  const [busy,setBusy]=useState(false);
  const generation=useRef(0);
  const actorRef=useRef(null);
  const selectedRef=useRef(characterId||"");
  const onClearRef=useRef(onClearSensitive);
  onClearRef.current=onClearSensitive;

  const clear=useCallback(()=>{
    // Invalidate previously generated PDF bytes on selection, auth and role refresh.
    if(typeof onClearRef.current==="function")onClearRef.current();
    generation.current+=1;
    setState(BLANK());
    setBusy(false);
  },[]);

  const choose=useCallback((id)=>{
    const next=validId(id)?id:"";
    // Event-time invalidation is synchronous, not deferred to useEffect.
    selectedRef.current=next;
    clear();
    setSelectedId(next);
  },[clear]);

  const refresh=useCallback(()=>{
    clear();
    setEpoch(v=>v+1);
  },[clear]);

  useEffect(()=>{
    if(!client?.auth?.onAuthStateChange)return;
    const {data}=client.auth.onAuthStateChange((event,session)=>{
      const next=session?.user?.id||null;
      if(actorRef.current!==next||event==="SIGNED_OUT"||
         event==="USER_UPDATED"){
        // NO Supabase calls inside auth callback: avoid cross-tab lock.
        actorRef.current=next;
        clear();
        setRoster([]);
        setRosterStatus("unavailable");
      }
      setActor(next);
      if(["SIGNED_IN","SIGNED_OUT","INITIAL_SESSION","TOKEN_REFRESHED","USER_UPDATED"]
          .includes(event))setEpoch(v=>v+1);
    });
    return ()=>data?.subscription?.unsubscribe();
  },[client,clear]);

  // Current-app signed table query uses BASIC public columns only.
  // The separate stage2 Admin/editor RPCs are used for private data.
  useEffect(()=>{
    let active=true;
    const requestActor=actor;
    setRoster([]);
    setRosterStatus(actor?"loading":"unauthenticated");
    if(!actor)return;
    (async()=>{
      try {
        const {data:user,error:authError}=await client.auth.getUser();
        if(authError||user?.user?.id!==requestActor)return;
        const {data,error}=await client.from("characters")
          .select("id,name,kind,role,description,location_id,storefront_enabled,is_hidden,portrait_url")
          .in("kind",["npc","merchant"]).order("name");
        if(!active||actorRef.current!==requestActor)return;
        const end=await client.auth.getUser();
        if(!active||actorRef.current!==requestActor||end.error||
           end.data?.user?.id!==requestActor)return;
        if(error){setRosterStatus("blocked");return;}
        setRoster((data||[]).map(row=>
          projectNonMapManagerRosterRow(row,row.kind)).filter(Boolean));
        setRosterStatus("ok");
      }catch(_error){
        if(active&&actorRef.current===requestActor)setRosterStatus("blocked");
      }
    })();
    return ()=>{active=false;};
  },[actor,client,epoch]);

  useEffect(()=>{
    let active=true;
    const requestActor=actor,requestSelectedId=selectedId;
    clear();
    if(!requestActor||!validId(requestSelectedId))return;
    const run=++generation.current;
    setBusy(true);
    (async()=>{
      try{
        const reader=await readNonMapNpcProfileCandidate(
          client,requestSelectedId,
          {withDossier:true,withSheet:true,withPrivateBackstory:true}
        );
        if(!active||run!==generation.current||actorRef.current!==requestActor||
           selectedRef.current!==requestSelectedId)return;
        const permission=await client.from("character_permissions")
          .select("character_id,user_id,can_edit,can_inventory,can_convert")
          .eq("character_id",requestSelectedId)
          .eq("user_id",requestActor).maybeSingle();
        if(!active||run!==generation.current||actorRef.current!==requestActor||
           selectedRef.current!==requestSelectedId)return;
        const rights=selectedManagerDisplayRights(
          permission.error?null:permission.data,requestSelectedId,requestActor);
        const request={selectedId:requestSelectedId,requestSelectedId,
          actorId:actorRef.current,requestActorId:requestActor,
          row:reader.editorNarrative};
        const editor=projectSelectedEditorNarrative(request);
        const dossier=reader.capabilities?.isGM&&
          isCurrentManagerPrivateResponse({...request,row:reader.dossier})
          ?reader.dossier:null;
        const safeReader={...reader,dossier};
        // Client side check complements, but never replaces original server
        // role checks and RLS. Never reuse a previous character's data.
        setState({reader:safeReader,rights,editor});
      }catch(_error){
        if(active&&run===generation.current)setState(BLANK());
      }finally{
        if(active&&run===generation.current)setBusy(false);
      }
    })();
    return ()=>{active=false;generation.current+=1;};
  },[client,selectedId,actor,epoch,clear]);

  const {reader,rights,editor}=state;
  const visible=Boolean(actor&&reader.status==="ok"&&
    reader.profile?.id===selectedId);
  const gm=visible&&reader.capabilities?.isGM===true&&!!reader.dossier;
  const canonical=reader.sheet||((gm&&reader.dossier?.character_sheet)||null);
  const canPrint=visible&&!!canonical&&(reader.capabilities?.canPrint||gm);
  const currentName=visible?short(reader.profile?.name):"";
  const gmSecret=gm?short(reader.dossier.secret):"";

  function print(includeGmSecret=false){
    if(!canPrint||typeof onAuthorizedPrint!=="function")return;
    if(includeGmSecret&&!gm)return;
    // Exclude private Story, stale roster, raw dossier and arbitrary privileged
    // columns. GM-only Secret must be an explicit separate GM-only action.
    onAuthorizedPrint({
      sheet:canonical,
      profile:{
        name:currentName,kind:reader.profile.kind,
        role:reader.profile.role||"",description:reader.profile.description||"",
        backgroundNarrative:editor?.background||reader.profile.lore?.background||"",
        secret:includeGmSecret?gmSecret:""
      },
      includeGmSecret
    });
  }
  return <section className="card bg-dark text-light border-secondary"
      data-testid="c34-t24-manager">
    <header className="card-header d-flex align-items-center justify-content-between">
      <strong>T24 non-map NPC/merchant manager research</strong>
      <button className="btn btn-sm btn-outline-light" type="button"
        onClick={refresh}>Refresh permissions</button>
    </header>
    <div className="card-body">
      <div data-testid="t24-roster-status" role="status">Roster: {rosterStatus}</div>
      <nav aria-label="NPC and merchant roster" className="d-flex flex-wrap gap-2 my-2">
        {roster.map(row=><button type="button" className="btn btn-sm btn-outline-info"
          key={row.id} onClick={()=>choose(row.id)}>{row.name}</button>)}
      </nav>
      <div data-testid="t24-selection" className="small text-secondary">
        Selected: {selectedId||"none"}
      </div>
      {busy&&<p role="status">Loading selected character…</p>}
      {!visible&&<p data-testid="t24-unavailable">No authorized selected Profile.</p>}
      {visible&&<>
        <h2 className="h5">{currentName}</h2>
        <p data-testid="t24-public-description">{short(reader.profile.description)}</p>
        <p data-testid="t24-kind">{reader.profile.kind}</p>
        <p data-testid="t24-rights">Edit: {String(rights?.can_edit===true)} /
          Inventory: {String(rights?.can_inventory===true)} /
          Convert: {String(rights?.can_convert===true)}</p>
        {editor&&<p data-testid="t24-editor-background">{short(editor.background)}</p>}
        {gm&&<section aria-label="GM-only dossier">
          <h3 className="h6">GM dossier</h3>
          <p>{gmSecret}</p>
        </section>}
        {canPrint&&<>
          <button type="button" className="btn btn-sm btn-outline-info"
            onClick={()=>print(false)}>Print role-safe PDF</button>
          {gm&&<button type="button" className="btn btn-sm btn-outline-warning ms-2"
            onClick={()=>print(true)}>Print GM PDF</button>}
        </>}
        {reader.profile.kind==="merchant"&&
          <p data-testid="t24-merchant-profile">Merchant Profile first.
            Live storefront remains unmounted in this test.</p>}
      </>}
    </div>
  </section>;
}
