#!/usr/bin/env node
// T38-P2-R5: real source-original KindPicker /npcs via signed disposable Next PG17.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import {randomUUID} from "node:crypto";
import {spawn,spawnSync} from "node:child_process";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
import {createClient} from "@supabase/supabase-js";
import {makeT36Source,reconcileT36Route,T36_LOCAL_ROUTE,T36_MARKER} from "./prepare_t36_npcs_route.mjs";
const env=process.env;
for(const [k,v] of Object.entries({
 CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
 PGUSER:"postgres",PGDATABASE:"postgres",
 DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
 C34_T38_P2_BROWSER_CONFIRM:"ORIGINAL_MERCHANT_SHOP_INVENTORY_DISPOSABLE_ONLY"
}))assert.equal(env[k],v,"T38-R5 unsafe environment "+k);
assert.equal(env.DNDNEXT_C34_LOCAL_URL,"http://127.0.0.1:54321");
assert.ok(env.DNDNEXT_C34_LOCAL_ANON_KEY);
assert.ok(env.C33_BROWSER_TOOL_ROOT&&path.isAbsolute(env.C33_BROWSER_TOOL_ROOT));
assert.ok(env.C33_BROWSER_CHROME&&path.isAbsolute(env.C33_BROWSER_CHROME));
assert.notEqual(env.VERCEL,"1");
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const derivedPath=path.join(root,T36_LOCAL_ROUTE);
assert.ok(!fs.existsSync(derivedPath),"T38-R5 refuses stale generated NPC manager");
const require=createRequire(path.join(env.C33_BROWSER_TOOL_ROOT,"t38-r5-playwright-anchor.cjs"));
const {chromium}=require("playwright-core");
const client=()=>createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,
 {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const q=x=>{assert.match(x,/^[a-f0-9-]{36}$/i);return "'"+x+"'";};
function sql(s){
 const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",s],
  {cwd:root,env,encoding:"utf8",timeout:25000});
 assert.equal(r.status,0,"T38-R5 local SQL "+r.stderr?.slice(-1100));
 return r.stdout.trim();
}
const canonical=id=>sql("SELECT md5(sheet::text) FROM public.character_sheets WHERE character_id="+q(id))+"|"+
 sql("SELECT coalesce(secret,'') FROM public.characters WHERE id="+q(id))+"|"+
 sql("SELECT creation_request_id::text FROM public.characters WHERE id="+q(id));
async function actor(label,role){
 const who=client(),email="t38-r5-"+label+"-"+randomUUID()+"@example.invalid",password="T38r5-"+randomUUID()+"!";
 assert.ifError((await who.auth.signUp({email,password})).error);
 assert.ifError((await who.auth.signInWithPassword({email,password})).error);
 const identity=await who.auth.getUser();assert.ifError(identity.error);
 const id=identity.data.user.id;
 sql("INSERT INTO public.user_profiles(id,role) VALUES("+q(id)+",'"+role+"') ON CONFLICT(id) DO UPDATE SET role=excluded.role");
 return {who,id,email,password};
}
async function create(gm,name,kind){
 const r=await gm.who.rpc("create_character_v1",{p_payload:{
  name,kind,creation_request_id:randomUUID(),
  description:"T38 R5 VALID CHARACTER",background:"T38 R5 PUBLIC",
  secret:"T38 R5 PRIVATE",sheet:{classKey:"fighter",level:1,marker:"T38-R5-FORGE"}
 }});
 assert.ifError(r.error);assert.match(r.data,/^[a-f0-9-]{36}$/i);
 sql("UPDATE public.characters SET is_hidden=false WHERE id="+q(r.data));
 return r.data;
}
async function freePort(){return new Promise((resolve,reject)=>{
 const s=net.createServer();s.once("error",reject);
 s.listen(0,"127.0.0.1",()=>{const p=s.address().port;s.close(()=>resolve(p))});
})}
assert.equal(sql("SELECT has_column_privilege('authenticated','public.characters','kind','UPDATE')"),"f");
assert.equal(sql("SELECT has_column_privilege('authenticated','public.characters','storefront_enabled','UPDATE')"),"t");
assert.notEqual(sql("SELECT md5(pg_get_functiondef('public.set_character_kind(uuid,text)'::regprocedure))"),
 "04588d4b433b13c92e612039a7c7e56e","T38-R5 must follow original RED plus scratch GREEN");

