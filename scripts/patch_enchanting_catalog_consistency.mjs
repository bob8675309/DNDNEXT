import fs from "node:fs";
import path from "node:path";

const target = path.join(process.cwd(), "pages", "items.js");
let source = fs.readFileSync(target, "utf8");
const before = '  const variant = { ...raw, key, name: normalizedName, originalName, appliesTo };';
const after = '  const variant = { ...raw, entries: raw.textByKind ? [] : entries, key, name: normalizedName, originalName, appliesTo };';

if (!source.includes(after)) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`Enchanting catalog consistency patch expected one variant match, found ${count}`);
  source = source.replace(before, after);
  fs.writeFileSync(target, source, "utf8");
  console.log("Preferred item-specific textByKind enchanting rules over conflicting legacy entry summaries.");
} else {
  console.log("Enchanting catalog consistency patch already present.");
}

if (!source.includes(after)) throw new Error("Enchanting catalog consistency validation failed");
