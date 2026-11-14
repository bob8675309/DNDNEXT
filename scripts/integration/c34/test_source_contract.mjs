#!/usr/bin/env node
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { auditSources, STAGES, RELEASE_BLOCKERS } from "./validate_source_contract.mjs";
import { verifyOriginalJointDependencies, ORIGINAL_JOINT_DEPENDENCIES } from "./validate_joint_fixture_blobs.mjs";
import { auditTriggerCoverage } from "./verify_original_trigger_coverage.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const load = (file) => fs.readFileSync(path.join(dir, "sources", file));

test("C34-S01 all six original Git blobs retain exact bytes, transaction metadata and contracts", () => {
  const report = auditSources(load);
  assert.equal(report.sourceIntegrity, "PASS");
  assert.equal(report.stageCount, 6);
  assert.equal(report.releaseBlocked, true);
  assert.equal(report.executableJointSqlEmitted, false);
  assert.equal(report.originalAppFilesChanged, false);
  assert.deepEqual(report.stages.map((s) => s.sourcePr), [324, 345, 345, 345, 324, 351]);
});

test("C34-N01 mutation of each original source is rejected, never silently accepted", () => {
  for (const stage of STAGES) {
    assert.throws(() => auditSources((file) => {
      const raw = load(file);
      return file === stage.file ? Buffer.concat([raw, Buffer.from("\n-- unauthorized drift\n")]) : raw;
    }), /original Git blob drift/, stage.id);
  }
});

test("C34-N02 missing source is rejected", () => {
  assert.throws(() => auditSources((file) => {
    if (file === "04_private_story_stage3.sql") throw new Error("missing original Story stage");
    return load(file);
  }), /missing original Story stage/);
});

test("C34-N03 release gating fails closed despite a successful static audit", () => {
  const result = spawnSync(process.execPath,
    [path.join(dir, "validate_source_contract.mjs"), "--release"],
    { encoding: "utf8", timeout: 15000 });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /RELEASE BLOCKED/);
  assert.match(result.stdout, /"sourceIntegrity": "PASS"/);
});

test("C34-N04 static gate must not misrepresent incomplete Option A or browser coverage", () => {
  const report = auditSources(load);
  assert.ok(RELEASE_BLOCKERS.some((item) => /22 untested/.test(item)));
  assert.ok(RELEASE_BLOCKERS.some((item) => /app-browser/.test(item)));
  assert.ok(RELEASE_BLOCKERS.some((item) => /31-trigger/.test(item)));
  assert.equal(report.releaseBlocked, true);
});

