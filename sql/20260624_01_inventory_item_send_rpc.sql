-- DNDNext inventory item send/transfer helpers
--
-- Purpose:
--   Let signed-in characters send items to other players or NPCs without
--   bypassing inventory_items RLS with direct client table updates.
--
-- Notes:
--   * transfer_inventory_item_v1 moves one inventory row, unequips it, and clears equip_slot.
--   * list_item_send_targets_v1 gives normal players legal send targets even though
--     players table RLS only lets them SELECT their own player row.
--   * Merchants are included as direct-send targets for admins only.

BEGIN;

CREATE OR REPLACE FUNCTION public.list_item_send_targets_v1()
RETURNS TABLE(kind text, id text, name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth
AS $$
DECLARE
  caller uuid := auth.uid();
  v_admin boolean := false;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  v_admin := coalesce(public.is_admin(caller), false);

  RETURN QUERY
    SELECT 'player'::text AS kind,
           p.user_id::text AS id,
           coalesce(nullif(p.name, ''), 'Player')::text AS name
    FROM public.players p
    WHERE p.user_id IS NOT NULL
      AND p.user_id <> caller

    UNION ALL

    SELECT 'npc'::text AS kind,
           c.id::text AS id,
           coalesce(nullif(c.name, ''), 'NPC')::text AS name
    FROM public.characters c
    WHERE c.kind = 'npc'

    UNION ALL

    SELECT 'merchant'::text AS kind,
           c.id::text AS id,
           coalesce(nullif(c.name, ''), 'Merchant')::text AS name
    FROM public.characters c
    WHERE c.kind = 'merchant'
      AND v_admin

    ORDER BY kind, name;
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_inventory_item_v1(
  p_item_id uuid,
  p_target_type text,
  p_target_id text
)
RETURNS public.inventory_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, auth
AS $$
DECLARE
  caller uuid := auth.uid();
  v_admin boolean := false;
  v_item public.inventory_items%rowtype;
  v_source_type text;
  v_target_type text := lower(trim(coalesce(p_target_type, '')));
  v_target_uuid uuid;
  v_result public.inventory_items%rowtype;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  IF p_item_id IS NULL THEN
    RAISE EXCEPTION 'Missing item id';
  END IF;

  IF v_target_type NOT IN ('player', 'npc', 'merchant') THEN
    RAISE EXCEPTION 'Invalid target type: %', p_target_type;
  END IF;

  v_admin := coalesce(public.is_admin(caller), false);

  SELECT *
  INTO v_item
  FROM public.inventory_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  v_source_type := coalesce(nullif(v_item.owner_type, ''), 'player');

  IF NOT (
    v_admin
    OR (v_source_type = 'player' AND v_item.user_id = caller)
    OR (
      v_source_type = 'npc'
      AND EXISTS (
        SELECT 1
        FROM public.character_permissions cp
        WHERE cp.character_id = v_item.owner_id::uuid
          AND cp.user_id = caller
          AND (coalesce(cp.can_inventory, false) OR coalesce(cp.can_edit, false))
      )
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized to transfer this item';
  END IF;

  IF v_target_type = 'player' THEN
    BEGIN
      v_target_uuid := p_target_id::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Invalid player target id';
    END;

    IF NOT EXISTS (SELECT 1 FROM public.players p WHERE p.user_id = v_target_uuid) THEN
      RAISE EXCEPTION 'Player target not found';
    END IF;
  ELSE
    BEGIN
      v_target_uuid := p_target_id::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Invalid character target id';
    END;

    IF NOT EXISTS (
      SELECT 1
      FROM public.characters c
      WHERE c.id = v_target_uuid
        AND c.kind = v_target_type
    ) THEN
      RAISE EXCEPTION 'Character target not found';
    END IF;

    IF v_target_type = 'merchant' AND NOT v_admin THEN
      RAISE EXCEPTION 'Only admins can send items directly to merchants';
    END IF;
  END IF;

  UPDATE public.inventory_items
  SET owner_type = v_target_type,
      owner_id = p_target_id,
      user_id = CASE WHEN v_target_type = 'player' THEN v_target_uuid ELSE NULL END,
      is_equipped = false,
      equip_slot = NULL,
      updated_at = now()
  WHERE id = p_item_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.list_item_send_targets_v1() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transfer_inventory_item_v1(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_item_send_targets_v1() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transfer_inventory_item_v1(uuid, text, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.list_item_send_targets_v1() IS
'Lists legal item-send targets for signed-in users. Players see other players and NPCs; admins also see merchants.';

COMMENT ON FUNCTION public.transfer_inventory_item_v1(uuid, text, text) IS
'Controlled SECURITY DEFINER item transfer. Moves one inventory item to a player/NPC/merchant target, unequips it, and clears equip_slot.';

COMMIT;
