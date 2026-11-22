// C34 B14-P16: source-only expected-RED / isolated new candidate witness.
// Requires no database, network, hosted privileges, or production deployment.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const sha=p=>{
 const bytes=fs.readFileSync(path.join(root,p));
 return createHash("sha1").update(Buffer.concat([
  Buffer.from("blob "+bytes.length+"\0"),bytes])).digest("hex");
};
const sqlPath="scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p16_disposable_consent_cutover_pg17.sql";
const runnerPath="scripts/integration/c34/run_t46_p3_p4b_c2b14_p16_consent_cutover_signed.mjs";
const parentPath="scripts/integration/c34/run_t46_p3_p4b_c2b14_p8_intent_dispatch_signed.mjs";
const sql=read(sqlPath),signed=read(runnerPath),parent=read(parentPath);

test("P16 original June/P2/P4/P6/P8 SQL remains source-identical, scratch overlay does not redefine original RPC bodies",()=>{
 for(const [file,blob] of Object.entries({
  "sql/20260624_01_inventory_item_send_rpc.sql":"2f1a5818ff0d5a7d87a239e5b1a8f0302b6ff5e6",
  "scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p2_inventory_authority_pg17.sql":"e175cd403f0c5032426c0aa995a245e6c260d896",
  "scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p4_controlled_npc_gear_pg17.sql":"d268104b3efffd1fcf34da1d7b083f54f76bbefd",
  "scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p6_npc_capabilities_and_offers_pg17.sql":"6ba27c821ce75054a7e7aebab4ff893a2d541bea",
  "scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p8_intent_dispatch_pg17.sql":"5a19e580f988a4dc3500e9811683c861bb5e0e91",
  "scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p8_gm_offer_settlement_pg17.sql":"37b560b08d3824cee9415456d5229b1d74c98495",
  "scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p14_offer_status_and_links_pg17.sql":"2805cd107b3fc1964946e4deaffe1ed03ffcc779"
 })) assert.equal(sha(file),blob,"Original accepted B14 SQL unexpectedly altered: "+file);
 assert.doesNotMatch(sql,/CREATE OR REPLACE FUNCTION public\.transfer_inventory_item_v1\(/);
 assert.doesNotMatch(sql,/CREATE OR REPLACE FUNCTION public\.c34_b14_p2_transfer_inventory_item_v1\(/);
 assert.doesNotMatch(sql,/CREATE OR REPLACE FUNCTION public\.c34_b14_p8_dispatch_item_intent_v1\(/);
 assert.doesNotMatch(sql,/DROP TABLE|DROP POLICY|DROP FUNCTION public\./);
 console.log("PASS P16-SOURCE-ORIGINALS: all prior original SQL exact Git blobs and no replacement or destructive SQL");
});
test("P16 local-only guard closes old EXECUTE signatures and full table UPDATE, preserving safe equipment column scope",()=>{
 assert.match(sql,/DO \$p16_guard\$/);
 assert.match(sql,/to_regprocedure\('public\.list_item_send_targets_v1\(\)'\) IS NOT NULL/);
 assert.match(signed,/missingLegacy/);
 assert.match(signed,/SOURCE-VS-INSTALLED/);
 assert.doesNotMatch(sql,/CREATE OR REPLACE FUNCTION public\.list_item_send_targets_v1\(/);
 assert.match(sql,/current_database\(\)<>'postgres'/);
 assert.match(sql,/server_version_num/);
 assert.match(signed,/C34_P16_SIGNED_CONFIRM/);
 assert.match(sql,/REVOKE UPDATE ON TABLE public\.inventory_items FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/REVOKE UPDATE\(owner_type,owner_id,user_id\)/);
 assert.match(sql,/GRANT UPDATE \(is_equipped,equip_slot,updated_at\)/);
 for(const legacy of [
  "list_item_send_targets_v1","transfer_inventory_item_v1",
  "c34_b14_p2_transfer_inventory_item_v1",
  "c34_b14_p2_transfer_inventory_items_bulk_v1",
  "c34_b14_p4_send_character_gear_to_controlled_npc_v1",
  "c34_b14_p6_offer_item_v1","c34_b14_p6_decide_item_offer_v1",
  "c34_b14_p8_dispatch_batch_intent_v1"
 ]) assert.ok(sql.includes("REVOKE ALL ON FUNCTION public."+legacy+"("),
  "Legacy direct API not explicitly gated: "+legacy);
 assert.doesNotMatch(sql,/REVOKE ALL ON FUNCTION public\.c34_b14_p14_dispatch_batch_intent_v1/);
 assert.doesNotMatch(sql,/REVOKE ALL ON FUNCTION public\.c34_b14_p8_gm_decide_item_offer_v1/);
 console.log("PASS P16-SOURCE-ACL: current original direct NPC APIs restricted without blocking P14 consent and GM decision");
});
test("P16 explicit PR312 character grant does not backfill editor, NPC direct INSERT and owner changes denied by invoker guard",()=>{
 assert.match(sql,/coalesce\(cp\.can_control,false\) OR coalesce\(cp\.can_edit,false\)/);
 assert.match(sql,/AND NOT \('player-character'=ANY/);
 assert.match(sql,/NEW\.owner_type IS DISTINCT FROM OLD\.owner_type/);
 assert.match(sql,/current_user NOT IN \('authenticated','anon'\)/);
 assert.match(sql,/TG_OP='INSERT'/);
 assert.match(sql,/CREATE TRIGGER c34_b14_p16_guard_direct_inventory_dml/);
 assert.doesNotMatch(sql,/UPDATE public\.character_permissions SET can_control=can_edit/);
 assert.doesNotMatch(sql,/ALTER TABLE public\.character_permissions ADD COLUMN/);
 assert.match(signed,/PASS P16-PR312-CONTROL/);
 assert.match(signed,/PASS P16-RAW-DML/);
 assert.match(signed,/PASS P16-LEGACY-DENY/);
 console.log("PASS P16-SOURCE-CONTROL: delegated combat control independent and direct NPC INSERT/owner mutation RED tested with real JWT");
});
test("P16 signed runner composed after original P14, restores exact scratch authorization, protects independent inventory sources",()=>{
 assert.ok(parent.indexOf("await runC34B14P14StatusSigned")>=0);
 assert.ok(parent.indexOf("await runC34B14P16ConsentCutoverSigned")>
  parent.indexOf("await runC34B14P14StatusSigned"),"P16 must run only after original P14 test");
 for(const marker of ["PASS P16-PRESERVE-DML","PASS P16-NEW-INTENTS",
  "PASS P16-INDEPENDENT","PASS P16-RESTORE","PASS P16-SIGNED"])
  assert.ok(signed.includes(marker),"Missing signed preservation: "+marker);
 assert.match(signed,/finally\s*\{/);
 assert.match(signed,/DROP TRIGGER IF EXISTS c34_b14_p16_guard_direct_inventory_dml/);
 assert.match(signed,/original function body/);
 assert.match(read("components/MerchantPanel.js"),/rpc\("buy_from_merchant"/);
 assert.match(read("components/TradeRequestsPanel.js"),/rpc\("accept_trade"/);
 assert.match(read("pages/town/[id].js"),/rollbackRows/);
 assert.match(read("docs/research/C34_B14_P15_CONTROL_AUTHORITY_AND_LEGACY_CONSENT_CUTOVER_2026-11-22.md"),/22\/34/);
 console.log("PASS P16-SOURCE-PRESERVE: exact original signed chain, all role ACL restored, Town/Forge/GM/trade/merchant hold");
});
