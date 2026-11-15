-- C34 T28-P2 DISPOSABLE PG17 ONLY. Run strictly AFTER original P1 signed suite.
-- Uses ORIGINAL, SHA/MD5-guarded buy_from_merchant from existing
-- scripts/fixtures/forge_original_merchant_buy_source_pg17.sql, installed
-- separately by the LOCAL T26 runner. Wallet functions below are SYNTHETIC
-- local role fixtures, not copied production wallet_get/wallet_set source.
BEGIN;
DO $guard$
BEGIN
 IF current_setting('server_version_num')::integer < 170000 THEN
   RAISE EXCEPTION 'T28 P2 requires disposable PG17';
 END IF;
 IF to_regclass('private.test_admins') IS NULL
 OR to_regclass('private.t28_wallet_probe') IS NULL
 OR to_regprocedure('public.wallet_get(uuid)') IS NULL
 OR strpos(pg_get_functiondef('public.wallet_get(uuid)'::regprocedure),'t28_wallet_probe')=0
 THEN RAISE EXCEPTION 'T28 P2 original P1 synthetic wallet fixture is not intact';
 END IF;
 IF to_regprocedure('public.wallet_set(uuid,numeric)') IS NOT NULL
 OR to_regprocedure('public.buy_from_merchant(uuid,uuid,integer)') IS NOT NULL
 THEN RAISE EXCEPTION 'T28 P2 must not overwrite an existing wallet_set or buy RPC';
 END IF;
END $guard$;

ALTER TABLE public.character_stock
 ADD COLUMN IF NOT EXISTS item_id text;
ALTER TABLE public.character_stock
 ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.player_wallets (
 user_id uuid PRIMARY KEY, gp numeric NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.inventory_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid, item_id text, item_name text, item_type text,
 item_rarity text, item_description text, item_weight text,
 item_cost text, card_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 owner_type text, owner_id text, is_equipped boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS public.player_recipes (
 player_id uuid NOT NULL, recipe_id uuid NOT NULL, discovered_at timestamptz,
 PRIMARY KEY(player_id,recipe_id)
);
ALTER TABLE public.player_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_recipes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.player_wallets,public.inventory_items,public.player_recipes
 FROM PUBLIC,anon,authenticated;

-- P1 synthetic wallet_get is replaced ONLY in ephemeral PG17 *after* P1 passes,
-- so P2 can compare the original merchant-buy debit and synthetic Admin edit
-- against the same local player_wallets balance.
CREATE OR REPLACE FUNCTION public.wallet_get(p_user uuid DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $t28p2_wallet$
DECLARE
 actor uuid := auth.uid();
 target uuid := coalesce(p_user,actor);
BEGIN
 IF actor IS NULL THEN
  RAISE EXCEPTION 'signed actor required' USING ERRCODE='42501';
 END IF;
 IF target<>actor AND NOT EXISTS (SELECT 1 FROM private.test_admins t WHERE t.id=actor) THEN
  RAISE EXCEPTION 'different wallet requires Admin' USING ERRCODE='42501';
 END IF;
 RETURN coalesce((SELECT gp FROM public.player_wallets w WHERE w.user_id=target),0);
END;
$t28p2_wallet$;

-- SYNTHETIC P2-only wallet_set. Real production RPC is NOT modified or
-- claimed source-equivalent: role boundaries and round trip are tested here.
CREATE FUNCTION public.wallet_set(p_user uuid,p_amount numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $t28p2_set$
DECLARE
 actor uuid:=auth.uid();
 target uuid:=coalesce(p_user,actor);
 result numeric;
BEGIN
 IF actor IS NULL OR NOT EXISTS (
  SELECT 1 FROM private.test_admins t WHERE t.id=actor
 ) THEN
  RAISE EXCEPTION 'Admin required to set wallet' USING ERRCODE='42501';
 END IF;
 IF p_amount IS NULL OR p_amount < -1 THEN
  RAISE EXCEPTION 'invalid wallet balance' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.player_wallets(user_id,gp) VALUES(target,p_amount)
 ON CONFLICT(user_id) DO UPDATE SET gp=excluded.gp,updated_at=now()
 RETURNING gp INTO result;
 RETURN result;
END;
$t28p2_set$;

REVOKE ALL ON FUNCTION public.wallet_get(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.wallet_set(uuid,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_get(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_set(uuid,numeric) TO authenticated;
COMMIT;
NOTIFY pgrst,'reload schema';
