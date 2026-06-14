-- DNDNext Phase A: non-map security hardening
--
-- Scope:
--   * reference/catalog tables used by Items, Alchemy, and Crafting
--   * inventory_items ownership policies
--   * anonymous access to non-map SECURITY DEFINER RPCs
--
-- Explicitly excluded:
--   * world-map routes, movement, simulation, weather, and world-state objects
--   * town-map labels, flags, and storage policies
--   * characters, character_sheets, character_notes, character_permissions,
--     character_stock, map_icons, and location_icons

-- ---------------------------------------------------------------------------
-- Public reference data: readable by clients, writable only by administrators.
-- ---------------------------------------------------------------------------

ALTER TABLE public.items_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alchemy_recipe_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alchemy_enhancer_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alchemy_reagent_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crafting_material_effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crafting_recipe_rules ENABLE ROW LEVEL SECURITY;

DO $phase_a$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'items_catalog',
    'alchemy_recipe_options',
    'alchemy_enhancer_effects',
    'alchemy_reagent_families',
    'crafting_material_effects',
    'crafting_recipe_rules'
  ]
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      table_name || '_public_read',
      table_name
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      table_name || '_admin_write',
      table_name
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
      table_name || '_public_read',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
      'USING ((SELECT private.current_user_is_admin())) '
      'WITH CHECK ((SELECT private.current_user_is_admin()))',
      table_name || '_admin_write',
      table_name
    );

    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', table_name);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', table_name);
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated',
      table_name
    );
  END LOOP;
END
$phase_a$;

-- ---------------------------------------------------------------------------
-- Player inventory: remove duplicate/permissive policies.
--
-- The resulting user_id must remain auth.uid() for a normal player update.
-- SECURITY DEFINER transfer/purchase/crafting RPCs continue to perform controlled
-- ownership changes while administrators retain full access.
-- ---------------------------------------------------------------------------

DO $phase_a$
DECLARE
  policy_name text;
BEGIN
  FOR policy_name IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inventory_items'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.inventory_items', policy_name);
  END LOOP;
END
$phase_a$;

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_items_select_owner_or_admin
ON public.inventory_items
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (SELECT private.current_user_is_admin())
);

CREATE POLICY inventory_items_insert_owner_or_admin
ON public.inventory_items
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT auth.uid())
  OR (SELECT private.current_user_is_admin())
);

CREATE POLICY inventory_items_update_owner_or_admin
ON public.inventory_items
FOR UPDATE
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (SELECT private.current_user_is_admin())
)
WITH CHECK (
  user_id = (SELECT auth.uid())
  OR (SELECT private.current_user_is_admin())
);

CREATE POLICY inventory_items_delete_owner_or_admin
ON public.inventory_items
FOR DELETE
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (SELECT private.current_user_is_admin())
);

COMMENT ON POLICY inventory_items_update_owner_or_admin
ON public.inventory_items IS
'Owners may update only rows whose resulting user_id remains auth.uid(); administrator and SECURITY DEFINER transfer workflows retain controlled reassignment support.';

REVOKE ALL ON TABLE public.inventory_items FROM anon;
REVOKE ALL ON TABLE public.inventory_items FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.inventory_items
TO authenticated;

-- ---------------------------------------------------------------------------
-- Non-map RPCs: stop unsigned callers while retaining signed-in workflows.
-- Search paths are pinned without replacing function bodies or return types.
-- ---------------------------------------------------------------------------

DO $phase_a$
DECLARE
  signature text;
  signatures text[] := ARRAY[
    'public.accept_trade(uuid)',
    'public.buy_from_merchant(uuid,uuid,integer)',
    'public.convert_character_type(uuid,text)',
    'public.list_transfer_targets()',
    'public.reroll_merchant_inventory(uuid,text,integer)',
    'public.reroll_merchant_inventory(uuid,text,integer,integer)',
    'public.reroll_merchant_inventory_v2(uuid,text,integer)',
    'public.set_character_kind(uuid,text)',
    'public.set_character_store_enabled(uuid,boolean)',
    'public.stock_merchant_item(uuid,text,numeric,integer,jsonb)',
    'public.wallet_add(uuid,numeric)',
    'public.wallet_add_self(numeric)',
    'public.wallet_get(uuid)',
    'public.wallet_set(uuid,numeric)',
    'public.wallet_set_self(numeric)',
    'public.wallet_transfer(uuid,uuid,numeric)'
  ];
BEGIN
  FOREACH signature IN ARRAY signatures
  LOOP
    IF to_regprocedure(signature) IS NOT NULL THEN
      EXECUTE format(
        'ALTER FUNCTION %s SET search_path = pg_catalog, public, private, auth',
        signature
      );
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon',
        signature
      );
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role',
        signature
      );
    END IF;
  END LOOP;
END
$phase_a$;
