import fs from "node:fs";

const migration = fs.readFileSync("sql/20260809_71_feat_runtime_expertise.sql", "utf8");
const normalization = fs.readFileSync("utils/featSourceChoiceNormalization.js", "utf8");
const runtime = fs.readFileSync("utils/characterRuntimeProficiencies.js", "utf8");
const panel = fs.readFileSync("components/CharacterFeatRuntimeExpertisePanel.js", "utf8");
const host = fs.readFileSync("components/CharacterCurrencyBadge.js", "utf8");

const need = (source, token) => { if (!source.includes(token)) throw new Error(`Missing feat runtime Expertise contract: ${token}`); };
const forbid = (source, token) => { if (source.includes(token)) throw new Error(`Forbidden feat runtime Expertise crossover: ${token}`); };

for (const token of [
  'featName === "echoing soul"',
  'id: "echoing-skills"',
  'count: 2',
  'id: "echoing-language"',
  'kind: "language"',
  'id: "echoing-expertise"',
  'kind: "runtime-expertise"',
  'replacementCadence: "long_rest"',
  'runtimeFeature: "echoing-soul-expertise"',
  '"Common Sign Language"',
  '"Thieves\' Cant"',
  '"Undercommon"',
]) need(normalization, token);

for (const token of [
  "'skillProficiencies',jsonb_build_array(jsonb_build_object('any',2))",
  "'languageProficiencies',jsonb_build_array(jsonb_build_object('any',1))",
  "'expertise',jsonb_build_array(jsonb_build_object('anyProficientSkill',1))",
  "phb_additional_language_options_v1",
  "feat_runtime_expertise_family_v1",
  "echoing-soul-expertise:",
  "zhentarim-tactics-expertise:",
  "character_effective_proficient_skill_options_v1",
  "sync_feat_runtime_expertise_projection_v1",
  "materialize_feat_runtime_expertise_instance_v1",
  "Zhentarim Tactics does not grant Expertise until a Long Rest is completed.",
  "Echoing Soul requires exactly two skill proficiency choices.",
  "Echoing Soul requires one additional Player''s Handbook language.",
  "Echoing Soul requires one initial Expertise choice.",
  "character_rest_log_expire_zhentarim_tactics_expertise_v1",
  "new.rest_type<>'long_rest'",
  "delete from public.character_runtime_feature_choices",
  "get_character_feat_runtime_expertise_v1",
  "configure_character_feat_runtime_expertise_v1",
  "character_active_encounter_v1",
  "Finish a Long Rest after gaining Zhentarim Tactics before choosing Expertise.",
  "Finish a newer Long Rest before changing Echoing Soul Expertise.",
  "runtimeProficiencies,featExpertise",
  "revoke all on function public.get_character_feat_runtime_expertise_v1(uuid) from public,anon",
  "revoke all on function public.configure_character_feat_runtime_expertise_v1(uuid,text,text) from public,anon",
]) need(migration, token);

for (const token of [
  "featRuntimeExpertiseStates",
  "applyRuntimeExpertise",
  "if (!current || current.proficient !== true) return;",
  "expertise: true",
  "runtimeExpertiseSources",
]) need(runtime, token);

for (const token of [
  "get_character_feat_runtime_expertise_v1",
  "configure_character_feat_runtime_expertise_v1",
  "Echoing Soul",
  "Zhentarim Tactics",
  "This Expertise lasts until your next Long Rest.",
]) need(panel, token);

for (const token of [
  'import CharacterFeatRuntimeExpertisePanel from "./CharacterFeatRuntimeExpertisePanel";',
  '<CharacterFeatRuntimeExpertisePanel characterId={characterId} />',
]) need(host, token);

need(normalization, 'kind: "energy-resistance"');
forbid(normalization, 'kind: "damage-type", count: 2');
forbid(normalization, 'kind: "expertise", count: 1, required: true, options: skillOptions');

for (const source of [migration, normalization, runtime, panel, host]) {
  for (const token of ["MapPageClient", "map_routes", "advance_all_characters", "player_wallets"]) forbid(source, token);
}
for (const token of [
  "insert into public.inventory_items",
  "update public.encounter_participants",
  "insert into public.encounter_participants",
  "Retaliate action",
  "Intrusive Echoes action",
]) forbid(migration, token);

console.log("Echoing Soul permanent acquisition + persistent Long-Rest Expertise, Zhentarim post-rest expiring Expertise, additive sheet projection, ACLs, and protected boundaries validated.");
