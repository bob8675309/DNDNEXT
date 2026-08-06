import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const requireToken = (text, token, label) => { if (!text.includes(token)) throw new Error(`Character Forge resilience: ${label} is missing ${token}`); };
const forbidToken = (text, token, label) => { if (text.includes(token)) throw new Error(`Character Forge resilience: ${label} still contains ${token}`); };

const forge = read("components/NewNpcModalV3Refined.js");
const forgeController = read("components/useNpcForgeController.js");
const forgeDerived = read("components/useNpcForgeDerivedModel.js");
const forgeSteps = read("components/NpcForgeStepContent.js");
const forgeSource = `${forge}\n${forgeController}\n${forgeDerived}\n${forgeSteps}`;
const adapter = read("components/NewNpcModalV3.js");
const profile = read("components/PlayerCharacterProfilePanelUnified.js");
const portraits = read("components/NpcForgePortraitPickerModal.js");
const portraitUtils = read("utils/characterPortraits.js");
const ability = read("components/NpcForgeAbilityStep.js");
const speciesBonus = read("components/NpcForgeSpeciesBonusPanel.js");
const training = read("components/NpcForgeTrainingStep.js");
const spells = read("components/NpcForgeSpellStep.js");
const review = read("components/NpcForgeReviewPanel.js");
const rules = read("utils/playerForgeRules.js");
const classContext = read("components/NpcForgeClassChoiceContext.js");
const classGuide = read("components/NpcForgeClassGuide.js");
const classGuideModel = read("components/NpcForgeClassGuideModel.js");
const classDock = read("components/NpcForgeClassFeatureDock.js");
const context = read("components/NpcForgeContextPanelRefined.js");
const spellMigration = read("sql/20260805_02_player_forge_starting_spell_validation.sql");
const authorityMigration = read("sql/20260805_03_player_character_authority_hardening.sql");
const finalPolish = read("styles/character-forge-final-polish.css");
const app = read("pages/_app.js");

requireToken(forgeSource, 'mode = "npc"', "canonical Forge");
requireToken(forgeSource, "function handleReset()", "canonical Forge");
requireToken(forgeSource, "function handleClose() { if (creating) return; onClose?.(); }", "canonical Forge");
requireToken(forgeSource, "PLAYER_STEP_LABELS", "canonical Forge");
requireToken(forgeSource, "NpcForgeSpellStep", "canonical Forge");
requireToken(forgeSource, "NpcForgeReviewPanel", "canonical Forge");
requireToken(forgeSource, "spellChoicesForRpc", "canonical Forge");
requireToken(forgeSource, "Create Player Character", "canonical Forge");
requireToken(forgeSource, "playerMode ? [] : draft.additionalFeats || []", "player additional-feat authority");
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
for (const token of ["ForgeSubclassSelection", "cleanPlayerCopy", "npc-forge-class-guide__level-heading", "npc-forge-class-guide__hero-facts", "onFeatureDetail"]) requireToken(classGuide, token, "class guide");
for (const token of ["Class Feature", "Subclass Feature", "npc-forge-class-feature-dock"]) requireToken(classDock, token, "class feature card dock");
requireToken(forgeSteps, "NpcForgeClassFeatureDock", "class feature dock placement");
requireToken(forgeSteps, "NpcForgeSpeciesBonusPanel", "ability Species Bonus placement");
requireToken(context, "npc-forge-species-hero", "species hero composition");
requireToken(context, "npc-forge-species-facts", "species compact facts");
requireToken(context, "npc-forge-species-feature-list", "species expandable rules");
requireToken(context, "npc-forge-species-spell-help", "species spell hover details");
requireToken(context, 'from("spells_catalog")', "species spell hover source");
forbidToken(context, 'label: "Speed"', "species redundant flat rows");

for (const token of ["Ability Score Generation Method", "Standard 3d6", "4d6 drop lowest die", "Point Buy", "Standard Class Array", "Manual Assign", "Reroll All Six", "Species Bonus", "Choose a feat"]) requireToken(ability, token, "ability rules");
requireToken(speciesBonus, "npc-forge-species-bonus--context", "right-column Species Bonus");
for (const token of ["Background grants", "Training choices", "each uses one Training choice", "Campaign crafting house rule", "successful DC check", "properly deployed caravan workshop"]) requireToken(training, token, "training rules");
forbidToken(training, "Expertise is not self-assigned during creation", "player Training explanation");
for (const token of ['from("spells_catalog")', 'from("class_level_progression")', "validateStartingSpellSelections", "Selected only", "Prepared", "Starting spell requirements complete."]) requireToken(spells, token, "starting spells");
for (const token of ["Class Progression", "Starting Magic", "Training & Professions", "Campaign Status", "npc-forge-review-dossier"]) requireToken(review, token, "review dossier");
for (const token of ["POINT_BUY_BUDGET = 27", "POINT_BUY_MIN = 8", "POINT_BUY_MAX = 15", "spellChoicesForRpc"]) requireToken(rules, token, "player Forge rules");
for (const token of ["validate_player_forge_starting_spells_v1", "deferrable initially deferred"]) requireToken(spellMigration, token, "starting spell migration");
for (const token of ["guard_direct_character_authority_mutation_v1", "character_spells_direct_authority_guard_v1", "character_sheets_authority_fields_guard_v1", "validate_player_forge_authority_payload_v1", "character_progression_validate_player_forge_authority_v1"]) requireToken(authorityMigration, token, "player authority migration");

requireToken(portraits, "/\\.svg(?:$|[?#])/i", "portrait picker");
requireToken(portraitUtils, "defaultPortraitUrlForCharacter", "portrait fallback utility");
forbidToken(portraitUtils, ".svg", "portrait fallback utility");

requireToken(finalPolish, "Character Forge final acceptance polish", "final Forge stylesheet");
requireToken(finalPolish, ".npc-forge-context-card.is-species .npc-forge-species-hero", "species final composition");
requireToken(finalPolish, ".npc-forge-species-spell-help", "species spell hover polish");
requireToken(finalPolish, ".npc-forge-class-feature-dock", "class feature dock polish");
requireToken(finalPolish, ".npc-forge-roll-card.refined > strong", "dice readability polish");
requireToken(finalPolish, ".npc-forge-preview > .npc-forge-species-bonus--context", "ability Species Bonus placement polish");
requireToken(finalPolish, ".persistent-player-character-profile .profile-catalogue__admin-actions", "player-profile grant control suppression");
requireToken(finalPolish, ".npc-forge-spell-summary", "spell presentation polish");
requireToken(finalPolish, ".npc-forge-review-dossier__grid", "review presentation polish");
requireToken(app, 'import "../styles/character-forge-final-polish.css";', "application stylesheet import");
requireToken(app, 'import "../styles/player-profile-scroll-fix.css";', "profile scroll stylesheet preservation");

console.log("Character Forge persistence, species/class cards, ability/training rules, starting spells, review dossier, player authority, and raster authority validated.");
