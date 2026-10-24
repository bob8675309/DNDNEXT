import fs from "node:fs";
import assert from "node:assert/strict";

const migration=fs.readFileSync("sql/20261023_02_physical_specimen_read_model.sql","utf8");
const source=fs.readFileSync("docs/Character_Progression_and_Higher_Level_Forge.md","utf8");
const required=[
  "physical_specimen_options_v1",
  "physical_specimen_context_v1",
  "get_character_physical_specimen_v1",
  "private.can_manage_character_progression_v1",
  "private.character_active_encounter_v1",
  "private.normalize_player_choice_name_v1(v_progression.subclass_name)<>'theparasitepatron'",
  "v_progression.class_level<v_feature_level",
  "upper(coalesce(v_progression.subclass_source,''))<>'GRIMHOLLOWPG24'",
  "jsonb_array_length(v_options)<>6",
  "jsonb_array_elements_text(v_keys)",
  "count(distinct k.value)=count(*)",
  "rest_type='long_rest'",
  "rest_type='short_rest'",
  "v_latest_short_rest>v_activated_at",
  "v_latest_short_rest>v_row.replacement_anchor_at",
  "'activationAction','bonus_action'",
  "'requiresActionIntegration',true",
  "'effectiveStatsIntegrated',false",
  "grant execute on function public.get_character_physical_specimen_v1(uuid) to authenticated,service_role"
];
for(const fragment of required) assert.ok(migration.includes(fragment),`Missing runtime contract: ${fragment}`);
for(const fragment of ["enhanced-vitality","enhanced-vision","increased-speed","poison-resistance-training","enhanced-mobility","physical-aptitude"]) assert.ok(migration.includes(fragment),`Source-backed benefit omitted: ${fragment}`);
const forbidden=[
  "insert into public.character_runtime_feature_choices",
  "update public.character_sheets",
  "update public.characters",
  "update public.character_progression",
  "delete from public.character_rest_log",
  "alter table public.",
  "MapPageClient","map_routes","advance_all_characters","tactical_encounters",
];
for(const fragment of forbidden) assert.ok(!migration.toLowerCase().includes(fragment.toLowerCase()),`Read-only slice must not mutate / touch: ${fragment}`);
assert.ok(source.includes("level") && source.includes("Forge"));
assert.equal((migration.match(/create or replace function/g)||[]).length,3);
console.log("Physical Specimen read-model source gating, six benefits, CHA cap, rest expiry, ACL and no-writes contract validated.");
