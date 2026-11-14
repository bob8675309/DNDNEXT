-- C34 T18 source-referential XPHB Warlock fixture; DISPOSABLE PG17 ONLY.
-- Class identity/starting-equipment JSON and all 16 option rows are exact
-- selections from preserved original held #355 source fixture, not invented.
-- Reduced starting-spell counts are test-only and NOT production entitlement.
\set ON_ERROR_STOP on
DO $t18_pre$
DECLARE n int;
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.player_forge_source_choice_legacy_v1') IS NULL
 OR to_regclass('public.character_class_option_grant_instances') IS NULL
 OR to_regclass('public.class_feature_option_catalog') IS NULL
 OR md5(pg_get_functiondef('private.materialize_player_forge_artificer_plans_v1()'::regprocedure))<>'67766989a466b82f170b5e00f9154e24'
 OR EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgname IN (
   'character_progression_reject_unmarked_legacy_warlock_invocation',
   'character_progression_validate_player_forge_class_options_v1',
   'character_progression_validate_player_forge_class_options_v2',
   'trg_force_depart_on_route_assign','trg_guard_locations_for_resting_and_camping'))
 THEN RAISE EXCEPTION 'T18 requires exact T17 disposable source; no Warlock/map triggers'; END IF;
 SELECT count(*) INTO n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
  WHERE NOT t.tgisinternal AND t.tgenabled='O'
    AND c.relname IN ('character_progression','character_sheets','characters','inventory_items');
 IF n<>29 THEN RAISE EXCEPTION 'T18 requires T17 26 originals +3 held, found %',n; END IF;
END $t18_pre$;
INSERT INTO public.class_catalog
(id,class_key,class_name,source,ruleset,hit_die,spellcasting_ability,raw_payload)
VALUES ('6792abd0-1fd9-44fb-ae4c-56c307ab791a','warlock','Warlock',
 'XPHB','2024',8,'cha',
 '{"startingEquipment":{"defaultData":[
 {"A":[{"item":"Leather Armor|XPHB"},{"item":"Sickle|XPHB"},
       {"item":"Dagger|XPHB","quantity":2},{"item":"Orb|XPHB"},
       {"item":"Book|XPHB"},{"item":"Scholar''s Pack|XPHB"},{"value":1500}]},
 {"B":[{"value":10000}]}]}}'::jsonb);

INSERT INTO public.class_level_progression(class_id,class_level,xp_threshold,proficiency_bonus,spell_slots) VALUES
 ('6792abd0-1fd9-44fb-ae4c-56c307ab791a',1,0,2,'[1,0,0,0,0,0,0,0,0]'::jsonb),
 ('6792abd0-1fd9-44fb-ae4c-56c307ab791a',2,300,2,'[2,0,0,0,0,0,0,0,0]'::jsonb),
 ('6792abd0-1fd9-44fb-ae4c-56c307ab791a',5,6500,3,'[0,0,2,0,0,0,0,0,0]'::jsonb);
-- Deliberately reduced spell count; real full source preference remains held.
UPDATE public.class_level_progression SET cantrips_known=2,spells_known=0
 WHERE class_id='6792abd0-1fd9-44fb-ae4c-56c307ab791a'::uuid
 AND class_level IN(1,2);
-- Existing verified spell IDs from prior source fixtures remain untouched
-- on conflict. Do NOT overwrite source rows to make tests pass.
-- Original acquisition/UPDATE guard reads spell attack/range fields not yet in
-- the T17 synthetic catalog; extend only the disposable table.
ALTER TABLE public.spells_catalog
 ADD COLUMN IF NOT EXISTS attack_type text,
 ADD COLUMN IF NOT EXISTS range_unit text,
 ADD COLUMN IF NOT EXISTS range_distance numeric;
INSERT INTO public.spells_catalog
(id,name,level,classes,source,school,damage_types,damage_dice,
 attack_type,range_unit,range_distance)
