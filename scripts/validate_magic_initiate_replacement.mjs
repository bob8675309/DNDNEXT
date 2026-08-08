import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sql = fs.readFileSync(path.join(root, "sql/20260808_33_magic_initiate_level_replacement.sql"), "utf8");
const requireToken = (token, label) => {
  if (!sql.includes(token)) throw new Error(`Magic Initiate replacement: ${label} is missing ${token}`);
};
const forbidToken = (token, label) => {
  if (sql.includes(token)) throw new Error(`Magic Initiate replacement: ${label} must not contain ${token}`);
};

for (const [token, label] of [
  ["level_up_magic_initiate_replacement_groups_v1", "source-owned group builder"],
  ["apply_level_up_magic_initiate_replacements_v1", "source-owned replacement applier"],
  ["private.normalize_player_choice_name_v1(gi.option_name)=private.normalize_player_choice_name_v1('Magic Initiate')", "canonical feat-instance discovery"],
  ["cs.source_type='feat' and cs.source_key=v_instance.instance_key", "feat-instance spell ownership"],
  ["v_new_spell.level<>v_old_spell.level", "same-level server validation"],
  ["where lower(c)=v_list", "same-list server validation"],
  ["cs.id<>v_assignment_id and cs.spell_id=v_new_spell.id", "same-instance duplicate rejection"],
  ["update public.character_option_grant_instances", "normalized feat-instance authority update"],
  ["'{featGrantInstances}'", "sheet feat-instance authority update"],
  ["'replacementFeature','Magic Initiate'", "replacement provenance"],
  ["level_up_replacement_groups_v1", "v5 replacement catalogue integration"],
  ["apply_level_up_replacements_v1", "v5 replacement apply integration"],
  ["substr(md5(v_instance.instance_key),1,12)", "per-instance stable group identity"],
]) requireToken(token, label);

forbidToken("uses_remaining=1", "free-cast resource preservation");
forbidToken("uses_remaining = 1", "free-cast resource preservation");
forbidToken("replacement-magic-initiate|", "global rather than per-instance group identity");

console.log("Per-instance Magic Initiate same-level/same-list replacement authority validated.");
