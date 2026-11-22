// P20A source-only compatibility and no-release assertions.
// A static PASS cannot stand in for genuine local JWT or deployed acceptance.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const sha=p=>{const b=fs.readFileSync(path.join(root,p));return createHash("sha1").update(
 Buffer.concat([Buffer.from("blob "+b.length+"\0"),b])).digest("hex");};
const sql="scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p20a_disposable_earned_receipt_gate_pg17.sql";
const runner="scripts/integration/c34/run_t46_p3_p4b_c2b14_p20a_earned_receipt_signed.mjs";
test("P20A old main /admin, Town and approved #345 Stage4 source remain immutable",()=>{
 for(const [p,d] of Object.entries({
  "pages/admin.js":"1ba76a20bfa87934d7e504c056c4770ad1b3a92a",
  "components/AssignItemButton.js":"dc09dc77c66896ed842d240c584225cde26581db",
  "pages/town/[id].js":"c66508b798645e189bb900e63bc17b85b8662e10",
  "sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql":"4532ddb8db642d0d0ab14646a3e87c034d4134c6",
  "sql/20261011_02_player_forge_homebrew_starting_budget.sql":"6f4471c787e68971e33f0b047816dd0808056e2a"
 }))assert.equal(sha(p),d,"Original source drift; P20A must be reviewed against real "+p);
 console.log("PASS P20A-SOURCE-PINS: original /admin, Town, #345 Stage4 and latest October Forge materializer unchanged");
});
test("P20A only local restrictive RLS; no production, role spoof or blanket SQL grant changes",()=>{
 const s=read(sql);
 for(const expected of ["current_database()<>'postgres'",
  "AS RESTRICTIVE FOR INSERT TO authenticated",
  "WITH CHECK (coalesce(public.c34_b14_p16_is_item_grant_manager_v1(),false))",
  "REVOKE ALL ON TABLE private.c34_b14_p20a_earned_item_receipts",
  "SECURITY DEFINER","FOR UPDATE",
  "GRANT EXECUTE ON FUNCTION public.c34_b14_p20a_claim_earned_account_item_v1(uuid)",
  "RETURN v_receipt.inventory_item_id","CREATE TABLE private.c34_b14_p20a_earned_item_receipts"])
  assert.ok(s.includes(expected),"Missing local authority invariant "+expected);
 for(const forbidden of ["ALTER POLICY inventory_items_insert_owner_or_admin",
  "REVOKE INSERT ON TABLE public.inventory_items",
  "DISABLE ROW LEVEL SECURITY","DROP CONSTRAINT inventory_items_owner_type_chk"])
  assert.ok(!s.includes(forbidden),"P20A may not change original policy/constraint/grants: "+forbidden);
 console.log("PASS P20A-SQL-SCOPE: local restrictive gate and server receipt only, no original Stage4 replacement");
});
test("P20A genuine signed tests execute AFTER original P19 and BEFORE P18 restoration",()=>{
 const parent=read("scripts/integration/c34/run_t46_p3_p4b_c2b14_p18_character_insert_guard_signed.mjs");
 const signed=read(runner);
 const p19="await runC34B14P19OriginalAssignItemSourceRedSigned({env,sql,q,lit,roles,hired});";
 const p20="await runC34B14P20AEarnedReceiptSigned({env,sql,q,lit,roles,hired});";
 assert.ok(parent.includes(p19));assert.ok(parent.includes(p20));
 assert.ok(parent.indexOf(p19)<parent.indexOf(p20));
 assert.ok(parent.indexOf(p20)<parent.indexOf("DROP TRIGGER IF EXISTS c34_b14_p18_guard_direct_character_item_creation"));
 for(const marker of ["P20A-ORIGINAL-SIGNED-RED","P20A-RAW-DENY",
  "P20A-RECEIPT-GREEN","P20A-TOWN-RELEASE-HOLD",
  "P20A-MANAGER-PRESERVE-READ-HOLD","P20A-RESTORE"])
  assert.ok(signed.includes("PASS "+marker),"Expected signed boundary omitted "+marker);
 assert.ok(signed.includes("C34_P20A_SIGNED_CONFIRM"));
 assert.ok(!signed.includes("create_player_character_v3"),
  "Separate full original Forge v3 acceptance must not be falsely claimed");
 console.log("PASS P20A-SIGNED-SEQUENCE: original P19 unchanged, P20A local source and fixture restoration follow P18 guard");
});
test("P20A preserves critical unresolved Town raw INSERT and private original reader risks",()=>{
 const town=read("pages/town/[id].js"),stage4=read("sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql");
 assert.ok(town.includes('.insert(craftedInsert)'));
 assert.ok(town.includes('.insert(rollbackRows)'));
 for(const cmd of ["insert","select","update","delete"])
  assert.ok(stage4.includes("ALTER POLICY inventory_items_"+cmd+"_owner_or_admin"));
 const signed=read(runner);
 assert.ok(signed.includes("town-raw-rollback"));
 assert.ok(signed.includes("GM SELECT still hidden"));
 console.log("PASS P20A-RELEASE-HOLD-SOURCE: Town rollback/raw crafted INSERT and #345 original Stage4 four-policy merger still require source-authentic compatible replacement");
});
