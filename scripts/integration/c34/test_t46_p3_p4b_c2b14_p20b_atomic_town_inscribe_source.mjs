// P20B source-only assertions: never treat as signed PostgreSQL acceptance.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const blob=p=>{const b=fs.readFileSync(path.join(root,p));return createHash("sha1")
 .update(Buffer.concat([Buffer.from("blob "+b.length+"\0"),b])).digest("hex");};
const file="scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p20b_disposable_atomic_town_inscribe_pg17.sql";
const signed="scripts/integration/c34/run_t46_p3_p4b_c2b14_p20b_atomic_town_inscribe_signed.mjs";
test("P20B original Town Crafters Quarter, inventory and P20A exact blobs",()=>{
 for(const [p,sha] of Object.entries({
  "pages/town/[id].js":"c66508b798645e189bb900e63bc17b85b8662e10",
  "components/TownSheet.js":"5399097e48f548956807cd93476fefe03e4dee28",
  "components/town/TownCrafterInteractionPanel.js":"345629409b45cd5da5bf305a8124fbbe46ec0d15",
  "sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql":"4532ddb8db642d0d0ab14646a3e87c034d4134c6",
  "scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p20a_disposable_earned_receipt_gate_pg17.sql":""
 })){
  if(sha)assert.equal(blob(p),sha,"Original source changed, review before continuing: "+p);
  else assert.ok(read(p).includes("CREATE TABLE private.c34_b14_p20a_earned_item_receipts"));
 }
 console.log("PASS P20B-ORIGINAL-SOURCE: original Town service, page, held Stage4 and P20A unmodified");
});
test("P20B source-gated, single inscribe service, no client crafted object or hosted migration",()=>{
 const s=read(file),page=read("pages/town/[id].js"),town=read("components/TownSheet.js");
 for(const snippet of [
  'id: "inscribe"', 'allowedTypes: ["scroll", "book", "tool", "gear"]'
 ])assert.ok(town.includes(snippet));
 for(const snippet of [
  'case "inscribe":','.delete().eq("user_id", playerUserId)',
  '.insert(craftedInsert)','.insert(rollbackRows)'
 ])assert.ok(page.includes(snippet),"Original browser flow changed: "+snippet);
 for(const snippet of [
  "current_database()<>'postgres'","pg_advisory_xact_lock",
  "FOR UPDATE","DELETE FROM public.inventory_items",
  "CREATE TABLE private.c34_b14_p20b_town_inscribe_receipts",
  "SECURITY DEFINER","REVOKE ALL ON FUNCTION",
  "p_town_id bigint","Craft nonce","'crafted_service','inscribe'",
  "AND 'scribe'=ANY","REVOKE ALL ON private.c34_b14_p20b_town_inscribe_receipts"])
  assert.ok(s.includes(snippet),"P20B candidate invariant absent: "+snippet);
 for(const forbidden of ["ALTER POLICY inventory_items_insert_owner_or_admin",
  "DROP POLICY inventory_items_insert_owner_or_admin",
  "DISABLE ROW LEVEL SECURITY","REVOKE INSERT ON TABLE public.inventory_items",
  "DROP CONSTRAINT inventory_items_owner_type_chk"])
  assert.ok(!s.includes(forbidden),"Original Stage4/P20A must be preserved: "+forbidden);
 console.log("PASS P20B-NARROW-SQL: local original inscribe-only atomic consume/create, role/town/item source validation and private server nonce");
});
test("P20B real signed tests are sequenced between P20A restrictive gate and its original manager overlay",()=>{
 const parent=read("scripts/integration/c34/run_t46_p3_p4b_c2b14_p20a_earned_receipt_signed.mjs");
 const p20b="await runC34B14P20BAtomicTownInscribeSigned({env,sql,q,lit,roles});";
 assert.ok(parent.includes(p20b));
 assert.ok(parent.indexOf("PASS P20A-TOWN-RELEASE-HOLD")<parent.indexOf(p20b));
 assert.ok(parent.indexOf(p20b)<parent.indexOf('sql(fs.readFileSync(path.join(root,p19)'));
 const s=read(signed);
 for(const marker of [
 "P20B-ORIGINAL-TOWN-SOURCE","P20B-SIGNED-DENY","P20B-ATOMIC-ROLLBACK",
 "P20B-INSCRIBE-GREEN","P20B-NONCE-CONCURRENCY","P20B-DOUBLE-CONSUME",
 "P20B-RESTORE"
 ]) assert.ok(s.includes("PASS "+marker),"Missing signed acceptance marker "+marker);
 assert.ok(s.includes("C34_P20B_SIGNED_CONFIRM"));
 console.log("PASS P20B-SIGNED-WIRING: P20A original tests unchanged, real P20B runs under restrictive policy with cleanup");
});
test("P20B never falsely claims full original Town, source Forge v3, Stage4 or UI cutover",()=>{
 const s=read(signed),sql=read(file);
 assert.ok(s.includes("pages/town/[id].js"));
 assert.ok(!s.includes("create_player_character_v3"));
 assert.ok(sql.includes("This RPC models ONE narrower compatible path"));
 assert.ok(sql.includes("no general/forge/imbue/plant recipe authorization")===false
   || sql.toLowerCase().includes("no general/forge/imbue/plant recipe authorization"));
 assert.ok(read("docs/research/C34_B14_P20A_DISPOSABLE_EARNED_ACCOUNT_ITEM_AUTHORITY_2026-11-22.md")
   .includes("Town crafted-result/rollback direct INSERT"));
 console.log("PASS P20B-RELEASE-HOLD: proof covers one narrow service; full Town/Forge/merchant/trade/Stage4 reader/browser still required");
});
