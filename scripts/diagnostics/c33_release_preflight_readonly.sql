-- DNDNext C3.3 OPERATOR PREFLIGHT (READ-ONLY SQL; NO MIGRATION).
-- Run only with a verified connection to the intended DnDWeb project.
-- No secret values, email addresses, personal data or file paths returned.
-- Snapshot is NOT a backup; run the separate 21-table preservation audit too.
SELECT current_database() AS db_name,
       current_setting('server_version_num')::integer AS postgres_version,
       to_regclass('private.test_admins') IS NOT NULL AS test_fixture_marker_present,
       to_regprocedure('public.create_player_character_v3(jsonb,jsonb,jsonb)') IS NOT NULL AS forge_v3_present,
       to_regprocedure('public.get_npc_profile_visible_v1(uuid)') IS NOT NULL AS new_public_npc_rpc_present,
       to_regprocedure('public.get_npc_dossier_admin_v1(uuid)') IS NOT NULL AS new_gm_dossier_rpc_present,
       to_regprocedure('public.get_character_editor_narrative_v1(uuid)') IS NOT NULL AS new_editor_narrative_rpc_present,
       to_regprocedure('public.create_player_character_with_private_backstory_v1(jsonb,jsonb,jsonb,text)') IS NOT NULL AS new_private_forge_rpc_present,
       to_regclass('public.character_backstory_secrets') IS NOT NULL AS new_private_story_table_present,
       (SELECT count(*)::integer FROM pg_policy WHERE polrelid='public.inventory_items'::regclass) AS inventory_policy_count,
       (SELECT count(*)::integer FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass
         AND conname IN ('inventory_items_owner_type_chk','inventory_items_owner_type_check')) AS inventory_owner_check_count,
       has_table_privilege('authenticated','public.characters','SELECT') AS broad_character_table_select,
       has_column_privilege('authenticated','public.characters','background','SELECT') AS background_column_select,
       (SELECT count(*)::integer FROM public.characters WHERE nullif(btrim(secret),'') IS NOT NULL) AS nonempty_gm_secret_count,
       (SELECT count(*)::integer FROM public.inventory_items WHERE owner_type='character') AS character_owned_item_count;

SELECT count(*)::integer AS recorded_remote_migrations,
       max(version) AS latest_migration_version,
       count(*) FILTER (WHERE coalesce(cardinality(statements),0)>0)::integer AS original_statements_preserved,
       count(*) FILTER (WHERE coalesce(cardinality(rollback),0)>0)::integer AS recorded_rollback_statements
FROM supabase_migrations.schema_migrations;

SELECT b.name AS bucket_name,
       b.public AS is_public,
       count(o.id)::bigint AS object_count,
       coalesce(sum((o.metadata->>'size')::bigint),0)::bigint AS metadata_reported_bytes,
       md5(coalesce(string_agg(
         md5(to_jsonb(o)::text),''
         ORDER BY md5(to_jsonb(o)::text)
       ),'')) AS object_metadata_digest
FROM storage.buckets b
LEFT JOIN storage.objects o ON o.bucket_id=b.id
GROUP BY b.name,b.public
ORDER BY b.name;
