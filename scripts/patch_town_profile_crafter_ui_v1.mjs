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
  if (count !== 1) {
    console.warn(`${label}: expected one match, found ${count}; leaving source unchanged.`);
    return source;
  }
  return source.replace(before, after);
}

function replaceRequired(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected one match, found ${count}`);
  }
  return source.replace(before, after);
}

function ensureImportAfter(source, anchorImport, addedImport, label) {
  if (source.includes(addedImport)) return source;
  const count = source.split(anchorImport).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected one anchor import, found ${count}`);
  }
  return source.replace(anchorImport, `${anchorImport}\n${addedImport}`);
}

function appendOnce(source, marker, block) {
  if (source.includes(marker)) return source;
  return `${source.trimEnd()}\n\n${block}\n`;
}

function requireToken(source, token, label) {
  if (!source.includes(token)) throw new Error(`${label}: missing ${token}`);
}

function requireAbsent(source, token, label) {
  if (source.includes(token)) throw new Error(`${label}: forbidden ${token}`);
}

let changedAny = false;

// -----------------------------------------------------------------------------
// Location side panel: every in-town NPC/merchant should be able to open profile.
// -----------------------------------------------------------------------------
{
  const rel = "components/LocationSideBar.js";
  let source = read(rel);
  const before = source;

  source = replaceOnce(
    source,
    '  onOpenRoutes,\n  offcanvasId = "locPanel",',
    '  onOpenRoutes,\n  onOpenMerchant,\n  offcanvasId = "locPanel",',
    "LocationSideBar props: onOpenMerchant"
  );

  source = replaceOnce(
    source,
    '  const presentPeople = (townData.people || []).slice(0, 4);',
    '  const presentPeople = (rosterChars || []).slice(0, 8);',
    "LocationSideBar presentPeople source"
  );

  source = replaceOnce(
    source,
    '            {presentPeople.length ? presentPeople.map((p) => <li key={p.title}>{p.title}</li>) : <li>No one surfaced</li>}',
    `            {presentPeople.length ? presentPeople.map((p) => (\n              <li key={p.id || p.title || p.name}>\n                <button\n                  type="button"\n                  className="town-quick-profile-link"\n                  onClick={() => typeof onOpenMerchant === "function" ? onOpenMerchant(p) : null}\n                  title="Open character profile"\n                >\n                  <span>{p.name || p.title}</span>\n                  <small>{p.role || p.kind || "Profile"}</small>\n                </button>\n              </li>\n            )) : <li>No one surfaced</li>}`,
    "LocationSideBar profile links"
  );

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched LocationSideBar NPC profile links.");
  }
}

// -----------------------------------------------------------------------------
// Map NPC drawer + offcanvas readiness. Bootstrap is loaded with a deferred script
// in _app, so first-click panel opens can race window.bootstrap on cold loads.
// Retry briefly instead of dropping the open request.
// -----------------------------------------------------------------------------
{
  const rel = "components/MapPageClient.js";
  let source = read(rel);
  const before = source;

  source = replaceOnce(
    source,
    `          if (npcRow) setSelNpc(npcRow);\n          setSelMerchant(null);\n          setSelLoc(null);\n          setDebugOpen(true);`,
    `          if (npcRow) {\n            setSelNpc(npcRow);\n            showExclusiveOffcanvas("npcPanel");\n          }\n          setSelMerchant(null);\n          setSelLoc(null);\n          setDebugOpen(true);`,
    "MapPageClient drawer NPC selection opens profile"
  );

  source = replaceRequired(
    source,
    `  const showExclusiveOffcanvas = useCallback(\n    (id) => {\n      if (!window.bootstrap) return;\n      for (const other of OFFCANVAS_IDS) {\n        if (other !== id) hideOffcanvas(other);\n      }\n      const el = document.getElementById(id);\n      if (!el) return;\n      window.bootstrap.Offcanvas.getOrCreateInstance(el).show();\n    },\n    [OFFCANVAS_IDS, hideOffcanvas]\n  );`,
    `  const showExclusiveOffcanvas = useCallback(\n    (id) => {\n      const tryOpen = (remaining = 10) => {\n        if (typeof window === "undefined") return;\n        const offcanvasApi = window.bootstrap?.Offcanvas || null;\n        if (!offcanvasApi) {\n          if (remaining > 0) window.setTimeout(() => tryOpen(remaining - 1), 60);\n          return;\n        }\n        for (const other of OFFCANVAS_IDS) {\n          if (other !== id) hideOffcanvas(other);\n        }\n        const el = document.getElementById(id);\n        if (!el) {\n          if (remaining > 0) window.setTimeout(() => tryOpen(remaining - 1), 60);\n          return;\n        }\n        offcanvasApi.getOrCreateInstance(el).show();\n      };\n      tryOpen();\n    },\n    [OFFCANVAS_IDS, hideOffcanvas]\n  );`,
    "MapPageClient Bootstrap offcanvas readiness retry"
  );

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched MapPageClient drawer NPC profile opening and offcanvas readiness guard.");
  }
}

