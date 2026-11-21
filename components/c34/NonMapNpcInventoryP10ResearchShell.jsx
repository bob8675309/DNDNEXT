// C34 B14-P10: isolated NPC inventory research component. UNMOUNTED.
// Never import from original NpcPanel, MapPageClient, /npcs, /inventory or Town.
// Caller provides signed Supabase client, and temporary signed browser fixture
// may mount this component under a scratch-only route in GitHub Actions.
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {createNpcInteractionResearchAdapter}
 from "../../scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p9_npc_interaction_client.mjs";

const validId=x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(x||""));
const slots=Object.freeze(["face","throat","body","waist","hands","feet","head",
 "shoulders","arms","ring_1","ring_2","misc_1","misc_2","weapon_1","weapon_2","weapon_3"]);
const fresh=()=>({npcId:null,context:null,items:[],loaded:false,hasMore:true});
const emptyError="NPC inventory is unavailable to this session.";

export default function NonMapNpcInventoryP10ResearchShell({client,characterId,onClose}){
 const adapter=useMemo(()=>client?.rpc?
  createNpcInteractionResearchAdapter(client,{pageSize:2}):null,[client]);
 const [snapshot,setSnapshot]=useState(fresh);
 const [status,setStatus]=useState("unavailable");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [view,setView]=useState("profile");
 const [slot,setSlot]=useState("misc_1");
 const [refreshKey,setRefreshKey]=useState(0);
 const [authKey,setAuthKey]=useState(0);
 const token=useRef(0);
 const signedUser=useRef(undefined);
 const selected=useRef(null);

 const clear=useCallback(()=>{
  // Synchronous on auth or selection change. The React view also requires
  // exact matching selected ID so old data cannot flash before effects run.
  token.current++;
  adapter?.clear();
  setSnapshot(fresh());
  setStatus("unavailable");
  setBusy(false);
  setError("");
  setView("profile");
  setSlot("misc_1");
 },[adapter]);

 useEffect(()=>{
  if(!client?.auth?.onAuthStateChange)return;
  const {data}=client.auth.onAuthStateChange((event,session)=>{
   const next=session?.user?.id||null,previous=signedUser.current;
   signedUser.current=next;
   if(event==="SIGNED_OUT"||event==="USER_UPDATED"||
    (previous!==undefined&&previous!==next))clear();
   if(["INITIAL_SESSION","SIGNED_IN","SIGNED_OUT",
       "TOKEN_REFRESHED","USER_UPDATED"].includes(event)){
    // Do not use client.auth.getUser or RPC from inside the auth callback.
    setAuthKey(n=>n+1);
   }
  });
  return ()=>data?.subscription?.unsubscribe();
 },[client,clear]);

 useEffect(()=>{
  const id=validId(characterId)?String(characterId).toLowerCase():null;
  selected.current=id;
  clear();
  if(!id||!adapter||!client?.auth?.getUser)return;
  const run=++token.current;let active=true;
  setBusy(true);setStatus("checking");
  (async()=>{
   try{
    const first=await client.auth.getUser();
    const actor=first?.data?.user?.id;
    if(first.error||!validId(actor))throw new Error(emptyError);
    if(!active||run!==token.current||selected.current!==id)return;
    adapter.selectNpc(id);
    const result=await adapter.refreshContext();
    if(result?.discarded)return;
    const last=await client.auth.getUser();
    if(!active||run!==token.current||selected.current!==id)return;
    if(last.error||last?.data?.user?.id!==actor)throw new Error(emptyError);
    setSnapshot(result);setStatus("ok");
   }catch(_err){
    if(active&&run===token.current){
     adapter.clear();setSnapshot(fresh());setStatus("unavailable");
     setError(emptyError);
    }
   }finally{
    if(active&&run===token.current)setBusy(false);
   }
  })();
  return ()=>{active=false;token.current++;adapter.clear();};
 },[client,adapter,characterId,authKey,refreshKey,clear]);

 const refresh=useCallback(()=>{
  clear();setRefreshKey(n=>n+1);
 },[clear]);

 async function requestInventory(){
  if(!adapter||busy||!snapshot.context?.can_view_backpack)return;
  const run=token.current,id=selected.current;
  setView("inventory");setBusy(true);setError("");
  try{
   const result=await adapter.loadNext();
   if(run!==token.current||selected.current!==id||result?.discarded)return;
   const after=await client.auth.getUser();
   if(run!==token.current||selected.current!==id)return;
   if(after.error||after?.data?.user?.id!==signedUser.current){
    clear();return;
   }
   setSnapshot(result);
  }catch(_err){
   if(run===token.current){
    setSnapshot(adapter.snapshot());setStatus("unavailable");
    setError("Backpack access expired or was denied. Refresh permissions.");
   }
  }finally{if(run===token.current)setBusy(false);}
 }

 async function changeEquipment(item,doEquip){
  if(!adapter||busy||!snapshot.context?.can_manage_equipment)return;
  const run=token.current,id=selected.current;
  setBusy(true);setError("");
  try{
   const updated=await adapter.setEquipment({
    itemId:item.id,isEquipped:doEquip,
    slot:doEquip?slot:null,expectedEquipped:item.is_equipped===true
   });
   if(run!==token.current||selected.current!==id||updated?.discarded)return;
   const after=await client.auth.getUser();
   if(run!==token.current||selected.current!==id)return;
   if(after.error||after?.data?.user?.id!==signedUser.current){
    clear();return;
   }
   setSnapshot(updated);
  }catch(_err){
   if(run===token.current){
    setSnapshot(adapter.snapshot());setStatus("unavailable");
    setError("Equipment permission or item state changed. Refresh permissions.");
   }
  }finally{if(run===token.current)setBusy(false);}
 }

 const expected=validId(characterId)?String(characterId).toLowerCase():null;
 const context=status==="ok"&&snapshot.npcId===expected?snapshot.context:null;
 const publicWorn=context?.can_view_worn_gear===true?context.worn_gear:[];
 const readable=context?.can_view_backpack===true;
 const manageable=context?.can_manage_equipment===true;
 const visibleItems=context?snapshot.items:[];

 return <section className="card border-secondary bg-dark text-light"
   data-testid="c34-p10-nonmap-inventory"
   aria-label="Non-map NPC inventory research">
  <header className="card-header d-flex gap-2 align-items-center justify-content-between">
   <strong>NPC Profile — inventory research</strong>
   <div className="d-flex gap-2">
    <button type="button" className="btn btn-sm btn-outline-info"
     onClick={refresh}>Refresh permissions</button>
    {onClose&&<button type="button" className="btn btn-sm btn-outline-light"
     onClick={()=>{clear();onClose();}}>Close</button>}
   </div>
  </header>
  <div className="card-body">
   {busy&&<p role="status" data-testid="p10-busy">Checking authorized state…</p>}
   {!context&&<p role="status" data-testid="p10-unavailable">
     {error||emptyError}</p>}
   {context&&<>
    <div data-testid="p10-ready" className="small text-secondary">
     Current NPC: {context.npc_id}
    </div>
    <section aria-label="Visible worn gear" className="mb-3" data-testid="p10-worn">
     <h3 className="h6">Visible equipment</h3>
     <ul>{publicWorn.map((w,i)=><li key={i}>{w.name}</li>)}</ul>
    </section>
    <p className="small text-secondary" data-testid="p10-rights">
     Combat commands: {context.can_issue_encounter_commands?"yes":"no"}.
     Backpack: {readable?"read":"private"}.
     Equipment management: {manageable?"granted":"not granted"}.
    </p>
    {readable&&view==="profile"&&
     <button type="button" className="btn btn-outline-info btn-sm"
      disabled={busy} onClick={requestInventory}>Open backpack</button>}
    {!readable&&<p data-testid="p10-readonly-locked">
      This NPC's private backpack is not available.</p>}
    {readable&&view==="inventory"&&<section aria-label="Private backpack">
     <div className="d-flex align-items-center justify-content-between">
      <h3 className="h6">NPC backpack</h3>
      <button type="button" className="btn btn-sm btn-outline-light"
       onClick={()=>setView("profile")}>Return to Profile</button>
     </div>
     {!manageable&&<p data-testid="p10-readonly">Read-only access.
      Equipment changes and item withdrawal are not permitted.</p>}
     {manageable&&<label className="form-label" htmlFor="p10-slot">
      Equipment slot
      <select id="p10-slot" className="form-select form-select-sm"
       value={slot} onChange={e=>setSlot(e.target.value)}>
       {slots.map(choice=><option key={choice} value={choice}>{choice}</option>)}
      </select>
     </label>}
     <ul data-testid="p10-items" className="list-group mb-2">
      {visibleItems.map(item=><li key={item.id}
       className="list-group-item bg-dark text-light border-secondary"
       data-testid="p10-item">
       <span>{item.name} · {item.type||"Gear"} · {item.rarity||"Unknown"}
        {item.is_equipped?" (equipped)":""}</span>
       {manageable&&<button type="button"
        className="btn btn-sm btn-outline-warning ms-2" disabled={busy}
        onClick={()=>changeEquipment(item,!item.is_equipped)}>
        {item.is_equipped?"Unequip":"Equip"} {item.name}</button>}
      </li>)}
     </ul>
     {snapshot.loaded&&snapshot.hasMore&&
      <button className="btn btn-sm btn-outline-info" type="button"
       disabled={busy} onClick={requestInventory}>Load more</button>}
     {snapshot.loaded&&!snapshot.hasMore&&
      <p className="small text-secondary" data-testid="p10-exhausted">End of backpack</p>}
    </section>}
   </>}
  </div>
 </section>;
}
