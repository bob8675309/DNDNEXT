#!/usr/bin/env node
// C34 T38-P2-R4 signed real convert-only UI GREEN: source-original one KindPicker
// relocated to PUBLIC Profile, never to restricted Sheet or production.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import {randomUUID} from "node:crypto";
import {spawn,spawnSync} from "node:child_process";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
import {createClient} from "@supabase/supabase-js";
import {T38_R4_LOCAL_ROUTE,T38_R4_MARKER,T38_R4_CONFIRM,
 makeT38R4ConvertOnlySource,reconcileT38R4Route} from "./prepare_t38_convert_only_npcs_route.mjs";
const env=process.env;
for(const [key,expected] of Object.entries({
 CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
 PGUSER:"postgres",PGDATABASE:"postgres",
 DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
 DNDNEXT_C34_LOCAL_URL:"http://127.0.0.1:54321",
 C34_T38_R4_BROWSER_CONFIRM:T38_R4_CONFIRM,
 NEXT_PUBLIC_C34_T36_NPCS_RESEARCH:"0"
}))assert.equal(env[key],expected,"T38-R4 refuses unsafe signed environment "+key);
assert.notEqual(env.VERCEL,"1");assert.ok(env.DNDNEXT_C34_LOCAL_ANON_KEY);
assert.ok(env.C33_BROWSER_TOOL_ROOT&&path.isAbsolute(env.C33_BROWSER_TOOL_ROOT));
assert.ok(env.C33_BROWSER_CHROME&&path.isAbsolute(env.C33_BROWSER_CHROME));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const generated=path.join(root,T38_R4_LOCAL_ROUTE);
assert.ok(!fs.existsSync(generated),"R4 refuses overwriting a pre-existing generated page");
assert.ok(!fs.existsSync(path.join(root,"pages/__c34_t36_npcs.jsx")),
 "Original R3 source route was not cleaned");
const require=createRequire(path.join(env.C33_BROWSER_TOOL_ROOT,"t38-r4-playwright.cjs"));
const {chromium}=require("playwright-core");
const client=()=>createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,
 {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const q=id=>{assert.match(id,/^[a-f0-9-]{36}$/i);return "'"+id+"'";};
function sql(query){
 const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",query],
  {env,cwd:root,encoding:"utf8",timeout:25000});
 assert.equal(r.status,0,"R4 local-only SQL "+r.stderr?.slice(-900));
 return r.stdout.trim();
}
async function actor(label,role){
 const who=client(),email="t38-r4-"+label+"-"+randomUUID()+"@example.invalid";
 const password="T38r4-"+randomUUID()+"!";
 assert.ifError((await who.auth.signUp({email,password})).error);
 assert.ifError((await who.auth.signInWithPassword({email,password})).error);
 const result=await who.auth.getUser();assert.ifError(result.error);
 const id=result.data.user.id;
 assert.match(role,/^(gm|player|unknown)$/);
 sql("INSERT INTO public.user_profiles(id,role) VALUES("+q(id)+",'"+role+"') ON CONFLICT(id) DO UPDATE SET role=excluded.role");
 return {who,id,email,password};
}
async function create(gm,name,secret){
 const r=await gm.who.rpc("create_character_v1",{p_payload:{
  name,kind:"npc",creation_request_id:randomUUID(),
  description:"T38 R4 public profile",background:"T38 R4 public narrative",
  secret,sheet:{classKey:"fighter",level:1,marker:"T38_R4_ORIGINAL_SHEET"}
 }});
 assert.ifError(r.error);assert.match(r.data,/^[a-f0-9-]{36}$/i);
 sql("UPDATE public.characters SET is_hidden=false WHERE id="+q(r.data));
 return r.data;
}
async function freePort(){return new Promise((resolve,reject)=>{
 const s=net.createServer();s.once("error",reject);
 s.listen(0,"127.0.0.1",()=>{const port=s.address().port;s.close(()=>resolve(port))});
})}
const kind=id=>sql("SELECT kind FROM public.characters WHERE id="+q(id));
const stockCount=id=>sql("SELECT count(*) FROM public.character_stock WHERE character_id="+q(id));
const canonical=id=>sql("SELECT md5(sheet::text) FROM public.character_sheets WHERE character_id="+q(id))+"|"+
 sql("SELECT coalesce(secret,'') FROM public.characters WHERE id="+q(id))+"|"+
 sql("SELECT creation_request_id::text FROM public.characters WHERE id="+q(id));
