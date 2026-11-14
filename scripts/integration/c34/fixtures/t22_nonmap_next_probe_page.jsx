// CI-only route fixture. This file lives under scripts, NOT pages/.
// The T22 runner temporarily copies its bytes into pages/__c34_t22_probe.jsx
// and deletes the route on exit. No production route is checked in.
import { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import NonMapNpcProfileResearchShell from "../components/c34/NonMapNpcProfileResearchShell";
export default function T22DisposableNextPage(){
 const [selected,setSelected]=useState("");
 const [receipt,setReceipt]=useState(null);
 useEffect(()=>{
   const api={
     login:async(email,password)=>{
       const {data,error}=await supabase.auth.signInWithPassword({email,password});
       if(error)throw new Error(error.message);
       return data.user?.id||null;
     },
     logout:async()=>{
       const {error}=await supabase.auth.signOut();
       if(error)throw new Error(error.message);
       return true;
     },
     select:(id)=>{setReceipt(null);setSelected(id||"");return true;},
     currentUser:async()=>{
       const {data,error}=await supabase.auth.getUser();
       if(error)return null;
       return data.user?.id||null;
     },
   };
   window.__C34_T22_TEST_API__=api;
   return ()=>{delete window.__C34_T22_TEST_API__;};
 },[]);
 return <main className="container py-4" data-testid="c34-t22-next-page">
   <p className="text-secondary">T22 disposable Next Pages Router probe — no public route deployed.</p>
   {selected?<NonMapNpcProfileResearchShell key={selected}
     client={supabase} characterId={selected}
     onAuthorizedPrint={({profile,sheet})=>{
       // Test receipt contains only nonsecret evidence; no sheet is persisted.
       setReceipt({name:profile?.name||"",marker:sheet?.marker||""});
     }}
     onClose={()=>setSelected("")}/>:
     <p role="status">No character selected.</p>}
   {receipt&&<output data-testid="c34-t22-print-receipt">
      Authorized Sheet: {receipt.name} / {receipt.marker}
   </output>}
 </main>;
}
