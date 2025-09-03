#!/usr/bin/env node
// dedupe_index_stdin.mjs
// Usage:
//   Paste-in mode (recommended):
//     node dedupe_index_stdin.mjs > items_indexed.json
//     [PASTE your mega-file contents]
//     Then press Ctrl+D (macOS/Linux) or Ctrl+Z then Enter (Windows) to end input.
//
//   File mode:
//     node dedupe_index_stdin.mjs raw_catalog.txt > items_indexed.json
//
// This script:
//  - parses every "Name": { "flavor": "..." } pair from messy JSON-ish text
//  - keeps the LAST (newest) occurrence of each Name
//  - drops Lantern of Tracking variants into a single consolidated note (per your design choice)
//  - emits a numbered list you can sort/scan for quick diffing

import fs from 'node:fs/promises';

const argPath = process.argv[2] ?? null;

async function readAll() {
  if (!argPath || argPath === '-') {
    // read from stdin
    const chunks = [];
    await new Promise((resolve, reject) => {
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', c => chunks.push(c));
      process.stdin.on('end', resolve);
      process.stdin.on('error', reject);
    });
    return chunks.join('');
  }
  return fs.readFile(argPath, 'utf8');
}

function normalizeName(name) {
  return name.trim();
}

function isSectionHeader(name) {
  // Things like "== MELEE WEAPONS =="
  return /^==.*==$/u.test(name.trim());
}

function isLanternTrackingVariant(name) {
  return /^Lantern of Tracking \(/u.test(name);
}

function parseItems(raw) {
  // Grab all Name + flavor pairs, tolerating other keys in the object
  const rx = /"([^"\n]+)"\s*:\s*\{[^{}]*?"flavor"\s*:\s*"((?:[^"\\]|\\.)*?)"/gmsu;
  const latest = new Map(); // name -> { flavor, order }
  let order = 0;
  for (const m of raw.matchAll(rx)) {
    const name = normalizeName(m[1]);
    const flavor = m[2]
      .replace(/\r?\n\s*/g, ' ') // collapse newlines within flavor
      .replace(/\s{2,}/g, ' ')     // collapse double spaces
      .trim();

    if (!name || isSectionHeader(name)) continue;

    // Keep the last (newest) entry seen for a given name
    latest.set(name, { flavor, order: order++ });
  }
  return latest;
}

function buildOutputMap(latest) {
  // Remove undesired variants and record what we dropped
  const removed = [];
  for (const name of Array.from(latest.keys())) {
    if (isLanternTrackingVariant(name)) {
      latest.delete(name);
      removed.push(name);
    }
  }

  // Sort stable by name for easier scanning (you can change to order to keep source-order)
  const names = Array.from(latest.keys()).sort((a, b) => a.localeCompare(b));

  // Assign numeric ids from 1..N
  const items = names.map((name, i) => ({ id: i + 1, name, flavor: latest.get(name).flavor }));

  return {
    version: 1,
    note: "IDs assigned alphabetically by item name. Duplicates were collapsed by keeping the newest (last) appearance in the source.",
    count: items.length,
    items,
    removed: {
      consolidated: "Lantern of Tracking (variants removed per design; treat as a single magic variant elsewhere)",
      names: removed.sort((a, b) => a.localeCompare(b))
    }
  };
}

(async () => {
  try {
    const raw = await readAll();
    if (!raw || raw.trim().length === 0) {
      console.error('No input text detected. Paste your mega-file contents, or pass a path to a text file.');
      process.exit(2);
    }

    const latest = parseItems(raw);
    const out = buildOutputMap(latest);
    process.stdout.write(JSON.stringify(out, null, 2));
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
})();
