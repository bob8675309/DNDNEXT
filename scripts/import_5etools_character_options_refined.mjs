#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { SPECIES_LORE_OVERRIDES } from "../utils/speciesLore.js";
import {
  BACKGROUND_LORE_OVERRIDES,
  campaignLocationReferenceCount,
  genericBackgroundLore,
  neutralizeBackgroundLore,
} from "../utils/backgroundNeutralization.js";

function parseNumber(value, fallback) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
function parseArgs(argv) {
  const args = { dataDir: null, source: null, outDir: null, chunkSize: 500, previewJson: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--source") args.source = String(argv[++index] || "").toUpperCase();
    else if (arg === "--out-dir") args.outDir = argv[++index] || null;
    else if (arg === "--chunk-size") args.chunkSize = Math.max(1, Math.min(500, parseNumber(argv[++index], 500)));
    else if (arg === "--preview-json") args.previewJson = argv[++index] || null;
    else if (arg === "--apply") throw new Error("--apply is disabled. Import reviewed batches through Admin > Character Options.");
    else if (!args.dataDir) args.dataDir = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}
function usage() {
  console.log(`Usage:
  node scripts/import_5etools_character_options.mjs <path-to-5etools-data> --out-dir character-option-batches
  node scripts/import_5etools_character_options.mjs <path-to-5etools-data> --source XPHB --preview-json character-options-xphb.json

Reads feats.json, backgrounds.json, fluff-backgrounds.json, races.json (race[] and subrace[]), fluff-races.json, and skills.json.
All source versions are retained. Background, species, and subrace _copy records are resolved before the reviewed batch is produced.
This command never writes directly to Supabase.`);
}
function readJson(filePath) { return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : {}; }
function slugify(value = "") { return String(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "option"; }
function clean5eText(value) {
  if (value == null) return "";
  let text = typeof value === "string" ? value : JSON.stringify(value);
  text = text.replace(/\{@(?:damage|dice|hit|chance) ([^}|]+)(?:\|[^}]*)?}/gi, "$1");
  text = text.replace(/\{@(?:spell|item|creature|condition|skill|action|sense|language|race|class|feat|filter|book|adventure|variantrule) ([^}|]+)(?:\|[^}]*)?}/gi, "$1");
  text = text.replace(/\{@(?:b|i|u|note|atk|h|dc) ([^}]*)}/gi, "$1");
  text = text.replace(/\{@[a-zA-Z]+ ([^}]*)}/g, "$1");
  return text.replace(/\s+/g, " ").trim();
}
function flattenEntries(entries = []) {
  const output = [];
  function walk(node) {
    if (node == null) return;
    if (typeof node === "string") { const text = clean5eText(node); if (text) output.push(text); return; }
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node !== "object") return;
    if (/^Suggested Characteristics$/i.test(String(node.name || ""))) return;
    if (node.name && (node.entries || node.entry || node.items)) { const label = clean5eText(node.name); if (label) output.push(`${label}.`); }
    if (node.entry) walk(node.entry);
    if (node.entries) walk(node.entries);
    if (node.items) walk(node.items);
    if (node.rows && node.data?.isFeature) walk(node.rows);
  }
  walk(entries);
  return output.filter(Boolean).join("\n\n");
}
function shortDescription(entries = []) { const text = flattenEntries(entries); return text.length <= 900 ? text : `${text.slice(0, 897).trimEnd()}…`; }
function firstLoreParagraph(entries = []) {
  const candidates = [];
  function walk(node) {
    if (node == null || candidates.length >= 12) return;
    if (typeof node === "string") { const text = clean5eText(node); if (text.length >= 80 && !/^(source:|creature type|size:|speed:|darkvision:)/i.test(text)) candidates.push(text); return; }
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node !== "object") return;
    if (node.entries) walk(node.entries); if (node.entry) walk(node.entry); if (node.items) walk(node.items);
  }
  walk(entries);
  const text = candidates[0] || "";
  if (text.length <= 560) return text;
  const sentenceEnd = text.slice(0, 557).lastIndexOf(". ");
  return `${text.slice(0, sentenceEnd >= 180 ? sentenceEnd + 1 : 557).trimEnd()}…`;
}
function backgroundLoreDetails(row = {}, fluff = null) {
  const override = BACKGROUND_LORE_OVERRIDES[slugify(row.name)];
  if (override) return { lore: neutralizeBackgroundLore(row.name, override), loreSource: "campaign-neutral-override" };
  const candidates = [];
  function walk(node) {
    if (node == null || candidates.length >= 8) return;
    if (typeof node === "string") { const text = clean5eText(node); if (text.split(/\s+/).length >= 18 && /[.!?]/.test(text)) candidates.push(text); return; }
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node !== "object" || ["image", "table", "item", "list"].includes(node.type)) return;
    if (node.entries) walk(node.entries); if (node.entry) walk(node.entry);
  }
  walk(fluff?.entries || row.entries || []);
  const sourceLore = candidates.slice(0, 2).join("\n\n");
  if (!sourceLore || campaignLocationReferenceCount(sourceLore) >= 2) return { lore: genericBackgroundLore(row.name), loreSource: "campaign-neutral-fallback" };
  const neutral = neutralizeBackgroundLore(row.name, sourceLore);
  return neutral.length >= 100 ? { lore: neutral, loreSource: fluff?.source ? `${fluff.source}:backgroundFluff` : `${row.source || "UNK"}:background` } : { lore: genericBackgroundLore(row.name), loreSource: "campaign-neutral-fallback" };
}
function fluffKey(name, source) { return `${slugify(name)}|${String(source || "UNK").toUpperCase()}`; }
function buildFluffIndex(rows = []) {
  const exact = new Map(); const byName = new Map();
  for (const row of rows) {
    if (!row?.name || !Array.isArray(row.entries)) continue;
    exact.set(fluffKey(row.name, row.source), row);
    const key = slugify(row.name); if (!byName.has(key)) byName.set(key, []); byName.get(key).push(row);
  }
  return { exact, byName };
}
function fluffFor(row = {}, index = { exact: new Map(), byName: new Map() }) {
  const exact = index.exact.get(fluffKey(row.name || row.raceName, row.source));
  if (exact) return exact;
  const sameName = index.byName.get(slugify(row.name || row.raceName)) || [];
  return sameName.length === 1 ? sameName[0] : null;
}
function prerequisiteText(prerequisite) { return prerequisite ? clean5eText(prerequisite) : ""; }
function optionKey(type, name, source) { return type === "skill" ? `${slugify(name)}|${String(source || "UNK").toUpperCase()}` : `${type}:${slugify(name)}|${String(source || "UNK").toUpperCase()}`; }
function sourceMatches(row, source) { return !source || String(row?.source || "UNK").toUpperCase() === source; }
function cloneJson(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function asArray(value) { return Array.isArray(value) ? cloneJson(value) : value == null ? [] : [cloneJson(value)]; }

function applyEntryMods(entries = [], mods) {
  let next = asArray(entries);
  const operations = Array.isArray(mods) ? mods : [mods];
  for (const operation of operations.filter(Boolean)) {
    const items = asArray(operation.items);
    if (operation.mode === "appendArr") next.push(...items);
    else if (operation.mode === "prependArr") next.unshift(...items);
    else if (operation.mode === "insertArr") next.splice(Math.max(0, Math.min(next.length, Number(operation.index || 0))), 0, ...items);
    else if (operation.mode === "removeArr") {
      const names = new Set(asArray(operation.names).map(String));
      next = next.filter((entry, index) => !names.has(String(entry?.name || "")) && !names.has(String(index)));
    } else if (operation.mode === "replaceArr") {
      let index = -1;
      if (typeof operation.replace === "string") index = next.findIndex((entry) => String(entry?.name || "") === operation.replace);
      else if (operation.replace && Number.isInteger(Number(operation.replace.index))) index = Number(operation.replace.index);
      if (index >= 0 && index < next.length) next.splice(index, 1, ...items);
    } else if (operation.mode === "replaceTxt") {
      const pattern = new RegExp(operation.replace || "", operation.flags || "g");
      next = JSON.parse(JSON.stringify(next).replace(pattern, operation.with || ""));
    }
  }
  return next;
}

function resolveCopies(rows = [], label = "record") {
  const byKey = new Map(rows.map((row) => [fluffKey(row.name || row.raceName, row.source), row]));
  const memo = new Map(); const resolving = new Set();
  function resolve(row) {
    const key = fluffKey(row.name || row.raceName, row.source);
    if (memo.has(key)) return cloneJson(memo.get(key));
    if (!row?._copy) { const plain = cloneJson(row); memo.set(key, plain); return cloneJson(plain); }
    if (resolving.has(key)) throw new Error(`Circular ${label} copy detected for ${key}`);
    resolving.add(key);
    const baseKey = fluffKey(row._copy.name, row._copy.source);
    const baseRow = byKey.get(baseKey);
    if (!baseRow) throw new Error(`${label} copy base not found: ${row._copy.name}|${row._copy.source}`);
    const base = resolve(baseRow);
    const resolved = { ...base, ...cloneJson(row) };
    resolved.name = row.name || row.raceName; resolved.source = row.source;
    const mods = row._copy._mod || {};
    for (const [field, operations] of Object.entries(mods)) {
      if (field === "entries") resolved.entries = applyEntryMods(base.entries || [], operations);
      else resolved[field] = cloneJson(operations);
    }
    delete resolved._copy;
    resolving.delete(key); memo.set(key, resolved);
    return cloneJson(resolved);
  }
  return rows.map(resolve);
}

function mergeSubraces(resolvedRaces = [], resolvedSubraces = []) {
  const raceByKey = new Map(resolvedRaces.map((race) => [fluffKey(race.name, race.source), race]));
  return resolvedSubraces.flatMap((subrace) => {
    const raceName = subrace.raceName;
    const raceSource = subrace.raceSource;
    const parent = raceByKey.get(fluffKey(raceName, raceSource));
    if (!parent || !raceName) return [];
    const variantName = subrace.name || "Variant";
    const merged = {
      ...cloneJson(parent),
      ...cloneJson(subrace),
      name: `${raceName} (${variantName})`,
      displayName: `${raceName} (${variantName})`,
      source: subrace.source || parent.source,
      parentSpecies: raceName,
      parentSource: raceSource || parent.source,
      variantName,
      raceName,
      raceSource: raceSource || parent.source,
      size: subrace.size ?? parent.size ?? [],
      speed: subrace.speed ?? parent.speed ?? null,
      creatureTypes: subrace.creatureTypes ?? parent.creatureTypes ?? [],
      languageProficiencies: subrace.languageProficiencies ?? parent.languageProficiencies ?? [],
      darkvision: subrace.darkvision ?? parent.darkvision ?? null,
      lineage: subrace.lineage ?? parent.lineage ?? null,
      entries: [...asArray(parent.entries), ...asArray(subrace.entries)],
      sourceDerivedSubrace: true,
    };
    return [merged];
  });
}

function featType(row = {}) { const category = String(row.category || "").toUpperCase(); return category === "EB" || /^boon of\b/i.test(String(row.name || "")) ? "boon" : "feat"; }
function featRow(row = {}) {
  const optionType = featType(row);
  return { option_key: optionKey(optionType, row.name, row.source), option_type: optionType, name: row.name || "Unknown Feat", source: row.source || "UNK", category: row.category || null, description: shortDescription(row.entries || []), prerequisite_text: prerequisiteText(row.prerequisite || []), tags: [row.repeatable ? "repeatable" : null, row.category ? `category:${row.category}` : null].filter(Boolean), metadata: { repeatable: Boolean(row.repeatable), ability: row.ability || [], additionalSpells: row.additionalSpells || [], skillProficiencies: row.skillProficiencies || [], toolProficiencies: row.toolProficiencies || [], armorProficiencies: row.armorProficiencies || [], weaponProficiencies: row.weaponProficiencies || [], prerequisite: row.prerequisite || [], page: row.page ?? null }, raw_payload: row };
}
function backgroundRow(row = {}, fluffIndex) {
  const fluff = fluffFor(row, fluffIndex); const lore = backgroundLoreDetails(row, fluff);
  return { option_key: optionKey("background", row.name, row.source), option_type: "background", name: row.name || "Unknown Background", source: row.source || "UNK", category: null, description: shortDescription(row.entries || []), prerequisite_text: "", tags: [], metadata: { abilities: row.ability || [], feats: row.feats || [], skills: row.skillProficiencies || [], tools: row.toolProficiencies || [], languages: row.languageProficiencies || [], equipment: row.startingEquipment || [], lore: lore.lore, loreSource: lore.loreSource, page: row.page ?? null }, raw_payload: row };
}
function speciesRow(row = {}, fluffIndex) {
  const name = row.displayName || row.name || row.raceName || "Unknown Species";
  const loreSubject = row.parentSpecies || name;
  const fluff = row.parentSpecies ? fluffFor({ name: row.parentSpecies, source: row.parentSource }, fluffIndex) : fluffFor(row, fluffIndex);
  const lore = SPECIES_LORE_OVERRIDES[slugify(loreSubject)] || firstLoreParagraph(fluff?.entries || []);
  return {
    option_key: optionKey("species", name, row.source), option_type: "species", name, source: row.source || "UNK", category: row.lineage || row.creatureTypes?.join(", ") || null, description: shortDescription(row.entries || []), prerequisite_text: "", tags: [row.size ? `size:${clean5eText(row.size)}` : null].filter(Boolean),
    metadata: {
      speed: row.speed || null, size: row.size || [], creatureTypes: row.creatureTypes || [], languages: row.languageProficiencies || [], darkvision: row.darkvision ?? null, lineage: row.lineage || null, traits: row.entries || [], lore, loreSource: fluff?.source || null, page: row.page ?? null,
      parentSpecies: row.parentSpecies || null, parentSource: row.parentSource || null, variantName: row.variantName || null, sourceDerivedSubrace: Boolean(row.sourceDerivedSubrace),
      additionalSpells: row.additionalSpells || [], resist: row.resist || [], traitTags: row.traitTags || [],
    }, raw_payload: row,
  };
}
function skillRow(row = {}) { return { option_key: optionKey("skill", row.name, row.source), option_type: "skill", name: row.name || "Unknown Skill", source: row.source || "UNK", category: row.ability || null, description: shortDescription(row.entries || []), prerequisite_text: "", tags: row.ability ? [`ability:${row.ability}`] : [], metadata: { ability: row.ability || null, page: row.page ?? null }, raw_payload: row }; }

function collectRows(dataDir, source) {
  const files = { feats: readJson(path.join(dataDir, "feats.json")), backgrounds: readJson(path.join(dataDir, "backgrounds.json")), backgroundFluff: readJson(path.join(dataDir, "fluff-backgrounds.json")), races: readJson(path.join(dataDir, "races.json")), raceFluff: readJson(path.join(dataDir, "fluff-races.json")), skills: readJson(path.join(dataDir, "skills.json")) };
  const resolvedRaces = resolveCopies(files.races.race || [], "race");
  const resolvedSubraces = resolveCopies(files.races.subrace || [], "subrace");
  const mergedSubraces = mergeSubraces(resolvedRaces, resolvedSubraces);
  const resolvedBackgrounds = resolveCopies(files.backgrounds.background || [], "background");
  const raceFluffIndex = buildFluffIndex(resolveCopies(files.raceFluff.raceFluff || [], "race fluff"));
  const backgroundFluffIndex = buildFluffIndex(resolveCopies(files.backgroundFluff.backgroundFluff || [], "background fluff"));
  const rows = [
    ...(files.feats.feat || []).filter((row) => sourceMatches(row, source)).map(featRow),
    ...resolvedBackgrounds.filter((row) => sourceMatches(row, source)).map((row) => backgroundRow(row, backgroundFluffIndex)),
    ...resolvedRaces.filter((row) => sourceMatches(row, source)).map((row) => speciesRow(row, raceFluffIndex)),
    ...mergedSubraces.filter((row) => sourceMatches(row, source)).map((row) => speciesRow(row, raceFluffIndex)),
    ...(files.skills.skill || []).filter((row) => sourceMatches(row, source)).map(skillRow),
  ];
  const unique = new Map(); rows.forEach((row) => unique.set(row.option_key, row));
  return [...unique.values()].sort((a, b) => a.option_type.localeCompare(b.option_type) || a.name.localeCompare(b.name) || a.source.localeCompare(b.source));
}
function summary(rows = []) {
  const byType = {}; const bySource = {};
  rows.forEach((row) => { byType[row.option_type] = (byType[row.option_type] || 0) + 1; bySource[row.source] = (bySource[row.source] || 0) + 1; });
  return { options: rows.length, byType, bySource };
}
function payload(rows, extra = {}) { return { summary: summary(rows), meta: { generated_at: new Date().toISOString(), importer: "scripts/import_5etools_character_options.mjs", copy_resolution: "backgrounds-species-and-subraces", ...extra }, rows }; }
function writeJson(filePath, value) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8"); console.log(`Wrote ${filePath}`); }
function writeBatches(rows, outDir, chunkSize, source) {
  const resolved = path.resolve(process.cwd(), outDir); const label = String(source || "all-sources").toLowerCase().replace(/[^a-z0-9_-]+/g, "-"); let count = 0;
  for (let start = 0; start < rows.length; start += chunkSize) { count += 1; const batchRows = rows.slice(start, start + chunkSize); writeJson(path.join(resolved, `character-options-${label}-${String(count).padStart(3, "0")}.json`), payload(batchRows, { source_filter: source || null, batch: count, offset: start, chunk_size: chunkSize, total_rows_for_filter: rows.length })); }
  return count;
}
function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dataDir) { usage(); process.exit(1); }
  const dataDir = path.resolve(process.cwd(), args.dataDir); const rows = collectRows(dataDir, args.source);
  if (!rows.length) throw new Error(`No character options found in ${dataDir}${args.source ? ` for ${args.source}` : ""}.`);
  console.log(JSON.stringify(summary(rows), null, 2));
  if (args.previewJson) writeJson(path.resolve(process.cwd(), args.previewJson), payload(rows, { source_filter: args.source || null }));
  if (args.outDir) console.log(`Generated ${writeBatches(rows, args.outDir, args.chunkSize, args.source)} reviewed character-option batch file(s).`);
  console.log("Preview/batch generation only. No database writes were performed.");
}
try { main(); } catch (error) { console.error(error); process.exit(1); }
