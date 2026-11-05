-- DNDNext F22–F28: original merchant I source vs player-earned G/GI race.
-- Guarded extension AFTER signed-in F06–F21, disposable Supabase PG17 only.
-- THIS IS NOT A MIGRATION. NEVER INSTALL ON DnDWeb.
\set ON_ERROR_STOP on
DO $gate$
BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::int<170000
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.p13_levelup_case_guard') IS NULL
 OR to_regclass('public.character_option_grant_instances') IS NULL
 OR to_regprocedure('public.complete_character_level_up_v5(uuid,jsonb)') IS NULL
 OR to_regprocedure('public.grant_character_option_v1(uuid,uuid,text)') IS NULL
 OR to_regclass('public.character_stock') IS NOT NULL
 OR to_regclass('public.inventory_items') IS NOT NULL
 OR to_regclass('public.player_wallets') IS NOT NULL
 THEN RAISE EXCEPTION 'F22-F28 refused live/non-empty or out-of-order PG17 fixture'; END IF;
 IF md5(pg_get_functiondef('public.complete_character_level_up_v5(uuid,jsonb)'::regprocedure))<>'02d74b973a763c53c595be20e35e512f'
 OR md5(pg_get_functiondef('private.apply_character_level_advancement_v1(uuid,integer,uuid,jsonb)'::regprocedure))<>'46dd0af4f6ca816422a75e91a292c634'
 THEN RAISE EXCEPTION 'Original v5 or advancement source drift'; END IF;
END $gate$;

-- Source-shaped merchant/player wallet, stock, inventory; SOME live
-- production extra columns/RLS/foreign-key targets are intentionally omitted.
CREATE TABLE public.character_stock(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
 display_name text NOT NULL,price_gp numeric NOT NULL DEFAULT 0,
 qty integer NOT NULL DEFAULT 1,card_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 item_id text,legacy_stock_id text,note text
);
CREATE TABLE public.player_wallets(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),
 gp numeric NOT NULL DEFAULT 0 CHECK(gp>=0 OR gp=-1),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.player_recipes(
 player_id uuid NOT NULL REFERENCES auth.users(id),
 recipe_id uuid NOT NULL,discovered_at timestamptz DEFAULT now(),
 PRIMARY KEY(player_id,recipe_id)
);
CREATE TABLE public.inventory_items(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
 item_id text NOT NULL,item_name text NOT NULL,
 item_type text,item_rarity text,item_description text,
 item_weight text,item_cost text,created_at timestamptz DEFAULT now(),
 card_payload jsonb,owner_type text,owner_id text,
 is_equipped boolean NOT NULL DEFAULT false,
 quantity integer NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now(),
 equip_slot text
);
-- The **two actual live CHECK definitions** are individually source verified
-- via SELECT pg_constraint on 2026-11-05. NOT VALID still applies to NEW rows.
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_owner_type_check
 CHECK (owner_type IN ('player','npc','merchant','character'));
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_owner_type_chk
 CHECK (owner_type IN ('player','npc','merchant')) NOT VALID;

-- Fail-closed reproduction of the live contradictory checks. This is a
-- throwaway INSERT caught inside a nested PL/pgSQL exception subtransaction;
-- NO character-owned inventory persists, and no production write occurs.
DO $owner_check$
DECLARE v_uid uuid; v_constraint text; v_count integer;
BEGIN
 SELECT id INTO v_uid FROM auth.users LIMIT 1;
 IF v_uid IS NULL THEN RAISE EXCEPTION 'No local GoTrue test user'; END IF;
 BEGIN
   INSERT INTO public.inventory_items(user_id,item_id,item_name,card_payload,owner_type,owner_id)
   VALUES(v_uid,'p13-check-only','Source Forge Character-Owned Specimen','{}','character','00000000-0000-0000-0000-000000008391');
   RAISE EXCEPTION 'Contradictory legacy CHECK did NOT reject new character item';
 EXCEPTION WHEN check_violation THEN
   GET STACKED DIAGNOSTICS v_constraint=CONSTRAINT_NAME;
   IF v_constraint <> 'inventory_items_owner_type_chk'
   THEN RAISE EXCEPTION 'Unexpected constraint failure: %',v_constraint; END IF;
 END;
 SELECT count(*) INTO v_count FROM public.inventory_items;
 IF v_count<>0 THEN RAISE EXCEPTION 'Owner-type CHECK probe left an inventory row'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint
  WHERE conrelid='public.inventory_items'::regclass
  AND conname='inventory_items_owner_type_chk' AND NOT convalidated)
 THEN RAISE EXCEPTION 'Legacy NOT VALID contradictory constraint missing'; END IF;
END $owner_check$;

-- EXACT original source bodies read via pg_get_functiondef from DnDWeb.
\i scripts/fixtures/p1_3_original_merchant_inventory_source_pg17.sql
DO $hash$
BEGIN
 IF md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))<>'1dbe8c24c4c718396d7256f6f7465354'
 OR md5(pg_get_functiondef('private.apply_structured_crafting_traits_v1()'::regprocedure))<>'108bfc2599d75e7298f65ce326f16173'
 OR md5(pg_get_functiondef('private.apply_smithing_affinity_polish_v4()'::regprocedure))<>'5d51cf335ff880939ae0df4c4152bdbd'
 OR md5(pg_get_functiondef('public.set_wallet_updated_at()'::regprocedure))<>'979427428c72842b842b35db11334a3d'
 THEN RAISE EXCEPTION 'Original merchant/inventory trigger function drift'; END IF;
END $hash$;

-- Original production trigger definitions (SELECT source verified).
CREATE TRIGGER inventory_items_apply_structured_crafting_traits_v1
 BEFORE INSERT OR UPDATE OF card_payload ON public.inventory_items
 FOR EACH ROW EXECUTE FUNCTION private.apply_structured_crafting_traits_v1();
CREATE TRIGGER zz_inventory_items_apply_smithing_affinity_polish_v4
 BEFORE INSERT OR UPDATE OF card_payload ON public.inventory_items
 FOR EACH ROW EXECUTE FUNCTION private.apply_smithing_affinity_polish_v4();
CREATE TRIGGER trg_player_wallets_updated_at BEFORE UPDATE
 ON public.player_wallets FOR EACH ROW EXECUTE FUNCTION public.set_wallet_updated_at();

-- Explicitly reduced scratch auth: only signed JWT RPC can mutate stock,
-- wallet or inventory. This is stricter than live inventory owner INSERT RLS,
-- NOT production RLS parity.
ALTER TABLE public.character_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_recipes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.character_stock,public.inventory_items,
 public.player_wallets,public.player_recipes FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.buy_from_merchant(uuid,uuid,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buy_from_merchant(uuid,uuid,integer) TO authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC,anon,authenticated;
DO $acl$
BEGIN
 IF has_function_privilege('anon','public.buy_from_merchant(uuid,uuid,integer)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.buy_from_merchant(uuid,uuid,integer)','EXECUTE')
 OR has_table_privilege('authenticated','public.character_stock','UPDATE')
 OR has_table_privilege('authenticated','public.inventory_items','INSERT')
 OR has_table_privilege('authenticated','public.player_wallets','UPDATE')
 THEN RAISE EXCEPTION 'Merchant I test auth failed closed'; END IF;
END $acl$;
NOTIFY pgrst,'reload schema';
\echo 'PASS F22 source exact merchant-buy/I triggers installed, old NOT VALID CHECK rejects new character-owned I rows in disposable PG17'
