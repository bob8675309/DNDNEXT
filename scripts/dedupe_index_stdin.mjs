#!/usr/bin/env node
// dedupe_index_stdin.mjs
// Read a messy catalog dump (either from a file path arg or from STDIN),
// extract all entries shaped like:
//   "Item Name": { "flavor": "..." }
// Keep ONLY the newest occurrence per name, optionally drop Lantern of Tracking variants,
// and emit a clean JSON with numeric IDs for easy indexing.
//
// Usage examples:
//   node dedupe_index_stdin.mjs raw_catalog.txt --out items_indexed.json
//   node dedupe_index_stdin.mjs --out items_indexed.json   # then paste, end with Ctrl+Z (Win) or Ctrl+D (macOS/Linux)
//   node dedupe_index_stdin.mjs < raw_catalog.txt > items_indexed.json
//   node dedupe_index_stdin.mjs raw_catalog.txt --report duplicates.csv
//
// Flags:
//   --out <path>              Write result JSON to a file. If omitted, prints to stdout.
//   --start <n>               First numeric index (default 1).
//   --ns <prefix>             ID prefix (default "ITM-").
//   --dropLanternVariants     Remove Lantern of Tracking (Fiends/Undead/Aberrations) rows.
//   --report <path>           Also emit a CSV of duplicates that were collapsed.

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (['out', 'start', 'ns', 'report'].includes(key)) {
        i++;
        if (i >= argv.length) throw new Error(`Missing value for --${key}`);
        out[key] = argv[i];
      } else if (key === 'dropLanternVariants') {
        out.dropLanternVariants = true;
      } else {
        throw new Error(`Unknown flag: ${a}`);
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

async function readInput(possiblePath) {
  if (possiblePath) {
    if (!existsSync(possiblePath)) {
      throw new Error(`Input file not found: ${possiblePath}`);
    }
    return fs.readFile(possiblePath, 'utf8');
  }
  // Read from STDIN until EOF
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return chunks.join('');
}

function extractLatestByName(raw, { dropLanternVariants = false } = {}) {
  // Grab every \"name\": { "flavor": "..." } block. This ignores section markers.
  const re = /"([^"\n][^\"]*?)"\s*:\s*\{[^{}]*?\"flavor\"\s*:\s*\"((?:\\.|[^\\\"])*)\"[^{}]*?\}/gms;
  const keep = new Map(); // name -> { flavor, index }
  const dupCount = new Map();
  let order = 0;

  const dropRE = /^(?:Lantern of Tracking)\s*\((?:Fiends|Undead|Aberrations)\)$/i;

  for (const m of raw.matchAll(re)) {
    const name = m[1].trim();
    const flavor = m[2].replace(/\\n/g, '\n');
    if (dropLanternVariants && dropRE.test(name)) continue;

    if (keep.has(name)) {
      dupCount.set(name, (dupCount.get(name) || 1) + 1);
    } else {
      dupCount.set(name, 1);
    }
    keep.set(name, { flavor, order: order++ }); // overwrite = keep newest
  }

  return { keep, dupCount };
}

function buildIndexedJSON(keep, { start = 1, ns = 'ITM-' } = {}) {
  const names = [...keep.keys()].sort((a, b) => a.localeCompare(b));
  const width = String(start + names.length - 1).length;
  const items = names.map((name, i) => {
    const id = ns + String(start + i).padStart(width, '0');
    const { flavor } = keep.get(name);
    return { id, name, flavor };
  });
  return {
    meta: {
      generatedAt: new Date().toISOString(),
      count: items.length,
      idPrefix: ns,
      startIndex: start,
    },
    items,
  };
}

async function writeDuplicatesCSV(path, dupCount) {
  const rows = [['name', 'occurrences']];
  for (const [name, count] of [...dupCount.entries()].filter(([, c]) => c > 1).sort()) {
    rows.push([name, String(count)]);
  }
  const csv = rows.map(r => r.map(v => '"' + v.replaceAll('"', '""') + '"').join(',')).join('\n');
  await fs.writeFile(path, csv, 'utf8');
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const inPath = args._[0];
    const raw = await readInput(inPath);

    if (!raw || !raw.trim()) {
      console.error('No input provided. Paste the catalog text or pass a file path.');
      process.exit(2);
    }

    const { keep, dupCount } = extractLatestByName(raw, {
      dropLanternVariants: !!args.dropLanternVariants,
    });

    const start = args.start ? Number(args.start) : 1;
    if (Number.isNaN(start) || start < 0) throw new Error('--start must be a non-negative number');

    const ns = args.ns || 'ITM-';
    const outJSON = buildIndexedJSON(keep, { start, ns });
    const output = JSON.stringify(outJSON, null, 2);

    if (args.out) {
      await fs.writeFile(args.out, output, 'utf8');
      console.error(`Wrote ${outJSON.meta.count} items → ${args.out}`);
    } else {
      // Print to stdout
      process.stdout.write(output + '\n');
      console.error(`Wrote ${outJSON.meta.count} items to stdout`);
    }

    if (args.report) {
      await writeDuplicatesCSV(args.report, dupCount);
      console.error(`Duplicate report → ${args.report}`);
    }
  } catch (err) {
    console.error(err instanceof Error ? `Error: ${err.message}` : String(err));
    process.exit(1);
  }
}

main();