// Signed R5: EXACT source-derived original /npcs GM Profile -> Shop ->
// Profile -> Inventory, authentic purchase, then merchant -> NPC cleanup.
const gm=await actor("gm","gm");
const outsider=await actor("outsider","player");
sql("INSERT INTO private.test_admins(id) VALUES("+q(gm.id)+") ON CONFLICT DO NOTHING");
const npc=await create(gm,"T38 R5 Converted Merchant","npc");
const original=canonical(npc);
const marker="T38 R5 Durable Compass",stockName="T38 R5 Copper Lantern";
const personalItem=randomUUID(),stockId=randomUUID();
sql("INSERT INTO public.inventory_items(id,item_id,item_name,item_type,owner_type,owner_id,card_payload,is_equipped,quantity) VALUES("+
 q(personalItem)+",'t38-r5-compass','"+marker+"','Equipment','npc',"+
 q(npc)+"::text,'{}'::jsonb,false,1)");
sql("INSERT INTO public.player_wallets(user_id,gp) VALUES("+q(gm.id)+",100) ON CONFLICT(user_id) DO UPDATE SET gp=100");
const initialInventory=sql("SELECT count(*) FROM public.inventory_items WHERE owner_id="+q(npc)+"::text AND id="+q(personalItem));
assert.equal(initialInventory,"1");
// Live read-only source-verification: character_stock SELECT to authenticated
// constrained by existence of a referenced public.characters row.
// The inherited I1C fixture explicitly *revoked* stock SELECT, so install
// only the exact live-shaped read rule, never a production migration.
assert.equal(sql("SELECT current_database() || '|' || (current_setting('server_version_num')::int >= 170000)::text"),"postgres|true");
sql("REVOKE SELECT ON public.character_stock FROM PUBLIC, anon");
sql("GRANT SELECT ON public.character_stock TO authenticated");
sql("DO $r5$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='character_stock' AND policyname='character_stock_select_authenticated') THEN CREATE POLICY character_stock_select_authenticated ON public.character_stock FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.characters c WHERE c.id=character_stock.character_id)); END IF; END $r5$");
assert.equal(sql("SELECT has_table_privilege('authenticated','public.character_stock','SELECT')"),"t");
assert.equal(sql("SELECT has_table_privilege('anon','public.character_stock','SELECT')"),"f");
assert.ok(sql("SELECT to_regprocedure('public.buy_from_merchant(uuid,uuid,integer)')")!=="" );
let server=null,browser=null,serverLog="";
try{
 assert.ok(makeT36Source().includes(T36_MARKER));
 assert.ok(reconcileT36Route({...env,NEXT_PUBLIC_C34_T36_NPCS_RESEARCH:"1",
  C34_T36_LOCAL_CONFIRM:"SIGNED_LOCAL_PG17_T36_ONLY"},{prepare:true}));
 const nextBin=path.join(root,"node_modules/next/dist/bin/next");
 assert.ok(fs.existsSync(nextBin));
 const port=await freePort(),origin="http://127.0.0.1:"+port;
 server=spawn(process.execPath,[nextBin,"dev","--webpack","-H","127.0.0.1","-p",String(port)],{
  cwd:root,detached:true,stdio:["ignore","pipe","pipe"],env:{...env,
   NEXT_PUBLIC_C34_T36_NPCS_RESEARCH:"1",C34_T36_LOCAL_CONFIRM:"SIGNED_LOCAL_PG17_T36_ONLY",
   NEXT_PUBLIC_SUPABASE_URL:env.DNDNEXT_C34_LOCAL_URL,
   NEXT_PUBLIC_SUPABASE_ANON_KEY:env.DNDNEXT_C34_LOCAL_ANON_KEY,
   NODE_ENV:"development",NEXT_TELEMETRY_DISABLED:"1"}
 });
 for(const stream of [server.stdout,server.stderr])
  stream.on("data",chunk=>serverLog=(serverLog+chunk.toString()).slice(-17000));
 const route=origin+"/npcs";let ready=false;
 for(let i=0;i<110;i++){
  if(server.exitCode!==null)throw Error("R5 original Next exited "+serverLog);
  try{
   const response=await fetch(route,{signal:AbortSignal.timeout(3000)});
   if(response.ok&&(await response.text()).includes(T36_MARKER)){ready=true;break}
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,1100));
 }
 assert.ok(ready,"R5 original manager did not compile "+serverLog);
 browser=await chromium.launch({executablePath:env.C33_BROWSER_CHROME,
  headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const context=await browser.newContext({viewport:{width:1500,height:940}});
 const page=await context.newPage(),offsite=[],errors=[],dialogs=[],calls=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("dialog",async d=>{dialogs.push(d.message());await d.dismiss()});
 page.on("request",req=>{
  if(req.url().includes("/rpc/buy_from_merchant")||
     req.url().includes("/rpc/set_character_kind")){
   try{calls.push({path:new URL(req.url()).pathname,body:JSON.parse(req.postData()||"{}")})}
   catch{calls.push({badPayload:true})}
  }
 });
 await page.route("**/*",r=>{
  const url=r.request().url();
  if(url.startsWith(origin)||url.startsWith(env.DNDNEXT_C34_LOCAL_URL)||
   url.startsWith("ws://127.0.0.1:"+port))return r.continue();
  if(/supabase\.co|supabase\.in|service_role/i.test(url))offsite.push(url.slice(0,150));
  return r.abort();
 });
 async function login(user,type,id){
  await page.goto(route+"?focus="+type+":"+id,{waitUntil:"domcontentloaded",timeout:90000});
  await page.waitForFunction(()=>!!window.__sb?.auth,null,{timeout:40000});
  const signedId=await page.evaluate(async({email,password})=>{
   const {data,error}=await window.__sb.auth.signInWithPassword({email,password});
   if(error)throw Error(error.message);
   return data.user.id;
  },{email:user.email,password:user.password});
  assert.equal(signedId,user.id);
  await page.reload({waitUntil:"domcontentloaded",timeout:90000});
  await page.getByTestId("t25-selected-character").waitFor({timeout:60000});
  assert.equal(await page.getByTestId("t25-selected-character").getAttribute("data-character-id"),id);
 }
 async function waitKind(id,k){
  for(let i=0;i<70;i++){
   if(sql("SELECT kind FROM public.characters WHERE id="+q(id))===k)return;
   await new Promise(resolve=>setTimeout(resolve,320));
  }
  throw Error("R5 original KindPicker did not persist "+k);
 }
 const shell=page.locator(".npc-page-profile-panel-shell");
 async function openProfile(){
  await page.locator(".csheet-actions").getByRole("button",{name:"Profile",exact:true})
   .waitFor({state:"visible",timeout:35000});
  await page.locator(".csheet-actions").getByRole("button",{name:"Profile",exact:true}).click();
  await shell.locator(".npc-panel-header").waitFor({state:"visible",timeout:35000});
 }
 async function closeProfile(){
  await shell.locator(".npc-panel-header").getByRole("button",{name:"Close",exact:true}).click();
  await shell.waitFor({state:"detached",timeout:25000});
 }
 async function chooseKind(target){
  await page.getByRole("button",{name:"Edit",exact:true}).first().waitFor({timeout:40000});
  await page.getByRole("button",{name:"Edit",exact:true}).first().click();
  await page.locator(".csheet--edit").waitFor({timeout:20000});
  const picker=page.getByRole("button",{name:/^Kind:\s*(NPC|Merchant)/});
  await picker.waitFor({state:"visible",timeout:30000});
  await picker.click();
  await page.getByRole("menuitem",{name:new RegExp("^"+(target==="merchant"?"Merchant":"NPC"))}).click();
  await waitKind(npc,target);
 }
 async function inventoryChecks(){
  await shell.locator(".npc-panel-header").getByRole("button",{name:"Inventory",exact:true}).click();
  await shell.locator(".npc-panel-inventory-workbench").waitFor({state:"visible",timeout:40000});
  assert.equal(await shell.getByText("You do not have permission to view this inventory.").count(),0);
  assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE id="+q(personalItem)+" AND owner_id="+q(npc)+"::text"),"1");
  assert.equal(canonical(npc),original);
 }
 await login(gm,"npc",npc);
 await page.locator(".npc-panel-scroll").getByText("T38 R5 PRIVATE",{exact:true})
  .waitFor({state:"visible",timeout:40000});
 await openProfile();
 assert.equal(await shell.locator(".npc-panel-header").getByRole("button",{name:"Shop",exact:true}).count(),0,
  "NPC unexpectedly exposed merchant Shop before conversion");
 await inventoryChecks();
 await shell.locator(".npc-panel-header").getByRole("button",{name:"Profile",exact:true}).click();
 await closeProfile();
 console.log("PASS T38-P2-R5-NPC-PROFILE: original Profile/Inventory intact; no premature Shop");
 await chooseKind("merchant");
 assert.equal(canonical(npc),original);
 assert.equal(sql("SELECT storefront_enabled::text FROM public.characters WHERE id="+q(npc)),"true");
 // Stock starts empty on newly converted merchant.
 assert.equal(sql("SELECT count(*) FROM public.character_stock WHERE character_id="+q(npc)),"0");
 sql("INSERT INTO public.character_stock(id,character_id,qty,display_name,card_payload,price_gp,item_id) VALUES("+
 q(stockId)+","+q(npc)+",7,'"+stockName+"',"+
 "'{\"item_name\":\""+stockName+"\",\"item_type\":\"Equipment\",\"item_description\":\"R5 source original sale\"}'::jsonb,13,'t38_r5_lantern')");
 await page.goto(route+"?focus=merchant:"+npc,{waitUntil:"domcontentloaded",timeout:90000});
 await page.getByTestId("t25-selected-character").waitFor({timeout:60000});
 await openProfile();
 await shell.locator(".npc-panel-header").getByRole("button",{name:"Shop",exact:true})
  .waitFor({state:"visible",timeout:40000});
 await shell.locator(".npc-panel-header").getByRole("button",{name:"Shop",exact:true}).click();
 await shell.getByRole("listbox",{name:"Merchant stock"}).getByRole("option",{name:new RegExp(stockName)}).waitFor({state:"visible",timeout:50000});
 assert.ok((await shell.getByRole("listbox",{name:"Merchant stock"}).innerText()).includes("Qty 7"));
 assert.equal(sql("SELECT qty::text FROM public.character_stock WHERE id="+q(stockId)),"7");
 console.log("PASS T38-P2-R5-CONVERTED-SHOP: original Profile->Shop renders exact live-RLS-backed stock and quantity");
 await shell.locator(".npc-panel-header").getByRole("button",{name:"Profile",exact:true}).click();
 await shell.locator(".npc-profile-description-card").waitFor({state:"visible",timeout:35000});
 await shell.locator(".npc-panel-header").getByRole("button",{name:"Shop",exact:true}).click();
 await shell.getByRole("listbox",{name:"Merchant stock"}).getByRole("option",{name:new RegExp(stockName)}).waitFor({state:"visible",timeout:30000});
 console.log("PASS T38-P2-R5-PROFILE-SHOP-PROFILE: original same-panel navigation retains selected merchant and correct stock");
 // Buy one unit through the original storefront UI, not via direct SQL.
 await shell.getByRole("button",{name:/^Buy for 13 gp/}).waitFor({state:"visible",timeout:25000});
 await shell.getByRole("button",{name:/^Buy for 13 gp/}).click();
 for(let i=0;i<65;i++){
  if(sql("SELECT qty::text FROM public.character_stock WHERE id="+q(stockId))==="6")break;
  await new Promise(resolve=>setTimeout(resolve,350));
 }
 assert.equal(sql("SELECT qty::text FROM public.character_stock WHERE id="+q(stockId)),"6");
 assert.equal(sql("SELECT gp::text FROM public.player_wallets WHERE user_id="+q(gm.id)),"87");
 assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE user_id="+q(gm.id)+" AND item_id='t38_r5_lantern'"),"1");
 assert.ok(calls.some(c=>c.path.endsWith("/buy_from_merchant")&&c.body.p_merchant_id===npc&&c.body.p_stock_uuid===stockId));
 console.log("PASS T38-P2-R5-ORIGINAL-PURCHASE: real Shop button debits signed wallet, decrements exact stock, delivers buyer item");
 await inventoryChecks();
 assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE id="+q(personalItem)),"1");
 await closeProfile();
 await page.goto(route+"?focus=merchant:"+npc,{waitUntil:"domcontentloaded",timeout:90000});
 await page.getByTestId("t25-selected-character").waitFor({timeout:60000});
 await chooseKind("npc");
 assert.equal(sql("SELECT count(*) FROM public.character_stock WHERE character_id="+q(npc)),"0");
 assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE id="+q(personalItem)),"1");
 assert.equal(sql("SELECT count(*) FROM public.inventory_items WHERE user_id="+q(gm.id)+" AND item_id='t38_r5_lantern'"),"1");
 assert.equal(sql("SELECT gp::text FROM public.player_wallets WHERE user_id="+q(gm.id)),"87");
 assert.equal(canonical(npc),original);
 await page.goto(route+"?focus=npc:"+npc,{waitUntil:"domcontentloaded",timeout:90000});
 await page.getByTestId("t25-selected-character").waitFor({timeout:60000});
 await openProfile();
 assert.equal(await shell.locator(".npc-panel-header").getByRole("button",{name:"Shop",exact:true}).count(),0);
 await inventoryChecks();
 await closeProfile();
 console.log("PASS T38-P2-R5-REVERT-TO-NPC: no storefront or stock after real conversion, immutable two inventories/wallet/Sheet");
 // Actor isolation: ordinary player may browse public shop stock but cannot
 // convert an NPC or read manager-private sheet/dossier with a live JWT.
 const denied=await outsider.who.rpc("set_character_kind",{p_character_id:npc,p_target:"merchant"});
 assert.equal(denied.error?.code,"42501");
 const secretDenied=await outsider.who.rpc("get_npc_dossier_admin_v1",{p_character_id:npc});
 assert.equal(secretDenied.error?.code,"42501");
 assert.equal(sql("SELECT kind FROM public.characters WHERE id="+q(npc)),"npc");
 assert.deepEqual(offsite,[]);assert.deepEqual(errors,[]);assert.deepEqual(dialogs,[]);
 console.log("PASS T38-P2-R5-ROLE-ISOLATION: outside actor cannot change kind/read GM dossier, no offsite traffic");
}finally{
 if(browser)await browser.close().catch(()=>{});
 if(server?.pid){try{process.kill(-server.pid,"SIGTERM")}catch{server.kill("SIGTERM")}}
 if(server)for(let i=0;i<55;i++){if(server.exitCode!==null)break;await new Promise(resolve=>setTimeout(resolve,160))}
 reconcileT36Route({...env,NEXT_PUBLIC_C34_T36_NPCS_RESEARCH:"0"},{cleanup:true});
 assert.ok(!fs.existsSync(derivedPath));
 await new Promise(resolve=>setTimeout(resolve,1100));
 assert.ok(!fs.existsSync(derivedPath),"R5 Next watcher regenerated temporary /npcs route");
 console.log("PASS T38-P2-R5-CLEANUP: source-derived page removed and original /npcs/world map untouched");
}
