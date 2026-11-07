-- J154+: exact original deferred Forge starting-spells validator.
-- Research-only disposable local PG17/GoTrue. Never apply to live DnDWeb.
\set ON_ERROR_STOP on
DO $gate$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR to_regclass('public.class_catalog_preferred') IS NOT NULL
 OR to_regprocedure('private.validate_player_forge_starting_spells_v1()') IS NOT NULL
 OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='character_progression_validate_player_forge_spells_v1')
 OR md5(pg_get_functiondef('private.apply_character_forge_subclass_choice_v1()'::regprocedure)) <> '273be29420a7274d997642e302604cb7'
 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='character_progression_apply_forge_subclass_v1' AND tgrelid='public.character_progression'::regclass AND NOT tgisinternal)
 OR NOT EXISTS(SELECT 1 FROM public.class_catalog WHERE class_key='fighter' AND source='XPHB' AND nullif(spellcasting_ability,'') IS NULL)
 THEN RAISE EXCEPTION 'J154 requires source-verified J153 disposable PG17 Fighter fixture without starting-spell trigger';
 END IF;
END $gate$;

-- Only the needed projection, not the full deployed preferred-view semantics.
-- Source spell validator resolves the EXACT source-verified class ID through this
-- deliberately reduced XPHB-only view. Never call this production catalogue parity.
CREATE VIEW public.class_catalog_preferred AS
 SELECT id,class_key,class_name,source,spellcasting_ability
 FROM public.class_catalog WHERE source='XPHB';

-- Compatibility columns used in the original spellcaster branch, even though
-- this bounded first case exercises a nonspellcasting Fighter.
ALTER TABLE public.class_level_progression
 ADD COLUMN cantrips_known integer NOT NULL DEFAULT 0,
 ADD COLUMN spells_known integer NOT NULL DEFAULT 0;

-- Exact source text read-only from DnDWeb: md5(pg_get_functiondef) 6870e810de909209c44aecd02f5c72e2.
\i scripts/fixtures/forge_starting_spells_original_pg17.sql
DO $source$
BEGIN
 IF md5(pg_get_functiondef('private.validate_player_forge_starting_spells_v1()'::regprocedure))
   <> '6870e810de909209c44aecd02f5c72e2'
 THEN RAISE EXCEPTION 'Live original deferred starting-spells handler fingerprint mismatch'; END IF;
END $source$;

-- Exact live trigger event/deferred shape; no test bypass/stub of handler.
CREATE CONSTRAINT TRIGGER character_progression_validate_player_forge_spells_v1
 AFTER INSERT OR UPDATE OF class_id, class_level ON public.character_progression
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 EXECUTE FUNCTION private.validate_player_forge_starting_spells_v1();

DO $trigger$
DECLARE t record;
BEGIN
 SELECT pg_get_triggerdef(oid,true) AS ddl,tgdeferrable,tginitdeferred,tgfoid::regprocedure::text AS func
 INTO t
 FROM pg_trigger
 WHERE tgname='character_progression_validate_player_forge_spells_v1'
  AND tgrelid='public.character_progression'::regclass AND NOT tgisinternal;
 IF t.ddl IS NULL OR NOT t.tgdeferrable OR NOT t.tginitdeferred
  OR t.func<>'private.validate_player_forge_starting_spells_v1()'
  OR position('AFTER INSERT OR UPDATE OF class_id, class_level ON character_progression' IN t.ddl)=0
  OR position('DEFERRABLE INITIALLY DEFERRED' IN t.ddl)=0
 THEN RAISE EXCEPTION 'Original starting-spells trigger timing/event/handler mismatch'; END IF;
END $trigger$;
\echo 'PASS FIXTURE J154 original deferred starting-spells trigger installed with unchanged source body and reduced XPHB-only local view'
