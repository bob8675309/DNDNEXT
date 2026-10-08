import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const json = (file) => JSON.parse(read(file));
const assert = (condition, message) => { if (!condition) throw new Error(`Grim Hollow PG24 validation failed: ${message}`); };

const manifest = json("data/source-manifests/grim-hollow-pg24.json");
const items = json("public/items/grim-hollow-pg24.json");
const variants = json("public/items/magicvariants.grim-hollow-pg24.json");
const importer = read("scripts/import_grim_hollow_pg24.mjs");
const itemsIndex = read("utils/itemsIndex.js");
const admin = read("pages/admin.js");
const town = read("components/TownSheet.js");
const seed = read("scripts/seed_items_catalog.mjs");
const subclassArtwork = read("utils/classes/subclassArtwork.js");
const subclassCompatibility = read("utils/classes/subclassCompatibility.js");
const classGuide = read("components/NpcForgeClassGuideModel.js");

assert(manifest.sourceId === "GrimHollowPG24", "manifest source id changed");
assert(manifest.sourceCommit === "ab4012f136dc1224c45d6c13c1d8f71b543c34bb", "source commit is not pinned");
assert(manifest.expected?.spells === 101, "expected spell count must remain 101");
assert(manifest.expected?.subclasses === 40, "expected subclass count must remain 40");
assert(manifest.expected?.subclassFeatures === 258, "expected subclass-feature count must remain 258");
assert(manifest.expected?.items === 106, "expected concrete item count must remain 106");
assert(manifest.expected?.itemVariants === 1, "expected item-variant count must remain 1");

assert(Array.isArray(items) && items.length === 106, "runtime item pack must contain 106 concrete items");
for (const item of items) {
  assert(item.source === "GrimHollowPG24", `${item.name || "item"} lost source provenance`);
  assert(item.item_key === `${item.name}|GrimHollowPG24`, `${item.name || "item"} has an unstable item key`);
  assert(item.item_rarity === "mundane", `${item.name || "item"} must preserve the source's mundane rarity`);
  assert(Number.isFinite(Number(item.price_gp)) || item.price_gp == null, `${item.name || "item"} has an invalid GP price`);
}
const arbalest = items.find((item) => item.item_key === "Arbalest|GrimHollowPG24");
assert(arbalest?.value === 75000 && arbalest?.price_gp === 750, "Arbalest must preserve 75000 cp source value while exposing 750 gp normalized price");
assert(items.some((item) => item.rawType === "AdvEq"), "Advanced Equipment rows are missing");
assert(items.some((item) => item.uiType === "Melee Weapon"), "Grim Hollow melee weapons are missing");
assert(items.some((item) => item.uiType === "Ranged Weapon"), "Grim Hollow ranged weapons are missing");
assert(items.some((item) => item.uiType === "Shield"), "Grim Hollow shields are missing");
assert(items.some((item) => item.uiType === "Ammunition"), "Grim Hollow ammunition is missing");

assert(Array.isArray(variants) && variants.length === 1, "runtime variant pack must contain exactly one source variant");
assert(variants[0]?.name === "Hunter's Armor" && variants[0]?.appliesTo?.includes("armor"), "Hunter's Armor variant is missing or malformed");

for (const token of [
  'GRIM_HOLLOW_SOURCE = "GrimHollowPG24"',
  "GRIM_HOLLOW_SOURCE_COMMIT",
  "EXPECTED_COUNTS",
  "spellRows(book",
  "subclassRows(book",
  "itemRows(book",
  "itemVariants(book",
  "subclassDefinition",
  "subclassArtUrl",
  "additionalSpells",
  "subclassSpells",
  "sourceCommit",
  "No database writes were performed",
]) assert(importer.includes(token), `partnered-source importer is missing ${token}`);

assert(itemsIndex.includes('"/items/grim-hollow-pg24.json"') && itemsIndex.includes("loadItemCatalogList"), "shared item loader does not include the Grim Hollow pack");
assert(itemsIndex.includes('raw === "AdvEq"'), "Advanced Equipment classification is missing");
assert(admin.includes("loadItemCatalogList") && admin.includes('source !== "GRIMHOLLOWPG24"'), "Admin item browser does not expose Grim Hollow blackpowder equipment as campaign content");
assert(admin.includes('"/items/magicvariants.grim-hollow-pg24.json"'), "Admin variant loader is missing Hunter's Armor");
assert(town.includes("loadItemCatalogList"), "Town item catalogue does not use the shared merged item loader");
assert(town.includes("isWorkshopFutureItem") && town.includes("FIREARM_WORKSHOP_NAME"), "Town smith firearm exclusion was removed");
assert(seed.includes("grim-hollow-pg24.json") && seed.includes("grimHollowItems"), "full item seeder will drop Grim Hollow items");
assert(seed.includes("Number(it.price_gp || 0) || basePriceGpForItem(it)"), "full item seeder must preserve reviewed GP-normalized source-pack prices before reading raw cp values");
assert(subclassArtwork.includes("subclassArtUrl") && subclassArtwork.includes("TheGiddyLimit\\/homebrew-img"), "source-backed subclass art is not restricted to the trusted partnered image host");
assert(subclassCompatibility.includes("GRIMHOLLOWPG24"), "subclass compatibility does not recognize the Grim Hollow supplement");
assert(classGuide.includes("Grim Hollow: Player's Guide (2024)"), "Forge source label is not player-facing");

const protectedText = [importer, itemsIndex, admin, town, seed, subclassArtwork, subclassCompatibility, classGuide].join("\n").toLowerCase();
for (const token of ["map_routes", "advance_all_characters", "world_state", "sim_tick_v1"]) {
  assert(!protectedText.includes(token), `content import unexpectedly references protected world-map authority: ${token}`);
}

console.log("Grim Hollow PG24 content validation passed: pinned partnered source, 101 spells/40 subclasses/258 subclass features manifest, 106 runtime items, Hunter's Armor variant, merged item consumers, trusted subclass art, and town smith firearm boundary are intact.");