// -----------------------------------------------------------------------------
// Town page data and parent-owned town profile panel. The panel lives in the route
// parent, not TownSheet, to avoid the fragile TownSheet shared-panel import boundary.
// -----------------------------------------------------------------------------
{
  const rel = "pages/town/[id].js";
  let source = read(rel);
  const before = source;

  source = ensureImportAfter(
    source,
    'import { useEffect, useMemo, useState } from "react";',
    'import dynamic from "next/dynamic";',
    "Town route dynamic import"
  );

  source = replaceRequired(
    source,
    'import { pickId } from "../../utils/townData";\n',
    'import { pickId } from "../../utils/townData";\n\nconst NpcPanel = dynamic(() => import("../../components/NpcPanel"), { ssr: false });\n',
    "Town route NpcPanel dynamic component"
  );

  source = replaceOnce(
    source,
    '    tags: Array.isArray(row.tags) ? row.tags : [],\n  };',
    '    tags: Array.isArray(row.tags) ? row.tags : [],\n    portrait_url: row.portrait_url || null,\n    portrait_storage_path: row.portrait_storage_path || null,\n    portrait_thumb_url: row.portrait_thumb_url || null,\n    portrait_shop_url: row.portrait_shop_url || null,\n    portrait_source: row.portrait_source || null,\n    image_url: row.image_url || null,\n  };',
    "Town merchant normalization portrait fields"
  );

  source = replaceOnce(
    source,
    '.select("id,name,kind,race,role,affiliation,status,state,location_id,last_known_location_id,projected_destination_id,is_hidden,map_icon_id,tags")',
    '.select("id,name,kind,race,role,affiliation,status,state,location_id,last_known_location_id,projected_destination_id,is_hidden,map_icon_id,tags,portrait_url,portrait_storage_path,portrait_thumb_url,portrait_shop_url,portrait_source,image_url")',
    "Town roster portrait select"
  );

  source = replaceOnce(
    source,
    '          "storefront_bg_video_url",\n          "tags",',
    '          "storefront_bg_video_url",\n          "portrait_url",\n          "portrait_storage_path",\n          "portrait_thumb_url",\n          "portrait_shop_url",\n          "portrait_source",\n          "image_url",\n          "tags",',
    "Town merchant select portrait fields"
  );

  source = replaceRequired(
    source,
    '  const [playerPlants, setPlayerPlants] = useState([]);\n  const [playerUserId, setPlayerUserId] = useState(null);',
    '  const [playerPlants, setPlayerPlants] = useState([]);\n  const [playerUserId, setPlayerUserId] = useState(null);\n  const [activeTownProfileCharacter, setActiveTownProfileCharacter] = useState(null);\n  const [activeTownProfileView, setActiveTownProfileView] = useState("profile");',
    "Town route parent profile state"
  );

  source = replaceRequired(
    source,
    '  return inserted;\n}\n\n  return (',
    '  return inserted;\n}\n\nfunction handleOpenTownProfile(character, initialView = "profile") {\n  if (!character?.id) return;\n  setActiveTownProfileCharacter(character);\n  setActiveTownProfileView(initialView || "profile");\n}\n\n  return (',
    "Town route profile open handler"
  );

  source = replaceRequired(
    source,
    '      ) : location ? (\n        <TownSheet',
    '      ) : location ? (\n        <>\n        <TownSheet',
    "Town route profile fragment start"
  );

  source = replaceRequired(
    source,
    '          playerPlants={playerPlants}\n          onCraftWorkshop={handleCraftWorkshop}\n        />\n      ) : (',
    '          playerPlants={playerPlants}\n          onCraftWorkshop={handleCraftWorkshop}\n          onOpenCharacterProfile={handleOpenTownProfile}\n        />\n          {activeTownProfileCharacter ? (\n            <div className="town-profile-sidepanel-backdrop" onClick={() => setActiveTownProfileCharacter(null)}>\n              <aside className="town-profile-sidepanel" onClick={(event) => event.stopPropagation()}>\n                <NpcPanel\n                  key={activeTownProfileCharacter?.id || "town-profile"}\n                  npc={activeTownProfileCharacter}\n                  isAdmin={isAdmin}\n                  locations={location ? [location] : []}\n                  initialView={activeTownProfileView}\n                  onClose={() => setActiveTownProfileCharacter(null)}\n                />\n              </aside>\n            </div>\n          ) : null}\n        </>\n      ) : (',
    "Town route parent-owned profile side panel"
  );

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched town page portrait data flow and parent-owned profile side panel.");
  }
}

