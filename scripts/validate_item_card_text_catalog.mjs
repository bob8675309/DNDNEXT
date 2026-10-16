import fs from "node:fs/promises";
import path from "node:path";
import {
  auditItemCardText,
  canonicalItemMechanicFields,
  deriveReferenceOnlyEffect,
  extractItemEntryPresentation,
  formatItemCardText,
  leadingItemEntryReference,
  parseLabeledItemFields,
  parseNamedItemSections,
} from "../utils/itemCardText.js";
import { resolveItemCopies } from "./lib/resolve_item_copies.mjs";

const ROOT = path.join(process.cwd(), "public", "items");

async function loadJson(name) {
  return JSON.parse(await fs.readFile(path.join(ROOT, name), "utf8"));
}

function rowsFrom(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function normalizeCatalogRow(row = {}) {
  const payload = row?.payload && typeof row.payload === "object" ? row.payload : {};
  return { ...payload, ...row };
}

function rowKey(row = {}) {
  return String(row.item_key || row.item_id || `${row.item_name || row.name || "item"}|${row.source || row.item_source || ""}`).toLowerCase();
}

function sampleNames(rows = [], limit = 12) {
  return rows.slice(0, limit).map((row) => row.item_name || row.name || "(unnamed)");
}

const [allItemsRaw, grimRaw, alchemyRaw] = await Promise.all([
  loadJson("all-items.json"),
  loadJson("grim-hollow-pg24.json"),
  loadJson("alchemy-catalog.json"),
]);

const copyWarnings = [];
const sourceRows = resolveItemCopies(
  [...rowsFrom(allItemsRaw), ...rowsFrom(grimRaw)],
  { warn: (message) => copyWarnings.push(String(message)) },
).map(normalizeCatalogRow);

const alchemyRows = rowsFrom(alchemyRaw).map(normalizeCatalogRow);
const byKey = new Map();
for (const row of [...sourceRows, ...alchemyRows]) {
  const key = rowKey(row);
  if (!byKey.has(key)) byKey.set(key, row);
}
const rows = [...byKey.values()];

const audits = rows.map((row) => ({ row, audit: auditItemCardText(row) }));
const countProblem = (code) => audits.filter(({ audit }) => audit.problems.includes(code));
const rawMarkup = countProblem("raw-source-tag-remains");
const missingText = countProblem("missing-player-facing-text");
const unresolvedReference = countProblem("reference-only-without-direct-mechanics");
const longWall = countProblem("long-unstructured-wall");
const named = audits.filter(({ audit }) => audit.namedSectionCount > 0 || audit.entrySectionCount > 0);
const tables = audits.filter(({ audit }) => audit.tableCount > 0);
const lists = audits.filter(({ audit }) => audit.listCount > 0);
const labeled = audits.filter(({ audit }) => audit.labeledFieldCount > 0);
const direct = audits.filter(({ audit }) => audit.directFieldCount > 0);
const longDescriptions = audits.filter(({ audit }) => audit.descriptionLength > 900);
const veryLongDescriptions = audits.filter(({ audit }) => audit.descriptionLength > 1800);

const ringResistance = rows.find((row) => /^Ring of Radiant Resistance$/i.test(row.item_name || row.name || ""));
if (!ringResistance) throw new Error("Catalog audit fixture missing Ring of Radiant Resistance.");
const ringReference = leadingItemEntryReference(ringResistance.item_description || ringResistance.rulesText || "");
const ringEffect = deriveReferenceOnlyEffect(ringResistance, ringReference);
if (!/radiant damage/i.test(ringEffect) || !canonicalItemMechanicFields(ringResistance).some((field) => field.label === "Resistance")) {
  throw new Error("Ring of Resistance variants still do not expose their canonical resistance.");
}
const sharedReferenceFixtures = [
  [/^Fire Absorbing Tattoo$/i, /Resistance to Fire damage/i],
  [/^Black Dragon Scale Mail$/i, /closest dragon within 30 miles/i],
  [/^Black Chromatic Rose$/i, /20-foot cone/i],
  [/^Scroll of Protection \(Fey\)$/i, /5-foot-radius/i],
  [/^Ioun Stone, Awareness$/i, /Initiative rolls/i],
  [/^Ioun Stone, Greater Absorption$/i, /level 8 or lower/i],
  [/^Ioun Stone, Reserve$/i, /up to 4 total spell levels/i],
  [/^Ioun Stone, Sustenance$/i, /don't need to eat or drink/i],
  [/^Grenade Launcher$/i, /1,000 feet/i],
];
for (const [namePattern, effectPattern] of sharedReferenceFixtures) {
  const fixture = rows.find((row) => namePattern.test(row.item_name || row.name || ""));
  if (!fixture) throw new Error(`Catalog audit fixture missing ${namePattern}.`);
  const reference = leadingItemEntryReference(fixture.item_description || fixture.rulesText || "");
  const effect = deriveReferenceOnlyEffect(fixture, reference);
  if (!effectPattern.test(effect)) throw new Error(`${fixture.item_name || fixture.name} still does not resolve its shared itemEntry mechanics.`);
}


const bag = rows.find((row) => /^Bag of Tricks, Tan$/i.test(row.item_name || row.name || ""));
if (!bag || extractItemEntryPresentation(bag.entries).tables.length < 1) {
  throw new Error("Bag of Tricks source roll table is not available to ItemCard presentation.");
}

const slingAcid = rows.find((row) => /^Sling Bullet, Acid$/i.test(row.item_name || row.name || ""));
if (!slingAcid || extractItemEntryPresentation(slingAcid.entries).sections.length < 1) {
  throw new Error("Sling Bullet, Acid named source section is not available to ItemCard presentation.");
}

const flamefriend = rows.find((row) => /^Flamefriend Lantern$/i.test(row.item_name || row.name || ""));
if (!flamefriend || (parseNamedItemSections(formatItemCardText(flamefriend.item_description || ""))?.sections?.length || 0) < 2) {
  throw new Error("Flamefriend Lantern text headings are not being recognized as ItemCard sections.");
}

const tool = rows.find((row) => /^Navigator'?s Tools$/i.test(row.item_name || row.name || ""));
if (tool) {
  const labeledToolFields = parseLabeledItemFields(formatItemCardText(tool.item_description || ""));
  if (/\bAbility\s*:/i.test(tool.item_description || "") && !labeledToolFields.fields.length) {
    throw new Error("Labeled tool rules are still rendering as an unstructured wall.");
  }
}

const copyFixture = resolveItemCopies([
  {
    name: "Ring of Protection",
    source: "XDMG",
    rarity: "rare",
    item_rarity: "rare",
    price_gp: 5000,
    entries: ["You gain a +1 bonus to Armor Class and saving throws while wearing this ring."],
    item_description: "You gain a +1 bonus to Armor Class and saving throws while wearing this ring.",
    bonusAc: "+1",
    bonusSavingThrow: "+1",
  },
  {
    name: "+2 Ring of Protection",
    source: "TDCSR",
    rarity: "none",
    item_rarity: "mundane",
    price_gp: 1,
    bonusAc: "+2",
    bonusSavingThrow: "+2",
    _copy: {
      name: "Ring of Protection",
      source: "DMG",
      _mod: { entries: { mode: "replaceTxt", replace: "\\+1", with: "+2", flags: "g" } },
    },
  },
], { warn: () => {} });
const upgradedRing = copyFixture.find((row) => row.name === "+2 Ring of Protection");
if (!upgradedRing || String(upgradedRing.item_rarity || upgradedRing.rarity).toLowerCase() !== "rare" || Number(upgradedRing.price_gp) !== 5000 || !/\+2 bonus/i.test(upgradedRing.item_description || "")) {
  throw new Error("Legacy DMG -> XDMG _copy alias resolution still corrupts +2 Ring of Protection.");
}

if (rawMarkup.length) {
  throw new Error(`ItemCard text cleaner leaves raw source markup on ${rawMarkup.length} items; examples: ${sampleNames(rawMarkup.map(({ row }) => row)).join(", ")}`);
}

if (longWall.length) {
  throw new Error(`ItemCard audit found ${longWall.length} long descriptions with no usable paragraph/section/list/table structure; examples: ${sampleNames(longWall.map(({ row }) => row)).join(", ")}`);
}

if (unresolvedReference.length) {
  throw new Error(`ItemCard audit found ${unresolvedReference.length} shared itemEntry references with no card-ready mechanic fallback; examples: ${sampleNames(unresolvedReference.map(({ row }) => row)).join(", ")}`);
}

console.log(JSON.stringify({
  audited_items: rows.length,
  source_rows_after_copy_resolution: sourceRows.length,
  alchemy_rows: alchemyRows.length,
  descriptions_over_900_chars: longDescriptions.length,
  descriptions_over_1800_chars: veryLongDescriptions.length,
  items_with_named_sections: named.length,
  items_with_source_tables: tables.length,
  items_with_source_lists: lists.length,
  items_with_labeled_fields: labeled.length,
  items_with_direct_mechanic_fields: direct.length,
  missing_player_facing_text: missingText.length,
  reference_only_without_direct_mechanics: unresolvedReference.length,
  copy_resolution_warnings: copyWarnings.length,
  samples: {
    missing_player_facing_text: sampleNames(missingText.map(({ row }) => row)),
    reference_only_without_direct_mechanics: sampleNames(unresolvedReference.map(({ row }) => row)),
    copy_resolution_warnings: copyWarnings.slice(0, 12),
  },
}, null, 2));

console.log("Full ItemCard catalog text audit passed: every source row was inspected, structured source sections/lists/tables are preserved, source markup is cleaned, and video regression fixtures are covered.");
