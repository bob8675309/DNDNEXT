import fs from "node:fs";
import path from "node:path";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected one match, found ${count}`);
  }
  return source.replace(before, after);
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

const oldInferCrafterTypes = `function inferCrafterTypes(crafter) {
  const types = new Set();
  collectCrafterRoleValues(crafter).forEach((value) => {
    const type = inferCraftTypeFromText(value);
    if (type) types.add(type);
  });
  return Array.from(types);
}
`;
const strictInferCrafterTypes = `const PROFESSION_TO_CRAFT_TYPE = Object.freeze({
  alchemy: "alchemist",
  smithing: "blacksmith",
  enchanting: "enchanter",
  scribe: "scribe",
});

function normalizeWorkshopServiceFlag(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const token = normalizeCrafterRoleToken(value);
  return ["true", "yes", "y", "1", "on", "enabled", "service", "provider", "offers service"].includes(token);
}

function normalizeWorkshopProfessionRank(value) {
  if (typeof value === "string") {
    const token = normalizeCrafterRoleToken(value);
    if (["expertise", "expert", "master"].includes(token)) return 2;
    if (["proficient", "trained", "apprentice"].includes(token)) return 1;
    if (["untrained", "none", "off"].includes(token)) return 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(2, Math.round(n))) : 0;
}

function extractCrafterSheet(crafter = {}) {
  if (crafter?.sheet && typeof crafter.sheet === "object") return crafter.sheet;
  if (crafter?.characterSheet && typeof crafter.characterSheet === "object") return crafter.characterSheet;
  if (crafter?.character_sheet && typeof crafter.character_sheet === "object") return crafter.character_sheet;
  if (crafter?.character_sheets?.sheet && typeof crafter.character_sheets.sheet === "object") return crafter.character_sheets.sheet;
  if (Array.isArray(crafter?.character_sheets) && crafter.character_sheets[0]?.sheet) return crafter.character_sheets[0].sheet;
  return null;
}

function professionEntryHasServiceFlag(entry) {
  return Boolean(entry && typeof entry === "object" && !Array.isArray(entry) && (
    Object.prototype.hasOwnProperty.call(entry, "offersService")
    || Object.prototype.hasOwnProperty.call(entry, "offers_service")
    || Object.prototype.hasOwnProperty.call(entry, "workshopService")
    || Object.prototype.hasOwnProperty.call(entry, "workshop_service")
    || Object.prototype.hasOwnProperty.call(entry, "provider")
    || Object.prototype.hasOwnProperty.call(entry, "offers")
  ));
}

function inferCrafterTypesFromSheet(crafter) {
  const sheet = extractCrafterSheet(crafter);
  const professions = sheet?.professions && typeof sheet.professions === "object" ? sheet.professions : null;
  if (!professions) return null;

  const professionKeys = Object.keys(PROFESSION_TO_CRAFT_TYPE);
  const hasServiceFlags = professionKeys.some((key) => professionEntryHasServiceFlag(professions[key]));
  if (!hasServiceFlags) return null;

  return professionKeys
    .filter((key) => {
      const entry = professions[key];
      const rank = normalizeWorkshopProfessionRank(entry?.rank ?? entry?.proficiency_rank ?? entry?.tier ?? entry?.proficient);
      const offers = normalizeWorkshopServiceFlag(entry?.offersService ?? entry?.offers_service ?? entry?.workshopService ?? entry?.workshop_service ?? entry?.provider ?? entry?.offers);
      return rank > 0 && offers;
    })
    .map((key) => PROFESSION_TO_CRAFT_TYPE[key]);
}

function collectExplicitWorkshopServiceValues(crafter) {
  const values = [];
  const pushValue = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(pushValue);
      return;
    }
    if (typeof value === "object") {
      Object.values(value).forEach(pushValue);
      return;
    }
    values.push(value);
  };

  // Only explicit service fields and tags are allowed to create workshop access.
  // Name, role, affiliation, and storefront copy are intentionally ignored.
  pushValue(crafter?.crafterTypes);
  pushValue(crafter?.craft_roles);
  pushValue(crafter?.craftRoles);
  pushValue(crafter?.crafter_roles);
  pushValue(crafter?.crafterRoles);
  pushValue(crafter?.workshop_roles);
  pushValue(crafter?.workshopRoles);
  pushValue(crafter?.crafting_roles);
  pushValue(crafter?.craftingRoles);
  pushValue(crafter?.services);
  pushValue(crafter?.tags);
  return values;
}

function inferCrafterTypesFromExplicitServices(crafter) {
  const types = new Set();
  collectExplicitWorkshopServiceValues(crafter).forEach((value) => {
    const type = inferCraftTypeFromText(value);
    if (["blacksmith", "alchemist", "enchanter", "scribe"].includes(type)) types.add(type);
  });
  return Array.from(types);
}

function inferCrafterTypes(crafter) {
  return inferCrafterTypesFromSheet(crafter) ?? inferCrafterTypesFromExplicitServices(crafter);
}
`;
if (!town.includes("function inferCrafterTypesFromSheet")) {
  town = replaceOnce(town, oldInferCrafterTypes, strictInferCrafterTypes, "strict workshop provider inference");
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
  [town, 'function inferCrafterTypesFromSheet', "strict sheet provider inference"],
  [town, 'collectExplicitWorkshopServiceValues', "explicit service provider fallback"],
  [town, 'Name, role, affiliation, and storefront copy are intentionally ignored.', "provider fuzzy-field guard"],
  [merchant, 'onClose?.()', "MerchantPanel close callback"],
];
for (const [source, token, label] of checks) {
  if (!source.includes(token)) throw new Error(`${label} validation failed`);
}

if (town.includes('["blacksmith", "alchemist", "enchanter", "scribe", "jeweler"]')) {
  throw new Error("Jeweler must not be part of canonical workshop provider discovery.");
}