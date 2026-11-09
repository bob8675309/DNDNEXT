#!/usr/bin/env node
// Guard the composition of the independently tested wide/Profile-first UI and
// safe server-projected NPC reader before any merged presentation is reviewed.
import fs from "node:fs";
import assert from "node:assert/strict";
const read=(path)=>fs.readFileSync(path,"utf8");
const panel=read("components/NpcPanel.js");
const overlay=read("components/GlobalNpcProfileOverlay.js");
const map=read("components/MapPageClient.js");
const town=read("pages/town/[id].js");
const app=read("pages/_app.js");
const admin=read("pages/npcs.js");
const css=read("styles/npc-profile-centered.css");
const author=read("components/CreatorBackstoryPanel.js");
function has(s,token,label){assert.ok(s.includes(token),label+" missing "+token);}
for(const t of [
 'isAdmin ? "get_npc_dossier_admin_v1" : "get_npc_profile_visible_v1"',
 'if (!isAdmin && (!inventoryAccess.checked || !inventoryAccess.canEdit))',
 'publicLore[entry.key]',
 'key === "secret"',
 '<CreatorBackstoryPanel key={npcId} characterId={npcId} />',
 'typeof onOpenDrawer === "function"',
 'onOpenDrawer(npcId)',
 'Let me browse your wares.',
]) has(panel,t,"shared secure+centered NpcPanel");
assert.ok(!panel.includes("loadCharacterSecrets("),"No direct GM Secret lookup in general Profile");
assert.ok(!panel.includes('.from("characters")'),"No private raw column fetch inside general Profile");
for(const t of [
 'window.addEventListener(OPEN_NPC_PROFILE_EVENT, onOpen)',
 'router.pathname === "/npcs"',
 'const PROFILE_COLUMNS',
 'initialView="profile"',
 'role="dialog"',
 'aria-modal="true"',
 '<CharacterInteractionPanel',
]) has(overlay,t,"global centered overlay");
for(const forbidden of [
 '"secret"', '"motivation"', '"mannerism"', '"voice"', '"sheet"',
 'get_character_secrets_v1', 'character_backstory_secrets'
]) assert.ok(!overlay.includes(forbidden),"Global event host cannot request "+forbidden);
for(const t of [
 'map-npc-profile-centered',
 'id="npcPanel"',
 'data-bs-backdrop="true"',
 'showExclusiveOffcanvas("npcPanel")',
]) has(map,t,"map presentation entry");
for(const t of [
 'setActiveTownProfileView("profile");','role="dialog"',
 'aria-modal="true"','<CharacterInteractionPanel',
]) has(town,t,"town Profile entry");
for(const t of [
 '<GlobalNpcProfileOverlay />','import "../styles/npc-profile-centered.css";',
]) has(app,t,"global registration");
for(const t of [
 '#npcPanel.offcanvas.offcanvas-end.loc-panel.map-npc-profile-centered',
 '.app-npc-profile-backdrop','.app-npc-profile-shell',
]) has(css,t,"centered CSS");
has(admin,'get_npc_dossier_admin_v1',"independent Admin NPC page");
has(admin,'secret: isAdmin ? safeStr(details?.secret || selected?.secret) : ""',"GM-only PDF print");
assert.ok(!admin.includes("loadCharacterSecrets"),"No bulk GM secrets on Admin roster");
has(author,'can_edit_creator_backstory_v1',"private author editor capability");
has(author,'.from("character_backstory_secrets")',"private author RLS record");
console.log("Integrated centered NPC Profile + server-safe GM/creator readers source boundary PASS.");
