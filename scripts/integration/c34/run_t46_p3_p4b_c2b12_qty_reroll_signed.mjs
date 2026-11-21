// C34 B11-BRACE genuinely signed local pending stock RPC race.
// Run after signed B2-B11, with the SAME disposable PG17/GoTrue/PostgREST,
// original buyer and B10 stock manager. Exact source overlays test-only.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import {spawn} from "node:child_process";
import {createHash,randomUUID} from "node:crypto";
import {buildB12CommerceEpochOverlay} from "./candidates/t46_p3_p4b_c2b12_qty_reroll_epoch_overlay.mjs";
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
   const res=await fetch(origin+"/__c34_t46_b12_probe",
    {signal:AbortSignal.timeout(2300)});
   if(res.ok&&(await res.text()).includes("B12 local"))
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
 '  <div>B12 local signed live React merchant probe</div>',
 '  <div data-testid="b11-brace-selected">{merchants[selected].id}</div>',
 '  <div data-testid="b11-brace-actor">{actor||"signed-out"}</div>',
 '  <button type="button" data-testid="b11-brace-switch" onClick={()=>setSelected(v=>1-v)}>Switch merchant</button>',
 '  <Component merchant={merchants[selected]} isAdmin={true} canManageCommerce={true}',
 '    canManageTravel={false} showTravelTools={false} presentation="town"',
 '    onBackToProfile={()=>{}} onClose={()=>{}}/>',
 ' </main>;',
 '}'
].join("\n");

