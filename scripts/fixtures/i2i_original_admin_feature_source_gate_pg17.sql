-- I2-I original-source signed Admin grant/feature sheet mirror RED test guard.
-- Works ONLY after existing unchanged P1.3 source Admin grant fixture in
-- disposable PG17+GoTrue. All canonical grant/helper source bodies unchanged.
\set ON_ERROR_STOP on
DO $i2i_source$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('private.p13_levelup_case_guard') IS NULL
 OR to_regclass('public.character_option_grants') IS NULL
 OR to_regclass('public.user_profiles') IS NULL
 OR to_regprocedure('public.grant_character_option_v1(uuid,uuid,text)') IS NULL
 OR md5(pg_get_functiondef('private.sync_admin_feature_array_v1(uuid,text,text,boolean)'::regprocedure))
     <> 'f2b6190ecc9400772e054892f63cdc47'
 OR md5(pg_get_functiondef('public.grant_character_option_v1(uuid,uuid,text)'::regprocedure))
     <> 'aa0f6a0c6c6a6f2b9aacf57bd40e434c'
 OR md5(pg_get_functiondef('private.current_user_is_admin()'::regprocedure))
     <> '1fc5fbcb121b2862eeab869edfb3a209'
 OR md5(pg_get_functiondef('private.guard_direct_character_authority_mutation_v1()'::regprocedure))
     <> '04596b0a3fdfb71c1b357056e8c6023b'
 OR md5(pg_get_functiondef('public.complete_character_level_up_v5(uuid,jsonb)'::regprocedure))
     <> '02d74b973a763c53c595be20e35e512f'
 THEN RAISE EXCEPTION 'I2-I refuses non-original source, absent grants or non-disposable PG17'; END IF;
 IF has_function_privilege('anon','public.grant_character_option_v1(uuid,uuid,text)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.grant_character_option_v1(uuid,uuid,text)','EXECUTE')
 THEN RAISE EXCEPTION 'I2-I original public Admin RPC role privileges mismatch'; END IF;
END $i2i_source$;
\echo 'PASS I2I-F01 real original Admin grant and private feature-array source/guard fingerprint gates installed, no mutation'
