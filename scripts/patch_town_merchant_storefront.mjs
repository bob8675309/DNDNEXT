import fs from "node:fs";
import path from "node:path";

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected one match, found ${count}`);
  }
  return source.replace(before, after);
}

function replaceFunctionBlock(source, functionName, after, label) {
  if (source.includes(after)) return source;
  const needle = `function ${functionName}(`;
  const start = source.indexOf(needle);
  if (start < 0) throw new Error(`${label}: missing ${needle}`);

  const open = source.indexOf("{", start);
  if (open < 0) throw new Error(`${label}: missing opening brace`);

  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        let end = index + 1;
        while (source[end] === "\r" || source[end] === "\n") end += 1;
        return `${source.slice(0, start)}${after}${source.slice(end)}`;
      }
    }
  }

  throw new Error(`${label}: could not find closing brace`);
}

const townPath = path.join(process.cwd(), "components", "TownSheet.js");
let town = fs.readFileSync(townPath, "utf8");

if (!town.includes("const MerchantPanel = dynamic(() => import(\"./MerchantPanel\")")) {
  town = replaceOnce(
    town,
    'import Link from "next/link";',
    'import Link from "next/link";\nimport dynamic from "next/dynamic";',
    "TownSheet dynamic import"
  );

  town = replaceOnce(
    town,
    'import styles from "./TownSheet.module.scss";',
    'import styles from "./TownSheet.module.scss";\n\nconst MerchantPanel = dynamic(() => import("./MerchantPanel"), { ssr: false });',
    "TownSheet MerchantPanel declaration"
  );

  town = replaceOnce(
    town,
    "function MerchantLinkRow({ merchant }) {",
    "function MerchantLinkRow({ merchant, onBrowseWares }) {",
    "MerchantLinkRow signature"
  );

  town = replaceOnce(
    town,
    '  const shopHref = merchant?.storefront_enabled && merchant?.id ? `/map?merchant=${merchant.id}` : null;',
    '  const canBrowseWares = Boolean(merchant?.storefront_enabled && merchant?.id);',
    "MerchantLinkRow browse condition"
  );

  town = replaceOnce(
    town,
    '        {shopHref ? <a className="btn btn-sm btn-warning" href={shopHref}>Browse Wares</a> : <span className={styles.marketMuted}>No storefront enabled</span>}',
    '        {canBrowseWares ? <button type="button" className="btn btn-sm btn-warning" onClick={() => onBrowseWares?.(merchant)}>Browse Wares</button> : <span className={styles.marketMuted}>No storefront enabled</span>}',
    "MerchantLinkRow browse action"
  );

  town = replaceOnce(
    town,
    "function MarketDrawer({ marketData, townName }) {",
    "function MarketDrawer({ marketData, townName, onBrowseWares }) {",
    "MarketDrawer signature"
  );

  town = replaceOnce(
    town,
    '{enrichedPresent.length ? enrichedPresent.map((merchant) => <MerchantLinkRow key={`present-${merchant.id}`} merchant={merchant} />) : <div className={cls(styles.drawerItem, toneKey("stone"))}><div className={styles.drawerItemText}>No merchants are currently set to this town.</div></div>}',
    '{enrichedPresent.length ? enrichedPresent.map((merchant) => <MerchantLinkRow key={`present-${merchant.id}`} merchant={merchant} onBrowseWares={onBrowseWares} />) : <div className={cls(styles.drawerItem, toneKey("stone"))}><div className={styles.drawerItemText}>No merchants are currently set to this town.</div></div>}',
    "MarketDrawer present merchants"
  );

  town = replaceOnce(
    town,
    '{enrichedResident.length ? enrichedResident.map((merchant) => <MerchantLinkRow key={`resident-${merchant.id}`} merchant={merchant} />) : <div className={cls(styles.drawerItem, toneKey("stone"))}><div className={styles.drawerItemText}>No resident merchants are assigned to this town yet.</div></div>}',
    '{enrichedResident.length ? enrichedResident.map((merchant) => <MerchantLinkRow key={`resident-${merchant.id}`} merchant={merchant} onBrowseWares={onBrowseWares} />) : <div className={cls(styles.drawerItem, toneKey("stone"))}><div className={styles.drawerItemText}>No resident merchants are assigned to this town yet.</div></div>}',
    "MarketDrawer resident merchants"
  );

  town = replaceOnce(
    town,
    "function SharedDrawer({ panel, openPanel, setOpenPanel, adminToolsVisible, adminDrawerProps, marketData, townName, crafterData, playerInventory, onOpenWorkshop }) {",
    "function SharedDrawer({ panel, openPanel, setOpenPanel, adminToolsVisible, adminDrawerProps, marketData, townName, crafterData, playerInventory, onOpenWorkshop, onBrowseWares }) {",
    "SharedDrawer signature"
  );

  town = replaceOnce(
    town,
    '<MarketDrawer marketData={marketData} townName={townName} />',
    '<MarketDrawer marketData={marketData} townName={townName} onBrowseWares={onBrowseWares} />',
    "SharedDrawer market callback"
  );

  town = replaceOnce(
    town,
    '  const [activeWorkshopCrafter, setActiveWorkshopCrafter] = useState(null);',
    '  const [activeWorkshopCrafter, setActiveWorkshopCrafter] = useState(null);\n  const [activeMerchant, setActiveMerchant] = useState(null);',
    "TownSheet merchant state"
  );

  town = replaceOnce(
    town,
    'playerInventory={playerInventory} onOpenWorkshop={setActiveWorkshopCrafter} />',
    'playerInventory={playerInventory} onOpenWorkshop={setActiveWorkshopCrafter} onBrowseWares={setActiveMerchant} />',
    "TownSheet SharedDrawer merchant callback"
  );

  town = replaceOnce(
    town,
    '      {activeWorkshopCrafter ? <CrafterWorkshopModal crafter={activeWorkshopCrafter} inventoryItems={playerInventory} playerPlants={playerPlants} onClose={() => setActiveWorkshopCrafter(null)} onCraftWorkshop={onCraftWorkshop} /> : null}',
    '      {activeWorkshopCrafter ? <CrafterWorkshopModal crafter={activeWorkshopCrafter} inventoryItems={playerInventory} playerPlants={playerPlants} onClose={() => setActiveWorkshopCrafter(null)} onCraftWorkshop={onCraftWorkshop} /> : null}\n      {activeMerchant ? (\n        <div className={styles.modalBackdrop} onClick={() => setActiveMerchant(null)}>\n          <div className={cls(styles.crafterModal, styles.crafterModalBuilder)} onClick={(event) => event.stopPropagation()}>\n            <MerchantPanel merchant={activeMerchant} isAdmin={isAdmin} locations={location ? [location] : []} onClose={() => setActiveMerchant(null)} />\n          </div>\n        </div>\n      ) : null}',
    "TownSheet merchant modal"
  );

  console.log("Applied Town Sheet merchant storefront modal patch.");
} else {
  console.log("Town Sheet merchant storefront modal patch already present.");
}

if (!town.includes('from "../utils/craftingProfessions"')) {
  town = replaceOnce(
    town,
    'import { buildTownData } from "../utils/townData";',
    'import { buildTownData } from "../utils/townData";\nimport { availableProfessionsForCharacter } from "../utils/craftingProfessions";',
    "TownSheet workshop provider import"
  );
}

const strictWorkshopProviderBlock = `const PROFESSION_TO_CRAFT_TYPE = Object.freeze({
  alchemy: "alchemist",
  smithing: "blacksmith",
  enchanting: "enchanter",
  scribe: "scribe",
});

function inferCrafterTypes(crafter) {
  return availableProfessionsForCharacter(crafter)
    .map((profession) => PROFESSION_TO_CRAFT_TYPE[profession])
    .filter(Boolean);
}

`;

if (!town.includes("const PROFESSION_TO_CRAFT_TYPE")) {
  town = replaceFunctionBlock(
    town,
    "inferCrafterTypes",
    strictWorkshopProviderBlock,
    "TownSheet strict workshop provider inference"
  );
}

town = town.replace(
  'if (!["blacksmith", "alchemist", "enchanter", "scribe", "jeweler"].some((type) => types.includes(type))) continue;',
  'if (!["blacksmith", "alchemist", "enchanter", "scribe"].some((type) => types.includes(type))) continue;'
);

fs.writeFileSync(townPath, town, "utf8");

const merchantPath = path.join(process.cwd(), "components", "MerchantPanel.js");
let merchant = fs.readFileSync(merchantPath, "utf8");

if (!merchant.includes("  onClose,")) {
  merchant = replaceOnce(
    merchant,
    '  onBackToProfile,\n}) {',
    '  onBackToProfile,\n  onClose,\n}) {',
    "MerchantPanel onClose prop"
  );

  merchant = replaceOnce(
    merchant,
    `          <button
            type="button"
            className="btn-close btn-close-white ms-2"
            data-bs-dismiss="offcanvas"
            aria-label="Close"
          />`,
    `          <button
            type="button"
            className="btn-close btn-close-white ms-2"
            data-bs-dismiss="offcanvas"
            aria-label="Close"
            onClick={() => {
              try {
                onClose?.();
              } catch (e) {
                console.warn("MerchantPanel onClose failed", e);
              }
            }}
          />`,
    "MerchantPanel close callback"
  );

  fs.writeFileSync(merchantPath, merchant, "utf8");
  console.log("Applied MerchantPanel close callback patch.");
} else {
  console.log("MerchantPanel close callback patch already present.");
}

const checks = [
  [town, 'onBrowseWares={setActiveMerchant}', "TownSheet merchant callback"],
  [town, '<MerchantPanel merchant={activeMerchant}', "TownSheet merchant modal"],
  [town, 'onClick={() => onBrowseWares?.(merchant)}', "merchant browse button"],
  [town, 'availableProfessionsForCharacter(crafter)', "strict workshop provider helper"],
  [town, 'PROFESSION_TO_CRAFT_TYPE', "canonical profession-to-craft mapping"],
  [merchant, 'onClose?.()', "MerchantPanel close callback"],
];
for (const [source, token, label] of checks) {
  if (!source.includes(token)) throw new Error(`${label} validation failed`);
}
if (town.includes('["blacksmith", "alchemist", "enchanter", "scribe", "jeweler"]')) {
  throw new Error("Jeweler must not be part of canonical workshop provider discovery.");
}
