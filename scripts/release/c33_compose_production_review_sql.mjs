#!/usr/bin/env node
// C3.3 PRODUCTION-TARGET REVIEW BUNDLE — NOT AN APPROVED MIGRATION.
// Does NOT connect to a DB; emits SQL only into an explicit path OUTSIDE repo.
// Needs owner-approved backup, DnDWeb ref check, SQL review and UI cutover.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const sourcePins=[["sql/candidates/20261104_npc_player_safe_profile_rls_v1.sql","9dfe44eee49df6ead8c8ccfc7a0454a996b8bee3"],["sql/candidates/20261104_npc_gm_dossier_column_acl_stage2.sql","afdd2849c3ae2be5929fd8c11c9b4e19f4f6a7ac"],["sql/candidates/20261104_gm_vs_player_backstory_secrets_stage3.sql","01e48823ac3a46aa5880e98200e97c2595501ce7"],["sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql","4532ddb8db642d0d0ab14646a3e87c034d4134c6"]];
const protectedTables=["private.character_spell_mastery","public.ai_item_images","public.alchemy_enhancer_effects","public.alchemy_reagent_families","public.alchemy_recipe_options","public.campaign_item_pool_settings","public.character_spell_slots","public.character_spells","public.character_stock","public.craft_plans","public.crafting_attempts","public.crafting_material_effects","public.crafting_recipe_rules","public.encounter_spell_slots","public.inventory_items","public.items_catalog","public.npc_known_recipes","public.player_recipes","public.recipes","public.spell_effects","public.spells_catalog"];
function sourceBody([file,expected]){
 const bytes=fs.readFileSync(path.join(root,file));
 const actual=createHash("sha1").update("blob "+bytes.length+"\0").update(bytes).digest("hex");
 assert.equal(actual,expected,"Pinned candidate source changed; requires new owner review "+file);
 const lines=bytes.toString("utf8").split(/\r?\n/);
 const starts=lines.flatMap((s,i)=>s.trim()==="BEGIN;"?[i]:[]);
 const ends=lines.flatMap((s,i)=>s.trim()==="COMMIT;"?[i]:[]);
 assert.equal(starts.length,1,"Source must have exactly one BEGIN: "+file);
 assert.equal(ends.length,1,"Source must have exactly one COMMIT: "+file);
 assert.ok(starts[0]<ends[0]);
 assert.ok(!lines.some(s=>s.trimStart().startsWith("\\")),"No psql meta commands permitted");
 const body=lines.filter((s,i)=>i!==starts[0]&&i!==ends[0]).join("\n");
 const executable=body.split("\n").filter(s=>!s.trimStart().startsWith("--")).join("\n");
 assert.doesNotMatch(executable,/\b(?:DROP\s+TABLE|TRUNCATE|DELETE\s+FROM)\b/i,"Catalog-destructive SQL source must not be auto-bundled");
 return {file,sha:actual,body};
}
const count=table=>"(SELECT count(*)::bigint FROM "+table+")";
const digest=table=>"(SELECT md5(coalesce(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),'')) FROM "+table+" x)";
const snapshots=protectedTables.flatMap((t,i)=>[count(t)+" AS n"+i,digest(t)+" AS h"+i]);
snapshots.push("(SELECT count(*) FROM public.characters WHERE nullif(btrim(secret),'') IS NOT NULL) AS existing_secret_count");
snapshots.push("(SELECT md5(coalesce(string_agg(md5(id::text||coalesce(secret,'')),'' ORDER BY id::text),'')) FROM public.characters) AS gm_secret_digest");
// Storage metadata checks protect SQL rows, not Storage object bytes.
snapshots.push("(SELECT count(*) FROM storage.objects) AS storage_object_count");
snapshots.push("(SELECT md5(coalesce(string_agg(md5(to_jsonb(x)::text),'' ORDER BY md5(to_jsonb(x)::text)),'')) FROM storage.objects x) AS storage_object_metadata_digest");
const selectSnapshot="SELECT\n "+snapshots.join(",\n ")+"\n";
const fields=protectedTables.flatMap((_,i)=>["before.n"+i+" IS DISTINCT FROM after.n"+i,"before.h"+i+" IS DISTINCT FROM after.h"+i]);
fields.push("before.existing_secret_count IS DISTINCT FROM after.existing_secret_count");
fields.push("before.gm_secret_digest IS DISTINCT FROM after.gm_secret_digest");
fields.push("before.storage_object_count IS DISTINCT FROM after.storage_object_count");
fields.push("before.storage_object_metadata_digest IS DISTINCT FROM after.storage_object_metadata_digest");
const preflight=[
 "-- C3.3 REVIEW ONLY. This SQL is NOT owner-approved and MUST NOT be applied as generated.",
 "-- NEVER use an unattended db push; connected DnDWeb has a separate 243-entry migration history.",
 "-- Requires a VERIFIED recoverable private database backup AND a separate Storage object-byte copy.",
 "-- Release must coordinate new RPCs with matching Vercel code; app downtime is allowed (prototype).",
 "-- This source does not record or verify an external backup. Obtain signed owner approval before use.",
 "BEGIN;",
 "SET LOCAL lock_timeout='2s';",
 "SET LOCAL statement_timeout='120s';",
 "DO $c33_review_gate$",
 "BEGIN",
 " IF current_database()<>'postgres'",
 " OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999",
 " OR to_regclass('private.test_admins') IS NOT NULL",
 " OR to_regclass('auth.users') IS NULL",
 " OR to_regclass('supabase_migrations.schema_migrations') IS NULL",
 " OR NOT EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20261019013551')",
 " OR to_regprocedure('public.get_npc_profile_visible_v1(uuid)') IS NOT NULL",
 " OR to_regclass('private.character_creator_attribution') IS NOT NULL",
 " OR to_regprocedure('public.create_player_character_v3(jsonb,jsonb,jsonb)') IS NULL",
 " OR md5(pg_get_functiondef('public.create_player_character_v3(jsonb,jsonb,jsonb)'::regprocedure)) <> '6ba73e6f12fcf826cc0a739cce45ff40'",
 " OR md5(pg_get_functiondef('private.can_access_character_v1(uuid,text)'::regprocedure)) <> '97b5e6b059e6467e24c4283fe420c83e'",
 " OR md5(pg_get_functiondef('private.materialize_player_forge_starting_equipment_v1(uuid)'::regprocedure)) <> '653e1b9d7cc47dcff2cef33a674b97f4'",
 " OR md5(pg_get_functiondef('public.get_my_player_characters_v2()'::regprocedure)) <> 'deca87aaad0dce214743c87cdca03f36'",
 " OR has_table_privilege('authenticated','public.characters','SELECT')",
 " OR NOT has_column_privilege('authenticated','public.characters','background','SELECT')",
 " OR (SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass)<>4",
 " OR (SELECT count(*) FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass",
 "     AND conname IN ('inventory_items_owner_type_check','inventory_items_owner_type_chk'))<>2",
 " THEN RAISE EXCEPTION 'C3.3 production review preflight drift or unexpected environment. ABORT.'; END IF;",
 "END;",
 "$c33_review_gate$;",
 "CREATE TEMP TABLE c33_release_protected_before ON COMMIT DROP AS",
 selectSnapshot+";"
].join("\n");
const postflight=[
 "DO $c33_postflight$",
 "BEGIN",
 " IF to_regprocedure('public.get_npc_profile_visible_v1(uuid)') IS NULL",
 " OR to_regprocedure('public.get_npc_dossier_admin_v1(uuid)') IS NULL",
 " OR to_regprocedure('public.get_character_editor_narrative_v1(uuid)') IS NULL",
 " OR to_regprocedure('public.create_player_character_with_private_backstory_v1(jsonb,jsonb,jsonb,text)') IS NULL",
 " OR to_regclass('private.character_creator_attribution') IS NULL",
 " OR to_regclass('public.character_backstory_secrets') IS NULL",
 " OR to_regclass('public.character_public_secret_revelations') IS NULL",
 " OR (SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass)<>4",
 " OR (SELECT count(*) FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass",
 "     AND conname='inventory_items_owner_type_chk')<>0",
 " OR (SELECT count(*) FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass",
 "     AND conname='inventory_items_owner_type_check' AND convalidated)<>1",
 " OR has_column_privilege('authenticated','public.characters','background','SELECT')",
 " THEN RAISE EXCEPTION 'C3.3 production review migration postflight FAILED; transaction must abort'; END IF;",
 " IF EXISTS (SELECT 1 FROM pg_temp.c33_release_protected_before before",
 " CROSS JOIN ("+selectSnapshot+") after",
 " WHERE "+fields.join(" OR ")+")",
 " THEN RAISE EXCEPTION 'C3.3 preserved spells/items/recipes/inventory/stock, GM secrets, or Storage metadata changed'; END IF;",
 "END;",
 "$c33_postflight$;",
 "NOTIFY pgrst,'reload schema';",
 "COMMIT;"
].join("\n");
export function composeReview(){
 const sources=sourcePins.map(sourceBody);
 const sql=[preflight,...sources.map((x,i)=>"-- SOURCE STAGE "+(i+1)+" "+x.file+" GIT_BLOB "+x.sha+"\n"+x.body),postflight].join("\n\n")+"\n";
 assert.equal((sql.match(/^BEGIN;$/gm)||[]).length,1);
 assert.equal((sql.match(/^COMMIT;$/gm)||[]).length,1);
 return {sql,sources:sources.map(x=>({file:x.file,sha:x.sha})),protectedTables};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 const result=composeReview();
 if(args.length===1&&args[0]==="--check"){
  console.log("PASS C3REL01 REVIEW ONLY "+JSON.stringify({sources:result.sources,protectedTables:result.protectedTables.length,oneTransaction:true,willNotConnectToDB:true}));
 }else if(args.length===2&&args[0]==="--out"){
  assert.ok(path.isAbsolute(args[1]),"Absolute path required");
  const dest=path.resolve(args[1]);
  assert.ok(!dest.startsWith(root+path.sep),"Output cannot be within tracked repository");
  fs.writeFileSync(dest,result.sql,{flag:"wx",mode:0o600});
  console.log("C3REL_REVIEW_BUNDLE_OUTSIDE_REPO "+dest);
 }else throw Error("Use --check OR --out /absolute/private/review.sql (never apply automatically)");
}
