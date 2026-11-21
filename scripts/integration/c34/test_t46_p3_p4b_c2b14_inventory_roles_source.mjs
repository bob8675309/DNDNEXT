// C34 T46-P3-P4B-C2-B14-P0: original-role + transfer source-drift crosswalk.
// READ-ONLY. Exact-blob original RED evidence; NOT a signed RLS acceptance.
// Assumes checked-out branch source; no APIs, SQL execution or test credentials.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const blob=bytes=>createHash("sha1").update(
 Buffer.concat([Buffer.from("blob "+bytes.length+"\0"),bytes])
).digest("hex");
const pins={
 "pages/inventory.js":"02d52821d0f22aa82ad92263c5014712906ee385",
 "components/AssignItemButton.js":"dc09dc77c66896ed842d240c584225cde26581db",
 "sql/20260612_90_patch0_crafting_authorization_hardening.sql":"d60b0ded3f94cd9f7db9aa687e72ee0fc589c416",
 "sql/20260614_02_phase_a_non_map_security_hardening.sql":"25d106dfc18f469948edf705e7997fa961a16cd0",
 "sql/20260624_01_inventory_item_send_rpc.sql":"2f1a5818ff0d5a7d87a239e5b1a8f0302b6ff5e6",
 "scripts/fixtures/p1_3_equipment_mutation_live_pg17.sql":"e1c0838d5d062d72b49f869e84a31d8735bd17c0",
 "scripts/test_p1_3_permission_controller_rls_local_jwt.mjs":"cbf75063127dc4578a7172c8b10cc7d546bc29ab",
 "sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql":"4532ddb8db642d0d0ab14646a3e87c034d4134c6",
 "components/MapPageClient.js":"61f8738da2ca3d8635b5a413bfdc18c094228a0a"
};
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
for(const [file,expected] of Object.entries(pins))
 assert.equal(blob(fs.readFileSync(path.join(root,file))),expected,
 "C2-B14 original source drift "+file);
