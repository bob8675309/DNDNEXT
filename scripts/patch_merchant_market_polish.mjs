import fs from "node:fs";
import path from "node:path";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

const merchantPath = path.join(process.cwd(), "components", "MerchantPanel.js");
let merchant = fs.readFileSync(merchantPath, "utf8");

if (!merchant.includes("const rarityClassFor =")) {
  merchant = replaceOnce(
    merchant,
    '  const stockLabel = loading ? "Loading stock" : cards.length + " item" + (cards.length === 1 ? "" : "s") + " in stock";',
    '  const stockLabel = loading ? "Loading stock" : cards.length + " item" + (cards.length === 1 ? "" : "s") + " in stock";\n  const rarityClassFor = (value) => {\n    const slug = String(value || "common").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");\n    return `rarity-${slug || "common"}`;\n  };',
    "merchant rarity helper"
  );

  merchant = replaceOnce(
    merchant,
    '                  className={"merchant-stock-row" + (String(selectedCard?.id) === String(card.id) ? " selected" : "")}',
    '                  className={"merchant-stock-row " + rarityClassFor(card.item_rarity) + (String(selectedCard?.id) === String(card.id) ? " selected" : "")}',
    "merchant stock rarity class"
  );

  fs.writeFileSync(merchantPath, merchant, "utf8");
  console.log("Applied merchant rarity classes.");
} else {
  console.log("Merchant rarity classes already present.");
}

const globalPath = path.join(process.cwd(), "styles", "globals.scss");
let css = fs.readFileSync(globalPath, "utf8");
const marker = "/* ===== Merchant preview sizing and rarity polish ===== */";

if (!css.includes(marker)) {
  css += `

${marker}
.merchant-market .rarity-mundane,
.merchant-market .rarity-none {
  --rarity-color: #aab2bd;
}

.merchant-stock-row {
  border-left: 4px solid var(--rarity-color, #ced4da);
}

.merchant-stock-row:hover {
  border-left-color: var(--rarity-color, #ced4da);
}

.merchant-stock-row.selected {
  border-left-color: var(--rarity-color, #ced4da);
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--rarity-color, #ced4da) 48%, transparent) inset,
    0 8px 22px rgba(0, 0, 0, 0.22);
}

.merchant-stock-row .merchant-stock-row-meta span:first-child {
  border: 1px solid color-mix(in srgb, var(--rarity-color, #ced4da) 48%, transparent);
  background: color-mix(in srgb, var(--rarity-color, #ced4da) 17%, transparent);
  color: color-mix(in srgb, var(--rarity-color, #ced4da) 88%, white);
  font-weight: 800;
}

.merchant-preview-card-scroll .sitem-card:has(.sitem-header.rarity-mundane),
.merchant-preview-card-scroll .sitem-card:has(.sitem-header.rarity-none) { --merchant-card-rarity: #aab2bd; }
.merchant-preview-card-scroll .sitem-card:has(.sitem-header.rarity-common) { --merchant-card-rarity: #ced4da; }
.merchant-preview-card-scroll .sitem-card:has(.sitem-header.rarity-uncommon) { --merchant-card-rarity: #55d17a; }
.merchant-preview-card-scroll .sitem-card:has(.sitem-header.rarity-rare) { --merchant-card-rarity: #5aa7f3; }
.merchant-preview-card-scroll .sitem-card:has(.sitem-header.rarity-very-rare) { --merchant-card-rarity: #a67cf3; }
.merchant-preview-card-scroll .sitem-card:has(.sitem-header.rarity-legendary) { --merchant-card-rarity: #f3b24d; }
.merchant-preview-card-scroll .sitem-card:has(.sitem-header.rarity-artifact) { --merchant-card-rarity: #e85d5d; }

.merchant-preview-card-scroll .sitem-card {
  border-color: color-mix(in srgb, var(--merchant-card-rarity, #ced4da) 48%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--merchant-card-rarity, #ced4da) 10%, transparent) inset;
}

.merchant-preview-card-scroll .sitem-header {
  border-bottom-color: var(--merchant-card-rarity, var(--rarity-color, #ced4da));
  background:
    linear-gradient(
      90deg,
      color-mix(in srgb, var(--merchant-card-rarity, var(--rarity-color, #ced4da)) 28%, #2b2140) 0%,
      #2b2140 50%,
      #2b2140 100%
    );
  box-shadow: inset 4px 0 0 var(--merchant-card-rarity, var(--rarity-color, #ced4da));
}

.merchant-preview-card-scroll .sitem-rarity {
  color: var(--merchant-card-rarity, #ced4da);
  font-weight: 900;
  text-shadow: 0 0 12px color-mix(in srgb, var(--merchant-card-rarity, #ced4da) 24%, transparent);
}

.merchant-panel-town .merchant-preview-card-scroll {
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.merchant-panel-town .merchant-preview-card-scroll .sitem-card {
  flex: 0 0 auto;
  width: min(100%, 420px);
  max-width: 420px;
}

@media (max-width: 820px) {
  .merchant-panel-town .merchant-preview-card-scroll {
    display: block;
  }

  .merchant-panel-town .merchant-preview-card-scroll .sitem-card {
    width: 100%;
    max-width: none;
  }
}
`;
  fs.writeFileSync(globalPath, css, "utf8");
  console.log("Applied merchant preview sizing and rarity styles.");
} else {
  console.log("Merchant preview sizing and rarity styles already present.");
}

const checks = [
  [merchant, "const rarityClassFor =", "rarity helper"],
  [merchant, "rarityClassFor(card.item_rarity)", "stock rarity class"],
  [css, marker, "rarity style marker"],
  [css, "max-width: 420px", "town preview width cap"],
  [css, "#2b2140 50%", "soft card header transition"],
];
for (const [source, token, label] of checks) {
  if (!source.includes(token)) throw new Error(`${label} validation failed`);
}