test("C34-N05 no production connection, schema writes or SQL execution in validator", () => {
  const code = fs.readFileSync(path.join(dir, "validate_source_contract.mjs"), "utf8");
  assert.doesNotMatch(code, /from ["'](?:pg|postgres|@supabase\/supabase-js|child_process)["']/);
  assert.doesNotMatch(code, /https?:\/\//);
  assert.doesNotMatch(code, /process\.env\.(?:DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY)/);
  assert.deepEqual(STAGES.map((s) => s.file), [
    "01_forge_immutable_intent.sql",
    "02_npc_profile_stage1.sql",
    "03_npc_dossier_stage2.sql",
    "04_private_story_stage3.sql",
    "05_inventory_constraint_rls.sql",
    "06_story_complete_nonce_i1c.sql",
  ]);
});

test("C34-S02 all operational original joint fixtures and candidate paths are byte-identical", () => {
  const e=verifyOriginalJointDependencies();
  assert.equal(e.length,33);
  assert.ok(e.some((x)=>x.file.includes("original_i1c_forge_private_story_nonce_local_auth")));
  assert.ok(e.some((x)=>x.file.endsWith("20261105_inventory_character_owner_constraint_and_dml_review_v1.sql")));
});

test("C34-N06 a tampered signed original fixture fails the same raw Git blob test", () => {
  const first=ORIGINAL_JOINT_DEPENDENCIES[0][0];
  const root=path.resolve(dir,"../../..");
  assert.throws(() => verifyOriginalJointDependencies((file)=>{
    const original=fs.readFileSync(path.join(root,file));
    return file===first ? Buffer.concat([original,Buffer.from("-- changed\n")]) : original;
  }), /signed fixture\/source drift/);
});

test("C34-T17-S01 original census counts 26/31 plus held 2 privacy and 1 creator seed", () => {
 const r=auditTriggerCoverage();
 assert.equal(r.originalTotal,31);
 assert.deepEqual(r.originalByTable,{
   character_progression:19,character_sheets:4,characters:6,inventory_items:2
 });
 assert.equal(r.stagedOriginalCount,26);
 assert.equal(r.originalMissingCount,5);
 assert.equal(r.proposedPrivacyCount,2);
 assert.equal(r.totalStaged,29);
 assert.equal(r.proposedCreatorSeedCount,1);
 assert.equal(r.downstreamGrantTriggerCount,5);
 assert.ok(!r.originalStaged.includes("characters_capture_creator_at_insert_v1"));
});

test("C34-T2-N01 mutated original census source is rejected", () => {
 const root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(file=>{
   const raw=fs.readFileSync(path.join(root,file));
   return file.includes("C34_ORIGINAL_31_TRIGGER_CENSUS_CAPTURE")
     ? Buffer.concat([raw,Buffer.from("\\n-- tampered\\n")]) : raw;
 }),/original 31-trigger census blob drift/);
});

test("C34-T2-N02 removing an original trigger from staged DDL reduces accepted coverage", () => {
 const root=path.resolve(dir,"../../..");
 const original=auditTriggerCoverage();
 const truncated=auditTriggerCoverage(file=>{
   const raw=fs.readFileSync(path.join(root,file));
   if(file!=="scripts/integration/c34/c34_five_original_sheet_character_triggers_pg17.sql") return raw;
   const source=raw.toString("utf8");
   const start=source.indexOf("CREATE TRIGGER characters_guard_player_tags_v1\n");
   const tail="EXECUTE FUNCTION private.guard_player_character_tag_update_v1();";
   const stop=source.indexOf(tail,start);
   assert.ok(start>0 && stop>start,"expected live-original trigger DDL in C34 fixture");
   const changed=source.slice(0,start)+"-- OMITTED ORIGINAL TRIGGER NEGATIVE\n"+source.slice(stop+tail.length);
   assert.notEqual(changed,raw.toString("utf8"));
   return Buffer.from(changed,"utf8");
 });
 assert.equal(original.stagedOriginalCount,26);
 assert.equal(truncated.stagedOriginalCount,25);
 assert.equal(truncated.originalMissingCount,6);
});

test("C34-T4-N03 changing original Fighter subclass BEFORE INSERT into AFTER INSERT fails closed", () => {
 const root=path.resolve(dir,"../../..");
 const fixture="scripts/integration/c34/c34_original_fighter_subclass_choice_pg17.sql";
 assert.throws(()=>auditTriggerCoverage(file=>{
   const original=fs.readFileSync(path.join(root,file));
   if(file!==fixture)return original;
   const source=original.toString("utf8");
   const before="BEFORE INSERT ON public.character_progression";
   assert.ok(source.includes(before),"original subtype trigger SQL is present");
   return Buffer.from(source.replace(before,"AFTER INSERT ON public.character_progression"),"utf8");
 }),/exact original Fighter subclass BEFORE INSERT event/);
});

test("C34-T5-N04 changing original deferred authority trigger to immediate fails closed", () => {
 const root=path.resolve(dir,"../../..");
 const adapter="scripts/integration/c34/c34_original_deferred_progression_authority_pg17.sql";
 assert.throws(()=>auditTriggerCoverage(file=>{
  const buf=fs.readFileSync(path.join(root,file));
  if(file!==adapter)return buf;
  const source=buf.toString("utf8");
  const from="DEFERRABLE INITIALLY DEFERRED FOR EACH ROW";
  assert.ok(source.includes(from));
  return Buffer.from(source.replace(from,"NOT DEFERRABLE FOR EACH ROW"),"utf8");
 }),/Timing\/deferral mismatch|exact original deferred progression authority event/);
});

test("C34-T5-N05 source-original preferred view rewrite fails closed", () => {
 const root=path.resolve(dir,"../../..");
 const adapter="scripts/integration/c34/c34_original_deferred_progression_authority_pg17.sql";
 assert.throws(()=>auditTriggerCoverage(file=>{
  const raw=fs.readFileSync(path.join(root,file));
  if(file!==adapter)return raw;
  const source=raw.toString("utf8");
  const from="WHEN o.option_type = 'species'::text";
  assert.ok(source.includes(from));
  return Buffer.from(source.replace(from,"WHEN o.option_type = 'unverified'::text"),"utf8");
 }),/preferred VIEW definitions drifted from held/);
});

test("C34-T6-N06 tampering with an original downstream grant hook is rejected", () => {
 const root=path.resolve(dir,"../../..");
 const p="scripts/fixtures/forge_feat_materializer_local_auth_extension_pg17.sql";
 assert.throws(()=>auditTriggerCoverage(file=>{
  const raw=fs.readFileSync(path.join(root,file));
  if(file!==p)return raw;
  const source=raw.toString("utf8");
  const trigger="CREATE TRIGGER character_option_grant_instance_cartomancer_v1";
  assert.ok(source.includes(trigger));
  return Buffer.from(source.replace(trigger,
    "CREATE TRIGGER character_option_grant_instance_malicious_replacement_v1"),"utf8");
 }),/Unexpected original grant-table trigger|missing original grant-table triggers/);
});

test("C34-T6-N07 wrong grant-table authorization guard cannot masquerade as original", () => {
 const root=path.resolve(dir,"../../..");
 const p="scripts/fixtures/forge_feat_materializer_local_auth_extension_pg17.sql";
 assert.throws(()=>auditTriggerCoverage(file=>{
  const raw=fs.readFileSync(path.join(root,file));
  if(file!==p)return raw;
  const source=raw.toString("utf8");
  const from="EXECUTE FUNCTION private.guard_direct_character_authority_mutation_v1();";
  assert.ok(source.includes(from));
  return Buffer.from(source.replace(from,
   "EXECUTE FUNCTION private.materialize_cartomancer_instance_v1();"),"utf8");
 }),/exact grant-table handler\/table mismatch/);
});

test("C34-T7-N08 provenance seed cannot be re-timed from BEFORE to AFTER INSERT", () => {
 const root=path.resolve(dir,"../../..");
 const p="sql/candidates/20261105_forge_progression_verified_creator_seed_v1.sql";
 assert.throws(()=>auditTriggerCoverage(file=>{
  const b=fs.readFileSync(path.join(root,file));
  if(file!==p)return b;
  const source=b.toString("utf8");
  const before="BEFORE INSERT ON public.character_progression";
  assert.ok(source.includes(before));
  return Buffer.from(source.replace(before,"AFTER INSERT ON public.character_progression"),"utf8");
 }),/verified creator candidate BEFORE INSERT event\/handler/);
});

test("C34-T7-N09 creator seed cannot trust attribution from another transaction", () => {
 const root=path.resolve(dir,"../../..");
 const p="sql/candidates/20261105_forge_progression_verified_creator_seed_v1.sql";
 assert.throws(()=>auditTriggerCoverage(file=>{
  const b=fs.readFileSync(path.join(root,file));
  if(file!==p)return b;
  const source=b.toString("utf8");
  const from="AND ca.recorded_at=transaction_timestamp()";
  assert.ok(source.includes(from));
  return Buffer.from(source.replace(from,"AND ca.recorded_at IS NOT NULL"),"utf8");
 }),/bind the trusted creator to the same transaction/);
});

test("C34-T7-N10 trusted creator seed is not a new uncounted original", () => {
 const r=auditTriggerCoverage();
 assert.equal(r.stagedOriginalCount,26);
 assert.equal(r.originalMissingCount,5);
 assert.equal(r.proposedPrivacyCount,2);
 assert.equal(r.proposedCreatorSeedCount,1);
 assert.equal(r.totalStaged,29);
 assert.equal(r.downstreamGrantTriggerCount,5);
});

test("C34-T8-N11 wrong trigger event fails closed", () => {
 const root=path.resolve(dir,"../../.."),file="scripts/integration/c34/c34_original_starting_magic_exactness_pg17.sql";
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));
  if(p!==file)return b;
  const text=b.toString("utf8");
  const target="AFTER INSERT OR UPDATE ON public.character_progression";
  assert.ok(text.includes(target));
  return Buffer.from(text.replace(target,"AFTER INSERT ON public.character_progression"));
 }),/T8 exact source deferred starting-magic trigger event drift/);
});
test("C34-T8-N12 mutated original handler fails closed", () => {
 const root=path.resolve(dir,"../../.."),file="scripts/integration/c34/c34_original_starting_magic_exactness_pg17.sql";
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));
  if(p!==file)return b;
  const text=b.toString("utf8"),target="Starting magic summary does not match authoritative starting spell rows.";
  assert.ok(text.includes(target));
  return Buffer.from(text.replace(target,"T8 bypassed original summary"));
 }),/T8 source-original starting-magic function body drift/);
});
test("C34-T8-N13 timing/deferral mutation fails closed", () => {
 const root=path.resolve(dir,"../../.."),file="scripts/integration/c34/c34_original_starting_magic_exactness_pg17.sql";
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));
  if(p!==file)return b;
  const text=b.toString("utf8"),target="DEFERRABLE INITIALLY DEFERRED FOR EACH ROW";
  assert.ok(text.includes(target));
  return Buffer.from(text.replace(target,"NOT DEFERRABLE FOR EACH ROW"));
 }),/Timing\/deferral mismatch|T8 exact source deferred starting-magic trigger event drift/);
});

