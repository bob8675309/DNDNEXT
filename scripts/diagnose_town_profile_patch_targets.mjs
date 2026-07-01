import fs from "node:fs";
import path from "node:path";

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function countOf(source, token) {
  return source.split(token).length - 1;
}

function check({ file, label, before, after, required = false }) {
  const source = read(file);
  const afterCount = countOf(source, after);
  const beforeCount = countOf(source, before);
  let state = "missing";
  if (afterCount > 0) state = "already_applied";
  else if (beforeCount === 1) state = "ready_to_apply";
  else if (beforeCount > 1) state = "ambiguous_anchor";

  return {
    file,
    label,
    required,
    state,
    beforeCount,
    afterCount,
  };
}

const targets = [
  {
    file: "components/LocationSideBar.js",
    label: "LocationSideBar props: onOpenMerchant",
    before: '  onOpenRoutes,\n  offcanvasId = "locPanel",',
    after: '  onOpenRoutes,\n  onOpenMerchant,\n  offcanvasId = "locPanel",',
  },
  {
    file: "components/LocationSideBar.js",
    label: "LocationSideBar presentPeople source",
    before: '  const presentPeople = (townData.people || []).slice(0, 4);',
    after: '  const presentPeople = (rosterChars || []).slice(0, 8);',
  },
  {
    file: "components/LocationSideBar.js",
    label: "LocationSideBar profile links",
    before: '            {presentPeople.length ? presentPeople.map((p) => <li key={p.title}>{p.title}</li>) : <li>No one surfaced</li>}',
    after: 'className="town-quick-profile-link"',
  },
  {
    file: "components/MapPageClient.js",
    label: "MapPageClient drawer NPC selection opens profile",
    before: `          if (npcRow) setSelNpc(npcRow);\n          setSelMerchant(null);\n          setSelLoc(null);\n          setDebugOpen(true);`,
    after: `          if (npcRow) {\n            setSelNpc(npcRow);\n            showExclusiveOffcanvas("npcPanel");\n          }`,
  },
  {
    file: "components/MapPageClient.js",
    label: "MapPageClient Bootstrap offcanvas readiness retry",
    required: true,
    before: `  const showExclusiveOffcanvas = useCallback(\n    (id) => {\n      if (!window.bootstrap) return;\n      for (const other of OFFCANVAS_IDS) {\n        if (other !== id) hideOffcanvas(other);\n      }\n      const el = document.getElementById(id);\n      if (!el) return;\n      window.bootstrap.Offcanvas.getOrCreateInstance(el).show();\n    },\n    [OFFCANVAS_IDS, hideOffcanvas]\n  );`,
    after: `const tryOpen = (remaining = 10) => {`,
  },
  {
    file: "pages/town/[id].js",
    label: "Town route dynamic import",
    required: true,
    before: 'import { useEffect, useMemo, useState } from "react";',
    after: 'import dynamic from "next/dynamic";',
  },
  {
    file: "pages/town/[id].js",
    label: "Town route NpcPanel dynamic component",
    required: true,
    before: 'import { pickId } from "../../utils/townData";\n',
    after: 'const NpcPanel = dynamic(() => import("../../components/NpcPanel"), { ssr: false });',
  },
  {
    file: "pages/town/[id].js",
    label: "Town merchant normalization portrait fields",
    before: '    tags: Array.isArray(row.tags) ? row.tags : [],\n  };',
    after: 'portrait_shop_url: row.portrait_shop_url || null,',
  },
  {
    file: "pages/town/[id].js",
    label: "Town roster portrait select",
    before: '.select("id,name,kind,race,role,affiliation,status,state,location_id,last_known_location_id,projected_destination_id,is_hidden,map_icon_id,tags")',
    after: '.select("id,name,kind,race,role,affiliation,status,state,location_id,last_known_location_id,projected_destination_id,is_hidden,map_icon_id,tags,portrait_url,portrait_storage_path,portrait_thumb_url,portrait_shop_url,portrait_source,image_url")',
  },
  {
    file: "pages/town/[id].js",
    label: "Town merchant select portrait fields",
    before: '          "storefront_bg_video_url",\n          "tags",',
    after: '          "portrait_shop_url",',
  },
  {
    file: "pages/town/[id].js",
    label: "Town route parent profile state",
    required: true,
    before: '  const [playerPlants, setPlayerPlants] = useState([]);\n  const [playerUserId, setPlayerUserId] = useState(null);',
    after: 'const [activeTownProfileCharacter, setActiveTownProfileCharacter] = useState(null);',
  },
  {
    file: "pages/town/[id].js",
    label: "Town route profile open handler",
    required: true,
    before: '  return inserted;\n}\n\n  return (',
    after: 'function handleOpenTownProfile(character, initialView = "profile") {',
  },
  {
    file: "pages/town/[id].js",
    label: "Town route profile fragment start",
    required: true,
    before: '      ) : location ? (\n        <TownSheet',
    after: '      ) : location ? (\n        <>\n        <TownSheet',
  },
  {
    file: "pages/town/[id].js",
    label: "Town route parent-owned profile side panel",
    required: true,
    before: '          playerPlants={playerPlants}\n          onCraftWorkshop={handleCraftWorkshop}\n        />\n      ) : (',
    after: 'className="town-profile-sidepanel-backdrop"',
  },
  {
    file: "components/TownSheet.js",
    label: "TownSheet supabase import",
    required: true,
    before: 'import { buildTownData } from "../utils/townData";',
    after: 'import { supabase } from "../utils/supabaseClient";',
  },
  {
    file: "components/TownSheet.js",
    label: "TownSheet crafter portrait helpers",
    before: `function merchantSubtitle(merchant) {\n  return merchant?.storefront_tagline || merchant?.storefront_title || merchant?.role || merchant?.affiliation || "Merchant";\n}\n`,
    after: 'function townCrafterPortraitUrl(crafter) {',
  },
  {
    file: "components/TownSheet.js",
    label: "TownSheet merchant drawer resident dedupe",
    before: '  const enrichedResident = resident.map((m) => ({ ...m, isResident: true, isPresent: presentIds.has(m.id) }));',
    after: '  const enrichedResident = resident.filter((m) => !presentIds.has(m.id)).map((m) => ({ ...m, isResident: true, isPresent: false }));',
  },
  {
    file: "components/TownSheet.js",
    label: "TownSheet crafter portrait style var",
    before: '  return (\n    <div className={styles.modalBackdrop} onClick={onClose}>',
    after: 'const crafterStorefrontStyle = crafterPortraitUrl ? { "--crafter-portrait-url": safeCssUrl(crafterPortraitUrl) } : {};',
  },
  {
    file: "components/TownSheet.js",
    label: "TownSheet crafter storefront class",
    before: '      <div className={cls(styles.crafterModal, styles.crafterModalBuilder)} onClick={(e) => e.stopPropagation()}>',
    after: 'town-crafter-storefront',
  },
  {
    file: "components/TownSheet.js",
    label: "TownSheet merchant row callback signature after storefront transform",
    required: true,
    before: 'function MerchantLinkRow({ merchant, onBrowseWares }) {\n  const profileHref = merchant?.id ? `/npcs#${merchant.id}` : null;\n  const canBrowseWares = Boolean(merchant?.storefront_enabled && merchant?.id);',
    after: 'function MerchantLinkRow({ merchant, onBrowseWares, onOpenProfile, onOpenShop })',
  },
  {
    file: "components/TownSheet.js",
    label: "TownSheet merchant profile and shop buttons stay in town",
    required: true,
    before: '        {profileHref ? <a className="btn btn-sm btn-outline-light" href={profileHref}>Open Profile</a> : null}\n        {canBrowseWares ? <button type="button" className="btn btn-sm btn-warning" onClick={() => onBrowseWares?.(merchant)}>Browse Wares</button> : <span className={styles.marketMuted}>No storefront enabled</span>}',
    after: 'onClick={() => onOpenShop(merchant, "shop")}',
  },
  {
    file: "components/TownSheet.js",
    label: "TownSheet accepts parent profile callback",
    required: true,
    before: '  playerPlants = [],\n  onCraftWorkshop,\n}) {',
    after: '  onOpenCharacterProfile,\n}) {',
  },
  {
    file: "components/TownSheet.js",
    label: "TownSheet passes profile callback into shared drawer",
    required: true,
    before: '<section className={styles.topPaneRow}><SharedDrawer panel={activePanel} openPanel={openPanel} setOpenPanel={setOpenPanel} adminToolsVisible={adminToolsVisible} adminDrawerProps={adminDrawerProps} marketData={marketData} townName={location?.name} crafterData={crafterData} playerInventory={playerInventory} onOpenWorkshop={setActiveWorkshopCrafter} onBrowseWares={setActiveMerchant} /><TownMapPanel',
    after: 'onOpenWorkshop={setActiveWorkshopCrafter} onBrowseWares={setActiveMerchant} onOpenCharacterProfile={onOpenCharacterProfile}',
  },
  {
    file: "styles/npc-profile-panel.css",
    label: "Town NPC profile and crafter storefront CSS",
    before: "",
    after: '/* ===== Town NPC profile and crafter storefront v1 ===== */',
  },
  {
    file: "styles/npc-profile-panel.css",
    label: "Town route profile side panel CSS",
    before: "",
    after: '/* ===== Town route profile side panel v1 ===== */',
  },
];

const results = targets.map(check);
const grouped = results.reduce((acc, result) => {
  acc[result.state] = (acc[result.state] || 0) + 1;
  return acc;
}, {});

console.log("Town profile patch target diagnostic");
console.log(JSON.stringify(grouped, null, 2));
for (const result of results) {
  const required = result.required ? "required" : "optional";
  console.log(`${result.state.padEnd(16)} ${required.padEnd(8)} ${result.file} :: ${result.label} (before=${result.beforeCount}, after=${result.afterCount})`);
}

const ambiguous = results.filter((result) => result.state === "ambiguous_anchor");
if (ambiguous.length) {
  console.error("Ambiguous anchors found. Do not source-bake until these are resolved:");
  for (const result of ambiguous) console.error(`- ${result.file}: ${result.label}`);
  process.exit(1);
}

const missingRequired = results.filter((result) => result.required && result.state === "missing");
if (missingRequired.length) {
  console.error("Required anchors missing from source-at-rest. This is expected while the Vercel runner still applies earlier patches, but source-baking must resolve these before removing the mutator:");
  for (const result of missingRequired) console.error(`- ${result.file}: ${result.label}`);
}
