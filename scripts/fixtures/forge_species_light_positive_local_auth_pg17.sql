-- DNDNext J117–J124 positive original species Light Bearer source-magic.
-- Live read-only Aasimar trait/catalog and Light XPHB spell; exact original
-- support functions. DISPOSABLE Supabase PostgreSQL17 / GoTrue only.
-- Not a production migration or complete species catalog parity.
\set ON_ERROR_STOP on
DO $gate$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.test_admins') IS NULL
 OR to_regclass('public.character_option_catalog') IS NULL
 OR to_regclass('public.character_spells') IS NULL
 OR to_regprocedure('private.materialize_player_forge_source_magic_v1()') IS NULL
 OR to_regprocedure('public.create_player_character_v3(jsonb,jsonb,jsonb)') IS NULL
 OR EXISTS(SELECT 1 FROM public.character_option_catalog WHERE id='8a29f32a-0695-4aed-b968-9e1616c47a15')
 OR EXISTS(SELECT 1 FROM public.spells_catalog WHERE id='2b78bd2c-8d8f-4891-814d-a19631bb6b9f')
 OR EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass AND conname='inventory_items_owner_type_chk')
 OR (SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass)<>4
 OR (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.character_progression'::regclass
     AND tgname='character_progression_materialize_player_forge_source_magic_v1'
     AND tgenabled='O' AND tgdeferrable AND tginitdeferred)<>1
 OR md5(pg_get_functiondef('private.materialize_player_forge_source_magic_v1()'::regprocedure))
    <>'4c35eaab8dff7d3d15b64ed71881d4a6'
 THEN RAISE EXCEPTION 'J117 only after disposable JWT J116 original source + four-policy review candidate'; END IF;
END $gate$;

-- The original private upsert writes these optional live character_spells columns.
-- These 3 are missing from the PREVIOUS REDUCED TEST SCHEMA only.
ALTER TABLE public.character_spells
 ADD COLUMN uses_max integer, ADD COLUMN uses_remaining integer,
 ADD COLUMN recharge text;

-- Exact original private helper bodies, with MD5 verified below. The existing
-- reduced is_preferred_spell_version_v1 remains test-only: no claim of full
-- preferred spell catalog/version parity.
\i scripts/fixtures/forge_species_light_original_helpers_pg17.sql

DO $originals$
BEGIN
 IF md5(pg_get_functiondef('private.player_forge_best_casting_ability_v1(jsonb,text[],text)'::regprocedure))<>'3dce158c3dfe14ff6776855b1ead5022'
 OR md5(pg_get_functiondef('private.player_forge_json_spell_min_level_v1(jsonb,text,integer)'::regprocedure))<>'c6770a82adc7ee3b79151262474b7aed'
 OR md5(pg_get_functiondef('private.player_forge_species_spell_choice_limit_v1(jsonb)'::regprocedure))<>'c9bc6081a43c52c44c1cf192886456df'
 OR md5(pg_get_functiondef('private.player_forge_trait_has_spell_v1(jsonb,text)'::regprocedure))<>'deb38940c6249808a39aeb2380e09c16'
 OR md5(pg_get_functiondef('private.upsert_player_forge_source_magic_spell_v1(uuid,uuid,text,text,text,text,integer,text,jsonb)'::regprocedure))<>'2a880d642809146678bd391304d9777c'
 THEN RAISE EXCEPTION 'Original source-magic helper PG17 MD5 drift'; END IF;
END $originals$;

-- Exact live species ID/key/name/source and exact Light Bearer trait fragment.
-- Full metadata/raw species record intentionally NOT copied. The additional
-- spell source is the exact live XPHB Aasimar known-at-level-1 expression.
INSERT INTO public.character_option_catalog(
 id,option_key,option_type,name,source,category,metadata,raw_payload)
VALUES (
 '8a29f32a-0695-4aed-b968-9e1616c47a15',
 'species:aasimar|XPHB','species','Aasimar','XPHB','humanoid',
 jsonb_build_object('traits',jsonb_build_array('{"name":"Light Bearer","type":"entries","entries":["You know the {@spell Light|XPHB} cantrip. Charisma is your spellcasting ability for it."]}'::jsonb)),
 jsonb_build_object('additionalSpells','[{"known":{"1":["light|xphb#c"]},"ability":"cha"}]'::jsonb)
);

-- Source-original live XPHB Light spell ID/name/level/classes from DnDWeb.
INSERT INTO public.spells_catalog(id,name,level,classes,source,school,casting_time)
VALUES('2b78bd2c-8d8f-4891-814d-a19631bb6b9f','Light',0,
 ARRAY['Artificer','Bard','Cleric','Sorcerer','Wizard']::text[],
 'XPHB','Evocation','1 action');

DO $catalog$
DECLARE v_trait jsonb;
BEGIN
 SELECT t.value INTO v_trait FROM public.character_option_catalog o,
 LATERAL jsonb_array_elements(o.metadata->'traits') t(value)
 WHERE o.id='8a29f32a-0695-4aed-b968-9e1616c47a15'
  AND t.value->>'name'='Light Bearer';
 IF v_trait IS NULL OR NOT private.player_forge_trait_has_spell_v1(v_trait,'Light')
 OR private.player_forge_species_spell_choice_limit_v1(v_trait) IS NOT NULL
 OR private.player_forge_json_spell_min_level_v1(
   (SELECT raw_payload->'additionalSpells' FROM public.character_option_catalog
    WHERE id='8a29f32a-0695-4aed-b968-9e1616c47a15'),'Light',1)<>1
 OR (SELECT level FROM public.spells_catalog
     WHERE id='2b78bd2c-8d8f-4891-814d-a19631bb6b9f')<>0
 THEN RAISE EXCEPTION 'J117 source Light Bearer trait / actual XPHB Light cantrip failed'; END IF;
END $catalog$;
NOTIFY pgrst,'reload schema';
\echo 'PASS J117 original species magic 5 helper bodies and source Aasimar Light Bearer/Light catalog installed after hardened Forge'
