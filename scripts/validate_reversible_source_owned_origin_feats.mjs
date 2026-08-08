import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const source = fs.readFileSync(path.join(root, "sql/20260808_34_reversible_source_owned_origin_feats.sql"), "utf8");
const need = (token, label = token) => {
  if (!source.includes(token)) throw new Error(`Reversible source-owned Origin feat authority is missing ${label}.`);
};
const forbid = (token, label = token) => {
  if (source.includes(token)) throw new Error(`Reversible source-owned Origin feat authority must not contain ${label}.`);
};

for (const token of [
  "other_character_option_effect_claim_v1",
  "apply_source_owned_origin_feat_v1",
  "remove_source_owned_origin_feat_v1",
  "'skill-proficiency'",
  "'tool-proficiency'",
  "'weapon-proficiency'",
  "'tough-hit-points'",
  "'feat-spell-source'",
  "'introduced',not v_preexisting",
  "ownerInstanceKey",
  "source_type='feat' and source_key=p_instance_key",
  "currently supports Expertise",
  "greatest(1,v_current_level)",
  "least(v_hp,v_new_max)",
  "gi.instance_key<>coalesce(p_exclude_instance_key,'')",
  "delete from public.character_option_grant_instances",
  "delete from public.character_option_grants",
  "entry.value->>'instanceId'<>p_instance_key",
]) need(token);

forbid("set uses_remaining=1", "free-cast refresh during removal");
forbid("delete from public.character_spells\n      where character_id=p_character_id and spell_id", "spell deletion by spell identity instead of feat source identity");

console.log("Reversible source-owned Origin feat ownership and removal contracts validated.");
