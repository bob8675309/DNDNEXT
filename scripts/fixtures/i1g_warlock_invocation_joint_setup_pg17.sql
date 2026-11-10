-- I1-G source-original Warlock invocation safeguards, disposable PG17+GoTrue.
-- ONLY a scoped contract fixture; no hosted/production database installation.
-- Requires I1-F signed DB; full Invocation acquisition materializer NOT installed.
\set ON_ERROR_STOP on
DO $safety$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR to_regprocedure('private.create_player_character_v3_with_story_intent_i1c(jsonb,jsonb,jsonb,text)') IS NULL
 OR to_regprocedure('private.materialize_player_forge_battle_master_maneuvers_v1()') IS NULL
 OR to_regclass('public.class_feature_option_catalog') IS NULL
 OR to_regclass('public.character_class_option_grant_instances') IS NULL
 OR to_regclass('public.character_option_catalog') IS NULL
 OR to_regclass('public.character_option_grant_instances') IS NULL
 OR to_regclass('private.player_forge_source_choice_legacy_v1') IS NOT NULL
 OR to_regprocedure('private.validate_existing_normalized_warlock_invocations_v2()') IS NOT NULL
 THEN RAISE EXCEPTION 'I1-G may only run on completed disposable I1-F PG17/GoTrue DB'; END IF;
END $safety$;

-- Exact read-only live XPHB Warlock class identity and starting equipment
-- defaultData, used by source-original class package B cash selection.
INSERT INTO public.class_catalog
(id,class_key,class_name,source,ruleset,hit_die,spellcasting_ability,raw_payload)
VALUES ('6792abd0-1fd9-44fb-ae4c-56c307ab791a','warlock','Warlock',
 'XPHB','2024',8,'cha',
 '{"startingEquipment":{"defaultData":[
 {"A":[{"item":"Leather Armor|XPHB"},{"item":"Sickle|XPHB"},
       {"item":"Dagger|XPHB","quantity":2},{"item":"Orb|XPHB"},
       {"item":"Book|XPHB"},{"item":"Scholar''s Pack|XPHB"},{"value":1500}]},
 {"B":[{"value":10000}]}]}}'::jsonb);
INSERT INTO public.class_level_progression(class_id,class_level,xp_threshold,proficiency_bonus,spell_slots)
VALUES
('6792abd0-1fd9-44fb-ae4c-56c307ab791a',1,0,2,'[1,0,0,0,0,0,0,0,0]'::jsonb),
('6792abd0-1fd9-44fb-ae4c-56c307ab791a',2,300,2,'[2,0,0,0,0,0,0,0,0]'::jsonb),
('6792abd0-1fd9-44fb-ae4c-56c307ab791a',5,6500,3,'[0,0,2,0,0,0,0,0,0]'::jsonb);

-- Production original private legacy compatibility table (same two columns
-- and key/FK). Internal bookkeeping, not an external player write endpoint.
CREATE TABLE private.player_forge_source_choice_legacy_v1 (
 character_id uuid PRIMARY KEY REFERENCES public.characters(id) ON DELETE CASCADE,
 recorded_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.player_forge_source_choice_legacy_v1 FROM PUBLIC,anon,authenticated;

-- The Battle Master original source fixture has minimal option/grant tables.
-- Expand only to columns REQUIRED by unchanged original Warlock validator.
ALTER TABLE public.class_feature_option_catalog
 ADD COLUMN repeatable boolean NOT NULL DEFAULT false,
 ADD COLUMN prerequisites jsonb NOT NULL DEFAULT '{}'::jsonb,
 ADD COLUMN choice_schema jsonb NOT NULL DEFAULT '{}'::jsonb;
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

-- Preferred-version spell API was a bounded one-version-per-id scratch check
-- in I1-C, not true source precedence. Add original field shape and two
-- source-grounded XPHB Warlock damage cantrips for required child checks.
ALTER TABLE public.spells_catalog
 ADD COLUMN damage_types text[],
 ADD COLUMN damage_dice text,
 ADD COLUMN attack_type text,
 ADD COLUMN range_unit text,
 ADD COLUMN range_distance numeric;
INSERT INTO public.spells_catalog
(id,name,level,classes,source,school,spell_key,damage_types,damage_dice,
 attack_type,range_unit,range_distance) VALUES
('47d3fd14-695b-4d54-a3fb-9c210ed59952','Eldritch Blast',0,ARRAY['Warlock'],'XPHB','Evocation','eldritch-blast',ARRAY['force'],'1d10','Ranged Spell Attack','feet',120),
('27d42a4f-4fbc-44c2-8f8c-e8d68978ef98','Poison Spray',0,ARRAY['Artificer','Druid','Sorcerer','Warlock','Wizard'],'XPHB','Necromancy','poison-spray',ARRAY['poison'],'1d12','Ranged Spell Attack','feet',30);

-- Deliberate scoped model for original Origin-feat child validation: original
-- Alert/Lucky XPHB identifiers; not the entire source-priority catalog, grant
-- authority/materializer or feat downstream trigger ecosystem.
ALTER TABLE public.character_option_catalog ADD COLUMN category text;
INSERT INTO public.character_option_catalog(id,option_type,name,source,category)
VALUES ('735de8f5-94b0-4052-a7b2-8ae15ac9a55c','feat','Alert','XPHB','O'),
       ('5003a12b-94e2-45db-bcc2-3eeff78c0587','feat','Lucky','XPHB','O');
CREATE VIEW public.character_option_catalog_preferred
 WITH (security_invoker=true) AS
 SELECT id,option_type,name,source,category
 FROM public.character_option_catalog WHERE source='XPHB';
REVOKE ALL ON public.character_option_catalog_preferred FROM PUBLIC,anon,authenticated;
-- I1-D already created a guard-only id uuid PRIMARY KEY stub for
-- original equipment helper dependencies. Extend that SAME empty scratch
-- table here; do not recreate or conceal the earlier I1-D fixture contract.
ALTER TABLE public.character_option_grant_instances
 ALTER COLUMN id SET DEFAULT gen_random_uuid(),
 ADD COLUMN character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
 ADD COLUMN acquisition_owner_type text NOT NULL,
 ADD COLUMN acquisition_owner_key text NOT NULL,
 ADD COLUMN option_id uuid NOT NULL REFERENCES public.character_option_catalog(id),
 ADD CONSTRAINT i1g_origin_owner_unique
  UNIQUE(character_id,acquisition_owner_type,acquisition_owner_key,option_id);
ALTER TABLE public.character_option_grant_instances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.character_option_grant_instances FROM PUBLIC,anon,authenticated;

\i scripts/fixtures/i1g_warlock_original_functions_pg17.sql
-- The two original Warlock triggers intentionally are not installed yet.
-- Signed character baseline specimens are created before the original
-- normalized UPDATE validator is switched on. This is not release proof of
-- full Warlock acquisition; phase2 tests that missing acquisition fails.
REVOKE ALL ON FUNCTION private.reject_unmarked_legacy_warlock_invocations_v1(),
 private.validate_existing_normalized_warlock_invocations_v2()
 FROM PUBLIC,anon,authenticated;
\echo 'PASS I1G-PREP: original Warlock source functions and reduced canonical catalogs ready; triggers explicitly held for signed baseline preparation'