test("C34-T9-N14 original nested trigger event-column list cannot drift", () => {
 const adapter="scripts/integration/c34/c34_original_nested_choice_dependency_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(file=>{
  const raw=fs.readFileSync(path.join(root,file));
  if(file!==adapter)return raw;
  const str=raw.toString("utf8");
  const old="AFTER INSERT OR UPDATE OF class_id, class_level, subclass_name, subclass_source, level_choices";
  assert.ok(str.includes(old));
  return Buffer.from(str.replace(old,"AFTER INSERT OR UPDATE OF class_id, class_level"));
 }),/T9 original deferred nested-choice trigger event\/handler drift/);
});
test("C34-T9-N15 nested deferred timing must not be made immediate", () => {
 const adapter="scripts/integration/c34/c34_original_nested_choice_dependency_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(file=>{
  const raw=fs.readFileSync(path.join(root,file));
  if(file!==adapter)return raw;
  const text=raw.toString("utf8"),from="DEFERRABLE INITIALLY DEFERRED FOR EACH ROW";
  assert.ok(text.includes(from));
  return Buffer.from(text.replace(from,"NOT DEFERRABLE FOR EACH ROW"));
 }),/T9 original deferred nested-choice trigger event\/handler drift|Timing\/deferral mismatch/);
});
test("C34-T9-N16 imported original handler source cannot be replaced", () => {
 const adapter="scripts/integration/c34/c34_original_nested_choice_dependency_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(file=>{
  const raw=fs.readFileSync(path.join(root,file));
  if(file!==adapter)return raw;
  const source=raw.toString("utf8"),from="\\i scripts/fixtures/forge_nested_choices_original_pg17.sql";
  assert.ok(source.includes(from));
  return Buffer.from(source.replace(from,"-- omitted original nested function"));
 }),/T9 must import the exact original nested-choice function/);
});
test("C34-T9-N17 original nested handler source change fails raw Git-blob pin", () => {
 const root=path.resolve(dir,"../../.."),source="scripts/fixtures/forge_nested_choices_original_pg17.sql";
 assert.throws(()=>auditTriggerCoverage(file=>{
  const raw=fs.readFileSync(path.join(root,file));
  if(file!==source)return raw;
  return Buffer.concat([raw,Buffer.from("\n-- intentional tampered source\n")]);
 }),/T9 original nested-choice function Git blob drift/);
});

