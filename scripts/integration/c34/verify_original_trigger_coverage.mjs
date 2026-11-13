#!/usr/bin/env node
/**
 * C34 exact-source 31-trigger audit (offline only). Historical original
 * 31-trigger census from held #324, byte-verified by original Git blob.
 * Staged 2 privacy triggers are NEW HELD #345 candidates, not original 31.
 * DDL-presence is never promoted to signed behavioral acceptance.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const originalDoc="docs/research/C34_ORIGINAL_31_TRIGGER_CENSUS_CAPTURE_2026-11-05.md";
const originalSha="296e178fc951e261f48b6b9d63e48ee3012ee232";
const originals={character_progression:19,character_sheets:4,characters:6,inventory_items:2};
export const sourceFixturePaths=Object.freeze([
  "scripts/fixtures/forge_materializer_local_auth_extension_pg17.sql",
  "scripts/integration/c34/c34_inventory_original_policy_baseline_pg17.sql",
  "scripts/integration/c34/c34_five_original_sheet_character_triggers_pg17.sql",
  "sql/candidates/20261104_gm_vs_player_backstory_secrets_stage3.sql"
]);
export const heldPrivacyNames=Object.freeze([
  "characters_capture_creator_at_insert_v1",
  "characters_guard_player_gm_secret_at_insert_v1"
]);
const gitBlobSha=(b)=>createHash("sha1").update("blob "+b.length+"\0").update(b).digest("hex");
export function auditTriggerCoverage(read=(file)=>fs.readFileSync(path.join(root,file))) {
  const raw=read(originalDoc);
  assert.ok(Buffer.isBuffer(raw),"original 31-trigger census must be raw bytes");
  assert.equal(gitBlobSha(raw),originalSha,"original 31-trigger census blob drift");
  const records=[];
  for(const line of raw.toString("utf8").split(/\r?\n/)){
    if(!/^\| \u0060(?:character_progression|character_sheets|characters|inventory_items)\u0060 \|/.test(line)) continue;
    const cols=line.split("|").slice(1,-1).map(s=>s.trim());
    const q=cols.slice(0,4).map(s=>/^\u0060([^\u0060]+)\u0060$/.exec(s)?.[1]);
    const [table,name,handler,md5]=q;
    if(!table||!name||!handler||!/^[a-f0-9]{32}$/.test(md5)||!["Immediate","Deferred"].includes(cols[4]))
      throw Error("Malformed original live trigger census row: "+line.slice(0,140));
    records.push({table,name,handler,md5,timing:cols[4]});
  }
  assert.equal(records.length,31,"historical live trigger census must contain 31 original entries");
  for(const [table,count] of Object.entries(originals))
    assert.equal(records.filter(x=>x.table===table).length,count,"Original census table "+table);
  assert.equal(new Set(records.map(x=>x.name)).size,31,"Original trigger names must be unique");

  const staged=[];
  for(const file of sourceFixturePaths){
    const source=read(file).toString("utf8").replace(/\/\*[\s\S]*?\*\//g,"")
      .replace(/^\s*--[^\n]*$/gm,"");
    const regex=/^\s*CREATE\s+(CONSTRAINT\s+)?TRIGGER\s+([a-z0-9_]+)\s+([\s\S]*?);/gim;
    for(const m of source.matchAll(regex)){
      const ddl=m[0],body=m[3];
      const table=/\bON\s+(?:public\.)?(character_progression|character_sheets|characters|inventory_items)\b/i.exec(body)?.[1];
      const handler=/\bEXECUTE\s+FUNCTION\s+(?:private\.|public\.)?([a-z_0-9]+)\s*\(/i.exec(body)?.[1];
      assert.ok(table&&handler,"Cannot ground exact table and handler for "+m[2]);
      staged.push({name:m[2],table,handler,timing:/DEFERRABLE\s+INITIALLY\s+DEFERRED/i.test(ddl)?"Deferred":"Immediate",file});
    }
  }
  const byName=new Map();
  for(const t of staged){
    assert.ok(!byName.has(t.name),"Duplicate staged trigger: "+t.name);
    byName.set(t.name,t);
  }
  const absent=[],integrated=[];
  for(const o of records){
    const t=byName.get(o.name);
    if(!t){absent.push(o.name);continue;}
    assert.equal(t.table,o.table,"Table mismatch for original trigger "+o.name);
    assert.equal(t.handler,o.handler,"Handler mismatch for original trigger "+o.name);
    assert.equal(t.timing,o.timing,"Timing/deferral mismatch for original trigger "+o.name);
    integrated.push(o.name);
  }
  const newHeld=heldPrivacyNames.filter(x=>byName.has(x));
  assert.equal(newHeld.length,2,"Both staged NPC privacy triggers must remain distinct");
  for(const x of newHeld)assert.ok(!records.some(y=>y.name===x),"Do not count held privacy trigger as original");
  assert.equal(staged.length,integrated.length+newHeld.length,
    "Unaccounted/renamed trigger in verified source fixtures");
  return {originalTotal:31,originalByTable:originals,stagedOriginalCount:integrated.length,
    originalMissingCount:absent.length,proposedPrivacyCount:newHeld.length,
    totalStaged:staged.length,originalStaged:integrated,originalMissing:absent,
    proposedPrivacy:newHeld,sourceOriginalCensusSha:originalSha,
    assurance:"SOURCE_DDL_ONLY_NOT_ALL_BRANCHES_TESTED"};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const r=auditTriggerCoverage();
 assert.equal(r.stagedOriginalCount,9,"C34 T2 expected 9/31 original DDL, not full parity");
 assert.equal(r.originalMissingCount,22);
 assert.equal(r.totalStaged,11);
 console.log("PASS C34-31CENSUS: "+r.stagedOriginalCount+"/31 original trigger DDL + "+r.proposedPrivacyCount+
   " held NPC privacy triggers; "+r.originalMissingCount+" originals not staged. DDL is not full behavioral acceptance.");
}