assert.equal(sql("SELECT has_column_privilege('authenticated','public.characters','kind','UPDATE')"),"f");
assert.equal(sql("SELECT has_column_privilege('authenticated','public.characters','storefront_enabled','UPDATE')"),"t");
assert.notEqual(sql("SELECT md5(pg_get_functiondef('public.set_character_kind(uuid,text)'::regprocedure))"),
 "04588d4b433b13c92e612039a7c7e56e","R4 requires R2 strict conversion candidate");
const users={
 GM:await actor("gm","gm"),CONVERTER:await actor("converter","player"),
 EDITOR:await actor("editor","player"),UNKNOWN:await actor("unknown","unknown")
};
sql("INSERT INTO private.test_admins(id) VALUES("+q(users.GM.id)+") ON CONFLICT DO NOTHING");
const secret="T38 R4 GM PRIVATE SECRET";
const subject=await create(users.GM,"T38 R4 Convert-Only Original NPC",secret);
const initial=canonical(subject);
sql("INSERT INTO public.character_permissions(character_id,user_id,can_edit,can_inventory,can_convert) VALUES("+
 q(subject)+","+q(users.CONVERTER.id)+",false,false,true),("+
 q(subject)+","+q(users.EDITOR.id)+",true,false,false)");
const denyDossier=await users.CONVERTER.who.rpc("get_npc_dossier_admin_v1",{p_character_id:subject});
assert.equal(denyDossier.error?.code,"42501");
const unauthorizedSheet=await users.CONVERTER.who.from("character_sheets")
 .update({sheet:{marker:"FORGED"}}).eq("character_id",subject)
 .select("character_id");
// PostgREST may return zero updated rows without an error when RLS denies.
// That is a denial, provided the canonical Sheet/secret/nonce stays unchanged.
assert.ok(unauthorizedSheet.error || (unauthorizedSheet.data||[]).length===0,
 "Convert-only actor unexpectedly modified a canonical Sheet row");
assert.equal(canonical(subject),initial,
 "A denied RLS zero-row UPDATE must preserve original Sheet, secret and creation nonce");