test("C34-T10-N18 original starting-spells event columns cannot drift",()=>{
 const f="scripts/fixtures/forge_starting_spells_local_auth_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(file=>{
  const raw=fs.readFileSync(path.join(root,file));
  if(file!==f)return raw;
  const s=raw.toString("utf8");
  const a="AFTER INSERT OR UPDATE OF class_id, class_level ON public.character_progression";
  assert.ok(s.includes(a));
  return Buffer.from(s.replace(a,"AFTER INSERT OR UPDATE OF class_level ON public.character_progression"));
 }),/T10 original source-install fixture drift|T10 original deferred starting-spells trigger event\/handler drift/);
});
test("C34-T10-N19 original starting-spells deferred timing cannot become immediate",()=>{
 const f="scripts/fixtures/forge_starting_spells_local_auth_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(file=>{
  const raw=fs.readFileSync(path.join(root,file));
  if(file!==f)return raw;
  const s=raw.toString("utf8");
  const a="DEFERRABLE INITIALLY DEFERRED FOR EACH ROW";
  assert.ok(s.includes(a));
  return Buffer.from(s.replace(a,"NOT DEFERRABLE FOR EACH ROW"));
 }),/T10 original deferred starting-spells trigger event\/handler drift|Timing\/deferral mismatch/);
});
test("C34-T10-N20 imported original spell handler cannot be stubbed",()=>{
 const f="scripts/fixtures/forge_starting_spells_local_auth_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(file=>{
  const raw=fs.readFileSync(path.join(root,file));
  if(file!==f)return raw;
  const s=raw.toString("utf8"),a="\\i scripts/fixtures/forge_starting_spells_original_pg17.sql";
  assert.ok(s.includes(a));
  return Buffer.from(s.replace(a,"-- no source function"));
 }),/T10 original source-install fixture drift|T10 original live pg_get_functiondef MD5 and import required/);
});
test("C34-T10-N21 original live function source byte tamper fails closed",()=>{
 const f="scripts/fixtures/forge_starting_spells_original_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(file=>{
  const raw=fs.readFileSync(path.join(root,file));
  return file===f?Buffer.concat([raw,Buffer.from("\n-- tampered\n")]):raw;
 }),/T10 original starting-spells handler Git blob drift/);
});
test("C34-T10-N22 source-identified Wizard 2024 spell catalog tamper fails closed",()=>{
 const f="scripts/fixtures/forge_wizard_starting_spells_local_auth_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(file=>{
  const raw=fs.readFileSync(path.join(root,file));
  return file===f?Buffer.concat([raw,Buffer.from("\n-- altered Wizard source\n")]):raw;
 }),/T10 source-identified 2024 Wizard specimen drift/);
});

