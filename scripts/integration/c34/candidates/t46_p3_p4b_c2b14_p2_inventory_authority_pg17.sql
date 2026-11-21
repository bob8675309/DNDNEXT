-- C34 C2-B14-P2. RESEARCH-ONLY versioned SQL for disposable PG17 fixtures.
-- NOT a migration. Do not execute against hosted Supabase or merge into main.
-- Preserve original June policies, is_admin overloads, transfer_inventory_item_v1,
-- Town crafting INSERT, Forge initial item materializers, and world-map consumers.
BEGIN;

CREATE OR REPLACE FUNCTION private.c34_b14_p2_inventory_manager_v1()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $b14p2$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('admin', 'gm', 'dm')
    );
$b14p2$;

REVOKE ALL ON FUNCTION private.c34_b14_p2_inventory_manager_v1() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.c34_b14_p2_transfer_inventory_item_v1(
  p_item_id uuid,
  p_target_type text,
  p_target_id text,
  p_expected_owner_type text,
  p_expected_owner_id text
)
RETURNS public.inventory_items
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $b14p2$
DECLARE
  v_caller uuid := auth.uid();
  v_manager boolean := false;
  v_item public.inventory_items%ROWTYPE;
  v_result public.inventory_items%ROWTYPE;
  v_source_type text;
  v_source_id text;
  v_target_type text := lower(btrim(coalesce(p_target_type, '')));
  v_target_uuid uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Sign-in required for inventory transfer' USING ERRCODE = '42501';
  END IF;
  IF p_item_id IS NULL OR v_target_type NOT IN ('player', 'npc', 'merchant')
     OR p_target_id IS NULL OR btrim(p_target_id) = ''
     OR p_expected_owner_type NOT IN ('player', 'npc', 'merchant')
     OR p_expected_owner_id IS NULL OR btrim(p_expected_owner_id) = '' THEN
    RAISE EXCEPTION 'Invalid inventory transfer request' USING ERRCODE = '22023';
  END IF;

  v_manager := private.c34_b14_p2_inventory_manager_v1();
  SELECT * INTO v_item FROM public.inventory_items
  WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item does not exist' USING ERRCODE = '22023';
  END IF;

  v_source_type := coalesce(nullif(v_item.owner_type, ''), 'player');
  v_source_id := coalesce(nullif(v_item.owner_id, ''), v_item.user_id::text);
  IF v_source_type IS DISTINCT FROM p_expected_owner_type
     OR v_source_id IS DISTINCT FROM p_expected_owner_id THEN
    RAISE EXCEPTION 'Inventory owner changed; refresh and retry' USING ERRCODE = '40001';
  END IF;

  IF NOT (
    v_manager
    OR (v_source_type = 'player' AND v_item.user_id = v_caller)
    OR (
      v_source_type = 'npc'
      AND EXISTS (
        SELECT 1 FROM public.character_permissions cp
        WHERE cp.character_id = v_item.owner_id::uuid
          AND cp.user_id = v_caller
          AND (coalesce(cp.can_inventory, false) OR coalesce(cp.can_edit, false))
      )
    )
  ) THEN
    RAISE EXCEPTION 'Inventory transfer denied' USING ERRCODE = '42501';
  END IF;

  BEGIN
    v_target_uuid := p_target_id::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Invalid inventory target id' USING ERRCODE = '22023';
  END;
  IF v_target_type = 'player' THEN
    IF NOT EXISTS (SELECT 1 FROM public.players p WHERE p.user_id = v_target_uuid) THEN
      RAISE EXCEPTION 'Player target not found' USING ERRCODE = '22023';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = v_target_uuid AND c.kind = v_target_type
    ) THEN
      RAISE EXCEPTION 'Character target not found' USING ERRCODE = '22023';
    END IF;
    IF v_target_type = 'merchant' AND NOT v_manager THEN
      RAISE EXCEPTION 'Only game managers can directly send to merchants' USING ERRCODE = '42501';
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
$b14p2$;

CREATE OR REPLACE FUNCTION public.c34_b14_p2_transfer_inventory_items_bulk_v1(
  p_item_ids uuid[],
  p_target_type text,
  p_target_id text,
  p_expected_owner_type text,
  p_expected_owner_id text
)
RETURNS SETOF public.inventory_items
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $b14p2$
DECLARE
  v_id uuid;
  v_found integer := 0;
  v_unique integer;
  v_length integer := coalesce(cardinality(p_item_ids), 0);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign-in required for inventory bulk transfer' USING ERRCODE = '42501';
  END IF;
  IF v_length < 1 OR v_length > 50 OR cardinality(array_remove(p_item_ids, NULL)) <> v_length THEN
    RAISE EXCEPTION 'Bulk transfer needs 1-50 nonnull item ids' USING ERRCODE = '22023';
  END IF;
  SELECT count(DISTINCT id) INTO v_unique FROM unnest(p_item_ids) AS x(id);
  IF v_unique <> v_length THEN
    RAISE EXCEPTION 'Duplicate inventory item ids in bulk transfer' USING ERRCODE = '22023';
  END IF;

  -- Deterministic id order and FOR UPDATE: all rows locked before transfer.
  -- One SQL statement is one transaction: ANY failed item rolls back EVERY item.
  FOR v_id IN
    SELECT i.id FROM public.inventory_items i
    WHERE i.id = ANY(p_item_ids)
    ORDER BY i.id FOR UPDATE
  LOOP
    v_found := v_found + 1;
    RETURN NEXT public.c34_b14_p2_transfer_inventory_item_v1(
      v_id, p_target_type, p_target_id, p_expected_owner_type, p_expected_owner_id
    );
  END LOOP;
  IF v_found <> v_length THEN
    RAISE EXCEPTION 'Bulk transfer item missing; no transfers committed' USING ERRCODE = '22023';
  END IF;
  RETURN;
END;
$b14p2$;

REVOKE ALL ON FUNCTION public.c34_b14_p2_transfer_inventory_item_v1(uuid,text,text,text,text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.c34_b14_p2_transfer_inventory_items_bulk_v1(uuid[],text,text,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.c34_b14_p2_transfer_inventory_item_v1(uuid,text,text,text,text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.c34_b14_p2_transfer_inventory_items_bulk_v1(uuid[],text,text,text,text)
  TO authenticated;
COMMIT;
