-- DNDNext database drift follow-up
--
-- Completes the low-risk metadata and policy portion of the hardening roadmap.
-- Function bodies, world simulation rules, crafting rules, merchant stock logic,
-- and application data are not changed.

-- ---------------------------------------------------------------------------
-- Pin search_path on application-owned public functions without replacing any
-- function body. Extension-owned functions are deliberately excluded.
-- ---------------------------------------------------------------------------

DO $pin_function_search_paths$
DECLARE
  target_function regprocedure;
BEGIN
  FOR target_function IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(coalesce(p.proconfig, '{}'::text[])) setting
        WHERE setting LIKE 'search_path=%'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend d
        WHERE d.classid = 'pg_proc'::regclass
          AND d.objid = p.oid
          AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path = pg_catalog, public, private, auth, extensions',
      target_function
    );
  END LOOP;
END
$pin_function_search_paths$;

-- RPCs that require a signed-in caller internally should not be exposed to the
-- anonymous PostgREST role. Authenticated callers keep the existing contract.
REVOKE EXECUTE ON FUNCTION public.create_character_v1(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_character_v1(jsonb) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.delete_character_v1(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_character_v1(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.set_character_portrait_v1(uuid, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_character_portrait_v1(uuid, text, text, text, text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Preserve existing RLS behavior while preventing auth.uid() from being
-- reevaluated for every candidate row.
-- ---------------------------------------------------------------------------

ALTER POLICY "trade: select own"
ON public.trade_requests
TO authenticated
USING (
  (SELECT auth.uid()) = from_user_id
  OR (SELECT auth.uid()) = to_user_id
);

ALTER POLICY "trade: insert by sender"
ON public.trade_requests
TO authenticated
WITH CHECK ((SELECT auth.uid()) = from_user_id);

ALTER POLICY "trade: cancel by sender"
ON public.trade_requests
TO authenticated
USING ((SELECT auth.uid()) = from_user_id AND status = 'pending')
WITH CHECK (status = 'cancelled');

ALTER POLICY "trade: decision by recipient"
ON public.trade_requests
TO authenticated
USING ((SELECT auth.uid()) = to_user_id AND status = 'pending')
WITH CHECK (status = ANY (ARRAY['accepted'::text, 'declined'::text]));

ALTER POLICY "Players can view their own plants"
ON public.player_plants
USING (
  player_id = (
    SELECT p.id
    FROM public.players p
    WHERE p.user_id = (SELECT auth.uid())
  )
);

ALTER POLICY "Players can add/update their own plants"
ON public.player_plants
WITH CHECK (
  player_id = (
    SELECT p.id
    FROM public.players p
    WHERE p.user_id = (SELECT auth.uid())
  )
);

ALTER POLICY "Players can add/update their own plants update"
ON public.player_plants
USING (
  player_id = (
    SELECT p.id
    FROM public.players p
    WHERE p.user_id = (SELECT auth.uid())
  )
);

ALTER POLICY "Players can view their own recipes"
ON public.player_recipes
USING (
  player_id = (
    SELECT p.id
    FROM public.players p
    WHERE p.user_id = (SELECT auth.uid())
  )
);

ALTER POLICY "Players can insert their own recipe discoveries"
ON public.player_recipes
WITH CHECK (
  player_id = (
    SELECT p.id
    FROM public.players p
    WHERE p.user_id = (SELECT auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- Cover every remaining foreign key reported by the advisor. These indexes do
-- not alter world-map or town-map behavior; they only support joins/deletes.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS characters_last_known_location_id_idx
  ON public.characters(last_known_location_id);
CREATE INDEX IF NOT EXISTS characters_map_icon_id_idx
  ON public.characters(map_icon_id);
CREATE INDEX IF NOT EXISTS characters_projected_destination_id_idx
  ON public.characters(projected_destination_id);
CREATE INDEX IF NOT EXISTS locations_biome_id_idx
  ON public.locations(biome_id);
CREATE INDEX IF NOT EXISTS locations_icon_id_idx
  ON public.locations(icon_id);
CREATE INDEX IF NOT EXISTS map_route_edges_a_point_id_idx
  ON public.map_route_edges(a_point_id);
CREATE INDEX IF NOT EXISTS map_route_edges_b_point_id_idx
  ON public.map_route_edges(b_point_id);
CREATE INDEX IF NOT EXISTS map_route_points_location_id_idx
  ON public.map_route_points(location_id);
CREATE INDEX IF NOT EXISTS player_recipes_recipe_id_idx
  ON public.player_recipes(recipe_id);

-- ---------------------------------------------------------------------------
-- Postconditions
-- ---------------------------------------------------------------------------

DO $database_drift_postconditions$
DECLARE
  missing_search_paths integer;
BEGIN
  SELECT count(*)
  INTO missing_search_paths
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prokind = 'f'
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(coalesce(p.proconfig, '{}'::text[])) setting
      WHERE setting LIKE 'search_path=%'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pg_depend d
      WHERE d.classid = 'pg_proc'::regclass
        AND d.objid = p.oid
        AND d.deptype = 'e'
    );

  IF missing_search_paths <> 0 THEN
    RAISE EXCEPTION '% application-owned public functions still have a mutable search_path', missing_search_paths;
  END IF;

  IF has_function_privilege('anon', 'public.create_character_v1(jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.delete_character_v1(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.set_character_portrait_v1(uuid,text,text,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'signed-in character RPCs remain executable by anon';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.create_character_v1(jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.delete_character_v1(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.set_character_portrait_v1(uuid,text,text,text,text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated character RPC contracts were removed';
  END IF;
END
$database_drift_postconditions$;