test("C34-T11-N23 original source-magic trigger must remain deferred",()=>{
 const f="scripts/integration/c34/c34_original_source_magic_materializer_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(file=>{
  const b=fs.readFileSync(path.join(root,file));
  if(file!==f)return b;
  const s=b.toString("utf8"),from="DEFERRABLE INITIALLY DEFERRED FOR EACH ROW";
  assert.ok(s.includes(from));
  return Buffer.from(s.replace(from,"NOT DEFERRABLE FOR EACH ROW"));
 }),/T11 original source-magic deferred trigger event\/handler drift|Timing\/deferral mismatch/);
});
test("C34-T11-N24 original source-magic materializer body cannot drift",()=>{
 const f="scripts/integration/c34/c34_original_source_magic_materializer_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(file=>{
  const b=fs.readFileSync(path.join(root,file));
  if(file!==f)return b;
  const s=b.toString("utf8"),from="Forge sourceChoices must be an object.";
  assert.ok(s.includes(from));
  return Buffer.from(s.replace(from,"C34 permissive source magic bypass"));
 }),/T11 source-original species\/feat magic handler body drifted/);
});
test("C34-T11-N25 original source-magic event/handler cannot be retargeted",()=>{
 const f="scripts/integration/c34/c34_original_source_magic_materializer_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(file=>{
  const b=fs.readFileSync(path.join(root,file));
  if(file!==f)return b;
  const s=b.toString("utf8"),from=" AFTER INSERT ON public.character_progression";
  assert.ok(s.includes(from));
  return Buffer.from(s.replace(from," AFTER UPDATE ON public.character_progression"));
 }),/T11 original source-magic deferred trigger event\/handler drift|Timing\/deferral mismatch/);
});
test("C34-T11-N26 original source-magic helper MD5 checks cannot be dropped",()=>{
 const f="scripts/integration/c34/c34_original_source_magic_materializer_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(file=>{
  const b=fs.readFileSync(path.join(root,file));
  if(file!==f)return b;
  const s=b.toString("utf8"),from="c9bc6081a43c52c44c1cf192886456df";
  assert.ok(s.includes(from));
  return Buffer.from(s.replaceAll(from,"00000000000000000000000000000000"));
 }),/T11 exact PG17 helper\/handler MD5 missing/);
});
test("C34-T11-N27 source-identified species/spell IDs cannot silently change",()=>{
 const f="scripts/integration/c34/c34_source_magic_astral_elf_specimen_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(file=>{
  const b=fs.readFileSync(path.join(root,file));
  if(file!==f)return b;
  const s=b.toString("utf8"),from="b466a340-f327-43e8-a4fe-c641f5fba2db";
  assert.ok(s.includes(from));
  return Buffer.from(s.replaceAll(from,"00000000-0000-0000-0000-000000000999"));
 }),/T11 source-identified reduced Astral Elf\/Astral Fire specimen changed/);
});

