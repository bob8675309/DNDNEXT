-- Research only: source-exact original Wizard spells+level-1 counts observed read-only
-- from DnDWeb on 2026-11-06; zero production migrations or writes.
-- Install AFTER J154-J157, preserving original J00-J153/S001-S003 fixtures.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database() <> 'postgres'
 OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR to_regclass('public.class_catalog_preferred') IS NULL
 OR md5(pg_get_functiondef('private.validate_player_forge_starting_spells_v1()'::regprocedure))
       <> '6870e810de909209c44aecd02f5c72e2'
 OR NOT EXISTS(SELECT 1 FROM pg_trigger
     WHERE tgrelid='public.character_progression'::regclass
       AND tgname='character_progression_validate_player_forge_spells_v1'
       AND tgdeferrable AND tginitdeferred AND NOT tgisinternal)
 OR NOT EXISTS(SELECT 1 FROM public.class_catalog c
     WHERE c.id='00000000-0000-0000-0000-000000000002'::uuid
       AND c.class_key='wizard' AND c.source='XPHB' AND c.spellcasting_ability='int')
 OR (SELECT count(*) FROM public.class_level_progression
     WHERE class_id='00000000-0000-0000-0000-000000000002'::uuid AND class_level=1) <> 1
 THEN RAISE EXCEPTION 'Wizard scenarios require the unchanged J154 original deferred handler in disposable local PG17';
 END IF;
END $guard$;

-- Canonical XPHB Wizard level 1 live values: 3 cantrips, 4 prepared,
-- 2 level-1 slots. The ORIGINAL trigger calculates six spellbook selections.
-- Original reduced fixture has a synthetic Wizard class UUID; this local
-- row uses exact live progression values, not a new gameplay rule.
UPDATE public.class_level_progression
SET cantrips_known=3, spells_known=4,
    spell_slots='[2,0,0,0,0,0,0,0,0]'::jsonb
WHERE class_id='00000000-0000-0000-0000-000000000002'::uuid
  AND class_level=1;

-- Exact spell IDs/names/levels/classes/source captured via read-only SELECT
-- on public.spells_catalog (2026-11-06); synthetic old J00–J153 IDs remain
-- untouched. Only these 9 new source-identified records are used by Wizard tests.
INSERT INTO public.spells_catalog(id,name,level,classes,source)
VALUES
 ('fe27551a-bebb-4140-8dc0-2ab904f99955','Fire Bolt',0,ARRAY['Artificer','Sorcerer','Wizard']::text[],'XPHB'),
 ('4b84d266-3847-45f9-b154-77fd26695b55','Mage Hand',0,ARRAY['Artificer','Bard','Sorcerer','Warlock','Wizard']::text[],'XPHB'),
 ('38ccd26c-f6dc-4bcc-a86d-dc83fb61f177','Ray of Frost',0,ARRAY['Artificer','Sorcerer','Wizard']::text[],'XPHB'),
 ('d05171bc-855f-4e03-a074-c3f8f6fc09bf','Detect Magic',1,ARRAY['Artificer','Bard','Cleric','Druid','Paladin','Ranger','Sorcerer','Warlock','Wizard']::text[],'XPHB'),
 ('6c7a0380-a32a-4df5-871c-abf42400b045','Feather Fall',1,ARRAY['Artificer','Bard','Sorcerer','Wizard']::text[],'XPHB'),
 ('c9803497-bd5c-4800-aa79-01dbb80922fe','Mage Armor',1,ARRAY['Sorcerer','Wizard']::text[],'XPHB'),
 ('b975c0a7-8b4d-439b-85ff-3e0094656e2f','Magic Missile',1,ARRAY['Sorcerer','Wizard']::text[],'XPHB'),
 ('4d757f8f-88fd-4b6a-9bf2-b6d20788f928','Shield',1,ARRAY['Sorcerer','Wizard']::text[],'XPHB'),
 ('0fec723c-1a3a-42d9-bdfb-1d338c745676','Sleep',1,ARRAY['Bard','Sorcerer','Wizard']::text[],'XPHB');

DO $post$
BEGIN
 IF (SELECT count(*) FROM public.spells_catalog
     WHERE id = ANY(ARRAY[
       'fe27551a-bebb-4140-8dc0-2ab904f99955'::uuid,
       '4b84d266-3847-45f9-b154-77fd26695b55'::uuid,
       '38ccd26c-f6dc-4bcc-a86d-dc83fb61f177'::uuid,
       'd05171bc-855f-4e03-a074-c3f8f6fc09bf'::uuid,
       '6c7a0380-a32a-4df5-871c-abf42400b045'::uuid,
       'c9803497-bd5c-4800-aa79-01dbb80922fe'::uuid,
       'b975c0a7-8b4d-439b-85ff-3e0094656e2f'::uuid,
       '4d757f8f-88fd-4b6a-9bf2-b6d20788f928'::uuid,
       '0fec723c-1a3a-42d9-bdfb-1d338c745676'::uuid
     ])) <> 9
 OR NOT EXISTS(SELECT 1 FROM public.class_level_progression p
     WHERE p.class_id='00000000-0000-0000-0000-000000000002'::uuid
       AND p.class_level=1 AND p.cantrips_known=3 AND p.spells_known=4
       AND p.spell_slots='[2,0,0,0,0,0,0,0,0]'::jsonb)
 THEN RAISE EXCEPTION 'Local Wizard level1 progression/source catalog mismatch';
 END IF;
END $post$;
\echo 'PASS W158 live-source-identified XPHB Wizard level1 progression and 9 legal spell IDs staged after existing J157'
