#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  BLOCKED_BACKGROUND_LOCATIONS,
  BACKGROUND_LORE_OVERRIDES,
  campaignLocationReferenceCount,
  genericBackgroundLore,
  neutralizeBackgroundLore,
} from "../utils/backgroundNeutralization.js";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function clean5eText(value = "") {
  return String(value)
    .replace(/\{@(?:damage|dice|hit|chance) ([^}|]+)(?:\|[^}]*)?}/gi, "$1")
    .replace(/\{@(?:spell|item|creature|condition|skill|action|sense|language|race|class|feat|filter|book|adventure|variantrule) ([^}|]+)(?:\|[^}]*)?}/gi, "$1")
    .replace(/\{@(?:b|i|u|note|atk|h|dc) ([^}]*)}/gi, "$1")
    .replace(/\{@[a-zA-Z]+ ([^}]*)}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function keyFor(name, source) {
  return `${String(name || "").trim().toLowerCase()}|${String(source || "UNK").toUpperCase()}`;
}

function slug(value = "") {
  return String(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function applyEntryMods(entries = [], mods) {
  let next = clone(entries || []);
  for (const operation of (Array.isArray(mods) ? mods : [mods]).filter(Boolean)) {
    if (operation.mode === "appendArr") next.push(...(Array.isArray(operation.items) ? clone(operation.items) : [clone(operation.items)]));
    else if (operation.mode === "prependArr") next.unshift(...(Array.isArray(operation.items) ? clone(operation.items) : [clone(operation.items)]));
    else if (operation.mode === "removeArr") {
      const names = new Set((Array.isArray(operation.names) ? operation.names : [operation.names]).map(String));
      next = next.filter((entry) => !names.has(String(entry?.name || "")));
    } else if (operation.mode === "replaceArr") {
      const index = next.findIndex((entry) => String(entry?.name || "") === String(operation.replace || ""));
      if (index >= 0) next.splice(index, 1, ...(Array.isArray(operation.items) ? clone(operation.items) : [clone(operation.items)]));
    } else if (operation.mode === "replaceTxt") {
      const pattern = new RegExp(operation.replace || "", operation.flags || "g");
      next = JSON.parse(JSON.stringify(next).replace(pattern, operation.with || ""));
    }
  }
  return next;
}

function resolveCopies(rows = []) {
  const byKey = new Map(rows.map((row) => [keyFor(row.name, row.source), row]));
  const resolving = new Set();
  function resolve(row) {
    if (!row?._copy) return clone(row);
    const key = keyFor(row.name, row.source);
    if (resolving.has(key)) throw new Error(`Circular background fluff copy: ${key}`);
    resolving.add(key);
    const baseRow = byKey.get(keyFor(row._copy.name, row._copy.source));
    if (!baseRow) throw new Error(`Missing background fluff copy base: ${row._copy.name}|${row._copy.source}`);
    const base = resolve(baseRow);
    const resolved = { ...base, ...clone(row), name: row.name, source: row.source };
    delete resolved._copy;
    for (const [field, operations] of Object.entries(row._copy._mod || {})) {
      if (field === "entries") resolved.entries = applyEntryMods(base.entries || [], operations);
      else resolved[field] = clone(operations);
    }
    resolving.delete(key);
    return resolved;
  }
  return rows.map(resolve);
}

function narrativeParagraphs(entries = []) {
  const output = [];
  function walk(node) {
    if (node == null || output.length >= 8) return;
    if (typeof node === "string") {
      const text = clean5eText(node);
      if (text.split(/\s+/).length >= 18 && /[.!?]/.test(text)) output.push(text);
      return;
    }
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node !== "object" || ["image", "table", "item", "list"].includes(node.type)) return;
    if (node.entries) walk(node.entries);
    if (node.entry) walk(node.entry);
  }
  walk(entries);
  return output;
}

function mechanicsNarrative(entries = []) {
  return narrativeParagraphs(entries)
    .filter((text) => !/^(?:ability scores?|feat|skill proficiencies?|tool proficiencies?|languages?|equipment|choose a or b)\s*:/i.test(text))
    .slice(0, 2)
    .join("\n\n");
}

function sourcePriority(source = "") {
  return ({ XPHB: 0, EFA: 1, TCE: 2, PHB: 3 })[String(source).toUpperCase()] ?? 10;
}

function preferredBackgrounds(rows = []) {
  const byName = new Map();
  for (const row of rows) {
    const key = String(row.name || "").trim().toLowerCase().replace(/\s+/g, " ");
    const current = byName.get(key);
    if (
      !current
      || sourcePriority(row.source) < sourcePriority(current.source)
      || (sourcePriority(row.source) === sourcePriority(current.source) && String(row.source).localeCompare(String(current.source)) < 0)
    ) byName.set(key, row);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function chooseLore(background, fluff) {
  const sourceFluff = narrativeParagraphs(fluff?.entries || []).slice(0, 2).join("\n\n");
  const mechanics = mechanicsNarrative(background.entries || []);
  const chosen = sourceFluff || mechanics || genericBackgroundLore(background.name);
  if (BACKGROUND_LORE_OVERRIDES[slug(background.name)]) {
    return { lore: neutralizeBackgroundLore(background.name, chosen), usedGeneric: false, loreSource: "campaign-neutral-override" };
  }
  if (campaignLocationReferenceCount(chosen) >= 2) {
    return { lore: genericBackgroundLore(background.name), usedGeneric: true };
  }
  const neutral = neutralizeBackgroundLore(background.name, chosen);
  return neutral.length >= 100
    ? { lore: neutral, usedGeneric: false }
    : { lore: genericBackgroundLore(background.name), usedGeneric: true };
}

function sqlLiteral(value = "") {
  return `'${String(value).replace(/'/g, "''")}'`;
}

const dataDir = path.resolve(process.argv[2] || "");
if (!dataDir || !fs.existsSync(path.join(dataDir, "backgrounds.json"))) {
  throw new Error("Usage: node scripts/generate_background_lore_catalog.mjs <path-to-5etools-data>");
}

const mechanicsRows = readJson(path.join(dataDir, "backgrounds.json")).background || [];
const fluffRows = resolveCopies(readJson(path.join(dataDir, "fluff-backgrounds.json")).backgroundFluff || []);
const fluffByKey = new Map(fluffRows.map((row) => [keyFor(row.name, row.source), row]));
const preferred = preferredBackgrounds(mechanicsRows);
const records = preferred.map((background) => {
  const fluff = fluffByKey.get(keyFor(background.name, background.source));
  const chosen = chooseLore(background, fluff);
  const lore = chosen.lore;
  const blocked = BLOCKED_BACKGROUND_LOCATIONS.filter((place) => lore.toLowerCase().includes(place.toLowerCase()));
  if (blocked.length) throw new Error(`${background.name} still contains campaign locations: ${blocked.join(", ")}`);
  return {
    key: `${slug(background.name)}|${String(background.source).toUpperCase()}`,
    name: background.name,
    source: background.source,
    lore,
    loreSource: chosen.loreSource || (chosen.usedGeneric
      ? "campaign-neutral-fallback"
      : fluff
        ? `${fluff.source}:backgroundFluff`
        : mechanicsNarrative(background.entries || [])
          ? `${background.source}:background`
          : "campaign"),
  };
});

if (records.length !== 148) throw new Error(`Expected 148 preferred backgrounds, found ${records.length}.`);
if (records.some((record) => record.lore.length < 100)) throw new Error("Every background must have substantial lore.");

const catalogPath = path.resolve("utils/backgroundLoreCatalog.js");
const catalogSource = `// Generated by scripts/generate_background_lore_catalog.mjs from reviewed 5etools data.\n`
  + `// Player-facing text is campaign-neutralized; mechanics remain source-authentic.\n`
  + `export const BACKGROUND_LORE_CATALOG = Object.freeze(${JSON.stringify(Object.fromEntries(records.map((record) => [record.key, {
    name: record.name,
    source: record.source,
    lore: record.lore,
    loreSource: record.loreSource,
  }])), null, 2)});\n`;
fs.writeFileSync(catalogPath, catalogSource, "utf8");

const migrationPath = path.resolve("sql/20260723_02_enrich_background_catalog.sql");
const values = records.map((record) => `  (${sqlLiteral(record.name)}, ${sqlLiteral(record.source)}, ${sqlLiteral(record.lore)}, ${sqlLiteral(record.loreSource)})`).join(",\n");
const migration = `-- Enrich every preferred background with campaign-neutral story text from the matching 5etools Info entry.\n`
  + `-- Mechanical fields remain unchanged.\n`
  + `with lore(name, source, story, lore_source) as (\n  values\n${values}\n)\n`
  + `update public.character_option_catalog as option\n`
  + `set metadata = jsonb_set(\n`
  + `  jsonb_set(coalesce(option.metadata, '{}'::jsonb), '{lore}', to_jsonb(lore.story), true),\n`
  + `  '{loreSource}', to_jsonb(lore.lore_source), true\n`
  + `), updated_at = now()\n`
  + `from lore\n`
  + `where option.option_type = 'background'\n`
  + `  and lower(btrim(option.name)) = lower(btrim(lore.name))\n`
  + `  and upper(option.source) = upper(lore.source);\n`;
fs.writeFileSync(migrationPath, migration, "utf8");

console.log(JSON.stringify({
  preferred: records.length,
  sourceFluffSelected: records.filter((record) => record.loreSource.endsWith(":backgroundFluff")).length,
  generatedFallbacks: records.filter((record) => record.loreSource.startsWith("campaign")).length,
  catalogPath,
  migrationPath,
}, null, 2));
