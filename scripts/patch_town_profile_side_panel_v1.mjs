import fs from "node:fs";
import path from "node:path";

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function write(rel, source) {
  fs.writeFileSync(path.join(process.cwd(), rel), source, "utf8");
}

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return source.replace(before, after);
}

function appendOnce(source, marker, block) {
  if (source.includes(marker)) return source;
  return `${source.trimEnd()}\n\n${block}\n`;
}

let changedAny = false;

// -----------------------------------------------------------------------------
// TownSheet: Open Profile and Browse Wares should dispatch to the town route's
// side profile panel instead of redirecting away to /npcs or /map.
// -----------------------------------------------------------------------------
{
  const rel = "components/TownSheet.js";
  let source = read(rel);
  const before = source;

  source = replaceOnce(
    source,
    'function MerchantLinkRow({ merchant }) {\n  const profileHref = merchant?.id ? `/npcs#${merchant.id}` : null;\n  const shopHref = merchant?.storefront_enabled && merchant?.id ? `/map?merchant=${merchant.id}` : null;',
    'function MerchantLinkRow({ merchant, onOpenProfile, onOpenShop }) {\n  const canOpenProfile = !!merchant?.id && typeof onOpenProfile === "function";\n  const canOpenShop = !!merchant?.storefront_enabled && !!merchant?.id && typeof onOpenShop === "function";',
    "TownSheet merchant profile dispatcher signature"
  );

  source = replaceOnce(
    source,
    '        {profileHref ? <a className="btn btn-sm btn-outline-light" href={profileHref}>Open Profile</a> : null}\n        {shopHref ? <a className="btn btn-sm btn-warning" href={shopHref}>Browse Wares</a> : <span className={styles.marketMuted}>No storefront enabled</span>}',
    '        {merchant?.id ? <button type="button" className="btn btn-sm btn-outline-light" disabled={!canOpenProfile} onClick={() => onOpenProfile(merchant, "profile")}>Open Profile</button> : null}\n        {merchant?.storefront_enabled && merchant?.id ? <button type="button" className="btn btn-sm btn-warning" disabled={!canOpenShop} onClick={() => onOpenShop(merchant, "shop")}>Browse Wares</button> : <span className={styles.marketMuted}>No storefront enabled</span>}',
    "TownSheet merchant profile dispatcher buttons"
  );

  source = replaceOnce(
    source,
    'function MarketDrawer({ marketData, townName }) {',
    'function MarketDrawer({ marketData, townName, onOpenProfile, onOpenShop }) {',
    "TownSheet MarketDrawer profile callbacks"
  );

  source = replaceOnce(
    source,
    '{enrichedPresent.length ? enrichedPresent.map((merchant) => <MerchantLinkRow key={`present-${merchant.id}`} merchant={merchant} />) : <div className={cls(styles.drawerItem, toneKey("stone"))}><div className={styles.drawerItemText}>No merchants are currently set to this town.</div></div>}',
    '{enrichedPresent.length ? enrichedPresent.map((merchant) => <MerchantLinkRow key={`present-${merchant.id}`} merchant={merchant} onOpenProfile={onOpenProfile} onOpenShop={onOpenShop} />) : <div className={cls(styles.drawerItem, toneKey("stone"))}><div className={styles.drawerItemText}>No merchants are currently set to this town.</div></div>}',
    "TownSheet present merchant profile callbacks"
  );

  source = replaceOnce(
    source,
    '{enrichedResident.length ? enrichedResident.map((merchant) => <MerchantLinkRow key={`resident-${merchant.id}`} merchant={merchant} />) : <div className={cls(styles.drawerItem, toneKey("stone"))}><div className={styles.drawerItemText}>No resident merchants are assigned to this town yet.</div></div>}',
    '{enrichedResident.length ? enrichedResident.map((merchant) => <MerchantLinkRow key={`resident-${merchant.id}`} merchant={merchant} onOpenProfile={onOpenProfile} onOpenShop={onOpenShop} />) : <div className={cls(styles.drawerItem, toneKey("stone"))}><div className={styles.drawerItemText}>No resident merchants are assigned to this town yet.</div></div>}',
    "TownSheet resident merchant profile callbacks"
  );

  source = replaceOnce(
    source,
    'function CrafterRow({ crafter, onOpenWorkshop }) {\n  const types = inferCrafterTypes(crafter);\n  const profileHref = crafter?.id ? `/npcs#${crafter.id}` : null;',
    'function CrafterRow({ crafter, onOpenWorkshop, onOpenProfile }) {\n  const types = inferCrafterTypes(crafter);\n  const canOpenProfile = !!crafter?.id && typeof onOpenProfile === "function";',
    "TownSheet crafter profile dispatcher signature"
  );

  source = replaceOnce(
    source,
    '        {profileHref ? <a className="btn btn-sm btn-outline-light" href={profileHref}>Open Profile</a> : null}\n        {types.length ? <button type="button" className="btn btn-sm btn-success" onClick={() => onOpenWorkshop(crafter)}>Open Workshop</button> : null}',
    '        {crafter?.id ? <button type="button" className="btn btn-sm btn-outline-light" disabled={!canOpenProfile} onClick={() => onOpenProfile(crafter, "profile")}>Open Profile</button> : null}\n        {types.length ? <button type="button" className="btn btn-sm btn-success" onClick={() => onOpenWorkshop(crafter)}>Open Workshop</button> : null}',
    "TownSheet crafter profile dispatcher button"
  );

  source = replaceOnce(
    source,
    'function CrafterDrawer({ crafters, townName, inventoryItems, onOpenWorkshop }) {',
    'function CrafterDrawer({ crafters, townName, inventoryItems, onOpenWorkshop, onOpenProfile }) {',
    "TownSheet CrafterDrawer profile callback"
  );

  source = replaceOnce(
    source,
    '{rows.length ? rows.map((crafter) => <CrafterRow key={crafter.id} crafter={crafter} onOpenWorkshop={onOpenWorkshop} />) : <div className={cls(styles.drawerItem, toneKey("stone"))}><div className={styles.drawerItemText}>No obvious crafters are surfaced for this town yet.</div></div>}',
    '{rows.length ? rows.map((crafter) => <CrafterRow key={crafter.id} crafter={crafter} onOpenWorkshop={onOpenWorkshop} onOpenProfile={onOpenProfile} />) : <div className={cls(styles.drawerItem, toneKey("stone"))}><div className={styles.drawerItemText}>No obvious crafters are surfaced for this town yet.</div></div>}',
    "TownSheet crafter rows profile callback"
  );

  source = replaceOnce(
    source,
    'function SharedDrawer({ panel, openPanel, setOpenPanel, adminToolsVisible, adminDrawerProps, marketData, townName, crafterData, playerInventory, onOpenWorkshop }) {',
    'function SharedDrawer({ panel, openPanel, setOpenPanel, adminToolsVisible, adminDrawerProps, marketData, townName, crafterData, playerInventory, onOpenWorkshop, onOpenCharacterProfile }) {',
    "TownSheet SharedDrawer profile callback prop"
  );

  source = replaceOnce(
    source,
    '<MarketDrawer marketData={marketData} townName={townName} />',
    '<MarketDrawer marketData={marketData} townName={townName} onOpenProfile={onOpenCharacterProfile} onOpenShop={onOpenCharacterProfile} />',
    "TownSheet market drawer profile callback pass"
  );

  source = replaceOnce(
    source,
    '<CrafterDrawer crafters={crafterData} townName={townName} inventoryItems={playerInventory} onOpenWorkshop={onOpenWorkshop} />',
    '<CrafterDrawer crafters={crafterData} townName={townName} inventoryItems={playerInventory} onOpenWorkshop={onOpenWorkshop} onOpenProfile={onOpenCharacterProfile} />',
    "TownSheet crafter drawer profile callback pass"
  );

  source = replaceOnce(
    source,
    '  playerPlants = [],\n  onCraftWorkshop,\n}) {',
    '  playerPlants = [],\n  onCraftWorkshop,\n  onOpenCharacterProfile,\n}) {',
    "TownSheet prop accepts parent profile callback"
  );

  source = replaceOnce(
    source,
    '<section className={styles.topPaneRow}><SharedDrawer panel={activePanel} openPanel={openPanel} setOpenPanel={setOpenPanel} adminToolsVisible={adminToolsVisible} adminDrawerProps={adminDrawerProps} marketData={marketData} townName={location?.name} crafterData={crafterData} playerInventory={playerInventory} onOpenWorkshop={setActiveWorkshopCrafter} /><TownMapPanel',
    '<section className={styles.topPaneRow}><SharedDrawer panel={activePanel} openPanel={openPanel} setOpenPanel={setOpenPanel} adminToolsVisible={adminToolsVisible} adminDrawerProps={adminDrawerProps} marketData={marketData} townName={location?.name} crafterData={crafterData} playerInventory={playerInventory} onOpenWorkshop={setActiveWorkshopCrafter} onOpenCharacterProfile={onOpenCharacterProfile} /><TownMapPanel',
    "TownSheet SharedDrawer receives parent profile callback"
  );

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched TownSheet profile buttons to open parent-owned side panel.");
  }
}

