-- I2-D Option A private copied v2 -> v3/Story creator source experiment.
-- Run ONLY after unchanged I1-B..O signed Forge and I2-C I2C-01..10.
-- Signed ORIGINAL v3/Story empty-sheet RED must be logged before this file.
-- Only source copied from #324 SQL changes, never public v3/Story/nonce.
-- NEVER hosted Supabase. No migrations or deployment.
\set ON_ERROR_STOP on
DO $i2d$
DECLARE
  v_source text;
  v_original_md5 text;
  v_after text;
  v_old text := 'insert into public.players(user_id, name, sheet, updated_at) values(v_user, v_name, v_sheet, now()) on conflict (user_id) do update set sheet = excluded.sheet, updated_at = now() where public.players.sheet = ''{}''::jsonb;';
  v_new text := 'insert into public.players(user_id,name)
  values(v_user, coalesce((select left(coalesce(
    nullif(btrim(u.raw_user_meta_data->>''character_name''),''''),
    nullif(btrim(u.raw_user_meta_data->>''display_name''),''''),
    nullif(btrim(split_part(coalesce(u.email,''''),''@'',1)),''''),
    ''New Player''),80) from auth.users u where u.id=v_user),''New Player''))
  on conflict (user_id) do nothing; /* I2D_OPTION_A_PRIVATE_FORGE_LEGACY_FREEZE */';
  v_v3_md5 text;
  v_priv_v3_md5 text;
  v_story_public_md5 text;
  v_story_intent_md5 text;
BEGIN
  IF current_database()<>'postgres'
   OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
   OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
   OR to_regclass('public.character_backstory_secrets') IS NULL
   OR to_regclass('public.user_profiles') IS NULL
   OR md5(pg_get_functiondef('public.sync_user_profile()'::regprocedure))<>'dd7113eec05655a661309838acce6030'
   OR to_regprocedure('public.create_player_character_with_private_backstory_v1(jsonb,jsonb,jsonb,text)') IS NULL
   OR to_regprocedure('private.create_player_character_v3_with_story_intent_i1c(jsonb,jsonb,jsonb,text)') IS NULL
   OR to_regprocedure('private.create_player_character_v2_source_20261105(jsonb,jsonb)') IS NULL
   OR to_regprocedure('private.create_player_character_v3_source_20261105(jsonb,jsonb,jsonb)') IS NULL
  THEN RAISE EXCEPTION 'I2-D only in signed isolated PG17 Forge+Story+I2-C scratch'; END IF;
  v_source:=pg_get_functiondef('private.create_player_character_v2_source_20261105(jsonb,jsonb)'::regprocedure);
  v_original_md5:=md5(v_source);
  v_v3_md5:=md5(pg_get_functiondef('public.create_player_character_v3(jsonb,jsonb,jsonb)'::regprocedure));
  v_priv_v3_md5:=md5(pg_get_functiondef('private.create_player_character_v3_source_20261105(jsonb,jsonb,jsonb)'::regprocedure));
  v_story_public_md5:=md5(pg_get_functiondef('public.create_player_character_with_private_backstory_v1(jsonb,jsonb,jsonb,text)'::regprocedure));
  v_story_intent_md5:=md5(pg_get_functiondef('private.create_player_character_v3_with_story_intent_i1c(jsonb,jsonb,jsonb,text)'::regprocedure));
  IF length(v_source)-length(replace(v_source,v_old,''))<>length(v_old)
     OR position('update public.players' IN lower(v_source))>0
     OR position('on conflict (user_id) do update set sheet = excluded.sheet' IN lower(v_source))=0
     OR position('private.create_player_character_v2_source_20261105' IN v_source)=0
     OR (SELECT prosecdef IS FALSE FROM pg_proc WHERE oid='private.create_player_character_v2_source_20261105(jsonb,jsonb)'::regprocedure)
  THEN RAISE EXCEPTION 'I2-D private source copy drift/duplicate, cannot patch automatically'; END IF;
  -- Original account UPSERT has no downstream FOUND/ROW_COUNT consumer; the
  -- original caller returns its canonical id immediately afterwards.
  -- The replacement inserts only a missing account ID/name, never sheet or
  -- updated_at. It leaves already-existing empty or populated sheets inert.
  EXECUTE replace(v_source,v_old,v_new);
  v_after:=pg_get_functiondef('private.create_player_character_v2_source_20261105(jsonb,jsonb)'::regprocedure);
  IF md5(replace(v_after,v_new,v_old))<>v_original_md5
   OR md5(v_after)=v_original_md5
   OR position('insert into public.players(user_id, name, sheet' IN lower(v_after))>0
   OR position('update public.players' IN lower(v_after))>0
   OR position('I2D_OPTION_A_PRIVATE_FORGE_LEGACY_FREEZE' IN v_after)=0
  THEN RAISE EXCEPTION 'I2-D private source mutated outside exact historical sheet UPSERT'; END IF;
  IF md5(pg_get_functiondef('public.create_player_character_v3(jsonb,jsonb,jsonb)'::regprocedure))<>v_v3_md5
    OR md5(pg_get_functiondef('private.create_player_character_v3_source_20261105(jsonb,jsonb,jsonb)'::regprocedure))<>v_priv_v3_md5
    OR md5(pg_get_functiondef('public.create_player_character_with_private_backstory_v1(jsonb,jsonb,jsonb,text)'::regprocedure))<>v_story_public_md5
    OR md5(pg_get_functiondef('private.create_player_character_v3_with_story_intent_i1c(jsonb,jsonb,jsonb,text)'::regprocedure))<>v_story_intent_md5
  THEN RAISE EXCEPTION 'I2-D public/private v3 Story or nonce call graph drift'; END IF;
  RAISE NOTICE 'I2-D original private source MD5=%; new candidate MD5=%; public v3 MD5=%',v_original_md5,md5(v_after),v_v3_md5;
END $i2d$;
echo 'PASS I2D-SOURCE: source-reversible private v2 account UPSERT retired in signed scratch; original public v3, private v3, Story/nonce wrappers unchanged'
