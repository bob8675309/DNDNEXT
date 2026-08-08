import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const requireToken = (source, token, label) => {
  if (!source.includes(token)) throw new Error(`Progression v3: ${label} is missing ${token}`);
};

execFileSync(process.execPath, [path.join(root, "scripts/validate_character_class_progression.mjs")], { stdio: "inherit" });

const ui = read("components/CharacterLevelUpChoices.js");
for (const token of [
  'supabase.rpc("get_character_level_class_choice_options_v1"',
  "classChoiceGroups",
  "classChoiceSelections",
  "sourceChoiceGroupsComplete",
  "class_choice_selections",
  'kicker="Class progression"',
  "loadingClassChoices",
]) requireToken(ui, token, "earned level-up class-choice UI");

const simple = read("sql/20260808_16_simple_class_choice_delta_authority.sql");
for (const token of [
  "simple_level_class_choice_groups_v1",
  "get_character_level_class_choice_options_v1",
  "apply_simple_level_class_choices_v1",
  "Fighting Style",
  "Scholar Expertise",
  "Primal Knowledge",
  "Deft Explorer Languages",
  "Blessed Strikes",
  "Elemental Fury",
  "character_option_grant_instances",
  "classFeatureChoices",
]) requireToken(simple, token, "simple class-choice authority");

const enable = read("sql/20260808_17_enable_simple_class_choice_level_up.sql");
for (const token of [
  "unsupported_level_choice_features_v1",
  "level_up_persistent_choice_gaps_v1",
  "complete_character_level_up_v3",
  "class_choice_selections",
  "class_choice_delta",
  "Metamagic +",
  "Eldritch Invocations +",
  "Mystic Arcanum level",
  "Magical Secrets spell access",
]) requireToken(enable, token, "v3 class-choice enablement and fail-closed remainder");

const delta = read("utils/characterClassChoiceDeltaPlan.js");
for (const token of [
  "buildClassChoiceLevelDeltaPlan",
  "classChoiceSelectionsFromAuthority",
  "mergeClassChoiceDeltaAuthority",
  "classChoiceDeltaGroups",
  "progressionReplacement",
  "eldritch-invocation",
  "metamagic",
  "mystic arcanum",
]) requireToken(delta, token, "shared class-choice delta planner");

console.log("Progression v3 class-choice UI, authority, delta planning, and fail-closed complex-choice boundary validated.");
