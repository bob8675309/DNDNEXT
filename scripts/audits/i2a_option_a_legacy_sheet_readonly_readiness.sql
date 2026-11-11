-- I2-A Option A legacy players.sheet preservation readiness — SELECT-ONLY.
-- Owner decision: canonical public.character_sheets wins; retain every
-- existing public.players.sheet byte; retire automatic mirror after audit.
-- DO NOT APPLY DDL/DML. No INSERT/UPDATE/DELETE/ALTER/REVOKE/GRANT is here.
-- Source metadata and AGGREGATES only; NO player IDs or sheet payloads.
-- Re-run after source changes and before a separately approved migration.
SELECT current_setting('server_version') AS postgres_version;

WITH f AS (
  SELECT n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' AS signature,
         lower(pg_get_functiondef(p.oid)) AS source_lower,
         md5(pg_get_functiondef(p.oid)) AS source_md5,
         p.prosecdef AS security_definer
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname IN ('public','private') AND p.prokind='f'
)
SELECT count(*) FILTER (WHERE source_lower LIKE '%update public.players%')::int
         AS legacy_account_update_functions,
       count(*) FILTER (WHERE source_lower LIKE '%update public.players%'
                        AND security_definer)::int AS security_definer_account_updaters,
       count(*) FILTER (WHERE source_lower LIKE '%insert into public.players%')::int
         AS legacy_account_insert_functions
FROM f;

-- Function identity and fingerprint only. Compare full list with held
-- docs/I1_N_LEGACY_SHEET_LIVE_SOURCE_CENSUS_2026-11-11.json.
SELECT n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' AS signature,
       md5(pg_get_functiondef(p.oid)) AS original_source_md5
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('public','private') AND p.prokind='f'
  AND (lower(pg_get_functiondef(p.oid)) LIKE '%update public.players%'
       OR lower(pg_get_functiondef(p.oid)) LIKE '%insert into public.players%')
ORDER BY signature;

-- Aggregates only; do not expose sheet/nonce text or account identifiers.
WITH legacy AS (
  SELECT p.user_id, p.sheet <> '{}'::jsonb AS populated,
         p.sheet #>> '{meta,creationRequestId}' AS request_marker,
         (SELECT count(DISTINCT cp.character_id)
            FROM public.character_permissions cp
           WHERE cp.user_id=p.user_id AND cp.can_edit) AS editable_count,
         EXISTS (
           SELECT 1 FROM public.character_permissions cp
           JOIN public.character_sheets cs ON cs.character_id=cp.character_id
           WHERE cp.user_id=p.user_id AND cp.can_edit AND cs.sheet=p.sheet
         ) AS matches_editable_sheet
  FROM public.players p
)
SELECT count(*)::int AS account_rows,
       count(*) FILTER (WHERE populated)::int AS nonempty_snapshots,
       count(*) FILTER (WHERE populated AND request_marker IS NULL)::int
         AS nonempty_missing_creation_marker,
       count(*) FILTER (WHERE populated AND editable_count>1)::int
         AS nonempty_with_multiple_editable_characters,
       count(*) FILTER (WHERE populated AND matches_editable_sheet)::int
         AS nonempty_matching_at_least_one_editable_canonical_sheet
FROM legacy;

-- Authenticated table-wide INSERT/UPDATE grants currently include sheet.
-- A future cutover needs both server-function changes and a reviewed
-- column-level privilege transition, preserving name profile writes.
SELECT has_table_privilege('authenticated','public.players','SELECT') AS authenticated_select,
       has_table_privilege('authenticated','public.players','UPDATE') AS authenticated_update,
       has_column_privilege('authenticated','public.players','sheet','UPDATE') AS authenticated_can_update_sheet,
       has_column_privilege('authenticated','public.players','sheet','INSERT') AS authenticated_can_insert_sheet,
       has_column_privilege('authenticated','public.players','name','UPDATE') AS authenticated_can_update_name,
       (SELECT relrowsecurity FROM pg_class WHERE oid='public.players'::regclass) AS row_security_enabled;

SELECT policyname,cmd,roles,qual,with_check
FROM pg_policies
WHERE schemaname='public' AND tablename='players'
ORDER BY policyname;

SELECT (SELECT count(*) FROM pg_trigger
        WHERE tgrelid='public.players'::regclass AND NOT tgisinternal)::int
         AS noninternal_players_triggers,
       md5(pg_get_functiondef('public.get_my_player_characters_v2()'::regprocedure))
         AS canonical_list_reader_md5;

-- Do not use snapshot values to reconstruct missing creation marker,
-- reassign a selected character, or silently overwrite any legacy row.
