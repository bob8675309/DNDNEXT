-- C34 B14-P14 UNINSTALLED RESEARCH candidate. DISPOSABLE PG17 ONLY.
-- Versioned P8-derived batch, separate private link table + sender status.
-- No original P6, P8, June RPC, runtime, deployment or hosted SQL changes.
BEGIN;
DO $p14_local_guard$ BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 OR to_regclass('private.c34_b14_p6_item_offers') IS NULL
 OR to_regclass('private.c34_b14_p8_intent_receipts') IS NULL
 OR to_regprocedure('public.c34_b14_p8_dispatch_batch_intent_v1(uuid,uuid[],text,text,text,text)') IS NULL
 OR to_regprocedure('public.c34_b14_p8_gm_decide_item_offer_v1(uuid,boolean)') IS NULL
 THEN RAISE EXCEPTION 'P14 requires disposable PG17 with P6 and P8' USING ERRCODE='42501'; END IF;
END $p14_local_guard$;

CREATE TABLE private.c34_b14_p14_batch_offer_links (
 parent_request_id uuid NOT NULL,
 child_offer_request_id uuid NOT NULL,
 item_id uuid NOT NULL,
 ordinal integer NOT NULL CHECK(ordinal BETWEEN 1 AND 50),
 PRIMARY KEY(parent_request_id,ordinal),
 UNIQUE(parent_request_id,item_id),
 UNIQUE(child_offer_request_id),
 CONSTRAINT c34_p14_parent_fk FOREIGN KEY(parent_request_id)
  REFERENCES private.c34_b14_p8_intent_receipts(request_id)
  DEFERRABLE INITIALLY DEFERRED,
 CONSTRAINT c34_p14_child_fk FOREIGN KEY(child_offer_request_id)
  REFERENCES private.c34_b14_p6_item_offers(request_id)
  DEFERRABLE INITIALLY DEFERRED
);
ALTER TABLE private.c34_b14_p14_batch_offer_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.c34_b14_p14_batch_offer_links FROM PUBLIC,anon,authenticated;

-- P14 function is a new name and has only a private child insert plus
-- a fail-closed unmapped-parent replay guard versus source-original P8.

