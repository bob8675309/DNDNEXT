#!/usr/bin/env node
// J94–J102 UI source contract checks: STATIC ONLY; NOT browser interaction.
// Checks how the current Next.js Pages Router Forge UI constructs v3 market
// payloads and how character inventory views invoke source-authorized RPCs.
// No credentials, network, production database, Next.js build or deployment.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(path,"utf8");
const create=read("components/NewNpcModalV3.js");
const model=read("components/useNpcForgeDerivedModel.js");
const equip=read("components/NpcForgeEquipmentStep.js");
const characterInventory=read("components/NpcPanel.js");
const adminInventory=read("pages/inventory.js");
const check=(source,needle,scope)=>assert.ok(source.includes(needle),
  scope+" source contract changed: "+needle);
for(const t of [
 'supabase.rpc("create_player_character_v3"',
 'p_payload: playerPayload(payload, proxySpellChoices, magicSelections)',
 'p_magic_selections: magicSelections'
])check(create,t,"Forge player creation v3");
for(const t of [
 "const startingEquipmentSelections = playerMode",
 "draft.startingEquipment || {}",
 "startingEquipmentSelections,"
])check(model,t,"Player Forge draft -> canonical sheet");
for(const t of [
 'mode: "market"',
 "marketMerchantId", "marketPurchases",
 "merchantId:", "stockId:", "qty:",
 "keepStartingGold: false",
 "onChange?.({ ...selection"
])check(equip,t,"Starting market UI staged stock intent");
for(const t of [
 'supabase.rpc("get_character_inventory_v1"',
 'supabase.rpc("set_character_inventory_equipment_v1"',
 'supabase.rpc("transfer_inventory_item_v1"'
])check(characterInventory,t,"NPC/player character inventory client access");
for(const t of [
 'supabase.from("inventory_items").update(',
 'supabase.from("inventory_items").delete()',
 'supabase.rpc("transfer_inventory_item_v1"'
])check(adminInventory,t,"Legacy inventory page direct writer inventory");
console.log("PASS STATIC UI SOURCE: Forge v3 request, market merchant/stock/quantity intent, canonical sheet forwarding, character-authorized inventory RPCs");
console.log("RELEASE GATE OPEN: legacy pages/inventory.js still uses direct INSERT/UPDATE/DELETE/bulk paths; static checks do NOT prove browser, permissions or gameplay behavior.");
