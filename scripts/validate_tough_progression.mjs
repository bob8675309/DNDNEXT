import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const requireToken = (source, token, label) => {
  if (!source.includes(token)) throw new Error(`Tough progression: ${label} is missing ${token}`);
};
const forbidToken = (source, token, label) => {
  if (source.includes(token)) throw new Error(`Tough progression: ${label} must not contain ${token}`);
};

for (const rel of [
  "sql/20260808_25_tough_progression_bonus.sql",
  "sql/20260808_31_fix_tough_progression_acquisition_level.sql",
]) {
  const sql = read(rel);
  requireToken(sql, "character_option_grant_instances", rel);
  requireToken(sql, "gi.acquisition_level", rel);
  requireToken(sql, "apply_tough_progression_bonus_v1", rel);
  forbidToken(sql, "gi.acquired_level", rel);
}

const v4 = read("sql/20260808_27_earned_subclass_choice_progression.sql");
const v5 = read("sql/20260808_30_safe_level_up_replacements.sql");
requireToken(v4, "apply_tough_progression_bonus_v1", "v4 completion hook");
requireToken(v5, "complete_character_level_up_v4", "v5 delegates to v4 transactionally");

console.log("Tough progression acquisition-level schema contract validated.");
