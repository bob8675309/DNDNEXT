-- J142 source-original subclass BEFORE INSERT on progression (disposable PG17 only).
\set ON_ERROR_STOP on
DO $gate$
BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR to_regclass('public.class_feature_catalog') IS NULL
 OR to_regclass('public.character_option_grant_instances') IS NULL
 OR to_regprocedure('private.guard_player_character_tag_update_v1()') IS NULL
 OR to_regprocedure('private.sync_character_portrait_library_id_v1()') IS NULL
 OR md5(pg_get_functiondef('private.guard_player_character_tag_update_v1()'::regprocedure)) <> 'b8b0008a718de1aa3e74d66b30f1a679'
 OR md5(pg_get_functiondef('private.sync_character_portrait_library_id_v1()'::regprocedure)) <> '74cb0bf9d7a614a860344f12cf787e05'
 OR to_regprocedure('private.apply_character_forge_subclass_choice_v1()') IS NOT NULL
 OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='character_progression_apply_forge_subclass_v1')
 OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='character_progression' AND column_name='level_choices')
 OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='character_progression' AND column_name='subclass_name')
 THEN RAISE EXCEPTION 'J142 requires original, disposable, source-pinned J141 PG17 fixture'; END IF;
 IF EXISTS(SELECT 1 FROM public.class_feature_catalog WHERE feature_type='subclass' AND lower(class_key)='fighter')
 THEN RAISE EXCEPTION 'Do not overwrite existing Fighter subclass source data'; END IF;
END $gate$;

-- Original handler requires level_choices (missing from the intentionally reduced earlier table).
ALTER TABLE public.character_progression ADD COLUMN level_choices jsonb NOT NULL DEFAULT '{}'::jsonb;
INSERT INTO public.class_level_progression(class_id,class_level,xp_threshold,proficiency_bonus,spell_slots)
VALUES
('00000000-0000-0000-0000-000000000001',2,300,2,'{}'::jsonb),
('00000000-0000-0000-0000-000000000001',3,900,2,'{}'::jsonb);

-- Source-grounded class/subclass identities from read-only live XPHB/PHB Fighter rows.
-- Reduced standalone specimens are NOT full source feature, progression or 2024 rules parity.
INSERT INTO public.class_feature_catalog
(id,feature_key,feature_type,name,source,class_key,class_name,class_source,subclass_name,subclass_short_name,level)
VALUES
('00000000-0000-0000-0000-000000009701','subclass:fighter:xphb:champion:champion:xphb:3','subclass','Champion','XPHB','fighter','Fighter','XPHB','Champion','Champion',3),
('00000000-0000-0000-0000-000000009702','subclass:fighter:phb:champion:champion:phb:3','subclass','Champion','PHB','fighter','Fighter','PHB','Champion','Champion',3),
('00000000-0000-0000-0000-000000009703','subclass:fighter:xphb:battle-master:battle-master:xphb:3','subclass','Battle Master','XPHB','fighter','Fighter','XPHB','Battle Master','Battle Master',3);

\i scripts/fixtures/forge_subclass_choice_original_pg17.sql
DO $hash$
BEGIN
 IF md5(pg_get_functiondef('private.apply_character_forge_subclass_choice_v1()'::regprocedure))
 <> '273be29420a7274d997642e302604cb7'
 THEN RAISE EXCEPTION 'Original live subclass source hash mismatch'; END IF;
END $hash$;

CREATE TRIGGER character_progression_apply_forge_subclass_v1
 BEFORE INSERT ON public.character_progression
 FOR EACH ROW EXECUTE FUNCTION private.apply_character_forge_subclass_choice_v1();

DO $event$
DECLARE ddl text;
BEGIN
 SELECT pg_get_triggerdef(t.oid,true) INTO ddl FROM pg_trigger t
 WHERE t.tgname='character_progression_apply_forge_subclass_v1'
 AND t.tgrelid='public.character_progression'::regclass AND NOT t.tgisinternal;
 IF ddl IS NULL OR position('BEFORE INSERT ON character_progression' in ddl)=0
 OR position('private.apply_character_forge_subclass_choice_v1()' in ddl)=0
 THEN RAISE EXCEPTION 'Original subclass trigger event/handler mismatch %',ddl; END IF;
END $event$;
NOTIFY pgrst,'reload schema';
\echo 'PASS J142 original source-hashed subclass trigger and reduced XPHB/PHB Fighter catalog installed'
