-- C34-T2 disposable-only selected ORIGINAL deployed Forge triggers.
-- Adds 3 sheet + 2 characters originals after the successful 4/31 baseline.
-- Two #345 privacy triggers are NOT original production census members.
-- Exact original pg_get_functiondef source is loaded unchanged from main.
-- Never execute in hosted Supabase; no migration, no table data export.
\set ON_ERROR_STOP on
DO $c34_t2_pre$
DECLARE v_count integer;
BEGIN
 IF current_database() <> 'postgres'
 OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.test_admins') IS NULL
 OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR to_regclass('private.character_creator_attribution') IS NULL
 OR to_regclass('public.character_option_catalog') IS NULL
 OR to_regclass('public.inventory_items') IS NULL
 OR to_regclass('public.character_currency') IS NULL
 OR to_regclass('public.character_sheets') IS NULL
 OR to_regclass('public.npc_portrait_library') IS NULL
 OR to_regprocedure('public.create_player_character_with_private_backstory_v1(jsonb,jsonb,jsonb,text)') IS NULL
 OR EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    WHERE c.relname IN ('characters','character_sheets')
      AND t.tgname IN (
        'character_sheets_validate_player_forge_starting_equipment_v1',
        'character_sheets_authority_fields_guard_v1',
        'character_sheets_sync_player_tags_v1',
        'characters_guard_player_tags_v1',
        'sync_character_portrait_library_id_v1'
      ))
 THEN RAISE EXCEPTION 'C34-T2 requires post-T1 disposable original state with no target trigger installed';
 END IF;
 SELECT count(*) INTO v_count FROM pg_trigger t
 JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O'
   AND c.relname IN ('character_progression','character_sheets','characters','inventory_items')
   AND t.tgname IN (
     'characters_capture_creator_at_insert_v1',
     'characters_guard_player_gm_secret_at_insert_v1',
     'character_progression_materialize_player_forge_starting_equipme',
     'sync_character_progression_from_sheet_v1',
     'inventory_items_apply_structured_crafting_traits_v1',
     'zz_inventory_items_apply_smithing_affinity_polish_v4'
   );
 IF v_count<>6 THEN RAISE EXCEPTION 'C34-T2 requires all six earlier source-exact original/candidate trigger proofs; found %',v_count; END IF;
 IF EXISTS(SELECT 1 FROM pg_constraint
    WHERE conrelid='public.inventory_items'::regclass
      AND conname='inventory_items_owner_type_chk')
 THEN RAISE EXCEPTION 'C34-T2 inventory candidate not yet applied'; END IF;
END $c34_t2_pre$;

-- Match the required ORIGINAL portrait-library columns using fixture-only
-- additions: this is not a reproduction of complete production catalog/RLS.
ALTER TABLE public.npc_portrait_library
  ADD COLUMN name text NOT NULL DEFAULT 'local-fixture',
  ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
-- Existing original reduced class_option_catalog supports the validator; add
-- an explicitly source-qualified Background only for this bounded acceptance.
INSERT INTO public.character_option_catalog(id,option_type,name,source,metadata)
VALUES('00000000-0000-0000-0000-000000009150','background','Soldier','XPHB','{"equipment":[]}'::jsonb);

-- Full untouched deployed function bodies, previously captured read-only.
\i scripts/fixtures/forge_equipment_validator_original_pg17.sql
\i scripts/fixtures/forge_sheet_authority_tags_original_pg17.sql
\i scripts/fixtures/forge_characters_tag_guard_original_pg17.sql
\i scripts/fixtures/forge_characters_portrait_sync_original_pg17.sql

DO $c34_t2_md5$
BEGIN
 IF md5(pg_get_functiondef('private.validate_player_forge_starting_equipment_sheet_v1()'::regprocedure))
      <> '41cb1758bd2e1eb9b3998389deabb49b'
 OR md5(pg_get_functiondef('private.guard_direct_character_authority_mutation_v1()'::regprocedure))
      <> '04596b0a3fdfb71c1b357056e8c6023b'
 OR md5(pg_get_functiondef('private.sync_player_character_tags_from_sheet_v1()'::regprocedure))
      <> 'a135ca951f81d2a9546d783afe665c52'
 OR md5(pg_get_functiondef('private.derive_player_character_tags_v1(jsonb,text[],boolean)'::regprocedure))
      <> 'd62bab7f326330ddbeb6ccede172d19f'
 OR md5(pg_get_functiondef('private.player_character_tag_slug_v1(text)'::regprocedure))
      <> 'aba97a1c7478159d182e38cda4ca8383'
 OR md5(pg_get_functiondef('private.guard_player_character_tag_update_v1()'::regprocedure))
      <> 'b8b0008a718de1aa3e74d66b30f1a679'
 OR md5(pg_get_functiondef('private.sync_character_portrait_library_id_v1()'::regprocedure))
      <> '74cb0bf9d7a614a860344f12cf787e05'
 THEN RAISE EXCEPTION 'C34-T2 source-original live PG17 function drift: refuse trigger installation';
 END IF;
END $c34_t2_md5$;

-- Exact original trigger names, targeted columns, timing and deferral.
CREATE CONSTRAINT TRIGGER character_sheets_validate_player_forge_starting_equipment_v1
 AFTER INSERT OR UPDATE OF sheet ON public.character_sheets
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 EXECUTE FUNCTION private.validate_player_forge_starting_equipment_sheet_v1();
CREATE TRIGGER character_sheets_authority_fields_guard_v1
 BEFORE INSERT OR UPDATE OF sheet ON public.character_sheets
 FOR EACH ROW EXECUTE FUNCTION private.guard_direct_character_authority_mutation_v1();
CREATE TRIGGER character_sheets_sync_player_tags_v1
 AFTER INSERT OR UPDATE OF sheet ON public.character_sheets
 FOR EACH ROW EXECUTE FUNCTION private.sync_player_character_tags_from_sheet_v1();
CREATE TRIGGER characters_guard_player_tags_v1
 BEFORE UPDATE OF tags ON public.characters
 FOR EACH ROW EXECUTE FUNCTION private.guard_player_character_tag_update_v1();
CREATE TRIGGER sync_character_portrait_library_id_v1
 BEFORE INSERT OR UPDATE OF portrait_storage_path, portrait_url, portrait_source ON public.characters
 FOR EACH ROW EXECUTE FUNCTION private.sync_character_portrait_library_id_v1();

DO $c34_t2_post$
DECLARE v_total integer;
BEGIN
 SELECT count(*) INTO v_total FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O'
  AND c.relname IN ('character_progression','character_sheets','characters','inventory_items')
  AND t.tgname IN (
    'character_sheets_validate_player_forge_starting_equipment_v1',
    'character_sheets_authority_fields_guard_v1',
    'character_sheets_sync_player_tags_v1',
    'characters_guard_player_tags_v1',
    'sync_character_portrait_library_id_v1'
  );
 IF v_total<>5 THEN RAISE EXCEPTION 'C34-T2 expected five additional original enabled triggers; found %',v_total; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid='public.character_sheets'::regclass
    AND t.tgname='character_sheets_validate_player_forge_starting_equipment_v1'
    AND t.tgdeferrable AND t.tginitdeferred)
 THEN RAISE EXCEPTION 'C34-T2 original sheet validator is not deferred'; END IF;
END $c34_t2_post$;
NOTIFY pgrst,'reload schema';
\echo 'PASS C34-T2-SETUP: five source-exact originals loaded post-T1; nine original/31 + two new privacy, eleven total'
