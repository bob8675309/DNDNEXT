// C34 T24 CI-only fixture; NEVER commit this as an active pages/ route.
// The T24 browser runner temporarily copies it into pages/__c34_t24_probe.jsx
// on localhost, then deletes it in finally. Original _app.js stays unchanged.
import { useEffect, useState } from "react";
import { supabase } from "../utils/supabaseClient";
import NonMapNpcManagerResearchShell from "../components/c34/NonMapNpcManagerResearchShell";
import { buildPrintableCharacterSheetModel } from "../utils/printableCharacterSheet";
import { buildOfficialCharacterSheetPdf } from "../utils/officialCharacterSheetPdf";

export default function T24DisposableManagerPage(){
  const [selected,setSelected]=useState("");
  const [pdfStatus,setPdfStatus]=useState("idle");

  useEffect(()=>{
    window.__C34_T24_PDF__=null;
    const {data}=supabase.auth.onAuthStateChange((event,session)=>{
      if(event==="SIGNED_OUT"||event==="SIGNED_IN"||event==="USER_UPDATED"){
        // Test data must not persist in JS memory across account boundaries.
        window.__C34_T24_PDF__=null;
        setPdfStatus("idle");
      }
    });
    window.__C34_T24_TEST_API__={
      login:async(email,password)=>{
        const {data,error}=await supabase.auth.signInWithPassword({email,password});
        if(error)throw Error(error.message);
        return data.user?.id||null;
      },
      logout:async()=>{
        window.__C34_T24_PDF__=null;
        const {error}=await supabase.auth.signOut();
        if(error)throw Error(error.message);
        return true;
      },
      select:(id)=>{
        window.__C34_T24_PDF__=null;
        setPdfStatus("idle");
        setSelected(id||"");
        return true;
      },
      getPdfBytes:()=>window.__C34_T24_PDF__?Array.from(window.__C34_T24_PDF__):null,
    };
    return ()=>{
      delete window.__C34_T24_TEST_API__;
      delete window.__C34_T24_PDF__;
      data?.subscription?.unsubscribe();
    };
  },[]);

  async function onAuthorizedPrint({profile,sheet,includeGmSecret}){
    window.__C34_T24_PDF__=null;
    setPdfStatus("building");
    try{
      const model=buildPrintableCharacterSheetModel({
        sheet,profile,inventoryItems:[],spellActions:[],
        featureRows:[],notes:[],locationLabel:""
      });
      // CURRENT app's actual three-page PDF renderer, not a callback receipt.
      const bytes=await buildOfficialCharacterSheetPdf({model});
      window.__C34_T24_PDF__=bytes;
      setPdfStatus(includeGmSecret?"gm-ready":"public-ready");
    }catch(err){
      window.__C34_T24_PDF__=null;
      setPdfStatus("error:"+String(err?.message||err));
    }
  }

  return <main className="container py-3" data-testid="c34-t24-next-page">
    <p className="small text-secondary">
      T24 temporary current-app manager candidate; not an active route.
    </p>
    <NonMapNpcManagerResearchShell client={supabase}
      key={selected||"none"} characterId={selected}
      onAuthorizedPrint={onAuthorizedPrint}
      onClearSensitive={()=>{
        window.__C34_T24_PDF__=null;
        setPdfStatus("idle");
      }}/> 
    <output data-testid="t24-pdf-status">{pdfStatus}</output>
  </main>;
}
