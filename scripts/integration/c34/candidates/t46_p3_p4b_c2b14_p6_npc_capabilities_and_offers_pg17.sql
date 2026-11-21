-- C34 B14-P6 RESEARCH-ONLY disposable PG17 signed fixture; NOT a migration.
-- GM-selected capability flags remain independent of combat can_control.
-- Independent/hired NPCs receive item OFFERS (zero immediate inventory move).
-- Explicit auto_accept_items plus active can_control/can_edit means immediate
-- acceptance for a fully delegated NPC, with no NPC property withdrawal grant.
-- NPC quest requests/AI decisions and tactical spell control are FUTURE work.
BEGIN;
DO $p6_guard$
BEGIN
 IF current_database()<>'postgres'
    OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
    OR to_regprocedure('public.c34_b14_p4_send_character_gear_to_controlled_npc_v1(uuid,uuid,uuid)') IS NULL
 THEN
   RAISE EXCEPTION 'P6 must run only after source-original P4 in disposable PostgreSQL17';
 END IF;
END;
$p6_guard$;

CREATE TABLE IF NOT EXISTS private.c34_b14_p6_npc_grants (
 npc_id uuid NOT NULL REFERENCES public.characters(id),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 capability text NOT NULL CHECK (
   capability IN ('view_backpack','manage_equipment','withdraw_items','auto_accept_items')
 ),
 enabled boolean NOT NULL DEFAULT false,
 granted_by uuid NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (npc_id,user_id,capability)
);
ALTER TABLE private.c34_b14_p6_npc_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.c34_b14_p6_npc_grants FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS private.c34_b14_p6_item_offers (
 request_id uuid PRIMARY KEY,
 item_id uuid NOT NULL REFERENCES public.inventory_items(id),
 source_user_id uuid NOT NULL REFERENCES auth.users(id),
 source_owner_type text NOT NULL CHECK (source_owner_type IN ('player','character')),
 source_owner_id text NOT NULL,
 target_npc_id uuid NOT NULL REFERENCES public.characters(id),
 state text NOT NULL CHECK (state IN ('pending','accepted','declined','cancelled')),
 decided_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 decided_at timestamptz
);
ALTER TABLE private.c34_b14_p6_item_offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.c34_b14_p6_item_offers FROM PUBLIC,anon,authenticated;
CREATE UNIQUE INDEX IF NOT EXISTS c34_b14_p6_one_pending_per_item
 ON private.c34_b14_p6_item_offers(item_id) WHERE state='pending';

