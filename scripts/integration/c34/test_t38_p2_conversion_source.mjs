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

test("T38-R2 strict research-only candidate requires exact RED before GREEN",()=>{
 const candidate=read("scripts/integration/c34/t38_p2_disposable_conversion_hardening_candidate_pg17.sql");
 const green=read("scripts/integration/c34/test_t38_p2_conversion_hardening_signed_pg17.mjs");
 for(const marker of ["T38_P2_HARDENING_DISPOSABLE_CONFIRMED",
  "04588d4b433b13c92e612039a7c7e56e",
  "1a6ab5aa4bc58eceace51ad3803ed961",
  "97b5e6b059e6467e24c4283fe420c83e",
  "REVOKE UPDATE (kind)", "WHEN 'convert' THEN cp.can_convert",
  "FOR SHARE","FOR UPDATE","IF v_from=v_target THEN RETURN",
  "DELETE FROM public.character_stock","storefront_enabled=true",
  "storefront_enabled=false"])assert.ok(candidate.includes(marker),"Lost candidate rule "+marker);
 assert.doesNotMatch(candidate,/DROP TABLE|TRUNCATE|DROP POLICY/i);
 for(const marker of ["STRICT_CONVERSION_DISPOSABLE_GREEN_ONLY",
  "T38-P2-R2-DIRECT-DML","T38-P2-R2-SAME-KIND",
  "T38-P2-R2-DELEGATE","T38-P2-R2-STOREFRONT-TOGGLE",
  "T38-P2-R2-MANAGER-","T38-P2-R2-INVALID-INPUT",
  "T38-P2-R2-REVOKED"])assert.ok(green.includes(marker),"Lost signed GREEN marker "+marker);
});

test("T38-R3 reuses original KindPicker inside real default-OFF source-derived Next /npcs, no production page patch",()=>{
 const browser=read("scripts/integration/c34/test_t38_p2_kindpicker_signed_browser.mjs");
 const picker=read("components/KindPicker.js");
 const original=read("pages/npcs.js");
 assert.match(original,/nameRight={sheetEditMode \? \(/);
 assert.match(original,/canConvertKind = !!isAdmin \|\| !!charPerm\?\.can_convert/);
 assert.match(picker,/role="menuitem"/);
 for(const marker of ["ORIGINAL_KINDPICKER_DISPOSABLE_ONLY",
  "makeT36Source","reconcileT36Route","T36_LOCAL_ROUTE",
  "T38-P2-R3-REAL-KINDPICKER-TO-MERCHANT",
  "T38-P2-R3-REAL-KINDPICKER-TO-NPC",
  "T38-P2-R3-EDITOR-KIND-HIDDEN",
  "T38-P2-R3-CLEANUP"])assert.ok(browser.includes(marker),"Missing source-original KindPicker acceptance "+marker);
 assert.doesNotMatch(browser,/https:\/\/[^/]*supabase\.co/);
});
