import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const requireText = (content, needle, label) => {
  if (!content.includes(needle)) throw new Error(`${label}: missing ${JSON.stringify(needle)}`);
};
const forbidText = (content, needle, label) => {
  if (content.includes(needle)) throw new Error(`${label}: forbidden stale text ${JSON.stringify(needle)}`);
};

const migration = read("sql/20260808_63_species_rest_proficiency_runtime.sql");
const aclCleanup = read("sql/20260808_64_species_rest_proficiency_acl_cleanup.sql");
const forgeHelper = read("utils/playerForgeSpeciesRuntimeChoices.js");
const registrar = read("components/NpcForgeFeatChoiceRegistrar.js");
const runtimePanel = read("components/CharacterSpeciesRestProficiencyPanel.js");
const sheetPanel = read("components/CharacterSheetPanel.js");
const projection = read("utils/characterRuntimeProficiencies.js");

requireText(migration, "coalesce(ep.is_defeated,false)=false", "migration encounter guard");
forbidText(migration, "ep.defeated", "migration encounter guard");
requireText(migration, "private.character_has_species_source_v1(p_character_id,'Githyanki','MPMM')", "Githyanki source authority");
requireText(migration, "private.character_has_species_source_v1(p_character_id,'Khoravar','EFA')", "Khoravar source authority");
requireText(migration, "private.character_has_species_source_v1(new.character_id,'Khoravar','EFA')", "Khoravar Forge materializer source authority");
forbidText(migration, "'Khoravar','MPMM'", "Khoravar source authority");
requireText(migration, "character_rest_log_expire_githyanki_astral_knowledge_v1", "Githyanki Long-Rest expiry trigger");
requireText(migration, "character_progression_materialize_player_forge_khoravar_skill_versatility_v1", "Khoravar deferred Forge materializer");
requireText(migration, "grant execute on function public.get_character_githyanki_astral_knowledge_v1(uuid) to authenticated,service_role", "Githyanki getter ACL");
requireText(migration, "grant execute on function public.configure_character_khoravar_skill_versatility_v1(uuid,text) to authenticated,service_role", "Khoravar configure ACL");

for (const signature of [
  "public.get_character_githyanki_astral_knowledge_v1(uuid)",
  "public.configure_character_githyanki_astral_knowledge_v1(uuid,text,uuid)",
  "public.get_character_khoravar_skill_versatility_v1(uuid)",
  "public.configure_character_khoravar_skill_versatility_v1(uuid,text)",
]) {
  requireText(aclCleanup, `revoke all on function ${signature} from anon;`, `explicit anon revoke ${signature}`);
  requireText(aclCleanup, `revoke all on function ${signature} from public;`, `PUBLIC revoke ${signature}`);
}
requireText(aclCleanup, "grant execute on function public.get_character_githyanki_astral_knowledge_v1(uuid) to authenticated,service_role", "authenticated Githyanki getter grant");
requireText(aclCleanup, "grant execute on function public.configure_character_khoravar_skill_versatility_v1(uuid,text) to authenticated,service_role", "authenticated Khoravar configure grant");

requireText(forgeHelper, "import { SKILL_DEFINITIONS }", "canonical skill-key source");
requireText(forgeHelper, "buildToolOptionCatalog(toolRows).all.map", "Khoravar tool catalogue");
requireText(forgeHelper, "identity.name === \"githyanki\" && identity.source === \"MPMM\" && trait === \"astral knowledge\"", "Githyanki persistent-choice suppression");
requireText(forgeHelper, "identity.name === \"khoravar\" && identity.source === \"EFA\" && trait === \"skill versatility\"", "Khoravar persistent-choice suppression");
requireText(forgeHelper, "source: \"EFA\"", "Khoravar source-owned Forge group");
forbidText(forgeHelper, "identity.name === \"khoravar\" && identity.source === \"MPMM\"", "Khoravar Forge source");

requireText(registrar, "applySpeciesRuntimeChoiceAuthority", "Forge registrar runtime-choice integration");
requireText(registrar, "groups: baseSpeciesGroups", "Forge registrar base Species groups");
requireText(registrar, "toolRows: controller?.toolRows || []", "Forge registrar tool catalogue forwarding");

requireText(runtimePanel, "identity.name === \"khoravar\" && identity.source === \"EFA\"", "Khoravar sheet panel source");
forbidText(runtimePanel, "identity.name === \"khoravar\" && identity.source === \"MPMM\"", "Khoravar sheet panel source");
requireText(runtimePanel, "configure_character_githyanki_astral_knowledge_v1", "Githyanki sheet command");
requireText(runtimePanel, "configure_character_khoravar_skill_versatility_v1", "Khoravar sheet command");

requireText(sheetPanel, "import CharacterSpeciesRestProficiencyPanel", "Species runtime sheet mount import");
requireText(sheetPanel, "<CharacterSpeciesRestProficiencyPanel", "Species runtime sheet mount");

requireText(projection, "githyankiAstralKnowledgeRuntimeState", "Githyanki projection state");
requireText(projection, "khoravarSkillVersatilityRuntimeState", "Khoravar projection state");
requireText(projection, "runtimeProficiency: marker", "additive runtime skill projection");
requireText(projection, "hasRuntimeWeaponProficiency", "runtime weapon proficiency helper");
requireText(projection, "hasRuntimeToolProficiency", "runtime tool proficiency helper");
requireText(projection, "metadata?.skillKey", "canonical Khoravar skill key projection");

console.log("Species rest proficiency runtime and explicit anonymous ACL cleanup validation passed.");