test("C34-T12-N28 original deferred cantrip event cannot be retargeted",()=>{
 const f="scripts/integration/c34/c34_original_species_replaceable_cantrip_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(file=>{
  const b=fs.readFileSync(path.join(root,file));
  if(file!==f)return b;
  const s=b.toString("utf8"),from="after insert on public.character_progression";
  assert.ok(s.includes(from));
  return Buffer.from(s.replace(from,"after update on public.character_progression"));
 }),/T12 exact original deferred cantrip trigger event\/handler drift|Timing\/deferral mismatch/);
});
test("C34-T12-N29 original trigger deferral cannot become immediate",()=>{
 const f="scripts/integration/c34/c34_original_species_replaceable_cantrip_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(file=>{
  const b=fs.readFileSync(path.join(root,file));
  if(file!==f)return b;
  const s=b.toString("utf8"),from="deferrable initially deferred";
  assert.ok(s.includes(from));
  return Buffer.from(s.replace(from,"not deferrable"));
 }),/T12 exact original deferred cantrip trigger event\/handler drift|Timing\/deferral mismatch/);
});
test("C34-T12-N30 original runtime table RLS must remain source-identical",()=>{
 const f="scripts/integration/c34/c34_original_species_replaceable_cantrip_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(file=>{
  const b=fs.readFileSync(path.join(root,file));
  if(file!==f)return b;
  const s=b.toString("utf8"),from="alter table public.character_runtime_feature_choices enable row level security;";
  assert.ok(s.includes(from));
  return Buffer.from(s.replace(from,"-- accidentally omitted RLS"));
 }),/T12 source-original runtime table\/RLS\/ACL drift/);
});
test("C34-T12-N31 live original private source fingerprint is required",()=>{
 const f="scripts/integration/c34/c34_original_species_replaceable_cantrip_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(file=>{
  const b=fs.readFileSync(path.join(root,file));
  if(file!==f)return b;
  const s=b.toString("utf8"),from="a09198d8e12df12371647fccd8479489";
  assert.ok(s.includes(from));
  return Buffer.from(s.replaceAll(from,"00000000000000000000000000000000"));
 }),/T12 original live function MD5 missing/);
});
test("C34-T12-N32 original High Elf cantrip identity cannot silently change",()=>{
 const f="scripts/integration/c34/c34_species_replaceable_cantrip_source_specimen_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(file=>{
  const b=fs.readFileSync(path.join(root,file));
  if(file!==f)return b;
  const s=b.toString("utf8"),from="5f62b543-f6ac-405f-baa8-1f196190ff35";
  assert.ok(s.includes(from));
  return Buffer.from(s.replaceAll(from,"00000000-0000-0000-0000-000000000999"));
 }),/T12 original source-identified species\/spell specimen drift/);
});

test("C34-T13-N33 held Eladrin original fixture SHA must remain exact",()=>{
 const file="scripts/integration/c34/sources/07_i1i_original_eladrin_season_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));
  return p===file?Buffer.concat([b,Buffer.from("\n-- tampered\n")]):b;
 }),/T13 held #357 original Eladrin fixture SHA drift/);
});
test("C34-T13-N34 original MPMM Eladrin trigger event cannot change",()=>{
 const file="scripts/integration/c34/c34_original_eladrin_season_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));
  if(p!==file)return b;
  const s=b.toString("utf8"),from=" AFTER INSERT ON public.character_progression";
  assert.ok(s.includes(from));
  return Buffer.from(s.replace(from," AFTER UPDATE ON public.character_progression"));
 }),/T13 original Eladrin deferred trigger event\/handler drift|Timing\/deferral mismatch/);
});
test("C34-T13-N35 original deferred Eladrin trigger must not become immediate",()=>{
 const file="scripts/integration/c34/c34_original_eladrin_season_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));
  if(p!==file)return b;
  const s=b.toString("utf8"),from=" DEFERRABLE INITIALLY DEFERRED";
  assert.ok(s.includes(from));
  return Buffer.from(s.replace(from," NOT DEFERRABLE"));
 }),/T13 original Eladrin deferred trigger event\/handler drift|Timing\/deferral mismatch/);
});
test("C34-T13-N36 original Eladrin projection body cannot be substituted",()=>{
 const file="scripts/integration/c34/c34_original_eladrin_season_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));
  if(p!==file)return b;
  const s=b.toString("utf8"),from="'{runtimeFeatures,eladrinSeason}'";
  assert.ok(s.includes(from));
  return Buffer.from(s.replace(from,"'{runtimeFeatures,inventedSeason}'"));
 }),/T13 original Eladrin function body drift/);
});
test("C34-T13-N37 original Eladrin live source MD5 pin required",()=>{
 const file="scripts/integration/c34/c34_original_eladrin_season_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));
  if(p!==file)return b;
  const s=b.toString("utf8"),from="b866a8dff88bbfe6fb2c4f6d4c102fee";
  assert.ok(s.includes(from));
  return Buffer.from(s.replaceAll(from,"00000000000000000000000000000000"));
 }),/T13 original Eladrin live function MD5 missing/);
});

