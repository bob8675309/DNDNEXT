-- C34 B14-P7 RESEARCH-ONLY, disposable local GoTrue/PostgREST/PostgreSQL17.
-- NOT a hosted migration. Never alters the original NPC panel or legacy RPCs.
-- Tight, REDACTED, KEYSET-PAGINATED NPC inventory read and separate EQUIP grant.
-- Original can_inventory can also authorize the original equip RPC; do NOT
-- set that existing column simply to grant hired NPCs read-only backpack.
BEGIN;
DO $p7_guard$ BEGIN
 IF current_database() <> 'postgres'
 OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 OR to_regprocedure('public.c34_b14_p6_npc_capability_context_v1(uuid)') IS NULL
 OR to_regclass('private.c34_b14_p6_npc_grants') IS NULL
 THEN RAISE EXCEPTION 'P7 only allowed after P6 in disposable local PG17';
 END IF;
END $p7_guard$;

-- Disposable C34 fixtures use an intentionally reduced June inventory table
-- without created_at. Live production TABLE METADATA has created_at timestamptz.
-- Fill this missing column ONLY here, guarded to disposable PG17 above; never
-- rewrite the source-original shared fixture or hosted table as a workaround.
ALTER TABLE public.inventory_items
 ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.c34_b14_p7_npc_backpack_page_v1(
 p_npc_id uuid,
 p_page_size integer DEFAULT 20,
 p_after_created_at timestamptz DEFAULT NULL,
 p_after_item_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,private,auth
AS $p7_page$
DECLARE
 v_uid uuid:=auth.uid();
 v_manager boolean;
 v_kind text; v_tags text[]; v_hidden boolean; v_state text;
 v_allowed boolean:=false;
 v_cap_enabled boolean:=false;
 v_item record;
 v_items jsonb:='[]'::jsonb;
 v_seen integer:=0;
 v_more boolean:=false;
 v_cursor_at timestamptz;
 v_cursor_id uuid;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign-in required' USING ERRCODE='42501'; END IF;
 IF p_npc_id IS NULL OR p_page_size IS NULL OR p_page_size NOT BETWEEN 1 AND 40
 OR ((p_after_created_at IS NULL) <> (p_after_item_id IS NULL)) THEN
   RAISE EXCEPTION 'Invalid bounded cursor or page size' USING ERRCODE='22023';
 END IF;
 v_manager:=private.c34_b14_p2_inventory_manager_v1();
 SELECT c.kind,c.tags,coalesce(c.is_hidden,false),coalesce(c.state,'')
 INTO v_kind,v_tags,v_hidden,v_state FROM public.characters c WHERE c.id=p_npc_id;
 IF NOT FOUND OR v_kind<>'npc'
  OR 'player-character'=ANY(coalesce(v_tags,'{}'::text[]))
  OR (NOT v_manager AND (v_hidden OR v_state='hidden')) THEN
    RAISE EXCEPTION 'NPC inventory unavailable' USING ERRCODE='42501';
 END IF;
 SELECT coalesce(bool_or(enabled),false) INTO v_cap_enabled
 FROM private.c34_b14_p6_npc_grants g
 WHERE g.npc_id=p_npc_id AND g.user_id=v_uid
  AND g.capability IN ('view_backpack','manage_equipment','withdraw_items');
 v_allowed:=v_manager OR coalesce(v_cap_enabled,false);
 IF NOT v_allowed THEN RAISE EXCEPTION 'NPC backpack permission required' USING ERRCODE='42501'; END IF;

 -- A keyset cursor avoids offset scanning and preserves deterministic page
 -- ordering when new rows arrive. Only safe display fields are selected;
 -- no card_payload, user_id, linked quest, notes or GM-facing metadata.
 FOR v_item IN
   SELECT i.id,i.item_name,i.item_type,i.item_rarity,
    coalesce(i.is_equipped,false) AS equipped,i.equip_slot,i.created_at
   FROM public.inventory_items i
   WHERE i.owner_type='npc' AND i.owner_id=p_npc_id::text
   AND (p_after_created_at IS NULL
    OR (i.created_at,i.id)<(p_after_created_at,p_after_item_id))
   ORDER BY i.created_at DESC,i.id DESC
   LIMIT p_page_size+1
 LOOP
   IF v_seen=p_page_size THEN v_more:=true; EXIT; END IF;
   v_items:=v_items||jsonb_build_array(jsonb_build_object(
      'id',v_item.id,'name',v_item.item_name,
      'type',v_item.item_type,'rarity',v_item.item_rarity,
      'is_equipped',v_item.equipped,'equip_slot',v_item.equip_slot
   ));
   v_seen:=v_seen+1;
   v_cursor_at:=v_item.created_at;
   v_cursor_id:=v_item.id;
 END LOOP;
 RETURN jsonb_build_object(
  'npc_id',p_npc_id,'items',v_items,
  'page_size',p_page_size,'has_more',v_more,
  'next_cursor',CASE WHEN v_more THEN jsonb_build_object(
      'created_at',v_cursor_at,'item_id',v_cursor_id) ELSE NULL END
 );
END;
$p7_page$;

CREATE OR REPLACE FUNCTION public.c34_b14_p7_set_npc_equipment_v1(
 p_npc_id uuid,
 p_item_id uuid,
 p_is_equipped boolean,
 p_equip_slot text,
 p_expected_equipped boolean
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,private,auth
AS $p7_equip$
DECLARE
 v_uid uuid:=auth.uid();
 v_manager boolean;
 v_kind text; v_tags text[]; v_hidden boolean; v_state text;
 v_allowed boolean:=false;
 v_item public.inventory_items%ROWTYPE;
 v_slot text:=lower(nullif(btrim(coalesce(p_equip_slot,'')),''));
 v_allowed_slots constant text[]:=ARRAY[
  'face','throat','body','waist','hands','feet','head','shoulders',
  'arms','ring_1','ring_2','misc_1','misc_2','weapon_1','weapon_2','weapon_3'];
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign-in required' USING ERRCODE='42501'; END IF;
 IF p_npc_id IS NULL OR p_item_id IS NULL OR p_is_equipped IS NULL
 OR p_expected_equipped IS NULL THEN
   RAISE EXCEPTION 'NPC/item/desired and expected state required' USING ERRCODE='22023';
 END IF;
 IF p_is_equipped AND (v_slot IS NULL OR NOT(v_slot=ANY(v_allowed_slots))) THEN
   RAISE EXCEPTION 'Invalid equipment slot' USING ERRCODE='22023';
 END IF;
 IF NOT p_is_equipped AND v_slot IS NOT NULL THEN
   RAISE EXCEPTION 'Unequip must not supply a slot' USING ERRCODE='22023';
 END IF;
 v_manager:=private.c34_b14_p2_inventory_manager_v1();
 -- Authoritatively lock NPC before item. Concurrent equipment updates for
 -- this one NPC serialize; migrations must audit lock order with ALL item
 -- transfers and pending NPC offer settlement before deploying.
 SELECT c.kind,c.tags,coalesce(c.is_hidden,false),coalesce(c.state,'')
 INTO v_kind,v_tags,v_hidden,v_state
 FROM public.characters c WHERE c.id=p_npc_id FOR UPDATE;
 IF NOT FOUND OR v_kind<>'npc'
 OR 'player-character'=ANY(coalesce(v_tags,'{}'::text[]))
 OR (NOT v_manager AND (v_hidden OR v_state='hidden')) THEN
   RAISE EXCEPTION 'NPC equipment unavailable' USING ERRCODE='42501';
 END IF;
 IF NOT v_manager THEN
  SELECT coalesce(g.enabled,false) INTO v_allowed
  FROM private.c34_b14_p6_npc_grants g
  WHERE g.npc_id=p_npc_id AND g.user_id=v_uid AND g.capability='manage_equipment'
  FOR SHARE;
  IF NOT coalesce(v_allowed,false) THEN
    RAISE EXCEPTION 'Equipment-management permission required' USING ERRCODE='42501';
  END IF;
 END IF;

 SELECT * INTO v_item FROM public.inventory_items i
 WHERE i.id=p_item_id AND i.owner_type='npc' AND i.owner_id=p_npc_id::text
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NPC item not found' USING ERRCODE='42501'; END IF;
 IF coalesce(v_item.is_equipped,false) IS DISTINCT FROM p_expected_equipped THEN
   RAISE EXCEPTION 'Equipment state changed; refresh' USING ERRCODE='40001';
 END IF;
 IF p_is_equipped AND EXISTS (
  SELECT 1 FROM public.inventory_items i
  WHERE i.owner_type='npc' AND i.owner_id=p_npc_id::text
    AND i.is_equipped IS TRUE AND i.equip_slot=v_slot AND i.id<>p_item_id
 ) THEN
   RAISE EXCEPTION 'Equipment slot already occupied' USING ERRCODE='23505';
 END IF;
 UPDATE public.inventory_items SET
  is_equipped=p_is_equipped,
  equip_slot=CASE WHEN p_is_equipped THEN v_slot ELSE NULL END,
  updated_at=now()
 WHERE id=p_item_id;
 -- Never return the full inventory row (card_payload / user_id / GM notes).
 RETURN jsonb_build_object('id',v_item.id,'npc_id',p_npc_id,
  'is_equipped',p_is_equipped,
  'equip_slot',CASE WHEN p_is_equipped THEN v_slot ELSE NULL END);
END;
$p7_equip$;

REVOKE ALL ON FUNCTION public.c34_b14_p7_npc_backpack_page_v1(uuid,integer,timestamptz,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.c34_b14_p7_set_npc_equipment_v1(uuid,uuid,boolean,text,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.c34_b14_p7_npc_backpack_page_v1(uuid,integer,timestamptz,uuid)
 TO authenticated;
GRANT EXECUTE ON FUNCTION public.c34_b14_p7_set_npc_equipment_v1(uuid,uuid,boolean,text,boolean)
 TO authenticated;
COMMIT;
