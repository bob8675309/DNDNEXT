-- T12 reduced *read-only-source-identified* XPHB spell IDs.
-- Original XPHB Elf and EFA Khoravar IDs verified live read only on Nov 13 2026:
-- Elf 6e4e3cc8-ed5f-4f81-8232-600c83beeec8 (XPHB)
-- Khoravar bf50a82c-7111-45e1-90a6-cd4c5ab2f462 (EFA)
-- These species IDs are source evidence; the original runtime resolver reads
-- signed character sheets, not a new permissive species-option reimplementation.
-- Reduced 5/complete spell catalog; NEVER a production migration.
\set ON_ERROR_STOP on
DO $t12_spec_pre$
BEGIN
 IF current_database()<>'postgres'
  OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
  OR to_regprocedure('private.materialize_player_forge_species_replaceable_cantrip_v1()') IS NOT NULL
  OR EXISTS(SELECT 1 FROM public.spells_catalog
      WHERE id IN ('5f62b543-f6ac-405f-baa8-1f196190ff35'::uuid,'c667b8ab-a44e-4c23-a8ea-b03f8953fc18'::uuid,'ae30c048-8519-4160-9848-5527c8d5071e'::uuid,'6c1e5836-c741-41e6-aecd-57b61ee5b59c'::uuid,'47d3fd14-695b-4d54-a3fb-9c210ed59952'::uuid))
 THEN RAISE EXCEPTION 'C34 T12 source-identified fixed cantrip specimens require T11 baseline before T12'; END IF;
END $t12_spec_pre$;
-- T11 source-only spells_catalog already has source, level, classes;
-- title/description additions belong exclusively to the T12 adapter.
ALTER TABLE public.spells_catalog ADD COLUMN description text;
INSERT INTO public.spells_catalog(id,name,level,classes,source,description)
VALUES
('5f62b543-f6ac-405f-baa8-1f196190ff35'::uuid,'Prestidigitation',0,ARRAY['Artificer','Bard','Sorcerer','Warlock','Wizard'], 'XPHB','2024 XPHB source-identified reduced fixture'),
('c667b8ab-a44e-4c23-a8ea-b03f8953fc18'::uuid,'Friends',0,ARRAY['Bard','Sorcerer','Warlock','Wizard'], 'XPHB','2024 XPHB source-identified reduced fixture'),
('ae30c048-8519-4160-9848-5527c8d5071e'::uuid,'Acid Splash',0,ARRAY['Artificer','Sorcerer','Wizard'], 'XPHB','2024 XPHB source-identified reduced fixture'),
('6c1e5836-c741-41e6-aecd-57b61ee5b59c'::uuid,'Druidcraft',0,ARRAY['Druid'], 'XPHB','2024 XPHB source-identified reduced fixture'),
('47d3fd14-695b-4d54-a3fb-9c210ed59952'::uuid,'Eldritch Blast',0,ARRAY['Warlock'], 'XPHB','2024 XPHB source-identified reduced fixture');
DO $t12_spec_post$
BEGIN
 IF (SELECT count(*) FROM public.spells_catalog
   WHERE id IN ('5f62b543-f6ac-405f-baa8-1f196190ff35'::uuid,'c667b8ab-a44e-4c23-a8ea-b03f8953fc18'::uuid,'ae30c048-8519-4160-9848-5527c8d5071e'::uuid,'6c1e5836-c741-41e6-aecd-57b61ee5b59c'::uuid,'47d3fd14-695b-4d54-a3fb-9c210ed59952'::uuid))<>5
 OR NOT EXISTS(SELECT 1 FROM public.spells_catalog WHERE name='Prestidigitation'
     AND source='XPHB' AND 'Wizard'=ANY(classes))
 OR NOT EXISTS(SELECT 1 FROM public.spells_catalog WHERE name='Friends'
     AND source='XPHB' AND 'Wizard'=ANY(classes))
 THEN RAISE EXCEPTION 'C34 T12 live-source fixed cantrip specimen mismatch'; END IF;
END $t12_spec_post$;
\echo 'PASS T12 reduced XPHB source cantrip specimens from read-only live catalog'
