#!/usr/bin/env node
import fs from "node:fs";
import assert from "node:assert/strict";
const read=(p)=>fs.readFileSync(p,"utf8");
const original=read("scripts/fixtures/p1_3_npc_visible_sheet_original_functions_pg17.sql");
const setup=read("scripts/fixtures/p1_3_npc_safe_profile_local_auth_pg17.sql");
const candidate=read("sql/candidates/20261104_npc_player_safe_profile_rls_v1.sql");
const stage2=read("sql/candidates/20261104_npc_gm_dossier_column_acl_stage2.sql");
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
 "EXPECTED UNSAFE BASELINE","RELEASE BLOCKER",
 "DISPOSABLE_LOCAL_GOTRUE_ONLY",
 "readCharacters(people.OUTSIDER.who,visible)",
 "people.CONVERT_ONLY","people.INV_ONLY","people.EDITOR","people.ADMIN"
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
for(const content of [setup,jwt,candidate,stage2]){
 assert.ok(!content.includes("ucggczovhmauhshvhusx"),"Production project in scratch files");
 assert.ok(!content.includes("service_role"),"Service credentials forbidden");
}
console.log("P1.3 NPC full-sheet RLS, restricted RPC, safe profile candidate static contracts PASS");
