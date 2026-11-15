// C34 T22 — research-only. NEVER mount in _app, MapPageClient, NPC manager,
// inventory, town or a production route. The temporary CI-only Pages Router
// fixture imports this during a genuine localhost Next.js browser test.
// No world-map CSS or legacy character/GM-secret data loader is referenced.
import { useCallback, useEffect, useRef, useState } from "react";
import { readNonMapNpcProfileCandidate, emptyNpcReaderResult } from "../../utils/c34/readNonMapNpcProfileCandidate.mjs";

const VIEWS=Object.freeze(["profile","shop"]);
const display=(v)=>v==null?"":String(v);
export default function NonMapNpcProfileResearchShell({
 client, characterId, onClose, onAuthorizedPrint
}) {
 const [result,setResult]=useState(()=>emptyNpcReaderResult("unavailable"));
 const [loading,setLoading]=useState(false);
 const [refreshKey,setRefreshKey]=useState(0);
 const [draft,setDraft]=useState("");
 const [saveStatus,setSaveStatus]=useState("");
 const [saving,setSaving]=useState(false);
 const [view,setView]=useState("profile");
 const token=useRef(0);
 const accountRef=useRef(undefined);
 const currentId=useRef(null);
 const [signedEpoch,setSignedEpoch]=useState(0);
 const clear=useCallback(()=>{
   token.current+=1;
   setResult(emptyNpcReaderResult("unavailable"));
   setDraft("");
   setSaveStatus("");
   setSaving(false);
   setView("profile");
   setLoading(false);
 },[]);
 useEffect(()=>{
   if(!client?.auth?.onAuthStateChange)return undefined;
   const {data}=client.auth.onAuthStateChange((event,session)=>{
     const next=session?.user?.id||null,previous=accountRef.current;
     accountRef.current=next;
     if(event==="SIGNED_OUT"||
        (previous!==undefined&&previous!==next)) clear();
     if(event==="INITIAL_SESSION"||event==="SIGNED_IN"||
        event==="TOKEN_REFRESHED"||event==="USER_UPDATED"||event==="SIGNED_OUT"){
       // Do not call a Supabase API in the callback: avoids its auth lock.
       setSignedEpoch((n)=>n+1);
     }
   });
   return ()=>data?.subscription?.unsubscribe();
 },[client,clear]);
 useEffect(()=>{
   currentId.current=characterId||null;
   clear();
   if(!characterId||!client)return undefined;
   const thisRun=++token.current;
   let active=true;
   setLoading(true);
   (async()=>{
     try{
       const found=await readNonMapNpcProfileCandidate(client,characterId,{
         withDossier:true,withSheet:true,withPrivateBackstory:true
       });
       if(!active||token.current!==thisRun||currentId.current!==characterId)return;
       setResult(found);
       setDraft(found.capabilities.canEditBackstory
         ? display(found.privateBackstory):"");
     }catch(_err){
       if(active&&token.current===thisRun){
         setResult(emptyNpcReaderResult("unavailable"));
       }
     }finally{
       if(active&&token.current===thisRun)setLoading(false);
     }
   })();
   return ()=>{active=false;token.current+=1;};
 },[client,characterId,signedEpoch,refreshKey,clear]);
 async function savePrivate() {
   if(saving||!result.capabilities.canEditBackstory||
      result.status!=="ok"||!characterId||!client)return;
   const savedToken=token.current;
   setSaving(true);setSaveStatus("");
   try{
     const {error}=await client.from("character_backstory_secrets")
       .upsert({character_id:characterId,secret_text:draft,
        updated_at:new Date().toISOString()},{onConflict:"character_id"});
     if(savedToken!==token.current)return;
     if(error){
       // A revoked role must not keep a stale private document in the UI.
       clear();setSaveStatus("Access changed. Refresh to recheck permissions.");
     }else{
       setSaveStatus("Saved");
       setRefreshKey(n=>n+1);
     }
   }catch(_err){
     if(savedToken===token.current){clear();setSaveStatus("Private save unavailable.");}
   }finally{
     if(savedToken===token.current)setSaving(false);
   }
 }
 function printAuthorized(){
   if(result.status!=="ok"||!result.capabilities.canPrint||!result.sheet)return;
   if(typeof onAuthorizedPrint==="function")onAuthorizedPrint({
     profile:result.profile,sheet:result.sheet,
     editorNarrative:result.editorNarrative,
     // Never pass GM dossier or private Story to the authorized sheet callback.
   });
 }
 const visible=result.status==="ok"&&result.profile&&
   String(result.profile.id||"").toLowerCase()===String(characterId||"").toLowerCase();
 const merchant=visible&&result.profile.kind==="merchant";
 const canShop=merchant===true;
 return (
   <section className="card bg-dark text-light border-secondary shadow-sm"
     data-testid="c34-t22-nonmap" role="region"
     aria-label="Research-only non-map NPC Profile">
     <header className="card-header d-flex align-items-center justify-content-between gap-3">
       <strong>Character Profile</strong>
       <div className="d-flex gap-2">
         <button type="button" className="btn btn-outline-light btn-sm"
           onClick={()=>setRefreshKey(n=>n+1)}>Refresh permissions</button>
         {onClose&&<button type="button" className="btn btn-outline-light btn-sm"
           onClick={()=>{clear();onClose();}}>Close</button>}
       </div>
     </header>
     <div className="card-body">
       {loading&&<p role="status">Loading authorized Profile…</p>}
       {!loading&&!visible&&<p role="status">Profile unavailable to this session.</p>}
       {visible&&view==="profile"&&<>
         <h2 className="h4 mb-2">{display(result.profile.name)}</h2>
         <p className="small text-secondary mb-2">
           {[result.profile.kind,result.profile.race,result.profile.role].filter(Boolean).join(" • ")}
         </p>
         <p>{display(result.profile.description)||"No public description available."}</p>
         {Object.entries(result.profile.lore||{}).filter(([,value])=>value).length>0&&
           <section aria-label="Published character lore" className="mb-3">
             <h3 className="h6">Known lore</h3>
             {Object.entries(result.profile.lore||{}).filter(([,value])=>value)
               .map(([key,value])=><p key={key} className="mb-1">
                 <strong className="text-capitalize">{key}: </strong>{display(value)}
               </p>)}
           </section>}
         {result.capabilities.isGM&&result.dossier&&
           <section className="card border-warning bg-transparent p-3 mb-3"
             aria-label="GM-only dossier">
             <h3 className="h6">GM dossier</h3>
             <p className="mb-0">{display(result.dossier.secret)}</p>
           </section>}
         {result.capabilities.canPrint&&result.sheet&&
           <section aria-label="Authorized character sheet" className="mb-3">
             <button type="button" className="btn btn-outline-info btn-sm"
               onClick={printAuthorized}>Print authorized Sheet</button>
           </section>}
         {result.capabilities.canEditBackstory&&
           <section className="card border-info bg-transparent p-3 mb-3"
             aria-label="Private character backstory">
             <h3 className="h6">Private Backstory</h3>
             <p className="small text-secondary">Original creator with current edit rights or GM only. Not a GM Secret.</p>
             <label htmlFor="c34-t22-backstory" className="form-label">Personal history</label>
             <textarea id="c34-t22-backstory" className="form-control mb-2" rows={4}
               maxLength={16000} value={draft}
               onChange={e=>{setDraft(e.target.value);setSaveStatus("");}} />
             <button type="button" className="btn btn-primary btn-sm"
               disabled={saving} onClick={savePrivate}>Save private backstory</button>
             {saveStatus&&<span className="ms-2" role="status">{saveStatus}</span>}
           </section>}
         {canShop&&<button type="button" className="btn btn-warning btn-sm"
           onClick={()=>setView("shop")}>Let me browse your wares.</button>}
       </>}
       {visible&&view==="shop"&&VIEWS.includes(view)&&<>
         <h2 className="h5">Merchant storefront — research handoff only</h2>
         <p>This research shell does not load wares. The existing live storefront is unchanged.</p>
         <button type="button" className="btn btn-outline-light btn-sm"
           onClick={()=>setView("profile")}>Return to Profile</button>
       </>}
     </div>
   </section>
 );
}
