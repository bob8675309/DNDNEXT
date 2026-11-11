-- I1-M source-identity proof ONLY. No function replacement.
-- IMPORTANT #324 private original-v2 body ALREADY carries the exact merged
-- PR #319 one-clause legacy snapshot guard; do not install it a second time.
\set ON_ERROR_STOP on
DO $i1m_v2$
DECLARE
  v_source text;
  v_original text := 'on conflict (user_id) do update set sheet = excluded.sheet, updated_at = now();';
  v_guard text := 'on conflict (user_id) do update set sheet = excluded.sheet, updated_at = now() where public.players.sheet = ''{}''::jsonb;';
  v_public text;
BEGIN
  IF current_database()<>'postgres'
     OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
     OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
     OR to_regprocedure('private.sync_character_artificer_plan_projection_v1(uuid)') IS NULL
  THEN RAISE EXCEPTION 'I1-M expects disposable I1-L signed state only'; END IF;
  v_source := pg_get_functiondef('private.create_player_character_v2_source_20261105(jsonb,jsonb)'::regprocedure);
  IF length(v_source)-length(replace(v_source,v_guard,''))<>length(v_guard)
     OR v_source NOT LIKE '%CREATE OR REPLACE FUNCTION private.create_player_character_v2_source_20261105%'
  THEN RAISE EXCEPTION 'I1-M private v2 source must already have exactly one #319 guard'; END IF;
  -- Restore BOTH historical differences (private function name and original
  -- PR319 guard) to recover the exact live original public-v2 MD5.
  v_public:=replace(
    replace(v_source,v_guard,v_original),
    'private.create_player_character_v2_source_20261105',
    'public.create_player_character_v2');
  IF md5(v_public)<>'0351f0a00acae023278e1b8b065b00c9'
  THEN RAISE EXCEPTION 'I1-M #324 private v2 copy differs beyond name and #319 guard'; END IF;
END $i1m_v2$;
\echo 'PASS I1M-SOURCE-V2: private #324 v2 already includes exact #319 legacy snapshot guard, source public-original MD5 recovered; no replacement performed'