test("C34-T14-N38 original held I1-J Git source must be byte-identical",()=>{
 const file="scripts/integration/c34/sources/08_i1j_original_khoravar_skill_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));
  return p===file?Buffer.concat([b,Buffer.from("\n-- injected source\n")]):b;
 }),/T14 held #358 original I1-J Khoravar raw source blob drift/);
});
test("C34-T14-N39 original Khoravar deferred trigger timing cannot become immediate",()=>{
 const file="scripts/integration/c34/c34_original_khoravar_skill_with_legacy_mirror_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));
  if(p!==file)return b;
  const s=b.toString("utf8"),from=" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW";
  assert.ok(s.includes(from));
  return Buffer.from(s.replace(from," NOT DEFERRABLE FOR EACH ROW"));
 }),/T14 original Khoravar deferred trigger event\/handler drift|Timing\/deferral mismatch/);
});
test("C34-T14-N40 original Khoravar materializer cannot be replaced by a permissive stub",()=>{
 const file="scripts/integration/c34/c34_original_khoravar_skill_with_legacy_mirror_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));
  if(p!==file)return b;
  const s=b.toString("utf8"),from="Khoravar Skill Versatility requires exactly one skill or tool proficiency.";
  assert.ok(s.includes(from));
  return Buffer.from(s.replace(from,"Khoravar accepts anything"));
 }),/T14 original Khoravar function body drift/);
});
test("C34-T14-N41 candidate may not re-enable cross-account players sheet writes",()=>{
 const file="scripts/integration/c34/c34_khoravar_option_a_character_scoped_projection_candidate_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));
  if(p!==file)return b;
  const s=b.toString("utf8"),from="  -- projection to the legacy account-wide players.sheet snapshot.";
  assert.ok(s.includes(from));
  return Buffer.from(s.replace(from,"  update public.players p set sheet=v_sheet;"));
 }),/T14 Option A helper must differ ONLY by explicit account mirror removal/);
});
test("C34-T14-N42 bypassing runtime no-mirror guard is rejected",()=>{
 const file="scripts/integration/c34/c34_khoravar_option_a_character_scoped_projection_candidate_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));
  if(p!==file)return b;
  const s=b.toString("utf8"),from="IF position('update public.players' in lower(v_helper))>0";
  assert.ok(s.includes(from));
  return Buffer.from(s.replace(from,"IF false"));
 }),/T14 candidate must be labeled non-original, guard no-mirror/);
});
test("C34-T14-N43 original source-identified skill/tool UUID is not substitutable",()=>{
 const file="scripts/integration/c34/c34_khoravar_source_skill_tool_specimen_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));
  if(p!==file)return b;
  const s=b.toString("utf8"),from="bd914b52-04de-4cf3-a0ca-0200c9930e06";
  assert.ok(s.includes(from));
  return Buffer.from(s.replaceAll(from,"00000000-0000-0000-0000-000000000999"));
 }),/T14 source XPHB skill\/tool specimen drift/);
});

test("C34-T15-N44 original Battle Master function source hash cannot change",()=>{
 const f="scripts/integration/c34/sources/09_i1f_original_battle_master_functions_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));
  return p===f?Buffer.concat([b,Buffer.from("\n-- tampered\n")]):b;
 }),/T15 original I1-F Battle Master function source blob drift/);
});
test("C34-T15-N45 BOTH original deferred Battle Master triggers required",()=>{
 const f="scripts/integration/c34/c34_original_battle_master_pair_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));
  if(p!==f)return b;
  const s=b.toString("utf8"),from=" AFTER UPDATE OF class_id,subclass_name,subclass_source,class_level,level_choices";
  assert.ok(s.includes(from));return Buffer.from(s.replace(from," AFTER DELETE"));
 }),/T15 BOTH original Battle Master deferred trigger events\/handlers required|Timing\/deferral mismatch/);
});
test("C34-T15-N46 original maneuver materializer rejects semantic stubs",()=>{
 const f="scripts/integration/c34/c34_original_battle_master_pair_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));
  if(p!==f)return b;
  const s=b.toString("utf8"),from="Battle Master maneuver choices must be distinct.";
  assert.ok(s.includes(from));return Buffer.from(s.replace(from,"Every maneuver accepted"));
 }),/T15 original Battle Master function body drift/);
});
test("C34-T15-N47 source-qualified original XPHB maneuver UUID cannot be replaced",()=>{
 const f="scripts/integration/c34/c34_original_battle_master_pair_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));
  if(p!==f)return b;
  const s=b.toString("utf8"),from="37457afe-5996-4502-9651-130d25c059e6";
  assert.ok(s.includes(from));return Buffer.from(s.replaceAll(from,"00000000-0000-0000-0000-000000000999"));
 }),/T15 source-identical 12 real original XPHB maneuver IDs\/rows required/);
});

