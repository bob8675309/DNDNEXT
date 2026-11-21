// C34 B11-BRACE genuinely signed local pending stock RPC race.
// Run after signed B2-B11, with the SAME disposable PG17/GoTrue/PostgREST,
// original buyer and B10 stock manager. Exact source overlays test-only.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import {spawn} from "node:child_process";
import {createHash,randomUUID} from "node:crypto";
import {buildB11BraceOverlay} from "./candidates/t46_p3_p4b_c2b11_brace_pending_rpc_overlay.mjs";
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const blob=b=>createHash("sha1").update(Buffer.concat([
 Buffer.from("blob "+b.length+"\0"),b
])).digest("hex");
const freePort=()=>new Promise((resolve,reject)=>{
 const socket=net.createServer();socket.once("error",reject);
 socket.listen(0,"127.0.0.1",()=>{
  const p=socket.address().port;socket.close(()=>resolve(p));
 });
});
async function stop(child){
 if(!child)return;
 try{process.kill(-child.pid,"SIGTERM")}catch{}
 await sleep(550);
 try{process.kill(-child.pid,"SIGKILL")}catch{}
 await sleep(420);
}
async function startNext(env,root,guarded){
 const p=await freePort(),origin="http://127.0.0.1:"+p;
 let tail="";
 const child=spawn(process.execPath,[
  path.join(root,"node_modules/next/dist/bin/next"),"dev",
  "--webpack","-H","127.0.0.1","-p",String(p)
 ],{cwd:root,detached:true,stdio:["ignore","pipe","pipe"],env:{
   ...env,NODE_ENV:"development",NEXT_TELEMETRY_DISABLED:"1",
   NEXT_PUBLIC_SUPABASE_URL:env.DNDNEXT_C34_LOCAL_URL,
   NEXT_PUBLIC_SUPABASE_ANON_KEY:env.DNDNEXT_C34_LOCAL_ANON_KEY,
   NEXT_PUBLIC_C34_B11_BRACE_GUARDED:guarded?"1":"0",
   NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP:guarded?"1":"0",
   NEXT_PUBLIC_C34_T33_TOWN_STAGE2_SAFE_PROFILE:guarded?"1":"0"
 }});
 for(const stream of [child.stdout,child.stderr])
  stream.on("data",b=>tail=(tail+b.toString()).slice(-22000));
 for(let i=0;i<120;i++){
  if(child.exitCode!==null)throw Error("BRACE Next crashed "+tail);
  try{
   const res=await fetch(origin+"/__c34_t46_b11_brace_probe",
    {signal:AbortSignal.timeout(2300)});
   if(res.ok&&(await res.text()).includes("B11 BRACE local"))
    return {child,origin,tail:()=>tail};
  }catch{}
  await sleep(950);
 }
 throw Error("BRACE Next not ready "+tail);
}
const makeProbe=(merchantA,merchantB)=>[
 'import {useEffect,useState} from "react";',
 'import Original from "../components/MerchantPanel";',
 'import Guarded from "../components/c34/MerchantPanelT28P2Research";',
 'import {supabase} from "../utils/supabaseClient";',
 'const merchants='+JSON.stringify([merchantA,merchantB])+';',
 'const Component=process.env.NEXT_PUBLIC_C34_B11_BRACE_GUARDED==="1" ? Guarded : Original;',
 'export default function B11BraceProbe(){',
 ' const [selected,setSelected]=useState(0);',
 ' const [actor,setActor]=useState(null);',
 ' useEffect(()=>{',
 '  const {data}=supabase.auth.onAuthStateChange((event,session)=>setActor(session?.user?.id||null));',
 '  window.__b11Probe={',
 '   signIn:async(email,password)=>{const x=await supabase.auth.signInWithPassword({email,password});if(x.error)throw Error(x.error.message);return x.data.user?.id;},',
 '   signOut:async()=>{const x=await supabase.auth.signOut({scope:"local"});if(x.error)throw Error(x.error.message);return true;},',
 '   select:(i)=>setSelected(i)',
 '  };',
 '  return ()=>{delete window.__b11Probe;data?.subscription?.unsubscribe()};',
 ' },[]);',
 ' return <main>',
 '  <div>B11 BRACE local signed live React merchant probe</div>',
 '  <div data-testid="b11-brace-selected">{merchants[selected].id}</div>',
 '  <div data-testid="b11-brace-actor">{actor||"signed-out"}</div>',
 '  <button type="button" data-testid="b11-brace-switch" onClick={()=>setSelected(v=>1-v)}>Switch merchant</button>',
 '  <Component merchant={merchants[selected]} isAdmin={true} canManageCommerce={true}',
 '    canManageTravel={false} showTravelTools={false} presentation="town"',
 '    onBackToProfile={()=>{}} onClose={()=>{}}/>',
 ' </main>;',
 '}'
].join("\n");

