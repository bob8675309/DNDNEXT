import assert from "node:assert/strict";
import fs from "node:fs";
const read=fs.readFileSync("sql/20261023_02_physical_specimen_read_model.sql","utf8");
const write=fs.readFileSync("sql/20261023_03_physical_specimen_guarded_actions.sql","utf8");
const need=(source,token)=>assert.ok(source.includes(token),`Missing Physical Specimen contract: ${token}`);
for(const k of [
  "private.physical_specimen_valid_benefit_keys_v1",
  "public.activate_character_physical_specimen_v1",
  "public.swap_character_physical_specimen_benefit_v1",
  "public.get_character_physical_specimen_effects_v1",
  "for update","clock_timestamp()",
  "private.can_manage_character_progression_v1",
  "private.character_active_encounter_v1",
  "v_latest_long_rest<=v_old_activated",
  "v_latest_long_rest>v_activated_at",
  "v_latest_short_rest<=v_row.replacement_anchor_at",
  "array_replace(v_old_keys,p_previous_key,p_next_key)",
  "array_agg(k.value order by k.ordinality)",
  "'activationMode','outside_encounter'",
  "'effectsIntegrated',false",
  "get_character_physical_specimen_v1(p_character_id)"
])need(write,k);
for(const k of ["count(distinct k.value)","cardinality(p_keys)","not exists(", "source_options_unavailable"]) need(write+read,k);
for(const prohibited of [
  "update public.character_sheets", "update public.character_progression",
  "update public.encounter_participants","update public.players",
  "create trigger", "alter table public", "MapPageClient",
  "advance_all_characters", "map_routes",
]) assert.ok(!write.toLowerCase().includes(prohibited.toLowerCase()),`Forbidden cross-system mutation: ${prohibited}`);
const a=write.match(/create or replace function/g)||[];
assert.equal(a.length,4);
assert.match(write,/grant execute on function public.activate_character_physical_specimen_v1(uuid,text[])/);
assert.match(write,/grant execute on function public.swap_character_physical_specimen_benefit_v1(uuid,text,text)/);
console.log("Physical Specimen guarded activation, rest swaps and non-destructive stat projection boundaries verified.");
