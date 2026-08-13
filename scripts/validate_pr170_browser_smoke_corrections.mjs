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
const embeddedSourceChoices = read("components/NpcForgeEmbeddedSourceChoices.js");
const backgroundMechanicsText = read("utils/backgroundMechanics.js");
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

for (const token of ["CASTING_ABILITY_KEYS", "castingAbilityField", "routeSpeciesCreationGroup", '"training"', '"spells"', "allowedCastingAbilities", "highest eligible final Intelligence, Wisdom, or Charisma"]) assert.ok(speciesRuntimeText.includes(token), `generic species choice routing missing ${token}`);
for (const token of ["identity.name === \"astral elf\"", "identity.source === \"AAG\"", "trait === \"astral trance\""]) assert.ok(speciesRuntimeText.includes(token), `Astral Trance generic Forge exclusion missing ${token}`);
for (const token of ["runtimeOwnedTraitChoice", 'species === "astral-elf"', 'source === "AAG"', 'trait === "astral-trance"', "if (runtimeOwnedTraitChoice(option, detail)) return []", "STRUCTURED_PERSISTENT_CHOICE_TRAITS", "omitChoiceCollections"]) assert.ok(speciesPresentationText.includes(token), `species presentation source-preservation guard missing ${token}`);
assert.ok(!speciesBonus.includes('placement="abilities" ownerType="feat"'), "Abilities must not resolve feat-owned nested source choices");
for (const token of ["Selected:", "Training → Feats & Class Abilities"]) assert.ok(speciesBonus.includes(token), `Species Bonus acknowledgement missing ${token}`);
for (const token of ["acquisitionOwnerType !== \"species-bonus\"", 'placement: "class"', 'resolverPlacement: "training"']) assert.ok(featRouting.includes(token), `Species Bonus feat routing missing ${token}`);

for (const token of ["SOURCE_PUBLICATION_ORDER", "EFA: 20251209", "TCE: 20201117", "const identity = normalizeSubclassName(group.name)"]) assert.ok(subclassesText.includes(token), `Subclass newest-source dedupe missing ${token}`);
for (const token of ["keepNestedDisclosureLocal", "onClick={keepNestedDisclosureLocal}", "onKeyDown={keepNestedDisclosureLocal}", "onListItemDetail", "listedItemClick", "class-feature-text__listed-option"]) assert.ok(classFeatureText.includes(token), `Class-list disclosure/detail routing missing ${token}`);
for (const token of ["publishListedOption", "model.resolveListedDetail", "onListItemDetail", "Detailed Guide levels can be opened and closed independently", "canonical catalogue descriptions and item cards"]) assert.ok(classGuide.includes(token), `Class-guide collapse/listed-option routing missing ${token}`);
for (const token of ["<details key={row.class_level}", "npc-forge-class-guide__level", "defaultOpen={Number(row.class_level) === model.currentLevel}", "npc-forge-class-guide__level-content"]) assert.ok(classGuide.includes(token), `independent class-level disclosure missing ${token}`);
for (const token of ["detailItems", "listedDetailCatalog", "canonicalItemDescription", "resolveListedDetail", 'from("items_catalog")', "listedLookupKeys", "strippedAvailability", "itemCard"]) assert.ok(classGuideModel.includes(token), `Class-guide canonical listed-detail model missing ${token}`);
for (const token of ['import ItemCard from "./ItemCard";', "canonicalItem", "feature?.metadata?.itemCard", "<ItemCard item={canonicalItem} />"]) assert.ok(classFeatureDock.includes(token), `canonical item-card presentation missing ${token}`);
for (const token of ["Listed Option", "parentFeatureName", "normalized class-option or canonical item catalogue"]) assert.ok(classFeatureDock.includes(token), `Class detail dock listed-option presentation missing ${token}`);

