import fs from "node:fs";
import path from "node:path";
import { speciesArtworkFor } from "../utils/speciesArtwork.js";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const entry = read("components/NewNpcModal.js");
const wrapper = read("components/NewNpcModalV2.js");
const forge = read("components/NewNpcModalV2Refined.js");
const forgeControls = read("components/CharacterForgeControls.js");
const wrapperV3 = read("components/NewNpcModalV3.js");
const forgeV3 = read("components/NewNpcModalV3Refined.js");
const portraitPicker = read("components/NpcForgePortraitPickerModal.js");
const storyGenerator = read("utils/npcStoryGenerator.js");
const visualAssetMigration = read("sql/20260725_02_portrait_sprite_asset_foundation.sql");
const contextWrapper = read("components/NpcForgeContextPanel.js");
const context = read("components/NpcForgeContextPanelRefined.js");
const catalogWrapper = read("utils/npcForgeCatalog.js");
const catalog = read("utils/npcForgeCatalogRefined.js");
const mechanicsWrapper = read("utils/backgroundMechanics.js");
const mechanics = read("utils/backgroundMechanicsRefined.js");
const neutralization = read("utils/backgroundNeutralization.js");
const importer = read("scripts/import_5etools_character_options_refined.mjs");
const styles = read("styles/npc-forge-v2.css");
const backgrounds = read("utils/backgroundPresentation.js");
const migration = read("sql/20260724_04_resolve_background_copy_catalog.sql");
const visibilityMigration = read("sql/20260725_01_character_option_visibility.sql");
const characterOptionsAdmin = read("pages/admin/character-options.js");
const mapClient = read("components/MapPageClient.js");
const speciesPreference = [
  read("sql/20260721_01_prefer_playable_species_sources.sql"),
  read("sql/20260723_01_consolidate_species_catalog.sql"),
  read("sql/20260724_01_remove_gith_parent_species.sql"),
].join("\n");

function requireTokens(text, tokens, label) {
  for (const token of tokens) if (!text.includes(token)) throw new Error(`${label} validation failed: missing ${token}`);
}
function requirePatterns(text, patterns, label) {
  for (const pattern of patterns) if (!pattern.test(text)) throw new Error(`${label} validation failed: missing pattern ${pattern}`);
}

requireTokens(entry, ["NewNpcModalV3", "props.onClose?.()", "NPC roster refresh after creation failed"], "NPC Forge entry");
requireTokens(wrapperV3, [
  "NewNpcModalV3Refined",
  "NpcForgeSpeciesChoiceContext.Provider",
  "blockIncompleteSpeciesChoice",
  "persistSpeciesChoices(created, snapshot)",
], "NPC Forge v3 wrapper");
requireTokens(forgeV3, [
  '"Species", "Background", "Class", "Abilities", "Training", "Identity", "Story", "Review"',
  "NpcForgePortraitPickerModal",
  "portraitLibraryId",
  "visualAssetId",
  "creationRequestId",
  "creation_request_id",
  "recoverCreatedCharacter",
  "You can safely retry",
  "Choose a portrait for this character.",
  "Generate NPC story &amp; world fit",
  "identity: { name: draft.name, role: draft.role, affiliation: draft.affiliation",
  "spriteAsset: selection.spriteAsset || null",
  'supabase.rpc("create_character_v1"',
], "NPC Forge v3 creator");
requirePatterns(forgeV3, [/step\s*===\s*5[\s\S]*Identity/, /step\s*===\s*6[\s\S]*Story/], "NPC Forge identity/story order");
requireTokens(portraitPicker, [
  'from("npc_portrait_library")',
  'from("npc_visual_assets")',
  "portraitLibraryId",
  "visualAssetId",
  "sprite_format",
  "direction_order",
], "NPC Forge portrait picker");
requireTokens(storyGenerator, ["identity?.locationId", "identity?.role", "identity?.affiliation", "identity?.tags", "explicitLocation"], "NPC story identity context");
requireTokens(visualAssetMigration, [
  "create table if not exists public.npc_visual_assets",
  "portrait_library_id uuid not null references public.npc_portrait_library",
  "eight_direction_idle_walk_v1",
  "array['down','down-left','left','up-left','up','up-right','right','down-right']",
  "creation_request_id uuid",
  "characters_creation_request_id_uidx",
  "visual_asset_id uuid references public.npc_visual_assets",
  "create or replace function public.create_character_v1",
], "portrait-linked sprite asset migration");

