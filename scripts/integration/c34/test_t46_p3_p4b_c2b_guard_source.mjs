#!/usr/bin/env node
// C34 T46-P3-P4B-C2-B2: strictly offline buyer-source preservation.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";
import {buildC2B2GuardedOriginalBuyer,ORIGINAL_BUYER_BLOB,ORIGINAL_BUYER_FUNCTION_MD5} from "./candidates/t46_p3_p4b_c2b_merchant_eligibility_guard.mjs";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=p=>fs.readFileSync(path.join(root,p));
const blob=b=>crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0"),b])).digest("hex");
const source={
 "scripts/fixtures/forge_original_merchant_buy_source_pg17.sql":"72fd9f0f80a83adaec67caf80a762e238f1dcd8c",
 "scripts/integration/c34/test_t46_p3_p4b_c2b_hidden_direct_buy_signed.mjs":"d246984c716d58e2bc6b8e4ad13d140730552d6d",
 "scripts/integration/c34/test_t46_p3_p4b_c2_signed_merchant_purchase.mjs":"00f4f580c59c76fc515f2c877a27622cb94f033b",
 "scripts/integration/c34/candidates/t46_p3_p4b_c2b_merchant_eligibility_guard.mjs":"bde3cb3bd79a20fa2777a902c8e091d591d56f28",
 "components/MerchantPanel.js":"22e4d0810603bc0322904573cb5fe0c14bad1f88",
 "utils/useWallet.js":"f34b99f1d6eee66420d57bdcefdc6d3427092e25",
 "components/MapPageClient.js":"61f8738da2ca3d8635b5a413bfdc18c094228a0a"
};
test("B2 exactly preserved original buyer and sibling PR source custody",()=>{
 for(const [p,sha] of Object.entries(source))
  assert.equal(blob(read(p)),sha,"Source drift "+p);
 assert.equal(ORIGINAL_BUYER_BLOB,source["scripts/fixtures/forge_original_merchant_buy_source_pg17.sql"]);
 assert.equal(ORIGINAL_BUYER_FUNCTION_MD5,"1dbe8c24c4c718396d7256f6f7465354");
});
test("B2 only adds one seller transaction lock and 42501 eligibility guard before original stock lock",()=>{
 const original=read("scripts/fixtures/forge_original_merchant_buy_source_pg17.sql").toString();
 const derived=buildC2B2GuardedOriginalBuyer(original);
 const begin=derived.indexOf("if buyer is null");
 const added=derived.indexOf("from public.characters seller");
 const stock=derived.indexOf("select * into stock");
 const debit=derived.indexOf("update public.player_wallets");
 const inventory=derived.indexOf("insert into public.inventory_items(");
 assert.ok(begin>0&&begin<added&&added<stock&&stock<debit&&debit<inventory);
 for(const x of ["seller.kind = 'merchant'","seller.is_hidden is not true",
  "seller.storefront_enabled is true","for share;","using errcode='42501'"])
  assert.ok(derived.includes(x),"Missing C2 guard: "+x);
 assert.ok(!/seller\.state|seller\.location_id|seller\.home_location_id/.test(derived),
  "Never silently close traveling or camping merchants");
 assert.ok(derived.includes("insert into public.player_recipes"));
 assert.ok(derived.includes("if cur_gp <> -1 then"));
 assert.ok(derived.includes("for i in 1..buy_qty loop"));
 assert.throws(()=>buildC2B2GuardedOriginalBuyer(derived));
 assert.throws(()=>buildC2B2GuardedOriginalBuyer(original.replace("stock public.character_stock%rowtype;","stock text;")));
 assert.equal(original.includes("Merchant unavailable"),false);
});
test("B2 signed runner retains original B1 RED, C2-A browser, flag OFF, exhaustive scoped buyer ledger and source restoration",()=>{
 const run=read("scripts/integration/c34/test_t46_p3_p4b_c2b_guarded_buy_signed.mjs").toString();
 for(const mark of [
  "EXPECTED ORIGINAL T46-P3-P4B-C2-B1-HIDDEN-RED",
  "PASS T46-P3-P4B-C2-PURCHASE",
  "PASS T46-P3-P4B-C2-INSUFFICIENT-UI",
  "PASS T46-P3-P4B-C2-B2-LOCAL-SOURCE",
  "PASS T46-P3-P4B-C2-B2-REJECT",
  "PASS T46-P3-P4B-C2-B2-VALID",
  "PASS T46-P3-P4B-C2-B2-RECIPE",
  "PASS T46-P3-P4B-C2-B2-INFINITE",
  "PASS T46-P3-P4B-C2-B2-SIGNED",
  "NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP",
  "NEXT_PUBLIC_C34_T33_TOWN_STAGE2_SAFE_PROFILE",
  "assert.equal(gitBlob(fs.readFileSync(merchantPath))",
  "assert.equal(gitBlob(fs.readFileSync(townPath))",
  "assert.equal(gitBlob(fs.readFileSync(sheetPath))",
  "buildC2B2GuardedOriginalBuyer"
 ])assert.ok(run.includes(mark),"Lost B2 original/negative marker "+mark);
 assert.ok(!run.includes("GRANT SELECT ON public.characters TO authenticated"));
 assert.ok(!run.includes("ALTER FUNCTION public.buy_from_merchant"));
});
