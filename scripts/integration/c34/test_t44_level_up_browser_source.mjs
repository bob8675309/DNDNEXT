#!/usr/bin/env node
// T44 read-only original runtime source custody. Behavior in separate signed
// P1.3 PG17 + actual Next/Chromium isolated browser workflow.
import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const blob=p=>{const b=fs.readFileSync(path.join(root,p));return crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0"),b])).digest("hex");};
const runtime="scripts/integration/c34/test_t44_level_up_signed_next_browser.mjs";
test("T44-01 current production Level Up component / selection field / parent original source blobs",()=>{
 for(const [p,hash] of [
  ["components/CharacterLevelUpChoices.js","3fa76acd1811a77b0c3e93711906bfb5afb17584"],
  ["components/SourceChoiceFields.js","31128be6bdded46542aea1b62f7ea3c78b6839a7"],
  ["components/CharacterInvocationRecovery.js","c58774853c6140981592fa84b9040c0fcb4a8c58"],
  ["components/CharacterClassPanel.js","d39d2bceab944d3d4ec42cc2cfda92609ce51a2b"],
  ["utils/supabaseClient.js","13b3339c4c99702bc667f1a1bc9b2ea36a70b18b"]
 ])assert.equal(blob(p),hash,p);
});
test("T44-02 actual production UI submits real v5 and has real source v2 fallback",()=>{
 const ui=read("components/CharacterLevelUpChoices.js");
 const parent=read("components/CharacterClassPanel.js");
 const source=read("components/SourceChoiceFields.js");
 assert.match(parent,/import CharacterLevelUpChoices from "\.\/CharacterLevelUpChoices";/);
 assert.match(parent,/<CharacterLevelUpChoices character={character} review={levelUpReview}/);
 assert.match(ui,/get_character_level_class_choice_options_v2/);
 assert.match(ui,/get_character_level_class_choice_options_v1/);
 assert.match(ui,/supabase\.rpc\("complete_character_level_up_v5"/);
 assert.match(ui,/class_choice_selections: classChoiceSelections/);
 assert.match(source,/field\.kind === "spell" \? <SourceSpellField/);
 assert.match(source,/prefersRichField\(field\)/);
});
test("T44-03 source original public v5 and three private account writers immutable",()=>{
 assert.equal(blob("scripts/fixtures/p1_3_levelup_v5_original_source_pg17.sql"),"b3168d0c9ec92ae1c0c389ccf55655209f2841f8");
 assert.equal(blob("sql/20260808_18_metamagic_mystic_arcanum_progression.sql"),"ce7d4ec3f37eeb0a29b8a07cd64609ee9627642f");
 const v=read("scripts/fixtures/p1_3_levelup_v5_original_source_pg17.sql");
 const classes=read("sql/20260808_18_metamagic_mystic_arcanum_progression.sql");
 assert.match(v,/private\.complete_character_level_up_base_v3/);
 assert.match(v,/private\.sync_player_forge_class_spell_summary_v1/);
 assert.match(classes,/private\.apply_additional_level_class_choices_v1/);
 assert.match(v,/update public\.players p set sheet = v_sheet/);
 assert.match(v,/update public\.players p set sheet=v_sheet/);
 assert.match(classes,/update public\.players p set sheet=v_sheet/);
});
test("T44-04 real browser and signed RPC, negative and local-only guard, no proxy",()=>{
 const run=read(runtime);
 for(const token of [
  "DNDNEXT_T44_SIGNED_BROWSER_CONFIRM",
  "__c34_t44_level_up_probe.jsx",
  'dynamic(()=>import("../components/CharacterLevelUpChoices"),{ssr:false})',
  'complete_character_level_up_v5',
  "PASS T44-ORIGINAL-UI-SORCERER-RED",
  "PASS T44-OPTION-A-UI-SORCERER",
  "PASS T44-OPTION-A-UI-WARLOCK",
  "PASS T44-UI-REVOKE",
  "PASS T44-UI-READONLY",
  "get_character_level_up_review_v1",
  "not fetched"
 ])assert.ok(run.toLowerCase().includes(token.toLowerCase()),"T44 behavior/provenance missing "+token);
 assert.doesNotMatch(run,/t42_local_additional_choice_probe_v1\("/);
 assert.match(run,/fs\.rmSync\(routePath\)/);
 assert.match(run,/source-original|ORIGINAL public v5/i);
});
test("T44-05 new signed Next workflow preserves exact F06-F28 AND T43",()=>{
 const yml=read(".github/workflows/validate-c34-t44-real-level-up-browser.yml");
 assert.match(yml,/scripts\/fixtures\/p1_3_levelup_v5_local_auth_pg17\.sql/);
 assert.match(yml,/scripts\/test_p1_3_levelup_v5_real_jwt_local\.mjs/);
 assert.match(yml,/scripts\/integration\/c34\/test_t43_earned_v5_signed_pg17\.mjs/);
 assert.match(yml,/scripts\/integration\/c34\/test_t44_level_up_signed_next_browser\.mjs/);
 assert.match(yml,/supabase@2\.120\.0 start/);
 assert.match(yml,/supabase@2\.120\.0 stop --no-backup/);
 assert.match(read(runtime),/--webpack/);
 assert.match(yml,/node --test scripts\/integration\/c34\/test_t44_level_up_browser_source\.mjs/);
 assert.match(read(runtime),/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
 assert.doesNotMatch(yml,/service_role|DATABASE_URL=|--linked|--remote|vercel deploy|merge/i);
});