for (const token of ["backgroundFeatureTextForDisplay", "Consider customizing your spells", "ExpandedSpellList", 'from("spells_catalog")', "npc-forge-background-spell-name", "RuleCopy", 'label: "Languages"', "BackgroundSourceFallback", "featGroups", "toolGroups"]) assert.ok(context.includes(token), `Background integrated-choice/readability correction missing ${token}`);
for (const token of ["NpcForgeEmbeddedSourceChoices", "sourceChoiceGroupsForPlacement", "sourceChoiceGroupsNeedInput", "sourceGroupMatchesTrait", "trainingGroups", "spellGroups", "Resolved in Training", "Resolved in Spells", "<h2>{option.name}</h2>", 'field.kind === "spell" || field.kind === "skill"']) assert.ok(context.includes(token), `Species step ownership/routing presentation missing ${token}`);
for (const token of ["sourceChoiceGroupsHaveChoices", "sourceChoiceGroupsNeedInput", "sourceChoiceDisplayValue", "DropdownField", "ButtonField", "SelectedOptionDetail", "is-compact"]) assert.ok(embeddedSourceChoices.includes(token), `embedded source-choice renderer missing ${token}`);
for (const token of ["embeddedPlacement", 'placement === "species" || placement === "background"', "if (embeddedPlacement) return null", "second yellow panel"]) assert.ok(sourceChoiceDock.includes(token), `duplicate source-choice panel suppression missing ${token}`);
for (const token of ["supplementalBackgroundDetails", "flattenSupplementalText", "structuredRuleText", "tableLooksOptional", "normalized.push(detail)"]) assert.ok(backgroundMechanicsText.includes(token), `supplemental background detail extraction missing ${token}`);

for (const token of ["catalogueSummary", "futureUnlocks", "availableCount", "full canonical item text", "canonicalPoolCount"]) assert.ok(planHelperText.includes(token), `Artificer plan availability/detail model missing ${token}`);
for (const token of ["ArtificerPlanCatalogueStatus", "plans available at Artificer level", "Locked plans are shown here for progression planning only", "canonical items in this legal pool"]) assert.ok(sourceChoices.includes(token), `Artificer plan presentation missing ${token}`);
for (const token of ["createPortal", "currentForgePreview", ".npc-forge-preview", "previewTarget ? createPortal(fields, previewTarget) : fields"]) assert.ok(sourceChoiceDock.includes(token), `later-step right-rail source-choice routing missing ${token}`);

for (const token of ["character_sheets", "updated_at", "2500", "without broadening realtime database exposure"]) assert.ok(actionHook.includes(token), `Transient sheet refresh missing ${token}`);
assert.ok(!actionHook.includes("postgres_changes"), "sheet action refresh must not depend on an unpublished Realtime table");
for (const token of ['[aria-label="Spell resources and rests"]', 'label === "Short Rest" || label === "Long Rest"', "[200, 650, 1300, 2400]", 'from("character_sheets")', 'select("sheet,updated_at")', "onSheetUpdatedRef.current?.(data.sheet)"]) assert.ok(restSyncBridge.includes(token), `bounded post-Rest sheet sync missing ${token}`);
for (const forbidden of ["setInterval", "postgres_changes", "MapPageClient", "map_routes", "map_route_points", "advance_all_characters", "route_segment_progress"]) assert.ok(!restSyncBridge.includes(forbidden), `post-Rest bridge must not use ${forbidden}`);
for (const token of ['import CharacterSheetRestSyncBridge from "./CharacterSheetRestSyncBridge";', "<CharacterSheetRestSyncBridge characterId={characterId} onSheetUpdated={onSheetUpdated} />"]) assert.ok(astralPanel.includes(token), `always-mounted Rest sync bridge missing ${token}`);

for (const token of ['import { supabase } from "../utils/supabaseClient";', "resolveAdminAfterLogin", "Promise.race", "timeoutResult(1500)", "timeoutResult(1000)", 'void router.replace(isAdmin ? "/admin" : "/profile")']) assert.ok(login.includes(token), `login resilience missing ${token}`);
assert.ok(!login.includes("createClient("), "login page must use the shared Supabase singleton");

