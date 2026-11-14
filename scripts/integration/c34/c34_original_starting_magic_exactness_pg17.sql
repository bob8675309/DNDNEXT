-- C34-T8: disposable PG17 only. Original held #324 SQL source Git blob
-- 9da41b637b077ce5ab3f80e6308e0ca9b91fd002. No production migration.
\set ON_ERROR_STOP on
DO $pre$
DECLARE n integer;
BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  OR to_regclass('auth.users') IS NULL
  OR to_regclass('private.character_creator_attribution') IS NULL
  OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
  OR to_regclass('public.character_spells') IS NULL
  OR to_regclass('public.character_sheets') IS NULL
  OR to_regclass('public.character_progression') IS NULL
  OR to_regprocedure('private.validate_player_forge_authority_payload_v1()') IS NULL
  OR to_regprocedure('private.validate_player_forge_starting_magic_exactness_v1()') IS NOT NULL
  OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='character_spells' AND column_name='raw_payload' AND data_type='jsonb')
 THEN RAISE EXCEPTION 'T8 requires original disposable T7 signed source and no prior magic handler'; END IF;
 SELECT count(*) INTO n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O'
  AND c.relname IN ('character_progression','character_sheets','characters','inventory_items');
 IF n<>18 THEN RAISE EXCEPTION 'T8 expects 15 original+2 held privacy+1 seed, got %',n; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgname IN
  ('trg_force_depart_on_route_assign','trg_guard_locations_for_resting_and_camping'))
 THEN RAISE EXCEPTION 'T8 world movement triggers are excluded'; END IF;
END $pre$;

-- Exact original pg_get_functiondef (no modified handler or default grants).
CREATE OR REPLACE FUNCTION private.validate_player_forge_starting_magic_exactness_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$ declare v_sheet jsonb; v_expected jsonb; v_expected_count integer; v_actual_count integer; begin select cs.sheet into v_sheet from public.character_sheets cs where cs.character_id=new.character_id; if coalesce(v_sheet #>> '{meta,creator}','')<>'shared_character_forge_player_v2' then return new; end if; v_expected:=coalesce(v_sheet->'startingMagicSelections','[]'::jsonb); if jsonb_typeof(v_expected)<>'array' then raise exception 'startingMagicSelections must be a JSON array.'; end if; select count(*) into v_expected_count from jsonb_array_elements(v_expected); select count(*) into v_actual_count from public.character_spells where character_id=new.character_id and coalesce((raw_payload->>'startingMagic')::boolean,false); if v_expected_count<>v_actual_count then raise exception 'Starting magic summary does not match authoritative starting spell rows.'; end if; if exists(select 1 from jsonb_array_elements(v_expected) expected where not exists(select 1 from public.character_spells cs where cs.character_id=new.character_id and coalesce((cs.raw_payload->>'startingMagic')::boolean,false) and cs.spell_id=(expected->>'spell_id')::uuid and cs.source_type=coalesce(nullif(expected->>'source_type',''),'class') and cs.source_key=coalesce(nullif(expected->>'source_key',''),coalesce(nullif(expected->>'source_type',''),'class')) and cs.prepared=coalesce((expected->>'prepared')::boolean,false))) then raise exception 'Starting magic summary contains a spell/source/prepared state that was not materialized.'; end if; return new; end; $function$;

CREATE CONSTRAINT TRIGGER character_progression_validate_player_forge_starting_magic_exac
 AFTER INSERT OR UPDATE ON public.character_progression
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 EXECUTE FUNCTION private.validate_player_forge_starting_magic_exactness_v1();

DO $post$
DECLARE d text; n integer;
BEGIN
 IF md5(pg_get_functiondef('private.validate_player_forge_starting_magic_exactness_v1()'::regprocedure))
  <> 'ba645ad0f2c17addad0b40e0602c2ac8'
 THEN RAISE EXCEPTION 'Original T8 function MD5 mismatch'; END IF;
 SELECT pg_get_triggerdef(oid,true) INTO d FROM pg_trigger WHERE
 tgrelid='public.character_progression'::regclass
 AND tgname='character_progression_validate_player_forge_starting_magic_exac'
 AND NOT tgisinternal AND tgenabled='O';
 IF d IS NULL OR position('AFTER INSERT OR UPDATE ON character_progression' IN d)=0
 OR position('DEFERRABLE INITIALLY DEFERRED' IN d)=0
 OR position('private.validate_player_forge_starting_magic_exactness_v1()' IN d)=0
 THEN RAISE EXCEPTION 'Original T8 deferred event/handler mismatch: %',d; END IF;
 SELECT count(*) INTO n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O'
 AND c.relname IN ('character_progression','character_sheets','characters','inventory_items');
 IF n<>19 THEN RAISE EXCEPTION 'T8 expected 16 original+2 privacy+1 seed, got %',n; END IF;
END $post$;
\echo 'PASS T8 SETUP: source original Magic exactness; 16/31 original, 2 privacy, 1 seed'
