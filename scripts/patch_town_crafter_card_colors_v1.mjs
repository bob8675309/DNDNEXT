import fs from "node:fs";
import path from "node:path";

const filePath = path.join(process.cwd(), "components", "TownSheet.js");
let source = fs.readFileSync(filePath, "utf8");

const before = `    <div className={cls(styles.drawerItem, styles.marketCard, toneKey("emerald"))}>`;
const after = `    <div className={cls(styles.drawerItem, styles.marketCard, toneKey(types.includes("enchanter") ? "violet" : types.includes("blacksmith") ? "amber" : types.includes("alchemist") ? "emerald" : types.includes("scribe") ? "cyan" : types.includes("jeweler") ? "rose" : "stone"))}>`;

const start = source.indexOf("function CrafterRow({ crafter, onOpenWorkshop }) {");
const end = source.indexOf("function CrafterDrawer(", start);
if (start < 0 || end < 0) throw new Error("CrafterRow bounds not found for role tone patch");

const rowBlock = source.slice(start, end);
if (!rowBlock.includes(after)) {
  if (!rowBlock.includes(before)) throw new Error("CrafterRow role tone anchor not found");
  source = source.slice(0, start) + rowBlock.replace(before, after) + source.slice(end);
  fs.writeFileSync(filePath, source, "utf8");
  console.log("Patched town crafter cards to use role-colored tone gradients.");
} else {
  console.log("Town crafter role-colored tone gradients already present.");
}

const checkStart = source.indexOf("function CrafterRow({ crafter, onOpenWorkshop }) {");
const checkEnd = source.indexOf("function CrafterDrawer(", checkStart);
const checkBlock = source.slice(checkStart, checkEnd);
for (const token of [
  'types.includes("enchanter") ? "violet"',
  'types.includes("blacksmith") ? "amber"',
  'types.includes("alchemist") ? "emerald"',
]) {
  if (!checkBlock.includes(token)) throw new Error(`Crafter role tone validation failed: ${token}`);
}