// -----------------------------------------------------------------------------
// Town route: own and render the right-side NpcPanel instead of redirecting.
// -----------------------------------------------------------------------------
{
  const rel = "pages/town/[id].js";
  let source = read(rel);
  const before = source;

  source = replaceOnce(
    source,
    'import { useEffect, useMemo, useState } from "react";\nimport { useRouter } from "next/router";',
    'import { useEffect, useMemo, useState } from "react";\nimport dynamic from "next/dynamic";\nimport { useRouter } from "next/router";',
    "Town route dynamic import"
  );

  source = replaceOnce(
    source,
    'import { pickId } from "../../utils/townData";\n',
    'import { pickId } from "../../utils/townData";\n\nconst NpcPanel = dynamic(() => import("../../components/NpcPanel"), { ssr: false });\n',
    "Town route NpcPanel dynamic component"
  );

  source = replaceOnce(
    source,
    '  const [playerPlants, setPlayerPlants] = useState([]);\n  const [playerUserId, setPlayerUserId] = useState(null);',
    '  const [playerPlants, setPlayerPlants] = useState([]);\n  const [playerUserId, setPlayerUserId] = useState(null);\n  const [activeProfileCharacter, setActiveProfileCharacter] = useState(null);\n  const [activeProfileView, setActiveProfileView] = useState("profile");',
    "Town route profile side panel state"
  );

  source = replaceOnce(
    source,
    '  return inserted;\n}\n\n  return (',
    '  return inserted;\n}\n\nfunction handleOpenTownProfile(character, initialView = "profile") {\n  if (!character?.id) return;\n  setActiveProfileCharacter(character);\n  setActiveProfileView(initialView || "profile");\n}\n\n  return (',
    "Town route profile open handler"
  );

  source = replaceOnce(
    source,
    '      ) : location ? (\n        <TownSheet',
    '      ) : location ? (\n        <>\n        <TownSheet',
    "Town route wraps town sheet branch"
  );

  source = replaceOnce(
    source,
    '          playerPlants={playerPlants}\n          onCraftWorkshop={handleCraftWorkshop}\n        />\n      ) : (',
    '          playerPlants={playerPlants}\n          onCraftWorkshop={handleCraftWorkshop}\n          onOpenCharacterProfile={handleOpenTownProfile}\n        />\n          {activeProfileCharacter ? (\n            <div className="town-profile-sidepanel-backdrop" onClick={() => setActiveProfileCharacter(null)}>\n              <aside className="town-profile-sidepanel" onClick={(event) => event.stopPropagation()}>\n                <NpcPanel\n                  key={activeProfileCharacter?.id || "town-profile"}\n                  npc={activeProfileCharacter}\n                  isAdmin={isAdmin}\n                  locations={location ? [location] : []}\n                  initialView={activeProfileView}\n                  onClose={() => setActiveProfileCharacter(null)}\n                />\n              </aside>\n            </div>\n          ) : null}\n        </>\n      ) : (',
    "Town route renders parent-owned profile side panel"
  );

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched town route with parent-owned profile side panel.");
  }
}

