-- I2-C Option A ORIGINAL-SOURCE-CHECKED scratch-only creator account freeze.
-- Both original source REDs must be reproduced before installing this file.
-- v1 keeps 1-linked-character restriction and its exact original canonical
-- class/spells/grants; only legacy account UPDATE + FOUND/INSERT block replaced.
-- v2 preserves full original nonce/canonical source but avoids sheet UPSERT.
-- Signup original sync_user_profile() remains byte-identical.
\set ON_ERROR_STOP on
DO $i2c$
DECLARE x record;v_src text;v_new text;v_after text;
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR md5(pg_get_functiondef('public.sync_user_profile()'::regprocedure))<>'dd7113eec05655a661309838acce6030'
 OR to_regclass('public.user_profiles') IS NULL
 THEN RAISE EXCEPTION 'I2C Option A creator candidate requires original signup+signed Forge SCRATCH only'; END IF;
 v_new := 'insert into public.players(user_id,name)
  values(v_user, coalesce((select left(coalesce(
    nullif(btrim(u.raw_user_meta_data->>''character_name''),''''),
    nullif(btrim(u.raw_user_meta_data->>''display_name''),''''),
    nullif(btrim(split_part(coalesce(u.email,''''),''@'',1)),''''),
    ''New Player''),80) from auth.users u where u.id=v_user),''New Player''))
  on conflict (user_id) do nothing;';
 FOR x IN SELECT * FROM (VALUES
    ('public.create_player_character_v1(jsonb,jsonb)','e2db5802f1f51b93f5b9d374a835e4b9','  update public.players set name=v_name,sheet=v_sheet,updated_at=now() where user_id=v_user;
  if not found then
    insert into public.players(user_id,name,sheet,updated_at) values(v_user,v_name,v_sheet,now());
  end if;'),
    ('public.create_player_character_v2(jsonb,jsonb)','0351f0a00acae023278e1b8b065b00c9','insert into public.players(user_id, name, sheet, updated_at) values(v_user, v_name, v_sheet, now()) on conflict (user_id) do update set sheet = excluded.sheet, updated_at = now();')
 ) AS originals(sig,source_md5,original_block)
 LOOP
   v_src := pg_get_functiondef(x.sig::regprocedure);
   IF md5(v_src)<>x.source_md5
     OR length(v_src)-length(replace(v_src,x.original_block,''))<>length(x.original_block)
   THEN RAISE EXCEPTION 'I2C original create source drift or old account block ambiguous: %',x.sig; END IF;
   EXECUTE replace(v_src,x.original_block,v_new);
   v_after := pg_get_functiondef(x.sig::regprocedure);
   IF md5(replace(v_after,v_new,x.original_block))<>x.source_md5
      OR position('update public.players' IN lower(v_after))>0
      OR position('insert into public.players(user_id,name,sheet' IN lower(v_after))>0
   THEN RAISE EXCEPTION 'I2C candidate changed more than the 1 original account update/upsert: %',x.sig; END IF;
 END LOOP;
 IF md5(pg_get_functiondef('public.sync_user_profile()'::regprocedure))<>'dd7113eec05655a661309838acce6030'
   OR md5(pg_get_functiondef('private.starting_spell_requirements_v2(uuid)'::regprocedure))<>'878650d06e4b984ae7968359dda4d187'
   OR md5(pg_get_functiondef('public.character_source_priority_v1(text)'::regprocedure))<>'fdcc080cd95e6ce282631191869893c1'
 THEN RAISE EXCEPTION 'I2C original signup/spell helper source must not change'; END IF;
END $i2c$;
\echo 'PASS I2C-CANDIDATE: exact v1 historical UPDATE+FOUND branch and v2 sheet UPSERT replaced with identity-only insert, both original source MD5s reversible; signup original untouched'
