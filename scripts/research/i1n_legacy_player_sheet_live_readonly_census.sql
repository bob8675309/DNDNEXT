-- I1-N: read-only live Postgres 17 source census.
-- NO INSERT, UPDATE, DELETE, ALTER, CREATE, GRANT, privilege escalation, or user-sheet data reads.
-- Run manually against authorized source as read-only; compare MD5 list to
-- docs/I1_N_LEGACY_SHEET_LIVE_SOURCE_CENSUS_2026-11-11.json.
-- This query is NOT a proposed migration or permission cutover.
WITH functions AS (
 SELECT n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' AS signature,
   pg_get_functiondef(p.oid) AS source_text,
   md5(pg_get_functiondef(p.oid)) AS source_md5
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('public','private') AND p.prokind='f'
)
SELECT signature,source_md5,
 (lower(source_text) ~ 'update[[:space:]]+public[.]players') AS updates_player,
 (lower(source_text) LIKE '%insert into public.players%') AS inserts_player,
 (lower(source_text) LIKE '%from public.players%'
      OR lower(source_text) LIKE '%join public.players%') AS looks_up_player_row
FROM functions
WHERE lower(source_text) ~ 'update[[:space:]]+public[.]players'
 OR lower(source_text) LIKE '%insert into public.players%'
 OR lower(source_text) LIKE '%from public.players%'
 OR lower(source_text) LIKE '%join public.players%'
ORDER BY signature;

-- Source-only policy and table exposure context; no player data.
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname='public' AND tablename='players'
ORDER BY policyname;

SELECT c.relrowsecurity AS rls_enabled,
 has_table_privilege('authenticated','public.players','SELECT') AS authenticated_select_granted,
 has_table_privilege('anon','public.players','SELECT') AS anonymous_select_granted
FROM pg_class c WHERE c.oid='public.players'::regclass;

-- Crucial modern player-character list: canonical sheets, not players.sheet.
SELECT p.proname,md5(pg_get_functiondef(p.oid)) AS source_md5,
 lower(pg_get_functiondef(p.oid)) LIKE '%join public.character_sheets%' AS reads_canonical
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='get_my_player_characters_v2';