// -----------------------------------------------------------------------------
// TownSheet: dedupe resident merchants shown in both Present + Resident sections,
// add crafter storefront art, and convert Open Profile / Browse Wares links into
// callbacks that stay inside the town page.
// -----------------------------------------------------------------------------
{
  const rel = "components/TownSheet.js";
  let source = read(rel);
  const before = source;

  source = ensureImportAfter(
    source,
    'import { buildTownData } from "../utils/townData";',
    'import { supabase } from "../utils/supabaseClient";',
    "TownSheet supabase import"
  );

  source = replaceOnce(
    source,
    `function merchantSubtitle(merchant) {\n  return merchant?.storefront_tagline || merchant?.storefront_title || merchant?.role || merchant?.affiliation || "Merchant";\n}\n`,
    `function merchantSubtitle(merchant) {\n  return merchant?.storefront_tagline || merchant?.storefront_title || merchant?.role || merchant?.affiliation || "Merchant";\n}\n\nfunction safeCssUrl(value = "") {\n  const clean = String(value || "").replace(/"/g, "%22");\n  return clean ? \`url("\${clean}")\` : "";\n}\n\nfunction townCrafterPortraitUrl(crafter) {\n  const direct = crafter?.portrait_shop_url || crafter?.portrait_thumb_url || crafter?.portrait_url || crafter?.image_url || "";\n  if (direct) return direct;\n  const storagePath = crafter?.portrait_storage_path || "";\n  if (!storagePath) return "";\n  try {\n    return supabase.storage.from("npc-portraits").getPublicUrl(storagePath).data?.publicUrl || "";\n  } catch {\n    return "";\n  }\n}\n`,
    "TownSheet crafter portrait helpers"
  );

  source = replaceOnce(
    source,
    '  const enrichedResident = resident.map((m) => ({ ...m, isResident: true, isPresent: presentIds.has(m.id) }));',
    '  const enrichedResident = resident.filter((m) => !presentIds.has(m.id)).map((m) => ({ ...m, isResident: true, isPresent: false }));',
    "TownSheet merchant drawer resident dedupe"
  );

  source = replaceOnce(
    source,
    '  return (\n    <div className={styles.modalBackdrop} onClick={onClose}>',
    '  const crafterPortraitUrl = townCrafterPortraitUrl(crafter);\n  const crafterStorefrontStyle = crafterPortraitUrl ? { "--crafter-portrait-url": safeCssUrl(crafterPortraitUrl) } : {};\n\n  return (\n    <div className={styles.modalBackdrop} onClick={onClose}>',
    "TownSheet crafter portrait style var"
  );

  source = replaceOnce(
    source,
    '      <div className={cls(styles.crafterModal, styles.crafterModalBuilder)} onClick={(e) => e.stopPropagation()}>',
    '      <div className={cls(styles.crafterModal, styles.crafterModalBuilder, "town-crafter-storefront")} style={crafterStorefrontStyle} onClick={(e) => e.stopPropagation()}>',
    "TownSheet crafter storefront class"
  );

  source = replaceRequired(
    source,
    'function MerchantLinkRow({ merchant }) {\n  const profileHref = merchant?.id ? `/npcs#${merchant.id}` : null;\n  const shopHref = merchant?.storefront_enabled && merchant?.id ? `/map?merchant=${merchant.id}` : null;',
    'function MerchantLinkRow({ merchant, onOpenProfile, onOpenShop }) {\n  const canOpenProfile = !!merchant?.id && typeof onOpenProfile === "function";\n  const canOpenShop = !!merchant?.storefront_enabled && !!merchant?.id && typeof onOpenShop === "function";',
    "TownSheet merchant link row callback signature"
  );

  source = replaceRequired(
    source,
    '        {profileHref ? <a className="btn btn-sm btn-outline-light" href={profileHref}>Open Profile</a> : null}\n        {shopHref ? <a className="btn btn-sm btn-warning" href={shopHref}>Browse Wares</a> : <span className={styles.marketMuted}>No storefront enabled</span>}',
    '        {merchant?.id ? <button type="button" className="btn btn-sm btn-outline-light" disabled={!canOpenProfile} onClick={() => onOpenProfile(merchant, "profile")}>Open Profile</button> : null}\n        {merchant?.storefront_enabled && merchant?.id ? <button type="button" className="btn btn-sm btn-warning" disabled={!canOpenShop} onClick={() => onOpenShop(merchant, "shop")}>Browse Wares</button> : <span className={styles.marketMuted}>No storefront enabled</span>}',
    "TownSheet merchant link buttons become callbacks"
  );

  source = replaceRequired(
    source,
    'function MarketDrawer({ marketData, townName }) {',
    'function MarketDrawer({ marketData, townName, onOpenProfile, onOpenShop }) {',
    "TownSheet market drawer callback props"
  );

  source = replaceRequired(
    source,
    '{enrichedPresent.length ? enrichedPresent.map((merchant) => <MerchantLinkRow key={`present-${merchant.id}`} merchant={merchant} />) : <div className={cls(styles.drawerItem, toneKey("stone"))}><div className={styles.drawerItemText}>No merchants are currently set to this town.</div></div>}',
    '{enrichedPresent.length ? enrichedPresent.map((merchant) => <MerchantLinkRow key={`present-${merchant.id}`} merchant={merchant} onOpenProfile={onOpenProfile} onOpenShop={onOpenShop} />) : <div className={cls(styles.drawerItem, toneKey("stone"))}><div className={styles.drawerItemText}>No merchants are currently set to this town.</div></div>}',
    "TownSheet present merchants receive profile callbacks"
  );

  source = replaceRequired(
    source,
    '{enrichedResident.length ? enrichedResident.map((merchant) => <MerchantLinkRow key={`resident-${merchant.id}`} merchant={merchant} />) : <div className={cls(styles.drawerItem, toneKey("stone"))}><div className={styles.drawerItemText}>No resident merchants are assigned to this town yet.</div></div>}',
    '{enrichedResident.length ? enrichedResident.map((merchant) => <MerchantLinkRow key={`resident-${merchant.id}`} merchant={merchant} onOpenProfile={onOpenProfile} onOpenShop={onOpenShop} />) : <div className={cls(styles.drawerItem, toneKey("stone"))}><div className={styles.drawerItemText}>No resident merchants are assigned to this town yet.</div></div>}',
    "TownSheet resident merchants receive profile callbacks"
  );

  source = replaceRequired(
    source,
    'function CrafterRow({ crafter, onOpenWorkshop }) {\n  const types = inferCrafterTypes(crafter);\n  const profileHref = crafter?.id ? `/npcs#${crafter.id}` : null;',
    'function CrafterRow({ crafter, onOpenWorkshop, onOpenProfile }) {\n  const types = inferCrafterTypes(crafter);\n  const canOpenProfile = !!crafter?.id && typeof onOpenProfile === "function";',
    "TownSheet crafter row callback signature"
  );

  source = replaceRequired(
    source,
    '        {profileHref ? <a className="btn btn-sm btn-outline-light" href={profileHref}>Open Profile</a> : null}\n        {types.length ? <button type="button" className="btn btn-sm btn-success" onClick={() => onOpenWorkshop(crafter)}>Open Workshop</button> : null}',
    '        {crafter?.id ? <button type="button" className="btn btn-sm btn-outline-light" disabled={!canOpenProfile} onClick={() => onOpenProfile(crafter, "profile")}>Open Profile</button> : null}\n        {types.length ? <button type="button" className="btn btn-sm btn-success" onClick={() => onOpenWorkshop(crafter)}>Open Workshop</button> : null}',
    "TownSheet crafter profile button becomes callback"
  );

  source = replaceRequired(
    source,
    'function CrafterDrawer({ crafters, townName, inventoryItems, onOpenWorkshop }) {',
    'function CrafterDrawer({ crafters, townName, inventoryItems, onOpenWorkshop, onOpenProfile }) {',
    "TownSheet crafter drawer callback prop"
  );

  source = replaceRequired(
    source,
    '{rows.length ? rows.map((crafter) => <CrafterRow key={crafter.id} crafter={crafter} onOpenWorkshop={onOpenWorkshop} />) : <div className={cls(styles.drawerItem, toneKey("stone"))}><div className={styles.drawerItemText}>No obvious crafters are surfaced for this town yet.</div></div>}',
    '{rows.length ? rows.map((crafter) => <CrafterRow key={crafter.id} crafter={crafter} onOpenWorkshop={onOpenWorkshop} onOpenProfile={onOpenProfile} />) : <div className={cls(styles.drawerItem, toneKey("stone"))}><div className={styles.drawerItemText}>No obvious crafters are surfaced for this town yet.</div></div>}',
    "TownSheet crafter rows receive profile callbacks"
  );

  source = replaceRequired(
    source,
    'function SharedDrawer({ panel, openPanel, setOpenPanel, adminToolsVisible, adminDrawerProps, marketData, townName, crafterData, playerInventory, onOpenWorkshop }) {',
    'function SharedDrawer({ panel, openPanel, setOpenPanel, adminToolsVisible, adminDrawerProps, marketData, townName, crafterData, playerInventory, onOpenWorkshop, onOpenCharacterProfile }) {',
    "TownSheet shared drawer profile callback prop"
  );

  source = replaceRequired(
    source,
    '<MarketDrawer marketData={marketData} townName={townName} />',
    '<MarketDrawer marketData={marketData} townName={townName} onOpenProfile={onOpenCharacterProfile} onOpenShop={onOpenCharacterProfile} />',
    "TownSheet market drawer receives profile callbacks"
  );

  source = replaceRequired(
    source,
    '<CrafterDrawer crafters={crafterData} townName={townName} inventoryItems={playerInventory} onOpenWorkshop={onOpenWorkshop} />',
    '<CrafterDrawer crafters={crafterData} townName={townName} inventoryItems={playerInventory} onOpenWorkshop={onOpenWorkshop} onOpenProfile={onOpenCharacterProfile} />',
    "TownSheet crafter drawer receives profile callback"
  );

  source = replaceRequired(
    source,
    '  playerPlants = [],\n  onCraftWorkshop,\n}) {',
    '  playerPlants = [],\n  onCraftWorkshop,\n  onOpenCharacterProfile,\n}) {',
    "TownSheet accepts parent profile callback"
  );

  source = replaceRequired(
    source,
    '<section className={styles.topPaneRow}><SharedDrawer panel={activePanel} openPanel={openPanel} setOpenPanel={setOpenPanel} adminToolsVisible={adminToolsVisible} adminDrawerProps={adminDrawerProps} marketData={marketData} townName={location?.name} crafterData={crafterData} playerInventory={playerInventory} onOpenWorkshop={setActiveWorkshopCrafter} /><TownMapPanel',
    '<section className={styles.topPaneRow}><SharedDrawer panel={activePanel} openPanel={openPanel} setOpenPanel={setOpenPanel} adminToolsVisible={adminToolsVisible} adminDrawerProps={adminDrawerProps} marketData={marketData} townName={location?.name} crafterData={crafterData} playerInventory={playerInventory} onOpenWorkshop={setActiveWorkshopCrafter} onOpenCharacterProfile={onOpenCharacterProfile} /><TownMapPanel',
    "TownSheet passes profile callback into shared drawer"
  );

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched TownSheet merchant/crafter profile callbacks and crafter storefront shell.");
  }
}

