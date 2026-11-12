-- I2-F: owner Option A sourceChoices/species runtime projection private helpers.
-- No-account-write scratch AFTER both source-original account-overwrite REDs.
-- DISPOSABLE PostgreSQL17 ONLY; not a hosted migration.
\set ON_ERROR_STOP on
DO $i2f$
DECLARE
  x record;
  v_source text;
  v_after text;
  v_tail text;
  v_new text := 'NULL; -- I2F_OPTION_A_NO_LEGACY_PROJECTION_WRITE';
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR to_regclass('private.test_admins') IS NULL
 OR md5(pg_get_functiondef('private.create_player_character_v2_source_20261105(jsonb,jsonb)'::regprocedure))<>'00b2167041b9c2e4e1a98d3873839f37'
 OR md5(pg_get_functiondef('public.create_player_character_v3(jsonb,jsonb,jsonb)'::regprocedure))<>'ab48d46376075a79b3f5a5de21fdada6'
 OR md5(pg_get_functiondef('public.sync_user_profile()'::regprocedure))<>'dd7113eec05655a661309838acce6030'
 THEN RAISE EXCEPTION 'I2F source candidate forbidden outside inherited signed isolated PG17'; END IF;

 FOR x IN SELECT * FROM (VALUES
  ('private.ensure_character_source_choices_v1(uuid)','69bedf66148d2ce3dab97baa5de606cc','    update public.players p set sheet=v_sheet,updated_at=now()
    where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);'),
  ('private.set_species_runtime_projection_v1(uuid,text,jsonb)','7f6e7d7d99ff79db1372462b4320c21b','  update public.players p set sheet=v_sheet,updated_at=now()
  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);')
 ) AS originals(signature,source_md5,account_update)
 LOOP
  v_source:=pg_get_functiondef(x.signature::regprocedure);
  IF md5(v_source)<>x.source_md5
    OR length(v_source)-length(replace(v_source,x.account_update,''))<>length(x.account_update)
    OR position('I2F_OPTION_A_NO_LEGACY_PROJECTION_WRITE' IN v_source)>0
  THEN RAISE EXCEPTION 'I2F original source/account UPDATE drift: %',x.signature; END IF;
  v_tail:=lower(substring(v_source from strpos(v_source,x.account_update)+length(x.account_update)));
  IF v_tail ~ '(if[[:space:]]+not[[:space:]]+found|if[[:space:]]+found|row_count|get[[:space:]]+diagnostics)'
  THEN RAISE EXCEPTION 'I2F original account UPDATE has downstream control dependency: %',x.signature; END IF;
  EXECUTE replace(v_source,x.account_update,v_new);
  v_after:=pg_get_functiondef(x.signature::regprocedure);
  IF md5(replace(v_after,v_new,x.account_update))<>x.source_md5
   OR md5(v_after)=x.source_md5
   OR position('update public.players' IN lower(v_after))>0
   OR position('I2F_OPTION_A_NO_LEGACY_PROJECTION_WRITE' IN v_after)=0
  THEN RAISE EXCEPTION 'I2F edited more than original account UPDATE: %',x.signature; END IF;
 END LOOP;

 IF has_function_privilege('authenticated','private.ensure_character_source_choices_v1(uuid)','EXECUTE')
 OR has_function_privilege('authenticated','private.set_species_runtime_projection_v1(uuid,text,jsonb)','EXECUTE')
 OR md5(pg_get_functiondef('private.create_player_character_v2_source_20261105(jsonb,jsonb)'::regprocedure))<>'00b2167041b9c2e4e1a98d3873839f37'
 OR md5(pg_get_functiondef('public.create_player_character_with_private_backstory_v1(jsonb,jsonb,jsonb,text)'::regprocedure))<>'6e39477f971c9d40c6726c9f4dbc456e'
 THEN RAISE EXCEPTION 'I2F touched private helper EXECUTE or original v3/Story source'; END IF;
END $i2f$;
\echo 'PASS I2F-SOURCE: exactly two original private projection account UPDATEs removed with single statement reverse-MD5 proof; authenticated cannot execute either directly'
