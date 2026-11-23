// P20C-P1 original-source recovery and release-blocker gate.
// Source-only tests. No authenticated transaction, production SQL, client mount,
// patch to the original server function, cost rule, or GM bypass is claimed.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const blob=file=>{
 const bytes=fs.readFileSync(path.join(root,file));
 return createHash("sha1").update(Buffer.concat([
  Buffer.from("blob "+bytes.length+"\0"),bytes
 ])).digest("hex");
};
const origins={
 "sql/20260612_90_patch0_crafting_authorization_hardening.sql":"d60b0ded3f94cd9f7db9aa687e72ee0fc589c416",
 "sql/20260613_99_crafting_workflow_v6.sql":"570b2733d3aad5ed02bbe12d288ea52a7e6e352e",
 "sql/20260614_100_player_inventory_owner_alignment.sql":"bed3061042504eed8fdfb876b5f2898b864ba6e4",
 "sql/20260617_01_enchanting_completion_v1.sql":"80b8d3f9ecb5340aa0cac644d2243db4b7e40e02",
 "sql/20260724_01_security_hardening_roadmap.sql":"d7dc873a141f25745aeb9ce29023da1f176b396d",
 "sql/20260724_02_database_drift_followup.sql":"4307ed28460c668dbbe3e09b3a34a30472be0728",
 "sql/20260801_01_crafting_completion_normalization.sql":"42889d9e64186bd0fec99f952956a24c4c0392c8",
 "sql/20260618_03_recipe_catalog_items.sql":"06fee389dbc9ade1898d8b577ac628ccbccccccc",
 "sql/20260630_02_npc_known_recipe_keys.sql":"69317a4195fbe50abb989442febf4f132fc0c84b",
 "pages/town/[id].js":"c66508b798645e189bb900e63bc17b85b8662e10",
 "components/CraftingWorkspace.js":"e584b7eb1a394e9d9f6525cbeb3e8e1a477f34ba"
};

test("P20C-P1 preserve original source identities before interpreting authority",()=>{
 for(const [file,expected] of Object.entries(origins))
  assert.equal(blob(file),expected,"Source drift: "+file);
 console.log("PASS P20C-P1-ORIGINAL-BLOBS: 11 original SQL/client authorities still pinned");
});

