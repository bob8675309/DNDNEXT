#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function parseNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

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

Reads feats.json, backgrounds.json, races.json, fluff-races.json, and skills.json.
All source versions are retained in the reviewed batches. The application displays one preferred version per name, with XPHB first when present.
This command never writes directly to Supabase.`);
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "option";
}

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
    if (typeof node === "string") {
      const text = clean5eText(node);
      if (text) output.push(text);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node !== "object") return;
    if (node.name && (node.entries || node.entry || node.items)) {
      const label = clean5eText(node.name);
      if (label) output.push(`${label}.`);
    }
    if (node.entry) walk(node.entry);
    if (node.entries) walk(node.entries);
    if (node.items) walk(node.items);
    if (node.rows) walk(node.rows);
    if (node.caption) walk(node.caption);
  }
  walk(entries);
  return output.filter(Boolean).join("\n\n");
}

function shortDescription(entries = []) {
  const text = flattenEntries(entries);
  if (text.length <= 900) return text;
  return `${text.slice(0, 897).trimEnd()}…`;
}

function firstLoreParagraph(entries = []) {
  const candidates = [];
  function walk(node) {
    if (node == null || candidates.length >= 12) return;
    if (typeof node === "string") {
      const text = clean5eText(node);
      if (text.length >= 80 && !/^(source:|creature type|size:|speed:|darkvision:)/i.test(text)) candidates.push(text);
      return;
    }
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node !== "object") return;
    if (node.entries) walk(node.entries);
    if (node.entry) walk(node.entry);
    if (node.items) walk(node.items);
  }
  walk(entries);
  const text = candidates[0] || "";
  if (text.length <= 560) return text;
  const sentenceEnd = text.slice(0, 557).lastIndexOf(". ");
  return `${text.slice(0, sentenceEnd >= 180 ? sentenceEnd + 1 : 557).trimEnd()}…`;
}

function fluffKey(name, source) {
  return `${slugify(name)}|${String(source || "UNK").toUpperCase()}`;
}

function buildRaceFluffIndex(fluffRows = []) {
  const exact = new Map();
  const byName = new Map();
  for (const row of fluffRows) {
    if (!row?.name || !Array.isArray(row.entries)) continue;
    exact.set(fluffKey(row.name, row.source), row);
    const key = slugify(row.name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(row);
  }
  return { exact, byName };
}

function raceFluffFor(row = {}, index = { exact: new Map(), byName: new Map() }) {
  const exact = index.exact.get(fluffKey(row.name || row.raceName, row.source));
  if (exact) return exact;
  const sameName = index.byName.get(slugify(row.name || row.raceName)) || [];
  if (sameName.length === 1) return sameName[0];
  return null;
}

function prerequisiteText(prerequisite) {
  if (!prerequisite) return "";
  return clean5eText(prerequisite);
}

function optionKey(type, name, source) {
  if (type === "skill") return `${slugify(name)}|${String(source || "UNK").toUpperCase()}`;
  return `${type}:${slugify(name)}|${String(source || "UNK").toUpperCase()}`;
}

function sourceMatches(row, source) {
  return !source || String(row?.source || "UNK").toUpperCase() === source;
}

function featType(row = {}) {
  const category = String(row.category || "").toUpperCase();
  const name = String(row.name || "");
  return category === "EB" || /^boon of\b/i.test(name) ? "boon" : "feat";
}

function featRow(row = {}) {
  const optionType = featType(row);
  return {
    option_key: optionKey(optionType, row.name, row.source),
    option_type: optionType,
    name: row.name || "Unknown Feat",
    source: row.source || "UNK",
    category: row.category || null,
    description: shortDescription(row.entries || []),
    prerequisite_text: prerequisiteText(row.prerequisite || []),
    tags: [row.repeatable ? "repeatable" : null, row.category ? `category:${row.category}` : null].filter(Boolean),
    metadata: {
      repeatable: Boolean(row.repeatable),
      ability: row.ability || [],
      additionalSpells: row.additionalSpells || [],
      skillProficiencies: row.skillProficiencies || [],
      toolProficiencies: row.toolProficiencies || [],
      armorProficiencies: row.armorProficiencies || [],
      weaponProficiencies: row.weaponProficiencies || [],
      prerequisite: row.prerequisite || [],
      page: row.page ?? null,
    },
    raw_payload: row,
  };
}

function backgroundRow(row = {}) {
  return {
    option_key: optionKey("background", row.name, row.source),
    option_type: "background",
    name: row.name || "Unknown Background",
    source: row.source || "UNK",
    category: null,
    description: shortDescription(row.entries || []),
    prerequisite_text: "",
    tags: [],
    metadata: {
      abilities: row.ability || [],
      feats: row.feats || [],
      skills: row.skillProficiencies || [],
      tools: row.toolProficiencies || [],
      languages: row.languageProficiencies || [],
      equipment: row.startingEquipment || [],
      page: row.page ?? null,
    },
    raw_payload: row,
  };
}

function speciesRow(row = {}, fluffIndex) {
  const name = row.name || row.raceName || "Unknown Species";
  const fluff = raceFluffFor(row, fluffIndex);
  const lore = firstLoreParagraph(fluff?.entries || []);
  return {
    option_key: optionKey("species", name, row.source),
    option_type: "species",
    name,
    source: row.source || "UNK",
    category: row.lineage || row.creatureTypes?.join(", ") || null,
    description: shortDescription(row.entries || []),
    prerequisite_text: "",
    tags: [row.size ? `size:${clean5eText(row.size)}` : null].filter(Boolean),
    metadata: {
      speed: row.speed || null,
      size: row.size || [],
      creatureTypes: row.creatureTypes || [],
      darkvision: row.darkvision ?? null,
      lineage: row.lineage || null,
      traits: row.entries || [],
      lore,
      loreSource: fluff?.source || null,
      page: row.page ?? null,
    },
    raw_payload: row,
  };
}

function skillRow(row = {}) {
  return {
    option_key: optionKey("skill", row.name, row.source),
    option_type: "skill",
    name: row.name || "Unknown Skill",
    source: row.source || "UNK",
    category: row.ability || null,
    description: shortDescription(row.entries || []),
    prerequisite_text: "",
    tags: row.ability ? [`ability:${row.ability}`] : [],
    metadata: { ability: row.ability || null, page: row.page ?? null },
    raw_payload: row,
  };
}

function collectRows(dataDir, source) {
  const files = {
    feats: readJson(path.join(dataDir, "feats.json")),
    backgrounds: readJson(path.join(dataDir, "backgrounds.json")),
    races: readJson(path.join(dataDir, "races.json")),
    raceFluff: readJson(path.join(dataDir, "fluff-races.json")),
    skills: readJson(path.join(dataDir, "skills.json")),
  };
  const fluffIndex = buildRaceFluffIndex(files.raceFluff.raceFluff || []);
  const rows = [
    ...(files.feats.feat || []).filter((row) => sourceMatches(row, source)).map(featRow),
    ...(files.backgrounds.background || []).filter((row) => sourceMatches(row, source)).map(backgroundRow),
    ...(files.races.race || []).filter((row) => sourceMatches(row, source)).map((row) => speciesRow(row, fluffIndex)),
    ...(files.skills.skill || []).filter((row) => sourceMatches(row, source)).map(skillRow),
  ];
  const unique = new Map();
  rows.forEach((row) => unique.set(row.option_key, row));
  return [...unique.values()].sort((a, b) => a.option_type.localeCompare(b.option_type) || a.name.localeCompare(b.name) || a.source.localeCompare(b.source));
}

function summary(rows = []) {
  const byType = {};
  const bySource = {};
  rows.forEach((row) => {
    byType[row.option_type] = (byType[row.option_type] || 0) + 1;
    bySource[row.source] = (bySource[row.source] || 0) + 1;
  });
  return { options: rows.length, byType, bySource };
}

function payload(rows, extra = {}) {
  return {
    summary: summary(rows),
    meta: { generated_at: new Date().toISOString(), importer: "scripts/import_5etools_character_options.mjs", ...extra },
    rows,
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
  console.log(`Wrote ${filePath}`);
}

function writeBatches(rows, outDir, chunkSize, source) {
  const resolved = path.resolve(process.cwd(), outDir);
  const label = String(source || "all-sources").toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  let count = 0;
  for (let start = 0; start < rows.length; start += chunkSize) {
    count += 1;
    const batchRows = rows.slice(start, start + chunkSize);
    writeJson(path.join(resolved, `character-options-${label}-${String(count).padStart(3, "0")}.json`), payload(batchRows, {
      source_filter: source || null,
      batch: count,
      offset: start,
      chunk_size: chunkSize,
      total_rows_for_filter: rows.length,
    }));
  }
  return count;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dataDir) {
    usage();
    process.exit(1);
  }
  const dataDir = path.resolve(process.cwd(), args.dataDir);
  const rows = collectRows(dataDir, args.source);
  if (!rows.length) throw new Error(`No character options found in ${dataDir}${args.source ? ` for ${args.source}` : ""}.`);
  console.log(JSON.stringify(summary(rows), null, 2));
  if (args.previewJson) writeJson(path.resolve(process.cwd(), args.previewJson), payload(rows, { source_filter: args.source || null }));
  if (args.outDir) console.log(`Generated ${writeBatches(rows, args.outDir, args.chunkSize, args.source)} reviewed character-option batch file(s).`);
  console.log("Preview/batch generation only. No database writes were performed.");
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
