-- I2-G: Option A scratch-only removal of ONE legacy account UPDATE
-- from original public.complete_character_level_up_v1(uuid,jsonb).
-- Run AFTER signed original source RED, in disposable PG17 only.
\set ON_ERROR_STOP on
DO $i2g$
DECLARE
  v_source text;
  v_after text;
  v_statement text;
  v_noop text := 'NULL; -- I2G_OPTION_A_NO_LEGACY_LEVELUP_V1_WRITE';
  v_original text;
BEGIN
  IF current_database()<>'postgres'
    OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
    OR to_regclass('private.p13_levelup_case_guard') IS NULL
    OR to_regclass('auth.users') IS NULL
    OR md5(pg_get_functiondef('public.complete_character_level_up_v1(uuid,jsonb)'::regprocedure))
        <> '1500703592c3cb8e1738126eac508e6a'
    OR md5(pg_get_functiondef('public.complete_character_level_up_v5(uuid,jsonb)'::regprocedure))
        <> '02d74b973a763c53c595be20e35e512f'
  THEN RAISE EXCEPTION 'I2G no-mirror candidate requires original-source RED in isolated P1.3 PG17'; END IF;
  v_source := pg_get_functiondef('public.complete_character_level_up_v1(uuid,jsonb)'::regprocedure);
  v_statement := E'update public.players p set sheet=v_sheet,updated_at=now()\n  where p.user_id in (select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);';
  IF (length(v_source)-length(replace(v_source,v_statement,'')))/length(v_statement)<>1
  THEN RAISE EXCEPTION 'I2G expected exactly one original account mirror write'; END IF;
  v_after := replace(v_source,v_statement,v_noop);
  v_original := replace(v_after,v_noop,v_statement);
  IF md5(v_original)<>md5(v_source)
  THEN RAISE EXCEPTION 'I2G source text not reversible'; END IF;
  EXECUTE v_after;
  IF position('I2G_OPTION_A_NO_LEGACY_LEVELUP_V1_WRITE' IN
     pg_get_functiondef('public.complete_character_level_up_v1(uuid,jsonb)'::regprocedure))=0
  THEN RAISE EXCEPTION 'I2G scratch replacement missing'; END IF;
END $i2g$;