test("P20C-P1 original general private completion body is NOT recoverable from checked-in migrations",()=>{
 const wrapper=read("sql/20260612_90_patch0_crafting_authorization_hardening.sql");
 assert.match(wrapper,/ALTER FUNCTION public\.complete_craft_plan_v1\(uuid,uuid\) SET SCHEMA private/i);
 assert.match(wrapper,/RENAME TO complete_craft_plan_v1_impl/i);
 const dynamic=[
  "sql/20260613_99_crafting_workflow_v6.sql",
  "sql/20260614_100_player_inventory_owner_alignment.sql",
  "sql/20260801_01_crafting_completion_normalization.sql"
 ];
 for(const file of dynamic){
  const s=read(file);
  assert.match(s,/pg_get_functiondef\('private\.complete_craft_plan_v1_impl\(uuid,uuid\)'::regprocedure\)/i,file);
  assert.doesNotMatch(s,/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+private\.complete_craft_plan_v1_impl\s*\(/i,file);
 }
 const enchanting=read("sql/20260617_01_enchanting_completion_v1.sql");
 assert.match(enchanting,/CREATE OR REPLACE FUNCTION private\.complete_enchanting_craft_plan_v1_impl/i);
 assert.match(enchanting,/RETURN private\.complete_craft_plan_v1_impl\(p_plan_id, p_attempt_id\)/i);
 console.log("PASS P20C-P1-MISSING-PRIVATE-SOURCE: non-Enchanting implementation must be recovered from authorized original backup; cannot invent a general replacement");
});

test("P20C-P1 original Enchanting material IDs are locked without a source-owner predicate",()=>{
 const sql=read("sql/20260617_01_enchanting_completion_v1.sql");
 const start=sql.indexOf("for v_material in");
 const end=sql.indexOf("if v_base.quantity = 1 then",start);
 assert.ok(start>0&&end>start,"Enchanting catalyst segment not found");
 const segment=sql.slice(start,end);
 assert.match(segment,/v_material_id\s*:=\s*\(v_material->>'inventory_item_id'\)::uuid/i);
 assert.match(segment,/from public\.inventory_items\s+where id = v_material_id\s+for update/i);
 assert.match(segment,/delete from public\.inventory_items where id = v_material_id/i);
 assert.match(segment,/where id = v_material_id;/i);
 assert.doesNotMatch(segment,/\b(owner_type|owner_id|user_id|v_target_user_id)\b/i);
 console.log("PASS P20C-P1-CATALYST-OWNER-RED: source-id-only catalyst consumption; signed foreign-owner and role negatives required before any broadened completion permission");
});

test("P20C-P1 plant ownership derives from players.id, not arbitrary client user_id",()=>{
 const sql=read("sql/20260724_02_database_drift_followup.sql");
 for(const table of ["public.player_plants","public.player_recipes"]){
  const start=sql.indexOf("ON "+table);
  assert.ok(start>0,"Missing source ownership policy "+table);
  const piece=sql.slice(start,start+340);
  assert.match(piece,/player_id\s*=\s*\(\s*SELECT p\.id\s+FROM public\.players p/i);
  assert.match(piece,/p\.user_id = \(SELECT auth\.uid\(\)\)/i);
 }
 const town=read("pages/town/[id].js");
 const begin=town.indexOf("async function handleCraftWorkshop(");
 const end=town.indexOf("function townCrafterDisciplineFor(",begin);
 assert.ok(begin>0&&end>begin);
 const body=town.slice(begin,end);
 assert.match(body,/plantMaterialInputs = \[\]/);
 assert.match(body,/const plantById = new Map/);
 assert.doesNotMatch(body,/\.from\(["']player_plants["']\)/);
 assert.doesNotMatch(body,/\b(update|delete)\s*\(\s*.*player_plants/i);
 console.log("PASS P20C-P1-PLANT-RED: UI plant selection is not trusted consumption; lock actual owned stack and decrement quantity atomically");
});

test("P20C-P1 recipe purchase price is NOT authenticated crafting GP cost",()=>{
 const catalog=read("sql/20260618_03_recipe_catalog_items.sql");
 const hub=read("components/CraftingWorkspace.js");
 assert.match(catalog,/'recipe:' \|\| r\.id::text as item_key/);
 assert.match(catalog,/'Recipe: ' \|\| r\.name as item_name/);
 assert.match(catalog,/end::numeric as price_gp/i);
 assert.match(catalog,/recipe_unlock/);
 assert.match(hub,/Material cost determined by the DM/);
 assert.match(read("sql/20260630_02_npc_known_recipe_keys.sql"),/recipe_key text/);
 console.log("PASS P20C-P1-COST-UNKNOWN: recipe-item merchant purchase price and client cost note cannot authorize a crafting GP debit or zero-fee grant");
});

test("P20C-P1 direct wallet mutation is revoked and wallet_add is Admin-only",()=>{
 const sql=read("sql/20260724_01_security_hardening_roadmap.sql");
 assert.match(sql,/REVOKE ALL ON TABLE public\.player_wallets FROM PUBLIC, anon, authenticated/i);
 assert.match(sql,/GRANT SELECT ON TABLE public\.player_wallets TO authenticated/i);
 const start=sql.indexOf("CREATE OR REPLACE FUNCTION public.wallet_add(");
 const end=sql.indexOf("REVOKE EXECUTE ON FUNCTION public.wallet_add(",start);
 assert.ok(start>0&&end>start);
 const body=sql.slice(start,end);
 assert.match(body,/IF NOT private\.current_user_is_admin\(\) THEN/);
 assert.match(body,/FOR UPDATE/);
 assert.match(sql,/REVOKE EXECUTE ON FUNCTION public\.wallet_add\(uuid, numeric\) FROM PUBLIC, anon, authenticated/i);
 console.log("PASS P20C-P1-WALLET-HOLD: ordinary crafting must not use client wallet write or Admin-only generic wallet_add as unverified payment authority");
});

test("P20C-P1 GM issuance and completion must retain separate current-role reason/receipt gates",()=>{
 const decision=read("docs/research/C34_OWNER_ROLE_UNIFICATION_ALL_APP_PERMISSIONS_2026-11-16.md");
 assert.match(decision,/exact role strings.*admin.*gm.*dm/i);
 assert.match(decision,/never untrusted client hints/i);
 const wrapper=read("sql/20260612_90_patch0_crafting_authorization_hardening.sql");
 assert.match(wrapper,/Only an administrator can complete a craft plan/);
 assert.doesNotMatch(wrapper,/gm_override_reason|gm_override_actor|manager_override_receipt/i);
 const proto=read("scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p20c_town_craft_intent_research.mjs");
 assert.match(proto,/const REQUEST_KEYS=new Set/);
 for(const k of ["gm_override","price_gp","role","result_item_payload"]){
  assert.ok(!proto.match(new RegExp('REQUEST_KEYS=new Set\\([^\\n]*"'+k+'"')),"Untrusted browser key accepted: "+k);
 }
 console.log("PASS P20C-P1-GM-SEPARATE-HOLD: no source-owned reason-audited override RPC exists; do not widen completion by browser flags or Admin helper substitution");
});
