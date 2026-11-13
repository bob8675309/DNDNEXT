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
  "sql/candidates/20261104_gm_vs_player_backstory_secrets_stage3.sql",
  "scripts/fixtures/c33_forge_original_levelup_cancel_local_pg17.sql",
  "scripts/fixtures/c33_forge_original_sprite_guard_local_pg17.sql",
  "scripts/fixtures/c33_forge_original_mog_guard_local_pg17.sql",
  "scripts/integration/c34/c34_original_fighter_subclass_choice_pg17.sql",
  "scripts/integration/c34/c34_original_deferred_progression_authority_pg17.sql",
  "scripts/fixtures/forge_feat_materializer_local_auth_extension_pg17.sql",
  "sql/candidates/20261105_forge_progression_verified_creator_seed_v1.sql",
  "scripts/integration/c34/c34_original_starting_magic_exactness_pg17.sql"
]);
export const heldPrivacyNames=Object.freeze([
  "characters_capture_creator_at_insert_v1",
  "characters_guard_player_gm_secret_at_insert_v1"
]);
export const heldCreatorSeedNames=Object.freeze([
  "character_progression_seed_verified_forge_creator_v1"
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
    if(cols.length<6)continue; // Skip summary table: 4 columns, not original trigger row.
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
  const downstream=[];
  for(const file of sourceFixturePaths){
    const source=read(file).toString("utf8").replace(/\/\*[\s\S]*?\*\//g,"")
      .replace(/^\s*--[^\n]*$/gm,"");
    const regex=/^\s*CREATE\s+(CONSTRAINT\s+)?TRIGGER\s+([a-z0-9_]+)\s+([\s\S]*?);/gim;
    for(const m of source.matchAll(regex)){
      const ddl=m[0],body=m[3];
      const table=/\bON\s+(?:public\.)?(character_progression|character_sheets|characters|inventory_items)\b/i.exec(body)?.[1];
      const handler=/\bEXECUTE\s+FUNCTION\s+(?:private\.|public\.)?([a-z_0-9]+)\s*\(/i.exec(body)?.[1];
      if(!table && file==="scripts/fixtures/forge_feat_materializer_local_auth_extension_pg17.sql"){
        const grantTable=/\bON\s+(?:public\.)?(character_option_grant_instances|character_option_grants)\b/i.exec(body)?.[1];
        assert.ok(grantTable&&handler,"C34-T6 grant-table trigger requires exact original table and handler: "+m[2]);
        downstream.push({name:m[2],table:grantTable,handler,file});
        continue;
      }
      assert.ok(table&&handler,"Cannot ground exact table and handler for "+m[2]);
      staged.push({name:m[2],table,handler,timing:/DEFERRABLE\s+INITIALLY\s+DEFERRED/i.test(ddl)?"Deferred":"Immediate",file});
    }
  }
  const expectedDownstream=new Map([
    ["character_option_grant_instances_direct_authority_guard_v1","character_option_grant_instances|guard_direct_character_authority_mutation_v1"],
    ["character_option_grants_direct_authority_guard_v1","character_option_grants|guard_direct_character_authority_mutation_v1"],
    ["character_option_grant_instance_boon_energy_resistance_v1","character_option_grant_instances|materialize_boon_energy_resistance_instance_v1"],
    ["character_option_grant_instance_cartomancer_v1","character_option_grant_instances|materialize_cartomancer_instance_v1"],
    ["character_option_grant_instance_feat_runtime_expertise_v1","character_option_grant_instances|materialize_feat_runtime_expertise_instance_v1"]
  ]);
  assert.equal(downstream.length,5,"C34-T6 must preserve all five original downstream grant-table triggers");
  for(const t of downstream){
    const expected=expectedDownstream.get(t.name);
    assert.ok(expected,"Unexpected original grant-table trigger: "+t.name);
    assert.equal(t.table+"|"+t.handler,expected,
      "C34-T6 exact grant-table handler/table mismatch for "+t.name);
    expectedDownstream.delete(t.name);
  }
  assert.equal(expectedDownstream.size,0,"C34-T6 missing original grant-table triggers");
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
  const fighterSubclassDdl=read("scripts/integration/c34/c34_original_fighter_subclass_choice_pg17.sql").toString("utf8");
  const originalFighterEvent=[
    "CREATE TRIGGER character_progression_apply_forge_subclass_v1",
    " BEFORE INSERT ON public.character_progression",
    " FOR EACH ROW EXECUTE FUNCTION private.apply_character_forge_subclass_choice_v1();"
  ].join("\n");
  assert.ok(fighterSubclassDdl.includes(originalFighterEvent),
    "C34 T4 must retain exact original Fighter subclass BEFORE INSERT event and row handler");
  const authorityDdl=read("scripts/integration/c34/c34_original_deferred_progression_authority_pg17.sql").toString("utf8");
  const authorityEvent=[
    "CREATE CONSTRAINT TRIGGER character_progression_validate_player_forge_authority_v1",
    " AFTER INSERT OR UPDATE OF class_id, class_level ON public.character_progression",
    " DEFERRABLE INITIALLY DEFERRED FOR EACH ROW",
    " EXECUTE FUNCTION private.validate_player_forge_authority_payload_v1();"
  ].join("\n");
  assert.ok(authorityDdl.includes(authorityEvent),
    "C34 T5 must retain exact original deferred progression authority event and row handler");

  // Prove original preferred-view definitions have not been reinterpreted or
  // rewritten in C34's compatibility-only adapter (source-original J31).
  const originalFixture=read("scripts/fixtures/forge_progression_authority_local_auth_extension_pg17.sql").toString("utf8");
  const viewStart="CREATE VIEW public.character_option_catalog_all_preferred AS";
  const viewEnd="-- Deliberate isolated XPHB catalog entries";
  const start=originalFixture.indexOf(viewStart),end=originalFixture.indexOf(viewEnd,start);
  assert.ok(start>0 && end>start,"J31 original preferred views extraction markers lost");
  const sourceViews=originalFixture.slice(start,end).trim();
  assert.ok(authorityDdl.includes(sourceViews),
    "C34 T5 original option catalog preferred VIEW definitions drifted from held #324");
  const creatorSeedSource=read("sql/candidates/20261105_forge_progression_verified_creator_seed_v1.sql").toString("utf8");
  const creatorSeedEvent=[
    "CREATE TRIGGER character_progression_seed_verified_forge_creator_v1",
    "BEFORE INSERT ON public.character_progression",
    "FOR EACH ROW",
    "EXECUTE FUNCTION private.seed_verified_forge_progression_creator_v1();"
  ].join("\n");
  assert.ok(creatorSeedSource.includes(creatorSeedEvent),
    "C34-T7 verified creator candidate BEFORE INSERT event/handler must remain intact");
  assert.ok(creatorSeedSource.includes("AND ca.recorded_at=transaction_timestamp()"),
    "C34-T7 candidate must bind the trusted creator to the same transaction");
  assert.ok(creatorSeedSource.includes(
    "REVOKE ALL ON FUNCTION private.seed_verified_forge_progression_creator_v1()"),
    "C34-T7 candidate must explicitly revoke direct function execution");

  // Exact ORIGINAL held #324 source body and complete live deferred DDL;
  // function-name-only or altered-handler substitutions must fail closed.
  const originalMagic=read("scripts/fixtures/forge_high_risk_original_progression_triggers_pg17.sql").toString("utf8");
  const stagedMagic=read("scripts/integration/c34/c34_original_starting_magic_exactness_pg17.sql").toString("utf8");
  const magicMark="-- private.validate_player_forge_starting_magic_exactness_v1() MD5 ba645ad0f2c17addad0b40e0602c2ac8";
  const magicPos=originalMagic.indexOf(magicMark);
  const magicStart=originalMagic.indexOf("CREATE OR REPLACE FUNCTION private.validate_player_forge_starting_magic_exactness_v1()",magicPos);
  const magicEnd=originalMagic.indexOf("$function$;",magicStart)+"$function$;".length;
  assert.ok(magicPos>0&&magicStart>magicPos&&magicEnd>magicStart,"T8 original pg_get_functiondef unavailable");
  assert.ok(stagedMagic.includes(originalMagic.slice(magicStart,magicEnd)),"T8 source-original starting-magic function body drift");
  const magicEvent=[
    "CREATE CONSTRAINT TRIGGER character_progression_validate_player_forge_starting_magic_exac",
    " AFTER INSERT OR UPDATE ON public.character_progression",
    " DEFERRABLE INITIALLY DEFERRED FOR EACH ROW",
    " EXECUTE FUNCTION private.validate_player_forge_starting_magic_exactness_v1();"
  ].join("\n");
  assert.ok(stagedMagic.includes(magicEvent),"T8 exact source deferred starting-magic trigger event drift");
  const newHeld=heldPrivacyNames.filter(x=>byName.has(x));
  assert.equal(newHeld.length,2,"Both staged NPC privacy triggers must remain distinct");
  for(const x of newHeld)assert.ok(!records.some(y=>y.name===x),"Do not count held privacy trigger as original");
  const heldAttribution=heldCreatorSeedNames.filter(x=>byName.has(x));
  assert.equal(heldAttribution.length,1,"One held verified creator-seed trigger is required");
  for(const x of heldAttribution)
    assert.ok(!records.some(y=>y.name===x),
      "T7 creator-seed is a proposed held candidate, NOT one of the original 31");
  const seed=byName.get(heldAttribution[0]);
  assert.equal(seed.table,"character_progression");
  assert.equal(seed.handler,"seed_verified_forge_progression_creator_v1");
  assert.equal(seed.timing,"Immediate");
  assert.equal(staged.length,integrated.length+newHeld.length+heldAttribution.length,
    "Unaccounted/renamed original or held trigger in verified source fixtures");
  return {originalTotal:31,originalByTable:originals,stagedOriginalCount:integrated.length,
    originalMissingCount:absent.length,proposedPrivacyCount:newHeld.length,
    totalStaged:staged.length,proposedCreatorSeedCount:heldAttribution.length,
    downstreamGrantTriggerCount:downstream.length,originalStaged:integrated,originalMissing:absent,
    proposedPrivacy:newHeld,sourceOriginalCensusSha:originalSha,
    assurance:"SOURCE_DDL_ONLY_NOT_ALL_BRANCHES_TESTED"};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const r=auditTriggerCoverage();
 assert.equal(r.stagedOriginalCount,16,"C34 T8 expects 16/31 original DDL, not complete parity");
 assert.equal(r.originalMissingCount,15);
 assert.equal(r.totalStaged,19);
 assert.equal(r.proposedCreatorSeedCount,1);
 assert.equal(r.downstreamGrantTriggerCount,5);
 console.log("PASS C34-31CENSUS T8: "+r.stagedOriginalCount+"/31 original trigger DDL + "+r.proposedPrivacyCount+
   " held NPC privacy triggers + "+r.proposedCreatorSeedCount+" held verified creator seed; "+r.originalMissingCount+" originals not staged. DDL is not full behavioral acceptance.");
}
