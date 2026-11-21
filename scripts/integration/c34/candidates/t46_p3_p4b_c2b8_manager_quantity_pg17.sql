-- C34 T46-P3-P4B-C2-B8. UNAPPLIED, DISPOSABLE PG17 TEST CANDIDATE.
-- This is not a migration and must never run on hosted DnDWeb.
-- It intentionally does not edit the original buy_from_merchant, original
-- MerchantPanel, or the historical reroll_merchant_inventory_v2 definition.
DO $b8_preflight$
BEGIN
  IF current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
     OR current_database() <> 'postgres'
     OR to_regclass('private.test_admins') IS NULL
     OR to_regprocedure('public.c34_t46_get_town_presence_v1(bigint)') IS NULL
     OR to_regprocedure('public.buy_from_merchant(uuid,uuid,integer)') IS NULL
     OR to_regclass('public.character_stock') IS NULL
     OR to_regclass('public.user_profiles') IS NULL
     OR to_regprocedure('public.c34_t46_manage_stock_qty_v1(uuid,text,integer,integer,timestamptz)') IS NOT NULL
  THEN RAISE EXCEPTION 'C34-B8 REFUSE: requires fresh disposable signed PG17 fixture and no previous B8 candidate';
  END IF;
  IF pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure)
       NOT ILIKE '%Merchant unavailable%'
  THEN RAISE EXCEPTION 'C34-B8 REFUSE: original buyer B2 visibility guard absent'; END IF;
END $b8_preflight$;

CREATE FUNCTION public.c34_t46_manage_stock_qty_v1(
  p_stock_id uuid,
  p_mode text,
  p_value integer,
  p_expected_qty integer DEFAULT NULL,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, public, private, auth
AS $b8$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_seller uuid;
  v_kind text;
  v_stock public.character_stock%ROWTYPE;
  v_next integer;
BEGIN
  -- Auth is checked against the current database role on every signed call,
  -- never against a client-provided role or stale token metadata.
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Game manager required' USING ERRCODE='42501';
  END IF;
  SELECT up.role INTO v_role FROM public.user_profiles up
   WHERE up.id=v_actor FOR SHARE;
  IF v_role IS NULL OR v_role NOT IN ('admin','gm','dm') THEN
    RAISE EXCEPTION 'Game manager required' USING ERRCODE='42501';
  END IF;
  IF p_stock_id IS NULL OR p_value IS NULL OR p_mode NOT IN ('delta','set') OR p_mode IS NULL THEN
    RAISE EXCEPTION 'Invalid stock quantity request' USING ERRCODE='22023';
  END IF;
  IF p_mode='delta' AND (p_value=0 OR p_expected_qty IS NOT NULL OR p_expected_updated_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Relative change requires nonzero delta and no stale snapshot' USING ERRCODE='22023';
  END IF;
  IF p_mode='set' AND (p_value<0 OR p_expected_qty IS NULL OR p_expected_qty<0
                     OR p_expected_updated_at IS NULL) THEN
    RAISE EXCEPTION 'Absolute set requires nonnegative quantity and complete compare-and-swap snapshot' USING ERRCODE='22023';
  END IF;

  -- Same lock ordering as the locally guarded original buyer: seller FIRST,
  -- stock SECOND. Do not take a stock row lock before acquiring this seller
  -- share lock; reroll's independent lock order remains a release blocker.
  SELECT s.character_id INTO v_seller
    FROM public.character_stock s WHERE s.id=p_stock_id;
  IF v_seller IS NULL THEN
    RAISE EXCEPTION 'Stock not found' USING ERRCODE='P0002';
  END IF;
  SELECT c.kind INTO v_kind FROM public.characters c
    WHERE c.id=v_seller FOR SHARE;
  IF v_kind IS DISTINCT FROM 'merchant' THEN
    RAISE EXCEPTION 'Merchant stock required' USING ERRCODE='42501';
  END IF;
  SELECT s.* INTO v_stock FROM public.character_stock s
    WHERE s.id=p_stock_id AND s.character_id=v_seller FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock not found' USING ERRCODE='P0002';
  END IF;
  IF v_stock.qty IS NULL OR v_stock.qty<0 THEN
    RAISE EXCEPTION 'Invalid existing stock' USING ERRCODE='22023';
  END IF;

  IF p_mode='set' THEN
    IF v_stock.qty IS DISTINCT FROM p_expected_qty
       OR v_stock.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION 'Stock changed; refresh before setting an absolute quantity'
        USING ERRCODE='40001';
    END IF;
    v_next:=p_value;
  ELSE
    -- PostgreSQL integer overflow is rejected before the UPDATE; no partial DML.
    v_next:=v_stock.qty+p_value;
    IF v_next<0 THEN
      RAISE EXCEPTION 'Insufficient stock to decrease' USING ERRCODE='22023';
    END IF;
  END IF;

  -- Zero intentionally leaves a non-purchasable stock row for later restock;
  -- original buyer deletes exhausted rows. Never recreate a deleted stock UUID.
  UPDATE public.character_stock s
    SET qty=v_next,
        updated_at=GREATEST(clock_timestamp(),v_stock.updated_at+INTERVAL '1 microsecond')
   WHERE s.id=p_stock_id AND s.character_id=v_seller;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock not found' USING ERRCODE='P0002';
  END IF;
  RETURN v_next;
END
$b8$;

REVOKE ALL ON FUNCTION public.c34_t46_manage_stock_qty_v1(uuid,text,integer,integer,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.c34_t46_manage_stock_qty_v1(uuid,text,integer,integer,timestamptz)
  TO authenticated;
NOTIFY pgrst, 'reload schema';
