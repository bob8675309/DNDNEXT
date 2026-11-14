-- C34 T16 disposable ONLY: reduced source-owned Wizard school/starting spell catalog.
-- Original held #353 I1-E synthetic Evoker/Savant nine spell records are reused
-- EXACTLY as source originals; T16 additional starting-spell test rows are
-- explicitly SYNTHETIC, not claims about live D&D spell catalog identity.
-- NO production migrations, no account writer or changed source functions.
\set ON_ERROR_STOP on
DO $t16cat_pre$
DECLARE v_count int;
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('public.class_feature_catalog') IS NULL
 OR to_regclass('public.spells_catalog_preferred') IS NULL
 OR to_regclass('public.character_class_option_grant_instances') IS NULL
 OR to_regprocedure('private.materialize_player_forge_battle_master_maneuvers_v1()') IS NULL
 OR to_regprocedure('private.materialize_player_forge_wizard_final_v1()') IS NOT NULL
 OR to_regprocedure('private.apply_wizard_signature_spell_ids_v1(uuid,jsonb,text,text)') IS NOT NULL
 THEN RAISE EXCEPTION 'T16 requires intact local T15 signed source baseline'; END IF;
 SELECT count(*) INTO v_count FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O' AND c.relname IN
 ('character_progression','character_sheets','characters','inventory_items');
 IF v_count<>27 THEN RAISE EXCEPTION 'T16 expected 24 originals+3 held before Wizard source, got %',v_count; END IF;
END $t16cat_pre$;

ALTER TABLE public.spells_catalog
 ADD COLUMN IF NOT EXISTS school text,
 ADD COLUMN IF NOT EXISTS spell_key text;
ALTER TABLE public.character_spells
 ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS character_spells_c34_t16_id_unique ON public.character_spells(id);
-- T12 preferred-version predicate is unchanged; the reduced VIEW is refreshed
-- only to include source-original Wizard-required school/spell_key columns.
CREATE OR REPLACE VIEW public.spells_catalog_preferred AS
 SELECT s.* FROM public.spells_catalog s WHERE public.is_preferred_spell_version_v1(s.id);
REVOKE ALL ON TABLE public.spells_catalog_preferred FROM PUBLIC,anon;
INSERT INTO public.class_level_progression
(class_id,class_level,xp_threshold,proficiency_bonus,spell_slots,cantrips_known,spells_known)
VALUES
('00000000-0000-0000-0000-000000000002',3,900,2,'[4,2,0,0,0,0,0,0,0]'::jsonb,3,6),
('00000000-0000-0000-0000-000000000002',20,355000,6,'[4,3,3,3,3,2,2,1,1]'::jsonb,5,22);
-- I1-E original reduced source-IDENTIFIED Evoker subclass + Savant/Signature
-- labels; original T4 source-qualified Fighter metadata remains untouched.
INSERT INTO public.class_feature_catalog
(id,feature_key,feature_type,name,source,class_key,class_name,class_source,
 subclass_name,subclass_short_name,level,raw_payload)
VALUES
('00000000-0000-0000-0000-000000008803','subclass:wizard:xphb:evoker:evoker:xphb:3',
 'subclass','Evoker','XPHB','wizard','Wizard','XPHB','Evoker','Evoker',3,'{}'::jsonb),
('00000000-0000-0000-0000-000000016081','subclass:wizard:xphb:evoker:evocation-savant:3',
 'subclass','Evocation Savant','XPHB','wizard','Wizard','XPHB','Evoker','Evoker',3,'{}'::jsonb),
('00000000-0000-0000-0000-000000016082','subclass:wizard:xphb:evoker:signature-spells:20',
 'subclass','Signature Spells','XPHB','wizard','Wizard','XPHB','Evoker','Evoker',20,'{}'::jsonb);
