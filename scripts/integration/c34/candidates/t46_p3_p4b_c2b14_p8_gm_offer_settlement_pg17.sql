-- C34 B14-P8 GM OFFER SETTLEMENT: DISPOSABLE SIGNED RESEARCH ONLY.
-- NOT a production migration. Original P6 function body and active game routes stay unchanged.
-- This source-only candidate closes P6's recipient-control settlement gap ONLY
-- inside the disposable PG17 fixture. Legacy June/P2 transfer bypasses remain.
BEGIN;
DO $p8_gm_guard$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 OR to_regprocedure('public.c34_b14_p8_dispatch_item_intent_v1(uuid,uuid,text,text,text,text)') IS NULL
 OR to_regprocedure('public.c34_b14_p6_decide_item_offer_v1(uuid,boolean)') IS NULL
 THEN RAISE EXCEPTION 'P8 GM settlement requires disposable PG17 P6/P8 source';
 END IF;
END
$p8_gm_guard$;

-- Private pending-offer projection. No inventory row, item card_payload, or
-- private Forge sheet is returned. This is a GM-only queue, not a player inbox.
CREATE OR REPLACE FUNCTION public.c34_b14_p8_gm_pending_offers_v1(
 p_npc_id uuid DEFAULT NULL,p_limit integer DEFAULT 25
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,private,auth
AS $p8_gm_queue$
DECLARE v_rows jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT private.c34_b14_p2_inventory_manager_v1() THEN
  RAISE EXCEPTION 'GM role required' USING ERRCODE='42501';
 END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN
  RAISE EXCEPTION 'Invalid pending offer limit' USING ERRCODE='22023';
 END IF;
 SELECT coalesce(jsonb_agg(s.offer ORDER BY s.created_at,s.request_id),'[]'::jsonb)
 INTO v_rows
 FROM (
  SELECT o.created_at,o.request_id,
    jsonb_build_object('request_id',o.request_id,'item_name',i.item_name,
     'npc_id',o.target_npc_id,'npc_name',c.name,'source_owner_type',
     o.source_owner_type,'created_at',o.created_at,'status',o.state) AS offer
  FROM private.c34_b14_p6_item_offers o
  JOIN public.inventory_items i ON i.id=o.item_id
  JOIN public.characters c ON c.id=o.target_npc_id
  WHERE o.state='pending' AND (p_npc_id IS NULL OR o.target_npc_id=p_npc_id)
  ORDER BY o.created_at,o.request_id
  LIMIT p_limit
 ) s;
 RETURN v_rows;
END;
$p8_gm_queue$;

-- Deliberately versioned. Do NOT call unchanged P6 decide: its recipient
-- grant is not rechecked. Keep item -> source permission -> recipient NPC
-- -> recipient permission -> offer lock order for item-moving acceptance.
-- Read the offer without locking first to avoid an offer->item inversion.
-- Recheck terminal state under the final offer FOR UPDATE.
CREATE OR REPLACE FUNCTION public.c34_b14_p8_gm_decide_item_offer_v1(
 p_request_id uuid,p_accept boolean
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,private,auth
AS $p8_gm_decide$
DECLARE
 v_seen private.c34_b14_p6_item_offers%ROWTYPE;
 v_locked private.c34_b14_p6_item_offers%ROWTYPE;
 v_item public.inventory_items%ROWTYPE;
 v_allowed boolean;
 v_kind text; v_tags text[]; v_hidden boolean; v_state text;
 v_status text;
BEGIN
 IF auth.uid() IS NULL OR NOT private.c34_b14_p2_inventory_manager_v1() THEN
  RAISE EXCEPTION 'GM role required' USING ERRCODE='42501';
 END IF;
 IF p_request_id IS NULL OR p_accept IS NULL THEN
  RAISE EXCEPTION 'Invalid GM offer decision' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v_seen FROM private.c34_b14_p6_item_offers
 WHERE request_id=p_request_id;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Offer unavailable' USING ERRCODE='22023';
 END IF;
 IF v_seen.state<>'pending' THEN
  RAISE EXCEPTION 'Offer already decided' USING ERRCODE='40001';
 END IF;
 IF p_accept THEN
  -- Item is always first for acceptance: don't lock the offer first.
  SELECT * INTO v_item FROM public.inventory_items
   WHERE id=v_seen.item_id FOR UPDATE;
  IF NOT FOUND OR v_item.owner_type IS DISTINCT FROM v_seen.source_owner_type
   OR v_item.owner_id IS DISTINCT FROM v_seen.source_owner_id
   OR v_item.user_id IS DISTINCT FROM v_seen.source_user_id THEN
   RAISE EXCEPTION 'Source item changed' USING ERRCODE='40001';
  END IF;
  IF v_seen.source_owner_type='character' THEN
   SELECT coalesce(cp.can_inventory,false) OR coalesce(cp.can_edit,false)
   INTO v_allowed
   FROM public.character_permissions cp
   WHERE cp.character_id=v_seen.source_owner_id::uuid
     AND cp.user_id=v_seen.source_user_id FOR SHARE;
   IF NOT coalesce(v_allowed,false) THEN
    RAISE EXCEPTION 'Sender lost Forge inventory rights' USING ERRCODE='42501';
   END IF;
  END IF;
  SELECT c.kind,c.tags,coalesce(c.is_hidden,false),coalesce(c.state,'')
  INTO v_kind,v_tags,v_hidden,v_state
  FROM public.characters c WHERE c.id=v_seen.target_npc_id FOR SHARE;
  IF NOT FOUND OR v_kind<>'npc'
   OR 'player-character'=ANY(coalesce(v_tags,'{}'::text[]))
   OR v_hidden OR v_state='hidden' THEN
   RAISE EXCEPTION 'Recipient NPC no longer eligible' USING ERRCODE='42501';
  END IF;
  -- Account-owned player gifts still use GM pending consent. Only Forge
  -- character-owned donations require a CURRENT recipient controller.
  IF v_seen.source_owner_type='character' THEN
   SELECT coalesce(cp.can_control,false) OR coalesce(cp.can_edit,false)
   INTO v_allowed FROM public.character_permissions cp
   WHERE cp.character_id=v_seen.target_npc_id
     AND cp.user_id=v_seen.source_user_id FOR SHARE;
   IF NOT coalesce(v_allowed,false) THEN
    RAISE EXCEPTION 'Sender no longer controls recipient NPC' USING ERRCODE='42501';
   END IF;
  END IF;
 END IF;
 -- A competing cancel or decision can change the row after the first read.
 SELECT * INTO v_locked FROM private.c34_b14_p6_item_offers
 WHERE request_id=p_request_id FOR UPDATE;
 IF NOT FOUND OR v_locked.state<>'pending' THEN
  RAISE EXCEPTION 'Offer already decided' USING ERRCODE='40001';
 END IF;
 IF v_locked.item_id IS DISTINCT FROM v_seen.item_id
 OR v_locked.source_owner_type IS DISTINCT FROM v_seen.source_owner_type
 OR v_locked.source_owner_id IS DISTINCT FROM v_seen.source_owner_id
 OR v_locked.source_user_id IS DISTINCT FROM v_seen.source_user_id
 OR v_locked.target_npc_id IS DISTINCT FROM v_seen.target_npc_id THEN
  RAISE EXCEPTION 'Offer changed during settlement' USING ERRCODE='40001';
 END IF;
 IF p_accept THEN
  UPDATE public.inventory_items
   SET owner_type='npc',owner_id=v_seen.target_npc_id::text,
       user_id=NULL,is_equipped=false,equip_slot=NULL,updated_at=now()
   WHERE id=v_seen.item_id;
 END IF;
 v_status:=CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END;
 UPDATE private.c34_b14_p6_item_offers
 SET state=v_status,decided_by=auth.uid(),decided_at=now()
 WHERE request_id=p_request_id;
 RETURN jsonb_build_object('request_id',p_request_id,'status',v_status);
END;
$p8_gm_decide$;

-- The OLD P6 decision endpoint is otherwise an active control-revocation
-- bypass. Close its authenticated EXECUTE in this same disposable fixture.
-- This is NOT a green light to retire it on the hosted service.
REVOKE ALL ON FUNCTION public.c34_b14_p6_decide_item_offer_v1(uuid,boolean)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.c34_b14_p8_gm_pending_offers_v1(uuid,integer)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.c34_b14_p8_gm_decide_item_offer_v1(uuid,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.c34_b14_p8_gm_pending_offers_v1(uuid,integer)
 TO authenticated;
GRANT EXECUTE ON FUNCTION public.c34_b14_p8_gm_decide_item_offer_v1(uuid,boolean)
 TO authenticated;
COMMIT;
