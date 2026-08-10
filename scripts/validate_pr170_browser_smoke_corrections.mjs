import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const migration = read("sql/20260810_90_rest_class_feature_restoration.sql");
const speciesRuntimeText = read("utils/playerForgeSpeciesRuntimeChoices.js");
const speciesPresentationText = read("utils/speciesPresentation.js");
const speciesBonus = read("components/NpcForgeSpeciesBonusPanel.js");
const featRouting = read("utils/playerForgeFeatChoiceRouting.js");
const subclassesText = read("utils/classes/subclassCompatibility.js");
const classFeatureText = read("components/ClassFeatureText.js");
const classGuide = read("components/NpcForgeClassGuide.js");
const classGuideModel = read("components/NpcForgeClassGuideModel.js");
const classFeatureDock = read("components/NpcForgeClassFeatureDock.js");
const context = read("components/NpcForgeContextPanelRefined.js");
const planHelperText = read("utils/artificerPlanChoices.js");
const sourceChoices = read("components/SourceChoiceFields.js");
const sourceChoiceDock = read("components/NpcForgeSourceChoiceFields.js");
const actionHook = read("hooks/useNpcSheetActionData.js");
const restSyncBridge = read("components/CharacterSheetRestSyncBridge.js");
const astralPanel = read("components/CharacterAstralTrancePanel.js");
const login = read("pages/login.js");
const app = read("pages/_app.js");
const css = read("styles/character-forge-smoke-fixes.css");

for (const token of [
  "restore_character_rest_action_state_v1",
  "v_class_source='XPHB' and p_rest_type='short_rest'",
  "v_next_remaining := least(v_max,v_remaining+1)",
  "elsif p_rest_type='long_rest'",
  "restoredClassFeatureUses",
  "v_action_result->'sheet'",
  "guard rejects the rest",
]) assert.ok(migration.includes(token), `migration 90 missing ${token}`);
assert.ok(!/insert\s+into\s+public\.encounter/i.test(migration), "migration 90 must not mutate encounter state");
assert.ok(!/MapPageClient|map_routes|map_route_points|advance_all_characters|weather|route_segment_progress/.test(migration), "migration 90 crossed protected map/travel boundaries");

for (const token of ["identity.name === \"deep gnome\"", "trait === \"gift of the svirfneblin\"", "!hasSpellField && onlyCastingAbility"]) assert.ok(speciesRuntimeText.includes(token), `Deep Gnome smoke guard missing ${token}`);
for (const token of ["identity.name === \"astral elf\"", "identity.source === \"AAG\"", "trait === \"astral trance\""]) assert.ok(speciesRuntimeText.includes(token), `Astral Trance generic Forge exclusion missing ${token}`);
for (const token of ["runtimeOwnedTraitChoice", 'species === "astral-elf"', 'source === "AAG"', 'trait === "astral-trance"', "if (runtimeOwnedTraitChoice(option, detail)) return []"]) assert.ok(speciesPresentationText.includes(token), `embedded Astral Trance choice exclusion missing ${token}`);
assert.ok(!speciesBonus.includes('placement="abilities" ownerType="feat"'), "Abilities must not resolve feat-owned nested source choices");
for (const token of ["Selected:", "Training → Feats & Class Abilities"]) assert.ok(speciesBonus.includes(token), `Species Bonus acknowledgement missing ${token}`);
for (const token of ["acquisitionOwnerType !== \"species-bonus\"", 'placement: "class"', 'resolverPlacement: "training"']) assert.ok(featRouting.includes(token), `Species Bonus feat routing missing ${token}`);

for (const token of ["SOURCE_PUBLICATION_ORDER", "EFA: 20251209", "TCE: 20201117", "const identity = normalizeSubclassName(group.name)"]) assert.ok(subclassesText.includes(token), `Subclass newest-source dedupe missing ${token}`);
for (const token of ["keepNestedDisclosureLocal", "onClick={keepNestedDisclosureLocal}", "onKeyDown={keepNestedDisclosureLocal}", "onListItemDetail", "listedItemClick", "class-feature-text__listed-option"]) assert.ok(classFeatureText.includes(token), `Class-list disclosure/detail routing missing ${token}`);
for (const token of ["publishListedOption", "model.resolveListedDetail", "onListItemDetail", "known plans/items use their canonical catalogue descriptions"]) assert.ok(classGuide.includes(token), `Class-guide listed-option detail routing missing ${token}`);
for (const token of ["detailItems", "listedDetailCatalog", "canonicalItemDescription", "resolveListedDetail", 'from("items_catalog")']) assert.ok(classGuideModel.includes(token), `Class-guide canonical listed-detail model missing ${token}`);
for (const token of ["Listed Option", "parentFeatureName", "normalized class-option or canonical item catalogue"]) assert.ok(classFeatureDock.includes(token), `Class detail dock listed-option presentation missing ${token}`);
for (const token of ["backgroundFeatureTextForDisplay", "Consider customizing your spells", "ExpandedSpellList", 'from("spells_catalog")', "npc-forge-background-spell-name"]) assert.ok(context.includes(token), `Background smoke correction missing ${token}`);

