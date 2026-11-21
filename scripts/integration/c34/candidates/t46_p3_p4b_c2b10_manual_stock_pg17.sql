-- C34 T46-C2B10. DISPOSABLE SIGNED PG17 CANDIDATE. NOT A MIGRATION.
-- Atomic server-only add/remove/dump; exclusive seller row FIRST for every
-- operation, consistent with B2 signed buyer, B8 delta and B9 reroll.
DO $b10_preflight$
BEGIN
 IF current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
    OR current_database() <> 'postgres'
    OR to_regprocedure('public.c34_t46_manage_stock_qty_v1(uuid,text,integer,integer,timestamptz)') IS NULL
    OR to_regprocedure('public.reroll_merchant_inventory_v2(uuid,text,integer)') IS NULL
    OR to_regprocedure('public.c34_t46_manage_merchant_stock_v1(uuid,text,uuid,jsonb,text,numeric,integer,jsonb)') IS NOT NULL
 THEN RAISE EXCEPTION 'C34 B10 REFUSE: requires fresh signed disposable B8+B9 on PG17'; END IF;
END $b10_preflight$;

CREATE FUNCTION public.c34_t46_manage_merchant_stock_v1(
 p_merchant_id uuid,
 p_action text,
 p_stock_id uuid DEFAULT NULL,
 p_expected jsonb DEFAULT NULL,
 p_display_name text DEFAULT NULL,
 p_price_gp numeric DEFAULT NULL,
 p_qty integer DEFAULT NULL,
 p_payload jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO pg_catalog, public, private, auth
AS $b10$
DECLARE
 v_actor uuid := auth.uid();
 v_role text;
 v_seller uuid;
 v_stock public.character_stock%ROWTYPE;
 v_snapshot jsonb;
 v_next uuid;
 v_deleted integer := 0;
BEGIN
 IF v_actor IS NULL THEN
   RAISE EXCEPTION 'Game manager required' USING ERRCODE='42501';
 END IF;
 SELECT up.role INTO v_role FROM public.user_profiles up
   WHERE up.id=v_actor FOR SHARE;
 IF v_role IS NULL OR v_role NOT IN ('admin','gm','dm') THEN
   RAISE EXCEPTION 'Game manager required' USING ERRCODE='42501';
 END IF;
 IF p_merchant_id IS NULL OR p_action IS NULL
    OR p_action NOT IN ('add','remove','dump') THEN
   RAISE EXCEPTION 'Invalid stock management action' USING ERRCODE='22023';
 END IF;
 -- Lock the SELLER before inspecting/locking/deleting stock. This is an
 -- exclusive lock because remove/dump and reroll delete stock rows, while
 -- buyer and B8 quantity writers obtain seller FOR SHARE first.
 SELECT c.id INTO v_seller FROM public.characters c
  WHERE c.id=p_merchant_id AND c.kind='merchant' FOR UPDATE;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'Merchant required for stock management'
     USING ERRCODE='42501';
 END IF;
 IF p_action='add' THEN
   IF p_stock_id IS NOT NULL OR p_expected IS NOT NULL
      OR p_display_name IS NULL OR length(btrim(p_display_name))=0
      OR length(p_display_name)>255
      OR p_price_gp IS NULL OR p_price_gp<0 OR p_price_gp>1000000000
      OR p_qty IS NULL OR p_qty<1 OR p_qty>1000000
      OR jsonb_typeof(coalesce(p_payload,'{}'::jsonb)) <> 'object' THEN
     RAISE EXCEPTION 'Invalid manual stock details' USING ERRCODE='22023';
   END IF;
   INSERT INTO public.character_stock(
     character_id,display_name,price_gp,qty,card_payload,item_id)
   VALUES(
     v_seller,btrim(p_display_name),p_price_gp,p_qty,
     coalesce(p_payload,'{}'::jsonb),
     nullif(p_payload->>'item_id','')
   ) RETURNING id INTO v_next;
   RETURN jsonb_build_object('action','add','id',v_next,'qty',p_qty);
 END IF;
 IF p_action='remove' THEN
   IF p_stock_id IS NULL OR p_expected IS NULL
      OR p_display_name IS NOT NULL OR p_price_gp IS NOT NULL
      OR p_qty IS NOT NULL OR p_payload IS NOT NULL THEN
     RAISE EXCEPTION 'Missing exact stock snapshot for removal' USING ERRCODE='22023';
   END IF;
   SELECT s.* INTO v_stock FROM public.character_stock s
     WHERE s.id=p_stock_id AND s.character_id=v_seller FOR UPDATE;
   IF NOT FOUND THEN
     RAISE EXCEPTION 'Stock no longer exists' USING ERRCODE='P0002';
   END IF;
   v_snapshot:=jsonb_build_object('id',v_stock.id,
     'qty',v_stock.qty,'updated_at',v_stock.updated_at);
   IF p_expected IS DISTINCT FROM v_snapshot THEN
     RAISE EXCEPTION 'Stock changed; refresh before removing'
       USING ERRCODE='40001';
   END IF;
   DELETE FROM public.character_stock s
     WHERE s.id=v_stock.id AND s.character_id=v_seller;
   RETURN jsonb_build_object('action','remove','id',v_stock.id,'deleted',1);
 END IF;
 IF p_action='dump' THEN
   IF p_stock_id IS NOT NULL OR p_expected IS NULL
      OR jsonb_typeof(p_expected) <> 'array'
      OR p_display_name IS NOT NULL OR p_price_gp IS NOT NULL
      OR p_qty IS NOT NULL OR p_payload IS NOT NULL THEN
     RAISE EXCEPTION 'Missing exact shelf snapshot for dump' USING ERRCODE='22023';
   END IF;
   SELECT coalesce(jsonb_agg(jsonb_build_object(
     'id',s.id,'qty',s.qty,'updated_at',s.updated_at)
     ORDER BY s.id),'[]'::jsonb)
     INTO v_snapshot
   FROM public.character_stock s WHERE s.character_id=v_seller;
   IF v_snapshot IS DISTINCT FROM p_expected THEN
     RAISE EXCEPTION 'Shelf changed; refresh before dump'
       USING ERRCODE='40001';
   END IF;
   DELETE FROM public.character_stock s WHERE s.character_id=v_seller;
   GET DIAGNOSTICS v_deleted=ROW_COUNT;
   RETURN jsonb_build_object('action','dump','deleted',v_deleted);
 END IF;
 RAISE EXCEPTION 'Unsupported operation' USING ERRCODE='22023';
END
$b10$;

REVOKE ALL ON FUNCTION public.c34_t46_manage_merchant_stock_v1(uuid,text,uuid,jsonb,text,numeric,integer,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.c34_t46_manage_merchant_stock_v1(uuid,text,uuid,jsonb,text,numeric,integer,jsonb)
  TO authenticated;
NOTIFY pgrst, 'reload schema';
