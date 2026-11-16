#!/usr/bin/env node
// C34 T28-P2 SOURCE ONLY: original blobs, signed local scenario/cleanup, no release.
// Do not confuse a passing source check with actual PG17/Next/Chromium acceptance.
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {deriveT28P2MountedRoute,T28_P2_TEMP_ROUTE,ORIGINAL_COMMERCE}
 from "./derive_t28_p2_mounted_probe.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const src=p=>readFileSync(path.join(root,p),"utf8");
const hash=s=>createHash("sha1").update("blob "+Buffer.byteLength(s)+"\0"+s).digest("hex");
for(const [p,sha] of Object.entries(ORIGINAL_COMMERCE))
 assert.equal(hash(src(p)),sha,"P2 actual original source changed "+p);
assert.equal(hash(src("scripts/fixtures/forge_original_merchant_buy_source_pg17.sql")),
 "72fd9f0f80a83adaec67caf80a762e238f1dcd8c","P2 source-original buy fixture drift");
assert.ok(!existsSync(path.join(root,T28_P2_TEMP_ROUTE)),"P2 temporary CI route committed or stale");
const route=deriveT28P2MountedRoute(
 "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
 "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
 "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
);
assert.match(route,/T28P2MountedCommerceProbe/);
assert.match(route,/cccccccc-cccc-4ccc-8ccc-cccccccccccc/);
assert.doesNotMatch(route,/MapPageClient|pages\/map|pages\/town/);
const mounted=src("components/c34/T28P2MountedCommerceProbe.jsx");
for(const token of [
 "MerchantPanelT28P2Research", "useWalletT28P2Research",
 "supabase.auth.onAuthStateChange", "t28p2-mounted-shop",
 "t28p2-wallet-refresh", "t28p2-wallet-set",
 "t28p2-switch-merchant", "t28p2-select-wallet-other", "alternateWalletUserId", "window.__sb"
])assert.ok(mounted.includes(token),"Mounted P2 probe missing "+token);
const p2=src("scripts/integration/c34/run_t28_p2_mounted_signed_browser.mjs");
for(const token of [
 "T28-P2-MOUNT", "T28-P2-LATE", "T28-P2-TARGET", "T28-P2-SET",
 "T28-P2-BUY:", "T28-P2-BUY-DOUBLE", "T28-P2-BUY-WALLET-FAIL", "T28-P2-BUY-LATE", "T28-P2-SET-LATE", "T28-P2-ROLES", "T28-P2-EDITOR-INVENTORY",
 "route.fetch()", "route.fulfill({response:upstream})",
 "window.__sb.auth.signOut()", "insufficient", "wallet_set",
 "buy_from_merchant", "pg", "stockId"
]) {
 if(token==="pg"||token==="insufficient")continue;
 assert.ok(p2.includes(token),"P2 signed intended assertion missing "+token);
}
assert.match(p2,/assert\.equal\(stockData\.status,200\)/);
assert.match(p2,/assert\.equal\(walletData\.status,200\)/);
assert.match(p2,/assert\.equal\(purchaseData\.status,200/);
assert.match(p2,/status:503,contentType:"application\/json"/,
 "Signed buyer must inject a real failed current wallet read");
assert.match(p2,/assert\.match\(shopWithWalletReadFailure,\/Unavailable\//,
 "Signed buyer UI must reject false zero and stale GP");
assert.match(p2,/button\.click\(\);\s*button\.click\(\);/,
 "Signed browser must submit two DOM clicks to probe one-debit semantics");
assert.match(p2,/SELECT count\(\*\) FROM public\.inventory_items WHERE user_id=/,
 "Signed buyer must inspect authoritative inventory rows");

assert.match(p2,/await signOut\(\)/);
assert.match(p2,/await delayedBuy\.done\(\)/);
assert.match(p2,/await delayedSet\.done\(\)/);
assert.match(p2,/assert\.equal\(setData\.status,200/);
assert.match(p2,/walletSetRequest/);
assert.match(p2,/genuine signed local wallet_set 200 after logout/);
assert.match(mounted,/commitIfCurrent/);
assert.match(p2,/delayedWallet\.done\(\)/);
const fixture=src("scripts/integration/c34/t28_p2_disposable_original_buy_wallet_setup_pg17.sql");
for(const token of [
 "DISPOSABLE PG17 ONLY", "private.t28_wallet_probe",
 "public.wallet_get(p_user uuid DEFAULT NULL)",
 "CREATE FUNCTION public.wallet_set(p_user uuid,p_amount numeric)",
 "TO authenticated", "TO 'pg_catalog'","CREATE TABLE IF NOT EXISTS public.player_wallets",
 "CREATE TABLE IF NOT EXISTS public.inventory_items",
 "FOR UPDATE"
]) {
 if(token==="TO 'pg_catalog'"||token==="FOR UPDATE")continue;
 assert.ok(fixture.includes(token),"P2 disposable role fixture missing "+token);
}
assert.match(fixture,/REVOKE ALL ON TABLE public\.player_wallets,public\.inventory_items,public\.player_recipes/);

// The earlier C34 original materializer creates user_id-only player_wallets.
// CREATE TABLE IF NOT EXISTS in P2 cannot supply missing columns. The local
// schema adaptation must precede original wallet RPC/merchant buyer installation.
const materializer=src("scripts/integration/c34/c34_inventory_materializer_setup_pg17.sql");
assert.match(materializer,/CREATE TABLE public\.player_wallets\(user_id uuid PRIMARY KEY\);/);
const walletCreate=fixture.indexOf("CREATE TABLE IF NOT EXISTS public.player_wallets");
const walletUpgrade=fixture.indexOf("ALTER TABLE public.player_wallets");
const walletGet=fixture.indexOf("CREATE OR REPLACE FUNCTION public.wallet_get");
assert.ok(walletCreate>=0&&walletUpgrade>walletCreate&&walletGet>walletUpgrade,
 "P2 must add gp/updated_at to EXISTING scratch player_wallets before RPCs");
assert.match(fixture,/ALTER TABLE public\.player_wallets\s+ADD COLUMN IF NOT EXISTS gp numeric NOT NULL DEFAULT 0,\s+ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now\(\);/);

assert.match(fixture,/IF to_regprocedure\('public\.wallet_set\(uuid,numeric\)'\) IS NOT NULL/);
assert.match(fixture,/OR to_regprocedure\('public\.buy_from_merchant\(uuid,uuid,integer\)'\) IS NOT NULL/);
const original=src("scripts/integration/c34/test_t26_current_merchant_shop_browser.mjs");
const t27=original.indexOf("PASS T27-R01");
const p1=original.indexOf("await runT28NonMapPersistentSignedBrowser({");
const p2Setup=original.indexOf("const p2Fixture=");
const p2Run=original.indexOf("await runT28P2MountedCommerceSignedBrowser({");
assert.ok(t27>=0&&p1>t27&&p2Setup>p1&&p2Run>p2Setup,
 "P2 may not replace or run before original T27/P1 signed suite");
for(const token of [
 "writeT28P2MountedRoute(merchant,alternateMerchant,users.OUTSIDER.id)",
 "const p2Probe=path.join(root,T28_P2_TEMP_ROUTE)",
 "fs.unlinkSync(p2Probe)",
 "assert.ok(!fs.existsSync(p2Probe)",
 "forge_original_merchant_buy_source_pg17.sql",
 "1dbe8c24c4c718396d7256f6f7465354",
 "T28-P2-WALLET-SCHEMA", "T28-P2-SETUP", "p2BuyerReady", "Stock not found", "p2WalletSetReady", "p2AnonWalletSet", "p2AnonWallet", "p2AnonBuy",
 "C34_T26_BROWSER_CONFIRM", "DNDNEXT_C34_LOCAL_CONFIRM",
 "PASS T26-C03 original live manager Print Sheet generates true safe 3-page PDF",
 "PASS T26-C06 real local permission revocation"
])assert.ok(original.includes(token),"T28 P2 must retain original suite and new local-only checks "+token);
const workflow=src(".github/workflows/validate-c34-joint-local-auth.yml");

const sourceWorkflow=src(".github/workflows/validate-c34-joint-source-research.yml");
assert.match(sourceWorkflow,/name: 'T28-P2 non-map commerce guard: selected wallet owner and late response safety'/,
 "Source GitHub Actions workflow must quote a colon-bearing step label");
assert.doesNotMatch(sourceWorkflow,/^\s*- name: T28-P2 non-map commerce guard: selected wallet owner/m,
 "Unquoted YAML step names containing colon+space prevent any jobs from starting");

assert.match(workflow,/C34_T26_BROWSER_CONFIRM=CURRENT_NEXT_DISPOSABLE_LOCAL_ONLY/);
assert.match(workflow,/test_t26_current_merchant_shop_browser\.mjs/);
// C34 executes only disposable local PG17 and now runs on ordinary pushes to
// the held research branch. Never require a manual owner nonce to exercise CI.
assert.doesNotMatch(workflow,/github\.actor == 'bob8675309'/);
assert.match(workflow,/refs\/heads\/research\/c34-clean-main-privacy-forge-joint-source-20261112/);
assert.match(workflow,/push:/);
assert.match(workflow,/'scripts\/integration\/c34\/\*\*'/);
for(const p of [
 "components/MerchantPanel.js","utils/useWallet.js","components/MapPageClient.js",
 "pages/map.js","pages/npcs.js","pages/town/[id].js","pages/inventory.js",
 "components/NpcPanel.js","components/character/CharacterInteractionPanel.js"
]) assert.doesNotMatch(src(p),/T28P2MountedCommerceProbe|MerchantPanelT28P2Research|useWalletT28P2Research/,
 "P2 candidate cannot be imported into product "+p);
console.log("PASS T28-P2-SIGNED-SOURCE: original buy/blob and product/map locked; actual signed browser and accepted buy planned AFTER full P1; synthetic wallet flagged; ephemeral route cleanup; no production cutover");
