// C34 B14-P19 source-locked original AssignItemButton/Stage4/Forge lineage
// with original signed GM/DM/Admin and player-account mint RED in P18 fixture.
// STATIC evidence alone is not a v3/Stage4 co-residence or hosted permission proof.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const blob=p=>{
 const x=fs.readFileSync(path.join(root,p));
 return createHash("sha1").update(Buffer.concat([Buffer.from("blob "+x.length+"\0"),x])).digest("hex");
};
const signed="scripts/integration/c34/run_t46_p3_p4b_c2b14_p19_original_assign_item_source_red_signed.mjs";
const p18="scripts/integration/c34/run_t46_p3_p4b_c2b14_p18_character_insert_guard_signed.mjs";
const writer="components/AssignItemButton.js";
const stage4="sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql";
const originalPins={
 [writer]:"dc09dc77c66896ed842d240c584225cde26581db",
 [stage4]:"4532ddb8db642d0d0ab14646a3e87c034d4134c6",
 "sql/20261011_02_player_forge_homebrew_starting_budget.sql":"6f4471c787e68971e33f0b047816dd0808056e2a",
 "sql/20261010_01_player_forge_starting_market.sql":"f77f996e88e8b3f8f01f10f77da205af2a24f11d",
 "sql/20260808_51_player_forge_character_scoped_equipment_projection.sql":"7b84dfca57a5482fbc474db71ea4e00243ff58fb",
 "scripts/fixtures/forge_inventory_policy_source_local_auth_pg17.sql":"e077a2b103fbbf1c1e5b5e437c8e877e6f619990",
 "scripts/fixtures/forge_owner_constraint_deferred_creation_local_auth_pg17.sql":"faa20bc3052b4529c00eb81deb2b7ef3d0f5d128",
 "scripts/integration/c34/fixtures/original_i1c_forge_private_story_nonce_local_auth.mjs":"90fb3058bc1c93ef72a331bad0747920c3c1202e",
 "scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p18_disposable_character_item_creation_gate_pg17.sql":"55b2efbf51da14ee3cb39eec03aee498b0e93386"
};
test("P19 immutable original browser, preflighted Stage4, current Forge materializer and legacy signed fixture blobs",()=>{
 for(const [file,sha] of Object.entries(originalPins))
  assert.equal(blob(file),sha,"Never rewrite original P19 source "+file);
 console.log("PASS P19-SOURCE-ORIGINALS: exact original AssignItemButton, held Stage4, chronological Forge v3 materializers and local signed fixtures unchanged");
});

test("P19 original AssignItemButton owner shapes are NOT equivalent to P18 synthetic GM item grants",()=>{
 const src=read(writer);
 const s=read(signed);
 assert.ok(src.includes('if (finalType === "player") insertData.user_id = finalId;'));
 assert.ok(src.includes('await supabase.from("inventory_items").insert(insertData)'));
 for(const name of ["owner_type: finalType","owner_id: String(finalId)","item_id: itemId","item_name: itemName",
  "item_type: itemType","item_rarity: itemRarity","card_payload: cardPayload","is_equipped: false"])
  assert.ok(src.includes(name),"Original insert field missing: "+name);
 assert.ok(s.includes('...(targetType==="player"?{user_id:targetId}:{})'));
 assert.ok(s.includes('who.who.from("inventory_items").insert(payload(type,target,label))'));
 assert.ok(!src.includes("c34_b14_p18_guard_character_item_creation_v1"));
 assert.ok(!src.includes("c34_b14_p19"));
 console.log("PASS P19-ASSIGN-SOURCE: true browser NPC/merchant payload omits user_id, unlike earlier synthetic successful GM insert");
});

