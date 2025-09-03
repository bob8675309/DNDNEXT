// dedupe_overrides.mjs
// Assigns stable numeric IDs to item names in a messy/duplicate-filled
// flavor-overrides.json, and emits a clean index plus (optionally) a
// duplicates report.
//
// Usage (from C:\\DND\\scripts):
//   node dedupe_overrides.mjs \
//      --in ..\\public\\items\\flavor-overrides.json \
//      --out items_indexed.json \
//      --report duplicates.csv
//
// If --in is omitted, the script will try a few likely defaults.
//
// Flags:
//   --in <file>           Path to the (possibly malformed) overrides file
//   --out <file>          Where to write the indexed JSON (required)
//   --report <file>       Optional CSV report of duplicates
//   --ns <prefix>         ID namespace/prefix (default: ITM-)
//   --start <n>           First numeric ID to use (default: 1)
//   --sort <mode>         name | firstSeen (default: firstSeen)
//   --dropLanternVariants Drop entries that start with "Lantern of Tracking ("
//
// Output JSON shape:
// {
//   "meta": { source, generatedAt, count },
//   "items": [ { id, name, flavor }, ... ],
//   "byName": { "Name": "ID", ... }
// }

import { promises as fs } from 'node:fs';
import path from 'node:path';

function parseArgv(argv) {
  const opts = {
    in: null,
    out: null,
    report: null,
    ns: 'ITM-',
    start: 1,
    sort: 'firstSeen',
    dropLanternVariants: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--in') opts.in = argv[++i];
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--report') opts.report = argv[++i];
    else if (a === '--ns') opts.ns = argv[++i];
    else if (a === '--start') opts.start = Number(argv[++i] ?? '1') || 1;
    else if (a === '--sort') opts.sort = (argv[++i] || 'firstSeen');
    else if (a === '--dropLanternVariants') opts.dropLanternVariants = true;
    else if (a.startsWith('--')) throw new Error(`Unknown flag: ${a}`);
  }
  return opts;
}

async function autoLocateInput(cwd) {
  const guesses = [
    'flavor-overrides.json',
    path.join('..', 'public', 'items', 'flavor-overrides.json'),
    path.join('..', 'items', 'flavor-overrides.json'),
    path.join('items', 'flavor-overrides.json'),
  ];
  for (const g of guesses) {
    try {
      const p = path.resolve(cwd, g);
      await fs.access(p);
      return p;
    } catch {}
  }
  return null;
}

function tryStrictJSON(text) {
  try {
    const obj = JSON.parse(text);
    if (!obj || typeof obj !== 'object') return null;
    // Expect obj.items to be a map of name -> { flavor } (sections may exist)
    if (obj.items && typeof obj.items === 'object') {
      const out = [];
      for (const [name, val] of Object.entries(obj.items)) {
        if (val && typeof val === 'object' && 'flavor' in val && !val.section) {
          out.push({ name, flavor: String(val.flavor) });
        }
      }
      return out;
    }
    return null;
  } catch {
    return null;
  }
}