CREATE OR REPLACE FUNCTION public.c34_b14_p14_dispatch_batch_intent_v1(
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
  -- Fail closed if P8 already recorded an NPC parent without P14 child links.
  IF v_target='npc' AND (SELECT count(*) FROM
   private.c34_b14_p14_batch_offer_links
   WHERE parent_request_id=p_request_id)<>v_count THEN
   RAISE EXCEPTION 'P14 NPC parent mapping unavailable' USING ERRCODE='40001';
  END IF;
  RETURN v_prior.receipt;
 END IF;
 -- One PostgreSQL transaction: if any nested P6/P2 call fails, ALL previously
 -- formed offers/transfers and child receipts roll back together.
 -- Deterministic item order avoids disjoint-lock inversions in batch.
 FOR v_item IN SELECT x.value FROM unnest(p_item_ids) AS x(value)
  ORDER BY x.value
 LOOP
  -- Unpredictable server-only child request ID. A client who can pick a
  -- parent UUID must NEVER preseed the derived single-intent receipt and
  -- trick the bulk handler into skipping a stale ownership check.
  -- Parent-level advisory locking + stored replay receipt provide stable
  -- idempotence without a predictable per-item nonce.
  v_child_id:=pg_catalog.gen_random_uuid();
  v_child:=public.c34_b14_p8_dispatch_item_intent_v1(
   v_child_id,v_item,v_source,v_source_id::text,v_target,v_target_id::text);
  IF v_target='npc' THEN
   -- Child ID is secret; insert before masking the original P8 receipt.
   -- Parent FK is deferred until the parent receipt is inserted below.
   INSERT INTO private.c34_b14_p14_batch_offer_links(
     parent_request_id,child_offer_request_id,item_id,ordinal)
   VALUES (p_request_id,v_child_id,v_item,jsonb_array_length(v_items)+1);
  END IF;
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


-- Sender-only CURRENT status. P8 receipt is immutable initial state;
-- P6 offer row is the actual current NPC state. No private card rows.
CREATE OR REPLACE FUNCTION public.c34_b14_p14_my_intent_status_v1(
 p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,private,auth
AS $p14_status$
DECLARE
 v_actor uuid:=auth.uid();
 v_parent private.c34_b14_p8_intent_receipts%ROWTYPE;
 v_initial jsonb;
 v_bulk boolean;
 v_target text;
 v_expected integer;
 v_found integer;
 v_items jsonb:='[]'::jsonb;
 v_status text;
 v_distinct integer;
BEGIN
 IF v_actor IS NULL OR p_request_id IS NULL THEN
  RAISE EXCEPTION 'Intent unavailable' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_parent FROM private.c34_b14_p8_intent_receipts
 WHERE request_id=p_request_id;
 IF NOT FOUND OR v_parent.actor_id IS DISTINCT FROM v_actor THEN
  RAISE EXCEPTION 'Intent unavailable' USING ERRCODE='42501';
 END IF;
 v_initial:=v_parent.receipt;
 v_bulk:=jsonb_typeof(v_initial->'receipts')='array';
 IF v_bulk THEN
  v_expected:=jsonb_array_length(v_initial->'receipts');
  IF v_expected NOT BETWEEN 1 AND 50 THEN
   RAISE EXCEPTION 'Invalid parent receipt' USING ERRCODE='40001';
  END IF;
  v_target:=v_initial#>>'{receipts,0,target_type}';
  IF v_target='npc' THEN
   SELECT count(*),
    coalesce(jsonb_agg(jsonb_build_object(
     'item_id',o.item_id,'status',o.state) ORDER BY l.ordinal),'[]'::jsonb)
   INTO v_found,v_items
   FROM private.c34_b14_p14_batch_offer_links l
   JOIN private.c34_b14_p6_item_offers o
    ON o.request_id=l.child_offer_request_id
    AND o.item_id=l.item_id
    AND o.source_user_id=v_actor
   WHERE l.parent_request_id=p_request_id;
   IF v_found<>v_expected OR EXISTS(
     SELECT 1 FROM jsonb_array_elements(v_initial->'receipts') child(value)
     WHERE child.value->>'target_type'<>'npc'
     OR NOT EXISTS(
       SELECT 1 FROM jsonb_array_elements(v_items) current_item(value)
       WHERE current_item.value->>'item_id'=child.value->>'item_id')
   ) THEN
    RAISE EXCEPTION 'NPC parent mapping unavailable' USING ERRCODE='40001';
   END IF;
  ELSIF v_target='player' THEN
   IF EXISTS(
     SELECT 1 FROM jsonb_array_elements(v_initial->'receipts') child(value)
     WHERE child.value->>'target_type'<>'player'
      OR child.value->>'status'<>'accepted'
   ) THEN
    RAISE EXCEPTION 'Account batch inconsistent' USING ERRCODE='40001';
   END IF;
   SELECT coalesce(jsonb_agg(jsonb_build_object(
      'item_id',child.value->>'item_id','status','accepted')
      ORDER BY child.seq),'[]'::jsonb)
   INTO v_items FROM jsonb_array_elements(v_initial->'receipts')
     WITH ORDINALITY child(value,seq);
  ELSE
   RAISE EXCEPTION 'Unsupported target' USING ERRCODE='40001';
  END IF;
 ELSE
  v_target:=v_initial->>'target_type';
  IF v_target='npc' THEN
   SELECT o.state INTO v_status
   FROM private.c34_b14_p6_item_offers o
   WHERE o.request_id=p_request_id AND o.source_user_id=v_actor
    AND o.item_id::text=v_initial->>'item_id';
   IF NOT FOUND THEN
    RAISE EXCEPTION 'NPC offer unavailable' USING ERRCODE='40001';
   END IF;
  ELSIF v_target='player' AND v_initial->>'status'='accepted' THEN
   v_status:='accepted';
  ELSE
   RAISE EXCEPTION 'Initial receipt inconsistent' USING ERRCODE='40001';
  END IF;
  v_items:=jsonb_build_array(jsonb_build_object(
    'item_id',v_initial->>'item_id','status',v_status));
 END IF;
 SELECT count(DISTINCT item.value->>'status') INTO v_distinct
 FROM jsonb_array_elements(v_items) item(value);
 IF v_distinct<>1 THEN v_status:='mixed';
 ELSE v_status:=v_items->0->>'status';
 END IF;
 RETURN jsonb_build_object(
  'request_id',p_request_id,'target_type',v_target,
  'status',v_status,'items',v_items);
END;
$p14_status$;

REVOKE ALL ON FUNCTION public.c34_b14_p14_dispatch_batch_intent_v1(
 uuid,uuid[],text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.c34_b14_p14_my_intent_status_v1(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.c34_b14_p14_dispatch_batch_intent_v1(
 uuid,uuid[],text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.c34_b14_p14_my_intent_status_v1(uuid)
 TO authenticated;
COMMIT;
