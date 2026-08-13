import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = { input: "", outDir: "class-feature-option-batches", chunkSize: 250 };
  const rest = [...argv];
  args.input = rest.shift() || "";
  while (rest.length) {
    const flag = rest.shift();
    if (flag === "--out-dir") args.outDir = rest.shift() || args.outDir;
    else if (flag === "--chunk-size") args.chunkSize = Math.max(1, Math.min(500, Number(rest.shift() || 250)));
    else if (flag === "--apply") throw new Error("Preview/batch generation only. Import reviewed JSON through public.import_class_feature_option_batch_v1.");
    else throw new Error(`Unknown argument: ${flag}`);
  }
  return args;
}

const safeText = (value) => String(value ?? "").trim();
const slug = (value) => safeText(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const array = (value) => Array.isArray(value) ? value : [];
const unique = (values) => [...new Set(array(values).map(safeText).filter(Boolean))];

function cleanTags(value) {
  return safeText(value)
    .replace(/\{@dc\s+([^}]+)}/gi, "DC $1")
    .replace(/\{@hit\s+([^}]+)}/gi, "$1")
    .replace(/\{@(?:b|i|u|s|sup|sub|note)\s+([^}]+)}/gi, "$1")
    .replace(/\{@(?:dice|damage|scaledice|scaledamage)\s+([^}|]+)(?:\|[^}]*)?}/gi, "$1")
    .replace(/\{@[^\s}]+\s+([^}|]+)(?:\|[^}]*)?}/g, "$1")
    .replace(/\{@[^}]+}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function flattenEntries(node, depth = 0) {
  if (node == null || depth > 24) return [];
  if (typeof node === "string" || typeof node === "number") {
    const text = cleanTags(node);
    return text ? [text] : [];
  }
  if (Array.isArray(node)) return node.flatMap((entry) => flattenEntries(entry, depth + 1));
  if (typeof node !== "object") return [];
  const lines = [];
  const heading = cleanTags(node.name || node.title || "");
  const bodyKeys = ["entry", "entries", "items", "rows"];
  if (heading && bodyKeys.some((key) => node[key] != null)) lines.push(heading);
  for (const key of bodyKeys) if (node[key] != null) lines.push(...flattenEntries(node[key], depth + 1));
  return lines.filter(Boolean);
}

function walk(node, visit) {
  if (node == null) return;
  if (Array.isArray(node)) return node.forEach((entry) => walk(entry, visit));
  if (typeof node !== "object") return;
  visit(node);
  Object.values(node).forEach((value) => walk(value, visit));
}

function hasNamedSection(raw, name) {
  let found = false;
  walk(raw?.entries, (node) => {
    if (safeText(node?.name).toLowerCase() === name.toLowerCase()) found = true;
  });
  return found;
}

function optionType(featureTypes = []) {
  const types = new Set(array(featureTypes).map((value) => safeText(value).toUpperCase()));
  if (types.has("EI")) return "eldritch-invocation";
  if (types.has("MM")) return "metamagic";
  if (types.has("MV:B") || types.has("MV")) return "battle-master-maneuver";
  if (types.has("AS")) return "arcane-shot";
  if (types.has("AI")) return "artificer-infusion";
  if ([...types].some((type) => type.startsWith("FS"))) return "fighting-style";
  return "optional-feature";
}

function classKey(featureTypes = [], prerequisites = []) {
  for (const prerequisite of array(prerequisites)) {
    const key = slug(prerequisite?.level?.class?.name || prerequisite?.class?.name);
    if (key) return key;
  }
  const type = optionType(featureTypes);
  if (type === "eldritch-invocation") return "warlock";
  if (type === "metamagic") return "sorcerer";
  if (["battle-master-maneuver", "arcane-shot"].includes(type)) return "fighter";
  if (type === "artificer-infusion") return "artificer";
  return null;
}

function normalizedPrerequisites(raw = {}) {
  const prerequisites = array(raw.prerequisite);
  const levels = [];
  const requiresOptions = [];
  const pactNames = { blade: "Pact of the Blade", chain: "Pact of the Chain", tome: "Pact of the Tome" };
  for (const prerequisite of prerequisites) {
    const level = Number(prerequisite?.level?.level || 0);
    if (level > 0) levels.push(level);
    const pact = safeText(prerequisite?.pact).toLowerCase();
    if (pact && pactNames[pact]) requiresOptions.push(pactNames[pact]);
    array(prerequisite?.feature).forEach((value) => {
      const name = cleanTags(value).split("|")[0].trim();
      if (name) requiresOptions.push(name);
    });
  }
  const output = {};
  if (levels.length) output.minClassLevel = Math.max(...levels);
  if (requiresOptions.length) output.requiresOptions = unique(requiresOptions);
  if (prerequisites.length) output.source = prerequisites;
  return output;
}