// Extremely forgiving salvage parser: scans the entire text for any
// "Name": { "flavor": "..." } blocks, ignoring section markers.
function salvageParse(text) {
  const items = [];
  const objEntryRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"\s*:\s*\{\s*([^}]*?)\s*}/gs; // "Key": { body }
  let m;
  while ((m = objEntryRegex.exec(text))) {
    const rawName = m[1];
    const body = m[2];
    // Skip sections or disabled stubs
    if (/\bsection\s*:\s*true\b/i.test(body)) continue;
    if (!/\bflavor\s*:\s*"/i.test(body)) continue;

    const flavorMatch = body.match(/\bflavor\s*:\s*"((?:[^"\\]|\\.)*)"/s);
    if (!flavorMatch) continue;

    // Unescape with JSON.parse on a quoted string
    let name, flavor;
    try {
      name = JSON.parse('"' + rawName + '"');
      flavor = JSON.parse('"' + flavorMatch[1] + '"');
    } catch {
      // Fallback: crude unescape
      name = rawName.replace(/\\"/g, '"');
      flavor = flavorMatch[1].replace(/\\"/g, '"');
    }

    items.push({ name, flavor });
  }
  return items;
}

function normalize(items, { dropLanternVariants }) {
  const seen = new Map(); // name -> { idx, flavor }
  const order = [];       // first-seen order of unique names
  const dups = [];        // { name, firstIndex, dupeIndex, same, keptFlavor, dupeFlavor }

  const shouldDrop = (name) => dropLanternVariants && /^Lantern of Tracking \(/i.test(name);

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (!it || !it.name) continue;
    if (shouldDrop(it.name)) continue;
    if (!it.flavor || !String(it.flavor).trim()) continue;

    if (!seen.has(it.name)) {
      const idx = order.length;
      seen.set(it.name, { idx, flavor: it.flavor });
      order.push(it.name);
    } else {
      const { idx, flavor: keptFlavor } = seen.get(it.name);
      const same = (String(keptFlavor).trim() === String(it.flavor).trim());
      dups.push({
        name: it.name,
        firstIndex: idx,
        dupeIndex: i,
        same,
        keptFlavor: keptFlavor,
        dupeFlavor: it.flavor,
      });
    }
  }
  return { seen, order, dups };
}

function assignIds(order, ns, start) {
  const pad = String(start + order.length - 1).length; // minimal padding
  const ids = new Map();
  for (let i = 0; i < order.length; i++) {
    const n = start + i;
    const id = ns + String(n).padStart(pad, '0');
    ids.set(order[i], id);
  }
  return ids;
}

function toJSONIndex(seen, order, ids, sourcePath) {
  const items = order.map((name) => ({ id: ids.get(name), name, flavor: seen.get(name).flavor }));
  const byName = Object.fromEntries(order.map((name) => [name, ids.get(name)]));
  return {
    meta: {
      source: sourcePath,
      generatedAt: new Date().toISOString(),
      count: items.length,
    },
    items,
    byName,
  };
}

function makeCSV(dups) {
  const esc = (s) => '"' + String(s).replace(/"/g, '""').replace(/\n/g, ' ') + '"';
  const head = 'name,firstIndex,dupeIndex,exactMatch,keptFlavor,dupeFlavor\n';
  const rows = dups.map(d => [d.name, d.firstIndex, d.dupeIndex, d.same, d.keptFlavor, d.dupeFlavor].map(esc).join(','));
  return head + rows.join('\n') + (rows.length ? '\n' : '');
}

async function main() {
  const opts = parseArgv(process.argv);
  const cwd = process.cwd();

  if (!opts.in) {
    opts.in = await autoLocateInput(cwd);
  }
  if (!opts.in) {
    console.error('No input provided. Pass --in <file> or put flavor-overrides.json in one of the default locations.');
    process.exit(1);
  }
  if (!opts.out) {
    console.error('Missing --out <file>.');
    process.exit(1);
  }

  const sourcePath = path.resolve(cwd, opts.in);
  const raw = await fs.readFile(sourcePath, 'utf8');

  // 1) strict if possible, else 2) salvage
  let parsed = tryStrictJSON(raw);
  if (!parsed || parsed.length === 0) parsed = salvageParse(raw);

  if (!parsed || parsed.length === 0) {
    console.error('Parsed 0 usable items. Is the file empty or unreadable?');
    process.exit(1);
  }

  // Optional sorting prior to de-dup (mainly affects which duplicate is kept if there
  // are exact name collisions with different flavors). We default to firstSeen order
  // by simply not sorting. For name sort, we stable-sort by name, preserving text order
  // among equal names.
  if (opts.sort === 'name') {
    const withSeq = parsed.map((x, i) => ({ ...x, __i: i }));
    withSeq.sort((a, b) => a.name.localeCompare(b.name) || a.__i - b.__i);
    parsed = withSeq.map(({ __i, ...x }) => x);
  }

  const { seen, order, dups } = normalize(parsed, { dropLanternVariants: opts.dropLanternVariants });
  const ids = assignIds(order, opts.ns, opts.start);
  const outJSON = toJSONIndex(seen, order, ids, sourcePath);

  await fs.writeFile(path.resolve(cwd, opts.out), JSON.stringify(outJSON, null, 2), 'utf8');

  if (opts.report) {
    await fs.writeFile(path.resolve(cwd, opts.report), makeCSV(dups), 'utf8');
  }

  const msg = [
    `Read ${parsed.length} entries from ${path.relative(cwd, sourcePath)}`,
    `Kept ${order.length} unique items`,
    opts.report ? `(${dups.length} duplicate entries recorded in ${opts.report})` : `(${dups.length} duplicates found)`,
    `Wrote index → ${opts.out}`,
  ].join(' | ');
  console.log(msg);
}

main().catch((err) => {
  console.error('Error:', err?.message || err);
  process.exit(1);
});
