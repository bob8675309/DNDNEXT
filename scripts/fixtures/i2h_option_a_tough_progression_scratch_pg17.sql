-- I2-H original Tough progression Option A: source-exact reversible scratch
-- Removes exactly ONE legacy UPDATE, only AFTER original Tough RED is proven.
-- Does not alter canonical HP/feat, class/level, editor auth or existing v5.
\set ON_ERROR_STOP on
DO $i2h_tough$
DECLARE
 v_original text;
 v_stmt text;
 v_after text;
 v_noop text := 'NULL; /* I2H_OPTION_A_NO_TOUGH_LEGACY_MIRROR */';
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('private.p13_levelup_case_guard') IS NULL
 OR to_regclass('public.character_option_grant_instances') IS NULL
 OR md5(pg_get_functiondef('public.complete_character_level_up_v5(uuid,jsonb)'::regprocedure))
     <> '02d74b973a763c53c595be20e35e512f'
 OR md5(pg_get_functiondef('private.apply_tough_progression_bonus_v1(uuid,integer)'::regprocedure))
     <> '2b8bca48b7067e2e67b66defcb7f2c10'
 OR position('I2H_INHERITED_BASE_V3_NO_LEGACY_MIRROR' in
       pg_get_functiondef('private.complete_character_level_up_base_v3(uuid,jsonb)'::regprocedure))=0
 OR position('I2H_INHERITED_CLASS_SUMMARY_NO_LEGACY_MIRROR' in
       pg_get_functiondef('private.sync_player_forge_class_spell_summary_v1(uuid)'::regprocedure))=0
 THEN RAISE EXCEPTION 'I2H Tough Option A scratch ONLY after original RED with inherited mirrors isolated'; END IF;
 v_original:=pg_get_functiondef('private.apply_tough_progression_bonus_v1(uuid,integer)'::regprocedure);
 v_stmt:=substring(v_original from $rx$update[[:space:]]+public[.]players[[:space:]]+p[[:space:]]+set[[:space:]]+sheet[[:space:]]*=[[:space:]]*v_sheet[[:space:]]*,[[:space:]]*updated_at[[:space:]]*=[[:space:]]*now[(][)][[:space:]]+where[[:space:]]+p[.]user_id[[:space:]]+in[[:space:]]*[(][^;]+;$rx$);
 IF v_stmt IS NULL OR (length(v_original)-length(replace(v_original,v_stmt,'')))/length(v_stmt)<>1
 THEN RAISE EXCEPTION 'I2H original Tough mirror statement not exactly once'; END IF;
 v_after:=replace(v_original,v_stmt,v_noop);
 IF md5(replace(v_after,v_noop,v_stmt))<>'2b8bca48b7067e2e67b66defcb7f2c10'
 THEN RAISE EXCEPTION 'I2H source reversible Tough original fingerprint missing'; END IF;
 EXECUTE v_after;
 IF position('I2H_OPTION_A_NO_TOUGH_LEGACY_MIRROR' in
      pg_get_functiondef('private.apply_tough_progression_bonus_v1(uuid,integer)'::regprocedure))=0
 OR position('update public.players' in
      lower(pg_get_functiondef('private.apply_tough_progression_bonus_v1(uuid,integer)'::regprocedure)))>0
 THEN RAISE EXCEPTION 'I2H source candidate must remove only Tough mirror'; END IF;
END $i2h_tough$;
