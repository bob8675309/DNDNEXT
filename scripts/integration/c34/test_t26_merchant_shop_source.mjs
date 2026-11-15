#!/usr/bin/env node
// T26 source negatives; original shared Profile + map never imported or edited.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync,existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveT26CurrentMerchantShop,T26_TEMP_ROUTE,T26_SOURCE_BLOBS } from "./derive_t26_current_merchant_shop.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=p=>readFileSync(path.join(root,p),"utf8");
test("T26-S01 all original source blobs pinned, no mounted scratch path",()=>{
 assert.equal(Object.keys(T26_SOURCE_BLOBS).length,6);
 assert.equal(existsSync(path.join(root,T26_TEMP_ROUTE)),false);
 const {output,edits}=deriveT26CurrentMerchantShop();
 assert.ok(edits.length>=12);
 assert.match(output,/from "\.\.\/components\/c34\/NonMapMerchantShopResearchPanel"/);
 assert.match(output,/function NpcsPage/);
 assert.match(output,/CharacterSheetPanel/);
 assert.match(output,/storeHref=/);
 assert.match(output,/onOpenProfile=/);
 assert.match(output,/onOpenStore=/);
 assert.match(output,/focusRaw/);
 assert.doesNotMatch(output,/import NpcPanel from "\.\.\/components\/character\/CharacterInteractionPanel"/);
});
test("T26-S02 real shop imported, profile-first navigation and account switch guarded",()=>{
 const s=read("components/c34/NonMapMerchantShopResearchPanel.jsx");
 assert.match(s,/import MerchantPanel from "\.\.\/MerchantPanel"/);
 assert.match(s,/readNonMapNpcProfileCandidate\(supabase, selectedId/);
 assert.match(s,/withDossier: false, withSheet: false, withPrivateBackstory: false/);
 assert.match(s,/result\.profile\.kind !== selectedKind/);
 assert.match(s,/profileState\.actor === currentActor/);
 assert.match(s,/onAuthStateChange/);
 assert.match(s,/requestId !== requestRef\.current/);
 assert.match(s,/setProfileState\(null\)/);
 assert.match(s,/Let me browse your wares\./);
 assert.match(s,/Return to Profile/);
 assert.match(s,/canShop.*storefront_enabled === true/);
 assert.match(s,/onBackToProfile=\{\(\) => setView\("profile"\)\}/);
 assert.doesNotMatch(s,/loadCharacterSecrets|get_character_secrets_v1|\.from\("characters"\)/);
});
test("T26-S03 original merchant stock/purchase renderer remains unchanged",()=>{
 const {output}=deriveT26CurrentMerchantShop();
 assert.match(output,/onOpenStore=.*setProfilePanelInitialView/);
 const merchant=read("components/MerchantPanel.js");
 assert.match(merchant,/from\("character_stock"\)/);
 assert.match(merchant,/\.select\("\*"\)/);
 assert.match(merchant,/\.order\("display_name"/);
 assert.match(merchant,/MerchantStorefrontView/);
 assert.match(merchant,/supabase\.rpc\("buy_from_merchant"/);
 assert.match(merchant,/merchant=\{merchant\}/);
});
test("T26-N01 all actual mounted/Map/Town consumer source files reject scratch integration",()=>{
 for(const p of ["pages/npcs.js","pages/_app.js","components/MapPageClient.js",
  "components/NpcPanel.js","pages/town/[id].js","components/character/CharacterInteractionPanel.js"]){
  const s=read(p);
  assert.doesNotMatch(s,/NonMapMerchantShopResearchPanel|derive_t26_current_merchant_shop|__c34_t26_probe/,p);
 }
});
