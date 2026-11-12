-- I2-I Option A scratch ONLY: remove one proven account-sheet mirror
-- from EXACT live-original private.sync_admin_feature_array_v1 source.
-- Only after ORIGINAL signed Admin grant RED. Not a production migration.
\set ON_ERROR_STOP on
DO $i2i_option$
DECLARE
 v_source text;
 v_stmt text;
 v_noop text := 'NULL; /* I2I_OPTION_A_NO_ADMIN_FEATURE_LEGACY_ACCOUNT_WRITE */';
 v_modified text;
 v_original_md5 constant text := 'f2b6190ecc9400772e054892f63cdc47';
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('private.p13_levelup_case_guard') IS NULL
 OR to_regclass('public.character_option_grants') IS NULL
 OR md5(pg_get_functiondef('private.sync_admin_feature_array_v1(uuid,text,text,boolean)'::regprocedure))
     <> v_original_md5
 OR md5(pg_get_functiondef('public.grant_character_option_v1(uuid,uuid,text)'::regprocedure))
     <> 'aa0f6a0c6c6a6f2b9aacf57bd40e434c'
 OR md5(pg_get_functiondef('private.guard_direct_character_authority_mutation_v1()'::regprocedure))
     <> '04596b0a3fdfb71c1b357056e8c6023b'
 THEN RAISE EXCEPTION 'I2I refuses scratch candidate outside original Admin signed RED local PG17'; END IF;

 v_source:=pg_get_functiondef('private.sync_admin_feature_array_v1(uuid,text,text,boolean)'::regprocedure);
 v_stmt:=E'update public.players p set sheet=v_sheet,updated_at=now()\n  where p.user_id in (select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);';
 IF (length(v_source)-length(replace(v_source,v_stmt,'')))/length(v_stmt)<>1
 THEN RAISE EXCEPTION 'I2I original Admin feature account mirror not uniquely matched'; END IF;
 v_modified:=replace(v_source,v_stmt,v_noop);
 IF md5(replace(v_modified,v_noop,v_stmt))<>v_original_md5
 THEN RAISE EXCEPTION 'I2I original helper not exactly recoverable'; END IF;
 EXECUTE v_modified;
 IF position('I2I_OPTION_A_NO_ADMIN_FEATURE_LEGACY_ACCOUNT_WRITE' IN
  pg_get_functiondef('private.sync_admin_feature_array_v1(uuid,text,text,boolean)'::regprocedure))=0
 OR position('update public.players' IN
  lower(pg_get_functiondef('private.sync_admin_feature_array_v1(uuid,text,text,boolean)'::regprocedure)))>0
 OR md5(pg_get_functiondef('public.grant_character_option_v1(uuid,uuid,text)'::regprocedure))
     <> 'aa0f6a0c6c6a6f2b9aacf57bd40e434c'
 THEN RAISE EXCEPTION 'I2I scratch candidate did not preserve original public RPC and remove only account write'; END IF;
END $i2i_option$;
\echo 'PASS I2I-F02 local one-statement exact source reversible Admin account mirror suppressed, original public RPC unchanged'
