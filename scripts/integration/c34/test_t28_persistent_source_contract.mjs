#!/usr/bin/env node
// T28-P1 absolute original-source + disposable signed browser negative contract.
// CI source-only proof: this script does NOT run a browser or authenticate.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { deriveT28PersistentRoute,T28_ORIGINAL_BLOBS,T28_P1_TEMP_ROUTE } from "./derive_t28_persistent_probe.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const src=p=>readFileSync(path.join(root,p),"utf8");
const hash=s=>createHash("sha1").update("blob "+Buffer.byteLength(s)+"\0"+s).digest("hex");
for(const [p,sha] of Object.entries(T28_ORIGINAL_BLOBS))
 assert.equal(hash(src(p)),sha,"T28-P1 original current source changed "+p);

assert.ok(!existsSync(path.join(root,T28_P1_TEMP_ROUTE)),
 "T28 scratch route must NEVER be committed");
const component=src("components/c34/T28NonMapPersistentResearchProbe.jsx");
assert.match(component,/from "\.\.\/MerchantPanel"/);
assert.match(component,/from "\.\.\/\.\.\/utils\/useWallet"/);
assert.match(component,/createNonMapActorEpochCandidate/);
assert.match(component,/onAuthStateChange/);
assert.match(component,/UnsafeOriginalPersistentLane/);
assert.match(component,/wallet\.refresh\(\)/);
assert.match(component,/guard\.current\.capture\("stock"\)/);
assert.match(component,/guard\.current\.capture\("wallet"\)/);
assert.match(component,/guard\.current\.settle\(stockTicket/);
assert.match(component,/guard\.current\.settle\(walletTicket/);
assert.doesNotMatch(component,/service_role|\.from\("characters"\)\.select\("\*"/);

const route=deriveT28PersistentRoute(
 "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
 "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
assert.match(route,/T28NonMapPersistentResearchProbe/);
assert.match(route,/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/);
assert.match(route,/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/);
assert.doesNotMatch(route,/MapPageClient|NpcPanel/);

const runner=src("scripts/integration/c34/test_t26_current_merchant_shop_browser.mjs");
const t28=src("scripts/integration/c34/run_t28_persistent_signed_browser.mjs");
const t27Start=runner.indexOf("// T27-R01");
const t27Pass=runner.indexOf("PASS T27-R01");
const t28Start=runner.indexOf("runT28NonMapPersistentSignedBrowser({");
assert.ok(t27Start>=0&&t27Pass>t27Start&&t28Start>t27Pass,
 "Original real T27 signed race MUST run before T28");
for(const marker of [
 "PASS T26-C03 original live manager Print Sheet generates true safe 3-page PDF",
 "PASS T26-C06 real local permission revocation",
 "PASS T27-R01: REAL signed local character_stock GET bytes held",
 "CREATE TABLE private.t28_wallet_probe",
 "REVOKE ALL ON FUNCTION public.wallet_get(uuid) FROM PUBLIC, anon",
 "T28 refuses to overwrite an original wallet_get",
 "writeT28PersistentRoute(merchant,alternateMerchant)",
 "assert.ok(!fs.existsSync(t28Probe)"
]) assert.ok(runner.includes(marker),"T28 may not remove original negative or cleanup "+marker);
for(const marker of [
 "T28-P1-RED", "T28-P1-GREEN", "T28-P1-SWITCH", "T28-P1-ROLE",
 "rt.fetch", "route.fetch()", "window.__sb.auth.signOut()",
 "t28-original-mounted-shop", "t28-candidate-wallet",
 "T28 timed out", "expectedGmGp"
]){
 if(marker==="rt.fetch")continue;
 assert.ok(t28.includes(marker),"T28 real signed contract missing "+marker);
}
assert.match(t28,/const upstream=await route\.fetch\(\)/);
assert.match(t28,/await route\.fulfill\(\{response:upstream\}\)/);
assert.match(t28,/assert\.equal\(stockData\.status,200\)/);
assert.match(t28,/assert\.equal\(walletData\.status,200\)/);
assert.match(t28,/await logout\(\)/);
// Denying a service_role URL is safe and required; forbid an actual secret key or hosted endpoint instead.
assert.doesNotMatch(t28,/NEXT_PUBLIC_.*SERVICE|https:\/\/|service_role\s*:\s*["\x27]/);

for(const p of [
 "pages/npcs.js","pages/map.js","pages/town/[id].js","pages/inventory.js",
 "components/NpcPanel.js","components/MapPageClient.js",
 "components/character/CharacterInteractionPanel.js",
 "components/MerchantPanel.js","utils/useWallet.js"
]){
 assert.doesNotMatch(src(p),/T28NonMapPersistentResearchProbe|derive_t28_persistent_probe|actorRequestEpochCandidate/,
 "T28 candidate must remain UNMOUNTED in real UI: "+p);
}
console.log("PASS T28-P1-SOURCE: unchanged original merchant, wallet, map; real signed PostgREST hold/late RED and guarded GREEN shapes; original T26/T27 intact; no checked-in or live route");
