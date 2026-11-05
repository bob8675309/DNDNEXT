#!/usr/bin/env node
// Cross-entry NPC Profile presentation contract. This is a UI-only scope gate.
import fs from "node:fs";
import assert from "node:assert/strict";

const read = (p) => fs.readFileSync(p, "utf8");
const map = read("components/MapPageClient.js");
const town = read("pages/town/[id].js");
const crafter = read("components/town/TownCrafterInteractionPanel.js");
const inventory = read("pages/inventory.js");
const npcsPage = read("pages/npcs.js");
const npc = read("components/NpcPanel.js");
const globalHost = read("components/GlobalNpcProfileOverlay.js");
const request = read("utils/npcProfileOverlay.js");
const app = read("pages/_app.js");
const css = read("styles/npc-profile-centered.css");

function requireTokens(label, source, tokens) {
  for (const token of tokens) assert.ok(source.includes(token), `${label}: missing ${token}`);
}
requireTokens("map", map, [
  'className="offcanvas offcanvas-end loc-panel map-npc-profile-centered"',
  'id="npcPanel"',
  'data-bs-backdrop="true"',
  'data-bs-scroll="true"',
  'const showExclusiveOffcanvas = useCallback(',
  'showExclusiveOffcanvas("npcPanel")',
  'showExclusiveOffcanvas("merchantPanel")',
  'onOpenDrawer={(id) => {',
  'onBrowseWares={(row) => {',
  'const onNpcHidden = () => setSelNpc(null);',
  'onBackToProfile={() => {',
  '<CharacterInteractionPanel',
]);
requireTokens("town", town, [
  'const CharacterInteractionPanel = dynamic(',
  'onOpenCharacterProfile={handleOpenTownProfile}',
  'setActiveTownProfileView("profile");',
  'className="town-profile-sidepanel-backdrop"',
  'className="town-profile-sidepanel"',
  'role="dialog"',
  'aria-modal="true"',
  'onClose={() => setActiveTownProfileCharacter(null)}',
  'initialView={activeTownProfileView}',
  '<CharacterInteractionPanel',
]);
requireTokens("town crafter", crafter, [
  'initialView: "profile"',
  'townCrafterInteractionCharacter(crafter)',
  'onClose,',
]);
requireTokens("inventory", inventory, [
  'import { openNpcProfile } from "@/utils/npcProfileOverlay";',
  'meta.profileCharacterId = charId;',
  'onClick={() => openNpcProfile(ownerMeta.profileCharacterId)}',
  'Open Profile',
  'Manage in NPC page',
  'if (id) pushOwner("npc", id);',
  'if (id) pushOwner("merchant", id);',
  'onTransferItem={(rowId, targetKey) => transferToTarget(rowId, targetKey, { rethrow: true })}',
]);
requireTokens("global event", request, [
  'export const OPEN_NPC_PROFILE_EVENT',
  'new CustomEvent(OPEN_NPC_PROFILE_EVENT',
  'UUID_PATTERN.test(id)',
]);
requireTokens("global host", globalHost, [
  'window.addEventListener(OPEN_NPC_PROFILE_EVENT, onOpen)',
  'router.pathname === "/npcs"',
  '.from("characters").select(PROFILE_COLUMNS).eq("id", id).maybeSingle()',
  'supabase.rpc("is_admin", { uid })',
  'initialView="profile"',
  'role="dialog"',
  'aria-modal="true"',
  'event.key === "Escape"',
  'onClose={close}',
  '<CharacterInteractionPanel',
]);
for (const secret of ['"secret"', '"motivation"', '"mannerism"', '"voice"', '"sheet"', '"inventory_items"']) {
  assert.ok(!globalHost.includes(secret), `Global host must not fetch private raw ${secret}`);
}
requireTokens("shared panel", npc, [
  'typeof onOpenDrawer === "function"',
  'onOpenDrawer(npcId)',
  '>Let me browse your wares.</button>',
]);
requireTokens("app host", app, [
  'import GlobalNpcProfileOverlay from "../components/GlobalNpcProfileOverlay";',
  '<GlobalNpcProfileOverlay />',
  'import "../styles/npc-profile-centered.css";',
]);
requireTokens("centered CSS", css, [
  '#npcPanel.offcanvas.offcanvas-end.loc-panel.map-npc-profile-centered.show',
  '.town-profile-sidepanel-backdrop',
  '.town-profile-sidepanel',
  '.app-npc-profile-backdrop',
  '.app-npc-profile-shell',
  '@media (max-width: 768px)',
  'prefers-reduced-motion',
]);
assert.ok(!npcsPage.includes("GlobalNpcProfileOverlay"), "Admin NPC management page must remain separate");
assert.ok(!map.includes('import { openNpcProfile } from "@/utils/npcProfileOverlay"'),
  "Do not rewire world map animation/interaction via the global event");
for (const sql of ["supabase.from(\"character_permissions\").update", "delete().eq(\"location_id\"", "sql/candidates/"]) {
  assert.ok(!globalHost.includes(sql), "Global display host cannot write data: "+sql);
}
console.log("NPC Profile-first, centered map/town and global inventory entry contracts PASS (UI-only).");
