#!/usr/bin/env node
import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const sha=p=>{const b=fs.readFileSync(path.join(root,p));return crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0"),b])).digest("hex");};
const original={
 "sql/20260710_02_character_progression_foundation.sql":"b1b9781e06e9210a30c520b7f531bce7cbdbd82a",
 "sql/20260721_01_character_data_rls_phase_1.sql":"5d9a53590a030ac15a45be654016dbbe00651fff",
 "scripts/fixtures/p1_3_admin_grant_original_source_pg17.sql":"8269b57301a92751937c0a6a0c9529e8e7eb6848",
 "scripts/fixtures/p1_3_npc_visible_sheet_original_functions_pg17.sql":"9c479d3f044268f73da3a5515d229096ce03f94a",
 "scripts/integration/c34/sources/02_npc_profile_stage1.sql":"9dfe44eee49df6ead8c8ccfc7a0454a996b8bee3",
 "scripts/integration/c34/sources/04_private_story_stage3.sql":"01e48823ac3a46aa5880e98200e97c2595501ce7",
 "components/NpcPanel.js":"e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db",
 "components/CharacterClassPanel.js":"d39d2bceab944d3d4ec42cc2cfda92609ce51a2b"
};
function fn(source,name){
 const p=source.toLowerCase().indexOf("create or replace function "+name.toLowerCase()+"(");
 assert.ok(p>=0,name);const s=source.slice(p),m=/\n(?:\$\$|\$function\$);/i.exec(s);
 assert.ok(m,name+" terminator");return s.slice(0,m.index+m[0].length);
}
const candidate=read("scripts/integration/c34/candidates/t46_progression_visibility_discovery_pg17.sql");
test("T46/01 immutable original progression, Sheet RLS, NPC stages/consumers",()=>{
 for(const [p,hash] of Object.entries(original))assert.equal(sha(p),hash,p);
 const reader=fn(read("sql/20260710_02_character_progression_foundation.sql"),"public.get_character_progression_v1");
 assert.doesNotMatch(reader,/if not private.can_manage_character_progression_v1/);
 const old=read("sql/20260721_01_character_data_rls_phase_1.sql");
 assert.match(old,/create policy character_sheets_select_visible_or_assigned[\s\S]*?select 1 from public.characters c/i);
 assert.match(old,/grant select, insert, update, delete on table public.character_sheets to authenticated;/);
 assert.match(read("scripts/integration/c34/sources/02_npc_profile_stage1.sql"),/ALTER POLICY character_sheets_select_visible_or_assigned[\s\S]*?private.can_access_character_v1\(character_id,'edit'\)/);
});
test("T46/02 candidate reader is exact original SQL with ONE management check",()=>{
 const orig=fn(read("sql/20260710_02_character_progression_foundation.sql"),"public.get_character_progression_v1");
 const revised=fn(candidate,"public.get_character_progression_v1");
 const gate="  -- T46: full XP/class/session/event detail is never a public roster projection.\n  -- Character editors and current Game Master authority only.\n  if not private.can_manage_character_progression_v1(p_character_id) then\n    raise exception 'You do not have permission to view full character progression.' using errcode = '42501';\n  end if;\n\n";
 assert.equal(revised.replace(gate,""),orig);
 const originalAdmin=fn(read("scripts/fixtures/p1_3_admin_grant_original_source_pg17.sql"),"private.current_user_is_admin");
 assert.equal(fn(candidate,"private.current_user_is_admin").replace("AND up.role IN ('admin', 'gm', 'dm')","AND up.role = 'admin'"),originalAdmin);
 assert.match(candidate,/private\.p13_levelup_case_guard/);
});
test("T46/03 scoped sanitized per-viewer clues; preserve separate GM secrets and no client roll trust",()=>{
 for(const phrase of [
  "viewer_user_id uuid NOT NULL REFERENCES auth.users","field_key IN ('class','level','xp')",
  "discovery_source IN ('gm_direct','dialogue','ability_check')",
  "auth.uid() IS NULL OR NOT private.current_user_is_admin()",
  "d.viewer_user_id=auth.uid()",
  "AND NOT coalesce(c.is_hidden,false)",
  "private.c34_t46_progression_discoveries ENABLE ROW LEVEL SECURITY",
  "REVOKE ALL ON private.c34_t46_progression_discoveries",
  "USING ((SELECT private.can_access_character_v1(character_id,'edit')))",
  "RETURNS jsonb",
  "REVOKE ALL ON FUNCTION public.c34_t46_get_progression_discoveries_v1"
 ])assert.ok(candidate.includes(phrase),phrase);
 assert.ok(!candidate.includes("characters.secret"));
 assert.ok(!candidate.includes("profileReveal.secret"));
 assert.doesNotMatch(candidate,/create trigger|alter table public\.characters\s+drop/i);
 const stage3=read("scripts/integration/c34/sources/04_private_story_stage3.sql");
 assert.match(stage3,/Changing editable sheet.profileReveal.secret does NOT publish GM secrets/);
 assert.match(stage3,/character_public_secret_revelations/);
});
test("T46/04 signed local original RED→safe-candidate GREEN matrix and no runtime claims",()=>{
 const s=read("scripts/integration/c34/test_t46_progression_visibility_signed_pg17.mjs");
 for(const phrase of ["DNDNEXT_T46_VISIBILITY_CONFIRM","127.0.0.1:54321",
  "signUp","signInWithPassword","role","can_edit","can_inventory",
  "get_character_progression_v1","c34_t46_set_progression_discovery_v1",
  "c34_t46_get_progression_discoveries_v1","is_hidden","originalHistory",
  "private.p13_levelup_case_guard","scripts/integration/c34/sources/02_npc_profile_stage1.sql","42501"])
  assert.ok(s.includes(phrase),phrase);
});
