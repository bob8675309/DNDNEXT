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
  "scripts/integration/c34/c34_original_eladrin_season_pg17.sql",
  "scripts/integration/c34/c34_original_khoravar_skill_with_legacy_mirror_pg17.sql",
  "scripts/integration/c34/c34_original_battle_master_pair_pg17.sql",
  "scripts/integration/c34/c34_original_wizard_finalizer_with_legacy_mirror_pg17.sql"
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
  // T14 has two deliberately different artifacts: the unchanged held #358
  // original (including its UNSAFE account mirror) and a separately labeled
  // Option A candidate (only the helper's account mirror is removed).
  const t14Raw=read("scripts/integration/c34/sources/08_i1j_original_khoravar_skill_pg17.sql");
  assert.equal(gitBlobSha(t14Raw),"d84d149b5bc4ef0e62f69a048ab77620f472a94a",
    "T14 held #358 original I1-J Khoravar raw source blob drift");
  const t14Original=t14Raw.toString("utf8");
  const t14Adapter=read("scripts/integration/c34/c34_original_khoravar_skill_with_legacy_mirror_pg17.sql").toString("utf8");
  const t14Candidate=read("scripts/integration/c34/c34_khoravar_option_a_character_scoped_projection_candidate_pg17.sql").toString("utf8");
  const t14OriginalFunctions=["astral_trance_skill_key_v1","astral_trance_skill_options_v1",
    "khoravar_skill_versatility_options_v1","resolve_khoravar_skill_versatility_v1",
    "set_species_runtime_projection_v1","materialize_player_forge_khoravar_skill_versatility_v1"];
  for(const name of t14OriginalFunctions){
    const start=t14Original.indexOf("CREATE OR REPLACE FUNCTION private."+name+"(");
    const end=t14Original.indexOf("$function$;",start);
    assert.ok(start>=0&&end>start,"T14 original I1-J source function missing: "+name);
    const exact=t14Original.slice(start,end+"$function$;".length);
    assert.ok(t14Adapter.includes(exact),"T14 original Khoravar function body drift: "+name);
    if(name==="set_species_runtime_projection_v1"){
      const mirror="  update public.players p set sheet=v_sheet,updated_at=now()\n"+
        "  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);\n";
      assert.ok(exact.includes(mirror),"T14 original source legacy account writer missing");
      const scope=exact.replace(mirror,
        "  -- T14 Option A compatibility: do NOT mirror the character-scoped runtime\n"+
        "  -- projection to the legacy account-wide players.sheet snapshot.\n");
      assert.ok(t14Candidate.includes(scope),"T14 Option A helper must differ ONLY by explicit account mirror removal");
      assert.ok(!scope.includes("  update public.players p set sheet="),
        "T14 candidate cannot update legacy account sheet");
    }
  }
  const t14Event=[
    "CREATE CONSTRAINT TRIGGER character_progression_materialize_player_forge_khoravar_skill_v",
    " AFTER INSERT ON public.character_progression",
    " DEFERRABLE INITIALLY DEFERRED FOR EACH ROW",
    " EXECUTE FUNCTION private.materialize_player_forge_khoravar_skill_versatility_v1();"
  ].join("\n");
  assert.ok(t14Original.includes(t14Event)&&t14Adapter.includes(t14Event),
    "T14 original Khoravar deferred trigger event/handler drift");
  for(const fingerprint of ["dd8cdd5b47efe99b1cfff9c2bf7635dd",
    "68dcc3383c6727020331b9391ec8dde4",
    "08962b553e01fa0c2119b988d33518be",
    "afc3acbe1313d166105794a4be0ebd41",
    "1d4240ad22fd1c3d017cc8205518bfc9",
    "7f6e7d7d99ff79db1372462b4320c21b",
    "9d5fec42e2aefdd39d8a34adf1548460"])
    assert.ok(t14Adapter.includes(fingerprint),"T14 original Khoravar source fingerprint missing: "+fingerprint);
  assert.ok(t14Adapter.includes("IF n<>24")&&t14Adapter.includes("IF n<>25")&&
    t14Candidate.includes("IF position('update public.players' in lower(v_helper))>0")&&
    t14Candidate.includes("NOT original helper"),
    "T14 candidate must be labeled non-original, guard no-mirror and use T13 runtime");
  const t14Catalog=read("scripts/integration/c34/c34_khoravar_source_skill_tool_specimen_pg17.sql").toString("utf8");
  for(const id of ["87d46c71-9858-4731-9715-06b2ff387fc5",
    "9fe003bf-37f4-4432-b864-edab79f32686",
    "bd914b52-04de-4cf3-a0ca-0200c9930e06",
    "dbbec469-010d-4915-907e-f5cd220a9f26"])
    assert.ok(t14Catalog.includes(id),"T14 source XPHB skill/tool specimen drift: "+id);
  assert.ok(!t14Catalog.includes("CREATE OR REPLACE VIEW public.character_option_catalog_preferred"),
    "T14 must reuse T5 original preferred option catalog source-precedence view");
  // T15: source-preserve the PAIR of original Battle Master triggers,
  // their five pg_get_functiondef bodies and all 12 source-identified maneuvers.
  const t15Raw=read("scripts/integration/c34/sources/09_i1f_original_battle_master_functions_pg17.sql");
  const t15SetupRaw=read("scripts/integration/c34/sources/10_i1f_original_battle_master_setup_pg17.sql");
  assert.equal(gitBlobSha(t15Raw),"fbda236e3c1b96ef9a93c44f0a2f99a6cd77adf9",
    "T15 original I1-F Battle Master function source blob drift");
  assert.equal(gitBlobSha(t15SetupRaw),"c5ae0b31605d9374b295eee01eefdda0718afb80",
    "T15 original I1-F Battle Master setup source blob drift");
  const t15Original=t15Raw.toString("utf8"),t15Setup=t15SetupRaw.toString("utf8");
  const t15Adapter=read("scripts/integration/c34/c34_original_battle_master_pair_pg17.sql").toString("utf8");
  for(const name of ["battle_master_maneuver_count_v1","battle_master_maneuver_slot_level_v1",
    "is_xphb_battle_master_v1","materialize_player_forge_battle_master_maneuvers_v1",
    "validate_existing_battle_master_maneuvers_v1"]){
    const start=t15Original.indexOf("CREATE OR REPLACE FUNCTION private."+name+"(");
    const end=t15Original.indexOf("$function$;",start);
    assert.ok(start>=0&&end>start,"T15 original Battle Master function missing "+name);
    assert.ok(t15Adapter.includes(t15Original.slice(start,end+"$function$;".length)),
      "T15 original Battle Master function body drift: "+name);
  }
  const t15Begin=t15Setup.indexOf("CREATE CONSTRAINT TRIGGER character_progression_materialize_battle_master_maneuvers_v1");
  const t15End=t15Setup.indexOf("-- Internal definer functions",t15Begin);
  assert.ok(t15Begin>=0&&t15End>t15Begin&&t15Adapter.includes(t15Setup.slice(t15Begin,t15End)),
    "T15 BOTH original Battle Master deferred trigger events/handlers required");
  for(const fingerprint of ["32cbfe62f855affe40443da2fc9d20eb","70b3639eb4b6535aab3efbfc80828a0e",
    "17688ec8bceac3c06d58415de20a544b","daf3fc12e7c30165dca50ca650f9d308",
    "8bc8a467e95b07e93df833bcfc585e80"])
    assert.ok(t15Adapter.includes(fingerprint),"T15 original Battle Master MD5 missing "+fingerprint);
  const t15CatBegin=t15Setup.indexOf("INSERT INTO public.class_feature_option_catalog");
  const t15CatEnd=t15Setup.indexOf("\\i scripts/fixtures/i1f_battle_master_original_functions_pg17.sql",t15CatBegin);
  assert.ok(t15CatBegin>=0&&t15CatEnd>t15CatBegin&&
    t15Adapter.includes(t15Setup.slice(t15CatBegin,t15CatEnd)),
    "T15 source-identical 12 real original XPHB maneuver IDs/rows required");
  assert.ok(t15Adapter.includes("IF n<>25")&&t15Adapter.includes("IF n<>27")&&
    !t15Adapter.includes("update public.players p set sheet="),
    "T15 original pair must not add account-sheet mirroring or map triggers");
  // T16 source custody: raw original I1-E #353 code/setup SHA; original
  // seven private bodies and original deferred AFTER INSERT Wizard trigger.
  const t16Raw=read("scripts/integration/c34/sources/11_i1e_original_wizard_functions_pg17.sql");
  const t16SetupRaw=read("scripts/integration/c34/sources/12_i1e_original_wizard_setup_pg17.sql");
  assert.equal(gitBlobSha(t16Raw),"c0322578db9e848b20a476b32681c07e316f0870",
    "T16 original I1-E Wizard function source blob drift");
  assert.equal(gitBlobSha(t16SetupRaw),"0b833150367ce01297acf82d750de3f01be66044",
    "T16 original I1-E Wizard setup source blob drift");
  const t16Source=t16Raw.toString("utf8"),t16Setup=t16SetupRaw.toString("utf8");
  const t16OriginalInstaller=read("scripts/integration/c34/c34_original_wizard_finalizer_with_legacy_mirror_pg17.sql").toString("utf8");
  const t16Safe=read("scripts/integration/c34/c34_wizard_option_a_character_scoped_signature_candidate_pg17.sql").toString("utf8");
  for(const name of ["wizard_savant_school_v1","highest_spell_level_from_slots_v1","wizard_spellbook_has_spell_v1",
    "apply_wizard_signature_spell_ids_v1","materialize_player_forge_wizard_savant_for_character_v1",
    "materialize_player_forge_wizard_signature_for_character_v1","materialize_player_forge_wizard_final_v1"]){
    const begin=t16Source.indexOf("CREATE OR REPLACE FUNCTION private."+name+"(");
    const end=t16Source.indexOf("$function$;",begin);
    assert.ok(begin>=0&&end>begin,"T16 original Wizard source private function missing "+name);
    const exact=t16Source.slice(begin,end+"$function$;".length);
    assert.ok(t16OriginalInstaller.includes(exact),"T16 original Wizard function body drift: "+name);
    if(name==="apply_wizard_signature_spell_ids_v1"){
      const mirror="  update public.players p set sheet=v_sheet,updated_at=now()\n"+
        "  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);\n";
      assert.ok(exact.includes(mirror),"T16 exact original legacy account mirror absent");
      const scope=exact.replace(mirror,"  -- T16 Option A character-scoped projection only: no cross-account legacy\n"+
        "  -- players.sheet mirror; original source remains preserved in source archive.\n");
      assert.ok(t16Safe.includes(scope),"T16 Option A differs ONLY by original two-line account mirror removal");
      assert.ok(!scope.includes("  update public.players p set sheet="),"T16 scoped helper must not mirror accounts");
    }
  }
  const t16TriggerAt=t16Setup.indexOf("CREATE CONSTRAINT TRIGGER character_progression_materialize_player_forge_wizard_final_v1");
  const t16TriggerEnd=t16Setup.indexOf("-- Internal helpers",t16TriggerAt);
  assert.ok(t16TriggerAt>=0&&t16TriggerEnd>t16TriggerAt&&
    t16OriginalInstaller.includes(t16Setup.slice(t16TriggerAt,t16TriggerEnd)),
    "T16 original Wizard deferred event/handler/timing drift");
  for(const h of ["39cb0f3c7041e7d5f63538f03c6abb7f","84ff66ed7dcdeccc6593c05a6d24c4cb",
    "f902c2d45de3ae7b9c63132117fc99e0","c6d23dc8eccb824e9199ca027139a7da",
    "49594930f540d308b43ce00461462829","02395e9d544ef6d5d1e6e5436d080294",
    "3c71ad65cde45d74bef4ea63f25847ac"])
    assert.ok(t16OriginalInstaller.includes(h),"T16 original Wizard executable PG17 MD5 missing "+h);
  assert.ok(t16OriginalInstaller.includes("IF n<>27")&&t16OriginalInstaller.includes("IF n<>28")&&
    t16Safe.includes("position('update public.players' IN lower(d))>0")&&
    t16Safe.includes("DELIBERATELY NON-ORIGINAL"),
    "T16 original/Option A writer pre/post fences drift");
  const t16Cat=read("scripts/integration/c34/c34_wizard_source_savant_signature_specimen_pg17.sql").toString("utf8");
  for(const id of ["00000000-0000-0000-0000-000000008803","00000000-0000-0000-0000-000000008813",
    "00000000-0000-0000-0000-000000008814","00000000-0000-0000-0000-000000016001",
    "00000000-0000-0000-0000-000000016046"])
    assert.ok(t16Cat.includes(id),"T16 original/synthetic source test spell specimen ID drift "+id);
  assert.ok(t16Cat.includes("SYNTHETIC")&&/\b(?:NO|NOT) production\b/i.test(t16Cat)&&
    !t16Cat.includes("DROP VIEW public.spells_catalog_preferred"),
    "T16 reduced Wizard source must declare synthetic data and preserve T12 view");
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
 assert.equal(r.stagedOriginalCount,25,"C34 T16 expects 25/31 original DDL, 4 non-map progression+2 world");
 assert.equal(r.originalMissingCount,6);
 assert.equal(r.totalStaged,28);
 assert.equal(r.proposedCreatorSeedCount,1);
 assert.equal(r.downstreamGrantTriggerCount,5);
 console.log("PASS C34-31CENSUS T16: "+r.stagedOriginalCount+"/31 original trigger DDL + "+r.proposedPrivacyCount+
   " held NPC privacy triggers + "+r.proposedCreatorSeedCount+" held verified creator seed; "+r.originalMissingCount+" originals not staged. DDL is not full behavioral acceptance.");
}