assert.ok(app.includes('import "../styles/character-forge-smoke-fixes.css";'), "smoke correction stylesheet is not loaded");
for (const token of ["npc-forge-body.is-player-mode.npc-forge-step-2", "overflow-y: auto", "npc-forge-class-feature-dock", "position: sticky", "height: auto", "npc-forge-rule-copy", "npc-forge-source-choice-group.is-required", "rgba(255, 255, 255, .82)", "npc-forge-background-spell-name", "#090c14", "z-index: 120"]) assert.ok(css.includes(token), `smoke correction CSS missing ${token}`);
assert.ok(!css.includes("npc-forge-step-2 > .npc-forge-workspace {\n  align-self: stretch;\n  height: 100%;"), "Class workspace must not cap sticky range at viewport height");

for (const protectedSource of [classFeatureText, classGuide, classGuideModel, classFeatureDock, context, embeddedSourceChoices, backgroundMechanicsText, planHelperText, sourceChoices, sourceChoiceDock, actionHook, restSyncBridge, astralPanel, login, speciesPresentationText, speciesRuntimeText, css]) {
  assert.ok(!/MapPageClient|map_routes|map_route_points|advance_all_characters|route_segment_progress/.test(protectedSource), "smoke correction crossed protected map/travel boundaries");
}

const { applySpeciesRuntimeChoiceAuthority } = await import(pathToFileURL(path.join(root, "utils/playerForgeSpeciesRuntimeChoices.js")).href);
const prematureAarakocra = applySpeciesRuntimeChoiceAuthority({
  species: { name: "Aarakocra", source: "MPMM" },
  groups: [{ id: "wind", ownerType: "species", label: "Wind Caller", placement: "species", fields: [{ id: "feature-ability", kind: "ability", options: [{ key: "int" }, { key: "wis" }, { key: "cha" }] }] }],
});
assert.equal(prematureAarakocra.length, 0, "Aarakocra must not show a standalone casting-ability prompt before Gust of Wind is level-eligible");
const activeFairyMagic = applySpeciesRuntimeChoiceAuthority({
  species: { name: "Fairy", source: "MPMM" },
  groups: [{ id: "fairy-magic", ownerType: "species", label: "Fairy Magic", placement: "species", fields: [{ id: "fixed-spell", kind: "spell", options: [{ key: "druidcraft" }] }, { id: "feature-ability", kind: "ability", options: [{ key: "int" }, { key: "wis" }, { key: "cha" }] }] }],
});
assert.equal(activeFairyMagic.length, 1, "Fairy Magic should remain available once a real spell grant is active");
assert.equal(activeFairyMagic[0].placement, "spells", "Fairy Magic spell resolution belongs on Spells");
assert.ok(!activeFairyMagic[0].fields.some((field) => field.kind === "ability"), "Fairy Magic must not retain a manual casting-stat field");
const fairyAllowed = activeFairyMagic[0].metadata?.allowedCastingAbilities || activeFairyMagic[0].fields.find((field) => field.kind === "spell")?.metadata?.allowedCastingAbilities;
assert.deepEqual(fairyAllowed, ["int", "wis", "cha"], "Fairy Magic must carry the automatic flexible casting pool to the Spells UI consumption boundary");
const centaurAffinity = applySpeciesRuntimeChoiceAuthority({
  species: { name: "Centaur", source: "MPMM" },
  groups: [{ id: "affinity", ownerType: "species", label: "Natural Affinity", placement: "species", fields: [{ id: "skills", kind: "skill", count: 1, options: [{ key: "nature" }, { key: "survival" }] }] }],
});
assert.equal(centaurAffinity.length, 1, "Centaur Natural Affinity must remain a required source choice");
assert.equal(centaurAffinity[0].placement, "training", "species skill proficiency choices belong in Training");
assert.equal(centaurAffinity[0].fields[0].kind, "skill", "Training-routed species proficiency must retain its skill identity");
const goliathAncestry = applySpeciesRuntimeChoiceAuthority({
  species: { name: "Goliath", source: "XPHB" },
  groups: [{ id: "giant", ownerType: "species", label: "Giant Ancestry", placement: "species", fields: [{ id: "ancestry", kind: "ancestry", options: [{ key: "cloud" }, { key: "fire" }] }] }],
});
assert.equal(goliathAncestry[0].placement, "species", "true ancestry decisions must remain on the Species step");
const prematureDeepGnome = applySpeciesRuntimeChoiceAuthority({
  species: { name: "Deep Gnome", source: "MPMM" },
  groups: [{ id: "gift", ownerType: "species", label: "Gift of the Svirfneblin", placement: "species", fields: [{ id: "ability", kind: "ability", options: [{ key: "int" }, { key: "wis" }, { key: "cha" }] }] }],
});
assert.equal(prematureDeepGnome.length, 0, "Deep Gnome must not show a standalone casting-ability prompt before its spell grant is active");
const activeDeepGnome = applySpeciesRuntimeChoiceAuthority({
  species: { name: "Deep Gnome", source: "MPMM" },
  groups: [{ id: "gift", ownerType: "species", label: "Gift of the Svirfneblin", placement: "species", fields: [{ id: "spell", kind: "spell", options: [{ key: "disguise-self" }] }, { id: "ability", kind: "ability", options: [{ key: "int" }] }] }],
});
assert.equal(activeDeepGnome.length, 1, "Deep Gnome source group must remain available once a real spell grant is active");
assert.equal(activeDeepGnome[0].placement, "spells", "active Deep Gnome magic belongs on the Spells step");
const astralTranceForgeGroups = applySpeciesRuntimeChoiceAuthority({
  species: { name: "Astral Elf", source: "AAG" },
  groups: [{ id: "trance", label: "Astral Trance", fields: [{ id: "skill", kind: "skill", options: [{ key: "athletics" }] }] }],
});
assert.equal(astralTranceForgeGroups.length, 0, "Astral Trance must remain a post-Long-Rest runtime choice, never a generic Forge source choice");

