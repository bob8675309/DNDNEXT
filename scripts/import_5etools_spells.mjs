#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { normalize5etoolsSpell } from "../utils/spells/normalize5etoolsSpell.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(argv) {
  const args = {
    spellsDir: null,
    source: null,
    limit: null,
    apply: false,
    previewJson: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--source") args.source = String(argv[++i] || "").toUpperCase();
    else if (arg === "--limit") args.limit = Number(argv[++i] || 0) || null;
    else if (arg === "--apply") args.apply = true;
    else if (arg === "--preview-json") args.previewJson = argv[++i] || null;
    else if (!args.spellsDir) args.spellsDir = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function usage() {
  console.log(`Usage:
  node scripts/import_5etools_spells.mjs <path-to-data/spells> [--source PHB] [--limit 20] [--preview-json out.json]
  node scripts/import_5etools_spells.mjs <path-to-data/spells> --source PHB --apply

Dry-run is the default. --apply writes to Supabase and requires:
  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY

Examples:
  node scripts/import_5etools_spells.mjs "C:\\Users\\pcwil\\Downloads\\5etools-src-2.32.0\\data\\spells" --source PHB --limit 10
  node scripts/import_5etools_spells.mjs "C:\\Users\\pcwil\\Downloads\\5etools-src-2.32.0\\data\\spells" --source PHB --apply
`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sourceEntries(index, requestedSource) {
  const entries = Object.entries(index)
    .filter(([source, file]) => /^spells-/i.test(file) && !/^fluff-/i.test(file));
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

async function applyToSupabase(rows, effects) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error("Missing Supabase URL/service key environment variables.");

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: upserted, error: spellError } = await supabase
    .from("spells_catalog")
    .upsert(rows, { onConflict: "spell_key" })
    .select("id,spell_key");

  if (spellError) throw spellError;

  const idByKey = new Map((upserted || []).map((row) => [row.spell_key, row.id]));
  const keys = rows.map((row) => row.spell_key);
  const ids = [...idByKey.values()];

  if (ids.length) {
    const { error: deleteError } = await supabase.from("spell_effects").delete().in("spell_id", ids);
    if (deleteError) throw deleteError;
  }

  const effectRows = effects
    .map(({ spell_key, ...effect }) => ({ ...effect, spell_id: idByKey.get(spell_key) }))
    .filter((effect) => effect.spell_id);

  if (effectRows.length) {
    const { error: effectError } = await supabase.from("spell_effects").insert(effectRows);
    if (effectError) throw effectError;
  }

  return { spells: upserted?.length || 0, effects: effectRows.length };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.spellsDir) {
    usage();
    process.exit(1);
  }

  const spellsDir = path.resolve(process.cwd(), args.spellsDir);
  const indexPath = path.join(spellsDir, "index.json");
  if (!fs.existsSync(indexPath)) throw new Error(`Could not find index.json in ${spellsDir}`);

  const index = readJson(indexPath);
  const entries = sourceEntries(index, args.source);
  if (!entries.length) throw new Error(`No spell source files matched${args.source ? ` source ${args.source}` : ""}.`);

  const rows = [];
  const effects = [];

  for (const [source, file] of entries) {
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

  if (!args.apply) {
    console.log("Dry run only. Add --apply to write to Supabase after reviewing the preview.");
    return;
  }

  const applied = await applyToSupabase(rows, effects);
  console.log(`Applied ${applied.spells} spells and ${applied.effects} effects to Supabase.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
