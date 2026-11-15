#!/usr/bin/env node
// T28-P2 SOURCE CONTRACT only: does NOT compile/render the candidate or test signed transport.
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import path from "node:path";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const src=p=>readFileSync(path.join(root,p),"utf8");
const gitBlob=s=>createHash("sha1").update("blob "+Buffer.byteLength(s)+"\0"+s).digest("hex");
const originalMerchant=src("components/MerchantPanel.js");
const originalWallet=src("utils/useWallet.js");
assert.equal(gitBlob(originalMerchant),"22e4d0810603bc0322904573cb5fe0c14bad1f88");
assert.equal(gitBlob(originalWallet),"f34b99f1d6eee66420d57bdcefdc6d3427092e25");
const panel=src("components/c34/MerchantPanelT28P2Research.jsx");
const wallet=src("utils/c34/useWalletT28P2Research.js");
const guard=src("utils/c34/t28P2CommerceGuardCandidate.mjs");
for(const p of ["pages/map.js","components/MapPageClient.js","pages/npcs.js",
 "pages/town/[id].js","pages/inventory.js","components/NpcPanel.js",
 "components/character/CharacterInteractionPanel.js","components/MerchantPanel.js",
 "utils/useWallet.js","pages/encounters/combat.js"]) {
 const body=src(p);
 assert.doesNotMatch(body,/T28P2Research|t28P2CommerceGuardCandidate|useWalletT28P2Research/,
  "T28-P2 cannot be imported by active product: "+p);
}
assert.ok(!existsSync(path.join(root,"pages/__c34_t28_p2_probe.jsx")),"P2 research route cannot be checked in");
for(const token of [
 "import MerchantStorefrontView from \"../MerchantStorefrontView\"",
 "createT28P2CommerceGuardCandidate",
 "useWalletT28P2Research",
 "supabase.from(\"character_stock\").select(\"*\")",
 ".eq(\"character_id\",merchantId).order(\"display_name\"",
 "guard.selectMerchant(merchantIdRef.current)",
 "guard.revoke()",
 "guard.loadStock()",
 "samePurchaseScope()",
 "supabase.rpc(\"buy_from_merchant\"",
 "reroll_merchant_inventory_v2",
 "onBackToProfile",
 "update_character"
]) assert.ok(panel.includes(token),"T28-P2 guarded original merchant source missing: "+token);
for(const token of [
 "createT28P2CommerceGuardCandidate",
 "supabase.auth.onAuthStateChange",
 "supabase.auth.getSession()",
 "guard.selectWalletTarget(userIdRef.current)",
 "guard.loadWallet()",
 "supabase.rpc(\"wallet_get\"",
 "supabase.rpc(\"wallet_set\"",
 "start.actorEpoch === end.actorEpoch",
 "start.targetEpoch === end.targetEpoch",
 "lastCommittedGp.current"
]) assert.ok(wallet.includes(token),"T28-P2 guarded original wallet source missing: "+token);
for(const token of [
 "targetUserId", "targetEpoch", "stockReadSeq", "walletReadSeq",
 "scope.capture(\"stock\")", "scope.capture(\"wallet\")",
 "scope.settle(ticket", "selectWalletTarget", "dispose"
]) assert.ok(guard.includes(token),"T28-P2 helper missing: "+token);
assert.doesNotMatch(panel,/setStock\(data\s*\|\|\s*\[\]\)/,
 "source-derived merchant may not reintroduce unchecked original response commit");
assert.doesNotMatch(wallet,/setGp\(Number\.isFinite\(data\).*\)/,
 "source-derived wallet may not reintroduce unchecked original response commit");
assert.ok(originalMerchant.includes('p_merchant_id: merchant.id'));
assert.ok(originalWallet.includes('p_user: userId || null'));
console.log("PASS T28-P2-SOURCE: original merchant/wallet blobs pinned; isolated source-derived guarded candidate; no active product/map imports; purchase preserved but UNTESTED");
