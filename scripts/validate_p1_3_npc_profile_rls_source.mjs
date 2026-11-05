#!/usr/bin/env node
import fs from "node:fs";
import assert from "node:assert/strict";
const read=(p)=>fs.readFileSync(p,"utf8");
const original=read("scripts/fixtures/p1_3_npc_visible_sheet_original_functions_pg17.sql");
const setup=read("scripts/fixtures/p1_3_npc_safe_profile_local_auth_pg17.sql");
const candidate=read("sql/candidates/20261104_npc_player_safe_profile_rls_v1.sql");
const stage2=read("sql/candidates/20261104_npc_gm_dossier_column_acl_stage2.sql");
const stage3=read("sql/candidates/20261104_gm_vs_player_backstory_secrets_stage3.sql");
const jwt=read("scripts/test_p1_3_npc_profile_safe_local_auth.mjs");
for(const h of ["97b5e6b059e6467e24c4283fe420c83e","deca87aaad0dce214743c87cdca03f36"]){
 assert.ok(original.includes(h),"Original function fingerprint absent: "+h);
 assert.ok(candidate.includes(h),"Candidate source drift guard absent: "+h);
}
for(const q of [
 "ALTER POLICY character_sheets_select_visible_or_assigned",
 "private.can_access_character_v1(character_id,'edit')",
 "CREATE OR REPLACE FUNCTION public.get_npc_profile_visible_v1(p_character_id uuid)",
 "auth.uid() IS NOT NULL","coalesce(c.is_hidden,false)",
 "REVOKE ALL ON FUNCTION public.get_npc_profile_visible_v1(uuid)",
 "GRANT EXECUTE ON FUNCTION public.get_npc_profile_visible_v1(uuid)",
 "FROM PUBLIC,anon",
 "CASE WHEN p.reveal->'secret'='true'::jsonb",
 "CREATE OR REPLACE FUNCTION public.get_my_player_characters_v2()",
 "CASE WHEN cp.can_edit THEN to_jsonb(c)",
 "ELSE '{}'::jsonb END",
 "to_jsonb(cp)"
]) assert.ok(candidate.includes(q),"Missing candidate authority: "+q);
for(const forbidden of ["DROP TABLE","TRUNCATE","DELETE FROM public","ALTER TABLE public.characters DROP",
 "GRANT SELECT ON public.character_sheets TO anon"])
 assert.ok(!candidate.includes(forbidden),"Unsafe SQL: "+forbidden);
for(const marker of [
 "PASS V00","PASS V01","PASS V02","PASS V03",
 "PASS V04","PASS V05","PASS V06","PASS V07","PASS V08",
 "PASS V09","PASS V10","PASS V11","PASS V12","PASS V13","PASS V14","PASS V15","PASS V16","PASS V17","PASS V18",
 "EXPECTED UNSAFE BASELINE","RELEASE BLOCKER",
 "DISPOSABLE_LOCAL_GOTRUE_ONLY",
 "readCharacters(people.OUTSIDER.who,visible)",
 "people.CONVERT_ONLY","people.INV_ONLY","people.EDITOR","people.COEDITOR","people.ADMIN"
]) assert.ok(jwt.includes(marker),"Missing JWT coverage: "+marker);
for(const required of [
 "CREATE POLICY characters_select_visible_or_assigned",
 "CREATE POLICY character_sheets_select_visible_or_assigned",
 "CREATE POLICY character_permissions_select_self",
 "GRANT SELECT (",
 "REVOKE ALL ON public.characters"
]) assert.ok(setup.includes(required),"Missing scratch source-policy model: "+required);
for(const required of [
 "REVOKE SELECT (",
 "background,motivation,quirk,mannerism,voice",
 "CREATE OR REPLACE FUNCTION public.get_npc_dossier_admin_v1(p_character_id uuid)",
 "auth.uid() IS NULL OR NOT private.current_user_is_admin()",
 "RAISE EXCEPTION 'GM-only NPC dossier access denied'",
 "REVOKE ALL ON FUNCTION public.get_npc_dossier_admin_v1(uuid)",
 "GRANT EXECUTE ON FUNCTION public.get_npc_dossier_admin_v1(uuid)"
]) assert.ok(stage2.includes(required),"Stage2 Admin/ACL contract missing "+required);
for(const required of [
 "CREATE TABLE private.character_creator_attribution",
 "creator_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL",
 "REVOKE ALL ON private.character_creator_attribution FROM PUBLIC,anon,authenticated",
 "CREATE OR REPLACE FUNCTION private.record_character_creator_v1",
 "REVOKE ALL ON FUNCTION private.record_character_creator_v1(uuid)",
 "CREATE OR REPLACE FUNCTION private.can_access_creator_backstory_v1",
 "private.can_access_character_v1(p_character_id,'edit')",
 "attr.creator_user_id=auth.uid()",
 "private.current_user_is_admin()",
 "private.can_access_creator_backstory_v1(character_id)",
 "CREATE TABLE public.character_backstory_secrets",
 "CREATE TABLE public.character_public_secret_revelations",
 "character_backstory_secrets_select_editor",
 "character_backstory_secrets_insert_editor",
 "character_backstory_secrets_update_editor",
 "character_public_secret_revelations_gm_only",
 "CREATE OR REPLACE FUNCTION public.get_character_secrets_v1",
 "private.current_user_is_admin()",
 "CREATE OR REPLACE FUNCTION public.set_character_secret_v1",
 "(to_jsonb(v_character) - 'secret')",
 "(to_jsonb(c) - 'secret')",
 "CREATE OR REPLACE FUNCTION public.get_npc_profile_visible_v1",
 "public.character_public_secret_revelations reveal",
 "reveal.is_revealed=true",
 "Legacy secret RPC source changed",
 "REVOKE ALL ON FUNCTION public.get_character_secrets_v1(uuid[]) FROM PUBLIC,anon",
 "REVOKE ALL ON FUNCTION public.set_character_secret_v1(uuid,text) FROM PUBLIC,anon",
 "Legacy values in characters.secret remain untouched"
]) assert.ok(stage3.includes(required),"Stage3 split-secret contract absent "+required);
for(const forbidden of ["DROP TABLE","TRUNCATE","DELETE FROM public.characters",
 "UPDATE public.characters SET secret", "GRANT SELECT ON public.characters TO anon",
 "GRANT INSERT ON private.character_creator_attribution TO authenticated",
 "GRANT EXECUTE ON FUNCTION private.record_character_creator_v1(uuid) TO authenticated"])
 assert.ok(!stage3.includes(forbidden),"Destructive or disclosure operation in research stage3: "+forbidden);
for(const source of [setup,jwt,candidate,stage2,stage3]){
 assert.ok(!source.includes("ucggczovhmauhshvhusx"),"Production project in scratch files");
 assert.ok(!source.includes("service_role"),"Service credentials forbidden");
}
console.log("P1.3 NPC full-sheet RLS, restricted RPC, safe profile candidate static contracts PASS");