// -----------------------------------------------------------------------------
// Shared global CSS for the few literal classes added by this patch.
// -----------------------------------------------------------------------------
{
  const rel = "styles/npc-profile-panel.css";
  let source = read(rel);
  const before = source;
  const marker = "/* ===== Town NPC profile and crafter storefront v1 ===== */";
  source = appendOnce(source, marker, `${marker}\n.town-quick-profile-link {\n  width: 100%;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 0.5rem;\n  border: 0;\n  border-radius: 0.65rem;\n  padding: 0.4rem 0.55rem;\n  background: rgba(255,255,255,0.045);\n  color: inherit;\n  text-align: left;\n}\n.town-quick-profile-link:hover,\n.town-quick-profile-link:focus-visible {\n  background: rgba(126, 88, 255, 0.18);\n  outline: 1px solid rgba(190, 160, 255, 0.32);\n}\n.town-quick-profile-link span {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-weight: 700;\n}\n.town-quick-profile-link small {\n  flex: 0 0 auto;\n  color: rgba(255,255,255,0.62);\n  font-size: 0.74rem;\n}\n.town-crafter-storefront {\n  display: grid !important;\n  grid-template-columns: minmax(260px, 32%) minmax(0, 1fr);\n  gap: 1rem;\n  align-items: start;\n  max-width: min(1500px, calc(100vw - 2rem));\n}\n.town-crafter-storefront::before {\n  content: "";\n  grid-column: 1 / 2;\n  grid-row: 1 / span 24;\n  min-height: min(72vh, 860px);\n  border-radius: 1.15rem;\n  border: 1px solid rgba(245, 203, 130, 0.42);\n  background-image: linear-gradient(180deg, rgba(10, 7, 12, 0.08), rgba(10, 7, 12, 0.42)), var(--crafter-portrait-url, linear-gradient(135deg, rgba(92, 58, 33, 0.9), rgba(25, 17, 35, 0.95)));\n  background-size: cover;\n  background-position: center top;\n  background-repeat: no-repeat;\n  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.07), 0 20px 54px rgba(0,0,0,0.38);\n}\n.town-crafter-storefront > * {\n  grid-column: 2 / 3;\n}\n@media (max-width: 1050px) {\n  .town-crafter-storefront {\n    grid-template-columns: 1fr;\n  }\n  .town-crafter-storefront::before,\n  .town-crafter-storefront > * {\n    grid-column: 1 / -1;\n  }\n  .town-crafter-storefront::before {\n    min-height: 420px;\n  }\n}`);

  const sidePanelMarker = "/* ===== Town route profile side panel v1 ===== */";
  source = appendOnce(source, sidePanelMarker, `${sidePanelMarker}\n.town-profile-sidepanel-backdrop {\n  position: fixed;\n  inset: 0;\n  z-index: 3050;\n  background: rgba(5, 4, 12, 0.46);\n  display: flex;\n  justify-content: flex-end;\n  align-items: stretch;\n}\n.town-profile-sidepanel {\n  width: min(960px, calc(100vw - 28px));\n  height: 100vh;\n  overflow: auto;\n  background: rgba(13, 10, 23, 0.98);\n  border-left: 1px solid rgba(190, 160, 255, 0.28);\n  box-shadow: -24px 0 60px rgba(0,0,0,0.46);\n}\n.town-profile-sidepanel .npc-panel-inner {\n  min-height: 100vh;\n}\n@media (max-width: 760px) {\n  .town-profile-sidepanel {\n    width: 100vw;\n  }\n}`);

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched town NPC/crafter/profile CSS.");
  }
}

