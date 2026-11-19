#!/usr/bin/env node
// T43 static source-fidelity gate. Signed behavior is tested separately in
// a P1.3 DISPOSABLE PostgreSQL17 + real GoTrue/PostgREST workflow.
import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const gitBlob=p=>{const b=fs.readFileSync(path.join(root,p));return crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0"),b])).digest("hex");};
const original="scripts/fixtures/p1_3_levelup_v5_original_source_pg17.sql";
const chooser="sql/20260808_18_metamagic_mystic_arcanum_progression.sql";
const normalizer="sql/20260806_00_player_forge_source_choice_foundation.sql";
const simple="sql/20260808_16_simple_class_choice_delta_authority.sql";
const baseMirror=[
 "  update public.players p set sheet = v_sheet, updated_at = now()",
 "  where p.user_id in (",
 "    select cp.user_id from public.character_permissions cp where cp.character_id = p_character_id",
 "  );"
].join("\n");
const summaryMirror=[
 "  update public.players p set sheet=v_sheet,updated_at=now()",
 "  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);"
].join("\n");
const choiceMirror="  update public.players p set sheet=v_sheet,updated_at=now() where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);";
test("T43-01 immutable deployed-original public v5/v4/v3/base source and choice SQL blobs",()=>{
 assert.equal(gitBlob(original),"b3168d0c9ec92ae1c0c389ccf55655209f2841f8");
 assert.equal(gitBlob(chooser),"ce7d4ec3f37eeb0a29b8a07cd64609ee9627642f");
 assert.equal(gitBlob(normalizer),"3df1c688ad4a23085c0cdde1a14da10bd77f4fec");
 assert.equal(gitBlob(simple),"2e70facd2b5905bf85a63697ed0f895feb27aad5");
});
test("T43-02 three separately invoked actual original account-wide mirrors",()=>{
 const source=read(original),choice=read(chooser);
 assert.equal(source.split(baseMirror).length,2);
 assert.equal(source.split(summaryMirror).length,2);
 assert.equal(choice.split(choiceMirror).length,2);
 assert.ok(!choiceMirror.includes("can_edit"));
 for(const token of ["public.complete_character_level_up_v5","public.complete_character_level_up_v4",
  "public.complete_character_level_up_v3","private.complete_character_level_up_base_v3",
  "private.sync_player_forge_class_spell_summary_v1"])
   assert.ok(source.includes(token));
});
test("T43-03 genuine UI→v5→v4→v3→additional helper is routed",()=>{
 const ui=read("components/CharacterLevelUpChoices.js");
 const originalSource=read(original);
 const options=read(chooser);
 assert.match(ui,/supabase\.rpc\("complete_character_level_up_v5"/);
 assert.match(ui,/class_choice_selections: classChoiceSelections/);
 assert.match(originalSource,/public\.complete_character_level_up_v4\(p_character_id,v_forward_input-'replacement_selections'\)/);
 assert.match(originalSource,/public\.complete_character_level_up_v3\(p_character_id,v_v3_input\)/);
 assert.match(originalSource,/private\.apply_additional_level_class_choices_v1/);
 assert.match(options,/'warlock-mystic-arcanum-'/);
 assert.match(options,/on conflict\(character_id,spell_id,source_type,source_key\) do update/);
});
test("T43-04 new integration tests call original public v5, no helper proxy",()=>{
 const signed=read("scripts/integration/c34/test_t43_earned_v5_signed_pg17.mjs");
 for(const token of [
  "DNDNEXT_T43_SOURCE_V5_CONFIRM",
  'const level=(actor,id,choices)=>rpc(actor.who,"complete_character_level_up_v5"',
  "PASS T43-ORIGINAL-V5-SORCERER-RED",
  "PASS T43-ORIGINAL-V5-WARLOCK-RED",
  "PASS T43-OPTION-A-SORCERER",
  "PASS T43-OPTION-A-WARLOCK-REVOKE"
 ])assert.ok(signed.includes(token),"missing genuine signed v5 proof "+token);
 assert.doesNotMatch(signed,/t42_local_additional_choice_probe_v1/);
 assert.match(signed,/reduced synthetic fixtures/);
 assert.match(signed,/unrelated class or invocation replacement is not staged/);
 assert.match(signed,/IF k NOT IN \('sorcerer-metamagic','warlock-mystic-arcanum-6'\)/);
});
test("T43-05 three distinctly scoped Option A omissions, no production SQL",()=>{
 const signed=read("scripts/integration/c34/test_t43_earned_v5_signed_pg17.mjs");
 assert.ok(signed.includes("greenBase"));
 assert.ok(signed.includes("greenSummary"));
 assert.ok(signed.includes("greenAdditional"));
 assert.ok(signed.includes("for(const [f,md5] of expected)if(![base,summary].includes(f))fingerprint(f,md5)"));
 assert.match(signed,/NOT complete production class parity/);
});
test("T43-06 independent P1.3 inherited suite and local-only workflow",()=>{
 const workflow=read(".github/workflows/validate-c34-t43-original-earned-v5.yml");
 const originalRun=read("scripts/test_p1_3_levelup_v5_real_jwt_local.mjs");
 assert.match(originalRun,/PASS F28/);
 assert.match(workflow,/scripts\/test_p1_3_levelup_v5_real_jwt_local\.mjs/);
 assert.match(workflow,/scripts\/integration\/c34\/test_t43_earned_v5_signed_pg17\.mjs/);
 assert.match(workflow,/supabase@2\.120\.0 start/);
 assert.match(workflow,/supabase@2\.120\.0 stop --no-backup/);
 assert.match(workflow,/C34_T43|DNDNEXT_T43_SOURCE_V5_CONFIRM/);
 assert.doesNotMatch(workflow,/production|PRODUCTION_DATABASE_URL/i);
});
