-- I2-E OWNER OPTION A, first HP/Admin/Rage/action-state freeze candidate.
-- DISPOSABLE LOCAL PG17 ONLY, after exact original-source RED witnesses.
-- Changes ONLY the three original legacy account UPDATE statements; does
-- not change canonical sheet, combat/rage, progression, Story or permissions.
-- No hosted database, migrations, browser, deployment or merges.
\set ON_ERROR_STOP on
DO $i2e$
DECLARE
 x record; v_source text; v_after text;
 v_new text := 'NULL; -- I2E_OPTION_A_NO_LEGACY_SHEET_WRITE';
 v_tail text;
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR to_regclass('private.test_admins') IS NULL
 OR md5(pg_get_functiondef('private.create_player_character_v2_source_20261105(jsonb,jsonb)'::regprocedure))<>'00b2167041b9c2e4e1a98d3873839f37'
 OR md5(pg_get_functiondef('public.set_character_progression_v1(uuid,text,text,integer,bigint,text,text)'::regprocedure))<>'eb467b7c7a8d548581a36cfcb0d8f77b'
 THEN RAISE EXCEPTION 'I2-E requires ONLY signed source-original RED on held local Forge+Story/Option A scratch'; END IF;
 FOR x IN SELECT * FROM (VALUES
  ('public.adjust_character_hit_points_v1(uuid,integer,integer)','f855be60d971aa63e32ade327d14c369','  update public.players p
  set sheet=v_sheet,updated_at=now()
  where p.user_id in (
    select cp.user_id
    from public.character_permissions cp
    where cp.character_id=p_character_id and cp.can_edit
  );'),
  ('public.set_character_progression_v2(uuid,text,text,integer,bigint,text,text)','c4ea1c7993912f6b4c6fe9ee7b25343f','  update public.players p
  set sheet = v_sheet, updated_at = now()
  where p.user_id in (
    select cp.user_id
    from public.character_permissions cp
    where cp.character_id = p_character_id and cp.can_edit
  );'),
  ('public.update_character_sheet_action_state_v1(uuid,text,text)','313a533250724b2e2abc754899d0f8d4','  update public.players p
  set sheet=v_sheet,updated_at=now()
  where p.user_id in (
    select cp.user_id
    from public.character_permissions cp
    where cp.character_id=p_character_id and cp.can_edit
  );')
 ) AS src(signature,original_md5,original_account_update)
 LOOP
  v_source := pg_get_functiondef(x.signature::regprocedure);
  IF md5(v_source)<>x.original_md5
   OR length(v_source)-length(replace(v_source,x.original_account_update,''))<>length(x.original_account_update)
   OR position('I2E_OPTION_A_NO_LEGACY_SHEET_WRITE' IN v_source)>0
  THEN RAISE EXCEPTION 'I2E original live source/one exact UPDATE missing or changed: %',x.signature; END IF;
  -- The source audit verified the account UPDATE is followed only by a
  -- canonical return and no IF FOUND/ROW_COUNT-dependent logic.
  v_tail := lower(substring(v_source from strpos(v_source,x.original_account_update)+length(x.original_account_update)));
  IF v_tail ~ '(if[[:space:]]+not[[:space:]]+found|if[[:space:]]+found|row_count|get[[:space:]]+diagnostics)'
  THEN RAISE EXCEPTION 'I2E source has previously unseen post-account-UPDATE branch: %',x.signature; END IF;
  EXECUTE replace(v_source,x.original_account_update,v_new);
  v_after := pg_get_functiondef(x.signature::regprocedure);
  IF md5(replace(v_after,v_new,x.original_account_update))<>x.original_md5
   OR md5(v_after)=x.original_md5
   OR position('update public.players' IN lower(v_after))>0
   OR position('I2E_OPTION_A_NO_LEGACY_SHEET_WRITE' IN v_after)=0
  THEN RAISE EXCEPTION 'I2E non-account source drift or residual writer: %',x.signature; END IF;
 END LOOP;
 IF md5(pg_get_functiondef('public.set_character_progression_v1(uuid,text,text,integer,bigint,text,text)'::regprocedure))<>'eb467b7c7a8d548581a36cfcb0d8f77b'
 OR md5(pg_get_functiondef('public.create_player_character_v3(jsonb,jsonb,jsonb)'::regprocedure))<>'ab48d46376075a79b3f5a5de21fdada6'
 OR md5(pg_get_functiondef('public.create_player_character_with_private_backstory_v1(jsonb,jsonb,jsonb,text)'::regprocedure))<>'6e39477f971c9d40c6726c9f4dbc456e'
 THEN RAISE EXCEPTION 'I2-E changed original Admin-v1, modern v3 or Story/nonce wrappers'; END IF;
END $i2e$;
\echo 'PASS I2E-SOURCE: exactly 3 original account mirror UPDATE statements removed in isolated scratch, one-token reverse MD5 proved; canonical/Admin-v1/Story wrappers unchanged'