// -----------------------------------------------------------------------------
// Combined patch self-review. These checks intentionally avoid touching craft rules,
// movement logic, world routes, or the legacy workshop modal.
// -----------------------------------------------------------------------------
{
  const townSheet = read("components/TownSheet.js");
  const townPage = read("pages/town/[id].js");
  const mapPage = read("components/MapPageClient.js");
  const css = read("styles/npc-profile-panel.css");

  for (const token of [
    'function MerchantLinkRow({ merchant, onOpenProfile, onOpenShop })',
    'onClick={() => onOpenProfile(merchant, "profile")}',
    'onClick={() => onOpenShop(merchant, "shop")}',
    'function CrafterRow({ crafter, onOpenWorkshop, onOpenProfile })',
    'onClick={() => onOpenProfile(crafter, "profile")}',
    'function SharedDrawer({ panel, openPanel, setOpenPanel, adminToolsVisible, adminDrawerProps, marketData, townName, crafterData, playerInventory, onOpenWorkshop, onOpenCharacterProfile })',
    'onOpenWorkshop={setActiveWorkshopCrafter} onOpenCharacterProfile={onOpenCharacterProfile}',
    '{activeWorkshopCrafter ? <CrafterWorkshopModal crafter={activeWorkshopCrafter} inventoryItems={playerInventory} playerPlants={playerPlants} onClose={() => setActiveWorkshopCrafter(null)} onCraftWorkshop={onCraftWorkshop} /> : null}',
  ]) requireToken(townSheet, token, "TownSheet combined profile patch");

  for (const token of [
    'href={profileHref}>Open Profile',
    'href={shopHref}>Browse Wares',
    'const profileHref =',
    'const shopHref =',
    'import CharacterInteractionPanel',
    'import CraftingWorkspace',
    '<iframe',
  ]) requireAbsent(townSheet, token, "TownSheet combined profile patch");

  for (const token of [
    'import dynamic from "next/dynamic";',
    'const NpcPanel = dynamic(() => import("../../components/NpcPanel"), { ssr: false });',
    'const [activeTownProfileCharacter, setActiveTownProfileCharacter] = useState(null);',
    'function handleOpenTownProfile(character, initialView = "profile") {',
    'onOpenCharacterProfile={handleOpenTownProfile}',
    'className="town-profile-sidepanel-backdrop"',
    'className="town-profile-sidepanel"',
    'initialView={activeTownProfileView}',
  ]) requireToken(townPage, token, "Town route combined profile patch");

  for (const token of [
    'router.push(`/npcs',
    'router.replace(`/npcs',
    '<iframe',
  ]) requireAbsent(townPage, token, "Town route combined profile patch");

  for (const token of [
    'const tryOpen = (remaining = 10) => {',
    'const offcanvasApi = window.bootstrap?.Offcanvas || null;',
    'window.setTimeout(() => tryOpen(remaining - 1), 60);',
    'offcanvasApi.getOrCreateInstance(el).show();',
  ]) requireToken(mapPage, token, "Map offcanvas readiness patch");

  for (const token of [
    '/* ===== Town route profile side panel v1 ===== */',
    '.town-profile-sidepanel-backdrop',
    '.town-profile-sidepanel',
  ]) requireToken(css, token, "Town route side panel CSS");

  console.log("Combined town profile side panel and map load guard validated.");
}

if (changedAny) {
  console.log("Applied town NPC profile, merchant/crafter side panel, map guard, and crafter storefront patch.");
} else {
  console.log("Town NPC profile/crafter storefront/side panel patch already current.");
}
