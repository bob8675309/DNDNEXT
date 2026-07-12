import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = { input: "", outDir: "class-feature-batches", chunkSize: 500 };
  const rest = [...argv];
  args.input = rest.shift() || "";
  while (rest.length) {
    const flag = rest.shift();
    if (flag === "--out-dir") args.outDir = rest.shift() || args.outDir;
    else if (flag === "--chunk-size") args.chunkSize = Math.max(1, Math.min(500, Number(rest.shift() || 500)));
    else if (flag === "--apply") throw new Error("Preview/batch generation only. Import reviewed JSON through /admin/class-features.");
    else throw new Error(`Unknown argument: ${flag}`);
  }
  return args;
}

function safeText(value) {
  return String(value ?? "").trim();
}

function slug(value) {
  return safeText(value).toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

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
  if (node == null || depth > 20) return [];
  if (typeof node === "string" || typeof node === "number") {
    const text = cleanTags(node);
    return text ? [text] : [];
  }
  if (Array.isArray(node)) return node.flatMap((entry) => flattenEntries(entry, depth + 1));
  if (typeof node !== "object") return [];

  const lines = [];
  const heading = cleanTags(node.name || node.title || "");
  const bodyKeys = ["entry", "entries", "items", "rows", "tables", "options", "list"];
  const hasBody = bodyKeys.some((key) => node[key] != null);
  if (heading && hasBody) lines.push(heading);

  if (node.type === "table" && Array.isArray(node.rows)) {
    for (const row of node.rows) {
      const cells = (Array.isArray(row) ? row : row?.row || []).flatMap((cell) => flattenEntries(cell, depth + 1));
      if (cells.length) lines.push(cells.join(" — "));
    }
  }

  for (const key of bodyKeys) {
    if (key === "rows" && node.type === "table") continue;
    if (node[key] != null) lines.push(...flattenEntries(node[key], depth + 1));
  }

  if (!hasBody) {
    for (const [key, value] of Object.entries(node)) {
      if (["type", "name", "title", "source", "page", "level", "className", "classSource", "subclassName", "subclassShortName", "subclassSource"].includes(key)) continue;
      lines.push(...flattenEntries(value, depth + 1));
    }
  }

  return lines.map(cleanTags).filter(Boolean);
}

function locateClassDirectory(input) {
  const resolved = path.resolve(input || ".");
  const candidates = [resolved, path.join(resolved, "class"), path.join(resolved, "data", "class")];
  const found = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isDirectory());
  if (!found) throw new Error(`Could not find a class data directory under ${resolved}`);
  return found;
}

function featureRow(raw, featureType) {
  const className = safeText(raw.className || raw.class?.name);
  const classSource = safeText(raw.classSource || raw.class?.source || raw.source);
  const source = safeText(raw.source || classSource);
  const name = cleanTags(raw.name);
  const level = Number(raw.level || 0);
  const subclassName = featureType === "subclass" ? safeText(raw.subclassName || raw.subclassShortName) : "";
  const subclassShortName = featureType === "subclass" ? safeText(raw.subclassShortName || raw.subclassName) : "";
  if (!className || !classSource || !source || !name || level < 1 || level > 20) return null;

  const lines = flattenEntries(raw.entries || raw.entry || []);
  const description = [...new Set(lines)].join("\n\n").trim();
  const classKey = slug(className);
  const featureKey = [featureType, classKey, classSource, subclassShortName, name, source, level].map(slug).join(":");

  return {
    feature_key: featureKey,
    feature_type: featureType,
    name,
    source,
    class_key: classKey,
    class_name: className,
    class_source: classSource,
    subclass_name: subclassName || null,
    subclass_short_name: subclassShortName || null,
    level,
    description: description || null,
    entries: Array.isArray(raw.entries) ? raw.entries : raw.entry != null ? [raw.entry] : [],
    raw_payload: {
      page: raw.page ?? null,
      header: raw.header ?? null,
      isClassFeatureVariant: Boolean(raw.isClassFeatureVariant),
      otherSources: raw.otherSources || [],
      importedFrom: "5etools_class_feature",
    },
  };
}

function readRows(classDir) {
  const files = fs.readdirSync(classDir)
    .filter((name) => /^class-.+\.json$/i.test(name))
    .sort((a, b) => a.localeCompare(b));
  const byKey = new Map();

  for (const filename of files) {
    const fullPath = path.join(classDir, filename);
    const json = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    for (const raw of Array.isArray(json.classFeature) ? json.classFeature : []) {
      const row = featureRow(raw, "class");
      if (!row) continue;
      const current = byKey.get(row.feature_key);
      if (!current || safeText(row.description).length > safeText(current.description).length) byKey.set(row.feature_key, row);
    }
    for (const raw of Array.isArray(json.subclassFeature) ? json.subclassFeature : []) {
      const row = featureRow(raw, "subclass");
      if (!row) continue;
      const current = byKey.get(row.feature_key);
      if (!current || safeText(row.description).length > safeText(current.description).length) byKey.set(row.feature_key, row);
    }
  }

  return [...byKey.values()].sort((a, b) =>
    a.class_name.localeCompare(b.class_name)
    || a.class_source.localeCompare(b.class_source)
    || safeText(a.subclass_name).localeCompare(safeText(b.subclass_name))
    || a.level - b.level
    || a.name.localeCompare(b.name)
  );
}

function writeBatches(rows, outDir, chunkSize) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const name of fs.readdirSync(outDir)) {
    if (/^class-features-all-sources-\d+\.json$/i.test(name)) fs.rmSync(path.join(outDir, name));
  }
  const total = Math.ceil(rows.length / chunkSize);
  for (let index = 0; index < total; index += 1) {
    const batchRows = rows.slice(index * chunkSize, (index + 1) * chunkSize);
    const payload = {
      kind: "class_feature_batch",
      generated_at: new Date().toISOString(),
      source: "ALL",
      batch: index + 1,
      batches: total,
      rows: batchRows,
    };
    const filename = `class-features-all-sources-${String(index + 1).padStart(3, "0")}.json`;
    fs.writeFileSync(path.join(outDir, filename), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(`Wrote ${path.join(outDir, filename)}`);
  }
}

const args = parseArgs(process.argv.slice(2));
if (!args.input) throw new Error("Usage: node scripts/import_5etools_class_features.mjs <5etools data or class directory> [--out-dir class-feature-batches] [--chunk-size 500]");
const classDir = locateClassDirectory(args.input);
const rows = readRows(classDir);
if (!rows.length) throw new Error(`No classFeature or subclassFeature records were found in ${classDir}`);

const summary = {
  features: rows.length,
  classFeatures: rows.filter((row) => row.feature_type === "class").length,
  subclassFeatures: rows.filter((row) => row.feature_type === "subclass").length,
  classes: [...new Set(rows.map((row) => `${row.class_name}|${row.class_source}`))].length,
  subclasses: [...new Set(rows.filter((row) => row.subclass_name).map((row) => `${row.class_name}|${row.class_source}|${row.subclass_name}`))].length,
};
console.log(JSON.stringify(summary, null, 2));
console.table(rows.slice(0, 8).map((row) => ({ type: row.feature_type, class: row.class_name, source: row.class_source, subclass: row.subclass_name || "", level: row.level, name: row.name })));
writeBatches(rows, path.resolve(args.outDir), args.chunkSize);
console.log("Preview/batch generation complete. No database writes were performed.");
