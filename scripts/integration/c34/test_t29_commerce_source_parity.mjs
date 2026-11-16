#!/usr/bin/env node
// T29 exact-live-function-source integrity: no PostgreSQL or hosted access.
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const snap=JSON.parse(read("scripts/integration/c34/t29_hosted_original_commerce_procs.json"));
const sql=read("scripts/integration/c34/t29_disposable_commerce_role_gate_pg17.sql");
const originals={
 wallet_get:"0df12d179f1c68a4dd8ddeaf3fca4fd0",
 wallet_set:"e8f2751e4d2807d36136935fda109dcf",
 stock_merchant_item:"228c511610fed16047a83ae061cd7790",
 reroll_merchant_inventory_v2:"f5fef581df07fcb8c8aa2e009259736e"
};
const guards={
 wallet_get:["if target <> caller and caller_role = 'player' then",
  "if target <> caller and not private.current_user_can_manage_commerce_v1() then"],
 wallet_set:["if caller_role = 'player' then",
  "if not private.current_user_can_manage_commerce_v1() then"],
 stock_merchant_item:["if coalesce(v_role, 'player') = 'player' then",
  "if not private.current_user_can_manage_commerce_v1() then"],
 reroll_merchant_inventory_v2:[
  "IF NOT coalesce(v_is_admin,false) THEN RAISE EXCEPTION 'Only admins can reroll merchant stock'; END IF;",
  "IF v_uid IS NOT NULL AND NOT private.current_user_can_manage_commerce_v1() THEN RAISE EXCEPTION 'Commerce manager required to reroll merchant stock' USING ERRCODE='42501'; END IF;"
 ]
};
test("T29-S01 source-original hosted definition hashes unchanged",()=>{
 assert.deepEqual(Object.keys(snap.functions).sort(),Object.keys(originals).sort());
 for(const [name,md5] of Object.entries(originals)){
  const original=snap.functions[name];
  assert.equal(original.md5,md5,name);
  assert.equal(crypto.createHash("md5").update(original.definition,"utf8").digest("hex"),md5,name);
  assert.ok(original.definition.startsWith("CREATE OR REPLACE FUNCTION public."+name+"("),name);
 }
});
test("T29-S02 four precise auth-only differences, original reroll and wallet bodies kept intact",()=>{
 for(const name of Object.keys(originals)){
  const [before,after]=guards[name];
  const source=snap.functions[name].definition;
  assert.equal(source.split(before).length-1,1,name);
  const patched=source.replace(before,after);
  assert.equal(sql.split(patched+";\n").length-1,1,name+" source body diverged");
 }
});
test("T29-S02b reduced original Forge item catalog receives only missing scratch reroll columns",()=>{
 const originalForge=read("scripts/fixtures/forge_materializer_local_auth_extension_pg17.sql");
 assert.match(originalForge,/CREATE TABLE public\.items_catalog/);
 assert.doesNotMatch(originalForge,/CREATE TABLE public\.items_catalog\s*\([\s\S]{0,240}price_gp/);
 assert.match(sql,/ALTER TABLE public\.items_catalog\s+ADD COLUMN IF NOT EXISTS price_gp numeric,/);
 assert.match(sql,/ADD COLUMN IF NOT EXISTS merchant_tags text\[\]/);
});
test("T29-S03 row policy, helper, EXECUTE grants and local-only safety boundary",()=>{
 for(const word of [
  "T29_DISPOSABLE_LOCAL_CONFIRMED","to_regclass('private.t28_wallet_probe')",
  "1dbe8c24c4c718396d7256f6f7465354","CREATE POLICY character_stock_admin_write",
  "USING (private.current_user_can_manage_commerce_v1())",
  "WITH CHECK (private.current_user_can_manage_commerce_v1())",
  "p.role IN ('admin','gm','dm')","GRANT EXECUTE ON FUNCTION public.wallet_get(uuid)",
  "REVOKE ALL ON FUNCTION public.wallet_get(uuid)"])
  assert.ok(sql.includes(word),"Missing role/source guard: "+word);
 assert.doesNotMatch(sql,/CREATE OR REPLACE FUNCTION private\.current_user_is_admin|ALTER POLICY .*map_|ALTER TABLE .*map_/);
 assert.doesNotMatch(sql,/CREATE OR REPLACE FUNCTION public\.buy_from_merchant/);
 assert.match(sql,/IF v_uid IS NOT NULL AND NOT private\.current_user_can_manage_commerce_v1\(\)/,
  "Preserve original reroll trusted internal/null actor path");
 const roleModel=read("utils/c34/commerceRolePolicyCandidate.mjs");
 assert.match(roleModel,/COMMERCE_MANAGER_ROLES = Object\.freeze\(\["admin", "gm", "dm"\]\)/);
});
test("T29-S04 original shared runtime and source purchase method still isolated",()=>{
 const town=read("pages/town/[id].js");
 assert.match(town,/NEXT_PUBLIC_C34_T28_P2_TOWN_SHOP === "1"/);
 for(const p of ["components/MerchantPanel.js","utils/useWallet.js","components/MapPageClient.js"]){
  assert.doesNotMatch(read(p),/t29_disposable_commerce|current_user_can_manage_commerce_v1/,
   "Protected app/map source cannot import T29 SQL");
 }
});
console.log("PASS T29-SOURCE: exact hosted function byte snapshots, four authorization guards, local-only source policy; NO hosted SQL executed");