export async function runT46C2B11BraceSigned({
 env,root,actors,newActor,merchantOriginalBytes,browser,sql,q,lit
}){
 for(const [k,v] of Object.entries({
   CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
   PGDATABASE:"postgres",DNDNEXT_C34_LOCAL_URL:"http://127.0.0.1:54321",
   DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY"
 }))assert.equal(env[k],v,"BRACE refuses non-disposable "+k);
 assert.notEqual(env.VERCEL,"1");
 assert.equal(sql("SELECT current_setting('server_version_num')::integer BETWEEN 170000 AND 179999"),"t");
 const stockFunction="public.c34_t46_manage_merchant_stock_v1(uuid,text,uuid,jsonb,text,numeric,integer,jsonb)";
 assert.equal(sql("SELECT to_regprocedure('"+stockFunction+"') IS NOT NULL"),"t");
 const priorDef=sql("SELECT md5(pg_get_functiondef('"+stockFunction+"'::regprocedure))");
 const originalBuyer=sql("SELECT md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))");

 const files=["components/MerchantPanel.js","components/c34/MerchantPanelT28P2Research.jsx"];
 const bytes=files.map(file=>fs.readFileSync(path.join(root,file)));
 assert.ok(Buffer.isBuffer(merchantOriginalBytes));
 assert.ok(bytes[0].toString().includes("Return to Profile"),
  "Parent B2 temporary Return-to-Profile overlay missing");
 const overlays=[
  buildB11BraceOverlay(merchantOriginalBytes,{guarded:false}),
  buildB11BraceOverlay(bytes[1],{guarded:true})
 ];
 const probePath=path.join(root,"pages/__c34_t46_b11_brace_probe.jsx");
 assert.ok(!fs.existsSync(probePath),"BRACE refuses to overwrite test route");
 let page=null,next=null,overlaid=false,routeWritten=false;
 const oldRequests=[];
 try{
  for(let i=0;i<files.length;i++)
   fs.writeFileSync(path.join(root,files[i]),overlays[i]);
  overlaid=true;
  for(const guarded of [false,true]){
   const prefix=guarded?"GUARDED":"ORIGINAL";
   // Two independent genuinely signed managers and wallets, no fake JWT.
   const [managerA,managerB]=await Promise.all([
    newActor("B11_BRACE_"+prefix+"_A","gm"),
    newActor("B11_BRACE_"+prefix+"_B","gm")
   ]);
   sql("INSERT INTO public.player_wallets(user_id,gp) VALUES("+
    q(managerA.id)+",17),("+q(managerB.id)+",93)");
   const [sellerA,sellerB]=[randomUUID(),randomUUID()];
   const merchants=[
    {id:sellerA,name:"B11 Brace Traveling Merchant",kind:"merchant",
     storefront_enabled:true,is_hidden:false,state:"moving"},
    {id:sellerB,name:"B11 Brace Camping Merchant",kind:"merchant",
     storefront_enabled:true,is_hidden:false,state:"camping"}
   ];
   for(const m of merchants)sql(
    "INSERT INTO public.characters(id,name,kind,is_hidden,storefront_enabled,state,location_id) VALUES("+
     q(m.id)+","+lit(m.name)+",'merchant',false,true,"+lit(m.state)+",NULL)");
   const put=(seller,name)=>{
    const id=randomUUID();
    sql("INSERT INTO public.character_stock(id,character_id,display_name,qty,price_gp,card_payload) VALUES("+
     q(id)+","+q(seller)+","+lit(name)+",2,3,"+
     lit(JSON.stringify({item_name:name,item_type:"Potion",item_rarity:"Common"}))+"::jsonb)");
    return id;
   };
   const oldA=put(sellerA,"B11 Brace Original Stock A");
   const oldB=put(sellerB,"B11 Brace Original Stock B");
   const countName=(seller,name)=>Number(sql(
    "SELECT count(*) FROM public.character_stock WHERE character_id="+q(seller)+
    " AND display_name="+lit(name)));
   const shelf=seller=>JSON.parse(sql(
    "SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.id),'[]'::jsonb)::text FROM public.character_stock s WHERE s.character_id="+q(seller)));
   const seedA=JSON.stringify(shelf(sellerA)),seedB=JSON.stringify(shelf(sellerB));
   fs.writeFileSync(probePath,makeProbe(merchants[0],merchants[1]),{flag:"wx"});
   routeWritten=true;
   const proc=await startNext(env,root,guarded);next=proc.child;
   page=await browser.newPage({viewport:{width:1400,height:1080}});
   const errors=[];
   page.on("pageerror",e=>errors.push(e.message));
   page.on("dialog",d=>d.accept());
   page.on("request",r=>{
    if(r.url().includes("/rest/v1/"))oldRequests.push({method:r.method(),url:r.url()});
   });
   const gates=new Map();
   const endpoint="**/rest/v1/rpc/c34_t46_manage_merchant_stock_v1";
   await page.route(endpoint,async route=>{
    const body=route.request().postDataJSON();
    const gate=gates.get(body?.p_display_name);
    if(!gate){await route.continue();return}
    try{
     if(gate.kind==="before"){
      gate.start({body});
      await gate.unblocked;
      const response=await route.fetch();
      gate.response=response;
      await route.fulfill({response});
     }else if(gate.kind==="mock"){
      gate.start({body});
      await gate.unblocked;
      await route.fulfill({status:404,contentType:"application/json",
       body:JSON.stringify({code:"PGRST202",message:"B11 deliberate missing RPC"})});
     }else{
      const response=await route.fetch(); // genuine signed server commit FIRST
      gate.response=response;
      gate.start({body,status:response.status()});
      await gate.unblocked;
      await route.fulfill({response});
     }
    }catch(error){gate.reject(error);throw error}
   });
   const gate=(name,kind="after")=>{
    let started,unblock,reject;
    const arrived=new Promise((resolve,r)=>{started=resolve;reject=r});
    const unblocked=new Promise(resolve=>{unblock=resolve});
    const record={kind,unblocked,start:started,release:unblock,reject,arrived};
    gates.set(name,record);return record;
   };
   const debug=()=>page.evaluate(()=>window.__b11BraceDebug?.());
   const waitScope=async (actor,merchant)=>{
    await page.waitForFunction(arg=>{
     const d=window.__b11BraceDebug?.();
     return d&&d.actor===arg.actor&&d.merchant===arg.merchant;
    },{actor,merchant},{timeout:55000});
   };
   const signIn=async a=>{
    assert.equal(await page.evaluate(async cred=>
      window.__b11Probe.signIn(cred.email,cred.password),
      {email:a.email,password:a.password}),a.id);
   };
   const select=async index=>{
    await page.evaluate(index=>window.__b11Probe.select(index),index);
    await page.getByTestId("b11-brace-selected").waitFor();
    await page.waitForFunction(id=>
      document.querySelector('[data-testid="b11-brace-selected"]')?.textContent===id,
      index===0?sellerA:sellerB,{timeout:30000});
   };
   const managerTools=async()=>{
    const button=page.getByRole("button",{name:"Merchant tools",exact:true});
    await button.waitFor({timeout:45000});
    if(!(await page.getByRole("button",{name:"Add item",exact:true}).isVisible()))
      await button.click({force:true});
    await page.getByRole("button",{name:"Add item",exact:true}).waitFor({timeout:40000});
   };
   const add=async name=>{
    await managerTools();
    await page.getByPlaceholder("Paste JSON or type an item name…").fill(name);
    const response=page.waitForResponse(r=>r.url().includes("/rest/v1/rpc/c34_t46_manage_merchant_stock_v1")&&
      r.request().method()==="POST"&&
      r.request().postDataJSON()?.p_display_name===name,{timeout:60000});
    await page.getByRole("button",{name:"Add item",exact:true}).click({force:true});
    return response;
   };
   const noRaw=(index,label)=>{
    const bad=oldRequests.slice(index).filter(r=>r.url.includes("/rest/v1/character_stock")&&
      ["POST","PUT","PATCH","DELETE"].includes(r.method));
    assert.deepEqual(bad,[],label+" wrote direct stock table");
   };
   try{
    await page.goto(proc.origin+"/__c34_t46_b11_brace_probe",
     {waitUntil:"domcontentloaded",timeout:95000});
    await page.waitForFunction(()=>!!window.__b11Probe&&!!window.__b11BraceDebug,
     null,{timeout:70000});
    await signIn(managerA);
    await waitScope(managerA.id,sellerA);
    await managerTools();
    const markA="BRACE "+prefix+" old actor "+randomUUID().slice(0,7);
    const markB="BRACE "+prefix+" new actor "+randomUUID().slice(0,7);
    const gA=gate(markA),before=oldRequests.length;
    const responseA=add(markA);
    const entryA=await gA.arrived;assert.equal(entryA.status,200);
    assert.equal(countName(sellerA,markA),1);
    // The actual old signed DB transaction committed. Hold ONLY its HTTP
    // reply while logout and new sign-in occur on the SAME mounted component.
    await page.evaluate(()=>window.__b11Probe.signOut());
    await signIn(managerB);
    await select(1);
    await waitScope(managerB.id,sellerB);
    await page.waitForFunction(()=>
      window.__b11BraceDebug?.().gp===93,null,{timeout:50000});
    const gB=gate(markB);
    const responseB=add(markB);
    const entryB=await gB.arrived;assert.equal(entryB.status,200);
    assert.equal(countName(sellerB,markB),1);
    // Old A response must not clear B's new busy or render old stock/error.
    gA.release();assert.equal((await responseA).status(),200);
    await sleep(330);
    const still=await debug();
    assert.equal(still.actor,managerB.id);
    assert.equal(still.merchant,sellerB);
    assert.equal(still.pending,true,"Old response cleared new manager action");
    assert.equal(still.busy,"add","Old finally reset new actor busy");
    assert.equal(still.error,"");
    assert.equal(still.gp,93,"Old actor GP leaked after new sign in");
    assert.ok(still.stock.every(x=>x.character_id===sellerB));
    gB.release();assert.equal((await responseB).status(),200);
    await page.waitForFunction(name=>{
      const d=window.__b11BraceDebug?.();
      return d&&!d.pending&&d.busy===null&&d.stock.some(x=>x.display_name===name);
    },markB,{timeout:45000});
    assert.equal(countName(sellerA,markA),1);
    assert.equal(countName(sellerB,markB),1);
    noRaw(before,prefix+" cross-actor double action");
    console.log("PASS T46-C2B11-BRACE-"+prefix+
      "-AUTH-RACE: real signed old RPC committed, response held across logout/new GM login; late result cannot clear second in-flight busy, overwrite GP/error/merchant stock, or duplicate writes");

    // Same actor, same mounted React component, different merchant prop.
    await select(0);await waitScope(managerB.id,sellerA);await managerTools();
    const markSwitch="BRACE "+prefix+" old merchant "+randomUUID().slice(0,7);
    const gSwitch=gate(markSwitch),respSwitch=add(markSwitch);
    assert.equal((await gSwitch.arrived).status,200);
    await select(1);await waitScope(managerB.id,sellerB);
    gSwitch.release();assert.equal((await respSwitch).status(),200);
    await sleep(350);
    const afterSwitch=await debug();
    assert.equal(afterSwitch.merchant,sellerB);
    assert.equal(afterSwitch.actor,managerB.id);
    assert.equal(afterSwitch.pending,false);
    assert.equal(afterSwitch.busy,null);
    assert.equal(afterSwitch.error,"");
    assert.ok(afterSwitch.stock.every(x=>x.character_id===sellerB));
    assert.equal(countName(sellerA,markSwitch),1);
    noRaw(before,prefix+" merchant switch");
    console.log("PASS T46-C2B11-BRACE-"+prefix+
      "-MERCHANT-RACE: genuine server commit on moving merchant, delayed response after same-mounted shop selects camping merchant cannot paint stale stock/error/busy");

    // RPC404 delayed error after switching merchant must not render the old
    // error or authorize fallback REST INSERT/DELETE.
    const missing="BRACE "+prefix+" missing "+randomUUID().slice(0,7);
    const gMissing=gate(missing,"mock"),shelfBefore=JSON.stringify(shelf(sellerB));
    const missResponse=add(missing);
    await gMissing.arrived;
    await select(0);await waitScope(managerB.id,sellerA);
    gMissing.release();assert.equal((await missResponse).status(),404);
    await sleep(300);
    const afterMissing=await debug();
    assert.equal(afterMissing.error,"");
    assert.equal(afterMissing.merchant,sellerA);
    assert.equal(afterMissing.busy,null);
    assert.equal(JSON.stringify(shelf(sellerB)),shelfBefore);
    noRaw(before,prefix+" delayed missing RPC");
    console.log("PASS T46-C2B11-BRACE-"+prefix+
      "-MISSING-RACE: pending mocked PGRST202 after merchant switch suppresses stale error, no raw-table fallback or SQL mutation");

    // Server re-reads ACTUAL user_profiles.role when request reaches DB.
    // Hold the request BEFORE forwarding, revoke GM to player in scratch,
    // then assert genuine authenticated 42501 and unchanged shelf.
    const denied="BRACE "+prefix+" revoked "+randomUUID().slice(0,7);
    const gRevoke=gate(denied,"before"),oldShelf=JSON.stringify(shelf(sellerA));
    const revokedResponse=add(denied);
    await gRevoke.arrived;
    sql("UPDATE public.user_profiles SET role='player' WHERE id="+q(managerB.id));
    gRevoke.release();
    const deniedActual=await revokedResponse;
    assert.equal(deniedActual.status(),403);
    assert.equal((await deniedActual.json()).code,"42501");
    assert.equal(countName(sellerA,denied),0);
    assert.equal(JSON.stringify(shelf(sellerA)),oldShelf);
    noRaw(before,prefix+" role revoked");
    await page.waitForFunction(()=>
      window.__b11BraceDebug?.().pending===false,null,{timeout:40000});
    console.log("PASS T46-C2B11-BRACE-"+prefix+
      "-ROLE-RACE: real signed stale GM request held before SQL, DB role demoted to player, RPC42501/HTTP403, no stock/wallet/fallback write");

    assert.deepEqual(errors,[],prefix+" page errors "+JSON.stringify(errors)+
     " "+proc.tail().slice(-3200));
   }finally{
    for(const g of gates.values())g.release();
    await page.unroute(endpoint).catch(()=>{});
    await page.close().catch(()=>{});page=null;
    await stop(next);next=null;
    if(routeWritten){fs.rmSync(probePath,{force:true});routeWritten=false}
   }
  }
  assert.equal(sql("SELECT md5(pg_get_functiondef('"+stockFunction+"'::regprocedure))"),priorDef);
  assert.equal(sql("SELECT md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))"),originalBuyer);
  console.log("PASS T46-C2B11-BRACE-SIGNED: original+guarded actual Next React same-mounted actor/merchant, postcommit HTTP delay, simultaneous new GM action, pre-SQL revoked role, missing RPC fail-closed; B2-B11 persisted definitions unchanged; research HOLD");
 }finally{
  if(page)await page.close().catch(()=>{});
  await stop(next);
  if(routeWritten)fs.rmSync(probePath,{force:true});
  for(let i=0;i<files.length;i++){
   fs.writeFileSync(path.join(root,files[i]),bytes[i]);
   assert.equal(blob(fs.readFileSync(path.join(root,files[i]))),blob(bytes[i]),
    "BRACE failed original component restoration "+files[i]);
  }
  assert.equal(blob(fs.readFileSync(path.join(root,"components/MapPageClient.js"))),
   "61f8738da2ca3d8635b5a413bfdc18c094228a0a");
 }
}
