import fs from "node:fs";
import path from "node:path";

const townPath = path.join(process.cwd(), "components", "TownSheet.js");
const cssPath = path.join(process.cwd(), "components", "TownSheet.module.scss");
let town = fs.readFileSync(townPath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}
function requireToken(source, token, label) {
  if (!source.includes(token)) throw new Error(`${label}: missing ${token}`);
}

const helper = `function crafterCardToneClass(types = []) {
  const primary = Array.isArray(types) ? types[0] : "";
  switch (primary) {
    case "blacksmith": return styles.crafterCardSmith;
    case "alchemist": return styles.crafterCardAlchemy;
    case "enchanter": return styles.crafterCardEnchanting;
    case "scribe": return styles.crafterCardScribe;
    case "jeweler": return styles.crafterCardJeweler;
    default: return styles.crafterCardGeneral;
  }
}

`;

if (!town.includes("function crafterCardToneClass")) {
  town = replaceRequired(
    town,
    `function CrafterRow({ crafter, onOpenWorkshop }) {`,
    `${helper}function CrafterRow({ crafter, onOpenWorkshop }) {`,
    "Crafter card tone helper"
  );
}

town = replaceRequired(
  town,
  `    <div className={cls(styles.drawerItem, styles.marketCard, toneKey("emerald"))}>`,
  `    <div className={cls(styles.drawerItem, styles.marketCard, styles.crafterCard, crafterCardToneClass(types))}>`,
  "Crafter card role-based tone"
);

const cssBlock = `
.crafterCard {
  position: relative;
  overflow: hidden;
}

.crafterCard::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.42;
  background: radial-gradient(circle at 12% 0%, rgba(255, 255, 255, 0.12), transparent 32%);
}

.crafterCardSmith {
  border-color: rgba(245, 158, 11, 0.38);
  background: linear-gradient(135deg, rgba(180, 83, 9, 0.26), rgba(34, 20, 12, 0.92) 42%, rgba(10, 12, 18, 0.96));
}

.crafterCardAlchemy {
  border-color: rgba(16, 185, 129, 0.42);
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.24), rgba(8, 47, 43, 0.82) 44%, rgba(8, 10, 16, 0.96));
}

.crafterCardEnchanting {
  border-color: rgba(168, 85, 247, 0.48);
  background: linear-gradient(135deg, rgba(91, 33, 182, 0.36), rgba(126, 34, 206, 0.22) 48%, rgba(13, 8, 24, 0.98));
}

.crafterCardScribe {
  border-color: rgba(96, 165, 250, 0.42);
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.22), rgba(15, 23, 42, 0.9) 45%, rgba(8, 10, 16, 0.96));
}

.crafterCardJeweler {
  border-color: rgba(34, 211, 238, 0.44);
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.24), rgba(76, 29, 149, 0.18) 50%, rgba(8, 10, 16, 0.96));
}

.crafterCardGeneral {
  border-color: rgba(148, 163, 184, 0.28);
  background: linear-gradient(135deg, rgba(71, 85, 105, 0.18), rgba(8, 10, 16, 0.96));
}
`;

if (!css.includes(".crafterCardEnchanting")) {
  css += cssBlock;
}

fs.writeFileSync(townPath, town, "utf8");
fs.writeFileSync(cssPath, css, "utf8");

for (const token of [
  "function crafterCardToneClass",
  "styles.crafterCardEnchanting",
  "styles.crafterCardAlchemy",
  "styles.crafterCardSmith",
  "styles.crafterCard, crafterCardToneClass(types)",
]) requireToken(town, token, "Town crafter card role colors");

for (const token of [
  ".crafterCardEnchanting",
  ".crafterCardAlchemy",
  ".crafterCardSmith",
]) requireToken(css, token, "Town crafter card color CSS");

console.log("Patched town crafter cards with role-colored gradients.");
