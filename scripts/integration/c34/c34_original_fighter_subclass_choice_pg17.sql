-- C34-T4: source-unchanged original Fighter subclass BEFORE-INSERT trigger.
-- Disposable local PG17 / genuine GoTrue only. Never deploy, migrate, or
-- modify production DnDWeb; local representative source catalog is REDUCED.
-- One of original 17 remaining progression triggers after C34-T3.
\set ON_ERROR_STOP on
DO $preflight$
DECLARE v_count integer;
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR to_regclass('private.character_creator_attribution') IS NULL
 OR to_regclass('public.class_catalog') IS NULL
 OR to_regclass('public.class_level_progression') IS NULL
 OR to_regclass('public.character_progression') IS NULL
 OR to_regclass('public.character_sheets') IS NULL
 OR to_regclass('public.inventory_items') IS NULL
 OR to_regclass('public.class_feature_catalog') IS NOT NULL
 OR to_regprocedure('private.apply_character_forge_subclass_choice_v1()') IS NOT NULL
 OR EXISTS (SELECT 1 FROM pg_trigger WHERE NOT tgisinternal
        AND tgname='character_progression_apply_forge_subclass_v1')
 OR EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='character_progression'
      AND column_name IN ('subclass_name','subclass_source','level_choices'))
 OR to_regprocedure('private.guard_character_visual_asset_sprite_v1()') IS NULL
 OR to_regprocedure('private.cancel_invalid_level_up_session_v1()') IS NULL
 THEN RAISE EXCEPTION 'C34-T4 original subclass requires post-T3 disposable local PG17, refuses preexisting/class fields'; END IF;
 SELECT count(*) INTO v_count FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O'
   AND c.relname IN ('character_progression','character_sheets','characters','inventory_items');
 IF v_count<>14 THEN RAISE EXCEPTION 'C34-T4 expected 12 original plus 2 held privacy triggers, found %',v_count; END IF;
END $preflight$;

-- Only the exact source-referenced catalog column SHAPE from held #324's
-- J142 original local fixture; NOT the actual production Fighter feature data.
CREATE TABLE public.class_feature_catalog(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 feature_key text,feature_type text,name text,source text,
 class_key text,class_name text,class_source text,
 subclass_name text,subclass_short_name text,level smallint,
 description text,entries jsonb NOT NULL DEFAULT '[]'::jsonb,
 raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.class_feature_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.class_feature_catalog FROM PUBLIC,anon,authenticated;

ALTER TABLE public.character_progression
 ADD COLUMN subclass_name text,
 ADD COLUMN subclass_source text,
 ADD COLUMN level_choices jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Representative source-qualified LEVEL-3 XPHB Fighter rows are taken from
-- original J142 held fixture. Level 1 already exists from original Forge base.
INSERT INTO public.class_level_progression(class_id,class_level,xp_threshold,proficiency_bonus,spell_slots)
VALUES
 ('00000000-0000-0000-0000-000000000001',2,300,2,'{}'::jsonb),
 ('00000000-0000-0000-0000-000000000001',3,900,2,'{}'::jsonb);

INSERT INTO public.class_feature_catalog
 (id,feature_key,feature_type,name,source,class_key,class_name,
  class_source,subclass_name,subclass_short_name,level)
VALUES
 ('00000000-0000-0000-0000-000000009701',
  'subclass:fighter:xphb:champion:champion:xphb:3',
  'subclass','Champion','XPHB','fighter','Fighter','XPHB','Champion','Champion',3),
 ('00000000-0000-0000-0000-000000009702',
  'subclass:fighter:phb:champion:champion:phb:3',
  'subclass','Champion','PHB','fighter','Fighter','PHB','Champion','Champion',3),
 ('00000000-0000-0000-0000-000000009703',
  'subclass:fighter:xphb:battle-master:battle-master:xphb:3',
  'subclass','Battle Master','XPHB','fighter','Fighter','XPHB','Battle Master','Battle Master',3);

-- Exact original source Git blob is already in main, unchanged.
-- pg_get_functiondef original intentionally omits the statement-terminating
-- semicolon: the following standalone terminator is installer-only and does
-- NOT modify the handler body or its pg_get_functiondef MD5.
\i scripts/fixtures/forge_subclass_choice_original_pg17.sql
;

DO $source_gate$
DECLARE v_def text;
BEGIN
 IF md5(pg_get_functiondef('private.apply_character_forge_subclass_choice_v1()'::regprocedure))
    <> '273be29420a7274d997642e302604cb7'
 THEN RAISE EXCEPTION 'C34-T4 ORIGINAL Fighter subclass source fingerprint mismatch'; END IF;
END $source_gate$;

CREATE TRIGGER character_progression_apply_forge_subclass_v1
 BEFORE INSERT ON public.character_progression
 FOR EACH ROW EXECUTE FUNCTION private.apply_character_forge_subclass_choice_v1();

DO $after$
DECLARE v_def text;v_count integer;
BEGIN
 SELECT pg_get_triggerdef(t.oid,true) INTO v_def
 FROM pg_trigger t WHERE t.tgrelid='public.character_progression'::regclass
   AND t.tgname='character_progression_apply_forge_subclass_v1'
   AND NOT t.tgisinternal AND t.tgenabled='O';
 IF v_def IS NULL OR position('BEFORE INSERT ON character_progression' in v_def)=0
   OR position('private.apply_character_forge_subclass_choice_v1()' in v_def)=0
 THEN RAISE EXCEPTION 'C34-T4 original BEFORE INSERT timing or handler mismatch %',v_def; END IF;
 SELECT count(*) INTO v_count FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O'
   AND c.relname IN ('character_progression','character_sheets','characters','inventory_items');
 IF v_count<>15 THEN RAISE EXCEPTION 'C34-T4 expected 13 original plus 2 held privacy triggers; found %',v_count; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgname IN
   ('trg_force_depart_on_route_assign','trg_guard_locations_for_resting_and_camping'))
 THEN RAISE EXCEPTION 'C34-T4 forbids world-map movement triggers'; END IF;
END $after$;
NOTIFY pgrst,'reload schema';
\echo 'PASS C34-T4-SETUP: original source-hashed Fighter subclass BEFORE INSERT, 13 original + 2 held privacy; no world-map movement'
