#!/usr/bin/env node
// T38-P2-R5 original-current-source shop parity contract. No hosted access.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {test} from "node:test";
import {createHash} from "node:crypto";
const root=process.cwd(),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const blob=s=>createHash("sha1").update("blob "+Buffer.byteLength(s)+"\0").update(s).digest("hex");
const original=read("pages/npcs.js"),panel=read("components/NpcPanel.js");
const merchant=read("components/MerchantPanel.js"),wallet=read("utils/useWallet.js");
const source=read("sql/20260802_01_player_character_inventory_and_sheet_actions.sql");
const browser=read("scripts/integration/c34/test_t38_p2_r5_merchant_profile_shop_signed_browser.mjs");
test("R5 original Profile, Shop, Wallet and NPC manager sources preserved exactly",()=>{
 for(const [name,code,expected] of [
  ["pages/npcs.js",original,"7fc00b9b3ace6233d1648a3d017f8a05e072d722"],
  ["components/NpcPanel.js",panel,"e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db"],
  ["components/MerchantPanel.js",merchant,"22e4d0810603bc0322904573cb5fe0c14bad1f88"],
  ["utils/useWallet.js",wallet,"f34b99f1d6eee66420d57bdcefdc6d3427092e25"]
 ])assert.equal(blob(code),expected,"R5 refuses source change "+name);
});
test("R5 original Profile first Shop, stock, wallet and character-inventory paths",()=>{
 for(const val of ['normalizePanelView(initialView)','setPanelView("profile")',
  'function renderShopPanel()','<MerchantPanel merchant={view}',
  'function renderInventoryPanel()','get_character_inventory_v1',
  'isMerchantView ? <button','onBackToProfile={() => setPanelView("profile")}'])
  assert.ok(panel.includes(val),"Original NpcPanel missing "+val);
 for(const val of ['.from("character_stock")','.eq("character_id", merchant.id)',
  '.rpc("buy_from_merchant"','fetchStock(), refreshWallet()',
  'onBackToProfile','MerchantStorefrontView'])
  assert.ok(merchant.includes(val),"Original MerchantPanel missing "+val);
 assert.match(source,/lower\(coalesce\(i\.owner_type, ''\)\) in \('npc', 'merchant', 'character'\)/);
 assert.match(wallet,/\.rpc\("wallet_get"/);
 assert.match(original,/onOpenProfile=\{\(\) => \{ setProfilePanelInitialView\("profile"\); setProfilePanelOpen\(true\); \}\}/);
});
test("R5 genuine signed local browser uses exact official stock SELECT policy and refuses hosted traffic",()=>{
 for(const val of ["ORIGINAL_MERCHANT_SHOP_INVENTORY_DISPOSABLE_ONLY",
  "makeT36Source","reconcileT36Route","T36_LOCAL_ROUTE",
  "GRANT SELECT ON public.character_stock TO authenticated",
  "character_stock_select_authenticated","current_database()",
  "T38-P2-R5-NPC-PROFILE","T38-P2-R5-CONVERTED-SHOP",
  "T38-P2-R5-PROFILE-SHOP-PROFILE","T38-P2-R5-ORIGINAL-PURCHASE",
  "T38-P2-R5-REVERT-TO-NPC","T38-P2-R5-ROLE-ISOLATION","T38-P2-R5-CLEANUP",
  "/rpc/buy_from_merchant","get_npc_dossier_admin_v1",
  "canonical(npc)"])assert.ok(browser.includes(val),"R5 source/acceptance marker missing "+val);
 assert.doesNotMatch(browser,/https:\/\/[^/]*supabase\.co|SUPABASE_SERVICE_ROLE_KEY|serviceRoleKey/i);
 assert.ok(browser.includes(String.raw`if(/supabase\.co|supabase\.in|service_role/i.test(url))`),
  "R5 must preserve the defensive network blocker for hosted Supabase and privileged keys");
 assert.doesNotMatch(browser,/DROP TABLE|TRUNCATE|DROP POLICY|ALTER ROLE/i);
});