CREATE OR REPLACE FUNCTION public.c34_b14_p6_set_npc_capability_v1(
 p_npc_id uuid, p_user_id uuid, p_capability text, p_enabled boolean
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,private,auth
AS $p6_grant$
DECLARE v_tags text[]; v_kind text;
BEGIN
 IF auth.uid() IS NULL OR NOT private.c34_b14_p2_inventory_manager_v1() THEN
   RAISE EXCEPTION 'Manager role required' USING ERRCODE='42501';
 END IF;
 IF p_npc_id IS NULL OR p_user_id IS NULL OR p_enabled IS NULL
    OR p_capability NOT IN ('view_backpack','manage_equipment','withdraw_items','auto_accept_items')
 THEN RAISE EXCEPTION 'Invalid grant' USING ERRCODE='22023';
 END IF;
 SELECT c.kind,c.tags INTO v_kind,v_tags FROM public.characters c
 WHERE c.id=p_npc_id FOR SHARE;
 IF NOT FOUND OR v_kind<>'npc' OR 'player-character'=ANY(coalesce(v_tags,'{}'::text[])) THEN
   RAISE EXCEPTION 'Target must be a genuine NPC, never a Forge player character'
   USING ERRCODE='42501';
 END IF;
 INSERT INTO private.c34_b14_p6_npc_grants(npc_id,user_id,capability,enabled,granted_by,updated_at)
 VALUES(p_npc_id,p_user_id,p_capability,p_enabled,auth.uid(),now())
 ON CONFLICT(npc_id,user_id,capability)
 DO UPDATE SET enabled=excluded.enabled,granted_by=excluded.granted_by,
 updated_at=excluded.updated_at;
 RETURN jsonb_build_object('npc_id',p_npc_id,'capability',p_capability,'enabled',p_enabled);
END;
$p6_grant$;

CREATE OR REPLACE FUNCTION public.c34_b14_p6_npc_capability_context_v1(p_npc_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,private,auth
AS $p6_context$
DECLARE
 v_uid uuid:=auth.uid(); v_kind text; v_tags text[]; v_hidden boolean; v_state text;
 v_manager boolean; v_view boolean; v_manage boolean; v_withdraw boolean;
 v_auto boolean; v_control boolean; v_backpack jsonb:='[]'::jsonb;
 v_equipped jsonb:='[]'::jsonb;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign-in required' USING ERRCODE='42501'; END IF;
 v_manager:=private.c34_b14_p2_inventory_manager_v1();
 SELECT kind,tags,coalesce(is_hidden,false),coalesce(state,'') INTO
 v_kind,v_tags,v_hidden,v_state FROM public.characters WHERE id=p_npc_id;
 IF NOT FOUND OR v_kind<>'npc' OR 'player-character'=ANY(coalesce(v_tags,'{}'::text[]))
   OR (NOT v_manager AND (v_hidden OR v_state='hidden')) THEN
   RAISE EXCEPTION 'NPC unavailable' USING ERRCODE='42501';
 END IF;
 SELECT
   v_manager OR coalesce(bool_or(enabled) FILTER(WHERE capability='view_backpack'),false),
   v_manager OR coalesce(bool_or(enabled) FILTER(WHERE capability='manage_equipment'),false),
   v_manager OR coalesce(bool_or(enabled) FILTER(WHERE capability='withdraw_items'),false),
   v_manager OR coalesce(bool_or(enabled) FILTER(WHERE capability='auto_accept_items'),false)
 INTO v_view,v_manage,v_withdraw,v_auto
 FROM private.c34_b14_p6_npc_grants
 WHERE npc_id=p_npc_id AND user_id=v_uid;
 SELECT v_manager OR EXISTS(
   SELECT 1 FROM public.character_permissions cp
    WHERE cp.character_id=p_npc_id AND cp.user_id=v_uid
    AND (coalesce(cp.can_control,false) OR coalesce(cp.can_edit,false))
 ) INTO v_control;
 -- Wearable objects are a coarse public visual only; never include hidden
 -- card_payload, full item_id, source user id or exact private inventory row.
 SELECT coalesce(jsonb_agg(jsonb_build_object('name',i.item_name)
   ORDER BY i.item_name),'[]'::jsonb)
 INTO v_equipped
 FROM public.inventory_items i WHERE i.owner_type='npc'
  AND i.owner_id=p_npc_id::text AND i.is_equipped IS TRUE;
 IF v_view OR v_manage OR v_withdraw THEN
   SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',i.id,'name',i.item_name,'equipped',coalesce(i.is_equipped,false))
    ORDER BY i.item_name),'[]'::jsonb)
   INTO v_backpack FROM public.inventory_items i
   WHERE i.owner_type='npc' AND i.owner_id=p_npc_id::text;
 END IF;
 RETURN jsonb_build_object(
   'npc_id',p_npc_id,'can_view_public_profile',true,
   'can_view_worn_gear',true,'worn_gear',v_equipped,
   'can_view_backpack',v_view OR v_manage OR v_withdraw,
   'can_manage_equipment',v_manage,
   'can_withdraw_items',v_withdraw,
   'can_auto_accept_items',v_auto,
   'can_issue_encounter_commands',v_control,
   'backpack',v_backpack
 );
END;
$p6_context$;