const helper=read("sql/20260612_90_patch0_crafting_authorization_hardening.sql");
const policy=read("sql/20260614_02_phase_a_non_map_security_hardening.sql");
const transfer=read("sql/20260624_01_inventory_item_send_rpc.sql");
const inventory=read("pages/inventory.js");
const assign=read("components/AssignItemButton.js");
const fixture=read("scripts/fixtures/p1_3_equipment_mutation_live_pg17.sql");
const signed=read("scripts/test_p1_3_permission_controller_rls_local_jwt.mjs");
const candidate=read("sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql");
const requirePattern=(s,re,label)=>assert.match(s,re,"C2-B14 expected ORIGINAL source "+label+" changed");
requirePattern(helper,/CREATE OR REPLACE FUNCTION private\.current_user_is_admin\(\)/,"admin-only helper");
requirePattern(helper,/up\.role\s*=\s*'admin'/,"exact private admin role");
requirePattern(helper,/CREATE OR REPLACE FUNCTION public\.is_admin\(uid uuid\)/,"UUID-scoped role helper");
requirePattern(helper,/RETURN COALESCE\(target_role,\s*'player'\)\s*<>\s*'player'/,"UUID helper nonplayer convention");
requirePattern(helper,/IF target <> caller AND NOT private\.current_user_is_admin\(\)/,"cross-user lookup stricter than self");
requirePattern(policy,/CREATE POLICY inventory_items_update_owner_or_admin[\s\S]*?WITH CHECK\s*\(\s*user_id\s*=\s*\(SELECT auth\.uid\(\)\)\s*OR\s*\(SELECT private\.current_user_is_admin\(\)\)/,"owner-preserving WITH CHECK");
requirePattern(transfer,/v_admin\s*:=\s*coalesce\(public\.is_admin\(caller\),\s*false\)/i,"transfer admin check via permissive UUID helper");
requirePattern(transfer,/v_source_type\s*=\s*'npc'[\s\S]*?cp\.can_inventory[\s\S]*?cp\.can_edit/i,"NPC original delegated inventory permission");
requirePattern(transfer,/v_target_type\s*=\s*'merchant'\s+AND NOT v_admin/i,"merchant direct-send original restriction");
requirePattern(transfer,/FOR UPDATE/i,"transfer original item-row lock");
requirePattern(inventory,/supabase\.rpc\("is_admin",\s*\{\s*uid:\s*sess\.user\.id\s*\}\)/,"client uses UUID helper");
requirePattern(inventory,/admin\s*=\s*\(prof\?\.role\s*\|\|\s*"player"\)\s*!==\s*"player"/,"client nonplayer fallback");
requirePattern(inventory,/supabase\.rpc\("transfer_inventory_item_v1"/,"server transfer first");
requirePattern(inventory,/if\s*\(error\)\s*\{[\s\S]*?if\s*\(!canTransferOut\)\s*throw error;[\s\S]*?\.from\("inventory_items"\)\.update\(patch\)/,"RPC failure followed by raw DML fallback");
requirePattern(inventory,/\.from\("inventory_items"\)\.update\(patch\)\.in\("id",\s*selectedIds\)/,"raw bulk inventory transfer");
requirePattern(assign,/\.from\("inventory_items"\)\.insert\(insertData\)/,"raw admin assign INSERT");
assert.ok(!/\b(?:isAdmin|canManage|canEdit)\b/.test(
 assign.slice(assign.indexOf("async function handleAssign()"),assign.indexOf("return (",assign.indexOf("async function handleAssign()")))),
 "AssignItemButton original UI added authorization guard, reassess RED");
requirePattern(fixture,/CREATE OR REPLACE FUNCTION public\.transfer_inventory_item_v1\(/i,"reusable original installed-source snapshot fixture");
requirePattern(signed,/PASS 158 \[SOURCE TIMING\]/,"reuse established signed original G/I permission timing");
requirePattern(signed,/PASS 159 \[SOURCE AFTER-COMMIT\]/,"reuse established signed revocation negative");

// All checked-in migration files are an inventory, not proof of applied order,
// installed bodies, grants or later third-party overrides. Report candidates.
function walk(dir){
 if(!fs.existsSync(path.join(root,dir)))return [];
 const out=[];
 for(const x of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){
  const f=dir+"/"+x.name;
  if(x.isDirectory())out.push(...walk(f));
  else if(x.isFile()&&f.endsWith(".sql"))out.push(f);
 }
 return out;
}
const entries=[...walk("sql"),...walk("supabase")].sort();
const overrideRx={
 adminPrivate:/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+private\.current_user_is_admin\s*\(/gi,
 adminUuid:/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.is_admin\s*\(\s*(?:uid|p_uid)\s+uuid/gi,
 adminZero:/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.is_admin\s*\(\s*\)/gi,
 transfer:/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.transfer_inventory_item_v1\s*\(/gi,
 policies:/\b(?:CREATE|ALTER)\s+POLICY\s+inventory_items_(?:insert|select|update|delete)_owner_or_admin/gi
};
const locations={};
for(const [label,re] of Object.entries(overrideRx)){
 locations[label]=[];
 for(const file of entries){
  const text=read(file);
  for(const m of text.matchAll(re)){
   locations[label].push({
    file,line:text.slice(0,m.index).split("\n").length,
    candidate:file.startsWith("sql/candidates/")
   });
  }
 }
}
for(const [label,expected] of Object.entries({
 adminPrivate:"sql/20260612_90_patch0_crafting_authorization_hardening.sql",
 adminUuid:"sql/20260612_90_patch0_crafting_authorization_hardening.sql",
 adminZero:"sql/20260612_90_patch0_crafting_authorization_hardening.sql",
 transfer:"sql/20260624_01_inventory_item_send_rpc.sql",
 policies:"sql/20260614_02_phase_a_non_map_security_hardening.sql"
})){
 assert.ok(locations[label].some(x=>x.file===expected),
  "B14 expected source anchor no longer found "+label);
}
assert.match(candidate,/NOT A MIGRATION/);
assert.match(candidate,/ALTER POLICY inventory_items_update_owner_or_admin/);
const appRoles=["admin","gm","dm","player","observer"];
const sourceRoleMatrix=appRoles.map(role=>({
 role,privateAdmin:role==="admin",uuidSelfAdmin:role!=="player",
 intendedElevated:["admin","gm","dm"].includes(role),
 discrepancy:role!=="player" && role!=="admin"
}));
assert.deepEqual(sourceRoleMatrix.filter(x=>x.discrepancy).map(x=>x.role),
 ["gm","dm","observer"]);
const report={
 auditedSqlSources:entries.length,
 sourceOverrides:locations,
 roleSourceLogicMatrix:sourceRoleMatrix,
 browserRisks:[
 "is_admin(uuid) and fallback role!=player diverge from private admin-only RLS",
 "failed transfer RPC can cause raw owner UPDATE for canTransferOut",
 "bulk transfer uses direct nontransactional owner UPDATE",
 "AssignItemButton raw INSERT defers solely to RLS",
 "latest installed hosted definitions not inspected"
 ],
 reuseExistingSignedSuite:"scripts/test_p1_3_permission_controller_rls_local_jwt.mjs cases 157-159",
 next:"B14 signed local role matrix for original transfer RPC + raw RLS, then versioned fail-closed candidate"
};
console.log("PASS C34-C2B14-P0-ORIGINAL-BLOBS: "+Object.keys(pins).length+" exact Git source blobs pinned");
console.log("PASS C34-C2B14-P0-ROLE-MISMATCH-RED: private admin-only != UUID nonplayer including GM/DM/unknown");
console.log("PASS C34-C2B14-P0-TRANSFER-FALLBACK-RED: original RPC then raw UPDATE on any error, raw bulk mutation and AssignItemButton original INSERT preserved");
console.log("PASS C34-C2B14-P0-REUSED-SIGNED-EVIDENCE: P1.3 original transfer/equip actual JWT G/I timing and post-revocation signed cases 157-159 present");
console.log("C34-C2B14-P0-SOURCE-MANIFEST "+JSON.stringify(report));
console.log("PASS C34-C2B14-P0-STATIC-ONLY: NOT new DB/JWT signed acceptance, NOT hosted installed function/grant/policy proof, no SQL or gameplay changes");
