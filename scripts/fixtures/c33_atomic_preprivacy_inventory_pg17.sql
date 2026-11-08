-- C3.3 atomic ALL FOUR source candidate rehearsal baseline.
-- DISPOSABLE Supabase local PG17 only; test-only reduced catalogs and role helper.
-- Pre-stage NPC reader and source-original v2/v3 already installed.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.test_admins') IS NULL
 OR to_regclass('public.characters') IS NULL
 OR to_regclass('private.character_creator_attribution') IS NOT NULL
 OR to_regprocedure('public.get_npc_profile_visible_v1(uuid)') IS NOT NULL
 OR to_regclass('public.inventory_items') IS NOT NULL
 THEN RAISE EXCEPTION 'C3 atomic pre-stage inventory fixture refuses non-disposable/changed database'; END IF;
END $guard$;

-- Original materializer already exercises these guard-only scratch tables;
-- they are explicitly NOT production wallet/intent/option-grant implementations.
CREATE TABLE private.player_creation_intent_reservations_v1 (request_id uuid PRIMARY KEY);
CREATE TABLE public.character_option_grant_instances (id uuid PRIMARY KEY);
CREATE TABLE public.player_wallets (user_id uuid PRIMARY KEY);
\i scripts/fixtures/forge_materializer_local_auth_extension_pg17.sql

-- Two synthetic existing records prove merchant stock and character-owned
-- inventory survived all four SQL stages. They are not live data.
INSERT INTO public.characters(id,name,kind,secret)
VALUES('00000000-0000-0000-0000-000000009870','C33 atomic preexisting merchant','merchant','TEST-GM-SECRET-UNCHANGED');
INSERT INTO public.character_stock(id,character_id,qty,display_name,card_payload,price_gp,item_id)
VALUES('00000000-0000-0000-0000-000000009871','00000000-0000-0000-0000-000000009870',2,
 'Synthetic preexisting merchant stock','{}'::jsonb,1,'training-dagger');
INSERT INTO public.inventory_items(id,owner_type,owner_id,item_name,card_payload,quantity)
VALUES('00000000-0000-0000-0000-000000009872','character','00000000-0000-0000-0000-000000009870',
 'Synthetic preexisting character item','{}'::jsonb,1);

-- Both historical owner CHECK definitions. The old NOT VALID check still
-- rejects NEW character-owned inserts; never remove it without RLS hardening.
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_owner_type_check
 CHECK ((owner_type = ANY (ARRAY['player'::text,'npc'::text,'merchant'::text,'character'::text])));
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_owner_type_chk
 CHECK ((owner_type = ANY (ARRAY['player'::text,'npc'::text,'merchant'::text]))) NOT VALID;

-- Exact live source-original crafting BEFORE trigger bodies, not stubs.
\i scripts/fixtures/forge_owner_constraint_original_inventory_handlers_pg17.sql
CREATE TRIGGER inventory_items_apply_structured_crafting_traits_v1
BEFORE INSERT OR UPDATE OF card_payload ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION private.apply_structured_crafting_traits_v1();
CREATE TRIGGER zz_inventory_items_apply_smithing_affinity_polish_v4
BEFORE INSERT OR UPDATE OF card_payload ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION private.apply_smithing_affinity_polish_v4();

-- Four source-original BEFORE-stage policies and grants. Access helper was
-- already installed by the unmodified original NPC reader fixture.
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_items_insert_owner_or_admin ON public.inventory_items
 FOR INSERT TO authenticated WITH CHECK
 ((user_id=(SELECT auth.uid())) OR (SELECT private.current_user_is_admin()));
CREATE POLICY inventory_items_select_owner_or_admin ON public.inventory_items
 FOR SELECT TO authenticated USING
 ((user_id=(SELECT auth.uid())) OR (SELECT private.current_user_is_admin()));
CREATE POLICY inventory_items_update_owner_or_admin ON public.inventory_items
 FOR UPDATE TO authenticated USING
 ((user_id=(SELECT auth.uid())) OR (SELECT private.current_user_is_admin()))
 WITH CHECK ((user_id=(SELECT auth.uid())) OR (SELECT private.current_user_is_admin()));
CREATE POLICY inventory_items_delete_owner_or_admin ON public.inventory_items
 FOR DELETE TO authenticated USING
 ((user_id=(SELECT auth.uid())) OR (SELECT private.current_user_is_admin()));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.inventory_items TO authenticated;
REVOKE ALL ON public.inventory_items FROM anon;
DO $verify$
BEGIN
 IF md5(pg_get_functiondef('private.materialize_player_forge_starting_equipment_v1(uuid)'::regprocedure))
 <> '653e1b9d7cc47dcff2cef33a674b97f4'
 OR md5(pg_get_functiondef('private.apply_structured_crafting_traits_v1()'::regprocedure))
 <> '108bfc2599d75e7298f65ce326f16173'
 OR md5(pg_get_functiondef('private.apply_smithing_affinity_polish_v4()'::regprocedure))
 <> '5d51cf335ff880939ae0df4c4152bdbd'
 OR md5(pg_get_functiondef('private.can_access_character_v1(uuid,text)'::regprocedure))
 <> '97b5e6b059e6467e24c4283fe420c83e'
 OR (SELECT count(*) FROM public.character_stock)<>1
 OR (SELECT count(*) FROM public.inventory_items WHERE owner_type='character')<>1
 OR (SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass)<>4
 THEN RAISE EXCEPTION 'C3 atomic pre-stage materializer/handlers/ACL or data source drift'; END IF;
END $verify$;
\echo 'PASS C3ATOMIC00: disposable source-original Forge/privacy pre-stage with both CHECKs and four live-shaped inventory policies'
