#!/usr/bin/env node
// T26 REAL derived current manager on disposable Next.js + local PG17/GoTrue.
// No hosted services, no active route edits, no live DB writes or deployments.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { randomUUID } from "node:crypto";
import { spawn,spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import { deriveT26CurrentMerchantShop,T26_TEMP_ROUTE } from "./derive_t26_current_merchant_shop.mjs";

const env=process.env;
for(const [key,expected] of Object.entries({
 CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",
 PGPORT:"54322",PGUSER:"postgres",PGDATABASE:"postgres",
 DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
 C34_T26_BROWSER_CONFIRM:"CURRENT_NEXT_DISPOSABLE_LOCAL_ONLY"
}))assert.equal(env[key],expected,"Unsafe T26 env "+key);
assert.equal(env.DNDNEXT_C34_LOCAL_URL,"http://127.0.0.1:54321");
assert.ok(env.DNDNEXT_C34_LOCAL_ANON_KEY);
assert.ok(env.C33_BROWSER_TOOL_ROOT&&path.isAbsolute(env.C33_BROWSER_TOOL_ROOT));
assert.ok(env.C33_BROWSER_CHROME&&path.isAbsolute(env.C33_BROWSER_CHROME));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const probe=path.join(root,T26_TEMP_ROUTE);
const pdfDir=path.join(env.RUNNER_TEMP||"/tmp","c34-t25-pdf-"+randomUUID());
assert.ok(!fs.existsSync(probe),"T26 refuses overwriting a tracked or preexisting route");
const require=createRequire(path.join(env.C33_BROWSER_TOOL_ROOT,"t25-playwright-anchor.cjs"));
const {chromium}=require("playwright-core");
const client=()=>createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,
 {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const sql=query=>{
 const out=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",query],
  {env,encoding:"utf8",timeout:25000});
 assert.equal(out.status,0,"T26 local-only SQL "+out.stderr?.slice(-700));
 return out.stdout.trim();
};
const q=id=>{assert.match(id,/^[0-9a-f-]{36}$/i);return "'"+id+"'";};
async function createRole(name){
 const who=client(),email="t25-"+name+"-"+randomUUID()+"@example.invalid";
 const password="T26-"+randomUUID()+"!";
 assert.ifError((await who.auth.signUp({email,password})).error);
 assert.ifError((await who.auth.signInWithPassword({email,password})).error);
 const result=await who.auth.getUser();assert.ifError(result.error);
 return {who,id:result.data.user.id,email,password};
}
async function freePort(){return new Promise((resolve,reject)=>{
 const s=net.createServer();s.once("error",reject);
 s.listen(0,"127.0.0.1",()=>{const port=s.address().port;s.close(()=>resolve(port))});
})}
async function createCharacter(gm,kind,name,secret){
 const result=await gm.who.rpc("create_character_v1",{p_payload:{
  name,kind,creation_request_id:randomUUID(),
  description:"T26 APPROVED PUBLIC DESCRIPTION",
  background:"T26 PUBLIC BACKGROUND",motivation:"T26 PRIVATE MOTIVATION",
  secret,sheet:{classKey:"fighter",level:1,marker:"T26_REAL_SHEET",
    profileReveal:{background:true,secret:true},
    gmNotes:"T26_NOBODY_PRINTS_GM_NOTES"}
 }});
 assert.ifError(result.error);assert.match(result.data,/^[a-f0-9-]{36}$/i);
 sql("UPDATE public.characters SET is_hidden=false WHERE id="+q(result.data));
 return result.data;
}

// The original stage2 ACL is part of the test authority. Do not grant
// SELECT or change the fixture schema to make the legacy query pass.
// Narrow T24 verified columns are the only direct SELECT roster contract.
let server=null,browser=null,serverLog="";
fs.mkdirSync(pdfDir,{recursive:true});
try {
 const users={};
 for(const name of ["GM","COEDITOR","INVONLY","OUTSIDER"])
  users[name]=await createRole(name.toLowerCase());
 sql("INSERT INTO private.test_admins(id) VALUES("+q(users.GM.id)+")");
 // RED: the REAL stage2 source forbids a wide legacy manager roster read.
 // Never grant this to authenticated or bypass the column ACL for testing.
 const legacy=await users.GM.who.from("characters").select(
  "id,name,kind,background,motivation,quirk,mannerism,voice"
 ).eq("kind","npc").limit(1);
 assert.ok(legacy.error,"T26 must prove original wide roster SELECT stays blocked");
 assert.equal(legacy.error.code,"42501",
  "Unexpected wide roster failure; never substitute a blanket SELECT grant");
 // GREEN: T24 already demonstrated exact BASIC public roster query under
 // the same signed auth/RLS. Fail before running browser if this contract drifts.
 const safe=await users.GM.who.from("characters")
  .select("id,name,kind,role,description,location_id,storefront_enabled,is_hidden,portrait_url")
  .in("kind",["npc","merchant"]).limit(2);
 assert.ifError(safe.error);
 console.log("PASS T26-ACL-RED-GREEN: original wide roster denied (42501), T24 narrow signed projection succeeds");

 const secret="T26_GM_SECRET_NEVER_PUBLIC";
 const npc=await createCharacter(users.GM,"npc","T26 Probe NPC",secret);
 const merchant=await createCharacter(users.GM,"merchant","T26 Probe Merchant","T26_MERCHANT_SECRET");

 const merchantSigned=await users.GM.who.from("characters")
  .select("id,name,kind,role,description,location_id,storefront_enabled,is_hidden,portrait_url")
  .eq("kind","merchant").order("name",{ascending:true});
 assert.ifError(merchantSigned.error);
 assert.ok((merchantSigned.data||[]).some(row=>row.id===merchant),
   "Signed GM merchant must exist in T24 approved narrow roster");
 console.log("PASS T26-ACL-MERCHANT: signed merchant exists in exact T24-safe name-ordered roster");


 // T26 adds a NEW, signed/RLS-guarded *disposable-only* shelf table.
 // Never modify the original Stage2 character ACL or bypass authenticated RLS.
 sql("CREATE TABLE IF NOT EXISTS public.character_stock ("+
  "id uuid PRIMARY KEY, character_id uuid NOT NULL REFERENCES public.characters(id),"+
  "display_name text NOT NULL, qty integer NOT NULL, price_gp numeric NOT NULL,"+
  "card_payload jsonb NOT NULL DEFAULT '{}'::jsonb, description text, image_url text)");
 sql("ALTER TABLE public.character_stock ENABLE ROW LEVEL SECURITY");
 sql("GRANT SELECT ON public.character_stock TO authenticated");
 sql("DROP POLICY IF EXISTS t26_shop_visible_signed ON public.character_stock");
 sql("CREATE POLICY t26_shop_visible_signed ON public.character_stock FOR SELECT TO authenticated "+
  "USING (auth.uid() IS NOT NULL AND EXISTS ("+
  "SELECT 1 FROM public.characters c WHERE c.id=character_id AND "+
  "c.kind='merchant' AND c.storefront_enabled=true))");
 sql("UPDATE public.characters SET storefront_enabled=true WHERE id="+q(merchant));
 sql("NOTIFY pgrst, 'reload schema'");
 const stockId=randomUUID(), stockLabel="T26 AUTUMN WILLOW ELIXIR";
 sql("INSERT INTO public.character_stock (id,character_id,display_name,qty,price_gp,card_payload) VALUES ("+
  q(stockId)+","+q(merchant)+",'"+stockLabel+"',3,12,"+
  "'{\"item_type\":\"Potion\",\"item_rarity\":\"Common\",\"item_description\":\"Synthetic signed local shelf\"}'::jsonb)");
 let signedStock=null;
 for(let retry=0;retry<16;retry++){
  signedStock=await users.GM.who.from("character_stock")
   .select("id,display_name,qty").eq("character_id",merchant);
  if(!signedStock.error)break;
  if(retry<15)await new Promise(resolve=>setTimeout(resolve,300));
 }
 assert.ifError(signedStock.error);
 assert.equal(signedStock.data.length,1);
 const anonymousStock=await client().from("character_stock")
  .select("id").eq("character_id",merchant);
 assert.ok(anonymousStock.error || anonymousStock.data?.length===0,
  "T26 stock must never leak to anon role");
 console.log("PASS T26-STOCK: real current merchant shelf seeded with signed RLS, anon denied in disposable PG17");

 for(const [label,edit,inventory] of [["COEDITOR",true,false],["INVONLY",false,true]])
  sql("INSERT INTO public.character_permissions(character_id,user_id,can_edit,can_inventory,can_convert) VALUES("+
   q(npc)+","+q(users[label].id)+","+(edit?"true":"false")+","+(inventory?"true":"false")+",false)");
 const {output,edits}=deriveT26CurrentMerchantShop();
 assert.ok(edits.length>=12);
 fs.writeFileSync(probe,output,{flag:"wx"});
 const nextPort=await freePort(),origin="http://127.0.0.1:"+nextPort;
 const nextBin=path.join(root,"node_modules/next/dist/bin/next");
 assert.ok(fs.existsSync(nextBin),"T26 needs npm ci and pinned Next.js");
 server=spawn(process.execPath,[nextBin,"dev","-H","127.0.0.1","-p",String(nextPort)],{
  cwd:root,detached:true,stdio:["ignore","pipe","pipe"],
  env:{...env,NEXT_PUBLIC_SUPABASE_URL:env.DNDNEXT_C34_LOCAL_URL,
   NEXT_PUBLIC_SUPABASE_ANON_KEY:env.DNDNEXT_C34_LOCAL_ANON_KEY,
   NODE_ENV:"development",NEXT_TELEMETRY_DISABLED:"1"}
 });
 for(const stream of [server.stdout,server.stderr])
  stream.on("data",b=>serverLog=(serverLog+b.toString()).slice(-16000));
 const route=origin+"/__c34_t26_probe";
 let ready=false;
 for(let i=0;i<110;i++){
  if(server.exitCode!==null)throw Error("T26 Next exited "+serverLog);
  try{
   const response=await fetch(route,{signal:AbortSignal.timeout(2400)});
   if(response.ok&&(await response.text()).includes("npcs-page-root")){ready=true;break}
  }catch{}
  await new Promise(done=>setTimeout(done,1200));
 }
 assert.ok(ready,"T26 derived actual manager failed Next compile "+serverLog);
 console.log("PASS T26-C01 derived original 2420-line NPC manager compiled on current Next with unchanged _app");
 browser=await chromium.launch({executablePath:env.C33_BROWSER_CHROME,
  headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
 const page=await context.newPage(),offsite=[],errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.route("**/*",async r=>{
  const url=r.request().url();
  if(url.startsWith(origin)||url.startsWith(env.DNDNEXT_C34_LOCAL_URL)||
     url.startsWith("ws://127.0.0.1:"+nextPort))return r.continue();
  if(/supabase\.co|supabase\.in|service_role/i.test(url))offsite.push(url.slice(0,160));
  return r.abort();
 });
 await page.addInitScript(()=>{
  const originalCreate=URL.createObjectURL.bind(URL);
  window.__T26_PDF_BYTES__=null;
  URL.createObjectURL=blob=>{
   if(blob?.type==="application/pdf")
    blob.arrayBuffer().then(buf=>window.__T26_PDF_BYTES__=Array.from(new Uint8Array(buf)));
   return originalCreate(blob);
  };
 });
 const login=async(label)=>{
  const {email,password}=users[label];
  const response=await page.evaluate(async({email,password})=>{
   const {data,error}=await window.__sb.auth.signInWithPassword({email,password});
   if(error)throw Error(error.message);
   return data.user.id;
  },{email,password});
  assert.equal(response,users[label].id);
  await page.reload({waitUntil:"domcontentloaded"});
 };
 const logout=async()=>{
  await page.evaluate(async()=>{
   const {error}=await window.__sb.auth.signOut();
   if(error)throw Error(error.message);
  });
 };
 const body=()=>page.locator(".npcs-page-root").innerText();
 await page.goto(route+"?focus=npc:"+npc,{waitUntil:"domcontentloaded",timeout:30000});
 await page.waitForFunction(()=>!!window.__sb?.auth,null,{timeout:30000});
 await page.addStyleTag({path:path.join(root,"node_modules/bootstrap/dist/css/bootstrap.min.css")});
 await login("GM");
 try {
 await page.getByText("T26 Probe NPC",{exact:true}).first().waitFor({timeout:30000});
 } catch(error) {
  const details=await page.evaluate(async()=>{
   const user=await window.__sb?.auth?.getUser().catch(e=>({error:{message:String(e)}}));
   const jwt=user?.data?.user?.id||"no-actor";
   const direct=await window.__sb?.from("characters")
    .select("id,name,kind").eq("kind","npc").limit(5)
    .then(v=>({error:v.error?.message||null,code:v.error?.code||null,rows:v.data?.map(x=>({id:x.id,name:x.name}))}))
    .catch(e=>({exception:String(e)}));
   return {jwt,direct,body:document.body.innerText.slice(0,4000)};
  });
  console.error("T26-DIAG-C02",JSON.stringify({
   details,pageUrl:page.url(),pageErrors:errors,offsite,
   nextServerLog:serverLog.slice(-7000)
  }));
  throw error;
 }
 await page.locator('[data-testid="t25-selected-character"]').waitFor({state:"visible",timeout:30000});
 assert.equal(await page.getByTestId("t25-selected-character").getAttribute("data-character-id"),npc,
  "Focus route must select requested NPC ID, never whichever roster completes first");
 try {
 await page.getByText("T26 APPROVED PUBLIC DESCRIPTION").first().waitFor({timeout:30000});
 } catch(error){
  const state=await page.evaluate(async(id)=>{
   const auth=await window.__sb.auth.getUser();
   const profile=await window.__sb.rpc("get_npc_profile_visible_v1",{p_character_id:id});
   return {userId:auth.data?.user?.id||null,status:profile.error?.code||"ok",
    profileId:profile.data?.id||null,description:profile.data?.description||null,
    visibleText:document.body.innerText.slice(0,3000)};
  },npc);
  console.error("T26-DIAG-C02-DESCRIPTION",JSON.stringify({state,pageErrors:errors}));
  throw error;
 }
 assert.ok((await body()).includes("T26 Probe NPC"));
 try {
  await page.getByText("T26 PUBLIC BACKGROUND",{exact:true}).first().waitFor({timeout:30000});
 } catch(error){
  const probe=await page.evaluate(async(id)=>{
   const user=await window.__sb.auth.getUser();
   const profile=await window.__sb.rpc("get_npc_profile_visible_v1",{p_character_id:id});
   const gm=await window.__sb.rpc("get_npc_dossier_admin_v1",{p_character_id:id});
   return {
    actorPresent:!!user?.data?.user,
    profileStatus:profile.error?.code||"ok",
    profileId:profile.data?.id||null,
    profileBackground:profile.data?.lore?.background||null,
    gmStatus:gm.error?.code||"ok",
    gmId:gm.data?.id||null,
    visibleText:document.body.innerText.slice(0,3500),
   };
  },npc);
  console.error("T26-DIAG-BACKGROUND",JSON.stringify({probe,pageErrors:errors}));
  throw error;
 }
 console.log("PASS T26-C02 original deep-link and GM selected Profile load without page-wide sheet cache");
 await page.getByRole("button",{name:"Print Sheet"}).waitFor({timeout:30000});
 await page.getByRole("button",{name:"Print Sheet"}).click();
 await page.waitForFunction(()=>Array.isArray(window.__T26_PDF_BYTES__)&&window.__T26_PDF_BYTES__.length>1000,null,{timeout:30000});
 const bytes=await page.evaluate(()=>window.__T26_PDF_BYTES__);
 const pdf=await PDFDocument.load(Uint8Array.from(bytes));
 assert.equal(pdf.getPageCount(),3);
 const file=path.join(pdfDir,"gm-public.pdf");fs.writeFileSync(file,Buffer.from(bytes));
 const extracted=spawnSync("pdftotext",["-layout",file,"-"],{env,encoding:"utf8",timeout:20000});
 assert.equal(extracted.status,0,extracted.stderr);
 assert.ok(extracted.stdout.includes("T26 Probe NPC"));
 assert.ok(!extracted.stdout.includes(secret),"Explicit public PDF leaked GM Secret");
 assert.ok(!extracted.stdout.includes("T26_NOBODY_PRINTS_GM_NOTES"),"PDF rendered GM-only sheet notes");
 console.log("PASS T26-C03 original live manager Print Sheet generates true safe 3-page PDF");
 try {
 await page.locator(".npc-roster-list").getByRole("button",{name:/T26 Probe Merchant/}).click();
 } catch(error) {
  const probe=await page.evaluate(async()=>{
   const r=await window.__sb.from("characters")
     .select("id,name,kind,role,description,location_id,storefront_enabled,is_hidden,portrait_url")
     .eq("kind","merchant").order("name",{ascending:true});
   return {error:r.error?.message||null,code:r.error?.code||null,
    rows:(r.data||[]).map(v=>({id:v.id,name:v.name})).slice(0,10),
    visibleText:document.body.innerText.slice(0,2400)};
  });
  console.error("T26-DIAG-C04-MERCHANT",JSON.stringify({probe,pageErrors:errors}));
  throw error;
 }
 await page.getByText("T26 Probe Merchant",{exact:true}).first().waitFor();
 assert.ok(!(await body()).includes(secret),"NPC dossier remained after merchant switch");
 console.log("PASS T26-C04 merchant roster switch clears NPC secret and retains original manager controls");

 // Test the REAL current MerchantPanel/StorefrontView behind an allowlisted
 // selected-only non-map Profile. The shared map-connected NpcPanel is HELD.
 await page.getByTestId("t26-open-public-profile").click();
 await page.getByTestId("t26-safe-merchant-profile").waitFor({timeout:30000});
 assert.equal(await page.getByTestId("t26-safe-merchant-profile").getAttribute("data-character-id"),merchant);
 await page.getByRole("button",{name:"Let me browse your wares."}).click();
 await page.getByTestId("t26-real-merchant-shop").waitFor({timeout:30000});
 const actualStock=page.getByRole("listbox",{name:"Merchant stock"});
 await actualStock.getByRole("option",{name:new RegExp(stockLabel)}).waitFor({timeout:30000});
 assert.ok((await page.getByTestId("t26-real-merchant-shop").innerText()).includes("12 gp"));
 assert.ok(!(await body()).includes(secret),"Merchant shop retained previous NPC secret");
 console.log("PASS T26-S01: signed CURRENT manager Profile → REAL MerchantPanel stock, no NPC secret");
 await page.getByRole("button",{name:"Return to Profile"}).click();
 await page.getByTestId("t26-safe-merchant-profile").waitFor();
 assert.equal(await page.getByTestId("t26-real-merchant-shop").count(),0);
 assert.equal(await page.getByText(stockLabel,{exact:true}).count(),0,
  "Return to Profile must remove real stock DOM and selected item");
 console.log("PASS T26-S02: REAL shop → Profile returns to selected merchant and unmounts stock");

 // Race 1: Deliberately delay an actual signed merchant Stage1 PostgREST
 // response, switch to another selected character, then release old bytes.
 await page.getByRole("button",{name:"Close Profile"}).click();
 await page.locator(".npc-roster-list").getByRole("button",{name:/T26 Probe NPC/}).click();
 await page.getByTestId("t25-selected-character").waitFor();
 let released=()=>{},captured=false;
 const gate=new Promise(resolve=>{released=resolve});
 await page.route("**/rest/v1/rpc/get_npc_profile_visible_v1",async rt=>{
  let payload={};
  try{payload=rt.request().postDataJSON()||{}}catch{}
  if(!captured && payload.p_character_id===merchant){
   captured=true;
   await gate;
  }
  try{await rt.continue()}catch{}
 });
 await page.locator(".npc-roster-list").getByRole("button",{name:/T26 Probe Merchant/}).click();
 for(let t=0;t<80&&!captured;t++)await page.waitForTimeout(100);
 assert.ok(captured,"T26 failed to intercept real merchant Stage1 PostgREST read");
 await page.locator(".npc-roster-list").getByRole("button",{name:/T26 Probe NPC/}).click();
 await page.waitForFunction(id=>document.querySelector("[data-testid='t25-selected-character']")?.getAttribute("data-character-id")===id,npc);
 released();
 await page.waitForTimeout(400);
 assert.equal(await page.getByTestId("t25-selected-character").getAttribute("data-character-id"),npc,
  "Delayed merchant Profile overwrote current NPC selection");
 assert.equal(await page.getByTestId("t26-real-merchant-shop").count(),0);
 assert.ok(!(await body()).includes("T26_MERCHANT_SECRET"));
 await page.unroute("**/rest/v1/rpc/get_npc_profile_visible_v1");
 console.log("PASS T26-R01: delayed authenticated merchant Stage1 response cannot overwrite different NPC");

 // Race 2: A signed account switch while the original store is open must
 // unmount and destroy its old stock in the same authorization transition.
 await page.locator(".npc-roster-list").getByRole("button",{name:/T26 Probe Merchant/}).click();
 await page.getByTestId("t26-open-public-profile").click();
 await page.getByTestId("t26-safe-merchant-profile").waitFor();
 await page.getByRole("button",{name:"Let me browse your wares."}).click();
 await page.getByTestId("t26-real-merchant-shop").waitFor();
 await actualStock.getByRole("option",{name:new RegExp(stockLabel)}).waitFor();
 await logout();
 await page.getByTestId("t26-real-merchant-shop").waitFor({state:"detached",timeout:15000});
 assert.equal(await page.getByRole("listbox",{name:"Merchant stock"}).count(),0,
  "Merchant storefront survived signed user logout");
 console.log("PASS T26-R02: GM logout drops original shop stock and selected Profile");

 // T27-R01 — REAL signed character_stock GET is fetched from local PostgREST,
 // then deliberately held at the browser route while GM signs out. A normal
 // shop reload after logout is NOT an equivalent test: the response must
 // have actually been issued while authenticated and arrive AFTER SIGNED_OUT.
 // This tests the unchanged original MerchantPanel through the scratch-only
 // auth-clearing adapter. It does not prove the live shared/map Profile safe.
 await login("GM");
 await page.locator(".npc-roster-list").getByRole("button",{name:/T26 Probe Merchant/}).click();
 await page.getByTestId("t26-open-public-profile").click();
 await page.getByTestId("t26-safe-merchant-profile").waitFor({timeout:30000});
 let stockHeld=false,stockFetch=null,stockDeliveryError=null;
 let releaseHeldStock=()=>{},signalStockDelivered=()=>{};
 const stockGate=new Promise(resolve=>{releaseHeldStock=resolve});
 const stockDelivered=new Promise(resolve=>{signalStockDelivered=resolve});
 await page.route("**/rest/v1/character_stock*",async rt=>{
  let url=null;
  try{url=new URL(rt.request().url())}catch{}
  const scopedStock=url?.searchParams.get("character_id")==="eq."+merchant;
  if(stockHeld||rt.request().method()!=="GET"||!scopedStock){
   try{await rt.continue()}catch{}
   return;
  }
  stockHeld=true;
  try{
   const upstream=await rt.fetch();
   const upstreamRows=await upstream.json();
   stockFetch={status:upstream.status(),rows:upstreamRows};
   // A delivered, already-authorized response is the actual race subject.
   // Its bytes must not reach the renderer until after auth becomes null.
   await stockGate;
   await rt.fulfill({response:upstream});
  }catch(cause){
   stockDeliveryError=String(cause);
  }finally{signalStockDelivered()}
 });
 await page.getByRole("button",{name:"Let me browse your wares."}).click();
 await page.getByTestId("t26-real-merchant-shop").waitFor({timeout:30000});
 for(let t=0;t<100&&!stockFetch;t++)await page.waitForTimeout(100);
 assert.ok(stockHeld,"T27 did not intercept original signed GET character_stock request");
 assert.equal(stockFetch?.status,200,"T27 held original stock GET was not authorized by real local PostgREST");
 assert.ok(Array.isArray(stockFetch?.rows)&&stockFetch.rows.some(item=>item.display_name===stockLabel),
  "T27 must hold the actual signed merchant shelf bytes, not a mocked or empty response");
 assert.equal(await actualStock.getByRole("option",{name:new RegExp(stockLabel)}).count(),0,
  "T27 merchant stock rendered before the deliberately held response");
 await logout();
 await page.getByTestId("t26-real-merchant-shop").waitFor({state:"detached",timeout:15000});
 assert.equal(await page.getByRole("listbox",{name:"Merchant stock"}).count(),0,
  "T27 actor logout must unmount the shop BEFORE old stock is delivered");
 releaseHeldStock();
 await Promise.race([
  stockDelivered,
  new Promise((_,reject)=>setTimeout(()=>reject(Error("T27 timed out delivering held stock AFTER signout")),15000))
 ]);
 await page.unroute("**/rest/v1/character_stock*");
 assert.equal(stockDeliveryError,null,"T27 held PostgREST stock fulfillment failed: "+stockDeliveryError);
 await page.waitForTimeout(450);
 assert.equal(await page.getByTestId("t26-real-merchant-shop").count(),0,
  "T27 old signed response recreated the GM's shop after logout");
 assert.equal(await page.getByRole("listbox",{name:"Merchant stock"}).count(),0,
  "T27 late stock bytes reached an unauthenticated shop");
 assert.equal(await page.getByText(stockLabel,{exact:true}).count(),0,
  "T27 delayed GM shelf item leaked into a post-logout DOM");
 console.log("PASS T27-R01: REAL signed local character_stock GET bytes held, GM signs out, late response delivered, shop and stock remain destroyed");

 await login("OUTSIDER");
 await page.getByText("T26 Probe NPC",{exact:true}).first().waitFor();
 await page.getByTestId("t25-sheet-restricted").waitFor();
 assert.equal(await page.getByRole("button",{name:"Print Sheet"}).count(),0,"Outsider retained Print Sheet");
 assert.ok(!(await body()).includes(secret),"Outsider saw prior GM dossier");
 assert.ok(!(await body()).includes("T26 PRIVATE MOTIVATION"));

 // A signed outsider has NO canonical Sheet access, but must still be able to
 // open the public merchant Profile and browse genuinely available shelf stock.
 await page.locator(".npc-roster-list").getByRole("button",{name:/T26 Probe Merchant/}).click();
 await page.getByTestId("t26-open-public-profile").click();
 await page.getByTestId("t26-safe-merchant-profile").waitFor({timeout:30000});
 assert.ok(!(await page.getByTestId("t26-safe-merchant-profile").innerText()).includes("T26_MERCHANT_SECRET"));
 await page.getByRole("button",{name:"Let me browse your wares."}).click();
 await page.getByTestId("t26-real-merchant-shop").waitFor({timeout:30000});
 await actualStock.getByRole("option",{name:new RegExp(stockLabel)}).waitFor({timeout:30000});
 assert.ok(!(await body()).includes(secret));
 await page.getByRole("button",{name:"Return to Profile"}).click();
 await page.getByRole("button",{name:"Close Profile"}).click();
 console.log("PASS T26-S03: outsider with no Sheet opens authorized merchant public Profile and original stock safely");

 console.log("PASS T26-C05 GM-to-outsider signed account switch denies private narrative");
 await logout();await login("COEDITOR");
 await page.locator(".npc-roster-list").getByRole("button",{name:/T26 Probe NPC/}).click();
 await page.getByRole("button",{name:"Print Sheet"}).waitFor();
 sql("UPDATE public.character_permissions SET can_edit=false WHERE character_id="+q(npc)+
  " AND user_id="+q(users.COEDITOR.id));
 await page.getByTestId("t25-refresh-permissions").click();
 await page.getByTestId("t25-sheet-restricted").waitFor({timeout:30000});
 assert.equal(await page.getByRole("button",{name:"Print Sheet"}).count(),0,"Revoked editor retained Print Sheet");
 assert.ok(!(await body()).includes(secret),"Revoked editor saw GM secret");
 console.log("PASS T26-C06 real local permission revocation and explicit refresh clear elevated manager data");
 assert.deepEqual(offsite,[],"T26 attempted an offsite Supabase request");
 assert.deepEqual(errors,[],"T26 browser exceptions "+errors.join("; "));
 console.log("T26 original merchant storefront and actor/character race signed browser PASS; production unchanged.");
}finally {
 if(browser)await browser.close().catch(()=>{});
 if(server?.pid){try{process.kill(-server.pid,"SIGTERM")}catch{server.kill("SIGTERM")}}
 try{fs.unlinkSync(probe)}catch{}
 fs.rmSync(pdfDir,{recursive:true,force:true});
 assert.ok(!fs.existsSync(probe),"T26 must remove disposable Next route in finally");
}
