-- C34 T17 original held #360 I1-L Artificer Magic Item Plans SOURCE RED.
-- Original source blob 975d92fa5fef8f77e4fb690921ebba84113dfa41 unchanged.
-- Original six private functions and original deferred trigger below are exact.
-- This deliberately retains original legacy players.sheet mirror to reproduce.
-- Disposable signed PostgreSQL17/GoTrue/PostgREST ONLY; never production.
\set ON_ERROR_STOP on
DO $t17_pre$
DECLARE n integer;
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('public.class_feature_option_catalog') IS NULL
 OR to_regclass('public.character_class_option_grant_instances') IS NULL
 OR to_regclass('public.items_catalog') IS NULL
 OR md5(pg_get_functiondef('private.materialize_player_forge_wizard_final_v1()'::regprocedure))<>'3c71ad65cde45d74bef4ea63f25847ac'
 OR md5(pg_get_functiondef('private.materialize_player_forge_battle_master_maneuvers_v1()'::regprocedure))<>'daf3fc12e7c30165dca50ca650f9d308'
 OR to_regprocedure('private.materialize_player_forge_artificer_plans_v1()') IS NOT NULL
 OR EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgname IN
   ('trg_force_depart_on_route_assign','trg_guard_locations_for_resting_and_camping'))
 THEN RAISE EXCEPTION 'C34 T17 requires exact T16 disposable original source and excludes world map'; END IF;
 SELECT count(*) INTO n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O' AND c.relname IN
 ('character_progression','character_sheets','characters','inventory_items');
 IF n<>28 THEN RAISE EXCEPTION 'T17 expected 25 originals+3 held, got %',n; END IF;
END $t17_pre$;

-- T15 source-owned option table was intentionally narrowed to maneuver fields.
-- Add ONLY original Artificer helper dependencies in disposable local PG17.
ALTER TABLE public.class_feature_option_catalog
 ADD COLUMN repeatable boolean NOT NULL DEFAULT false,
 ADD COLUMN prerequisites jsonb NOT NULL DEFAULT '{}'::jsonb,
 ADD COLUMN choice_schema jsonb NOT NULL DEFAULT '{}'::jsonb;
-- T10 reduced class_catalog_preferred only admitted XPHB. Add real EFA source
-- for the original starting-spell authority validator without changing its body.
CREATE OR REPLACE VIEW public.class_catalog_preferred AS
 SELECT id,class_key,class_name,source,spellcasting_ability
 FROM public.class_catalog WHERE source IN ('XPHB','EFA');
-- Original EFA source class/progression and options below copied byte-for-byte.
INSERT INTO public.class_catalog(id,class_key,class_name,source,ruleset,hit_die,spellcasting_ability,raw_payload)
VALUES ('46ea4181-2a9c-4f4e-b886-e246b462ed44','artificer','Artificer','EFA','2014',8,'int',
'{"startingEquipment":{"defaultData":[{"A":[{"item":"Studded Leather Armor|XPHB"},{"item":"Dagger|XPHB"},{"item":"Thieves'' Tools|XPHB"},{"item":"Tinker''s Tools|XPHB"},{"item":"Dungeoneer''s Pack|XPHB"},{"value":1600}]},{"B":[{"value":15000}]}]}}'::jsonb);
INSERT INTO public.class_level_progression(class_id,class_level,xp_threshold,proficiency_bonus,spell_slots) VALUES
('46ea4181-2a9c-4f4e-b886-e246b462ed44',1,0,2,'[2,0,0,0,0]'::jsonb),
('46ea4181-2a9c-4f4e-b886-e246b462ed44',2,300,2,'[2,0,0,0,0]'::jsonb),
('46ea4181-2a9c-4f4e-b886-e246b462ed44',6,14000,3,'[4,2,0,0,0]'::jsonb);


-- C34 TEST-ONLY Artificer level2 starting-magic specimen: existing XPHB spell
-- IDs explicitly list Artificer among allowed classes. These 2 cantrips/2
-- spells-known are reduced integration parameters, NOT verified live EFA counts.
UPDATE public.class_level_progression
 SET cantrips_known=2,spells_known=2
 WHERE class_id='46ea4181-2a9c-4f4e-b886-e246b462ed44'::uuid AND class_level=2;

INSERT INTO public.class_feature_option_catalog
(id,option_key,option_type,name,source,class_key,repeatable,prerequisites,choice_schema) VALUES
 ('bee85784-f6cd-416d-9c0d-cb9f6fbdadaf','artificer-plan:1-shield|EFA','artificer-plan','+1 Shield','EFA','artificer',false,'{"minClassLevel":2}'::jsonb,'{}'::jsonb),
 ('c3e113c1-8f41-4028-9ca5-2f123c321818','artificer-plan:1-wand-of-the-war-mage|EFA','artificer-plan','+1 Wand of the War Mage','EFA','artificer',false,'{"minClassLevel":2}'::jsonb,'{}'::jsonb),
 ('f38fac21-028d-4314-a170-f1b171a9ed75','artificer-plan:1-weapon|EFA','artificer-plan','+1 Weapon','EFA','artificer',false,'{"minClassLevel":2}'::jsonb,'{}'::jsonb),
 ('cdd0e441-d773-4d01-90a4-c3e3e3e13b76','artificer-plan:1-wraps-of-unarmed-power|EFA','artificer-plan','+1 Wraps of Unarmed Power','EFA','artificer',false,'{"minClassLevel":2}'::jsonb,'{}'::jsonb),
 ('f8897bf9-5bb5-4e4f-8280-ad2a2e941112','artificer-plan:common-magic-item-that-isn-t-a-potion-a-scroll-or-cursed|EFA','artificer-plan','Common magic item that isn''t a Potion, a Scroll, or cursed','EFA','artificer',true,'{"minClassLevel":2}'::jsonb,'{"kind":"magic-item","rarity":"common","excludeTypes":["potion","scroll"],"excludeCursed":true,"distinctPerRepeat":true}'::jsonb),
 ('eda4194f-7d01-44e4-a78c-79f29b7a83e2','artificer-plan:1-armor|EFA','artificer-plan','+1 Armor','EFA','artificer',false,'{"minClassLevel":6}'::jsonb,'{}'::jsonb);


INSERT INTO public.items_catalog(id,item_key,item_name,item_type,item_rarity,payload) VALUES
 ('8adeb0df-1434-41f3-8702-1e1e3e0b5da7','Prosthetic Limb|XDMG','Prosthetic Limb','Wondrous Item','common','{"source":"XDMG","wondrous":"true"}'::jsonb),
 ('d0f8d472-b20f-402b-8405-b65a4330d348','Potion of Comprehension|XDMG','Potion of Comprehension','Potions & Poisons','common','{"source":"XDMG","type":"P|XPHB"}'::jsonb);


-- All source-owned row IDs above come unchanged from held #360; these
-- local XPHB/EFA preferred-class and level2 starting-magic parameters do not
-- prove production source catalog parity.
\echo 'PASS C34 T17 test-only real EFA Artificer source catalogue staged BEFORE original materializer'
