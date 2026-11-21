-- C34 B14-P4: RESEARCH ONLY. Disposable PG17; NOT a production migration.
-- Owner decision 2026-11-21: do NOT implement transfers between player
-- characters on one account. Permit character-scoped equipment to henchmen
-- and sidekicks under current authenticated delegated control. Existing
-- other-player trade and account-owned item flows remain unchanged.
-- Source original PR #312 adds can_control independently of can_inventory.
-- This fixture adds ONLY that column locally; original PR312 candidate, map,
-- Forge v3 and all original transfer functions remain unmodified.
BEGIN;

DO $p4_local_guard$
BEGIN
  IF current_database() <> 'postgres'
     OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
     OR to_regclass('auth.users') IS NULL
     OR to_regclass('public.character_permissions') IS NULL
     OR to_regprocedure('public.c34_b14_p2_transfer_inventory_item_v1(uuid,text,text,text,text)') IS NULL
  THEN RAISE EXCEPTION 'P4 source research must run only in disposable local GoTrue/PostgREST PG17';
  END IF;
END;
$p4_local_guard$;

-- Exact independent permission column declaration from held PR #312:
ALTER TABLE public.character_permissions
  ADD COLUMN IF NOT EXISTS can_control boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.c34_b14_p4_send_character_gear_to_controlled_npc_v1(
  p_item_id uuid,
  p_expected_source_character_id uuid,
  p_target_npc_id uuid
)
RETURNS public.inventory_items
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $b14p4$
DECLARE
  v_caller uuid := auth.uid();
  v_manager boolean;
  v_item public.inventory_items%ROWTYPE;
  v_result public.inventory_items%ROWTYPE;
  v_source_tags text[];
  v_target_kind text;
  v_target_hidden boolean;
  v_target_state text;
  v_target_tags text[];
  v_source_inventory_access boolean := false;
  v_recipient_controls boolean := false;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Sign-in required for character equipment transfer' USING ERRCODE = '42501';
  END IF;
  IF p_item_id IS NULL OR p_expected_source_character_id IS NULL OR p_target_npc_id IS NULL THEN
    RAISE EXCEPTION 'Source item, source character and destination NPC are required' USING ERRCODE = '22023';
  END IF;

  v_manager := private.c34_b14_p2_inventory_manager_v1();
  SELECT * INTO v_item FROM public.inventory_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source equipment not found' USING ERRCODE = '22023';
  END IF;
  IF v_item.owner_type IS DISTINCT FROM 'character'
     OR v_item.owner_id IS DISTINCT FROM p_expected_source_character_id::text
  THEN
    RAISE EXCEPTION 'Character equipment ownership changed; refresh and retry' USING ERRCODE = '40001';
  END IF;

  SELECT c.tags INTO v_source_tags FROM public.characters c
  WHERE c.id = p_expected_source_character_id FOR SHARE;
  IF NOT FOUND OR NOT ('player-character' = ANY(coalesce(v_source_tags,'{}'::text[]))) THEN
    RAISE EXCEPTION 'Source must be a created player character' USING ERRCODE = '42501';
  END IF;

  -- Verify both source row provenance and the CURRENT source-character ACL.
  -- A stale account user_id is insufficient to move character-scoped gear.
  IF NOT v_manager THEN
    IF v_item.user_id IS DISTINCT FROM v_caller THEN
      RAISE EXCEPTION 'Source character gear belongs to another account' USING ERRCODE = '42501';
    END IF;
    SELECT coalesce(cp.can_inventory,false) OR coalesce(cp.can_edit,false)
      INTO v_source_inventory_access
    FROM public.character_permissions cp
    WHERE cp.character_id = p_expected_source_character_id AND cp.user_id = v_caller
    FOR SHARE;
    IF NOT coalesce(v_source_inventory_access,false) THEN
      RAISE EXCEPTION 'Current source character inventory permission required' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT c.kind,coalesce(c.is_hidden,false),coalesce(c.state,''),c.tags
    INTO v_target_kind,v_target_hidden,v_target_state,v_target_tags
  FROM public.characters c WHERE c.id = p_target_npc_id FOR SHARE;
  IF NOT FOUND OR v_target_kind IS DISTINCT FROM 'npc'
    OR 'player-character' = ANY(coalesce(v_target_tags,'{}'::text[])) THEN
    RAISE EXCEPTION 'Controlled NPC destination required; no player-character recipient' USING ERRCODE = '42501';
  END IF;
  IF NOT v_manager AND (v_target_hidden OR v_target_state = 'hidden') THEN
    RAISE EXCEPTION 'Hidden NPC destination unavailable to player' USING ERRCODE = '42501';
  END IF;
  IF NOT v_manager THEN
    SELECT coalesce(cp.can_control,false) OR coalesce(cp.can_edit,false)
      INTO v_recipient_controls
    FROM public.character_permissions cp
    WHERE cp.character_id = p_target_npc_id AND cp.user_id = v_caller
    FOR SHARE;
    IF NOT coalesce(v_recipient_controls,false) THEN
      RAISE EXCEPTION 'Current delegated control of destination NPC required' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- DONATION ONLY: can_control is sufficient to receive this one item but
  -- does not confer inventory SELECT/equip/edit, Sheet, secrets or spell access.
  UPDATE public.inventory_items
     SET owner_type = 'npc',owner_id = p_target_npc_id::text,user_id = NULL,
         is_equipped = false,equip_slot = NULL,updated_at = now()
   WHERE id = p_item_id RETURNING * INTO v_result;
  RETURN v_result;
END;
$b14p4$;

REVOKE ALL ON FUNCTION public.c34_b14_p4_send_character_gear_to_controlled_npc_v1(uuid,uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.c34_b14_p4_send_character_gear_to_controlled_npc_v1(uuid,uuid,uuid)
  TO authenticated;
COMMIT;