requireTokens(mapClient, [
  'import MapSprite from "./MapSprite";',
  'import { EIGHT_DIRECTION_ORDER, spriteDirectionFromVelocity } from "../utils/spriteAnimation";',
  'sprite_format: "eight_direction_idle_walk_v1"',
  "frame_width: 64",
  "frame_height: 64",
  "walk_frames: [1, 2, 3]",
  "fps: 7",
  "const hasSprite = !!m.visual_asset_id && !!m.sprite_path;",
  "const hasSprite = !!n.visual_asset_id && !!n.sprite_path;",
  "asset={MAP_SPRITE_ASSET}",
  "mapSpriteDirFromVelocity",
], "unified eight-direction map sprite contract");
for (const forbidden of [
  "SPRITE_FRAME_W",
  "SPRITE_FRAME_H",
  "SPRITE_FRAMES_PER_DIR",
  "SPRITE_DIR_ORDER",
  "function spriteDirFromVelocity(",
  "legacy_4dir",
  "LEGACY_MAP_SPRITE_ASSET",
]) {
  if (mapClient.includes(forbidden)) throw new Error(`unified eight-direction map sprite contract validation failed: legacy token ${forbidden}`);
}

requireTokens(wrapper, [
  "NewNpcModalV2Refined",
  "allowRerollWithoutBrowserDialog",
  'button.textContent?.trim() !== "Reroll all six"',
  "npc-forge-context-row-details",
  "npc-forge-context-choice-grid.feats",
  "npc-forge-section:has(> .npc-forge-roll-pool)",
  "npc-forge-ability-drop-grid",
], "NPC Forge v2 compatibility wrapper");
requireTokens(contextWrapper, ["NpcForgeContextPanelRefined"], "NPC Forge context wrapper");
requireTokens(forge, [
  '"Species", "Background", "Class", "Abilities"',
  "backgroundSkillChoices",
  "toggleBackgroundSkill",
  "backgroundFeatOptions",
  "onToggleBackgroundSkill",
  "onSelectBackgroundFeat",
  "npc-forge-ability-drop-grid",
  'supabase.rpc("create_character_v1"',
  "backgroundExpandedSpells",
  "backgroundSpellList",
  "speciesSource: selectedSpecies?.source",
  "backgroundSource: selectedBackground?.source",
  'from("character_option_catalog_preferred")',
], "NPC Forge v2 refined compatibility creator");
requireTokens(forge, [
  'from "./CharacterForgeControls"',
  "CharacterForgeCatalogList",
  "CharacterForgeDiceSummary",
], "shared NPC/player Forge controls");
requireTokens(forgeControls, [
  'event.dataTransfer.setData("text/npc-forge-roll"',
  "CharacterForgeCatalogList",
  "CharacterForgeDiceSummary",
], "shared NPC/player Forge control implementation");
requirePatterns(forgeControls, [/Die Roll\s*\{index\s*\+\s*1\}/, /draggable\s+className=\{`npc-forge-roll-card refined/], "NPC Forge roll allocation");
for (const forbidden of ["npc-forge-background-mechanics", "npc-forge-background-spell-list"]) {
  if (forge.includes(forbidden)) throw new Error(`NPC Forge refined creator validation failed: left-column ${forbidden} returned.`);
}

requireTokens(context, [
  "BackgroundFeatureList",
  "BackgroundSkillChooser",
  "BackgroundFeatChooser",
  "ExpandedSpellList",
  "Background feature",
  "npc-forge-context-choice-grid",
  "npc-forge-background-spells",
  "Before adventuring",
  "former allies, obligations, rivals",
], "NPC Forge context");
requirePatterns(context, [/Choose\s*\{group\.count\}\s*skill/], "NPC Forge background choices");
if (context.includes("Suggested Characteristics")) throw new Error("NPC Forge context validation failed: Suggested Characteristics returned to player-facing background UI.");

requireTokens(mechanics, [
  "backgroundSkillRule",
  "backgroundFeatureDetails",
  '/^Suggested Characteristics$/i',
  "data?.isFeature",
  "neutralizeBackgroundLore",
  "extractBackgroundSpellList",
], "background mechanics");
requireTokens(mechanicsWrapper, [
  "refinedBackgroundFeatureDetails",
  "neutralizeBackgroundFeature",
  "playerFacingBackgroundFeatureName",
  "sourceName",
], "background mechanics presentation wrapper");
requireTokens(catalog, ["skillRule", "features: backgroundFeatureDetails", "anyGamingSet", "backgroundSkills: skillRule.fixedKeys"], "NPC Forge catalog");
requireTokens(catalogWrapper, [
  "playerFacingBackgroundName",
  "sourceName",
  "refinedMergePreferredBackgrounds(rows).map(presentBackground)",
  "refinedNormalizeBackgroundOption",
], "NPC Forge background aliases");
requireTokens(neutralization, [
  '"lorwyn-expert": "Sunlit Realm Expert"',
  '"shadowmoor-expert": "Gloam Realm Expert"',
  '"uthgardt-tribe-member": "Tribe Member"',
  '"waterdhavian-noble": "Cosmopolitan Noble"',
  '"witchlight-hand": "Carnival Hand"',
  '"wildspacer": "Voidfarer"',
  '"wildspacer|wildspace-adaptation": "Void Adaptation"',
  '"wildspacer|wildspace-adaptation": "You gain the Tough feat.',
  '"astral-drifter|divine-contact": "You gain the Magic Initiate feat',
  '"athlete|echoes-of-victory": "Your past victories earned you admirers',
  '"marine|steady": "You can move for twice the normal amount of travel time',
  '"mercenary-veteran|mercenary-life": "You know mercenary life well enough',
  '"clan-crafter|respect-of-the-stout-folk"',
  '"uthgardt-tribe-member|uthgardt-heritage"',
  '"waterdhavian-noble|kept-in-style"',
  '"witchlight-hand|carnival-fixture"',
  '/\\bWildspace\\b/gi, "the starry void"',
  '/\\bacross the Realms\\b/gi, "throughout the wider world"',
  "Astral Menagerie",
  "playerFacingBackgroundName",
  "neutralizeBackgroundFeature",
], "complete retained background neutralization");
if (/(?:"lorehold|"prismari|"quandrix|"silverquill|"witherbloom)-student"\s*:/.test(neutralization)) throw new Error("Strixhaven student background names must remain intact unless the campaign owner explicitly changes them.");

requireTokens(importer, ["resolveCopies", '"background"', 'mode === "insertArr"', 'copy_resolution: "backgrounds-and-species"'], "character-option importer");
requireTokens(migration, ["apply_background_entry_mods_v1", "copyResolvedFrom", "Cobalt Scholar did not inherit", "Preferred background count changed unexpectedly"], "background copy migration");
requireTokens(visibilityMigration, [
  "character_option_visibility",
  "character_option_catalog_all_preferred",
  "character_option_catalog_configured",
  "set_character_option_visibility_v1",
  "v_visible <> 75",
  "v_hidden <> 73",
  "upper(p.source) IN ('EFA', 'EGW', 'FRHOF', 'GGR', 'PSA')",
  "name IN ('Failed Merchant', 'Gambler')",
  "name = 'Faceless'",
  "name = 'Mage of High Sorcery'",
  "name = 'Inquisitor'",
  "name = 'Witherbloom Student'",
], "background visibility migration");
if (/DELETE\s+FROM\s+public\.character_option_catalog/i.test(visibilityMigration)) throw new Error("Background visibility migration must not delete source catalogue records.");

requireTokens(characterOptionsAdmin, [
  'from("character_option_catalog_configured")',
  "Edit background availability",
  "Done editing backgrounds",
  "background-visibility-toggle",
  'supabase.rpc("set_character_option_visibility_v1"',
  "Hidden from creation",
  "Shown in creation",
], "character options admin visibility UI");

requireTokens(backgrounds, ["BACKGROUND_LORE", "BACKGROUND_LORE_CATALOG", "importedNarrative", "neutralizeBackgroundLore", "genericBackgroundLore", "sourceName(background)"], "background descriptions");
requireTokens(styles, [".npc-forge-species-artwork", ".npc-forge-species-feature-list"], "species styling");
requireTokens(speciesPreference, [
  "security_invoker = true",
  "o.option_type = 'species'",
  "upper(o.source) = 'XPHB'",
  "upper(o.source) = 'MPMM'",
  "when o.option_type = 'species' and lower(btrim(o.name)) = 'faerie' then 'Fairy'",
  "lower(btrim(o.name)) in ('fairy', 'gnome (deep)', 'gith')",
], "species source preference");

const preferredSpeciesNames = [
  "Aarakocra", "Aasimar", "Aetherborn", "Astral Elf", "Autognome", "Aven", "Boggart", "Bugbear", "Bullywug", "Centaur", "Changeling", "Custom Lineage", "Deep Gnome", "Dhampir", "Dragonborn", "Dragonborn (Chromatic)", "Dragonborn (Gem)", "Dragonborn (Metallic)", "Duergar", "Dwarf", "Dwarf (Kaladesh)", "Eladrin", "Elf", "Elf (Kaladesh)", "Elf (Zendikar)", "Fairy", "Firbolg", "Flamekin", "Genasi", "Giff", "Githyanki", "Githzerai", "Gnoll", "Gnome", "Goblin", "Goblin (Dankwood)", "Goliath", "Grimlock", "Grung", "Hadozee", "Half-Elf", "Half-Orc", "Halfling", "Harengon", "Hexblood", "Hobgoblin", "Human", "Human (Innistrad)", "Human (Ixalan)", "Human (Kaladesh)", "Human (Zendikar)", "Kalashtar", "Kender", "Kenku", "Khenra", "Khoravar", "Kithkin", "Kobold", "Kor", "Kuo-Toa", "Leonin", "Lizardfolk", "Locathah", "Lorwyn Changeling", "Loxodon", "Lupin", "Merfolk", "Minotaur", "Minotaur (Amonkhet)", "Naga", "Orc", "Orc (Ixalan)", "Owlin", "Plasmoid", "Reborn", "Rimekin", "Satyr", "Sea Elf", "Shadar-Kai", "Shifter", "Simic Hybrid", "Siren", "Skeleton", "Tabaxi", "Thri-kreen", "Tiefling", "Tortle", "Triton", "Troglodyte", "Vampire", "Vedalken", "Verdan", "Warforged", "Yuan-Ti", "Yuan-ti Pureblood", "Zombie",
];
if (preferredSpeciesNames.length !== 96) throw new Error(`NPC Forge species artwork validation failed: expected 96 preferred species, found ${preferredSpeciesNames.length}.`);
for (const speciesName of preferredSpeciesNames) {
  const artworkPath = speciesArtworkFor(speciesName);
  if (artworkPath === "/media/species/adventurer.webp") throw new Error(`NPC Forge species artwork validation failed: ${speciesName} still uses neutral fallback artwork.`);
  const file = path.join(root, "public", artworkPath.replace(/^\/+/, ""));
  if (!fs.existsSync(file) || fs.statSync(file).size < 10_000) throw new Error(`NPC Forge species artwork validation failed: ${speciesName} maps to missing or invalid ${artworkPath}.`);
}

console.log("NPC Forge identity-first creation, portrait/sprite visual foundation, idempotent creation, unified 8-direction map runtime, complete 75-background audit, availability controls, source-neutral presentation, species choices, and manual roll allocation validation passed.");