for (const token of ["catalogueSummary", "futureUnlocks", "availableCount", "full canonical item text", "canonicalPoolCount"]) assert.ok(planHelperText.includes(token), `Artificer plan availability/detail model missing ${token}`);
for (const token of ["ArtificerPlanCatalogueStatus", "plans available at Artificer level", "Locked plans are shown here for progression planning only", "canonical items in this legal pool"]) assert.ok(sourceChoices.includes(token), `Artificer plan presentation missing ${token}`);

for (const token of ["createPortal", "currentForgePreview", ".npc-forge-preview", "previewTarget ? createPortal(fields, previewTarget) : fields"]) assert.ok(sourceChoiceDock.includes(token), `right-rail source-choice routing missing ${token}`);

for (const token of ["character_sheets", "updated_at", "2500", "without broadening realtime database exposure"]) assert.ok(actionHook.includes(token), `Transient sheet refresh missing ${token}`);
assert.ok(!actionHook.includes("postgres_changes"), "sheet action refresh must not depend on an unpublished Realtime table");
for (const token of ['[aria-label="Spell resources and rests"]', 'label === "Short Rest" || label === "Long Rest"', "[200, 650, 1300, 2400]", 'from("character_sheets")', 'select("sheet,updated_at")', "onSheetUpdatedRef.current?.(data.sheet)"]) assert.ok(restSyncBridge.includes(token), `bounded post-Rest sheet sync missing ${token}`);
for (const forbidden of ["setInterval", "postgres_changes", "MapPageClient", "map_routes", "map_route_points", "advance_all_characters", "route_segment_progress"]) assert.ok(!restSyncBridge.includes(forbidden), `post-Rest bridge must not use ${forbidden}`);
for (const token of ['import CharacterSheetRestSyncBridge from "./CharacterSheetRestSyncBridge";', "<CharacterSheetRestSyncBridge characterId={characterId} onSheetUpdated={onSheetUpdated} />"]) assert.ok(astralPanel.includes(token), `always-mounted Rest sync bridge missing ${token}`);

for (const token of ['import { supabase } from "../utils/supabaseClient";', "resolveAdminAfterLogin", "Promise.race", "timeoutResult(1500)", "timeoutResult(1000)", 'void router.replace(isAdmin ? "/admin" : "/profile")']) assert.ok(login.includes(token), `login resilience missing ${token}`);
assert.ok(!login.includes("createClient("), "login page must use the shared Supabase singleton");

assert.ok(app.includes('import "../styles/character-forge-smoke-fixes.css";'), "smoke correction stylesheet is not loaded");
for (const token of ["npc-forge-class-feature-dock", "position: sticky", "rgba(255, 255, 255, .82)", "npc-forge-background-spell-name"]) assert.ok(css.includes(token), `smoke correction CSS missing ${token}`);

for (const protectedSource of [classFeatureText, classGuide, classGuideModel, classFeatureDock, context, planHelperText, sourceChoices, sourceChoiceDock, actionHook, restSyncBridge, astralPanel, login, speciesPresentationText, css]) {
  assert.ok(!/MapPageClient|map_routes|map_route_points|advance_all_characters|route_segment_progress/.test(protectedSource), "smoke correction crossed protected map/travel boundaries");
}

