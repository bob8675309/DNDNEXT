-- I2J-V1 Option A source-locked scratch ONLY. Never run on hosted Supabase.
-- Requires signed disposable PG17 with exact ORIGINAL v1 plus #324 immutable
-- public v2 and original #351 Story intent. It changes ONE v1 account block.
-- Do not use old I2C source: I2C expects original public v2 and breaks #324.
\set ON_ERROR_STOP on
DO $i2j_v1$
DECLARE
 v_old text := '  update public.players set name=v_name,sheet=v_sheet,updated_at=now() where user_id=v_user;
  if not found then
    insert into public.players(user_id,name,sheet,updated_at) values(v_user,v_name,v_sheet,now());
  end if;';
 v_new text := 'insert into public.players(user_id,name)
  values(v_user, coalesce((select left(coalesce(
    nullif(btrim(u.raw_user_meta_data->>''character_name''),''''),
    nullif(btrim(u.raw_user_meta_data->>''display_name''),''''),
    nullif(btrim(split_part(coalesce(u.email,''''),''@'',1)),''''),
    ''New Player''),80) from auth.users u where u.id=v_user),''New Player''))
  on conflict (user_id) do nothing; /* I2J_V1_OPTION_A_IDENTITY_ONLY */';
 v_old_md5 constant text := 'e2db5802f1f51b93f5b9d374a835e4b9';
 v_signup_md5 constant text := 'dd7113eec05655a661309838acce6030';
 v_before text;
 v_after text;
 v_v2 text;
 v_v2_md5 text;
 v_v3_md5 text;
 v_private_v2_md5 text;
 v_public_story_md5 text;
 v_private_story_md5 text;
 v_signup_before text;
BEGIN
 IF current_database()<>'postgres'
    OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
    OR current_setting('application_name')<>'dndnext-i2j-v1-local'
    OR to_regclass('auth.users') IS NULL
    OR to_regclass('private.test_admins') IS NULL
    OR to_regclass('public.user_profiles') IS NULL
    OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
    OR to_regclass('public.character_backstory_secrets') IS NULL
    OR to_regprocedure('private.create_player_character_v2_source_20261105(jsonb,jsonb)') IS NULL
    OR to_regprocedure('private.create_player_character_v3_with_story_intent_i1c(jsonb,jsonb,jsonb,text)') IS NULL
 THEN RAISE EXCEPTION 'I2J-V1 refuses hosted, missing immutable/Story, or non-disposable PG17'; END IF;

 v_before := pg_get_functiondef('public.create_player_character_v1(jsonb,jsonb)'::regprocedure);
 v_v2 := pg_get_functiondef('public.create_player_character_v2(jsonb,jsonb)'::regprocedure);
 v_v2_md5 := md5(v_v2);
 v_v3_md5 := md5(pg_get_functiondef('public.create_player_character_v3(jsonb,jsonb,jsonb)'::regprocedure));
 v_private_v2_md5 := md5(pg_get_functiondef('private.create_player_character_v2_source_20261105(jsonb,jsonb)'::regprocedure));
 v_public_story_md5 := md5(pg_get_functiondef('public.create_player_character_with_private_backstory_v1(jsonb,jsonb,jsonb,text)'::regprocedure));
 v_private_story_md5 := md5(pg_get_functiondef('private.create_player_character_v3_with_story_intent_i1c(jsonb,jsonb,jsonb,text)'::regprocedure));
 v_signup_before := pg_get_functiondef('public.sync_user_profile()'::regprocedure);
 IF md5(v_before)<>v_old_md5
   OR md5(v_signup_before)<>v_signup_md5
   OR md5(pg_get_functiondef('private.starting_spell_requirements_v2(uuid)'::regprocedure))<>'878650d06e4b984ae7968359dda4d187'
   OR md5(pg_get_functiondef('public.character_source_priority_v1(text)'::regprocedure))<>'fdcc080cd95e6ce282631191869893c1'
   OR v_v2_md5='0351f0a00acae023278e1b8b065b00c9'
   OR position('private.reserve_player_creation_intent_v1' IN v_v2)=0
   OR position('private.create_player_character_v2_source_20261105' IN v_v2)=0
   OR v_private_v2_md5 NOT IN ('1d06d00eb4b4aa4c125796d761f5e259','00b2167041b9c2e4e1a98d3873839f37')
   OR v_v3_md5<>'ab48d46376075a79b3f5a5de21fdada6'
   OR v_public_story_md5<>'6e39477f971c9d40c6726c9f4dbc456e'
   OR v_private_story_md5<>'5fac54802474043d8233cc17a75f4c0f'
 THEN RAISE EXCEPTION 'I2J-V1 original v1, immutable v2/v3, private-v2, or Story source fingerprint drift'; END IF;

 IF length(v_before)-length(replace(v_before,v_old,''))<>length(v_old)
   OR position('IF NOT FOUND THEN' IN upper(v_before))=0
   OR position('I2J_V1_OPTION_A_IDENTITY_ONLY' IN v_before)>0
 THEN RAISE EXCEPTION 'I2J-V1 UPDATE + dependent IF/INSERT block missing or ambiguous'; END IF;

 -- Update just the original v1 account block, never public v2 or private copies.
 EXECUTE replace(v_before,v_old,v_new);
 v_after := pg_get_functiondef('public.create_player_character_v1(jsonb,jsonb)'::regprocedure);

 IF md5(replace(v_after,v_new,v_old))<>v_old_md5
    OR md5(v_after)=v_old_md5
    OR position('I2J_V1_OPTION_A_IDENTITY_ONLY' IN v_after)=0
    OR position('update public.players' IN lower(v_after))>0
    OR position('insert into public.players(user_id,name,sheet' IN lower(v_after))>0
    OR position('if not found then' IN lower(v_after))>0
 THEN RAISE EXCEPTION 'I2J-V1 altered more than the source-original dependent account block'; END IF;

 IF md5(pg_get_functiondef('public.create_player_character_v2(jsonb,jsonb)'::regprocedure))<>v_v2_md5
    OR md5(pg_get_functiondef('public.create_player_character_v3(jsonb,jsonb,jsonb)'::regprocedure))<>v_v3_md5
    OR md5(pg_get_functiondef('private.create_player_character_v2_source_20261105(jsonb,jsonb)'::regprocedure))<>v_private_v2_md5
    OR md5(pg_get_functiondef('public.create_player_character_with_private_backstory_v1(jsonb,jsonb,jsonb,text)'::regprocedure))<>v_public_story_md5
    OR md5(pg_get_functiondef('private.create_player_character_v3_with_story_intent_i1c(jsonb,jsonb,jsonb,text)'::regprocedure))<>v_private_story_md5
    OR pg_get_functiondef('public.sync_user_profile()'::regprocedure)<>v_signup_before
 THEN RAISE EXCEPTION 'I2J-V1 changed immutable Forge v2, private copied v2, v3, Story, or signup'; END IF;

 RAISE NOTICE 'I2J-V1 source-reversible original md5 %, scratch md5 %, immutable v2 unchanged %',
   v_old_md5, md5(v_after),v_v2_md5;
END $i2j_v1$;
\echo 'PASS I2J-V1 source-locked Option A identity-only scratch; public immutable v2, private v2, v3, Story, signup unchanged'
