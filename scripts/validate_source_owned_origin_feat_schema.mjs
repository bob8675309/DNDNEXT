import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const requireToken = (source, token, label) => {
  if (!source.includes(token)) throw new Error(`Source-owned Origin feat schema: ${label} is missing ${token}`);
};
const forbidToken = (source, token, label) => {
  if (source.includes(token)) throw new Error(`Source-owned Origin feat schema: ${label} must not contain ${token}`);
};

const repair = read("sql/20260808_32_repair_source_owned_origin_feat_grant_schema.sql");
for (const token of [
  "apply_source_owned_origin_feat_v1",
  "gi.option_id=p_option_id",
  "character_option_grants(character_id,option_id,notes,granted_by)",
  "character_option_grant_instances(",
  "option_id,option_key,option_type,option_name,option_source",
  "acquisition_level,acquisition_owner_type,acquisition_owner_key,acquisition_label",
  "choices,effects,fixed_spell_tokens,repeatable,granted_by,updated_at",
]) requireToken(repair, token, "forward repair migration");

for (const token of [
  "option_catalog_id",
  "source_note",
  "acquired_level",
]) forbidToken(repair, token, "forward repair migration");

const source = read("sql/20260808_24_source_owned_origin_feat_authority.sql");
requireToken(source, "apply_source_owned_origin_feat_v1", "historical source-owned feat authority");

console.log("Modern source-owned Origin feat grant schema validated.");
