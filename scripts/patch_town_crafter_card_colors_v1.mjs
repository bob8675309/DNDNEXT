import fs from "node:fs";
import path from "node:path";

const filePath = path.join(process.cwd(), "components", "TownSheet.js");
let source = fs.readFileSync(filePath, "utf8");

const helper = `function crafterToneForTypes(types = []) {
  const list = Array.isArray(types) ? types : [];
  if (list.includes("enchanter")) return "violet";
  if (list.includes("alchemist")) return "emerald";
  if (list.includes("blacksmith")) return "amber";
  if (list.includes("scribe")) return "cyan";
  if (list.includes("jeweler")) return "rose";
  return "stone";
}

`;

if (!source.includes("function crafterToneForTypes")) {
  const marker = "function CrafterRow({ crafter, onOpenWorkshop }) {";
  const index = source.indexOf(marker);
  if (index < 0) throw new Error("CrafterRow not found for role tones");
  source = source.slice(0, index) + helper + source.slice(index);
}

const start = source.indexOf("function CrafterRow({ crafter, onOpenWorkshop }) {");
const end = source.indexOf("function CrafterDrawer(", start);
if (start < 0 || end < 0) throw new Error("CrafterRow bounds not found for role tones");
let block = source.slice(start, end);

if (!block.includes("crafterToneForTypes(types)")) {
  const before = `    <div className={cls(styles.drawerItem, styles.marketCard, toneKey("emerald"))}>`;
  const after = `    <div className={cls(styles.drawerItem, styles.marketCard, toneKey(crafterToneForTypes(types)))}>`;
  if (!block.includes(before)) throw new Error("CrafterRow role tone anchor not found");
  block = block.replace(before, after);
  source = source.slice(0, start) + block + source.slice(end);
}

fs.writeFileSync(filePath, source, "utf8");

for (const token of ["function crafterToneForTypes", "toneKey(crafterToneForTypes(types))", "return \"violet\""]) {
  if (!source.includes(token)) throw new Error(`Crafter role tone validation failed: ${token}`);
}

console.log("Patched town crafter cards to use role tone gradients.");
