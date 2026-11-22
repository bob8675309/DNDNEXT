// P18 additive disposable-only character-item mint guard, provenance and
// exact original RED-before-GREEN signed suite order. Not production approval.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const blob=p=>{
 const bytes=fs.readFileSync(path.join(root,p));
 return createHash("sha1").update(Buffer.concat([
  Buffer.from("blob "+bytes.length+"\0"),bytes])).digest("hex");
};
const sqlPath="scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p18_disposable_character_item_creation_gate_pg17.sql";
const signedPath="scripts/integration/c34/run_t46_p3_p4b_c2b14_p18_character_insert_guard_signed.mjs";
const parentPath="scripts/integration/c34/run_t46_p3_p4b_c2b14_p16_consent_cutover_signed.mjs";
const sql=read(sqlPath),signed=read(signedPath),parent=read(parentPath);

test("P18 preserves original accepted P16/June/Forge/Inventory/Town blob identities",()=>{
 for(const [p,sha] of Object.entries({
  "scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p16_disposable_consent_cutover_pg17.sql":"4aafcb071d21573e2f2f193bfa57eca931ca945c",
  "sql/20260614_02_phase_a_non_map_security_hardening.sql":"25d106dfc18f469948edf705e7997fa961a16cd0",
  "sql/20260624_01_inventory_item_send_rpc.sql":"2f1a5818ff0d5a7d87a239e5b1a8f0302b6ff5e6",
  "sql/20260808_51_player_forge_character_scoped_equipment_projection.sql":"7b84dfca57a5482fbc474db71ea4e00243ff58fb",
  "sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql":"4532ddb8db642d0d0ab14646a3e87c034d4134c6",
  "components/AssignItemButton.js":"dc09dc77c66896ed842d240c584225cde26581db",
  "pages/inventory.js":"02d52821d0f22aa82ad92263c5014712906ee385",
  "pages/town/[id].js":"c66508b798645e189bb900e63bc17b85b8662e10",
  "components/OfferTradeButton.js":"5b689a2f4d65412264afd1af395b0fe93a0f151d",
  "components/TradeRequestsPanel.js":"aa7cd652e0338e38e208d1ab3050c7739c61bb32"
 })){
  assert.equal(blob(p),sha,"Original product, PR source or P16 scratch changed: "+p);
 }
 assert.match(read("components/MerchantPanel.js"),/rpc\("buy_from_merchant"/);
 assert.match(read("components/TradeRequestsPanel.js"),/rpc\("accept_trade"/);
 assert.match(read("sql/20260808_51_player_forge_character_scoped_equipment_projection.sql"),/security definer[\s\S]*?insert into public\.inventory_items\(/i);
 console.log("PASS P18-ORIGINAL-BLOBS: P16 SQL, legacy RLS, June transfer, Forge definer and GM/Town/account/trade originals exact");
});

test("P18 must not retire held original #345 Stage4 four-policy and owner-CHECK security contract",()=>{
 const stage4=read("sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql");
 for(const policy of [
  "inventory_items_insert_owner_or_admin",
  "inventory_items_update_owner_or_admin",
  "inventory_items_delete_owner_or_admin",
  "inventory_items_select_owner_or_admin"
 ])assert.ok(stage4.includes("ALTER POLICY "+policy),"Held #345 Stage4 must preserve "+policy);
 assert.ok(stage4.includes("ALTER TABLE public.inventory_items DROP CONSTRAINT inventory_items_owner_type_chk"));
 assert.match(stage4,/owner_type IS DISTINCT FROM 'character'/);
 assert.ok(stage4.includes("private.can_access_character_v1(owner_id::uuid, 'inventory')"));
 assert.ok(stage4.includes("materialize_player_forge_starting_equipment_v1(uuid)"));
 assert.doesNotMatch(sql,/ALTER POLICY|DROP CONSTRAINT inventory_items_owner_type_chk/);
 console.log("PASS P18-HELD345-INTEROP: original Stage4 INSERT/UPDATE/DELETE/SELECT, two owner CHECKs, creator materializer provenance remain separate integration dependencies, P18 does not supersede");
});

test("P18 PG17-only SQL creates only narrow character INSERT trigger; no global inventory changes or new public minting RPC",()=>{
 assert.match(sql,/current_database\(\)<>'postgres'/);
 assert.match(sql,/server_version_num/);
 assert.match(sql,/p18_guard/);
 assert.match(sql,/c34_b14_p16_guard_direct_inventory_dml/);
 assert.match(sql,/CREATE OR REPLACE FUNCTION private\.c34_b14_p18_guard_character_item_creation_v1\(\)/);
 assert.match(sql,/RETURNS trigger[\s\S]*?SECURITY INVOKER/);
 assert.match(sql,/AND lower\(btrim\(coalesce\(NEW\.owner_type,''\)\)\)='character'/);
 assert.match(sql,/AND current_user IN \('authenticated','anon'\)/);
 assert.match(sql,/NOT coalesce\(public\.c34_b14_p16_is_item_grant_manager_v1\(\),false\)/);
 assert.match(sql,/CREATE TRIGGER c34_b14_p18_guard_direct_character_item_creation/);
 assert.match(sql,/REVOKE ALL ON FUNCTION private\.c34_b14_p18_guard_character_item_creation_v1\(\)/);
 assert.doesNotMatch(sql,/(?:ALTER|CREATE|DROP)\s+POLICY/i);
 assert.doesNotMatch(sql,/\b(?:ALTER|DROP)\s+TABLE\b/i);
 assert.doesNotMatch(sql,/\bGRANT\s+INSERT\b/i);
 assert.doesNotMatch(sql,/REVOKE\s+INSERT\b/i);
 assert.doesNotMatch(sql,/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\./i);
 assert.doesNotMatch(sql,/owner_type\s*=\s*'player'[\s\S]*?RAISE EXCEPTION/);
 console.log("PASS P18-SOURCE-GUARD: local-only invoker trigger, no blanket INSERT revoke, no new public SECURITY DEFINER mint, no source rewrite");
});

test("P18 signed original RED precedes separately verified guarded GREEN and P16 restores after P18 cleanup",()=>{
 const p17=read("scripts/integration/c34/run_t46_p3_p4b_c2b14_p17_character_owner_spoof_red_signed.mjs");
 assert.match(p17,/PASS P17-CHARACTER-INSERT-SPOOF-RED/);
 for(const marker of [
  "PASS P18-GUARD-LOCAL","PASS P18-CHARACTER-MINT-DENY",
  "PASS P18-TRUSTED-FORGE-SEAM","PASS P18-ACCOUNT-TOWN-EQUIP-GM",
  "PASS P18-INDEPENDENT","PASS P18-RESTORE","PASS P18-SIGNED DISPOSABLE"
 ])assert.ok(signed.includes(marker),"Signed accepted behavior not asserted: "+marker);
 assert.match(parent,/await runC34B14P17CharacterOwnerSpoofRedSigned\(\{sql,q,roles\}\)/);
 assert.match(parent,/await runC34B14P18CharacterInsertGuardSigned\(\{env,sql,q,lit,roles,forgeSource,hired\}\)/);
 assert.ok(parent.indexOf("PASS P16-PRESERVE-DML") <
  parent.indexOf("await runC34B14P17CharacterOwnerSpoofRedSigned("));
 assert.ok(parent.indexOf("await runC34B14P17CharacterOwnerSpoofRedSigned(") <
  parent.indexOf("PASS P16-NEW-INTENTS"));
 assert.ok(parent.indexOf("PASS P16-INDEPENDENT") <
  parent.indexOf("await runC34B14P18CharacterInsertGuardSigned("));
 assert.ok(parent.indexOf("await runC34B14P18CharacterInsertGuardSigned(") <
  parent.indexOf("DROP TRIGGER IF EXISTS c34_b14_p16_guard_direct_inventory_dml"));
 assert.match(signed,/P18_CHARACTER_INSERT_DISPOSABLE_PG17_ONLY/);
 assert.match(signed,/DROP TRIGGER IF EXISTS c34_b14_p18_guard_direct_character_item_creation/);
 assert.match(signed,/DELETE FROM public\.inventory_items WHERE id=/);
 assert.match(signed,/DELETE FROM public\.characters WHERE id=/);
 assert.match(signed,/originalSigs/);
 console.log("PASS P18-SIGNED-SOURCE: genuine JWT user-vs-manager deny, original P16+P17 order, own in-fixture restoration and local opt-in");
});

test("P18 explicit release HOLD and independent original source writers preserved",()=>{
 const rootWorkflow=read(".github/workflows/validate-c34-joint-local-auth.yml");
 const buyerWorkflow=read(".github/workflows/validate-c34-t46-p3-p4b-c2b-guarded-buy.yml");
 for(const [name,w] of [["full source-original",rootWorkflow],["guarded buyer",buyerWorkflow]]){
  assert.match(w,/C34_P16_SIGNED_CONFIRM: P16_NO_BYPASS_DISPOSABLE_PG17_ONLY/,name);
  assert.match(w,/C34_P18_SIGNED_CONFIRM: P18_CHARACTER_INSERT_DISPOSABLE_PG17_ONLY/,name);
 }
 assert.match(signed,/real signed|genuine independently signed|genuine local signed/i);
 assert.match(signed,/Town|craft/);
 assert.match(signed,/merchant|trade/i);
 assert.match(read("docs/research/C34_B14_P17_INVENTORY_WRITERS_AND_CHARACTER_INSERT_SPOOF_2026-11-22.md"),/22\/34/);
 console.log("PASS P18-RELEASE-HOLD: original features and two independent signed workflows retain clear local-only guards");
});
