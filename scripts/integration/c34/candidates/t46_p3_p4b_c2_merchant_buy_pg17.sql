-- C34 T46-P3-P4B-C2: DISPOSABLE LOCAL PG17 ONLY commerce fixture.
-- Not a production migration, not equivalent to hosted wallet_get source.
-- Runner independently enforces PGHOST=127.0.0.1, PGPORT=54322, GITHUB_ACTIONS,
-- and local-only confirmation. Docker-mapped postgres sees a bridge IP inside
-- the container, so inet_server_addr() must NOT be compared to 127.0.0.1.
-- Exact original buy_from_merchant body installed independently, MD5 verified.
DO $guard$
BEGIN
  IF current_setting('server_version_num')::integer < 170000
     OR current_database()<>'postgres'
     OR to_regclass('private.test_admins') IS NULL
     OR to_regprocedure('public.c34_t46_get_town_presence_v1(bigint)') IS NULL THEN
    RAISE EXCEPTION 'C2 REFUSE: disposable PG17 with original C34 local-only test prerequisites required';
  END IF;
  IF to_regprocedure('public.buy_from_merchant(uuid,uuid,integer)') IS NOT NULL THEN
    RAISE EXCEPTION 'C2 REFUSE: original buyer already installed';
  END IF;
END $guard$;
CREATE TABLE public.character_stock(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id),
  display_name text NOT NULL,
  qty integer NOT NULL,
  price_gp numeric NOT NULL,
  card_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  image_url text,
  item_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.character_stock ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.character_stock FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.character_stock TO authenticated;
CREATE POLICY c34_c2_signed_visible_merchant_stock
ON public.character_stock FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.characters c
    WHERE c.id=character_id AND c.kind='merchant' AND c.storefront_enabled=true
  )
);
CREATE TABLE IF NOT EXISTS public.player_wallets(
  user_id uuid PRIMARY KEY,
  gp numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.player_wallets
 ADD COLUMN IF NOT EXISTS gp numeric NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE TABLE IF NOT EXISTS public.inventory_items(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  item_id text,
  item_name text,
  item_type text,
  item_rarity text,
  item_description text,
  item_weight text,
  item_cost text,
  card_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  owner_type text,
  owner_id text,
  is_equipped boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS public.player_recipes(
  player_id uuid NOT NULL,
  recipe_id uuid NOT NULL,
  discovered_at timestamptz,
  PRIMARY KEY(player_id,recipe_id)
);
ALTER TABLE public.player_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_recipes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.player_wallets, public.inventory_items, public.player_recipes
FROM PUBLIC,anon,authenticated;
-- Exact browser-compatible local signed wallet_get, intentionally SYNTHETIC.
-- Cross-user GP never accessible to a player. Source-original wallet_get is
-- separate T29 work; this test does not claim hosted wallet_get parity.
CREATE FUNCTION public.wallet_get(p_user uuid DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $c2_wallet$
DECLARE
  actor uuid:=auth.uid();
  target uuid:=coalesce(p_user,actor);
BEGIN
  IF actor IS NULL OR target<>actor THEN
    RAISE EXCEPTION 'C2 other-user wallet denied' USING ERRCODE='42501';
  END IF;
  RETURN coalesce((SELECT gp FROM public.player_wallets w WHERE w.user_id=actor),0);
END;
$c2_wallet$;
REVOKE ALL ON FUNCTION public.wallet_get(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_get(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
