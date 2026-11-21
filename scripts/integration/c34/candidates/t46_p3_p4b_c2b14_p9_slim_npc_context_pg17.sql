-- C34 B14-P9 RESEARCH ONLY. Disposable, locally signed PostgreSQL 17.
-- Additive slim NPC profile-interaction context. NOT a production migration.
-- Never use P6's eager full backpack context for the profile-open request.
BEGIN;
DO $p9_guard$ BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regprocedure('public.c34_b14_p7_npc_backpack_page_v1(uuid,integer,timestamptz,uuid)') IS NULL
 OR to_regprocedure('public.c34_b14_p6_npc_capability_context_v1(uuid)') IS NULL
 OR to_regclass('private.c34_b14_p6_npc_grants') IS NULL
 THEN RAISE EXCEPTION 'P9 only follows P6/P7 in disposable local PG17';
 END IF;
END $p9_guard$;

CREATE OR REPLACE FUNCTION public.c34_b14_p9_npc_slim_context_v1(p_npc_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,private,auth
AS $p9_slim$
DECLARE
 v_uid uuid:=auth.uid();
 v_manager boolean;
 v_kind text; v_tags text[]; v_hidden boolean; v_state text;
 v_view boolean:=false; v_manage boolean:=false;
 v_withdraw boolean:=false; v_auto boolean:=false; v_control boolean:=false;
 v_worn jsonb:='[]'::jsonb;
BEGIN
 IF v_uid IS NULL OR p_npc_id IS NULL THEN
  RAISE EXCEPTION 'Sign-in and NPC required' USING ERRCODE='42501';
 END IF;
 v_manager:=private.c34_b14_p2_inventory_manager_v1();
 SELECT c.kind,c.tags,coalesce(c.is_hidden,false),coalesce(c.state,'')
 INTO v_kind,v_tags,v_hidden,v_state
 FROM public.characters c WHERE c.id=p_npc_id;
 IF NOT FOUND OR v_kind<>'npc'
 OR 'player-character'=ANY(coalesce(v_tags,'{}'::text[]))
 OR (NOT v_manager AND (v_hidden OR v_state='hidden')) THEN
  RAISE EXCEPTION 'NPC unavailable' USING ERRCODE='42501';
 END IF;
 SELECT
  coalesce(bool_or(g.enabled) FILTER(WHERE g.capability='view_backpack'),false),
  coalesce(bool_or(g.enabled) FILTER(WHERE g.capability='manage_equipment'),false),
  coalesce(bool_or(g.enabled) FILTER(WHERE g.capability='withdraw_items'),false),
  coalesce(bool_or(g.enabled) FILTER(WHERE g.capability='auto_accept_items'),false)
 INTO v_view,v_manage,v_withdraw,v_auto
 FROM private.c34_b14_p6_npc_grants g
 WHERE g.npc_id=p_npc_id AND g.user_id=v_uid;
 v_view:=v_manager OR v_view OR v_manage OR v_withdraw;
 v_manage:=v_manager OR v_manage;
 v_withdraw:=v_manager OR v_withdraw;
 v_auto:=v_manager OR v_auto;
 SELECT v_manager OR EXISTS(
  SELECT 1 FROM public.character_permissions cp
  WHERE cp.character_id=p_npc_id AND cp.user_id=v_uid
  AND (coalesce(cp.can_control,false) OR coalesce(cp.can_edit,false))
 ) INTO v_control;
 -- Public outward appearance only: at most 12 names; never a private item
 -- ID, full inventory row, card_payload, creator, currency, NPC sheet or spell.
 SELECT coalesce(jsonb_agg(jsonb_build_object('name',w.item_name)
  ORDER BY w.item_name),'[]'::jsonb) INTO v_worn
 FROM (
  SELECT i.item_name FROM public.inventory_items i
  WHERE i.owner_type='npc' AND i.owner_id=p_npc_id::text
  AND i.is_equipped IS TRUE
  ORDER BY i.item_name,i.id LIMIT 12
 ) w;
 RETURN jsonb_build_object(
  'npc_id',p_npc_id,'can_view_public_profile',true,
  'can_view_worn_gear',true,'worn_gear',v_worn,
  'can_view_backpack',v_view,'can_manage_equipment',v_manage,
  'can_withdraw_items',v_withdraw,'can_auto_accept_items',v_auto,
  'can_issue_encounter_commands',v_control
 );
END;
$p9_slim$;

REVOKE ALL ON FUNCTION public.c34_b14_p9_npc_slim_context_v1(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.c34_b14_p9_npc_slim_context_v1(uuid)
 TO authenticated;
COMMIT;
