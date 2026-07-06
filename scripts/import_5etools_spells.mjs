#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv) {
  const args = {
    spellsDir: null,
    source: null,
    limit: null,
    previewJson: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--source") args.source = String(argv[++i] || "").toUpperCase();
    else if (arg === "--limit") args.limit = Number(argv[++i] || 0) || null;
    else if (arg === "--preview-json") args.previewJson = argv[++i] || null;
    else if (arg === "--apply") throw new Error("--apply is intentionally disabled in the first spell foundation pass. Review dry-run output first.");
    else if (!args.spellsDir) args.spellsDir = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function usage() {
  console.log(`Usage:
  node scripts/import_5etools_spells.mjs <path-to-data/spells> [--source PHB] [--limit 20]
  node scripts/import_5etools_spells.mjs <path-to-data/spells> --source PHB --limit 20 --preview-json spell-preview.json

This first-pass importer is preview-only. It does not write to Supabase.
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

  const rows = [];
  const effects = [];

  for (const [, file] of entries) {
    const filePath = path.join(spellsDir, file);
    const data = readJson(filePath);
    for (const spell of data.spell || []) {
      const normalized = normalize5etoolsSpell(spell, { sourceFile: file });
      rows.push(normalized.row);
      effects.push(...normalized.effects);
      if (args.limit && rows.length >= args.limit) break;
    }
    if (args.limit && rows.length >= args.limit) break;
  }

  const summary = summarize(rows, effects);
  console.log(JSON.stringify(summary, null, 2));

  const sample = rows.slice(0, Math.min(5, rows.length)).map((row) => ({
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
    fs.writeFileSync(outPath, JSON.stringify({ summary, rows, effects }, null, 2), "utf8");
    console.log(`Preview written to ${outPath}`);
  }

  console.log("Preview only. No database writes were performed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
