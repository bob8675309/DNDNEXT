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
 "pages/inventory.js","components/NpcPanel.js",
 "components/character/CharacterInteractionPanel.js","components/MerchantPanel.js",
 "utils/useWallet.js","pages/encounters/combat.js"]) {
 const body=src(p);
 assert.doesNotMatch(body,/T28P2Research|t28P2CommerceGuardCandidate|useWalletT28P2Research/,
  "T28-P2 cannot be imported by active product: "+p);
}

// The only permitted active path is a TOWN-only, disabled-by-default wrapper;
// the original world-map/shared character module and merchant remain pinned.
// Do not import the guarded commerce helper directly into the town page.
const townRoute=src("pages/town/[id].js");
assert.match(townRoute,/const T28_P2_TOWN_SHOP_ENABLED = process\.env\.NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP === "1"/);
assert.match(townRoute,/const TownProfilePanel = T28_P2_TOWN_SHOP_ENABLED \? GuardedTownCharacterInteractionPanel : CharacterInteractionPanel/);
assert.doesNotMatch(townRoute,/t28P2CommerceGuardCandidate|useWalletT28P2Research|MerchantPanelT28P2Research/,
 "Town page can only import isolated Profile wrapper, not guarded commerce directly");

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
assert.match(panel,/const stockMatches = Boolean\(stockScope\.actorId/);
assert.match(panel,/const visibleStock = stockMatches \? stock : EMPTY_VISIBLE_STOCK/);

assert.match(panel,/gp == null \? "Unavailable" : gp === -1/,
 "Current wallet read failure must not silently render false zero GP");
assert.match(wallet,/if \(value !== null\) setErr\(""\)/,
 "Current recovered GP must clear obsolete wallet-fetch errors");
assert.match(guard,/onWallet\(null\);\s*onError\(error\);\s*current = true;/,
 "Current wallet read error must invalidate old displayed numeric GP");
const walletGuardRegression=src("scripts/integration/c34/test_t28_p2_commerce_guard_candidate.mjs");
assert.match(walletGuardRegression,/PASS T28-P2-WALLET-READ-R09/);
assert.match(walletGuardRegression,/Failed CURRENT wallet read must clear/);

assert.match(panel,/if \(result\.current && result\.error\) setStock\(\[\]\);/,
 "Current stock read rejection must clear stale purchaseable items");
assert.match(panel,/const stockRefreshFailed = refreshed\[0\]\.status === "rejected"/);
assert.match(panel,/const purchaseInFlightRef = useRef\(null\)/,
 "Synchronous in-flight buy lock must exist before render state update");
assert.match(panel,/if \(purchaseInFlightRef\.current\?\.key === purchaseKey\) return/,
 "Two same-scope Buy calls must not issue duplicate RPCs");
assert.match(panel,/if \(purchaseInFlightRef\.current === purchaseToken\) purchaseInFlightRef\.current = null/,
 "Old shop completion must not unlock new shop's purchase");
assert.match(panel,/purchaseScope\.actorId !== uid/,
 "Buy must not use stale account state before auth effects");
assert.match(panel,/purchaseScope\.merchantId !== merchant\?\.id/,
 "Buy must not use stale merchant prop before selection effects");


assert.match(panel,/await Promise\.allSettled\(\[fetchStock\(\), refreshWallet\(\)\]\)/,
 "T28-P2 committed buyer must not become failed purchase due to wallet refresh");
assert.doesNotMatch(panel,/await Promise\.all\(\[fetchStock\(\), refreshWallet\(\)\]\)/,
 "Do not reintroduce a false purchase-failure notice after successful server debit");
const buyerRegressions=src("scripts/integration/c34/test_t28_p2_purchase_refresh_unit.mjs");
for(const code of ["T28-P2-BUY-ORIGINAL-RED","T28-P2-BUY-R01","T28-P2-BUY-R02","T28-P2-BUY-R03","T28-P2-BUY-R04","T28-P2-BUY-R05","T28-P2-BUY-R06","T28-P2-BUY-R07","T28-P2-BUY-R08"]) {
 assert.ok(buyerRegressions.includes(code),"Buyer handler test case missing: "+code);
}

assert.match(wallet,/const activeTargetMatches = guardRef\.current\.snapshot\(\)\.targetUserId === selectedTargetId/);
assert.match(wallet,/const visibleGp = activeTargetMatches \? gp : null/);
assert.match(wallet,/return \{uid,gp:visibleGp,loading:visibleLoading,err,label,refresh,set\}/);
const hookRegression=src("scripts/integration/c34/test_t28_p2_wallet_set_stale_unit.mjs");
assert.match(hookRegression,/render\("player-B",false\)/);
assert.match(hookRegression,/PASS T28-P2-SET-R04/);
assert.doesNotMatch(panel,/setStock\(data\s*\|\|\s*\[\]\)/,
 "source-derived merchant may not reintroduce unchecked original response commit");
assert.doesNotMatch(wallet,/setGp\(Number\.isFinite\(data\).*\)/,
 "source-derived wallet may not reintroduce unchecked original response commit");
assert.ok(originalMerchant.includes('p_merchant_id: merchant.id'));
assert.ok(originalWallet.includes('p_user: userId || null'));
console.log("PASS T28-P2-SOURCE: original merchant/wallet blobs pinned; buyer handler original RED / guarded GREEN unit; no active product/map imports; signed buyer transaction UNVERIFIED");