test("C34-T16-N48 original held Wizard source blob cannot change",()=>{
 const f="scripts/integration/c34/sources/11_i1e_original_wizard_functions_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));
  return p===f?Buffer.concat([b,Buffer.from("\n-- injected\n")]):b;
 }),/T16 original I1-E Wizard function source blob drift/);
});
test("C34-T16-N49 original Wizard deferred trigger cannot be bypassed or retimed",()=>{
 const f="scripts/integration/c34/c34_original_wizard_finalizer_with_legacy_mirror_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));if(p!==f)return b;
  const s=b.toString("utf8"),from=" AFTER INSERT ON public.character_progression DEFERRABLE INITIALLY DEFERRED";
  assert.ok(s.includes(from));return Buffer.from(s.replace(from," AFTER UPDATE ON public.character_progression"));
 }),/T16 original Wizard deferred event\/handler\/timing drift|Timing\/deferral mismatch/);
});
test("C34-T16-N50 original Wizard savant chronology body must be exact",()=>{
 const f="scripts/integration/c34/c34_original_wizard_finalizer_with_legacy_mirror_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));if(p!==f)return b;
  const s=b.toString("utf8"),from="Savant spellbook selections must be distinct across every acquisition level.";
  assert.ok(s.includes(from));return Buffer.from(s.replace(from,"Always valid"));
 }),/T16 original Wizard function body drift/);
});
test("C34-T16-N51 Option A Wizard signature candidate cannot reintroduce linked account UPDATE",()=>{
 const f="scripts/integration/c34/c34_wizard_option_a_character_scoped_signature_candidate_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));if(p!==f)return b;
  const s=b.toString("utf8"),from="  -- players.sheet mirror; original source remains preserved in source archive.";
  assert.ok(s.includes(from));return Buffer.from(s.replace(from,"  update public.players p set sheet=v_sheet;"));
 }),/T16 Option A differs ONLY by original two-line account mirror removal/);
});

test("C34-T17-N52 original Artificer source blob is immutable",()=>{
 const f="scripts/integration/c34/sources/13_i1l_original_artificer_plans_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));
  return p===f?Buffer.concat([b,Buffer.from("\n-- source tamper\n")]):b;
 }),/T17 original I1-L Artificer full source blob drift/);
});
test("C34-T17-N53 original Artificer trigger event stays deferred AFTER INSERT",()=>{
 const f="scripts/integration/c34/c34_original_artificer_plans_with_legacy_mirror_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));if(p!==f)return b;
  const s=b.toString("utf8"),from=" AFTER INSERT ON public.character_progression DEFERRABLE INITIALLY DEFERRED";
  assert.ok(s.includes(from));return Buffer.from(s.replace(from," AFTER UPDATE ON public.character_progression"));
 }),/T17 source-original Artificer deferred trigger event\/handler drift|Timing\/deferral mismatch/);
});
test("C34-T17-N54 Option A cannot restore the legacy mirror",()=>{
 const f="scripts/integration/c34/c34_artificer_option_a_character_scoped_projection_candidate_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));if(p!==f)return b;
  const s=b.toString("utf8"),from="  -- All source-original validation, canonical sheet projection and locks remain.";
  assert.ok(s.includes(from));return Buffer.from(s.replace(from,
   "  update public.players p set sheet=v_sheet,updated_at=now();"));
 }),/T17 Option A projection must differ ONLY by original legacy mirror removal/);
});
test("C34-T17-N55 original source item and plan UUIDs cannot be invented",()=>{
 const f="scripts/integration/c34/c34_artificer_source_plan_catalog_specimen_pg17.sql",root=path.resolve(dir,"../../..");
 assert.throws(()=>auditTriggerCoverage(p=>{
  const b=fs.readFileSync(path.join(root,p));if(p!==f)return b;
  const s=b.toString("utf8"),from="8adeb0df-1434-41f3-8702-1e1e3e0b5da7";
  assert.ok(s.includes(from));return Buffer.from(s.replaceAll(from,"00000000-0000-0000-0000-000000000999"));
 }),/T17 original Artificer source\/class\/item UUID drift/);
});
