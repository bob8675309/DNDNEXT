#!/usr/bin/env node
// T42 source custody and negative mutations; signed helper test is separate.
import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const blob=p=>{const b=fs.readFileSync(path.join(root,p));return crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0"),b])).digest("hex");};
const migration="sql/20260808_18_metamagic_mystic_arcanum_progression.sql";
const original=read(migration);
const mirror="  update public.players p set sheet=v_sheet,updated_at=now() where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);";
test("T42-01 original Sorcerer/Warlock SQL and shared normalizer immutably sourced",()=>{
 assert.equal(blob(migration),"ce7d4ec3f37eeb0a29b8a07cd64609ee9627642f");
 assert.equal(blob("sql/20260808_16_simple_class_choice_delta_authority.sql"),"2e70facd2b5905bf85a63697ed0f895feb27aad5");
 assert.equal(blob("sql/20260806_00_player_forge_source_choice_foundation.sql"),
  "3df1c688ad4a23085c0cdde1a14da10bd77f4fec");
 assert.match(original,/private\.apply_additional_level_class_choices_v1/);
 assert.match(original,/private\.additional_level_class_choice_groups_v1/);
});
test("T42-02 original mirror includes read-only character permissions",()=>{
 assert.equal(original.split(mirror).length,2);
 assert.ok(!mirror.includes("cp.can_edit"));
 for(const word of ["classFeatureChoices","v_class_choices","'mystic-arcanum'","'metamagic'","requires exactly",
   "not source-legal","already selected","private.normalize_player_choice_name_v1"])
  assert.ok(original.includes(word),"missing original class choice behavior "+word);
});
test("T42-03 class choice path source UI to live v5-v3 to private",()=>{
 const ui=read("components/CharacterLevelUpChoices.js");
 const v5=read("scripts/fixtures/p1_3_levelup_v5_original_source_pg17.sql");
 const v3=read("sql/20260808_19_source_aware_level_up_spell_access.sql");
 assert.match(ui,/supabase\.rpc\("complete_character_level_up_v5"/);
 assert.match(ui,/class_choice_selections: classChoiceSelections/);
 assert.match(v5,/public\.complete_character_level_up_v3/);
 assert.match(v3,/private\.apply_additional_level_class_choices_v1/);
});
test("T42-04 older earned v5 does NOT assert Sorcerer options",()=>{
 const prev=read("scripts/test_p1_3_levelup_v5_real_jwt_local.mjs");
 const signed=read("scripts/integration/c34/test_t42_additional_class_choices_signed_pg17.mjs");
 // Original #364 I1-P is held on its own PR branch (blob 4c9a0935),
 // not copied into this C34 research tree; inherited P1.3 remains here.
 assert.match(prev,/Only featureless Fighter 1→2 tails/);
 assert.doesNotMatch(prev,/sorcerer-metamagic|Mystic Arcanum/);
 assert.match(signed,/C34_T42_SIGNED_CONFIRM/);
 assert.match(signed,/full earned-v5, Warlock and browser release HOLD/);
 assert.match(signed,/NOT a public earned-v5 transaction/);
});
test("T42-05 separate Option A removes only historical mirror in memory",()=>{
 const candidate=original.replace(mirror,"  -- T42 non-original account mirror omitted.");
 assert.notEqual(candidate,original);
 assert.doesNotMatch(candidate,/update public\.players p/);
 for(const word of ["update public.character_sheets","private.normalize_player_choice_name_v1",
  "insert into public.character_spells","v_count","v_serialized"])
  assert.ok(candidate.includes(word),"lost original class choice semantics: "+word);
});
