-- C34 B14-P8 SOURCE-ONLY SQL CANDIDATE. Disposable signed local PG17 ONLY.
-- This is NOT a cutover: legacy June transfer/P2/P4 and pages/inventory.js
-- STILL allow their historical NPC consent bypasses; never deploy alone.
BEGIN;
DO $p8_guard$ BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 OR to_regprocedure('public.c34_b14_p6_offer_item_v1(uuid,uuid,text,text,uuid)') IS NULL
 OR to_regprocedure('public.c34_b14_p2_transfer_inventory_item_v1(uuid,text,text,text,text)') IS NULL
 OR to_regprocedure('public.c34_b14_p7_npc_backpack_page_v1(uuid,integer,timestamptz,uuid)') IS NULL
 THEN RAISE EXCEPTION 'P8 dispatcher only after P2/P6/P7 in disposable local PG17';
 END IF;
END $p8_guard$;

-- Private, append-only original submission receipts; not current NPC offer
-- decision status. P6 offer ledger remains the authoritative pending/accepted
-- record. This table MUST NOT be exposed to client SELECT/INSERT/UPDATE.
CREATE TABLE private.c34_b14_p8_intent_receipts (
 request_id uuid PRIMARY KEY,
 actor_id uuid NOT NULL,
 fingerprint text NOT NULL,
 receipt jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.c34_b14_p8_intent_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.c34_b14_p8_intent_receipts FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.c34_b14_p8_dispatch_item_intent_v1(
 p_request_id uuid,
 p_item_id uuid,
 p_expected_owner_type text,
 p_expected_owner_id text,
 p_target_type text,
 p_target_id text
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,private,auth
AS $p8_single$
DECLARE
 v_actor uuid:=auth.uid();
 v_source text:=lower(btrim(coalesce(p_expected_owner_type,'')));
 v_target text:=lower(btrim(coalesce(p_target_type,'')));
 v_source_id uuid;
 v_target_id uuid;
 v_fingerprint text;
 v_prior private.c34_b14_p8_intent_receipts%ROWTYPE;
 v_offer jsonb;
 v_status text;
 v_auto boolean:=false;
 v_receipt jsonb;
BEGIN
 IF v_actor IS NULL THEN
  RAISE EXCEPTION 'Sign-in required' USING ERRCODE='42501';
 END IF;
 IF p_request_id IS NULL OR p_item_id IS NULL
 OR v_source NOT IN ('player','character')
 OR v_target NOT IN ('player','npc')
 OR (v_target='player' AND v_source<>'player')
 OR p_expected_owner_id IS NULL OR p_target_id IS NULL
 OR p_expected_owner_id !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 OR p_target_id !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 THEN RAISE EXCEPTION 'Unsupported P8 transfer intent' USING ERRCODE='22023';
 END IF;
 v_source_id:=p_expected_owner_id::uuid;
 v_target_id:=p_target_id::uuid;
 IF v_target='player' AND v_source_id=v_target_id THEN
  RAISE EXCEPTION 'No player self-send' USING ERRCODE='22023';
 END IF;
 v_fingerprint:=md5(concat_ws('|','single',p_item_id::text,
  v_source,v_source_id::text,v_target,v_target_id::text));
 -- Lock only this idempotency key. All item/recipient row locks are taken by
 -- the preserved P2 or P6 functions in their established item→NPC order.
 PERFORM pg_advisory_xact_lock(hashtextextended('c34-p8:'||p_request_id::text,0));
 SELECT * INTO v_prior FROM private.c34_b14_p8_intent_receipts
 WHERE request_id=p_request_id FOR UPDATE;
 IF FOUND THEN
  IF v_prior.actor_id IS DISTINCT FROM v_actor
  OR v_prior.fingerprint IS DISTINCT FROM v_fingerprint THEN
   RAISE EXCEPTION 'Conflicting P8 intent ID' USING ERRCODE='40001';
  END IF;
  RETURN v_prior.receipt;
 END IF;
 IF v_target='player' THEN
  -- P2 performs fresh owner-CAS, actor/manager check, recipient players
  -- validation, item→owner row locking and original immediate account send.
  -- NEVER return P2's FULL inventory_items row to this caller.
  PERFORM public.c34_b14_p2_transfer_inventory_item_v1(
   p_item_id,'player',v_target_id::text,v_source,v_source_id::text);
  v_status:='accepted';
 ELSE
  -- P6 enforces current source character grant, genuine nonhidden NPC
  -- (excluding tagged Forge PCs), pending consent or BOTH explicit GM
  -- auto_accept_items grant AND current can_control/can_edit.
  v_offer:=public.c34_b14_p6_offer_item_v1(
   p_request_id,p_item_id,v_source,v_source_id::text,v_target_id);
  v_status:=v_offer->>'status';
  v_auto:=coalesce((v_offer->>'auto_accepted')::boolean,false);
  IF v_status NOT IN ('pending','accepted') THEN
   RAISE EXCEPTION 'Unexpected P6 NPC decision' USING ERRCODE='40001';
  END IF;
 END IF;
 v_receipt:=jsonb_build_object(
  'request_id',p_request_id,'item_id',p_item_id,
  'target_type',v_target,'target_id',v_target_id::text,
  'status',v_status,'auto_accepted',v_auto);
 INSERT INTO private.c34_b14_p8_intent_receipts(
  request_id,actor_id,fingerprint,receipt)
 VALUES(p_request_id,v_actor,v_fingerprint,v_receipt);
 RETURN v_receipt;
END;
$p8_single$;

CREATE OR REPLACE FUNCTION public.c34_b14_p8_dispatch_batch_intent_v1(
 p_request_id uuid,
 p_item_ids uuid[],
 p_expected_owner_type text,
 p_expected_owner_id text,
 p_target_type text,
 p_target_id text
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,private,auth
AS $p8_bulk$
DECLARE
 v_actor uuid:=auth.uid();
 v_source text:=lower(btrim(coalesce(p_expected_owner_type,'')));
 v_target text:=lower(btrim(coalesce(p_target_type,'')));
 v_source_id uuid;
 v_target_id uuid;
 v_count integer:=coalesce(cardinality(p_item_ids),0);
 v_distinct integer;
 v_list text;
 v_fingerprint text;
 v_prior private.c34_b14_p8_intent_receipts%ROWTYPE;
 v_item uuid;
 v_child_id uuid;
 v_child jsonb;
 v_items jsonb:='[]'::jsonb;
 v_first_state text;
 v_receipt jsonb;
BEGIN
 IF v_actor IS NULL THEN
  RAISE EXCEPTION 'Sign-in required' USING ERRCODE='42501';
 END IF;
 IF p_request_id IS NULL OR v_count NOT BETWEEN 1 AND 50
 OR cardinality(array_remove(p_item_ids,NULL))<>v_count
 OR v_source NOT IN ('player','character') OR v_target NOT IN ('player','npc')
 OR (v_target='player' AND v_source<>'player')
 OR p_expected_owner_id IS NULL OR p_target_id IS NULL
 OR p_expected_owner_id !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 OR p_target_id !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
 THEN RAISE EXCEPTION 'Unsupported P8 atomic bulk' USING ERRCODE='22023';
 END IF;
 v_source_id:=p_expected_owner_id::uuid;
 v_target_id:=p_target_id::uuid;
 IF v_target='player' AND v_source_id=v_target_id THEN
  RAISE EXCEPTION 'No player self-send' USING ERRCODE='22023';
 END IF;
 SELECT count(DISTINCT value),string_agg(value::text,',' ORDER BY value)
 INTO v_distinct,v_list FROM unnest(p_item_ids) AS values_table(value);
 IF v_distinct<>v_count THEN
  RAISE EXCEPTION 'Duplicate P8 item UUIDs' USING ERRCODE='22023';
 END IF;
 v_fingerprint:=md5(concat_ws('|','bulk',v_list,v_source,
  v_source_id::text,v_target,v_target_id::text));
 PERFORM pg_advisory_xact_lock(hashtextextended('c34-p8:'||p_request_id::text,0));
 SELECT * INTO v_prior FROM private.c34_b14_p8_intent_receipts
 WHERE request_id=p_request_id FOR UPDATE;
 IF FOUND THEN
  IF v_prior.actor_id IS DISTINCT FROM v_actor
  OR v_prior.fingerprint IS DISTINCT FROM v_fingerprint THEN
   RAISE EXCEPTION 'Conflicting P8 bulk intent ID' USING ERRCODE='40001';
  END IF;
  RETURN v_prior.receipt;
 END IF;
 -- One PostgreSQL transaction: if any nested P6/P2 call fails, ALL previously
 -- formed offers/transfers and child receipts roll back together.
 -- Deterministic item order avoids disjoint-lock inversions in batch.
 FOR v_item IN SELECT x.value FROM unnest(p_item_ids) AS x(value)
  ORDER BY x.value
 LOOP
  -- Stable, nonclient child ID; collision with an existing request fails
  -- closed. The batch-level receipt retains the caller's request ID.
  v_child_id:=md5('c34-p8-child:'||p_request_id::text||':'||v_item::text)::uuid;
  v_child:=public.c34_b14_p8_dispatch_item_intent_v1(
   v_child_id,v_item,v_source,v_source_id::text,v_target,v_target_id::text);
  IF v_first_state IS NULL THEN v_first_state:=v_child->>'status'; END IF;
  IF v_first_state IS DISTINCT FROM v_child->>'status' THEN
   RAISE EXCEPTION 'Mixed NPC consent in one bulk intent' USING ERRCODE='40001';
  END IF;
  v_items:=v_items||jsonb_build_array(
   jsonb_set(v_child,'{request_id}',to_jsonb(p_request_id)));
 END LOOP;
 v_receipt:=jsonb_build_object('request_id',p_request_id,'receipts',v_items);
 INSERT INTO private.c34_b14_p8_intent_receipts(
  request_id,actor_id,fingerprint,receipt)
 VALUES(p_request_id,v_actor,v_fingerprint,v_receipt);
 RETURN v_receipt;
END;
$p8_bulk$;
REVOKE ALL ON FUNCTION public.c34_b14_p8_dispatch_item_intent_v1(
 uuid,uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.c34_b14_p8_dispatch_batch_intent_v1(
 uuid,uuid[],text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.c34_b14_p8_dispatch_item_intent_v1(
 uuid,uuid,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.c34_b14_p8_dispatch_batch_intent_v1(
 uuid,uuid[],text,text,text,text) TO authenticated;
COMMIT;