#!/usr/bin/env node
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
const read=x=>fs.readFileSync(path.join(process.cwd(),x),"utf8");
const fixture=read("scripts/integration/c34/t38_p2_original_conversion_source_pg17.sql");
const signed=read("scripts/integration/c34/test_t38_p2_original_conversion_signed_pg17.mjs");
const original=read("pages/npcs.js");
const blob=x=>createHash("sha1").update("blob "+Buffer.byteLength(x)+"\0").update(x).digest("hex");
test("T38 original full NPC Manager is byte-identical and preserves KindPicker path",()=>{
 assert.equal(blob(original),"7fc00b9b3ace6233d1648a3d017f8a05e072d722");
 assert.match(original,/canConvertKind = !!isAdmin \|\| !!charPerm\?\.can_convert/);
 assert.match(original,/supabase\.rpc\("set_character_kind"/);
 assert.match(original,/storefront_enabled: target === "merchant"/);
});
test("T38 exact hosted source functions are local-only and fingerprinted",()=>{
 for(const token of ["T38_P2_DISPOSABLE_LOCAL_CONFIRMED","current_database()<>'postgres'",
  "server_version_num","04588d4b433b13c92e612039a7c7e56e",
  "1a6ab5aa4bc58eceace51ad3803ed961","private.can_access_character_v1",
  "GRANT UPDATE (kind,storefront_enabled)","delete from public.character_stock",
  "caller_role = 'player'"])assert.ok(fixture.includes(token),token);
 assert.doesNotMatch(fixture,/DROP TABLE|TRUNCATE|DROP POLICY/i);
});
test("T38 signed baseline retains original RED and lower-role control markers",()=>{
 for(const id of ["UNKNOWN-ROLE-RED","ALIAS-RED","NOOP-STOCK-RED",
  "EDITOR-DIRECT-RED","DENIAL-CONTROL","SAME-JWT-REVOCATION"]){
  assert.ok(signed.includes(id),"Lost T38 original RED/control case "+id);
 }
 assert.ok(signed.includes("DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY"));
 assert.ok(signed.includes("ORIGINAL_CONVERSION_DISPOSABLE_RED_ONLY"));
 assert.doesNotMatch(signed,/supabase\.co|service_role/i);
});
