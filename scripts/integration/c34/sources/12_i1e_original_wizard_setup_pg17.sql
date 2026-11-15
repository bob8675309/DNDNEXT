-- I1-E DISPOSABLE SIGNED PG17/GoTrue ONLY; NOT A MIGRATION.
-- Called after the I1-D 11-case inventory + Story nonce proof has completed
-- and original Stage4 owner CHECK/4-policy DDL is installed on the local DB.
-- Original Wizard source is in i1e_wizard_original_functions_pg17.sql.
-- Reduced class_feature_catalog and spells_catalog_preferred are EXPLICIT test
-- dependencies; they are NOT production source-qualified catalog equivalence.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR to_regclass('public.inventory_items') IS NULL
 OR to_regclass('public.character_spells') IS NULL
 OR to_regclass('public.character_progression') IS NULL
 OR to_regclass('public.class_feature_catalog') IS NOT NULL
 OR to_regprocedure('private.materialize_player_forge_wizard_final_v1()') IS NOT NULL
 OR to_regprocedure('private.apply_character_forge_subclass_choice_v1()') IS NOT NULL
 OR (SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass)<>4
 OR (SELECT count(*) FROM pg_constraint
     WHERE conrelid='public.inventory_items'::regclass
       AND conname='inventory_items_owner_type_chk')<>0
 THEN RAISE EXCEPTION 'I1-E requires completed original I1-D signed disposable PG17 Stage4 schema'; END IF;
END $guard$;

-- Original subclass BEFORE INSERT must assign authoritative progression
-- subclass_name from actual signed Forge sheet. Do not preseed fake CP fields.
ALTER TABLE public.character_progression
 ADD COLUMN subclass_name text,
 ADD COLUMN subclass_source text,
 ADD COLUMN level_choices jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE public.class_feature_catalog(
 id uuid PRIMARY KEY, feature_key text, feature_type text, name text,
 source text, class_key text, class_name text, class_source text,
 subclass_name text, subclass_short_name text, level integer
);
INSERT INTO public.class_feature_catalog(
 id,feature_key,feature_type,name,source,class_key,class_name,
 class_source,subclass_name,subclass_short_name,level
) VALUES(
 '00000000-0000-0000-0000-000000008803',
 'subclass:wizard:xphb:evoker:evoker:xphb:3',
 'subclass','Evoker','XPHB','wizard','Wizard','XPHB',
 'Evoker','Evoker',3
);
\i scripts/fixtures/forge_subclass_choice_original_pg17.sql
DO $original_subclass$
BEGIN
 IF md5(pg_get_functiondef('private.apply_character_forge_subclass_choice_v1()'::regprocedure))
  <>'273be29420a7274d997642e302604cb7'
 THEN RAISE EXCEPTION 'I1-E source-original subclass handler drift'; END IF;
END $original_subclass$;
CREATE TRIGGER character_progression_apply_forge_subclass_v1
 BEFORE INSERT ON public.character_progression
 FOR EACH ROW EXECUTE FUNCTION private.apply_character_forge_subclass_choice_v1();

-- Live-shaped fields referenced by source-original Wizard finalizer and
-- canonical Signature use state. The old Forge reduced schema lacks them.
ALTER TABLE public.spells_catalog
 ADD COLUMN school text,
 ADD COLUMN spell_key text;
ALTER TABLE public.character_spells
 ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid(),
 ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN uses_max integer,
 ADD COLUMN uses_remaining integer,
 ADD COLUMN recharge text;
CREATE UNIQUE INDEX character_spells_i1e_id_unique ON public.character_spells(id);

-- IMPORTANT LIMIT: true production spells_catalog_preferred returns dozens of
-- catalog metadata columns using character_source_priority_v1 and DISTINCT ON.
-- For this focused source-original function test there are no competing spell
-- variants: this reduced view exposes the same simple rowtype and semantics
-- for nine deliberately source-qualified *synthetic* XPHB Wizard spells.
-- This is NOT an acceptance test for preferred-version source precedence.
CREATE VIEW public.spells_catalog_preferred
 AS SELECT * FROM public.spells_catalog;

INSERT INTO public.class_level_progression(
 class_id,class_level,xp_threshold,proficiency_bonus,spell_slots
) VALUES
 ('00000000-0000-0000-0000-000000000002',3,900,2,'[4,2]'::jsonb),
 ('00000000-0000-0000-0000-000000000002',20,355000,6,'[4,3,3,3,3,2,2,1,1]'::jsonb);

-- Two legal 1st/2nd-level Evocation Savant picks at level 3, two legal
-- 3rd-level Evocation spellbook picks at 5/7 used again by level20 Signature,
-- and five other distinct legal higher-level Evocation picks.
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

-- All EIGHT function bodies below were read-only retrieved from the actual
-- hosted DnDWeb pg_get_functiondef and exact hash-checked before commit.
\i scripts/fixtures/i1e_wizard_original_functions_pg17.sql

-- Original live pg_get_triggerdef:
-- CREATE CONSTRAINT TRIGGER character_progression_materialize_player_forge_wizard_final_v1
-- AFTER INSERT ON character_progression DEFERRABLE INITIALLY DEFERRED
-- FOR EACH ROW EXECUTE FUNCTION private.materialize_player_forge_wizard_final_v1()
CREATE CONSTRAINT TRIGGER character_progression_materialize_player_forge_wizard_final_v1
 AFTER INSERT ON public.character_progression DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION private.materialize_player_forge_wizard_final_v1();

-- Internal helpers should not be anonymously RPC callable. This is a test
-- privilege guard, not a claim about hosted function ACL.
REVOKE ALL ON FUNCTION private.apply_wizard_signature_spell_ids_v1(uuid,jsonb,text,text)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.materialize_player_forge_wizard_savant_for_character_v1(uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.materialize_player_forge_wizard_signature_for_character_v1(uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.materialize_player_forge_wizard_final_v1()
 FROM PUBLIC,anon,authenticated;

DO $verify$
DECLARE v_ddl text;
BEGIN
 IF (SELECT count(*) FROM pg_trigger
      WHERE tgrelid='public.character_progression'::regclass
        AND NOT tgisinternal
        AND tgname IN ('character_progression_apply_forge_subclass_v1',
                       'character_progression_materialize_player_forge_wizard_final_v1'))<>2
 THEN RAISE EXCEPTION 'I1-E original progression trigger DDL missing'; END IF;
 SELECT pg_get_triggerdef(oid,true) INTO v_ddl
 FROM pg_trigger
 WHERE tgrelid='public.character_progression'::regclass AND
 tgname='character_progression_materialize_player_forge_wizard_final_v1' AND NOT tgisinternal;
 IF v_ddl IS NULL OR v_ddl NOT LIKE '%DEFERRABLE INITIALLY DEFERRED%'
 OR v_ddl NOT LIKE '%AFTER INSERT%'
 OR v_ddl NOT LIKE '%private.materialize_player_forge_wizard_final_v1()%'
 THEN RAISE EXCEPTION 'I1-E exact original Wizard trigger event/handler mismatch: %',v_ddl; END IF;
END $verify$;
NOTIFY pgrst,'reload schema';
\echo 'PASS I1E-SETUP: source-original Wizard finalizer, both helpers and original subclass BEFORE INSERT with synthetic catalog'