const { applySpeciesRuntimeChoiceAuthority } = await import(pathToFileURL(path.join(root, "utils/playerForgeSpeciesRuntimeChoices.js")).href);
const prematureDeepGnome = applySpeciesRuntimeChoiceAuthority({
  species: { name: "Deep Gnome", source: "MPMM" },
  groups: [{ id: "gift", label: "Gift of the Svirfneblin", fields: [{ id: "ability", kind: "ability", options: [{ key: "int" }, { key: "wis" }, { key: "cha" }] }] }],
});
assert.equal(prematureDeepGnome.length, 0, "Deep Gnome must not show a standalone casting-ability prompt before its spell grant is active");
const activeDeepGnome = applySpeciesRuntimeChoiceAuthority({
  species: { name: "Deep Gnome", source: "MPMM" },
  groups: [{ id: "gift", label: "Gift of the Svirfneblin", fields: [{ id: "spell", kind: "spell", options: [{ key: "disguise-self" }] }, { id: "ability", kind: "ability", options: [{ key: "int" }] }] }],
});
assert.equal(activeDeepGnome.length, 1, "Deep Gnome source group must remain available once a real spell grant is active");
const astralTranceForgeGroups = applySpeciesRuntimeChoiceAuthority({
  species: { name: "Astral Elf", source: "AAG" },
  groups: [{ id: "trance", label: "Astral Trance", fields: [{ id: "skill", kind: "skill", options: [{ key: "athletics" }] }] }],
});
assert.equal(astralTranceForgeGroups.length, 0, "Astral Trance must remain a post-Long-Rest runtime choice, never a generic Forge source choice");

const { extractSpeciesTraitChoiceRules } = await import(pathToFileURL(path.join(root, "utils/speciesPresentation.js")).href);
const embeddedAstralTranceRules = extractSpeciesTraitChoiceRules({
  name: "Astral Elf",
  source: "AAG",
  traitDetails: [{ name: "Astral Trance", description: "Whenever you finish this trance, you gain proficiency in one skill of your choice and retain it until your next long rest." }],
});
assert.equal(embeddedAstralTranceRules.length, 0, "Astral Trance must not render an embedded CHOOSE control on the Species feature card");

const { resolveSubclassCatalog } = await import(pathToFileURL(path.join(root, "utils/classes/subclassCompatibility.js")).href);
const duplicateSubclasses = resolveSubclassCatalog([
  { feature_type: "subclass", subclass_name: "Armorer", subclass_short_name: "Armorer", source: "TCE", class_source: "TCE", name: "Armorer", level: 3, description: "TCE intro", raw_payload: {} },
  { feature_type: "subclass", subclass_name: "Armorer", subclass_short_name: "Armorer", source: "TCE", class_source: "TCE", name: "Armor Model", level: 3, description: "TCE feature", raw_payload: { header: true } },
  { feature_type: "subclass", subclass_name: "Armorer", subclass_short_name: "Armorer", source: "EFA", class_source: "EFA", name: "Armorer", level: 3, description: "EFA intro", raw_payload: {} },
  { feature_type: "subclass", subclass_name: "Armorer", subclass_short_name: "Armorer", source: "EFA", class_source: "EFA", name: "Armor Model", level: 3, description: "EFA feature", raw_payload: { header: true } },
], "EFA");
assert.equal(duplicateSubclasses.length, 1, "same-name subclass reprints must be one player-facing option");
assert.equal(duplicateSubclasses[0].source, "EFA", "newest known same-name subclass source must win");

const { buildArtificerPlanSourceGroups } = await import(pathToFileURL(path.join(root, "utils/artificerPlanChoices.js")).href);
const plans = [
  { id: "p1", option_key: "p1", option_type: "artificer-plan", name: "Level Two Plan", source: "EFA", class_key: "artificer", repeatable: false, prerequisites: { minClassLevel: 2 }, choice_schema: {}, description: "available" },
  { id: "p2", option_key: "p2", option_type: "artificer-plan", name: "Level Ten Plan", source: "EFA", class_key: "artificer", repeatable: false, prerequisites: { minClassLevel: 10 }, choice_schema: {}, description: "future" },
];
const level2Plans = buildArtificerPlanSourceGroups({ selectedClass: { class_key: "artificer", source: "EFA" }, level: 2, optionRows: plans });
assert.equal(level2Plans.length, 4, "Artificer 2 retains four plan slots");
assert.equal(level2Plans[0].metadata.catalogueSummary.availableCount, 1, "availability summary must count only legal current-level plans");
assert.equal(level2Plans[0].metadata.catalogueSummary.totalCount, 2, "availability summary must retain full catalogue count");
assert.equal(level2Plans[0].metadata.catalogueSummary.futureUnlocks[0].unlockLevel, 10, "future plan must be disclosed at its actual unlock level");
assert.ok(level2Plans.every((group) => !group.fields[0].options.some((option) => option.key === "p2")), "future plan must remain non-selectable");

console.log("PR #170 signed-in browser smoke corrections, including login completion, immediate Rest repaint, runtime-only Astral Trance in both generic and embedded Species paths, right-rail source choices, and list-to-detail routing, validated.");
