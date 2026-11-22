#!/usr/bin/env node
// C34 B14-P14: source-only witnesses for the *still-unclosed* offer-status,
// batch child mapping and direct-NPC authorization release gates.
// No network, DB writes, PostgREST, app startup, map or production access.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const read=p=>readFileSync(path.join(root,p),"utf8");
const p6=read("scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p6_npc_capabilities_and_offers_pg17.sql");
const p8=read("scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p8_intent_dispatch_pg17.sql");
const gm=read("scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p8_gm_offer_settlement_pg17.sql");
const june=read("sql/20260624_01_inventory_item_send_rpc.sql");
const inventory=read("pages/inventory.js");
const npc=read("components/NpcPanel.js");
const manager=read("hooks/useNpcSheetActionData.js");
const town28=read("components/NpcPanelTownT28P2Research.jsx");
const town33=read("components/NpcPanelTownT33Research.jsx");
const plan=read("docs/research/C34_B14_P14_STATUS_AND_GRANT_CUTOVER_ORDER_2026-11-21.md");
test("P14 source RED: P8 initial immutable receipt does not represent latest P6 offer decision",()=>{
  assert.match(p8,/CREATE TABLE private\.c34_b14_p8_intent_receipts\s*\(/);
  assert.match(p8,/v_prior\.receipt/);
  assert.match(p6,/private\.c34_b14_p6_item_offers/);
  for(const value of ["'pending'","'accepted'","'declined'","'cancelled'"])
    assert.ok(p6.includes(value),"lost original P6 state "+value);
  assert.ok(!p6.includes("'expired'"),"Source now differs; review status model");
  assert.match(gm,/c34_b14_p8_gm_pending_offers_v1/);
  assert.match(gm,/c34_b14_p8_gm_decide_item_offer_v1/);
});
test("P14 source RED: fresh random bulk child IDs are masked and parent-child mapping is absent",()=>{
  assert.match(p8,/pg_catalog\.gen_random_uuid\(\)/);
  assert.ok(p8.includes("jsonb_set(v_child,'{request_id}',to_jsonb(p_request_id))"));
  assert.ok(!p8.includes("c34_b14_p14_intent_offer_links"),"A new mapping has been added; replace expected-RED test with signed status acceptance");
  assert.match(p8,/v_child_id,v_item,v_source/);
  assert.match(p8,/c34_b14_p8_dispatch_batch_intent_v1/);
  assert.match(plan,/private parent.?child/i);
  assert.match(plan,/missing link\/ledger/i);
});
test("P14 source RED: historic bypasses and other legitimate callsites remain distinguishable",()=>{
  assert.match(june,/RETURNS public\.inventory_items/);
  assert.match(june,/GRANT EXECUTE ON FUNCTION public\.transfer_inventory_item_v1/);
  assert.ok(inventory.includes('rpc("transfer_inventory_item_v1"'));
  assert.match(inventory,/supabase\.from\("inventory_items"\)\.update\(patch\)\.in\("id", selectedIds\)/);
  for(const original of [npc,manager,town28,town33])
    assert.ok(original.includes("get_character_inventory_v1"),"Original full-row consumer changed without review");
  assert.ok(town28.includes("transfer_inventory_item_v1"));
  assert.ok(town33.includes("transfer_inventory_item_v1"));
});
test("P14 plan explicitly holds original role and end-to-end authorization release gates",()=>{
  for(const marker of [
    "NO can_control column","gm/dm","340 Storage objects","22/34",
    "old P6 GM decision","Town","Forge","merchant","trade_requests",
    "same-JWT","fail closed","world map"
  ]) assert.ok(plan.toLowerCase().includes(marker.toLowerCase()),"P14 contract omission: "+marker);
  assert.match(gm,/REVOKE ALL ON FUNCTION public\.c34_b14_p6_decide_item_offer_v1/);
  assert.match(plan,/owner.*signoff/i);
});
