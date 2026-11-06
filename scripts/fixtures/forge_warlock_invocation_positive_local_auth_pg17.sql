-- J109–J116 positive original XPHB Warlock Invocation acquisition.
-- Source-original live XPHB Warlock class, two option catalog specimens,
-- unchanged PG17 source slot-count/level helpers, disposable GoTrue database.
-- NEVER apply to production or staging. Only after J103–J108 PASS.
\set ON_ERROR_STOP on
DO $scope$
BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 OR to_regclass('private.test_admins') IS NULL
 OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR to_regclass('public.class_feature_option_catalog') IS NULL
 OR to_regclass('public.character_class_option_grant_instances') IS NULL
 OR to_regprocedure('public.create_player_character_v3(jsonb,jsonb,jsonb)') IS NULL
 OR EXISTS(SELECT 1 FROM public.class_catalog WHERE class_key='warlock')
 OR (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.character_progression'::regclass
   AND tgname IN ('character_progression_validate_player_forge_class_options_v1',
     'character_progression_materialize_player_forge_source_magic_v1',
     'character_progression_validate_player_forge_starting_magic_exac')
   AND tgdeferrable AND tginitdeferred)<>3
 OR md5(pg_get_functiondef('private.validate_and_materialize_player_forge_class_options_v1()'::regprocedure))
     <>'6df5aee6f0519c9c77758d6e887ed8e4'
 OR EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass
      AND conname='inventory_items_owner_type_chk')
 OR (SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass)<>4
 THEN RAISE EXCEPTION 'J109 Warlock fixture requires source-original J108 and disposable hardened PG17'; END IF;
END $scope$;

-- Real live read-only XPHB Warlock class row and B=10,000 copper starting cash.
INSERT INTO public.class_catalog (
 id,class_key,class_name,source,ruleset,hit_die,spellcasting_ability,raw_payload
) VALUES (
 '6792abd0-1fd9-44fb-ae4c-56c307ab791a','warlock','Warlock','XPHB','2024',8,'cha',
 '{"startingEquipment":{"defaultData":[{"A":[{"item":"Leather Armor|XPHB"},{"item":"Sickle|XPHB"},{"item":"Dagger|XPHB","quantity":2},{"item":"Orb|XPHB"},{"item":"Book|XPHB"},{"item":"Scholar''s Pack|XPHB"},{"value":1500}]},{"B":[{"value":10000}]}]}}'::jsonb
);
INSERT INTO public.class_level_progression(class_id,class_level,xp_threshold,proficiency_bonus,spell_slots)
VALUES ('6792abd0-1fd9-44fb-ae4c-56c307ab791a',1,0,2,'{}'::jsonb);

-- Source-original live catalog rows, read-only 2026-11-05; only these narrow
-- specimen options are imported, NOT all Invocation options or their spells.
INSERT INTO public.class_feature_option_catalog(
 id,option_key,option_type,name,source,class_key,prerequisites,
 repeatable,choice_schema,metadata,raw_payload
) VALUES
 (
 '3abe1beb-5669-46a8-9743-49a47b8de126',
 'optional-feature:armor-of-shadows|XPHB','eldritch-invocation',
 'Armor of Shadows','XPHB','warlock','{}'::jsonb,false,'{}'::jsonb,
 '{"sourceFile":"data/optionalfeatures.json","descriptionAuthority":"5etools:optionalfeature","descriptionReviewedAt":"2026-10-09","descriptionSourceFile":"data/optionalfeatures.json","descriptionSourceCommit":"8c026b807fac21862a309379a0c3228a0683198b"}'::jsonb,
 '{"normalizedFrom":"5etools_optionalfeature"}'::jsonb
 ),(
 '391a8820-aea1-495a-a532-05f9811b14d4',
 'optional-feature:devils-sight|XPHB','eldritch-invocation',
 'Devil''s Sight','XPHB','warlock','{"minClassLevel":2}'::jsonb,
 false,'{}'::jsonb,
 '{"sourceFile":"data/optionalfeatures.json","descriptionAuthority":"5etools:optionalfeature","descriptionReviewedAt":"2026-10-09","descriptionSourceFile":"data/optionalfeatures.json","descriptionSourceCommit":"8c026b807fac21862a309379a0c3228a0683198b"}'::jsonb,
 '{"normalizedFrom":"5etools_optionalfeature"}'::jsonb
 ),(
 'c6f61c62-d36c-4a9b-b44a-cbafd4ff47d0',
 'optional-feature:eldritch-mind|XPHB','eldritch-invocation',
 'Eldritch Mind','XPHB','warlock','{}'::jsonb,
 false,'{}'::jsonb,
 '{"sourceFile":"data/optionalfeatures.json","descriptionAuthority":"5etools:optionalfeature","descriptionReviewedAt":"2026-10-09","descriptionSourceFile":"data/optionalfeatures.json","descriptionSourceCommit":"8c026b807fac21862a309379a0c3228a0683198b"}'::jsonb,
 '{"normalizedFrom":"5etools_optionalfeature"}'::jsonb
 );

-- Source-original live Warlock slot progression: 1 invocation at level 1,
-- 3 at level 2. Both unchanged PG17 function definitions below.
\i scripts/fixtures/forge_warlock_invocation_original_slot_helpers_pg17.sql
DO $source$
DECLARE v_cash jsonb;
BEGIN
 IF md5(pg_get_functiondef('private.xphb_warlock_invocation_count_v1(integer)'::regprocedure))
       <> '61c83f0172b33386f0a50435c2fe1ddb'
 OR md5(pg_get_functiondef('private.xphb_warlock_invocation_slot_level_v1(integer)'::regprocedure))
       <> '942dd3a4e08b8874f3e42cbbb8323038'
 OR private.xphb_warlock_invocation_count_v1(1)<>1
 OR private.xphb_warlock_invocation_count_v1(2)<>3
 OR private.xphb_warlock_invocation_slot_level_v1(1)<>1
 OR (SELECT count(*) FROM public.class_feature_option_catalog
      WHERE option_type='eldritch-invocation' AND class_key='warlock' AND source='XPHB')<>3
 THEN RAISE EXCEPTION 'J109 original Warlock slots/catalog source mismatch'; END IF;
 SELECT private.player_forge_cash_equipment_option_v1(raw_payload #> '{startingEquipment,defaultData}')
 INTO v_cash FROM public.class_catalog WHERE class_key='warlock' AND source='XPHB';
 IF v_cash->>'key'<>'B' OR (v_cash->>'copper')::bigint<>10000
 THEN RAISE EXCEPTION 'J109 actual Warlock B cash option must be 100 gp'; END IF;
END $source$;
NOTIFY pgrst,'reload schema';
\echo 'PASS J109 original level-1 Warlock B=100gp cash, Armor of Shadows, Eldritch Mind, Devils Sight catalogs and exact slot functions installed'
