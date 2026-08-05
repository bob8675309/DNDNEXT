import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const requireToken = (text, token, label) => { if (!text.includes(token)) throw new Error(`Character Forge resilience: ${label} is missing ${token}`); };
const forbidToken = (text, token, label) => { if (text.includes(token)) throw new Error(`Character Forge resilience: ${label} still contains ${token}`); };

const forge = read("components/NewNpcModalV3Refined.js");
const forgeController = read("components/useNpcForgeController.js");
const forgeSteps = read("components/NpcForgeStepContent.js");
const forgeSource = `${forge}\n${forgeController}\n${forgeSteps}`;
const adapter = read("components/NewNpcModalV3.js");
const profile = read("components/PlayerCharacterProfilePanelUnified.js");
const portraits = read("components/NpcForgePortraitPickerModal.js");
const portraitUtils = read("utils/characterPortraits.js");
const ability = read("components/NpcForgeAbilityStep.js");
const training = read("components/NpcForgeTrainingStep.js");
const spells = read("components/NpcForgeSpellStep.js");
const review = read("components/NpcForgeReviewPanel.js");
const rules = read("utils/playerForgeRules.js");
const classContext = read("components/NpcForgeClassChoiceContext.js");
const classGuide = read("components/NpcForgeClassGuide.js");
const classGuideModel = read("components/NpcForgeClassGuideModel.js");
const context = read("components/NpcForgeContextPanelRefined.js");
const spellMigration = read("sql/20260805_02_player_forge_starting_spell_validation.sql");

requireToken(forgeSource, 'mode = "npc"', "canonical Forge");
requireToken(forgeSource, "function handleReset()", "canonical Forge");
requireToken(forgeSource, "function handleClose() { if (creating) return; onClose?.(); }", "canonical Forge");
requireToken(forgeSource, "PLAYER_STEP_LABELS", "canonical Forge");
requireToken(forgeSource, "NpcForgeSpellStep", "canonical Forge");
requireToken(forgeSource, "NpcForgeReviewPanel", "canonical Forge");
requireToken(forgeSource, "spellChoicesForRpc", "canonical Forge");
requireToken(forgeSource, "Create Player Character", "canonical Forge");
forbidToken(forgeSource, "function handleClose() { if (creating) return; resetForm();", "canonical Forge");

requireToken(adapter, "useRef", "shared player adapter");
requireToken(adapter, 'supabase.rpc("create_player_character_v2"', "shared player adapter");
requireToken(adapter, "p_spell_choices: spellChoices", "shared player adapter");
requireToken(adapter, "payloadWithSubclass", "shared player adapter");
requireToken(adapter, "NpcForgeClassChoiceContext.Provider", "shared player adapter");
forbidToken(adapter, "p_spell_choices: []", "shared player adapter");
forbidToken(adapter, "supabase.rpc =", "shared player adapter");
forbidToken(adapter, "MutationObserver", "shared player adapter");

requireToken(profile, "persistent-player-character-forge", "profile host");
requireToken(profile, "persistent-player-character-profile", "profile host");
requireToken(profile, "key={sessionUser.id}", "profile host account isolation");
requireToken(profile, "is-forge-suspended", "profile host");

requireToken(classContext, "classChoiceStateComplete", "class choice context");
requireToken(classContext, "eligibleSubclassOptions", "class choice context");
requireToken(`${classGuide}\n${classGuideModel}`, 'from("class_level_progression")', "class guide model");
requireToken(classGuide, "ForgeSubclassSelection", "class guide");
requireToken(classGuide, "cleanPlayerCopy", "class guide formatting sanitation");
requireToken(classGuide, "npc-forge-class-guide__level-heading", "class guide level separation");
requireToken(context, "npc-forge-species-hero", "species hero composition");
requireToken(context, "npc-forge-species-facts", "species compact facts");
forbidToken(context, 'label: "Speed"', "species redundant flat rows");

for (const token of ["Ability Score Generation Method", "Standard 3d6", "Point Buy", "Species Bonus"]) requireToken(ability, token, "ability rules");
for (const token of ["Expertise is not self-assigned", "Campaign crafting house rule", "Short or Long Rest"]) requireToken(training, token, "training rules");
for (const token of ['from("spells_catalog")', "validateStartingSpellSelections", "Selected only"]) requireToken(spells, token, "starting spells");
for (const token of ["Class Progression", "Starting Magic", "Campaign Status"]) requireToken(review, token, "review dossier");
for (const token of ["POINT_BUY_BUDGET = 27", "POINT_BUY_MIN = 8", "POINT_BUY_MAX = 15"]) requireToken(rules, token, "point buy rules");
for (const token of ["validate_player_forge_starting_spells_v1", "deferrable initially deferred"]) requireToken(spellMigration, token, "starting spell migration");

requireToken(portraits, "/\\.svg(?:$|[?#])/i", "portrait picker");
requireToken(portraitUtils, "defaultPortraitUrlForCharacter", "portrait fallback utility");
forbidToken(portraitUtils, ".svg", "portrait fallback utility");

console.log("Character Forge persistence, species/class presentation, ability/training rules, starting spells, review dossier, and raster authority validated.");