CREATE OR REPLACE FUNCTION public.c34_b14_p6_offer_item_v1(
 p_request_id uuid,p_item_id uuid,p_source_owner_type text,
 p_source_owner_id text,p_target_npc_id uuid
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,private,auth
AS $p6_offer$
DECLARE
 v_uid uuid:=auth.uid(); v_row public.inventory_items%ROWTYPE;
 v_kind text; v_tags text[]; v_hidden boolean; v_state text;
 v_auto boolean:=false; v_control boolean:=false;
 v_source_allowed boolean:=false; v_status text:='pending';
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign-in required' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR p_item_id IS NULL OR p_target_npc_id IS NULL
   OR p_source_owner_type NOT IN ('player','character')
   OR p_source_owner_id IS NULL THEN
   RAISE EXCEPTION 'Invalid item offer' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v_row FROM public.inventory_items WHERE id=p_item_id FOR UPDATE;
 IF NOT FOUND OR v_row.owner_type IS DISTINCT FROM p_source_owner_type
   OR v_row.owner_id IS DISTINCT FROM p_source_owner_id THEN
   RAISE EXCEPTION 'Item ownership changed' USING ERRCODE='40001';
 END IF;
 IF v_row.user_id IS DISTINCT FROM v_uid THEN
   RAISE EXCEPTION 'Source item is not held by caller' USING ERRCODE='42501';
 END IF;
 IF p_source_owner_type='player' THEN
   IF p_source_owner_id<>v_uid::text THEN
     RAISE EXCEPTION 'Not account-owned item' USING ERRCODE='42501';
   END IF;
 ELSE
   IF p_source_owner_id !~ '^[0-9a-fA-F-]{36}$' THEN
     RAISE EXCEPTION 'Invalid source character UUID' USING ERRCODE='22023';
   END IF;
   IF NOT EXISTS(
    SELECT 1 FROM public.characters c
    WHERE c.id=p_source_owner_id::uuid
      AND 'player-character'=ANY(coalesce(c.tags,'{}'::text[]))
   ) THEN RAISE EXCEPTION 'Source must be a real Forge player character' USING ERRCODE='42501'; END IF;
   SELECT coalesce(cp.can_inventory,false) OR coalesce(cp.can_edit,false)
   INTO v_source_allowed
   FROM public.character_permissions cp
   WHERE cp.character_id=p_source_owner_id::uuid AND cp.user_id=v_uid
   FOR SHARE;
   IF NOT coalesce(v_source_allowed,false) THEN
     RAISE EXCEPTION 'Current source inventory permission required' USING ERRCODE='42501';
   END IF;
 END IF;
 SELECT kind,tags,coalesce(is_hidden,false),coalesce(state,'')
 INTO v_kind,v_tags,v_hidden,v_state
 FROM public.characters WHERE id=p_target_npc_id FOR SHARE;
 IF NOT FOUND OR v_kind<>'npc' OR 'player-character'=ANY(coalesce(v_tags,'{}'::text[]))
 OR v_hidden OR v_state='hidden' THEN
   RAISE EXCEPTION 'Target not eligible for NPC offer' USING ERRCODE='42501';
 END IF;
 SELECT coalesce(enabled,false) INTO v_auto
 FROM private.c34_b14_p6_npc_grants
 WHERE npc_id=p_target_npc_id AND user_id=v_uid AND capability='auto_accept_items'
 FOR SHARE;
 SELECT coalesce(cp.can_control,false) OR coalesce(cp.can_edit,false)
 INTO v_control FROM public.character_permissions cp
 WHERE cp.character_id=p_target_npc_id AND cp.user_id=v_uid FOR SHARE;
 IF coalesce(v_auto,false) AND coalesce(v_control,false) THEN
  v_status:='accepted';
 END IF;
 -- Prevent duplicate pending offers; no quest progress or item mint.
 INSERT INTO private.c34_b14_p6_item_offers(
 request_id,item_id,source_user_id,source_owner_type,source_owner_id,
 target_npc_id,state,decided_by,decided_at)
 VALUES(p_request_id,p_item_id,v_uid,p_source_owner_type,p_source_owner_id,
 p_target_npc_id,v_status,CASE WHEN v_status='accepted' THEN v_uid ELSE NULL END,
 CASE WHEN v_status='accepted' THEN now() ELSE NULL END);
 IF v_status='accepted' THEN
   UPDATE public.inventory_items SET owner_type='npc',
    owner_id=p_target_npc_id::text,user_id=NULL,is_equipped=false,
    equip_slot=NULL,updated_at=now()
   WHERE id=p_item_id;
 END IF;
 RETURN jsonb_build_object('request_id',p_request_id,'status',v_status,
  'auto_accepted',v_status='accepted');
END;
$p6_offer$;

CREATE OR REPLACE FUNCTION public.c34_b14_p6_decide_item_offer_v1(
 p_request_id uuid,p_accept boolean
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,private,auth
AS $p6_decide$
DECLARE v_offer private.c34_b14_p6_item_offers%ROWTYPE;
 v_item public.inventory_items%ROWTYPE; v_active boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT private.c34_b14_p2_inventory_manager_v1() THEN
   RAISE EXCEPTION 'NPC consent decision requires manager' USING ERRCODE='42501';
 END IF;
 IF p_request_id IS NULL OR p_accept IS NULL THEN
   RAISE EXCEPTION 'Invalid NPC decision' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v_offer FROM private.c34_b14_p6_item_offers
 WHERE request_id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Offer not found' USING ERRCODE='22023'; END IF;
 IF v_offer.state<>'pending' THEN
   RAISE EXCEPTION 'Offer is no longer pending' USING ERRCODE='40001';
 END IF;
 IF p_accept THEN
   SELECT * INTO v_item FROM public.inventory_items
   WHERE id=v_offer.item_id FOR UPDATE;
   IF NOT FOUND OR v_item.owner_type IS DISTINCT FROM v_offer.source_owner_type
   OR v_item.owner_id IS DISTINCT FROM v_offer.source_owner_id
   OR v_item.user_id IS DISTINCT FROM v_offer.source_user_id THEN
     RAISE EXCEPTION 'Source item changed; cannot accept' USING ERRCODE='40001';
   END IF;
   IF v_offer.source_owner_type='character' THEN
     SELECT coalesce(cp.can_inventory,false) OR coalesce(cp.can_edit,false)
     INTO v_active FROM public.character_permissions cp
     WHERE cp.character_id=v_offer.source_owner_id::uuid AND cp.user_id=v_offer.source_user_id
     FOR SHARE;
     IF NOT coalesce(v_active,false) THEN
       RAISE EXCEPTION 'Sender lost source inventory rights' USING ERRCODE='42501';
     END IF;
   END IF;
   IF NOT EXISTS(SELECT 1 FROM public.characters c WHERE c.id=v_offer.target_npc_id
     AND c.kind='npc' AND NOT ('player-character'=ANY(coalesce(c.tags,'{}'::text[])))) THEN
     RAISE EXCEPTION 'NPC destination no longer valid' USING ERRCODE='42501';
   END IF;
   UPDATE public.inventory_items SET owner_type='npc',
    owner_id=v_offer.target_npc_id::text,user_id=NULL,is_equipped=false,
    equip_slot=NULL,updated_at=now() WHERE id=v_offer.item_id;
 END IF;
 UPDATE private.c34_b14_p6_item_offers
 SET state=CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
 decided_by=auth.uid(),decided_at=now() WHERE request_id=p_request_id;
 RETURN jsonb_build_object('request_id',p_request_id,
  'status',CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END);
END;
$p6_decide$;

CREATE OR REPLACE FUNCTION public.c34_b14_p6_cancel_item_offer_v1(
 p_request_id uuid
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,private,auth
AS $p6_cancel$
DECLARE v_offer private.c34_b14_p6_item_offers%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign-in required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_offer FROM private.c34_b14_p6_item_offers
 WHERE request_id=p_request_id FOR UPDATE;
 IF NOT FOUND OR v_offer.source_user_id IS DISTINCT FROM auth.uid() THEN
   RAISE EXCEPTION 'Offer unavailable' USING ERRCODE='42501';
 END IF;
 IF v_offer.state<>'pending' THEN
   RAISE EXCEPTION 'Offer is no longer pending' USING ERRCODE='40001';
 END IF;
 UPDATE private.c34_b14_p6_item_offers
 SET state='cancelled',decided_by=auth.uid(),decided_at=now()
 WHERE request_id=p_request_id;
 RETURN jsonb_build_object('request_id',p_request_id,'status','cancelled');
END;
$p6_cancel$;

-- Original versioned direct P4 gift would bypass NPC consent; block it in
-- the P6 scratch stage AFTER accepted P4 signed tests have run. A production
-- release must also close ordinary legacy/P2 direct NPC transfers atomically.
REVOKE EXECUTE ON FUNCTION
 public.c34_b14_p4_send_character_gear_to_controlled_npc_v1(uuid,uuid,uuid)
 FROM authenticated;
REVOKE ALL ON FUNCTION
 public.c34_b14_p4_send_character_gear_to_controlled_npc_v1(uuid,uuid,uuid)
 FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.c34_b14_p6_set_npc_capability_v1(uuid,uuid,text,boolean)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.c34_b14_p6_npc_capability_context_v1(uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.c34_b14_p6_offer_item_v1(uuid,uuid,text,text,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.c34_b14_p6_decide_item_offer_v1(uuid,boolean)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.c34_b14_p6_cancel_item_offer_v1(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.c34_b14_p6_set_npc_capability_v1(uuid,uuid,text,boolean)
 TO authenticated;
GRANT EXECUTE ON FUNCTION public.c34_b14_p6_npc_capability_context_v1(uuid)
 TO authenticated;
GRANT EXECUTE ON FUNCTION public.c34_b14_p6_offer_item_v1(uuid,uuid,text,text,uuid)
 TO authenticated;
GRANT EXECUTE ON FUNCTION public.c34_b14_p6_decide_item_offer_v1(uuid,boolean)
 TO authenticated;
GRANT EXECUTE ON FUNCTION public.c34_b14_p6_cancel_item_offer_v1(uuid)
 TO authenticated;
COMMIT;
