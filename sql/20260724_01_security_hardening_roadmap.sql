-- DNDNext security hardening roadmap
--
-- Scope:
--   1. Close generic and direct player-wallet mutation paths.
--   2. Enable least-privilege RLS on the spell catalog tables.
--   3. Secure manual world-simulation administrator RPCs without changing
--      route, travel, weather, camping, or movement behavior.
--   4. Remove proven-dead legacy RPC overloads and duplicate indexes.
--   5. Make RPC-only progression tables explicitly deny direct client access.
--
-- This migration is intentionally idempotent where practical. It does not
-- modify production character, wallet, spell, route, or crafting data.

-- ---------------------------------------------------------------------------
-- Economy boundary
-- ---------------------------------------------------------------------------

ALTER TABLE public.player_wallets ENABLE ROW LEVEL SECURITY;

DO $wallet_policies$
DECLARE
  policy_name text;
BEGIN
  FOR policy_name IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'player_wallets'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.player_wallets', policy_name);
  END LOOP;
END
$wallet_policies$;

CREATE POLICY player_wallets_select_self_or_admin
ON public.player_wallets
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (SELECT private.current_user_is_admin())
);

REVOKE ALL ON TABLE public.player_wallets FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.player_wallets TO authenticated;

-- Generic balance mutation remains available only as an internal primitive for
-- SECURITY DEFINER workflows owned by postgres/service code. Browser clients,
-- including administrators, use purpose-specific RPCs such as wallet_set,
-- wallet_transfer, and buy_from_merchant.
CREATE OR REPLACE FUNCTION public.wallet_add(p_user uuid, p_delta numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $function$
DECLARE
  caller uuid := auth.uid();
  target uuid;
  cur numeric;
  nxt numeric;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING errcode = '42501';
  END IF;

  IF NOT private.current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin access is required to change wallet balances.' USING errcode = '42501';
  END IF;

  target := COALESCE(p_user, caller);

  INSERT INTO public.player_wallets(user_id, gp)
  VALUES (target, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT gp INTO cur
  FROM public.player_wallets
  WHERE user_id = target
  FOR UPDATE;

  cur := COALESCE(cur, 0);
  IF cur = -1 THEN
    RETURN -1;
  END IF;

  nxt := cur + COALESCE(p_delta, 0);
  IF nxt < 0 THEN
    nxt := 0;
  END IF;

  UPDATE public.player_wallets
  SET gp = nxt,
      updated_at = now()
  WHERE user_id = target;

  RETURN nxt;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.wallet_add(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_add(uuid, numeric) TO service_role;

-- These self-service mutators have no repository callers and bypass the
-- purpose-specific transaction boundary. Remove them rather than leaving a
-- misleading compatibility surface.
DROP FUNCTION IF EXISTS public.wallet_add_self(numeric);
DROP FUNCTION IF EXISTS public.wallet_set_self(numeric);

ALTER FUNCTION public.wallet_get(uuid)
  SET search_path = pg_catalog, public, private, auth;
ALTER FUNCTION public.wallet_set(uuid, numeric)
  SET search_path = pg_catalog, public, private, auth;
ALTER FUNCTION public.wallet_transfer(uuid, uuid, numeric)
  SET search_path = pg_catalog, public, private, auth;
ALTER FUNCTION public.buy_from_merchant(uuid, uuid, integer)
  SET search_path = pg_catalog, public, private, auth;

REVOKE EXECUTE ON FUNCTION public.wallet_get(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wallet_get(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wallet_set(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wallet_set(uuid, numeric) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.wallet_transfer(uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wallet_transfer(uuid, uuid, numeric) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.buy_from_merchant(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_from_merchant(uuid, uuid, integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Spell catalog RLS and grants
-- ---------------------------------------------------------------------------

ALTER TABLE public.spells_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spell_effects ENABLE ROW LEVEL SECURITY;

DO $spell_policies$
DECLARE
  target_table text;
  policy_name text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['spells_catalog', 'spell_effects']
  LOOP
    FOR policy_name IN
      SELECT p.policyname
      FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = target_table
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', policy_name, target_table);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
      target_table || '_public_read',
      target_table
    );

    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', target_table);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon, authenticated', target_table);
  END LOOP;
END
$spell_policies$;

GRANT SELECT ON TABLE public.spells_catalog_preferred TO anon, authenticated;

ALTER FUNCTION public.import_spell_preview_batch(jsonb)
  SET search_path = pg_catalog, public, private, auth;
REVOKE EXECUTE ON FUNCTION public.import_spell_preview_batch(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_spell_preview_batch(jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Manual world-simulation administrator RPC authorization
--
-- Only authorization and search_path are changed. The existing state updates,
-- tick loop, and timing behavior remain identical.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_clear_dwell_and_force_due(p_character_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $function$
DECLARE
  ws timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT private.current_user_is_admin() THEN
    RAISE EXCEPTION 'Only an administrator can clear character dwell time.' USING errcode = '42501';
  END IF;

  SELECT world_time INTO ws
  FROM public.world_state
  WHERE id = 1;

  UPDATE public.characters
  SET dwell_ends_at = ws - interval '1 second',
      next_action_at = ws - interval '1 second'
  WHERE id = p_character_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_force_character_due(p_character_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $function$
DECLARE
  wt timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT private.current_user_is_admin() THEN
    RAISE EXCEPTION 'Only an administrator can force a character action.' USING errcode = '42501';
  END IF;

  SELECT world_time INTO wt
  FROM public.world_state
  WHERE id = 1;

  UPDATE public.characters
  SET next_action_at = wt - interval '1 second'
  WHERE id = p_character_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_sim_tick_n(p_n integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $function$
DECLARE
  i integer;
BEGIN
  IF auth.uid() IS NULL OR NOT private.current_user_is_admin() THEN
    RAISE EXCEPTION 'Only an administrator can run simulation ticks.' USING errcode = '42501';
  END IF;

  IF p_n IS NULL OR p_n < 1 THEN
    p_n := 1;
  END IF;

  FOR i IN 1..p_n LOOP
    PERFORM public.sim_tick_v1();
  END LOOP;
END;
$function$;

DO $admin_rpc_grants$
DECLARE
  signature text;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.admin_advance_all_characters_v1(timestamptz)',
    'public.admin_clear_dwell_and_force_due(uuid)',
    'public.admin_force_character_due(uuid)',
    'public.admin_sim_tick_n(integer)'
  ]
  LOOP
    IF to_regprocedure(signature) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', signature);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', signature);
    END IF;
  END LOOP;
END
$admin_rpc_grants$;

-- ---------------------------------------------------------------------------
-- Explicit RPC-only tables
-- ---------------------------------------------------------------------------

DO $rpc_only_tables$
DECLARE
  target_table text;
  policy_name text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'ai_item_images',
    'character_level_events',
    'character_level_up_sessions',
    'character_option_grants',
    'character_progression'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);

    FOR policy_name IN
      SELECT p.policyname
      FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = target_table
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', policy_name, target_table);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      target_table || '_rpc_only',
      target_table
    );
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', target_table);
    EXECUTE format(
      'COMMENT ON TABLE public.%I IS %L',
      target_table,
      'Direct client access is intentionally disabled. Use the authorized SECURITY DEFINER RPC boundary.'
    );
  END LOOP;
END
$rpc_only_tables$;

-- ---------------------------------------------------------------------------
-- Proven-dead legacy merchant overloads
--
-- The live schema no longer contains public.merchants or public.merchant_stock,
-- and repository callers use reroll_merchant_inventory_v2.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.reroll_merchant_inventory(uuid, text, integer);
DROP FUNCTION IF EXISTS public.reroll_merchant_inventory(uuid, text, integer, integer);

ALTER FUNCTION public.reroll_merchant_inventory_v2(uuid, text, integer)
  SET search_path = pg_catalog, public, private, auth;
REVOKE EXECUTE ON FUNCTION public.reroll_merchant_inventory_v2(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reroll_merchant_inventory_v2(uuid, text, integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Duplicate-index cleanup and high-value foreign-key coverage
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS public.alchemy_recipe_options_recipe_option_key;
DROP INDEX IF EXISTS public.crafting_attempts_plan_idx;
DROP INDEX IF EXISTS public.map_route_points_route_seq_idx;
DROP INDEX IF EXISTS public.player_plants_tags_idx;
DROP INDEX IF EXISTS public.idx_town_map_labels_location_sort;

CREATE INDEX IF NOT EXISTS character_level_events_created_by_idx
  ON public.character_level_events(created_by);
CREATE INDEX IF NOT EXISTS character_level_up_sessions_created_by_idx
  ON public.character_level_up_sessions(created_by);
CREATE INDEX IF NOT EXISTS character_notes_author_user_id_idx
  ON public.character_notes(author_user_id);
CREATE INDEX IF NOT EXISTS character_option_grants_granted_by_idx
  ON public.character_option_grants(granted_by);
CREATE INDEX IF NOT EXISTS character_option_grants_option_id_idx
  ON public.character_option_grants(option_id);
CREATE INDEX IF NOT EXISTS character_permissions_user_id_idx
  ON public.character_permissions(user_id);
CREATE INDEX IF NOT EXISTS character_progression_created_by_idx
  ON public.character_progression(created_by);
CREATE INDEX IF NOT EXISTS inventory_items_user_id_idx
  ON public.inventory_items(user_id);
CREATE INDEX IF NOT EXISTS trade_requests_inventory_item_id_idx
  ON public.trade_requests(inventory_item_id);

-- ---------------------------------------------------------------------------
-- Migration postconditions
-- ---------------------------------------------------------------------------

DO $postconditions$
BEGIN
  IF has_table_privilege('authenticated', 'public.player_wallets', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.player_wallets', 'INSERT')
     OR has_table_privilege('authenticated', 'public.player_wallets', 'DELETE') THEN
    RAISE EXCEPTION 'player_wallets still exposes direct write privileges';
  END IF;

  IF has_function_privilege('authenticated', 'public.wallet_add(uuid,numeric)', 'EXECUTE') THEN
    RAISE EXCEPTION 'wallet_add remains directly executable by authenticated clients';
  END IF;

  IF to_regprocedure('public.wallet_add_self(numeric)') IS NOT NULL
     OR to_regprocedure('public.wallet_set_self(numeric)') IS NOT NULL THEN
    RAISE EXCEPTION 'deprecated self-service wallet mutators still exist';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.spells_catalog'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.spell_effects'::regclass) THEN
    RAISE EXCEPTION 'spell RLS was not enabled';
  END IF;

  IF has_table_privilege('anon', 'public.spells_catalog', 'INSERT')
     OR has_table_privilege('authenticated', 'public.spells_catalog', 'UPDATE')
     OR has_table_privilege('anon', 'public.spell_effects', 'DELETE') THEN
    RAISE EXCEPTION 'spell tables still expose client write privileges';
  END IF;

  IF has_function_privilege('anon', 'public.admin_clear_dwell_and_force_due(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.admin_force_character_due(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.admin_sim_tick_n(integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'manual world administrator RPCs remain anonymous';
  END IF;

  IF to_regprocedure('public.reroll_merchant_inventory(uuid,text,integer)') IS NOT NULL
     OR to_regprocedure('public.reroll_merchant_inventory(uuid,text,integer,integer)') IS NOT NULL THEN
    RAISE EXCEPTION 'legacy merchant reroll overloads still exist';
  END IF;
END
$postconditions$;