test("P19 signed untouched writer proves expected RED by real game-manager role with restored P18",()=>{
 const s=read(signed),parent=read(p18);
 for(const name of ["ADMIN","GM","DM","OWNER","OUTSIDER"])
  assert.ok(s.includes("roles."+name),"Missing independently signed actor "+name);
 for(const label of [
  "PASS P19-ASSIGN-ORIGINAL-RED",
  "PASS P19-ASSIGN-ADMIN-PRESERVE",
  "PASS P19-ASSIGN-CAUSE",
  "PASS P19-ACCOUNT-MINT-RED",
  "PASS P19-ASSIGN-RESTORE"
 ])assert.ok(s.includes(label),"Expected signed evidence missing: "+label);
 assert.ok(parent.includes("await runC34B14P19OriginalAssignItemSourceRedSigned({sql,q,lit,roles,hired})"));
 assert.ok(parent.indexOf("PASS P18-INDEPENDENT") <
  parent.indexOf("await runC34B14P19OriginalAssignItemSourceRedSigned("));
 assert.ok(parent.indexOf("await runC34B14P19OriginalAssignItemSourceRedSigned(") <
  parent.indexOf("DROP TRIGGER IF EXISTS c34_b14_p18_guard_direct_character_item_creation"));
 assert.ok(s.includes("tgname IN ('c34_b14_p16_guard_direct_inventory_dml'"));
 assert.ok(s.includes("'c34_b14_p18_guard_direct_character_item_creation')"));
 console.log("PASS P19-SIGNED-SOURCE: original GM/DM/ADMIN same-JWT RED/positive and independent account mint RED sequenced inside P18 scratch and cleanup");
});

test("P19 original #345 Stage4 is NOT installed by P18/P19; full v3 and role/constraint tests remain independent",()=>{
 const rls=read(stage4),forge=read("sql/20261011_02_player_forge_homebrew_starting_budget.sql");
 const i1c=read("scripts/integration/c34/fixtures/original_i1c_forge_private_story_nonce_local_auth.mjs");
 const owner=read("scripts/fixtures/forge_owner_constraint_deferred_creation_local_auth_pg17.sql");
 const p18Sql=read("scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p18_disposable_character_item_creation_gate_pg17.sql");
 for(const policy of ["insert","update","delete","select"])
  assert.ok(rls.includes("ALTER POLICY inventory_items_"+policy+"_owner_or_admin"));
 assert.ok(rls.includes("DROP CONSTRAINT inventory_items_owner_type_chk"));
 assert.ok(rls.includes("private.can_access_character_v1(owner_id::uuid, 'inventory')"));
 assert.ok(forge.includes("create or replace function private.materialize_player_forge_starting_equipment_v1(p_character_id uuid)"));
 assert.ok(forge.includes("security definer"));
 assert.ok(i1c.includes("We do not run Stage4/inventory"));
 assert.ok(owner.includes("ADD CONSTRAINT inventory_items_owner_type_chk"));
 assert.ok(!p18Sql.includes("ALTER POLICY"));
 assert.ok(!p18Sql.includes("DROP CONSTRAINT inventory_items_owner_type_chk"));
 assert.ok(!read(signed).includes("create_player_character_v3"));
 console.log("PASS P19-FORGE-STAGE4-HOLD: original Oct materializer and full v3/Stage4 are source-pinned but NOT jointly executed under P18; no false production authority");
});

test("P19 original role-equivalence decision cannot be faked by frontend only",()=>{
 const roles=read("scripts/integration/c34/run_t46_p3_p4b_c2b14_inventory_roles_signed.mjs");
 assert.ok(roles.includes('["ADMIN","admin"],["GM","gm"],["DM","dm"]'));
 assert.ok(roles.includes("const strict={ADMIN:true,GM:false,DM:false"));
 assert.ok(roles.includes("const byRole={ADMIN:true,GM:true,DM:true"));
 const s=read(signed);
 assert.ok(s.includes('deny(gmNpc,"Unchanged original NPC AssignItemButton GM under strict-admin policy","42501")'));
 assert.ok(s.includes('deny(dmMerchant,"Unchanged original merchant AssignItemButton DM under strict-admin policy","42501")'));
 assert.ok(s.includes("This does not"));
 console.log("PASS P19-ROLE-RED: original strict-admin RLS differs from owner-approved admin/gm/dm gameplay parity; no legacy helper rewritten");
});
