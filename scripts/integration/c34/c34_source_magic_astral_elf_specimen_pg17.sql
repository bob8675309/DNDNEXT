-- C34 T11 source-identified AAG Astral Elf / Astral Fire reduced species fixture.
-- Original catalog option UUID, option_key, source, feature name and trait
-- entries captured SELECT-only on Nov 13 2026. Only ONE of seven original
-- species traits is loaded; this is not full species catalog acceptance.
-- The original source owns one legal cantrip selection among Dancing Lights,
-- Light, Sacred Flame. Spell UUID from read-only 2024 XPHB spells_catalog.
-- Never run on hosted Supabase; only insert into disposable signed PG17.
\set ON_ERROR_STOP on
DO $pre$
BEGIN
 IF current_database()<>'postgres'
  OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
  OR to_regprocedure('private.materialize_player_forge_source_magic_v1()') IS NOT NULL
  OR (SELECT count(*) FROM public.character_option_catalog
      WHERE id='8975a0f7-11b5-473b-99ab-f0daca25fb7d'::uuid)<>0
 THEN RAISE EXCEPTION 'C34 T11 Astral Fire RED specimen only before original materializer installation'; END IF;
END $pre$;
INSERT INTO public.character_option_catalog(id,option_key,option_type,name,source,category,metadata,raw_payload)
VALUES ('8975a0f7-11b5-473b-99ab-f0daca25fb7d'::uuid,'species:astral-elf|AAG','species','Astral Elf','AAG',NULL,
 '{"traits":[{"name":"Astral Fire","type":"entries","entries":["You know one of the following cantrips of your choice: {@spell dancing lights}, {@spell light}, or {@spell sacred flame}. Intelligence, Wisdom, or Charisma is your spellcasting ability for it (choose when you select this race)."]}]}'::jsonb,'{}'::jsonb);
INSERT INTO public.spells_catalog(id,name,level,classes,source)
VALUES ('b466a340-f327-43e8-a4fe-c641f5fba2db'::uuid,'Sacred Flame',0,ARRAY['Cleric']::text[],'XPHB');
DO $post$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.character_option_catalog
   WHERE id='8975a0f7-11b5-473b-99ab-f0daca25fb7d'::uuid
    AND source='AAG' AND option_type='species'
    AND metadata->'traits'->0->>'name'='Astral Fire'
    AND metadata->'traits'->0->'entries'->>0 LIKE '%{@spell sacred flame}%')
 OR NOT EXISTS (SELECT 1 FROM public.spells_catalog
   WHERE id='b466a340-f327-43e8-a4fe-c641f5fba2db'::uuid
    AND name='Sacred Flame' AND level=0 AND source='XPHB'
    AND classes=ARRAY['Cleric']::text[])
 THEN RAISE EXCEPTION 'C34 T11 original Astral Fire/source-identified cantrip specimen mismatch'; END IF;
END $post$;
\echo 'PASS C34 T11 source-identified reduced AAG Astral Elf feature and XPHB Sacred Flame specimen'