const { extractSpeciesTraitChoiceRules, extractSpeciesTraitDetails } = await import(pathToFileURL(path.join(root, "utils/speciesPresentation.js")).href);
const { buildSpeciesSourceChoiceGroups } = await import(pathToFileURL(path.join(root, "utils/playerForgeSpeciesChoices.js")).href);
const embeddedAstralTranceRules = extractSpeciesTraitChoiceRules({
  name: "Astral Elf",
  source: "AAG",
  traitDetails: [{ name: "Astral Trance", description: "Whenever you finish this trance, you gain proficiency in one skill of your choice and retain it until your next long rest." }],
});
assert.equal(embeddedAstralTranceRules.length, 0, "Astral Trance must not render an embedded CHOOSE control on the Species feature card");
const giantAncestryFixture = {
  id: "goliath-fixture",
  name: "Goliath",
  source: "XPHB",
  metadata: {
    traits: [{
      name: "Giant Ancestry",
      type: "entries",
      entries: [{
        type: "list",
        items: [
          { name: "Cloud's Jaunt (Cloud Giant)", type: "item", entries: ["As a Bonus Action, teleport up to 30 feet."] },
          { name: "Stone's Endurance (Stone Giant)", type: "item", entries: ["As a Reaction, reduce damage."] },
        ],
      }],
    }],
  },
};
const giantAncestryDetails = extractSpeciesTraitDetails(giantAncestryFixture.metadata);
assert.ok(!/Cloud's Jaunt|Stone's Endurance/.test(giantAncestryDetails[0].description), "Goliath selector options must not be duplicated into a flattened prose wall");
const giantAncestryGroups = buildSpeciesSourceChoiceGroups({ species: giantAncestryFixture, level: 1, spells: [] });
const giantAncestryGroup = giantAncestryGroups.find((group) => group.label === "Giant Ancestry");
assert.equal(giantAncestryGroup?.fields?.[0]?.options?.length, 2, "Goliath fixture must expose its structured ancestry choices");
assert.equal(giantAncestryGroup.fields[0].options[0].label, "Cloud's Jaunt (Cloud Giant)", "Goliath source option names must survive in the structured selector");
assert.match(giantAncestryGroup.fields[0].options[0].description, /teleport up to 30 feet/i, "Goliath selector must preserve each option's rule summary");
assert.equal(giantAncestryGroup.fields[0].options[1].label, "Stone's Endurance (Stone Giant)", "Goliath ancestry effects must remain individually labeled");

