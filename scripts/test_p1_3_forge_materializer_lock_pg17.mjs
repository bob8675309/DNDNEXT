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
 " WHERE owner_id='"+charB+"'"),"1",
 "Second materializer call must not duplicate already committed inventory");
assert.equal(db("SELECT count(*) FROM public.character_currency"+
 " WHERE character_id='"+charB+"'::uuid"),"1",
 "Exactly one currency row must survive test-only contention");
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

// F04: SAME character, distinct real original deployed functions:
// Admin set_character_progression_v1 updates CP first, then CS.
// Original sheet AFTER UPDATE trigger updates CS first, then CP.
// Test-only explicit CP prelock / 3-second hold makes the interleaving
// deterministic; it does not show how often a real browser reaches it.
assert.equal(db("SELECT md5(pg_get_functiondef("+
 "'public.set_character_progression_v1(uuid,text,text,integer,bigint,text,text)'::regprocedure))"),
 "eb467b7c7a8d548581a36cfcb0d8f77b");
const adminProgressionCall="SELECT public.set_character_progression_v1('"+charB+
 "'::uuid,'fighter','XPHB',1,0,NULL,NULL);";
const adminT1=launch("original Admin progression CP->CS",
 "SET application_name='dndnext_p13_admin_cp_first';"+
 " BEGIN; SET deadlock_timeout='150ms'; SET lock_timeout='7s';"+
 " SELECT 1 FROM public.character_progression WHERE character_id='"+charB+"'::uuid FOR UPDATE;"+
 " SELECT pg_advisory_xact_lock(31904,1); SELECT pg_sleep(3.2);"+
 adminProgressionCall+" COMMIT;"
);
await until("Admin progression CP prelock",()=>db(
 "SELECT count(*) FROM pg_locks WHERE locktype='advisory'"+
 " AND classid='31904'::oid AND objid='1'::oid AND granted='t';")==="1",2200);
const sheetT2=launch("original CS note -> CP sync",
 "SET application_name='dndnext_p13_sheet_sync_edit';"+
 " BEGIN; SET deadlock_timeout='150ms'; SET lock_timeout='7s';"+
 " UPDATE public.character_sheets"+
 " SET sheet=sheet||'{\"adminProgressionRaceNote\":\"original sheet edit\"}'::jsonb"+
 " WHERE character_id='"+charB+"'::uuid; COMMIT;"
);
const observed=await until("sheet trigger CS->CP blocked by original Admin source CP lock",
 ()=>{const w=getWait("dndnext_p13_sheet_sync_edit");return w.startsWith("Lock:")?w:null;},2500);
console.log("Observed F04 genuine source-path wait:",observed);
const bothDeadlock=await Promise.all([adminT1.done,sheetT2.done]);
const deadlockVictims=bothDeadlock.filter(x=>x.code!==0);
assert.equal(deadlockVictims.length,1,
 "F04 expected exactly one deadlock victim in original Admin CP->CS versus original CS->CP: "+JSON.stringify(bothDeadlock));
assert.match(deadlockVictims[0].stderr,/(40P01|deadlock detected)/i);
assert.equal(db("SELECT count(*) FROM public.character_progression WHERE character_id='"+charB+"'::uuid"),"1");
assert.equal(db("SELECT count(*) FROM public.inventory_items WHERE owner_id='"+charB+"'"),"1");
assert.equal(db("SELECT count(*) FROM public.character_currency WHERE character_id='"+charB+"'::uuid"),"1");
console.log("PASS F04 40P01 deadlock original Admin progression CP->CS versus original player CS->CP sync, test-timed interleaving; production timing not established");

// F05: A deliberately SYNTHETIC CP-first prelock on BOTH transactions
// serializes same-row source operations. It prevents THIS inversion, but
// using this lock order in production needs a coordinated P1.3 owner decision.
const safeA=launch("CP-first Admin controlled",
 "SET application_name='dndnext_p13_admin_control';"+
 " BEGIN; SET lock_timeout='7s';"+
 " SELECT 1 FROM public.character_progression WHERE character_id='"+charB+"'::uuid FOR UPDATE;"+
 " SELECT pg_advisory_xact_lock(31905,1); SELECT pg_sleep(1.0);"+
 adminProgressionCall+" COMMIT;"
);
await until("CP-first control marker",()=>db(
 "SELECT count(*) FROM pg_locks WHERE locktype='advisory'"+
 " AND classid='31905'::oid AND objid='1'::oid AND granted='t';")==="1",1500);
const safeB=launch("CP-first sheet edit controlled",
 "SET application_name='dndnext_p13_sheet_control';"+
 " BEGIN; SET lock_timeout='7s';"+
 " SELECT 1 FROM public.character_progression WHERE character_id='"+charB+"'::uuid FOR UPDATE;"+
 " UPDATE public.character_sheets"+
 " SET sheet=sheet||'{\"adminProgressionControlNote\":\"serialized CP before CS\"}'::jsonb"+
 " WHERE character_id='"+charB+"'::uuid; COMMIT;"
);
const safeResult=await Promise.all([safeA.done,safeB.done]);
for(const result of safeResult)assert.equal(result.code,0,
 "F05 synthetic CP-first control must finish source operations: "+JSON.stringify(result));
assert.equal(db("SELECT sheet->>'adminProgressionControlNote' FROM public.character_sheets"+
 " WHERE character_id='"+charB+"'::uuid"),"serialized CP before CS");
assert.equal(db("SELECT count(*) FROM public.inventory_items WHERE owner_id='"+charB+"'"),"1");
assert.equal(db("SELECT count(*) FROM public.character_currency WHERE character_id='"+charB+"'::uuid"),"1");
console.log("PASS F05 CP-first prelock (synthetic for both sessions) serializes original Admin progression and original sheet sync, no duplicate equipment; NOT global lock proof");
console.log("P1.3 Forge F01-F05 PASS on disposable PG17. Original v1 Admin CP->CS / CS->CP collision is demonstrable with timed prelock; authenticated player level-up, full triggers, G/I and provenance seed integration not yet tested.");