export async function runT46C2B12QtyRerollSigned({
 env,root,actors,newActor,merchantOriginalBytes,browser,sql,q,lit,walletOf,invCount
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
 const priorQty=sql("SELECT md5(pg_get_functiondef('public.c34_t46_manage_stock_qty_v1(uuid,text,integer,integer,timestamptz)'::regprocedure))");
 const priorReroll=sql("SELECT md5(pg_get_functiondef('public.reroll_merchant_inventory_v2(uuid,text,integer)'::regprocedure))");

 const files=["components/MerchantPanel.js","components/c34/MerchantPanelT28P2Research.jsx"];
 const bytes=files.map(file=>fs.readFileSync(path.join(root,file)));
 assert.ok(Buffer.isBuffer(merchantOriginalBytes));
 assert.ok(bytes[0].toString().includes("Return to Profile"),
  "Parent B2 temporary Return-to-Profile overlay missing");
 const overlays=[
  buildB12CommerceEpochOverlay(merchantOriginalBytes,{guarded:false}),
  buildB12CommerceEpochOverlay(bytes[1],{guarded:true})
 ];
 const probePath=path.join(root,"pages/__c34_t46_b12_probe.jsx");
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
   const routeHandler=async route=>{
    const body=route.request().postDataJSON();
    const name=route.request().url();
    const key=name.includes("/rpc/c34_t46_manage_stock_qty_v1")
      ? "qty:"+body?.p_stock_id+":"+body?.p_mode
      : "reroll:"+body?.p_merchant_id;
    const g=gates.get(key);
    if(!g){await route.continue();return;}
    gates.delete(key);
    try{
     if(g.kind==="before"){
      g.start({body});
      await g.unblocked;
      const response=await route.fetch();
      g.response=response;
      await route.fulfill({response});
     }else if(g.kind==="mock"){
      g.start({body});
      await g.unblocked;
      await route.fulfill({status:404,contentType:"application/json",
       body:JSON.stringify({code:"PGRST202",message:"B12 deliberate missing RPC"})});
     }else{
      const response=await route.fetch();
      g.response=response;
      g.start({body,status:response.status()});
      await g.unblocked;
      await route.fulfill({response});
     }
    }catch(error){g.reject(error);throw error}
   };
   const endpoints=[
    "**/rest/v1/rpc/c34_t46_manage_stock_qty_v1",
    "**/rest/v1/rpc/reroll_merchant_inventory_v2"
   ];
   for(const endpoint of endpoints)await page.route(endpoint,routeHandler);
   const gate=(name,kind="after")=>{
    let started,unblock,reject;
    const arrived=new Promise((resolve,r)=>{started=resolve;reject=r});
    const unblocked=new Promise(resolve=>{unblock=resolve});
    const record={kind,unblocked,start:started,release:unblock,reject,arrived};
    gates.set(name,record);
    return record;
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
   const qtyClick=async(id,mode,button)=>{
    await managerTools();
    const row=page.getByTestId("c34-b9-stock-"+id);
    await row.waitFor({timeout:45000});
    const response=page.waitForResponse(r=>{
      if(r.request().method()!=="POST"||
        !r.url().includes("/rest/v1/rpc/c34_t46_manage_stock_qty_v1"))
        return false;
      const body=r.request().postDataJSON();
      return body?.p_stock_id===id&&body?.p_mode===mode;
    },{timeout:60000});
    await row.getByRole("button",{name:button,exact:true}).click({force:true});
    return response;
   };
   const rerollClick=async seller=>{
    await managerTools();
    const response=page.waitForResponse(r=>
      r.request().method()==="POST"&&
      r.url().includes("/rest/v1/rpc/reroll_merchant_inventory_v2")&&
      r.request().postDataJSON()?.p_merchant_id===seller,
      {timeout:60000});
    await page.getByRole("button",{name:/^Reroll /}).click({force:true});
    return response;
   };
   const noRaw=(index,label)=>{
    const bad=oldRequests.slice(index).filter(r=>r.url.includes("/rest/v1/character_stock")&&
      ["POST","PUT","PATCH","DELETE"].includes(r.method));
    assert.deepEqual(bad,[],label+" wrote direct stock table");
   };
   try{
    await page.goto(proc.origin+"/__c34_t46_b12_probe",
      {waitUntil:"domcontentloaded",timeout:95000});
    await page.waitForFunction(()=>!!window.__b11Probe&&!!window.__b11BraceDebug,
      null,{timeout:70000});
    await signIn(managerA);
    await waitScope(managerA.id,sellerA);
    await managerTools();
    const before=oldRequests.length;
    const labelA="B11 Brace Original Stock A",labelB="B11 Brace Original Stock B";
    const stockQty=id=>sql("SELECT qty::text FROM public.character_stock WHERE id="+q(id));

    // Real authenticated B8 RPC A commits. Hold ONLY its HTTP200 while the
    // browser changes signed actors and B makes another concurrent delta.
    const gA=gate("qty:"+oldA+":delta"),promiseA=qtyClick(oldA,"delta","Add one "+labelA);
    assert.equal((await gA.arrived).status,200);
    assert.equal(stockQty(oldA),"3");
    await page.evaluate(()=>window.__b11Probe.signOut());
    await signIn(managerB);
    await select(1);
    await waitScope(managerB.id,sellerB);
    await page.waitForFunction(()=>window.__b11BraceDebug?.().gp===93,
      null,{timeout:50000});
    const gB=gate("qty:"+oldB+":delta"),promiseB=qtyClick(oldB,"delta","Add one "+labelB);
    assert.equal((await gB.arrived).status,200);
    assert.equal(stockQty(oldB),"3");
    gA.release();
    assert.equal((await promiseA).status(),200);
    await sleep(300);
    const during=await debug();
    assert.equal(during.actor,managerB.id);
    assert.equal(during.merchant,sellerB);
    assert.equal(during.pending,true,"B12 old delta finally cleared new busy");
    assert.equal(during.busy,"inc:"+oldB);
    assert.equal(during.gp,93);
    assert.equal(during.error,"");
    assert.ok(during.stock.every(x=>x.character_id===sellerB));
    gB.release();assert.equal((await promiseB).status(),200);
    await page.waitForFunction(id=>{
      const x=window.__b11BraceDebug?.();
      return x&&!x.pending&&x.busy===null&&
        x.stock.some(row=>row.id===id&&row.qty===3);
    },oldB,{timeout:45000});
    noRaw(before,prefix+" delta actor race");
    console.log("PASS T46-C2B12-"+prefix+
      "-DELTA-AUTH-RACE: two genuine signed qty delta commits, old HTTP200 after logout/new GM cannot clear new busy/error/93GP, exact seller qty 3/3, no PATCH");

    // Absolute SET must reject a stale quantity and updated_at snapshot
    // after a real signed buyer. Hold the 40001 HTTP500 error until switch.
    const buyer=await newActor("B12_BUYER_"+prefix,"player");
    sql("INSERT INTO public.player_wallets(user_id,gp) VALUES("+q(buyer.id)+",40)");
    const gp0=Number(walletOf(buyer.id)),inv0=Number(invCount(buyer.id));
    await select(0);await waitScope(managerB.id,sellerA);await managerTools();
    await page.getByTestId("c34-b9-stock-"+oldA)
      .getByText(labelA+": 3 in stock").waitFor({timeout:35000});
    const purchase=await buyer.who.rpc("buy_from_merchant",{
      p_merchant_id:sellerA,p_stock_uuid:oldA,p_qty:1
    });
    assert.ifError(purchase.error);
    assert.equal(stockQty(oldA),"2");
    const gCas=gate("qty:"+oldA+":set");
    const promiseCas=qtyClick(oldA,"set","Set two "+labelA);
    assert.equal((await gCas.arrived).status,500);
    await select(1);await waitScope(managerB.id,sellerB);
    gCas.release();
    const stale=await promiseCas;
    assert.equal(stale.status(),500);
    assert.equal((await stale.json()).code,"40001");
    await sleep(300);
    const postCas=await debug();
    assert.equal(postCas.merchant,sellerB);
    assert.equal(postCas.error,"","Old CAS error leaked to new merchant");
    assert.equal(postCas.busy,null);
    assert.equal(stockQty(oldA),"2");
    assert.equal(Number(walletOf(buyer.id)),gp0-3);
    assert.equal(Number(invCount(buyer.id)),inv0+1);
    noRaw(before,prefix+" stale CAS");
    console.log("PASS T46-C2B12-"+prefix+
      "-SET-CAS-RACE: genuine signed buyer 3->2, stale browser SET returns SQLSTATE40001/HTTP500 after merchant switch, 3GP/one inventory item only and no stale UI error");

    // Reroll inherits original catalog/rarity helpers and seller FIRST lock.
    // It is valid on a MOVING merchant; a delayed postcommit response cannot
    // replace the currently selected CAMPING merchant's visible stock.
    await select(0);await waitScope(managerB.id,sellerA);await managerTools();
    const shelfB=JSON.stringify(shelf(sellerB));
    const gReroll=gate("reroll:"+sellerA),pReroll=rerollClick(sellerA);
    const originalResult=await gReroll.arrived;
    assert.equal(originalResult.status,200,
      "B12 source-derived reroll must succeed under manager GM");
    const newShelfA=shelf(sellerA);
    assert.ok(newShelfA.length>=28&&newShelfA.length<=32,
      "B12 original rarity/catalog selection changed");
    assert.equal(newShelfA.some(x=>x.id===oldA),false);
    await select(1);await waitScope(managerB.id,sellerB);
    gReroll.release();assert.equal((await pReroll).status(),200);
    await sleep(360);
    const afterReroll=await debug();
    assert.equal(afterReroll.merchant,sellerB);
    assert.equal(afterReroll.error,"");
    assert.equal(afterReroll.busy,null);
    assert.ok(afterReroll.stock.every(x=>x.character_id===sellerB));
    assert.equal(JSON.stringify(shelf(sellerB)),shelfB);
    noRaw(before,prefix+" reroll postcommit");
    console.log("PASS T46-C2B12-"+prefix+
      "-REROLL-MERCHANT-RACE: source-derived seller-first reroll 28-32 rows actually committed to moving merchant, old HTTP200 cannot paint camping merchant stock or busy");

    // Missing RPC is a hard stop: no browser DELETE then INSERT fallback.
    const prevB=JSON.stringify(shelf(sellerB));
    const gMissing=gate("reroll:"+sellerB,"mock");
    const pMissing=rerollClick(sellerB);
    await gMissing.arrived;
    await select(0);await waitScope(managerB.id,sellerA);
    gMissing.release();assert.equal((await pMissing).status(),404);
    await sleep(300);
    const missing=await debug();
    assert.equal(missing.error,"");
    assert.equal(missing.merchant,sellerA);
    assert.equal(missing.busy,null);
    assert.equal(JSON.stringify(shelf(sellerB)),prevB);
    noRaw(before,prefix+" missing reroll");
    console.log("PASS T46-C2B12-"+prefix+
      "-REROLL-MISSING-RACE: delayed PGRST202 after merchant switch never reissues obsolete RPC or performs browser DELETE/INSERT fallback");

    // Deny when GM role is actually revoked BEFORE SQL starts. No stale JWT
    // role authority and no second fallback RPC.
    const oldShelf=JSON.stringify(shelf(sellerA));
    const gDeny=gate("reroll:"+sellerA,"before");
    const pDeny=rerollClick(sellerA);
    await gDeny.arrived;
    sql("UPDATE public.user_profiles SET role='player' WHERE id="+q(managerB.id));
    gDeny.release();
    const denied=await pDeny;
    assert.equal(denied.status(),403);
    assert.equal((await denied.json()).code,"42501");
    assert.equal(JSON.stringify(shelf(sellerA)),oldShelf);
    noRaw(before,prefix+" revoked reroll");
    await page.waitForFunction(()=>
      window.__b11BraceDebug?.().pending===false,null,{timeout:40000});
    console.log("PASS T46-C2B12-"+prefix+
      "-REROLL-ROLE-RACE: genuine signed GM reroll denied 42501 after DB role revoked before SQL, original shelf unchanged, no direct/fallback stock writes");

    assert.deepEqual(errors,[],prefix+" page errors "+JSON.stringify(errors)+
     " "+proc.tail().slice(-3200));
   }finally{
    for(const g of gates.values())g.release();
    for(const endpoint of endpoints)await page.unroute(endpoint).catch(()=>{});
    await page.close().catch(()=>{});page=null;
    await stop(next);next=null;
    if(routeWritten){fs.rmSync(probePath,{force:true});routeWritten=false}
   }
  }
  assert.equal(sql("SELECT md5(pg_get_functiondef('"+stockFunction+"'::regprocedure))"),priorDef);
  assert.equal(sql("SELECT md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))"),originalBuyer);
  assert.equal(sql("SELECT md5(pg_get_functiondef('public.c34_t46_manage_stock_qty_v1(uuid,text,integer,integer,timestamptz)'::regprocedure))"),priorQty);
  assert.equal(sql("SELECT md5(pg_get_functiondef('public.reroll_merchant_inventory_v2(uuid,text,integer)'::regprocedure))"),priorReroll);
  console.log("PASS T46-C2B12-SIGNED: source-locked original+guarded actual signed B8 delta/absolute CAS and B9 reroll pending-RPC actor/merchant-switch, role revoke, missing RPC fail-closed; inherited B2-B11 and SQL unchanged; production HOLD");
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
