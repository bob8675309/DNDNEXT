#!/usr/bin/env node
// P1.3 Forge progression P vs sheet S inversion; disposable PG17 only.
// Source-exact live functions loaded by companion SQL setup. No live DB calls.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";

const e=process.env;
for (const [key,value] of Object.entries({
  GITHUB_ACTIONS:"true",CI:"true",
  DNDNEXT_FORGE_LOCK_CONFIRM:"DISPOSABLE_PG17_ONLY",
  PGHOST:"127.0.0.1",PGPORT:"5432",PGDATABASE:"postgres"
})) assert.equal(e[key],value,"Unsafe Forge lock test environment: "+key);

const charB="00000000-0000-0000-0000-000000003012";
function db(query) {
  const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-qAt","-c",query],{
    env:{...e,PGUSER:"postgres"},encoding:"utf8",timeout:15000
  });
  assert.equal(r.status,0,"Ephemeral DB query failed: "+r.stderr);
  return r.stdout.trim();
}
const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(label,fn,timeoutMs=3000) {
  const end=Date.now()+timeoutMs;
  while (Date.now()<end) {
    const value=fn();
    if (value) return value;
    await sleep(70);
  }
  throw Error("Timed out waiting for "+label);
}
function launch(label,sql) {
  const child=spawn("psql",["-X","-v","ON_ERROR_STOP=1","-qAt",
    "-c",sql],{env:{...e,PGUSER:"postgres"},stdio:["ignore","pipe","pipe"]});
  let stdout="",stderr="";
  child.stdout.on("data",c=>stdout+=String(c));
  child.stderr.on("data",c=>stderr+=String(c));
  const done=new Promise((resolve,reject)=>{
    child.on("error",reject);
    child.on("close",(code,signal)=>resolve({label,code,signal,stdout,stderr}));
  });
  return {child,done};
}
const getWait=(name)=>db(
  "SELECT coalesce(wait_event_type||':'||wait_event,'')"+
  " FROM pg_stat_activity WHERE application_name='"+name+"' LIMIT 1;"
);
const t1=launch("P-first exact materializer",
 "SET application_name='dndnext_forge_P_first_t1';"+
 " BEGIN; SET deadlock_timeout='150ms'; SET lock_timeout='7s';"+
 " SELECT 1 FROM public.character_progression"+
 " WHERE character_id='"+charB+"'::uuid FOR UPDATE;"+
 " SELECT pg_advisory_xact_lock(31900,1); SELECT pg_sleep(4);"+
 " SELECT private.materialize_player_forge_starting_equipment_v1('"+charB+"'::uuid);"+
 " COMMIT;"
);
await until("progression prelock marker",()=>db(
 "SELECT count(*) FROM pg_locks WHERE locktype='advisory' "+
 "AND classid='31900'::oid AND objid='1'::oid AND granted='t';")==="1",2000);
const t2=launch("S-first original progression sync",
 "SET application_name='dndnext_forge_sheet_sync_t2';"+
 " BEGIN; SET deadlock_timeout='150ms'; SET lock_timeout='7s';"+
 " UPDATE public.character_sheets"+
 " SET sheet = sheet || '{\"raceNote\":\"test concurrency note\"}'::jsonb"+
 " WHERE character_id='"+charB+"'::uuid; COMMIT;"
);
const wait=await until("sheet writer waiting for progression row",
 ()=>{const w=getWait("dndnext_forge_sheet_sync_t2");return w.startsWith("Lock:")?w:null;},2800);
console.log("Observed F02 sheet sync source transaction wait event:",wait);
const [first,second]=await Promise.all([t1.done,t2.done]);
const failed=[first,second].filter(x=>x.code!==0);
const succeeded=[first,second].filter(x=>x.code===0);
const failures=failed.map(x=>x.stderr);
assert.equal(failed.length,1,
 "Exactly one lock inversion victim expected, got: "+JSON.stringify([first,second]));
assert.equal(succeeded.length,1,"One transaction must survive a real deadlock");
assert.match(failures[0],/(40P01|deadlock detected)/i,
 "Expected PostgreSQL 40P01, actual: "+failures[0]);
assert.equal(db("SELECT count(*) FROM public.character_progression"+
 " WHERE character_id='"+charB+"'::uuid"),"1");
assert.equal(db("SELECT count(*) FROM public.inventory_items"+
 " WHERE owner_id='"+charB+"'"),"0");
console.log("PASS F02 PostgreSQL REAL P/S deadlock using both ORIGINAL functions."+
 " T1 P-before-S with test-only prelock timing; T2 sheet trigger S-before-P."+
 " Production reachability is NOT established.");

// A consistent P then S control using synthetic row SELECT locks; not a
// universal lock-order recommendation.
const controlFirst=launch("P then S control A",
 "BEGIN; SET lock_timeout='7s';"+
 " SELECT 1 FROM public.character_progression"+
 " WHERE character_id='"+charB+"'::uuid FOR UPDATE;"+
 " SELECT pg_sleep(0.5); SELECT 1 FROM public.character_sheets"+
 " WHERE character_id='"+charB+"'::uuid FOR UPDATE; COMMIT;"
);
await sleep(110);
const controlSecond=launch("P then S control B",
 "BEGIN; SET lock_timeout='7s';"+
 " SELECT 1 FROM public.character_progression"+
 " WHERE character_id='"+charB+"'::uuid FOR UPDATE;"+
 " SELECT 1 FROM public.character_sheets"+
 " WHERE character_id='"+charB+"'::uuid FOR UPDATE; COMMIT;"
);
const controls=await Promise.all([controlFirst.done,controlSecond.done]);
for(const x of controls) assert.equal(x.code,0,
 "Consistent P->S control must complete: "+x.label+": "+x.stderr);
console.log("PASS F03 two sessions using same P->S order complete without deadlock."+
 " Reduced control only, NOT accepted global order.");
console.log("P1.3 Forge F01-F03 PASS in disposable PostgreSQL 17."+
 " No production DB mutations and no production-deadlock claim.");
