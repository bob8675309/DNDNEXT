#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function parseArgs(argv) {
  const args = {
    spellsDir: null,
    source: null,
    limit: null,
    offset: 0,
    previewJson: null,
    outDir: null,
    chunkSize: 250,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--source") args.source = String(argv[++i] || "").toUpperCase();
    else if (arg === "--limit") args.limit = parseNumber(argv[++i], null);
    else if (arg === "--offset") args.offset = parseNumber(argv[++i], 0);
    else if (arg === "--preview-json") args.previewJson = argv[++i] || null;
    else if (arg === "--out-dir") args.outDir = argv[++i] || null;
    else if (arg === "--chunk-size") args.chunkSize = Math.max(1, Math.min(250, parseNumber(argv[++i], 250)));
    else if (arg === "--apply") throw new Error("--apply is intentionally disabled. Use the admin Magic page controlled import instead.");
    else if (!args.spellsDir) args.spellsDir = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function usage() {
  console.log(`Usage:
  node scripts/import_5etools_spells.mjs <path-to-data/spells> [--source PHB] [--limit 20] [--offset 0]
  node scripts/import_5etools_spells.mjs <path-to-data/spells> --source PHB --limit 20 --preview-json spell-preview.json
  node scripts/import_5etools_spells.mjs <path-to-data/spells> --source PHB --out-dir spell-batches --chunk-size 250

This importer is preview/batch-file only. It never writes directly to Supabase.
Upload reviewed JSON batches through Admin > Magic.
`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function loadNormalizer() {
  const normalizerPath = path.resolve(__dirname, "../utils/spells/normalize5etoolsSpell.js");
  if (!fs.existsSync(normalizerPath)) throw new Error(`Could not find normalizer at ${normalizerPath}`);
  const source = fs.readFileSync(normalizerPath, "utf8");
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source, "utf8").toString("base64")}`;
  return import(moduleUrl);
}

function sourceEntries(index, requestedSource) {
  const entries = Object.entries(index)
    .filter(([, file]) => /^spells-/i.test(file) && !/^fluff-/i.test(file));
  if (!requestedSource) return entries;
  return entries.filter(([source]) => source.toUpperCase() === requestedSource);
}

function summarize(rows, effects) {
  const byLevel = new Map();
  const bySource = new Map();
  for (const row of rows) {
    byLevel.set(row.level, (byLevel.get(row.level) || 0) + 1);
    bySource.set(row.source, (bySource.get(row.source) || 0) + 1);
  }
  return {
    spells: rows.length,
    effects: effects.length,
    byLevel: Object.fromEntries([...byLevel.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))),
    bySource: Object.fromEntries([...bySource.entries()].sort()),
  };
}

function packagePayload(rows, effects, extra = {}) {
  const spellKeys = new Set(rows.map((row) => row.spell_key));
  const packagedEffects = effects.filter((effect) => spellKeys.has(effect.spell_key));
  return {
    summary: summarize(rows, packagedEffects),
    meta: {
      generated_at: new Date().toISOString(),
      importer: "scripts/import_5etools_spells.mjs",
      ...extra,
    },
    rows,
    effects: packagedEffects,
  };
}

function safeSourceName(source) {
  return String(source || "all").toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

function writeJsonFile(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${filePath}`);
}

function writeBatches({ rows, effects, outDir, chunkSize, source }) {
  if (!outDir) return [];
  const written = [];
  const cleanSource = safeSourceName(source || "all-sources");
  const resolvedOutDir = path.resolve(process.cwd(), outDir);

  for (let start = 0, batch = 1; start < rows.length; start += chunkSize, batch += 1) {
    const batchRows = rows.slice(start, start + chunkSize);
    const payload = packagePayload(batchRows, effects, {
      source_filter: source || null,
      batch,
      offset: start,
      chunk_size: chunkSize,
      total_rows_for_filter: rows.length,
    });
    const filePath = path.join(resolvedOutDir, `spell-preview-${cleanSource}-${String(batch).padStart(3, "0")}.json`);
    writeJsonFile(filePath, payload);
    written.push(filePath);
  }

  return written;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.spellsDir) {
    usage();
    process.exit(1);
  }

  const { normalize5etoolsSpell } = await loadNormalizer();
  const spellsDir = path.resolve(process.cwd(), args.spellsDir);
  const indexPath = path.join(spellsDir, "index.json");
  if (!fs.existsSync(indexPath)) throw new Error(`Could not find index.json in ${spellsDir}`);

  const index = readJson(indexPath);
  const entries = sourceEntries(index, args.source);
  if (!entries.length) throw new Error(`No spell source files matched${args.source ? ` source ${args.source}` : ""}.`);

  const allRows = [];
  const allEffects = [];

  for (const [, file] of entries) {
    const filePath = path.join(spellsDir, file);
    const data = readJson(filePath);
    for (const spell of data.spell || []) {
      const normalized = normalize5etoolsSpell(spell, { sourceFile: file });
      allRows.push(normalized.row);
      allEffects.push(...normalized.effects);
    }
  }

  const selectedRows = allRows.slice(args.offset, args.limit ? args.offset + args.limit : undefined);
  const selectedKeys = new Set(selectedRows.map((row) => row.spell_key));
  const selectedEffects = allEffects.filter((effect) => selectedKeys.has(effect.spell_key));
  const payload = packagePayload(selectedRows, selectedEffects, {
    source_filter: args.source || null,
    offset: args.offset,
    limit: args.limit,
    total_rows_for_filter: allRows.length,
  });

  console.log(JSON.stringify(payload.summary, null, 2));

  const sample = selectedRows.slice(0, Math.min(5, selectedRows.length)).map((row) => ({
    spell_key: row.spell_key,
    name: row.name,
    level: row.level,
    school: row.school,
    casting_time: row.casting_time,
    range_text: row.range_text,
    duration_text: row.duration_text,
    damage_dice: row.damage_dice,
    damage_types: row.damage_types,
    save: row.saving_throw_abilities,
  }));
  console.table(sample);

  if (args.previewJson) {
    const outPath = path.resolve(process.cwd(), args.previewJson);
    writeJsonFile(outPath, payload);
  }

  if (args.outDir) {
    const written = writeBatches({ rows: selectedRows, effects: selectedEffects, outDir: args.outDir, chunkSize: args.chunkSize, source: args.source });
    console.log(`Generated ${written.length} reviewed-import batch file(s).`);
  }

  console.log("Preview/batch generation only. No database writes were performed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
