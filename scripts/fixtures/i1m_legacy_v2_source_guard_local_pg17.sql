-- I1-M research ONLY; disposable local GoTrue/PG17 after I1-L signed tests.
-- Installs the exact PR #319 legacy-sheet clause on the private source-original
-- v2 body retained by #324. The public Story/nonce wrappers remain unchanged.
\set ON_ERROR_STOP on
DO $i1m_v2$
DECLARE
  v_source text;
  v_changed text;
  v_original text := 'on conflict (user_id) do update set sheet = excluded.sheet, updated_at = now();';
  v_guard text := 'on conflict (user_id) do update set sheet = excluded.sheet, updated_at = now() where public.players.sheet = ''{}''::jsonb;';
  v_orig_hash text;
  v_v3_hash text;
  v_public_v2_hash text;
BEGIN
  IF current_database() <> 'postgres'
     OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
     OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
     OR to_regprocedure('private.sync_character_artificer_plan_projection_v1(uuid)') IS NULL
  THEN RAISE EXCEPTION 'I1-M requires disposable local signed I1-L state'; END IF;
  v_source := pg_get_functiondef('private.create_player_character_v2_source_20261105(jsonb,jsonb)'::regprocedure);
  -- The source copy was originally identical to public v2 apart from its
  -- qualified name; fail on any unexpected drift before modifying anything.
  IF md5(replace(v_source,
       'private.create_player_character_v2_source_20261105',
       'public.create_player_character_v2')) <> '0351f0a00acae023278e1b8b065b00c9'
     OR length(v_source)-length(replace(v_source,v_original,''))<>length(v_original)
  THEN RAISE EXCEPTION 'Original #324 private v2 source no longer matches live-pinned public v2'; END IF;
  v_orig_hash := md5(v_source);
  v_v3_hash := md5(pg_get_functiondef('public.create_player_character_v3(jsonb,jsonb,jsonb)'::regprocedure));
  v_public_v2_hash := md5(pg_get_functiondef('public.create_player_character_v2(jsonb,jsonb)'::regprocedure));
  v_changed := replace(v_source,v_original,v_guard);
  EXECUTE v_changed;
  v_changed := pg_get_functiondef('private.create_player_character_v2_source_20261105(jsonb,jsonb)'::regprocedure);
  IF md5(replace(v_changed,v_guard,v_original))<>v_orig_hash
     OR md5(pg_get_functiondef('public.create_player_character_v3(jsonb,jsonb,jsonb)'::regprocedure))<>v_v3_hash
     OR md5(pg_get_functiondef('public.create_player_character_v2(jsonb,jsonb)'::regprocedure))<>v_public_v2_hash
     OR v_changed NOT LIKE '%where public.players.sheet = ''{}''::jsonb;%'
  THEN RAISE EXCEPTION 'I1-M changed more than the single legacy account-sheet UPSERT clause'; END IF;
END
$i1m_v2$;
\echo 'PASS I1M-SOURCE-V2: #319 one-clause account snapshot guard in exact #324 private v2 copy, public nonce/Story wrappers unchanged'
