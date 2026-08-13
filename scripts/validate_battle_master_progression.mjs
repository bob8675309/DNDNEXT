import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const catalog = fs.readFileSync(path.join(root, "sql/20260808_38_normalize_battle_master_maneuvers_and_guard_gaps.sql"), "utf8");
const progression = fs.readFileSync(path.join(root, "sql/20260808_39_battle_master_maneuver_progression.sql"), "utf8");
const need = (source, token, label = token) => {
  if (!source.includes(token)) throw new Error(`Battle Master progression is missing ${label}.`);
};
const forbid = (source, token, label = token) => {
  if (source.includes(token)) throw new Error(`Battle Master progression must not contain ${label}.`);
};

for (const token of [
  "class_feature_catalog:Maneuver Options",
  "jsonb_path_query(f.entries,'$.**.optionalfeature')",
  "'battle-master-maneuver'",
  "array['MV:B']::text[]",
  "'identityOnly',true",
  "Expected 20 distinct XPHB Battle Master maneuver references",
  "Expected 20 canonical XPHB Battle Master maneuver options",
  "battle_master_maneuver_count_v1",
  "when greatest(1,least(20,coalesce(p_level,1)))>=15 then 9",
  ">=10 then 7",
  ">=7 then 5",
  ">=3 then 3",
]) need(catalog, token);
forbid(catalog, "Ambush", "hard-coded maneuver names");
forbid(catalog, "level_up_persistent_choice_gaps_base_v1", "subclass-blind Fighter gap override");

for (const token of [
  "battle_master_maneuver_slot_level_v1",
  "is_xphb_battle_master_v1",
  "materialize_player_forge_battle_master_maneuvers_v1",
  "validate_existing_battle_master_maneuvers_v1",
  "character_progression_materialize_battle_master_maneuvers_v1",
  "after insert on public.character_progression",
  "character_progression_validate_battle_master_maneuvers_v1",
  "after update of class_id,subclass_name,subclass_source,class_level,level_choices",
  "level_up_battle_master_maneuver_group_v1",
  "fighter-battle-master-maneuvers",
  "conditionalSubclass",
  "Battle Master only — choose 3 maneuvers",
  "New Battle Master maneuvers",
  "Maneuver to replace",
  "Replacement maneuver",
  "distinctFromFieldId','maneuvers'",
  "apply_level_up_battle_master_maneuvers_v1",
  "exactly % new maneuver choice(s)",
  "The replacement maneuver must be different from the newly learned maneuvers",
  "lastReplacementLevel",
  "previousOptionKey",
  "battle-master-maneuver-slot-",
  "fighter-xphb-battle-master-3-maneuver-options-0",
  "'kind','battle-master-maneuver'",
  "v_battle_master:=private.level_up_battle_master_maneuver_group_v1",
  "v_battle_summary:=private.apply_level_up_battle_master_maneuvers_v1",
  "v_forward_class jsonb:=v_all_class-'warlock-invocation-replacement'-'fighter-battle-master-maneuvers'",
  "v_result:=public.complete_character_level_up_v4",
  "battle_master_maneuvers",
  "grant execute on function public.complete_character_level_up_v5",
]) need(progression, token);

forbid(progression, "option_type='battle-master-maneuver' and source='XPHB' and name in (", "hard-coded maneuver catalogue");
forbid(progression, "level_up_persistent_choice_gaps_base_v1", "subclass-blind Battle Master gap logic");
forbid(progression, "grant execute on function public.complete_character_level_up_v4(uuid,jsonb) to authenticated", "authenticated v4 completion bypass");

const applyIndex = progression.indexOf("v_battle_summary:=private.apply_level_up_battle_master_maneuvers_v1");
const v4Index = progression.indexOf("v_result:=public.complete_character_level_up_v4");
if (applyIndex < 0 || v4Index < 0 || applyIndex >= v4Index) throw new Error("Battle Master maneuvers must materialize before the delegated v4 level transition.");

console.log("Battle Master source-derived maneuver catalogue, Forge normalization, earned additions/replacement, and v5 transaction contracts validated.");
