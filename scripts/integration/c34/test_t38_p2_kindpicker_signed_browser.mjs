#!/usr/bin/env node
// T38-P2-R3: real source-original KindPicker /npcs via signed disposable Next PG17.
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
 C34_T38_P2_BROWSER_CONFIRM:"ORIGINAL_KINDPICKER_DISPOSABLE_ONLY"
}))assert.equal(env[k],v,"T38-R3 unsafe environment "+k);
assert.equal(env.DNDNEXT_C34_LOCAL_URL,"http://127.0.0.1:54321");
assert.ok(env.DNDNEXT_C34_LOCAL_ANON_KEY);
assert.ok(env.C33_BROWSER_TOOL_ROOT&&path.isAbsolute(env.C33_BROWSER_TOOL_ROOT));
assert.ok(env.C33_BROWSER_CHROME&&path.isAbsolute(env.C33_BROWSER_CHROME));
assert.notEqual(env.VERCEL,"1");
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const derivedPath=path.join(root,T36_LOCAL_ROUTE);
assert.ok(!fs.existsSync(derivedPath),"T38-R3 refuses stale generated NPC manager");
const require=createRequire(path.join(env.C33_BROWSER_TOOL_ROOT,"t38-playwright-anchor.cjs"));
const {chromium}=require("playwright-core");
const client=()=>createClient(env.DNDNEXT_C34_LOCAL_URL,env.DNDNEXT_C34_LOCAL_ANON_KEY,
 {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const q=x=>{assert.match(x,/^[a-f0-9-]{36}$/i);return "'"+x+"'";};
function sql(s){
 const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",s],
  {cwd:root,env,encoding:"utf8",timeout:25000});
 assert.equal(r.status,0,"T38-R3 local SQL "+r.stderr?.slice(-1100));
 return r.stdout.trim();
}
const canonical=id=>sql("SELECT md5(sheet::text) FROM public.character_sheets WHERE character_id="+q(id))+"|"+
 sql("SELECT coalesce(secret,'') FROM public.characters WHERE id="+q(id))+"|"+
 sql("SELECT creation_request_id::text FROM public.characters WHERE id="+q(id));
async function actor(label,role){
 const who=client(),email="t38-r3-"+label+"-"+randomUUID()+"@example.invalid",password="T38r3-"+randomUUID()+"!";
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
  description:"T38 R3 VALID CHARACTER",background:"T38 R3 PUBLIC",
  secret:"T38 R3 PRIVATE",sheet:{classKey:"fighter",level:1,marker:"T38-R3-FORGE"}
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
 "04588d4b433b13c92e612039a7c7e56e","T38-R3 must follow original RED plus scratch GREEN");
const users={
 GM:await actor("gm","gm"),
 EDITOR:await actor("editor","player"),
 UNKNOWN:await actor("unknown","unknown")
};
sql("INSERT INTO private.test_admins(id) VALUES("+q(users.GM.id)+") ON CONFLICT DO NOTHING");
const npc=await create(users.GM,"T38 R3 Original UI NPC","npc");
const editorMerchant=await create(users.GM,"T38 R3 Editor Merchant","merchant");
sql("INSERT INTO public.character_permissions(character_id,user_id,can_edit,can_inventory,can_convert) VALUES("+
 q(editorMerchant)+","+q(users.EDITOR.id)+",true,false,false)");
const original=canonical(npc),editorOriginal=canonical(editorMerchant);
let server=null,browser=null,serverLog="";
try {
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
  stream.on("data",chunk=>serverLog=(serverLog+chunk.toString()).slice(-16000));
 const route=origin+"/npcs";let ready=false;
 for(let i=0;i<110;i++){
  if(server.exitCode!==null)throw Error("T38-R3 Next exited "+serverLog);
  try{
   const response=await fetch(route,{signal:AbortSignal.timeout(2500)});
   if(response.ok&&(await response.text()).includes(T36_MARKER)){ready=true;break}
  }catch{}
  await new Promise(resolve=>setTimeout(resolve,1100));
 }
 assert.ok(ready,"Original source-derived /npcs failed to compile "+serverLog);
 browser=await chromium.launch({executablePath:env.C33_BROWSER_CHROME,
  headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
 const context=await browser.newContext({viewport:{width:1480,height:900}});
 const page=await context.newPage(),offsite=[],errors=[],dialogs=[],calls=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("dialog",async d=>{dialogs.push(d.message());await d.dismiss()});
 page.on("request",req=>{
  if(req.url().includes("/rpc/set_character_kind")){
   try{calls.push(JSON.parse(req.postData()||"{}"))}catch{calls.push({unparsed:true})}
  }
 });
 await page.route("**/*",r=>{
  const url=r.request().url();
  if(url.startsWith(origin)||url.startsWith(env.DNDNEXT_C34_LOCAL_URL)||
   url.startsWith("ws://127.0.0.1:"+port))return r.continue();
  if(/supabase\.co|supabase\.in|service_role/i.test(url))offsite.push(url.slice(0,150));
  return r.abort();
 });
 async function login(label,id,type){
  await page.goto(route+"?focus="+type+":"+id,{waitUntil:"domcontentloaded",timeout:90000});
  await page.waitForFunction(()=>!!window.__sb?.auth,null,{timeout:30000});
  const uid=await page.evaluate(async({email,password})=>{
   const {data,error}=await window.__sb.auth.signInWithPassword({email,password});
   if(error)throw Error(error.message);
   return data.user.id;
  },{email:users[label].email,password:users[label].password});
  assert.equal(uid,users[label].id);
  await page.reload({waitUntil:"domcontentloaded",timeout:90000});
  await page.getByTestId("t25-selected-character").waitFor({timeout:60000});
  assert.equal(await page.getByTestId("t25-selected-character").getAttribute("data-character-id"),id);
 }
 async function logout(){await page.evaluate(async()=>{
  const {error}=await window.__sb.auth.signOut();if(error)throw Error(error.message);
 })}
 async function waitKind(id,expected){
  for(let i=0;i<50;i++){
   if(sql("SELECT kind FROM public.characters WHERE id="+q(id))===expected)return;
   await new Promise(resolve=>setTimeout(resolve,350));
  }
  throw Error("T38-R3 UI did not persist kind "+expected);
 }
 async function chooseKind(target){
  const picker=page.getByRole("button",{name:/^Kind: (NPC|Merchant)/});
  if(await picker.count()===0)
   await page.getByRole("button",{name:"Edit",exact:true}).first().click();
  await picker.waitFor({state:"visible",timeout:30000});
  await picker.click();
  await page.getByRole("menuitem",{name:new RegExp("^"+(target==="merchant"?"Merchant":"NPC"))}).click();
 }
 await login("GM",npc,"npc");
 await page.getByRole("button",{name:"Print Sheet"}).waitFor({timeout:30000});
 await page.getByRole("button",{name:"Edit",exact:true}).first().click();
 await page.getByRole("button",{name:/^Kind: NPC/}).waitFor({state:"visible",timeout:30000});
 await chooseKind("merchant");await waitKind(npc,"merchant");
 assert.equal(calls.length,1,"Original KindPicker must invoke exactly one signed RPC");
 assert.equal(calls[0].p_character_id,npc);assert.equal(calls[0].p_target,"merchant");
 assert.equal(canonical(npc),original);
 assert.equal(sql("SELECT storefront_enabled::text FROM public.characters WHERE id="+q(npc)),"true");
 console.log("PASS T38-P2-R3-REAL-KINDPICKER-TO-MERCHANT: original source UI, signed RPC, same UUID, Sheet/Secret/nonce");
 sql("INSERT INTO public.character_stock(id,character_id,qty,display_name,card_payload,price_gp,item_id) VALUES("+
  q(randomUUID())+","+q(npc)+",8,'T38 R3 SHOP','{}'::jsonb,10,'t38_r3_item')");
 await page.goto(route+"?focus=merchant:"+npc,{waitUntil:"domcontentloaded",timeout:90000});
 await page.getByTestId("t25-selected-character").waitFor({timeout:60000});
 await page.getByRole("button",{name:"Print Sheet"}).waitFor({timeout:30000});
 await chooseKind("npc");await waitKind(npc,"npc");
 assert.equal(calls.length,2);assert.equal(calls[1].p_target,"npc");
 assert.equal(sql("SELECT count(*) FROM public.character_stock WHERE character_id="+q(npc)),"0");
 assert.equal(canonical(npc),original);
 console.log("PASS T38-P2-R3-REAL-KINDPICKER-TO-NPC: original source UI stock cleanup, preserved canonical data");
 await logout();await login("EDITOR",editorMerchant,"merchant");
 await page.getByRole("button",{name:"Edit",exact:true}).first().waitFor({timeout:30000});
 await page.getByRole("button",{name:"Edit",exact:true}).first().click();
 assert.equal(await page.getByRole("button",{name:/^Kind: (NPC|Merchant)/}).count(),0);
 assert.equal(sql("SELECT kind FROM public.characters WHERE id="+q(editorMerchant)),"merchant");
 assert.equal(canonical(editorMerchant),editorOriginal);
 console.log("PASS T38-P2-R3-EDITOR-KIND-HIDDEN: delegated can_edit alone never exposes original conversion picker");
 await logout();await login("UNKNOWN",editorMerchant,"merchant");
 assert.equal(await page.getByRole("button",{name:/^Kind: (NPC|Merchant)/}).count(),0);
 assert.equal(sql("SELECT kind FROM public.characters WHERE id="+q(editorMerchant)),"merchant");
 assert.deepEqual(offsite,[]);assert.deepEqual(errors,[]);assert.deepEqual(dialogs,[]);
 console.log("PASS T38-P2-R3-REAL-SIGNED-BROWSER: original Next /npcs manager, no hosted traffic or UI exceptions");
}finally {
 if(browser)await browser.close().catch(()=>{});
 if(server?.pid){try{process.kill(-server.pid,"SIGTERM")}catch{server.kill("SIGTERM")}}
 if(server)for(let i=0;i<50;i++){if(server.exitCode!==null)break;await new Promise(r=>setTimeout(r,150))}
 reconcileT36Route({...env,NEXT_PUBLIC_C34_T36_NPCS_RESEARCH:"0"},{cleanup:true});
 assert.ok(!fs.existsSync(derivedPath),"T38-R3 generated research route remained after cleanup");
 await new Promise(resolve=>setTimeout(resolve,1100));
 assert.ok(!fs.existsSync(derivedPath),"T38-R3 Next watcher regenerated temporary NPC route");
 console.log("PASS T38-P2-R3-CLEANUP: temporary research page removed; main original and world map unchanged");
}
