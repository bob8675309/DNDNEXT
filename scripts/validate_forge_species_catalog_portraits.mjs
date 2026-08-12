import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const protectedPattern = /MapPageClient|map_routes|map_route_points|advance_all_characters|route_segment_progress/;

const coreSource = read("components/NpcForgeCoreSupport.js");
const artworkSource = read("utils/speciesArtwork.js");
const loreSource = read("utils/speciesLore.js");

for (const token of [
  "useState",
  "expandedSpeciesRows",
  "npc-forge-catalog-expand-toggle",
  "aria-expanded={expanded}",
  "toggleRowExpansion",
  "setRowExpanded(row, true)",
  "SpeciesCatalogPortrait",
  "speciesCatalogSummary",
  "npc-forge-catalog-species-summary",
  "npc-forge-catalog-child-check",
]) assert.ok(coreSource.includes(token), `Species catalogue portrait/collapse UI missing ${token}`);
assert.ok(!coreSource.includes("active && (family || sourceVariants.length) ? \"⌄\" : \"›\""), "expand/collapse must no longer be coupled to active selection state");
assert.ok(coreSource.includes("expanded && parentSelected && family"), "family children must render from independent expanded state");
assert.ok(coreSource.includes("expanded && sourceVariants.length"), "setting children must render from independent expanded state");

for (const token of [
  "SPECIES_VARIANT_PORTRAITS",
  "air-genasi",
  "gold-dragonborn",
  "hawk-headed-aven",
  "drow",
  "forest-gnome",
  "beasthide-shifter",
  "lorwyn-fairy",
  "shadowmoor-kithkin",
  "dwarf-kaladesh",
  "goblin-dankwood",
  "orc-ixalan",
  "?portrait=",
]) assert.ok(artworkSource.includes(token), `Species variant portrait authority missing ${token}`);

for (const token of [
  "Air genasi",
  "Gold Dragonborn",
  "Hawk-Headed Aven",
  "Drow are an elven lineage",
  "Forest Gnomes",
  "Beasthide Shifters",
  "Lorwyn Fairies",
  "Shadowmoor Kithkin",
  "Innistrad Humans",
  "Kaladesh Dwarves",
  "Ixalan Orcs",
  "Dankwood Goblins",
  "speciesCatalogSummary",
]) assert.ok(loreSource.includes(token), `Species catalogue lore coverage missing ${token}`);

const { speciesArtworkFor, hasDedicatedSpeciesArtwork } = await import(pathToFileURL(path.join(root, "utils/speciesArtwork.js")).href);
const { speciesFlavorLore, speciesCatalogSummary } = await import(pathToFileURL(path.join(root, "utils/speciesLore.js")).href);

const portraitCases = [
  ["Air Genasi", "genasi.webp?portrait=air-genasi"],
  ["Gold Dragonborn", "dragonborn-metallic.webp?portrait=gold-dragonborn"],
  ["Amethyst Gem Dragonborn", "dragonborn-gem.webp?portrait=amethyst-gem-dragonborn"],
  ["Hawk-Headed Aven", "aven.webp?portrait=hawk-headed-aven"],
  ["Drow", "elf.webp?portrait=drow"],
  ["Forest Gnome", "gnome.webp?portrait=forest-gnome"],
  ["Wildhunt Shifter", "shifter.webp?portrait=wildhunt-shifter"],
  ["Shadowmoor Fairy", "fairy.webp?portrait=shadowmoor-fairy"],
  ["Lorwyn Kithkin", "kithkin.webp?portrait=lorwyn-kithkin"],
  ["Dwarf (Kaladesh)", "dwarf.webp?portrait=dwarf-kaladesh"],
  ["Goblin (Dankwood)", "goblin.webp?portrait=goblin-dankwood"],
  ["Orc (Ixalan)", "orc.webp?portrait=orc-ixalan"],
];
for (const [name, expected] of portraitCases) {
  assert.ok(speciesArtworkFor(name).endsWith(expected), `${name} must resolve a child-specific portrait presentation`);
  assert.equal(hasDedicatedSpeciesArtwork(name), true, `${name} must be recognized as having an intentional portrait presentation`);
  const lore = speciesFlavorLore(name);
  assert.ok(lore.length >= 70, `${name} must have a meaningful unique description`);
  const summary = speciesCatalogSummary(name);
  assert.ok(summary.length >= 30 && summary.length <= 109, `${name} must have a compact catalogue summary`);
}

assert.equal(speciesArtworkFor("Human (Innistrad)"), "/media/species/human-innistrad.webp", "existing dedicated setting artwork must remain authoritative");
assert.match(speciesFlavorLore("Water Genasi"), /breathe both air and water/i, "Water Genasi description must remain lineage-specific");
assert.match(speciesFlavorLore("Ibis-Headed Aven"), /broad, angular wings|disciplined thought/i, "Ibis-Headed Aven description must preserve non-campaign-specific source identity");
assert.match(speciesFlavorLore("Gold Dragonborn"), /fire-linked ancestry/i, "Gold Dragonborn description must be ancestry-specific without personality stereotyping");
assert.doesNotMatch(speciesFlavorLore("Hawk-Headed Aven"), /Naktamun|Hekma|God-Pharaoh/i, "Aven catalogue lore must omit campaign-specific plot language");

for (const source of [coreSource, artworkSource, loreSource]) assert.ok(!protectedPattern.test(source), "Species portrait/catalogue work crossed a protected map/travel boundary");

console.log("Forge Species catalogue portraits validated: expandable parents have independent chevrons, parent/child rows carry portraits and concise lore, child visual treatments are self-contained, campaign-specific Aven plot text is excluded, and protected map/travel boundaries remain untouched.");