function choiceSchema(raw = {}) {
  const schema = {};
  const prerequisites = array(raw.prerequisite);
  const spellChoices = [];
  for (const prerequisite of prerequisites) {
    for (const spell of array(prerequisite?.spell)) {
      if (spell && typeof spell === "object" && safeText(spell.choose)) {
        spellChoices.push({
          choose: safeText(spell.choose),
          label: safeText(spell.entrySummary || spell.entry || "Spell choice"),
        });
      }
    }
  }
  if (spellChoices.length) schema.spellChoices = spellChoices;
  if (Array.isArray(raw.featProgression) && raw.featProgression.length) schema.featProgression = raw.featProgression;
  if (hasNamedSection(raw, "Repeatable")) schema.distinctPerRepeat = true;
  return schema;
}

function rowFromOptionalFeature(raw = {}) {
  const name = cleanTags(raw.name);
  const source = safeText(raw.source);
  if (!name || !source) return null;
  const featureTypes = unique(raw.featureType);
  const type = optionType(featureTypes);
  return {
    option_key: `optional-feature:${slug(name)}|${source.toUpperCase()}`,
    option_type: type,
    name,
    source,
    class_key: classKey(featureTypes, raw.prerequisite),
    feature_types: featureTypes,
    page: Number.isFinite(Number(raw.page)) ? Number(raw.page) : null,
    description: unique(flattenEntries(raw.entries || raw.entry || [])).join("\n\n") || null,
    prerequisites: normalizedPrerequisites(raw),
    additional_spells: array(raw.additionalSpells),
    repeatable: hasNamedSection(raw, "Repeatable"),
    choice_schema: choiceSchema(raw),
    metadata: {
      sourceFile: "data/optionalfeatures.json",
      consumes: raw.consumes || null,
      isClassFeatureVariant: Boolean(raw.isClassFeatureVariant),
      reprintedAs: raw.reprintedAs || [],
    },
    raw_payload: raw,
  };
}

function readRows(input) {
  const file = path.resolve(input);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error(`Optional feature input file not found: ${file}`);
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  const rows = array(json.optionalfeature).map(rowFromOptionalFeature).filter(Boolean);
  const byKey = new Map();
  for (const row of rows) {
    const existing = byKey.get(row.option_key);
    if (!existing || safeText(row.description).length > safeText(existing.description).length) byKey.set(row.option_key, row);
  }
  return [...byKey.values()].sort((a, b) => a.option_type.localeCompare(b.option_type) || a.name.localeCompare(b.name) || a.source.localeCompare(b.source));
}

function writeBatches(rows, outDir, chunkSize) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const name of fs.readdirSync(outDir)) {
    if (/^class-feature-options-\d+\.json$/i.test(name)) fs.rmSync(path.join(outDir, name));
  }
  const total = Math.ceil(rows.length / chunkSize);
  for (let index = 0; index < total; index += 1) {
    const batchRows = rows.slice(index * chunkSize, (index + 1) * chunkSize);
    const payload = {
      kind: "class_feature_option_batch",
      generated_at: new Date().toISOString(),
      source: "5etools optionalfeatures.json",
      batch: index + 1,
      batches: total,
      rows: batchRows,
    };
    const filename = `class-feature-options-${String(index + 1).padStart(3, "0")}.json`;
    fs.writeFileSync(path.join(outDir, filename), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(`Wrote ${path.join(outDir, filename)}`);
  }
}

const args = parseArgs(process.argv.slice(2));
if (!args.input) throw new Error("Usage: node scripts/import_5etools_optional_features.mjs <optionalfeatures.json> [--out-dir class-feature-option-batches] [--chunk-size 250]");
const rows = readRows(args.input);
if (!rows.length) throw new Error("No optionalfeature records were found in the supplied JSON file.");
const summary = rows.reduce((output, row) => {
  output[row.option_type] = (output[row.option_type] || 0) + 1;
  return output;
}, {});
console.log(JSON.stringify({ options: rows.length, byType: summary }, null, 2));
console.table(rows.slice(0, 12).map((row) => ({ type: row.option_type, name: row.name, source: row.source, class: row.class_key || "" })));
writeBatches(rows, path.resolve(args.outDir), args.chunkSize);
console.log("Preview/batch generation complete. No database writes were performed.");
