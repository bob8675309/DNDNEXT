-- C34 T10 — disposable source-original deferred starting-spell-count validation.
-- NOT a production migration. Runs ONLY after fully signed T1–T9 in local PG17.
-- The original handler and its original staged DDL are separate raw Git-blob
-- pinned scripts (original hash d56ed5ea44289bbb20720c1323f9b22f362b31c5). No weakening or reimplementation.
\set ON_ERROR_STOP on
DO $t10_pre$
DECLARE n integer;
BEGIN
 IF current_database()<>'postgres'
  OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  OR to_regclass('auth.users') IS NULL
  OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
  OR to_regclass('public.class_catalog_preferred') IS NOT NULL
  OR to_regprocedure('private.validate_player_forge_starting_spells_v1()') IS NOT NULL
  OR md5(pg_get_functiondef('private.validate_player_forge_nested_choice_payload_v1()'::regprocedure))
    <> 'df2861cc76b0b74bb7cd57fbe61c9a05'
  OR md5(pg_get_functiondef('private.validate_player_forge_starting_magic_exactness_v1()'::regprocedure))
    <> 'ba645ad0f2c17addad0b40e0602c2ac8'
  OR EXISTS(SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name='class_level_progression'
       AND column_name IN ('cantrips_known','spells_known'))
  OR EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal
      AND tgname='character_progression_validate_player_forge_spells_v1')
 THEN RAISE EXCEPTION 'C34 T10 requires source-exact T1-T9 disposable signed baseline and no starting-spells installation'; END IF;
 SELECT count(*) INTO n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O'
  AND c.relname IN ('character_progression','character_sheets','characters','inventory_items');
 IF n<>20 THEN RAISE EXCEPTION 'C34 T10 expects 17 original plus 2 privacy and 1 creator seed, got %',n; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgname IN
  ('trg_force_depart_on_route_assign','trg_guard_locations_for_resting_and_camping'))
 THEN RAISE EXCEPTION 'C34 T10 explicitly excludes both protected world-map triggers'; END IF;
END $t10_pre$;

-- Original J154 local installer imports the ORIGINAL 2024 PG17 function body
-- plus original deferred trigger, with a deliberately reduced XPHB-only local
-- view, NOT the production preferred-class-catalog view.
\i scripts/fixtures/forge_starting_spells_local_auth_pg17.sql

-- Original W158 source-identified Wizard level1: 3 cantrips, 6 spellbook,
-- 4 prepared, 2 level-1 slots. Synthetic original test Wizard class UUID.
\i scripts/fixtures/forge_wizard_starting_spells_local_auth_pg17.sql

DO $t10_post$
DECLARE d text; n integer;
BEGIN
 IF md5(pg_get_functiondef('private.validate_player_forge_starting_spells_v1()'::regprocedure))
    <> '6870e810de909209c44aecd02f5c72e2'
 THEN RAISE EXCEPTION 'C34 T10 unchanged original spell validator MD5 differs'; END IF;
 SELECT pg_get_triggerdef(oid,true) INTO d FROM pg_trigger
 WHERE tgrelid='public.character_progression'::regclass
  AND tgname='character_progression_validate_player_forge_spells_v1'
  AND NOT tgisinternal AND tgenabled='O';
 IF d IS NULL OR position('AFTER INSERT OR UPDATE OF class_id, class_level' in d)=0
  OR position('DEFERRABLE INITIALLY DEFERRED' in d)=0
  OR position('private.validate_player_forge_starting_spells_v1()' in d)=0
 THEN RAISE EXCEPTION 'C34 T10 original deferred event timing/body mismatch: %',d; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.class_level_progression
   WHERE class_id='00000000-0000-0000-0000-000000000002'::uuid
   AND class_level=1 AND cantrips_known=3 AND spells_known=4
   AND spell_slots='[2,0,0,0,0,0,0,0,0]'::jsonb)
 THEN RAISE EXCEPTION 'C34 T10 reduced XPHB Wizard source level1 progression drift'; END IF;
 SELECT count(*) INTO n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O'
  AND c.relname IN ('character_progression','character_sheets','characters','inventory_items');
 IF n<>21 THEN RAISE EXCEPTION 'C34 T10 expected 18 original plus 3 held, got %',n; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgname IN
  ('trg_force_depart_on_route_assign','trg_guard_locations_for_resting_and_camping'))
 THEN RAISE EXCEPTION 'C34 T10 world-map trigger exclusion broken'; END IF;
END $t10_post$;
\echo 'PASS C34-T10: source-original deferred starting-spell-count validator, 18/31 original; local 2024 Wizard reduced catalog seeded'
