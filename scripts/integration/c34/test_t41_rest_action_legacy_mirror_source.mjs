#!/usr/bin/env node
// T41 source custody only. Behavioral proof requires real local PG17/GoTrue run.
import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const blob=p=>{
 const buffer=fs.readFileSync(path.join(root,p));
 return crypto.createHash("sha1").update(Buffer.concat([
  Buffer.from("blob "+buffer.length+"\0"),buffer
 ])).digest("hex");
};
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const restFile="sql/20260810_90_rest_class_feature_restoration.sql";
const resourceFile="sql/20260802_03_character_sheet_spell_resources.sql";
const guardFile="sql/20260802_06_character_resource_active_encounter_lock.sql";
const mirror=[
 "  update public.players p",
 "  set sheet=v_sheet,updated_at=now()",
 "  where p.user_id in (",
 "    select cp.user_id",
 "    from public.character_permissions cp",
 "    where cp.character_id=p_character_id and cp.can_edit",
 "  );"
].join("\n");
test("T41-01 original migration, resources and encounter SQL remain immutable",()=>{
 assert.equal(blob(restFile),"2bd48d73398a3e9095b61ee288c0377d464edfc6");
 assert.equal(blob(resourceFile),"f96a3788334fe306374dfd4b5fdf4e00992d3924");
 assert.equal(blob(guardFile),"be7844fe16b14b73f4fb03f68069f9eb0af3dbf8");
});
test("T41-01B historic #364 deployed resource-profile helper is source-pinned separately",()=>{
 const fixture="scripts/integration/c34/fixtures/t41_original_live_rest_resource_profile_pg17.sql";
 assert.equal(blob(fixture),"1c1278f22396ee5805dd0e70c02d9ebcbc0f4388");
 const body=read(fixture);
 assert.match(body,/039868c4ac5cdd62e0efc1e46f584df2bdc34a9c/);
 assert.match(body,/2c798f8351282d80e63ab8e9e9019272/);
 assert.match(body,/CREATE OR REPLACE FUNCTION private\.character_sheet_resource_profile_json_v1/);
 assert.match(body,/REVOKE ALL ON FUNCTION private\.character_sheet_resource_profile_json_v1/);
});
test("T41-02 private original Rest has exactly one legacy mirror and source-original rules",()=>{
 const rest=read(restFile);
 assert.equal(rest.split(mirror).length,2);
 for(const token of [
  "private.restore_character_rest_action_state_v1",
  "public.complete_character_rest_v1",
  "v_class_source='XPHB' and p_rest_type='short_rest'",
  "elsif p_rest_type='long_rest'",
  "'restoredClassFeatureUses',v_restored",
  "insert into public.character_rest_log",
  "private.sync_character_spell_slots_v1(p_character_id)",
  "private.character_sheet_resource_profile_json_v1(p_character_id)"
 ])assert.ok(rest.includes(token),"Missing original Rest behavior: "+token);
});
test("T41-03 one-clause Option A preserves original Rest authority and separate T40 action",()=>{
 const rest=read(restFile);
 const candidate=rest.replace(mirror,
  "  -- T41 explicitly NON-ORIGINAL Option A: no historical-account projection.");
 assert.notEqual(candidate,rest);
 assert.doesNotMatch(candidate,/update public\.players p/);
 assert.ok(candidate.includes("update public.character_sheets"));
 assert.ok(candidate.includes("insert into public.character_rest_log"));
 assert.ok(read(guardFile).includes("private.assert_character_resource_not_active_v1"));
 const action=read("sql/20260802_02_character_sheet_feature_actions.sql");
 assert.match(action,/update public\.players p/);
});
test("T41-04 original #364 tests retained, signed Rest fixture cannot be conflated with T40",()=>{
 const signed=read("scripts/integration/c34/test_t41_rest_action_signed_pg17.mjs");
 assert.match(signed,/C34_T41_SIGNED_CONFIRM/);
 assert.match(signed,/SIGNED_ORIGINAL_REST_ACCOUNT_MIRROR_LOCAL_ONLY/);
 for(const name of [
  "T41-ORIGINAL-SIGNED-RED",
  "T41-OPTION-A-XPHB",
  "T41-OPTION-A-PHB",
  "T41-OPTION-A-RESOURCES",
  "T41-OPTION-A-ENCOUNTER",
  "T41-OPTION-A-REVOKE"
 ])assert.ok(signed.includes(name),"Missing signed checkpoint: "+name);
 assert.match(signed,/sql\/20260810_90_rest_class_feature_restoration\.sql/);
 assert.match(read("scripts/integration/c34/test_t40_rage_action_signed_pg17.mjs"),
   /separate rest writer still HOLD/);
});
