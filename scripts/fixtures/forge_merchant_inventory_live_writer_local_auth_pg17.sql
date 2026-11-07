-- PR #324 disposable source-exact merchant stock/inventory BUY integration.
-- Installed AFTER J00-J69 on genuine local GoTrue/PostgREST and PostgreSQL17.
-- Not a schema migration, no persistent DB, and does not change original SQL.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::int<170000
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR to_regclass('public.character_stock') IS NULL
 OR to_regclass('public.inventory_items') IS NULL
 OR to_regclass('public.character_option_grant_instances') IS NULL
 OR to_regclass('public.player_wallets') IS NOT NULL
 OR to_regprocedure('private.materialize_player_forge_starting_equipment_v1(uuid)') IS NULL
 THEN RAISE EXCEPTION 'Refuse non-disposable/out-of-order merchant I-source race'; END IF;
END $guard$;

-- Live original buy source references this stock timestamp. The reduced
-- Forge package-mode schema did not require it until actual market writes.
ALTER TABLE public.character_stock
 ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
-- Supplemental shapes only; these are not real production wallet/RLS parity.
CREATE TABLE public.player_wallets(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),
 gp numeric NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.player_recipes(
 player_id uuid NOT NULL REFERENCES auth.users(id),
 recipe_id uuid NOT NULL,
 discovered_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(player_id,recipe_id)
);
\i scripts/fixtures/forge_original_merchant_buy_source_pg17.sql
DO $hash$
BEGIN
 IF md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))
 <> '1dbe8c24c4c718396d7256f6f7465354'
 THEN RAISE EXCEPTION 'Original merchant stock→inventory function drift'; END IF;
END $hash$;
-- Original SECURITY DEFINER checks auth.uid() but live production grant/RLS
-- is NOT reproduced wholesale. Here only signed-in clients may call buy RPC.
REVOKE ALL ON FUNCTION public.buy_from_merchant(uuid,uuid,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.buy_from_merchant(uuid,uuid,integer)
 TO authenticated;
REVOKE ALL ON public.player_wallets,public.player_recipes
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.character_stock,public.inventory_items
 FROM PUBLIC,anon,authenticated;
DO $acl$
BEGIN
 IF has_function_privilege('anon','public.buy_from_merchant(uuid,uuid,integer)','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.buy_from_merchant(uuid,uuid,integer)','EXECUTE')
 OR has_table_privilege('authenticated','public.player_wallets','UPDATE')
 OR has_table_privilege('authenticated','public.character_stock','UPDATE')
 OR has_table_privilege('authenticated','public.inventory_items','INSERT')
 THEN RAISE EXCEPTION 'Source merchant I test accidentally exposes stock/wallet/inventory writes'; END IF;
END $acl$;
NOTIFY pgrst,'reload schema';
\echo 'PASS fixture: source-original buy_from_merchant PG17 hash checked with restricted JWT-only RPC and supplemental stock/wallet/recipe schema'
