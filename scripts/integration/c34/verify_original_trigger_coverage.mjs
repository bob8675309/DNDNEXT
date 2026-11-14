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
  "scripts/integration/c34/c34_original_starting_magic_exactness_pg17.sql",
  "scripts/integration/c34/c34_original_nested_choice_dependency_pg17.sql",
  "scripts/fixtures/forge_starting_spells_local_auth_pg17.sql",
  "scripts/integration/c34/c34_original_source_magic_materializer_pg17.sql",
  "scripts/integration/c34/c34_original_species_replaceable_cantrip_pg17.sql",
  "scripts/integration/c34/c34_original_eladrin_season_pg17.sql"
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

  // T9 original handler is imported from a separately sha-pinned original
  // runtime fixture. Silent replacement with reimplemented code is forbidden.
  const nestedOriginalPath="scripts/fixtures/forge_nested_choices_original_pg17.sql";
  const nestedAdapter=read("scripts/integration/c34/c34_original_nested_choice_dependency_pg17.sql").toString("utf8");
  const nestedRaw=read(nestedOriginalPath);
  assert.ok(Buffer.isBuffer(nestedRaw),"T9 requires original raw function source");
  assert.equal(gitBlobSha(nestedRaw),"6eb50c0d0bd63da6ffd5d20c0e2fa09b8dcbf17a","T9 original nested-choice function Git blob drift");
  assert.ok(nestedAdapter.includes("\\i "+nestedOriginalPath),
    "T9 must import the exact original nested-choice function, not a replacement");
  const nestedEvent=[
    "CREATE CONSTRAINT TRIGGER character_progression_validate_player_forge_nested_choices_v1",
    " AFTER INSERT OR UPDATE OF class_id, class_level, subclass_name, subclass_source, level_choices",
    " ON public.character_progression",
    " DEFERRABLE INITIALLY DEFERRED FOR EACH ROW",
    " EXECUTE FUNCTION private.validate_player_forge_nested_choice_payload_v1();"
  ].join("\n");
  assert.ok(nestedAdapter.includes(nestedEvent),
    "T9 original deferred nested-choice trigger event/handler drift");

  // T10 imported original source bytes and original deferred event must be
  // unchanged; no permissive test-specific handler or omitted dependencies.
  const t10Source=read("scripts/fixtures/forge_starting_spells_original_pg17.sql");
  assert.ok(Buffer.isBuffer(t10Source),"T10 original starting-spells handler source must be raw Git blob");
  assert.equal(gitBlobSha(t10Source),"d56ed5ea44289bbb20720c1323f9b22f362b31c5","T10 original starting-spells handler Git blob drift");
  const t10Fixture=read("scripts/fixtures/forge_starting_spells_local_auth_pg17.sql").toString("utf8");
  const t10WizardSeed=read("scripts/fixtures/forge_wizard_starting_spells_local_auth_pg17.sql");
  assert.equal(gitBlobSha(Buffer.from(t10Fixture,"utf8")),"4b6eeecdbfba49cca5a74c26e2f88b6d83123897","T10 original source-install fixture drift");
  assert.ok(Buffer.isBuffer(t10WizardSeed),"T10 Wizard source-identified catalog must remain raw");
  assert.equal(gitBlobSha(t10WizardSeed),"bbf8cece98f46b1008d8e2ff79650647f89a5e20","T10 source-identified 2024 Wizard specimen drift");
  const t10Event=[
    "CREATE CONSTRAINT TRIGGER character_progression_validate_player_forge_spells_v1",
    " AFTER INSERT OR UPDATE OF class_id, class_level ON public.character_progression",
    " DEFERRABLE INITIALLY DEFERRED FOR EACH ROW",
    " EXECUTE FUNCTION private.validate_player_forge_starting_spells_v1();"
  ].join("\n");
  assert.ok(t10Fixture.includes(t10Event),"T10 original deferred starting-spells trigger event/handler drift");
  const t10Joint=read("scripts/integration/c34/c34_original_starting_spells_joint_pg17.sql").toString("utf8");
  assert.ok(t10Joint.includes("\\i scripts/fixtures/forge_starting_spells_local_auth_pg17.sql")&&t10Joint.includes("\\i scripts/fixtures/forge_wizard_starting_spells_local_auth_pg17.sql"),
    "T10 wrapper must stage original source DDL and verified Wizard catalog");
  assert.ok(t10Fixture.includes("\\i scripts/fixtures/forge_starting_spells_original_pg17.sql")&&
    t10Fixture.includes("'6870e810de909209c44aecd02f5c72e2'"),
    "T10 original live pg_get_functiondef MD5 and import required");

  // T11 must use the exact held #324 pg_get_functiondef body (not merely the
  // original handler name), five real PG17 helper MD5 locks, and its original
  // AFTER INSERT DEFERRABLE INITIALLY DEFERRED timing.
  const t11Original=read("scripts/fixtures/forge_high_risk_original_progression_triggers_pg17.sql").toString("utf8");
  const t11Staged=read("scripts/integration/c34/c34_original_source_magic_materializer_pg17.sql").toString("utf8");
  const t11Begin=t11Original.indexOf("CREATE OR REPLACE FUNCTION private.materialize_player_forge_source_magic_v1()");
  const t11End=t11Original.indexOf("$function$;",t11Begin)+"$function$;".length;
  assert.ok(t11Begin>=0&&t11End>t11Begin,"T11 original source-magic handler unavailable");
  assert.ok(t11Staged.includes(t11Original.slice(t11Begin,t11End)),
    "T11 source-original species/feat magic handler body drifted");
  const t11Event=[
    "CREATE CONSTRAINT TRIGGER character_progression_materialize_player_forge_source_magic_v1",
    " AFTER INSERT ON public.character_progression",
    " DEFERRABLE INITIALLY DEFERRED FOR EACH ROW",
    " EXECUTE FUNCTION private.materialize_player_forge_source_magic_v1();"
  ].join("\n");
  assert.ok(t11Staged.includes(t11Event),"T11 original source-magic deferred trigger event/handler drift");
  for(const md5 of [
    "3dce158c3dfe14ff6776855b1ead5022",
    "deb38940c6249808a39aeb2380e09c16",
    "c6770a82adc7ee3b79151262474b7aed",
    "c9bc6081a43c52c44c1cf192886456df",
    "2a880d642809146678bd391304d9777c",
    "4c35eaab8dff7d3d15b64ed71881d4a6"
  ])assert.ok(t11Staged.includes(md5),"T11 exact PG17 helper/handler MD5 missing: "+md5);
  const t11Specimen=read("scripts/integration/c34/c34_source_magic_astral_elf_specimen_pg17.sql").toString("utf8");
  assert.ok(t11Specimen.includes("8975a0f7-11b5-473b-99ab-f0daca25fb7d")&&
    t11Specimen.includes("b466a340-f327-43e8-a4fe-c641f5fba2db")&&
    t11Specimen.includes("Astral Fire")&&t11Specimen.includes("AAG")&&
    t11Specimen.includes("XPHB"),
    "T11 source-identified reduced Astral Elf/Astral Fire specimen changed");

  // Source-original migration 67, with original runtime table from migration 44.
  const t12Original=read("sql/20260809_67_species_replaceable_cantrip_runtime.sql").toString("utf8");
  const t12Adapter=read("scripts/integration/c34/c34_original_species_replaceable_cantrip_pg17.sql").toString("utf8");
  const t12Event=[
    "create constraint trigger character_progression_materialize_species_cantrip_v1",
    "after insert on public.character_progression",
    "deferrable initially deferred",
    "for each row execute function private.materialize_player_forge_species_replaceable_cantrip_v1();"
  ].join("\n");
  assert.ok(t12Original.includes(t12Event)&&t12Adapter.includes(t12Event),
    "T12 exact original deferred cantrip trigger event/handler drift");
  for(const fingerprint of ["d1264573b17e7569ba75371aa7e912eb",
    "560088a5e3ad85866b6aa9b10ccfd2db",
    "f8bf8cdf45cf57953dca333e5f856a84",
    "7af5408f062f786aa633254a0d5d6365",
    "a09198d8e12df12371647fccd8479489"])
   assert.ok(t12Adapter.includes(fingerprint),"T12 original live function MD5 missing: "+fingerprint);
  const t12Table=read("sql/20260808_44_runtime_feature_choices_spell_mastery.sql").toString("utf8");
  const t12Start=t12Table.indexOf("create table if not exists public.character_runtime_feature_choices (");
  const t12End=t12Table.indexOf("revoke all on table public.character_runtime_feature_choices from public,anon,authenticated;",t12Start)+
     "revoke all on table public.character_runtime_feature_choices from public,anon,authenticated;".length;
  assert.ok(t12Start>=0&&t12End>t12Start&&t12Adapter.includes(t12Table.slice(t12Start,t12End)),
     "T12 source-original runtime table/RLS/ACL drift");
  const t12Species=read("scripts/integration/c34/c34_species_replaceable_cantrip_source_specimen_pg17.sql").toString("utf8");
  for(const evidence of ["5f62b543-f6ac-405f-baa8-1f196190ff35",
    "c667b8ab-a44e-4c23-a8ea-b03f8953fc18",
    "6e4e3cc8-ed5f-4f81-8232-600c83beeec8",
    "bf50a82c-7111-45e1-90a6-cd4c5ab2f462"])
   assert.ok(t12Species.includes(evidence),"T12 original source-identified species/spell specimen drift: "+evidence);
  // T13: original held #357 Eladrin source fixture is a byte-for-byte archived Git blob.
  // Prove every original helper body (not merely its name) and original trigger event.
  const t13Raw=read("scripts/integration/c34/sources/07_i1i_original_eladrin_season_pg17.sql");
  assert.equal(gitBlobSha(t13Raw),"323ef20258d8b3a7c7bc96e0b1d279ba755fcce5",
    "T13 held #357 original Eladrin fixture SHA drift");
  const t13Original=t13Raw.toString("utf8");
  const t13Adapter=read("scripts/integration/c34/c34_original_eladrin_season_pg17.sql").toString("utf8");
  for(const name of ["eladrin_season_options_v1","resolve_eladrin_season_v1",
    "set_eladrin_season_projection_v1","materialize_player_forge_eladrin_season_v1"]){
    const start=t13Original.indexOf("CREATE OR REPLACE FUNCTION private."+name+"(");
    const end=t13Original.indexOf("$function$;",start);
    assert.ok(start>=0&&end>start,"T13 original function missing: "+name);
    assert.ok(t13Adapter.includes(t13Original.slice(start,end+"$function$;".length)),
      "T13 original Eladrin function body drift: "+name);
  }
  const t13Event=[
    "CREATE CONSTRAINT TRIGGER character_progression_materialize_eladrin_season_v1",
    " AFTER INSERT ON public.character_progression",
    " DEFERRABLE INITIALLY DEFERRED",
    " FOR EACH ROW EXECUTE FUNCTION private.materialize_player_forge_eladrin_season_v1();"
  ].join("\n");
  assert.ok(t13Original.includes(t13Event)&&t13Adapter.includes(t13Event),
    "T13 original Eladrin deferred trigger event/handler drift");
  for(const md5 of ["d1264573b17e7569ba75371aa7e912eb",
    "a142c557fa028eb1b7a087c7802a7afb",
    "5f351b120410855845d72586dc66c62b",
    "eb1da99fed6f0785266eb061ce8bad39",
    "b866a8dff88bbfe6fb2c4f6d4c102fee"])
    assert.ok(t13Adapter.includes(md5),"T13 original Eladrin live function MD5 missing: "+md5);
  assert.ok(t13Adapter.includes("IF n<>23")&&t13Adapter.includes("IF n<>24")&&
    !t13Adapter.includes("CREATE TABLE public.character_runtime_feature_choices"),
    "T13 must reuse T12 original runtime table, not install held I1-I reduced table");
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
 assert.equal(r.stagedOriginalCount,21,"C34 T13 expects 21/31 original DDL, 8 non-map progression+2 world");
 assert.equal(r.originalMissingCount,10);
 assert.equal(r.totalStaged,24);
 assert.equal(r.proposedCreatorSeedCount,1);
 assert.equal(r.downstreamGrantTriggerCount,5);
 console.log("PASS C34-31CENSUS T13: "+r.stagedOriginalCount+"/31 original trigger DDL + "+r.proposedPrivacyCount+
   " held NPC privacy triggers + "+r.proposedCreatorSeedCount+" held verified creator seed; "+r.originalMissingCount+" originals not staged. DDL is not full behavioral acceptance.");
}