const { backgroundFeatureDetails } = await import(pathToFileURL(path.join(root, "utils/backgroundMechanics.js")).href);
const astralDrifterDetails = backgroundFeatureDetails({
  name: "Astral Drifter",
  source: "AAG",
  rawPayload: {
    entries: [
      { type: "entries", name: "Longevity", entries: ["You are 20d6 years older than you look, because you have spent that much time in the Astral Sea without aging."] },
      { type: "entries", name: "Feature: Divine Contact", data: { isFeature: true }, entries: ["You gain the Magic Initiate feat.", "Roll on the Divine Contact table to determine which deity you encountered, or choose one with your GM.", { type: "table", caption: "Divine Contact", rows: [[1, "A deity"]] }] },
    ],
  },
});
assert.ok(astralDrifterDetails.some((entry) => entry.name === "Longevity" && /20d6 years older/.test(entry.description)), "Astral Drifter Longevity must survive Forge presentation");
assert.ok(!astralDrifterDetails.some((entry) => /A deity/.test(entry.description)), "optional Divine Contact deity table must remain omitted from Forge prose");

const { buildBackgroundSourceChoiceGroups } = await import(pathToFileURL(path.join(root, "utils/playerForgeSourceChoices.js")).href);
const toolRows = [
  { item_name: "Smith's Tools", item_key: "smith-tools", item_type: "Tool", payload: { name: "Smith's Tools", source: "XPHB", type: "AT" } },
  { item_name: "Tinker's Tools", item_key: "tinker-tools", item_type: "Tool", payload: { name: "Tinker's Tools", source: "XPHB", type: "AT" } },
];
const artisanSourceGroups = buildBackgroundSourceChoiceGroups({ id: "artisan", name: "Artisan", source: "XPHB", metadata: { tools: [{ anyArtisansTool: 1 }] } }, toolRows);
assert.equal(artisanSourceGroups.length, 1, "Artisan should expose one background-owned Artisan's Tool choice group");
assert.equal(artisanSourceGroups[0].fields[0].kind, "tool", "Artisan background choice must remain a tool selection");
const astralLanguageGroups = buildBackgroundSourceChoiceGroups({ id: "astral-drifter", name: "Astral Drifter", source: "AAG", metadata: { tools: [], languages: [{ anyStandard: 2 }] } }, toolRows);
assert.equal(astralLanguageGroups.length, 1, "Astral Drifter should expose its two language choices from source data");
assert.equal(astralLanguageGroups[0].fields[0].kind, "language", "Astral Drifter source choice must remain language-owned");
assert.equal(astralLanguageGroups[0].fields[0].count, 2, "Astral Drifter must choose two languages");

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

console.log("PR #170 signed-in browser smoke corrections, including generic species skill/spell routing, structured ancestry selectors, automatic flexible casting, shared Class scrolling, opaque background spell help, integrated purple choices, canonical Artificer item cards, login completion, immediate Rest repaint, runtime-only Astral Trance, and protected-boundary checks, validated.");
