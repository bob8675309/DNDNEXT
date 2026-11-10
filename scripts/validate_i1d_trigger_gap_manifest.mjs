#!/usr/bin/env node
// Read-only source audit: original 31-trigger census and all forge_* SQL.
// No database access, credentials, source rewriting or world-map changes.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync,readdirSync} from "node:fs";
const read=p=>readFileSync(p,"utf8");
const blobSha=p=>{
  const b=readFileSync(p);
  return createHash("sha1").update("blob "+b.length+"\0").update(b).digest("hex");
};
const manifest="docs/Forge_Original_Creation_Trigger_Coverage_2026-11-05.md";
assert.equal(blobSha(manifest),"5d3a32c5b6661e47b36794bfe7723296c4b0631b",
  "Original 31-trigger historical census blob drift");
const counts={character_progression:19,character_sheets:4,characters:6,inventory_items:2};
const original=read(manifest).split(/\r?\n/).filter(line=>
  /^\|\s*\x60(?:character_progression|character_sheets|characters|inventory_items)\x60\s*\|/.test(line))
  .map(line=>{
    const c=line.split("|").slice(1,-1).map(v=>v.trim());
    const f=c.slice(0,4).map(v=>/^\x60([^\x60]+)\x60$/.exec(v)?.[1]);
    return {table:f[0],name:f[1],handler:f[2],md5:f[3],timing:c[4]};
  }).filter(r=>r.table in counts&&r.name&&r.handler&&/^[a-f0-9]{32}$/.test(r.md5)
    &&/^(Deferred|Immediate)$/.test(r.timing));
assert.equal(original.length,31,"Historical 31-trigger inventory incomplete");
assert.equal(new Set(original.map(r=>r.name)).size,31,"Duplicate original trigger name");
for(const [t,n] of Object.entries(counts))assert.equal(original.filter(r=>r.table===t).length,n,t);
function parseDDL(sql,file){
  const clean=sql.replace(/\/\*[\s\S]*?\*\//g,"").replace(/^\s*--[^\n]*$/gm,"");
  return [...clean.matchAll(/^\s*CREATE\s+(CONSTRAINT\s+)?TRIGGER\s+"?([a-z_0-9]+)"?\s+([\s\S]*?);/gim)]
    .map(m=>{
      const ddl=m[0];
      return {name:m[2],file,
        table:/\bON\s+(?:public\.)?"?(character_progression|character_sheets|characters|inventory_items)"?\b/i.exec(ddl)?.[1],
        handler:/\bEXECUTE\s+(?:FUNCTION|PROCEDURE)\s+(?:"?(?:public|private)"?\.)?"?([a-z_0-9]+)"?\s*\(/i.exec(ddl)?.[1],
        timing:/\bDEFERRABLE\s+INITIALLY\s+DEFERRED\b/i.test(ddl)?"Deferred":"Immediate",
        constraint:!!m[1]};
    });
}
const forgeFixtures=readdirSync("scripts/fixtures").filter(x=>/^forge_.*\.sql$/.test(x));
const stagedDDLs=forgeFixtures.flatMap(n=>parseDDL(read("scripts/fixtures/"+n),"scripts/fixtures/"+n));
const statuses=original.map(r=>{
  const matches=stagedDDLs.filter(m=>m.name===r.name);
  if(!matches.length)return {...r,status:"NOT_STAGED_IN_FORGE_FIXTURE"};
  assert.equal(matches.length,1,"Duplicate original fixture DDL "+r.name);
  const m=matches[0];
  assert.equal(m.table,r.table,r.name+" original trigger table drift");
  assert.equal(m.handler,r.handler,r.name+" original handler drift");
  assert.equal(m.timing,r.timing,r.name+" original timing drift");
  if(r.timing==="Deferred")assert.ok(m.constraint,r.name+" deferred trigger lost CONSTRAINT");
  return {...r,status:"STAGED_DDL_ONLY",file:m.file};
});
const staged=statuses.filter(r=>r.status==="STAGED_DDL_ONLY");
const missing=statuses.filter(r=>r.status!=="STAGED_DDL_ONLY");
assert.equal(staged.length,17);
assert.equal(missing.length,14);
assert.equal(missing.filter(r=>r.table==="character_progression").length,10);
assert.equal(missing.filter(r=>r.table==="characters").length,4);
assert.equal(missing.filter(r=>r.table==="character_sheets"||r.table==="inventory_items").length,0);
const additional={
 cancel_invalid_level_up_session_v1:"scripts/fixtures/c33_forge_original_levelup_cancel_local_pg17.sql",
 guard_character_visual_asset_sprite_v1:"scripts/fixtures/c33_forge_original_sprite_guard_local_pg17.sql",
 protect_mog_delete_v1:"scripts/fixtures/c33_forge_original_mog_guard_local_pg17.sql"
};
for(const [name,file] of Object.entries(additional)){
  const r=missing.find(x=>x.name===name);
  assert.ok(r,name+" not an original-missing Forge trigger");
  const s=read(file),found=parseDDL(s,file).filter(m=>m.name===name);
  assert.equal(found.length,1,name+" C3.3 original trigger count");
  assert.equal(found[0].table,r.table);
  assert.equal(found[0].handler,r.handler);
  assert.equal(found[0].timing,r.timing);
  assert.ok(s.includes(r.md5),name+" separate handler MD5 evidence not present");
}
const mapNames=new Set(["trg_force_depart_on_route_assign","trg_guard_locations_for_resting_and_camping"]);
for(const name of mapNames)assert.ok(missing.some(r=>r.name===name));
const unresolved=missing.filter(r=>!(r.name in additional)&&!mapNames.has(r.name));
assert.equal(unresolved.length,9);
for(const r of missing){
  const disposition=(r.name in additional)?"separately source-pinned C3.3 fixture; signed joined test tests exact MD5":
    mapNames.has(r.name)?"protected world-map trigger; DO NOT alter without owner review":
    "original MD5 known; executable full source/semantic dependencies not yet verified";
  console.log("I1D GAP "+r.table+"."+r.name+" "+r.md5+" — "+disposition);
}
assert.equal(blobSha("sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql"),
  "4532ddb8db642d0d0ab14646a3e87c034d4134c6","Original Stage4 SQL blob drift");
console.log("PASS I1D STATIC: historical 31=17 Forge fixture DDL+14 not staged, zero mismatches; 3 source-exact C3.3 fixture additions, 2 world-map protected, 9 further source dependencies. This is NOT 31/31 executable verification.");
