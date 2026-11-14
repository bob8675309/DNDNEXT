-- C34 research ONLY: reproduce both original CHECKs, original crafting hooks
-- and four original inventory DML policies AFTER seeding historical rows.
-- Run from signed local test only; no remote/production migrations.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'postgres'
    OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
    OR to_regclass('auth.users') IS NULL
    OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
    OR to_regclass('private.character_creator_attribution') IS NULL
    OR to_regclass('public.inventory_items') IS NULL
    OR (SELECT count(*) FROM public.inventory_items WHERE owner_type='character')<>2
    OR (SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass)<>0
    OR EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.inventory_items'::regclass
                AND conname IN ('inventory_items_owner_type_chk','inventory_items_owner_type_check'))
 THEN RAISE EXCEPTION 'C34 pre-policy baseline must be disposable, source-complete and seeded exactly twice'; END IF;
END $guard$;
-- Exact DnDWeb CHECK definitions, including historical NOT VALID enforcement on
-- subsequent writes. Two seeded character items predate this obsolete CHECK.
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_owner_type_check
 CHECK ((owner_type = ANY (ARRAY['player'::text,'npc'::text,'merchant'::text,'character'::text])));
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_owner_type_chk
 CHECK ((owner_type = ANY (ARRAY['player'::text,'npc'::text,'merchant'::text]))) NOT VALID;
-- Source-original BEFORE INSERT/UPDATE crafting handlers.
\i scripts/fixtures/forge_owner_constraint_original_inventory_handlers_pg17.sql
CREATE TRIGGER inventory_items_apply_structured_crafting_traits_v1
 BEFORE INSERT OR UPDATE OF card_payload ON public.inventory_items
 FOR EACH ROW EXECUTE FUNCTION private.apply_structured_crafting_traits_v1();
CREATE TRIGGER zz_inventory_items_apply_smithing_affinity_polish_v4
 BEFORE INSERT OR UPDATE OF card_payload ON public.inventory_items
 FOR EACH ROW EXECUTE FUNCTION private.apply_smithing_affinity_polish_v4();
-- Installs exactly four PRE-CANDIDATE policies plus original DML grants.
\i scripts/fixtures/forge_inventory_policy_source_local_auth_pg17.sql
DO $verify$
BEGIN
 IF md5(pg_get_functiondef('private.apply_structured_crafting_traits_v1()'::regprocedure))
      <> '108bfc2599d75e7298f65ce326f16173'
 OR md5(pg_get_functiondef('private.apply_smithing_affinity_polish_v4()'::regprocedure))
      <> '5d51cf335ff880939ae0df4c4152bdbd'
 OR md5(pg_get_functiondef('private.can_access_character_v1(uuid,text)'::regprocedure))
      <> '97b5e6b059e6467e24c4283fe420c83e'
 OR (SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass)<>4
 THEN RAISE EXCEPTION 'C34 original original-source inventory baseline drift'; END IF;
END $verify$;
\echo 'PASS C34-JOIN02: old/validated CHECKs, original crafting hooks and original four inventory RLS policies coexist'
