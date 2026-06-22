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

function appendOnce(source, marker, block) {
  if (source.includes(marker)) return source;
  return `${source.trimEnd()}\n\n${block}\n`;
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
// Map NPC drawer: selecting any NPC from the drawer should open the profile panel,
// even if that NPC is not currently rendered as a world-map pin.
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

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched MapPageClient drawer NPC profile opening.");
  }
}

// -----------------------------------------------------------------------------
// Town page data: carry portrait fields into town rosters/crafters/merchants so
// crafters can use profile art in the town workshop presentation.
// -----------------------------------------------------------------------------
{
  const rel = "pages/town/[id].js";
  let source = read(rel);
  const before = source;

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

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched town page portrait data flow.");
  }
}

// -----------------------------------------------------------------------------
// TownSheet: dedupe resident merchants shown in both Present + Resident sections,
// and add a merchant-style crafter storefront shell using the crafter portrait.
// -----------------------------------------------------------------------------
{
  const rel = "components/TownSheet.js";
  let source = read(rel);
  const before = source;

  source = replaceOnce(
    source,
    'import { buildTownData } from "../utils/townData";\nimport styles from "./TownSheet.module.scss";',
    'import { buildTownData } from "../utils/townData";\nimport { supabase } from "../utils/supabaseClient";\nimport styles from "./TownSheet.module.scss";',
    "TownSheet supabase import"
  );

  source = replaceOnce(
    source,
    `function merchantSubtitle(merchant) {\n  return merchant?.storefront_tagline || merchant?.storefront_title || merchant?.role || merchant?.affiliation || "Merchant";\n}\n`,
    `function merchantSubtitle(merchant) {\n  return merchant?.storefront_tagline || merchant?.storefront_title || merchant?.role || merchant?.affiliation || "Merchant";\n}\n\nfunction safeCssUrl(value = "") {\n  const clean = String(value || "").replace(/"/g, "%22");\n  return clean ? \`url("\${clean}")\` : "";\n}\n\nfunction townCrafterPortraitUrl(crafter) {\n  const direct = crafter?.portrait_shop_url || crafter?.portrait_url || crafter?.image_url || "";\n  if (direct) return direct;\n  const storagePath = crafter?.portrait_storage_path || "";\n  if (!storagePath) return "";\n  try {\n    return supabase.storage.from("npc-portraits").getPublicUrl(storagePath).data?.publicUrl || "";\n  } catch {\n    return "";\n  }\n}\n`,
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

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched TownSheet merchant dedupe and crafter storefront shell.");
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
  source = appendOnce(source, marker, `${marker}\n.town-quick-profile-link {\n  width: 100%;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 0.5rem;\n  border: 0;\n  border-radius: 0.65rem;\n  padding: 0.4rem 0.55rem;\n  background: rgba(255,255,255,0.045);\n  color: inherit;\n  text-align: left;\n}\n.town-quick-profile-link:hover,\n.town-quick-profile-link:focus-visible {\n  background: rgba(126, 88, 255, 0.18);\n  outline: 1px solid rgba(190, 160, 255, 0.32);\n}\n.town-quick-profile-link span {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-weight: 700;\n}\n.town-quick-profile-link small {\n  flex: 0 0 auto;\n  color: rgba(255,255,255,0.62);\n  font-size: 0.74rem;\n}\n.town-crafter-storefront {\n  display: grid !important;\n  grid-template-columns: minmax(260px, 32%) minmax(0, 1fr);\n  gap: 1rem;\n  align-items: start;\n  max-width: min(1500px, calc(100vw - 2rem));\n}\n.town-crafter-storefront::before {\n  content: \"\";\n  grid-column: 1 / 2;\n  grid-row: 1 / span 24;\n  min-height: min(72vh, 860px);\n  border-radius: 1.15rem;\n  border: 1px solid rgba(245, 203, 130, 0.42);\n  background-image: linear-gradient(180deg, rgba(10, 7, 12, 0.08), rgba(10, 7, 12, 0.42)), var(--crafter-portrait-url, linear-gradient(135deg, rgba(92, 58, 33, 0.9), rgba(25, 17, 35, 0.95)));\n  background-size: cover;\n  background-position: center top;\n  background-repeat: no-repeat;\n  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.07), 0 20px 54px rgba(0,0,0,0.38);\n}\n.town-crafter-storefront > * {\n  grid-column: 2 / 3;\n}\n@media (max-width: 1050px) {\n  .town-crafter-storefront {\n    grid-template-columns: 1fr;\n  }\n  .town-crafter-storefront::before,\n  .town-crafter-storefront > * {\n    grid-column: 1 / -1;\n  }\n  .town-crafter-storefront::before {\n    min-height: 420px;\n  }\n}`);

  if (source !== before) {
    write(rel, source);
    changedAny = true;
    console.log("Patched town NPC/crafter CSS.");
  }
}

if (changedAny) {
  console.log("Applied town NPC profile, merchant dedupe, and crafter storefront patch.");
} else {
  console.log("Town NPC profile/crafter storefront patch already current.");
}
