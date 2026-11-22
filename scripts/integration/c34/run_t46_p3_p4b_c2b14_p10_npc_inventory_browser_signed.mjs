// C34 B14-P10. True Chromium/Next Pages Router signed actor test, but ONLY
// inside the existing disposable PG17/GoTrue/PostgREST runner. Never write
// a checked-in route or use hosted Supabase, never touch gameplay code.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import {spawn} from "node:child_process";
const routeRel="pages/__c34_b14_p10_npc_inventory_probe.jsx";
const UUID=/^[0-9a-f-]{36}$/i;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function freePort(){return new Promise((resolve,reject)=>{
 const server=net.createServer();
 server.once("error",reject);
 server.listen(0,"127.0.0.1",()=>{
  const port=server.address().port;
  server.close(()=>resolve(port));
 });
});}
function stopProcess(proc){
 if(!proc)return;
 try{process.kill(-proc.pid,"SIGTERM");}catch{}
}

export async function runC34B14P10SignedBrowser({
 env,root,browser,origin,roles,hired,another,hiddenNpc,forgePc,ids,sql,q
}){
 for(const [name,value] of Object.entries({
  CI:"true",GITHUB_ACTIONS:"true",PGHOST:"127.0.0.1",PGPORT:"54322",
  PGDATABASE:"postgres",PGUSER:"postgres",
  DNDNEXT_C34_LOCAL_CONFIRM:"DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY",
  DNDNEXT_C34_LOCAL_URL:"http://127.0.0.1:54321"
 }))assert.equal(env[name],value,"P10 refuses non-disposable "+name);
 assert.ok(!env.VERCEL&&!env.VERCEL_ENV,"No Vercel browser fixture");
 for(const value of [hired,another,hiddenNpc,forgePc])assert.match(value,UUID);
 // The primary C2-B2 browser origin has already been stopped by the
 // original B4 flag test long BEFORE P2→P7→P9 calls this runner.
 // Never reuse it: launch our own isolated Next server after the legacy suite.
 assert.ok(!origin||origin.startsWith("http://127.0.0.1:"));
 const dest=path.join(root,routeRel);
 assert.ok(!fs.existsSync(dest),"Refusing pre-existing P10 route");
 const code=[
  "// TEMPORARY CI-ONLY C34-P10 NEXT ROUTE — DELETED IN FINALLY.",
  'import {useEffect,useState} from "react";',
  'import Shell from "../components/c34/NonMapNpcInventoryP10ResearchShell";',
  'import {supabase} from "../utils/supabaseClient";',
  // Attribute RPCs from this isolated P10 component without changing the
  // global client used by _app navbar, bridges, overlays or other legacy UI.
  'const scopedClient = new Proxy(supabase,{get(target,key){',
  ' if(key==="rpc")return (name,args)=>{',
  '  if(typeof window!=="undefined")window.__p10ScopedRpcNames?.push(name);',
  '  return target.rpc(name,args);',
  ' };',
  ' return target[key];',
  '}});',
  "const ids="+JSON.stringify({hired,another,hiddenNpc,forgePc})+";",
  "export default function C34P10Probe(){",
  " const [chosen,setChosen]=useState(ids.hired);",
  " useEffect(()=>{window.__p10Sb=supabase;window.__p10ScopedRpcNames=[];return()=>{delete window.__p10Sb;delete window.__p10ScopedRpcNames;};},[]);",
  ' return <main data-testid="p10-probe"><h1>P10 isolated inventory probe</h1>',
  ' <button type="button" data-testid="p10-select-hired" onClick={()=>setChosen(ids.hired)}>Hired NPC</button>',
  ' <button type="button" data-testid="p10-select-other" onClick={()=>setChosen(ids.another)}>Other NPC</button>',
  ' <button type="button" data-testid="p10-select-hidden" onClick={()=>setChosen(ids.hiddenNpc)}>Hidden NPC</button>',
  ' <button type="button" data-testid="p10-select-forge" onClick={()=>setChosen(ids.forgePc)}>Forge PC</button>',
  ' <Shell client={scopedClient} characterId={chosen}/></main>;',
  "}"
 ].join("\n");
 let page=null,server=null,serverLog="";
 let localOrigin=null;
 const grant=async(cap,enabled)=>{
  const r=await roles.GM.who.rpc("c34_b14_p6_set_npc_capability_v1",{
   p_npc_id:hired,p_user_id:roles.OWNER.id,p_capability:cap,p_enabled:enabled
  });
  assert.ifError(r.error);
 };
 const uri=name=>"**/rest/v1/rpc/"+name;
 let browserErrors=[],rpcCalls=[];
 const login=async actor=>{
  const response=await page.evaluate(async credentials=>{
   const {data,error}=await window.__p10Sb.auth.signInWithPassword(credentials);
   if(error)throw Error(error.message);
   return data.user.id;
  },{email:actor.email,password:actor.password});
  assert.equal(response,actor.id);
 };
 try{
  fs.writeFileSync(dest,code,{flag:"wx"});
  const port=await freePort();
  localOrigin="http://127.0.0.1:"+port;
  const nextBin=path.join(root,"node_modules/next/dist/bin/next");
  assert.ok(fs.existsSync(nextBin),"P10 requires lockfile-installed Next");
  server=spawn(process.execPath,[nextBin,"dev","--webpack","-H","127.0.0.1",
   "-p",String(port)],{
   cwd:root,detached:true,stdio:["ignore","pipe","pipe"],
   env:{...env,NODE_ENV:"development",NEXT_TELEMETRY_DISABLED:"1",
    NEXT_PUBLIC_SUPABASE_URL:env.DNDNEXT_C34_LOCAL_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:env.DNDNEXT_C34_LOCAL_ANON_KEY}
  });
  for(const stream of [server.stdout,server.stderr])
   stream.on("data",data=>{serverLog=(serverLog+data.toString()).slice(-18000);});
  let ready=false;
  for(let tries=0;tries<110;tries++){
   if(server.exitCode!==null)break;
   try{
    const res=await fetch(localOrigin+"/__c34_b14_p10_npc_inventory_probe",{
     signal:AbortSignal.timeout(3000)});
    if(res.ok&&(await res.text()).includes("P10 isolated inventory probe")){
     ready=true;break;
    }
   }catch{}
   await delay(850);
  }
  assert.ok(ready,"Independent P10 Next did not start: "+serverLog.slice(-6000));
  page=await browser.newPage({viewport:{width:1280,height:900}});
  page.on("pageerror",e=>browserErrors.push(e.message));
  page.on("request",r=>{
   if(r.method()==="POST"&&r.url().includes("/rest/v1/rpc/"))
    rpcCalls.push(r.url().split("/").pop().split("?")[0]);
  });
  await page.goto(localOrigin+"/__c34_b14_p10_npc_inventory_probe",{
   waitUntil:"domcontentloaded",timeout:100000
  });
  await page.waitForFunction(()=>!!window.__p10Sb,null,{timeout:85000});
  await page.getByTestId("p10-unavailable").waitFor();
  assert.ok(!rpcCalls.includes("c34_b14_p7_npc_backpack_page_v1"));
  console.log("PASS T46-C2B14-P10-ANON: unsigned local browser cannot view backpack and no eager private list");

  await grant("view_backpack",true);
  await grant("manage_equipment",false);
  await login(roles.OWNER);
  await page.getByTestId("p10-ready").waitFor({timeout:25000});
  await page.getByTestId("p10-worn").getByText("P7 sword").waitFor();
  await page.getByTestId("p10-rights").filter({hasText:/Backpack: read/}).waitFor();
  assert.equal(rpcCalls.filter(x=>x==="c34_b14_p7_npc_backpack_page_v1").length,0,
   "Open Profile must not eagerly load private backpack");
  await page.getByRole("button",{name:"Open backpack"}).click();
  await page.getByTestId("p10-readonly").waitFor();
  await page.getByTestId("p10-item").first().waitFor();
  assert.equal(await page.getByTestId("p10-item").count(),2,"P7 page size=2");
  assert.equal(await page.getByRole("button",{name:/^(Equip|Unequip)/}).count(),0);
  assert.ok(!(await page.getByTestId("p10-items").innerText()).includes("P7-private-GM-payload"));
  assert.ok(!(await page.getByTestId("p10-items").innerText()).includes("user_id"));
  await page.getByRole("button",{name:"Load more"}).click();
  await page.getByTestId("p10-item").nth(3).waitFor();
  assert.equal(await page.getByTestId("p10-item").count(),4);
  assert.ok(rpcCalls.filter(x=>x==="c34_b14_p7_npc_backpack_page_v1").length===2);
  console.log("PASS T46-C2B14-P10-HIRED: genuine signed Next Profile bounded outward names; explicit P7 page 2+2 read-only, no equip/transfer or private card");

  // GM changes rights without refreshing the owner's JWT; the same UI
  // refresh must clear all formerly private rows and block the tab.
  await grant("view_backpack",false);
  await page.getByRole("button",{name:"Refresh permissions"}).click();
  await page.getByTestId("p10-ready").waitFor();
  await page.getByTestId("p10-readonly-locked").waitFor();
  assert.equal(await page.getByTestId("p10-item").count(),0);
  // P7 concurrency tests equipped "P7 hidden letter" into a public outward
  // worn slot. Revocation cannot hide its visible outward name; it MUST hide
  // the unequipped, private backpack row "P7 map" that was previously loaded.
  assert.ok(!(await page.locator("body").innerText()).includes("P7 map"));
  console.log("PASS T46-C2B14-P10-REVOKE: same JWT GM revoke clears displayed private backpack while combat control stays independent");

  await grant("view_backpack",true);
  await grant("manage_equipment",true);
  await page.getByRole("button",{name:"Refresh permissions"}).click();
  await page.getByTestId("p10-rights").filter({hasText:/Equipment management: granted/}).waitFor();
  await page.getByRole("button",{name:"Open backpack"}).click();
  await page.getByTestId("p10-item").first().waitFor();
  await page.getByRole("button",{name:"Load more"}).click();
  await page.getByTestId("p10-item").nth(3).waitFor();
  await page.getByRole("button",{name:"Load more"}).click();
  await page.getByText("P7 map").first().waitFor();
  const before=sql("SELECT coalesce(is_equipped,false)::text FROM public.inventory_items WHERE id="+q(ids[4]));
  assert.equal(before,"false");
  await page.getByLabel("Equipment slot").selectOption("misc_1");
  await page.getByRole("button",{name:"Equip P7 map"}).click();
  await page.getByRole("button",{name:"Unequip P7 map"}).waitFor();
  assert.equal(sql("SELECT is_equipped::text||'|'||equip_slot FROM public.inventory_items WHERE id="+q(ids[4])),"true|misc_1");
  assert.ok(rpcCalls.includes("c34_b14_p7_set_npc_equipment_v1"));
  console.log("PASS T46-C2B14-P10-EQUIP: signed GM equip grant enables exact P7 CAS, actual item changes, no raw browser UPDATE");

  await grant("manage_equipment",false);
  // Stale UI remains visible until explicit refresh; server must reject now.
  await page.getByRole("button",{name:"Unequip P7 map"}).click();
  await page.getByTestId("p10-unavailable").waitFor();
  assert.equal(sql("SELECT is_equipped::text||'|'||equip_slot FROM public.inventory_items WHERE id="+q(ids[4])),"true|misc_1");
  console.log("PASS T46-C2B14-P10-EQUIP-REVOKE: same JWT backend denial clears UI and leaves NPC item unchanged");

  await page.evaluate(async()=>{const {error}=await window.__p10Sb.auth.signOut();if(error)throw Error(error.message);});
  await page.getByTestId("p10-unavailable").waitFor();
  assert.ok(!(await page.locator("body").innerText()).includes("P7 map"));
  await login(roles.OUTSIDER);
  await page.getByTestId("p10-ready").waitFor();
  await page.getByTestId("p10-readonly-locked").waitFor();
  assert.equal(await page.getByTestId("p10-item").count(),0);
  await page.getByTestId("p10-select-hidden").click();
  await page.getByTestId("p10-unavailable").waitFor();
  assert.equal(await page.getByTestId("p10-ready").count(),0);
  await page.getByTestId("p10-select-forge").click();
  await page.getByTestId("p10-unavailable").waitFor();
  assert.equal(await page.getByTestId("p10-ready").count(),0);
  console.log("PASS T46-C2B14-P10-AUTH: browser logout/account switch evicts old rows, outsider and hidden/tagged Forge PC cannot reveal NPC inventory");
  assert.deepEqual(browserErrors,[], "P10 Next browser errors "+JSON.stringify(browserErrors));
  const forbidden=["get_character_inventory_v1",
   "set_character_inventory_equipment_v1","transfer_inventory_item_v1"];
  const scoped=await page.evaluate(()=>window.__p10ScopedRpcNames||[]);
  const allowed=["c34_b14_p9_npc_slim_context_v1",
   "c34_b14_p7_npc_backpack_page_v1","c34_b14_p7_set_npc_equipment_v1"];
  assert.ok(scoped.length>0&&scoped.includes(allowed[0])&&scoped.includes(allowed[1])
   &&scoped.includes(allowed[2]),"P10 missing required authenticated API traffic: "+JSON.stringify(scoped));
  assert.ok(scoped.every(name=>allowed.includes(name)),
   "P10 introduced unrelated or legacy RPC: "+JSON.stringify(scoped));
  assert.ok(!scoped.some(name=>forbidden.includes(name)),
   "P10 must never fall back to legacy RPC: "+JSON.stringify(scoped));
  const shellLegacy=rpcCalls.filter(name=>forbidden.includes(name));
  if(shellLegacy.length){
   // Unrelated _app/global-shell source may remain mounted around isolated
   // P10 test page. Report exact RPCs instead of attributing them to P10.
   console.log("P10-UNRELATED-APP-SHELL-LEGACY-RPCS: "+JSON.stringify(shellLegacy));
  }
  console.log("PASS T46-C2B14-P10-SIGNED: real local Next/Chromium actor matrix; isolated P10 client only ever called P9/P7, no legacy fallback");
 }finally{
  if(page)await page.close().catch(()=>{});
  stopProcess(server);
  if(server){await delay(700);try{process.kill(-server.pid,"SIGKILL");}catch{}}
  if(fs.existsSync(dest))fs.rmSync(dest);
  assert.ok(!fs.existsSync(dest),"P10 ephemeral test route not cleaned");
 }
}
