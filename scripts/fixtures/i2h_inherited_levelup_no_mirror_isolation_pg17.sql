-- I2-H inherited I2-B source writers: reversible local no-mirror isolation.
-- This eliminates TWO ALREADY COVERED original account mirrors from the
-- public v5->v4->v3->base chain BEFORE studying ORIGINAL Tough's new RED.
-- The inherited I2-F and I2-G signed acceptance runs independently first.
-- Never install on hosted/production PostgreSQL; this is disposable PG17.
\set ON_ERROR_STOP on
DO $i2h_inherited$
DECLARE
 r record;
 v_source text;
 v_stmt text;
 v_after text;
 v_reversed text;
 v_noop text;
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('private.p13_levelup_case_guard') IS NULL
 OR to_regclass('public.character_option_grant_instances') IS NULL
 OR md5(pg_get_functiondef('public.complete_character_level_up_v5(uuid,jsonb)'::regprocedure))
     <> '02d74b973a763c53c595be20e35e512f'
 OR md5(pg_get_functiondef('private.apply_tough_progression_bonus_v1(uuid,integer)'::regprocedure))
     <> '2b8bca48b7067e2e67b66defcb7f2c10'
 THEN RAISE EXCEPTION 'I2H inherited isolation requires exact original Tough in disposable P1.3 local PG17'; END IF;

 FOR r IN SELECT * FROM (VALUES
 ('private.complete_character_level_up_base_v3(uuid,jsonb)',
  'e33639d549ef557976a3970ea51f5238','BASE_V3'),
 ('private.sync_player_forge_class_spell_summary_v1(uuid)',
  '5b1b275a268a57591a2e35a05ce7480d','CLASS_SUMMARY')
 ) AS x(signature,expected_md5,marker)
 LOOP
   v_source:=pg_get_functiondef(r.signature::regprocedure);
   IF md5(v_source)<>r.expected_md5
   THEN RAISE EXCEPTION 'I2H inherited original-source drift in %',r.signature; END IF;
   v_stmt:=substring(v_source from $rx$update[[:space:]]+public[.]players[[:space:]]+p[[:space:]]+set[[:space:]]+sheet[[:space:]]*=[[:space:]]*v_sheet[[:space:]]*,[[:space:]]*updated_at[[:space:]]*=[[:space:]]*now[(][)][[:space:]]+where[[:space:]]+p[.]user_id[[:space:]]+in[[:space:]]*[(][^;]+;$rx$);
   IF v_stmt IS NULL OR (length(v_source)-length(replace(v_source,v_stmt,'')))/length(v_stmt)<>1
   THEN RAISE EXCEPTION 'I2H inherited original account writer not exactly once in %',r.signature; END IF;
   v_noop:='NULL; /* I2H_INHERITED_'||r.marker||'_NO_LEGACY_MIRROR */';
   v_after:=replace(v_source,v_stmt,v_noop);
   v_reversed:=replace(v_after,v_noop,v_stmt);
   IF md5(v_reversed)<>r.expected_md5
   THEN RAISE EXCEPTION 'I2H inherited local source cannot recover original exact MD5 for %',r.signature; END IF;
   EXECUTE v_after;
   IF position(v_noop in pg_get_functiondef(r.signature::regprocedure))=0
   THEN RAISE EXCEPTION 'I2H inherited isolation did not install %',r.signature; END IF;
 END LOOP;
 IF md5(pg_get_functiondef('public.complete_character_level_up_v5(uuid,jsonb)'::regprocedure))
     <> '02d74b973a763c53c595be20e35e512f'
 OR md5(pg_get_functiondef('private.apply_tough_progression_bonus_v1(uuid,integer)'::regprocedure))
     <> '2b8bca48b7067e2e67b66defcb7f2c10'
 THEN RAISE EXCEPTION 'I2H inherited isolation changed live-original public v5 or new Tough source'; END IF;
END $i2h_inherited$;