-- The following 9 names/IDs are copied exactly from original I1-E held
-- signed fixture. They are SYNTHETIC I1-E test spells, not production IDs.
INSERT INTO public.spells_catalog(id,name,level,classes,source,school,spell_key) VALUES
('00000000-0000-0000-0000-000000008811','I1E Ember Pin',1,ARRAY['Wizard'],'XPHB','Evocation','i1e-ember-pin'),
('00000000-0000-0000-0000-000000008812','I1E Arc Flame',2,ARRAY['Wizard'],'XPHB','Evocation','i1e-arc-flame'),
('00000000-0000-0000-0000-000000008813','I1E Ember Burst',3,ARRAY['Wizard'],'XPHB','Evocation','i1e-ember-burst'),
('00000000-0000-0000-0000-000000008814','I1E Arc Wave',3,ARRAY['Wizard'],'XPHB','Evocation','i1e-arc-wave'),
('00000000-0000-0000-0000-000000008815','I1E Heat Line',4,ARRAY['Wizard'],'XPHB','Evocation','i1e-heat-line'),
('00000000-0000-0000-0000-000000008816','I1E Star Shard',5,ARRAY['Wizard'],'XPHB','Evocation','i1e-star-shard'),
('00000000-0000-0000-0000-000000008817','I1E Red Spiral',6,ARRAY['Wizard'],'XPHB','Evocation','i1e-red-spiral'),
('00000000-0000-0000-0000-000000008818','I1E Dawn Burst',7,ARRAY['Wizard'],'XPHB','Evocation','i1e-dawn-burst'),
('00000000-0000-0000-0000-000000008819','I1E Solar Lance',8,ARRAY['Wizard'],'XPHB','Evocation','i1e-solar-lance');
-- 44 SPECIMEN starting Wizard spellbook entries and 2 cantrips are generated
-- locally to satisfy the UNMODIFIED source-level Wizard level 3/20 count guard.
-- They must never be construed as real live source/entitlement IDs.
INSERT INTO public.spells_catalog(id,name,level,classes,source,school,spell_key) VALUES
('00000000-0000-0000-0000-000000016001','T16 Synthetic Wizard Spell 01',1,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-1'),
('00000000-0000-0000-0000-000000016002','T16 Synthetic Wizard Spell 02',1,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-2'),
('00000000-0000-0000-0000-000000016003','T16 Synthetic Wizard Spell 03',1,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-3'),
('00000000-0000-0000-0000-000000016004','T16 Synthetic Wizard Spell 04',1,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-4'),
('00000000-0000-0000-0000-000000016005','T16 Synthetic Wizard Spell 05',1,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-5'),
('00000000-0000-0000-0000-000000016006','T16 Synthetic Wizard Spell 06',1,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-6'),
('00000000-0000-0000-0000-000000016007','T16 Synthetic Wizard Spell 07',2,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-7'),
('00000000-0000-0000-0000-000000016008','T16 Synthetic Wizard Spell 08',2,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-8'),
('00000000-0000-0000-0000-000000016009','T16 Synthetic Wizard Spell 09',2,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-9'),
('00000000-0000-0000-0000-000000016010','T16 Synthetic Wizard Spell 10',2,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-10'),
('00000000-0000-0000-0000-000000016011','T16 Synthetic Wizard Spell 11',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-11'),
('00000000-0000-0000-0000-000000016012','T16 Synthetic Wizard Spell 12',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-12'),
('00000000-0000-0000-0000-000000016013','T16 Synthetic Wizard Spell 13',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-13'),
('00000000-0000-0000-0000-000000016014','T16 Synthetic Wizard Spell 14',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-14'),
('00000000-0000-0000-0000-000000016015','T16 Synthetic Wizard Spell 15',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-15'),
('00000000-0000-0000-0000-000000016016','T16 Synthetic Wizard Spell 16',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-16'),
('00000000-0000-0000-0000-000000016017','T16 Synthetic Wizard Spell 17',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-17'),
('00000000-0000-0000-0000-000000016018','T16 Synthetic Wizard Spell 18',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-18'),
('00000000-0000-0000-0000-000000016019','T16 Synthetic Wizard Spell 19',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-19'),
('00000000-0000-0000-0000-000000016020','T16 Synthetic Wizard Spell 20',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-20'),
('00000000-0000-0000-0000-000000016021','T16 Synthetic Wizard Spell 21',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-21'),
('00000000-0000-0000-0000-000000016022','T16 Synthetic Wizard Spell 22',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-22'),
('00000000-0000-0000-0000-000000016023','T16 Synthetic Wizard Spell 23',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-23'),
('00000000-0000-0000-0000-000000016024','T16 Synthetic Wizard Spell 24',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-24'),
('00000000-0000-0000-0000-000000016025','T16 Synthetic Wizard Spell 25',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-25'),
('00000000-0000-0000-0000-000000016026','T16 Synthetic Wizard Spell 26',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-26'),
('00000000-0000-0000-0000-000000016027','T16 Synthetic Wizard Spell 27',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-27'),
('00000000-0000-0000-0000-000000016028','T16 Synthetic Wizard Spell 28',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-28'),
('00000000-0000-0000-0000-000000016029','T16 Synthetic Wizard Spell 29',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-29'),
('00000000-0000-0000-0000-000000016030','T16 Synthetic Wizard Spell 30',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-30'),
('00000000-0000-0000-0000-000000016031','T16 Synthetic Wizard Spell 31',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-31'),
('00000000-0000-0000-0000-000000016032','T16 Synthetic Wizard Spell 32',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-32'),
('00000000-0000-0000-0000-000000016033','T16 Synthetic Wizard Spell 33',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-33'),
('00000000-0000-0000-0000-000000016034','T16 Synthetic Wizard Spell 34',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-34'),
('00000000-0000-0000-0000-000000016035','T16 Synthetic Wizard Spell 35',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-35'),
('00000000-0000-0000-0000-000000016036','T16 Synthetic Wizard Spell 36',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-36'),
('00000000-0000-0000-0000-000000016037','T16 Synthetic Wizard Spell 37',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-37'),
('00000000-0000-0000-0000-000000016038','T16 Synthetic Wizard Spell 38',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-38'),
('00000000-0000-0000-0000-000000016039','T16 Synthetic Wizard Spell 39',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-39'),
('00000000-0000-0000-0000-000000016040','T16 Synthetic Wizard Spell 40',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-40'),
('00000000-0000-0000-0000-000000016041','T16 Synthetic Wizard Spell 41',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-41'),
('00000000-0000-0000-0000-000000016042','T16 Synthetic Wizard Spell 42',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-42'),
('00000000-0000-0000-0000-000000016043','T16 Synthetic Wizard Spell 43',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-43'),
('00000000-0000-0000-0000-000000016044','T16 Synthetic Wizard Spell 44',3,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-44'),
('00000000-0000-0000-0000-000000016045','T16 Synthetic Wizard Cantrip 45',0,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-45'),
('00000000-0000-0000-0000-000000016046','T16 Synthetic Wizard Cantrip 46',0,ARRAY['Wizard'],'XPHB','Conjuration','t16-synthetic-46');
DO $t16cat_post$
BEGIN
 IF (SELECT count(*) FROM public.spells_catalog WHERE spell_key LIKE 't16-synthetic-%')<>46
 OR (SELECT count(*) FROM public.spells_catalog WHERE spell_key LIKE 'i1e-%')<>9
 OR (SELECT count(*) FROM public.class_feature_catalog WHERE class_key='wizard' AND subclass_name='Evoker'
     AND name IN ('Evoker','Evocation Savant','Signature Spells'))<>3
 THEN RAISE EXCEPTION 'T16 synthetic spell/feature test-source catalog incomplete'; END IF;
 -- The original lower-fidelity joint test fixture's character_spells
 -- grants predate T16; this patch does not GRANT/REVOKE/replace any existing
 -- spell-table privileges or RLS. Direct-DML access requires its own
 -- source-complete release audit and cannot be inferred from table grants.
 IF has_table_privilege('authenticated','public.class_feature_catalog','INSERT')
 THEN RAISE EXCEPTION 'T16 new source feature catalog unexpectedly user-writable'; END IF;
END $t16cat_post$;
\echo 'PASS C34-T16 reduced Wizard lvl3/lvl20 synthetic source test catalog (55 synthetic local spells, no production catalog parity)'