VALUES
('47d3fd14-695b-4d54-a3fb-9c210ed59952','Eldritch Blast',0,ARRAY['Warlock'],'XPHB','Evocation',ARRAY['force'],'1d10','Ranged Spell Attack','feet',120),
('27d42a4f-4fbc-44c2-8f8c-e8d68978ef98','Poison Spray',0,ARRAY['Artificer','Druid','Sorcerer','Warlock','Wizard'],'XPHB','Necromancy',ARRAY['poison'],'1d12','Ranged Spell Attack','feet',30)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.class_feature_option_catalog
(id,option_key,option_type,name,source,class_key,repeatable,prerequisites,choice_schema)
VALUES
 ('a0968ca9-deab-4bef-a8b0-05e11d4b3e0a','optional-feature:agonizing-blast|XPHB','eldritch-invocation','Agonizing Blast','XPHB','warlock',true,'{"minClassLevel":2}'::jsonb,'{"kind":"warlock-damage-cantrip","distinctPerRepeat":true}'::jsonb),
 ('3abe1beb-5669-46a8-9743-49a47b8de126','optional-feature:armor-of-shadows|XPHB','eldritch-invocation','Armor of Shadows','XPHB','warlock',false,'{}'::jsonb,'{}'::jsonb),
 ('0f21fa5b-ae68-41eb-8433-49af2fb36c04','optional-feature:ascendant-step|XPHB','eldritch-invocation','Ascendant Step','XPHB','warlock',false,'{"minClassLevel":5}'::jsonb,'{}'::jsonb),
 ('391a8820-aea1-495a-a532-05f9811b14d4','optional-feature:devils-sight|XPHB','eldritch-invocation','Devil''s Sight','XPHB','warlock',false,'{"minClassLevel":2}'::jsonb,'{}'::jsonb),
 ('c6f61c62-d36c-4a9b-b44a-cbafd4ff47d0','optional-feature:eldritch-mind|XPHB','eldritch-invocation','Eldritch Mind','XPHB','warlock',false,'{}'::jsonb,'{}'::jsonb),
 ('ccc193c4-3998-4cf4-90f6-01458628bd88','optional-feature:eldritch-smite|XPHB','eldritch-invocation','Eldritch Smite','XPHB','warlock',false,'{"minClassLevel":5,"requiresOptions":["Pact of the Blade"]}'::jsonb,'{}'::jsonb),
 ('ab97a286-3a59-4357-9078-007c66489a54','optional-feature:eldritch-spear|XPHB','eldritch-invocation','Eldritch Spear','XPHB','warlock',true,'{"minClassLevel":2}'::jsonb,'{"kind":"warlock-damage-cantrip","minRangeFeet":10,"distinctPerRepeat":true}'::jsonb),
 ('4b6c5d12-bed8-4300-af40-dbda401ab600','optional-feature:lessons-of-the-first-ones|XPHB','eldritch-invocation','Lessons of the First Ones','XPHB','warlock',true,'{"minClassLevel":2}'::jsonb,'{"kind":"origin-feat","category":"O","distinctPerRepeat":true}'::jsonb),
 ('132673fc-5a12-490b-be07-97a927085d82','optional-feature:mask-of-many-faces|XPHB','eldritch-invocation','Mask of Many Faces','XPHB','warlock',false,'{"minClassLevel":2}'::jsonb,'{}'::jsonb),
 ('7776f12d-eef4-47c6-a996-c1ddf45c5071','optional-feature:pact-of-the-blade|XPHB','eldritch-invocation','Pact of the Blade','XPHB','warlock',false,'{}'::jsonb,'{}'::jsonb),
 ('a4114f15-f182-438a-8736-686331954574','optional-feature:pact-of-the-chain|XPHB','eldritch-invocation','Pact of the Chain','XPHB','warlock',false,'{}'::jsonb,'{}'::jsonb),
 ('5d8cfed5-b802-4d78-8d09-236bd9b0f0ec','optional-feature:pact-of-the-tome|XPHB','eldritch-invocation','Pact of the Tome','XPHB','warlock',false,'{}'::jsonb,'{"runtimeChoice":"book-of-shadows-spells","replacementCadence":"short-or-long-rest"}'::jsonb),
 ('2384ee9a-e992-4964-ba87-8532b8af2145','optional-feature:repelling-blast|XPHB','eldritch-invocation','Repelling Blast','XPHB','warlock',true,'{"minClassLevel":2}'::jsonb,'{"kind":"warlock-attack-cantrip","distinctPerRepeat":true}'::jsonb),
 ('fef97334-9e07-4890-b6a2-37afa2103975','optional-feature:thirsting-blade|XPHB','eldritch-invocation','Thirsting Blade','XPHB','warlock',false,'{"minClassLevel":5,"requiresOptions":["Pact of the Blade"]}'::jsonb,'{}'::jsonb),
 ('4cde0908-47b1-4465-80bd-b21960d22f2c','optional-feature:fiendish-vigor|XPHB','eldritch-invocation','Fiendish Vigor','XPHB','warlock',false,'{"minClassLevel":2}'::jsonb,'{}'::jsonb),
 ('02473bd6-1159-490f-a8c5-7f8b3dfddf7d','optional-feature:misty-visions|XPHB','eldritch-invocation','Misty Visions','XPHB','warlock',false,'{"minClassLevel":2}'::jsonb,'{}'::jsonb);

DO $t18_catalog$
BEGIN
 IF (SELECT count(*) FROM public.class_feature_option_catalog
 WHERE option_type='eldritch-invocation' AND source='XPHB' AND class_key='warlock')<>16
 OR (SELECT count(*) FROM public.spells_catalog WHERE id IN
 ('47d3fd14-695b-4d54-a3fb-9c210ed59952','27d42a4f-4fbc-44c2-8f8c-e8d68978ef98'))<>2
 THEN RAISE EXCEPTION 'T18 source option/Warlock spell fixtures incomplete'; END IF;
END $t18_catalog$;
-- Both unchanged source-original guards installed BEFORE acquisition so the
-- separate signed RED must fail without the original source-owned grants.
\i scripts/integration/c34/sources/14_i1g_original_warlock_functions_pg17.sql
\i scripts/integration/c34/sources/16_i1g_original_warlock_safeguard_triggers_pg17.sql
\echo 'PASS C34 T18 staged original two Warlock guards and exact 16 source options; acquisition absent for signed RED'
