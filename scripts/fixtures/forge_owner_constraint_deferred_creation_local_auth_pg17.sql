-- DNDNext PR #324 local real-JWT Forge creation deferred-COMMIT owner CHECK research.
-- Run ONLY after J00–J77 succeed in disposable Supabase PG17 / GoTrue fixture.
-- NEVER run on live, production, staging or any persisted DnDNext database.
\set ON_ERROR_STOP on
DO $gate$
DECLARE v_existing bigint;
BEGIN
 IF current_database()<>'postgres'
    OR current_setting('server_version_num')::integer<170000
    OR to_regclass('auth.users') IS NULL
    OR to_regclass('private.test_admins') IS NULL
    OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
    OR to_regclass('private.character_creator_attribution') IS NULL
    OR to_regclass('public.inventory_items') IS NULL
    OR to_regclass('public.character_option_grant_instances') IS NULL
    OR to_regclass('public.character_currency') IS NULL
    OR to_regclass('public.player_wallets') IS NULL
    OR to_regprocedure('public.create_player_character_v2(jsonb,jsonb)') IS NULL
    OR to_regprocedure('private.materialize_player_forge_starting_equipment_v1(uuid)') IS NULL
 THEN
   RAISE EXCEPTION 'J78-J84 requires existing disposable local GoTrue Forge J00-J77';
 END IF;
 IF md5(pg_get_functiondef('private.materialize_player_forge_starting_equipment_v1(uuid)'::regprocedure))
      <> '653e1b9d7cc47dcff2cef33a674b97f4'
    OR md5(pg_get_functiondef('private.materialize_player_forge_starting_equipment_trigger_v1()'::regprocedure))
      <> '23fa54dd0a6d7b42b802d613f39ea27c'
 THEN
    RAISE EXCEPTION 'Original deferred equipment source drift';
 END IF;
 SELECT count(*) INTO v_existing FROM public.inventory_items WHERE owner_type='character';
 IF v_existing<1 THEN RAISE EXCEPTION 'Existing J12-J77 character-owned I specimen missing'; END IF;
 IF EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conrelid='public.inventory_items'::regclass
            AND c.conname IN ('inventory_items_owner_type_check','inventory_items_owner_type_chk'))
 THEN RAISE EXCEPTION 'J78 owner-type constraints already installed'; END IF;
END $gate$;

-- These two expressions and validation flags match live DnDWeb read-only
-- pg_constraint inspection 2026-11-05. NOT VALID still enforces NEW writes,
-- but does not scan historical character-owned rows from prior test cases.
ALTER TABLE public.inventory_items
 ADD CONSTRAINT inventory_items_owner_type_check
 CHECK ((owner_type = ANY (ARRAY['player'::text, 'npc'::text, 'merchant'::text, 'character'::text])));
ALTER TABLE public.inventory_items
 ADD CONSTRAINT inventory_items_owner_type_chk
 CHECK ((owner_type = ANY (ARRAY['player'::text, 'npc'::text, 'merchant'::text]))) NOT VALID;

-- Unmodified live function bodies read via pg_get_functiondef. Exactly the
-- two original live inventory BEFORE INSERT/UPDATE crafting handlers.
\i scripts/fixtures/forge_owner_constraint_original_inventory_handlers_pg17.sql
DO $source$
BEGIN
 IF md5(pg_get_functiondef('private.apply_structured_crafting_traits_v1()'::regprocedure))
      <> '108bfc2599d75e7298f65ce326f16173'
    OR md5(pg_get_functiondef('private.apply_smithing_affinity_polish_v4()'::regprocedure))
      <> '5d51cf335ff880939ae0df4c4152bdbd'
 THEN RAISE EXCEPTION 'Original live inventory trigger handler source drift'; END IF;
END $source$;

CREATE TRIGGER inventory_items_apply_structured_crafting_traits_v1
 BEFORE INSERT OR UPDATE OF card_payload ON public.inventory_items
 FOR EACH ROW EXECUTE FUNCTION private.apply_structured_crafting_traits_v1();
CREATE TRIGGER zz_inventory_items_apply_smithing_affinity_polish_v4
 BEFORE INSERT OR UPDATE OF card_payload ON public.inventory_items
 FOR EACH ROW EXECUTE FUNCTION private.apply_smithing_affinity_polish_v4();

DO $parity$
DECLARE v_valid boolean; v_old_valid boolean; v_old_definition text; v_count int;
BEGIN
 SELECT c.convalidated INTO v_valid
 FROM pg_constraint c WHERE c.conrelid='public.inventory_items'::regclass
 AND c.conname='inventory_items_owner_type_check';
 SELECT c.convalidated,pg_get_constraintdef(c.oid) INTO v_old_valid,v_old_definition
 FROM pg_constraint c WHERE c.conrelid='public.inventory_items'::regclass
 AND c.conname='inventory_items_owner_type_chk';
 IF v_valid IS DISTINCT FROM true OR v_old_valid IS DISTINCT FROM false
    OR v_old_definition NOT LIKE '%NOT VALID'
 THEN RAISE EXCEPTION 'Reduced inventory CHECK parity failed'; END IF;
 SELECT count(*) INTO v_count FROM pg_trigger t
 WHERE t.tgrelid='public.inventory_items'::regclass
 AND NOT t.tgisinternal AND t.tgname IN
   ('inventory_items_apply_structured_crafting_traits_v1',
    'zz_inventory_items_apply_smithing_affinity_polish_v4');
 IF v_count<>2 THEN RAISE EXCEPTION 'Two original inventory triggers not installed'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_trigger t
   WHERE t.tgrelid='public.character_progression'::regclass
   AND t.tgname='character_progression_materialize_player_forge_starting_equipme'
   AND t.tgdeferrable AND t.tginitdeferred)
 THEN RAISE EXCEPTION 'Source-original deferred equipment COMMIT trigger is absent'; END IF;
END $parity$;
\echo 'PASS J78 source-exact original inventory handlers and both live owner-type checks installed in disposable Forge JWT DB'