// -----------------------------------------------------------------------------
// CSS: right-side town profile panel that mirrors map-side profile behavior without
// forcing Bootstrap offcanvas lifecycle into TownSheet.
// -----------------------------------------------------------------------------
{
  const rel = "styles/npc-profile-panel.css";
  let source = read(rel);
  const before = source;
  const marker = "/* ===== Town route profile side panel v1 ===== */";
  source = appendOnce(source, marker, `${marker}\n.town-profile-sidepanel-backdrop {\n  position: fixed;\n  inset: 0;\n  z-index: 3050;\n  background: rgba(5, 4, 12, 0.46);\n  display: flex;\n  justify-content: flex-end;\n  align-items: stretch;\n}\n.town-profile-sidepanel {\n  width: min(960px, calc(100vw - 28px));\n  height: 100vh;\n  overflow: auto;\n  background: rgba(13, 10, 23, 0.98);\n  border-left: 1px solid rgba(190, 160, 255, 0.28);\n  box-shadow: -24px 0 60px rgba(0,0,0,0.46);\n}\n.town-profile-sidepanel .npc-panel-inner {\n  min-height: 100vh;\n}\n@media (max-width: 760px) {\n  .town-profile-sidepanel {\n    width: 100vw;\n  }\n}\n`);

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched town profile side panel CSS.");
  }
}

if (changedAny) console.log("Applied town profile side panel patch.");
else console.log("Town profile side panel patch already current.");
