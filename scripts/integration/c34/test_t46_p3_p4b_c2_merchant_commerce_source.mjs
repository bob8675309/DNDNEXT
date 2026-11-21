#!/usr/bin/env node
// T46-P3-P4B-C2 source guard. Source-original buyer, no SQL grants expansion.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=p=>fs.readFileSync(path.join(root,p));
const gitBlob=b=>crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0"),b])).digest("hex");
const refs={
 "scripts/fixtures/forge_original_merchant_buy_source_pg17.sql":"72fd9f0f80a83adaec67caf80a762e238f1dcd8c",
 "scripts/integration/c34/candidates/t46_p3_p4b_c2_merchant_buy_pg17.sql":"c96a524407dcdcaf35ced189958d0832ab7e8dce",
 "scripts/integration/c34/test_t46_p3_p4b_b_real_town_browser_signed.mjs":"40e88676f0c50e98ed16edf0be58f84dd1598f23",
 "components/MerchantPanel.js":"22e4d0810603bc0322904573cb5fe0c14bad1f88",
 "components/MerchantStorefrontView.js":"9460eb1ea15994b9b0ed2abefba660e9b4c9370c",
 "utils/useWallet.js":"f34b99f1d6eee66420d57bdcefdc6d3427092e25",
 "components/MapPageClient.js":"61f8738da2ca3d8635b5a413bfdc18c094228a0a"
};
test("C2 exact original buyer and original B source inherited, distinct local commerce fixtures",()=>{
 for(const [file,sha] of Object.entries(refs))
  assert.equal(gitBlob(read(file)),sha,"Original PR/source custody drift: "+file);
 const buy=read("scripts/fixtures/forge_original_merchant_buy_source_pg17.sql").toString();
 for(const x of [
  "SECURITY DEFINER","buyer uuid := auth.uid()","for update",
  "player_wallets","inventory_items","character_stock","Insufficient funds",
  "Not enough stock","Stock not found","on conflict (user_id) do nothing",
  "insert into public.inventory_items","card_payload","p_merchant_id"
 ])assert.ok(buy.toLowerCase().includes(x.toLowerCase()),"Original buyer source drift "+x);
 const fixture=read("scripts/integration/c34/candidates/t46_p3_p4b_c2_merchant_buy_pg17.sql").toString();
 assert.ok(fixture.includes("GRANT SELECT ON public.character_stock TO authenticated"));
 assert.ok(fixture.includes("REVOKE ALL ON public.player_wallets"));
 assert.ok(!fixture.includes("GRANT SELECT ON public.characters TO authenticated"));
 assert.ok(!fixture.includes("GRANT ALL ON public.inventory_items"));
 assert.ok(!fixture.includes("CREATE OR REPLACE FUNCTION public.buy_from_merchant"));
 const runner=read("scripts/integration/c34/test_t46_p3_p4b_c2_signed_merchant_purchase.mjs").toString();
 for(const marker of [
  "1dbe8c24c4c718396d7256f6f7465354",
  "PASS T46-P3-P4B-C2-PURCHASE",
  "PASS T46-P3-P4B-C2-INSUFFICIENT-UI",
  "PASS T46-P3-P4B-C2-SERVER-NEG",
  "buildTownPresenceOverlay",
  "buildHeldNpcWithIntelAndPrint",
  "buildMerchantReturnToProfile",
  "NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP",
  "NEXT_PUBLIC_C34_T33_TOWN_STAGE2_SAFE_PROFILE",
  "assert.equal(gitBlob(fs.readFileSync(merchantPath))",
 ])assert.ok(runner.includes(marker),"C2 signed runner losing source/negative "+marker);
 assert.ok(!runner.includes('GRANT SELECT ON public.characters TO authenticated'));
});
test("C2 source-only RED: original buyer does not check merchant hidden/current town, must not claim authorization parity",()=>{
 const src=read("scripts/fixtures/forge_original_merchant_buy_source_pg17.sql").toString();
 assert.ok(!/stock\.is_hidden|merchant\.is_hidden|storefront_enabled|location_id/.test(src),
  "Original buyer visibility/merchant guard changed; investigate instead of old source claim");
 // Missing merchant gating is intentionally NOT accepted as secure purchase;
 // C2 signed original positive proof cannot authorize deployment until owner
 // reviews that independent original transaction/visibility security contract.
});