console.log("PASS T38-P2-R4-PRE-RUNTIME: exact convert-only delegated actor cannot edit Sheet or GM dossier");
let server=null,browser=null,serverLog="";
try{
 assert.ok(makeT38R4ConvertOnlySource().includes(T38_R4_MARKER));
 assert.ok(reconcileT38R4Route(env,{prepare:true}));
 const bin=path.join(root,"node_modules/next/dist/bin/next");
 assert.ok(fs.existsSync(bin),"R4 requires lockfile-pinned current Next");
 const port=await freePort(),origin="http://127.0.0.1:"+port;
 server=spawn(process.execPath,[bin,"dev","--webpack","-H","127.0.0.1","-p",String(port)],{
  cwd:root,detached:true,stdio:["ignore","pipe","pipe"],
  env:{...env,NEXT_PUBLIC_C34_T36_NPCS_RESEARCH:"0",
   NEXT_PUBLIC_SUPABASE_URL:env.DNDNEXT_C34_LOCAL_URL,
   NEXT_PUBLIC_SUPABASE_ANON_KEY:env.DNDNEXT_C34_LOCAL_ANON_KEY,
   NODE_ENV:"development",NEXT_TELEMETRY_DISABLED:"1"}
 });
 for(const stream of [server.stdout,server.stderr])
  stream.on("data",chunk=>serverLog=(serverLog+chunk.toString()).slice(-14000));
 const route=origin+"/"+path.basename(T38_R4_LOCAL_ROUTE,".jsx");let ready=false;
 for(let i=0;i<110;i++){
  if(server.exitCode!==null)throw Error("R4 local Next server exited "+serverLog);
  try{
   const response=await fetch(route,{signal:AbortSignal.timeout(3000)});
   if(response.ok&&(await response.text()).includes('data-c34-t36="source-derived-stage2"')){ready=true;break}
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 assert.ok(ready,"R4 strict local source-derived candidate route failed to compile "+serverLog);
 const production=await fetch(origin+"/npcs",{signal:AbortSignal.timeout(30000)});
 assert.ok(production.ok);
 assert.ok(!(await production.text()).includes('data-c34-t36="source-derived-stage2"'),
  "R4 source-only scratch unexpectedly rewrote original /npcs");
 console.log("PASS T38-P2-R4-ROUTE: real Next direct-only probe, untouched original /npcs, no rewrite");
 browser=await chromium.launch({executablePath:env.C33_BROWSER_CHROME,
  headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 const page=await context.newPage(),offsite=[],errors=[],dialogs=[],calls=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("dialog",async d=>{dialogs.push(d.message());await d.dismiss()});
 page.on("request",request=>{
  if(request.url().includes("/rpc/set_character_kind")){
   try{calls.push(JSON.parse(request.postData()||"{}"))}catch{calls.push({badPayload:true})}
  }
 });
 await page.route("**/*",request=>{
  const url=request.request().url();
  if(url.startsWith(origin)||url.startsWith(env.DNDNEXT_C34_LOCAL_URL)||
   url.startsWith("ws://127.0.0.1:"+port))return request.continue();
  if(/supabase\.co|supabase\.in|service_role/i.test(url))offsite.push(url.slice(0,160));
  return request.abort();
 });
 async function login(label,type){
  await page.goto(route+"?focus="+type+":"+subject,{waitUntil:"domcontentloaded",timeout:90000});
  await page.waitForFunction(()=>!!window.__sb?.auth,null,{timeout:30000});
  const who=users[label];
  const uid=await page.evaluate(async({email,password})=>{
   const result=await window.__sb.auth.signInWithPassword({email,password});
   if(result.error)throw Error(result.error.message);
   return result.data.user.id;
  },{email:who.email,password:who.password});
  assert.equal(uid,who.id);
  await page.reload({waitUntil:"domcontentloaded",timeout:90000});
  await page.getByTestId("t25-selected-character").waitFor({timeout:60000});
  assert.equal(await page.getByTestId("t25-selected-character").getAttribute("data-character-id"),subject);
 }
 const logout=async()=>page.evaluate(async()=>{
  const {error}=await window.__sb.auth.signOut();if(error)throw Error(error.message);
 });
 async function pick(target){
  const btn=page.getByTestId("t38-convert-only-control")
   .getByRole("button",{name:/^Kind:\s*(NPC|Merchant)/});
  await btn.waitFor({state:"visible",timeout:30000});
  await btn.click();
  await page.getByRole("menuitem",{name:new RegExp("^"+(target==="merchant"?"Merchant":"NPC"))}).click();
  for(let i=0;i<60;i++){
   if(kind(subject)===target)return;
   await new Promise(resolve=>setTimeout(resolve,300));
  }
  throw Error("R4 genuine UI conversion to "+target+" did not persist");
 }
 await login("CONVERTER","npc");
 const bounded=page.getByTestId("t38-convert-only-control");
 await bounded.waitFor({state:"visible",timeout:30000});
 assert.equal(await page.getByRole("button",{name:"Edit",exact:true}).count(),0);
 assert.equal(await page.getByRole("button",{name:"Print Sheet"}).count(),0);
 assert.equal(await page.locator(".npc-panel-scroll").getByText(secret,{exact:true}).count(),0);
 assert.equal(await page.getByRole("button",{name:"Map icon…"}).count(),0);
 console.log("PASS T38-P2-R4-CONVERT-ONLY-UI: source-original KindPicker available in public Profile, NO Edit/Sheet/secret controls");
 await pick("merchant");
 assert.equal(calls.length,1);assert.equal(calls[0].p_character_id,subject);
 assert.equal(calls[0].p_target,"merchant");
 assert.equal(canonical(subject),initial);
 assert.equal(sql("SELECT storefront_enabled::text FROM public.characters WHERE id="+q(subject)),"true");
 console.log("PASS T38-P2-R4-NPC-TO-MERCHANT: original handler, real signed actor and strict server RPC, canonical Sheet/Secret/nonce");
 sql("INSERT INTO public.character_stock(id,character_id,qty,display_name,card_payload,price_gp,item_id) VALUES("+
  q(randomUUID())+","+q(subject)+",3,'T38 R4 SHOP','{}'::jsonb,17,'t38_r4_item')");
 await page.goto(route+"?focus=merchant:"+subject,{waitUntil:"domcontentloaded",timeout:90000});
 await page.getByTestId("t25-selected-character").waitFor({timeout:60000});
 await bounded.waitFor({state:"visible",timeout:30000});
 await pick("npc");
 assert.equal(calls.length,2);assert.equal(calls[1].p_target,"npc");
 assert.equal(stockCount(subject),"0");
 assert.equal(canonical(subject),initial);
 console.log("PASS T38-P2-R4-MERCHANT-TO-NPC: source original handler cleans merchant stock only on actual transition");
 // Revoke in DB with the SAME JWT, not by changing client metadata. The server
 // rejects any subsequent RPC and original permission Refresh must remove UI.
 sql("UPDATE public.character_permissions SET can_convert=false WHERE character_id="+q(subject)+
  " AND user_id="+q(users.CONVERTER.id));
 const revoked=await users.CONVERTER.who.rpc("set_character_kind",{p_character_id:subject,p_target:"merchant"});
 assert.equal(revoked.error?.code,"42501");
 assert.equal(kind(subject),"npc");assert.equal(canonical(subject),initial);
 await page.getByTestId("t25-refresh-permissions").click();
 await page.goto(route+"?focus=npc:"+subject,{waitUntil:"domcontentloaded",timeout:90000});
 await page.getByTestId("t25-selected-character").waitFor({timeout:60000});
 assert.equal(await bounded.count(),0);
 console.log("PASS T38-P2-R4-SAME-JWT-REVOKE: original client permission refresh removes control; server denies without a new token");
 await logout();await login("EDITOR","npc");
 await page.getByRole("button",{name:"Edit",exact:true}).first().waitFor({timeout:30000});
 assert.equal(await bounded.count(),0);
 await logout();await login("UNKNOWN","npc");
 assert.equal(await bounded.count(),0);
 assert.deepEqual(offsite,[]);assert.deepEqual(errors,[]);assert.deepEqual(dialogs,[]);
 console.log("PASS T38-P2-R4-REAL-SIGNED-BROWSER: no private data leak or offsite host, only source-owned conversion handler");
}finally{
 if(browser)await browser.close().catch(()=>{});
 if(server?.pid){try{process.kill(-server.pid,"SIGTERM")}catch{server.kill("SIGTERM")}}
 if(server)for(let i=0;i<50;i++){
  if(server.exitCode!==null)break;
  await new Promise(resolve=>setTimeout(resolve,150));
 }
 reconcileT38R4Route(env,{cleanup:true});
 assert.equal(fs.existsSync(generated),false,"R4 local generated route remained");
 await new Promise(resolve=>setTimeout(resolve,1100));
 assert.equal(fs.existsSync(generated),false,"R4 Next watcher regenerated local candidate");
 console.log("PASS T38-P2-R4-CLEANUP: no generated test page, original /npcs and world map untouched");
}
