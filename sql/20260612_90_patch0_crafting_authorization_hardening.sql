-- DNDNext Patch 0: crafting and forage authorization hardening.
--
-- Authorization only. This migration does not alter recipes, ingredient data,
-- crafting math, foraging distributions, town behavior, or world-map behavior.
-- Safe to re-run after a successful first application.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $function$
  SELECT
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles AS up
      WHERE up.id = auth.uid()
        AND up.role = 'admin'
    );
$function$;

REVOKE ALL ON FUNCTION private.current_user_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_user_is_admin() TO authenticated, service_role;

-- Preserve the public helpers used by existing policies and client code, while
-- making role lookup independent of user-controlled RLS paths.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $function$
  SELECT private.current_user_is_admin();
$function$;

CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $function$
DECLARE
  caller uuid := auth.uid();
  target uuid := COALESCE(uid, caller);
  target_role text;
BEGIN
  IF caller IS NULL OR target IS NULL THEN
    RETURN false;
  END IF;

  IF target <> caller AND NOT private.current_user_is_admin() THEN
    RETURN false;
  END IF;

  SELECT up.role
  INTO target_role
  FROM public.user_profiles AS up
  WHERE up.id = target;

  -- Preserve the application's established convention: non-player roles are
  -- elevated, but only an elevated caller can inspect another user's role.
  RETURN COALESCE(target_role, 'player') <> 'player';
END;
$function$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO PUBLIC, anon, authenticated, service_role;

-- Remove legacy permissive policies from the authorization-sensitive tables.
-- The migration then recreates the complete intended policy set below.
DO $policies$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (
        ARRAY[
          'user_profiles',
          'craft_plans',
          'crafting_attempts',
          'forage_tables',
          'forage_table_entries'
        ]
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      policy_row.policyname,
      policy_row.tablename
    );
  END LOOP;
END;
$policies$;

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.craft_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crafting_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forage_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forage_table_entries ENABLE ROW LEVEL SECURITY;

-- user_profiles: players can read their own role, but only an administrator can
-- create, change, or remove role rows. This closes the prior self-promotion path.
REVOKE ALL ON TABLE public.user_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_profiles TO authenticated;
GRANT ALL ON TABLE public.user_profiles TO service_role;

CREATE POLICY user_profiles_select_self
ON public.user_profiles
FOR SELECT
TO authenticated
USING (id = (SELECT auth.uid()));

CREATE POLICY user_profiles_admin_all
ON public.user_profiles
FOR ALL
TO authenticated
USING ((SELECT private.current_user_is_admin()))
WITH CHECK ((SELECT private.current_user_is_admin()));

-- craft_plans: authenticated creators can manage only their own pending request.
-- Review, approval, rejection, cancellation, and completion remain admin actions.
REVOKE ALL ON TABLE public.craft_plans FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.craft_plans TO authenticated;
GRANT ALL ON TABLE public.craft_plans TO service_role;

CREATE POLICY craft_plans_select_owner
ON public.craft_plans
FOR SELECT
TO authenticated
USING (created_by = (SELECT auth.uid()));

CREATE POLICY craft_plans_insert_owner
ON public.craft_plans
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND lower(COALESCE(status, 'draft')) IN ('draft', 'submitted')
  AND reviewed_at IS NULL
  AND reviewed_by IS NULL
  AND completed_at IS NULL
  AND completed_by IS NULL
  AND completed_attempt_id IS NULL
  AND completion_output_item_id IS NULL
);

CREATE POLICY craft_plans_update_owner_pending
ON public.craft_plans
FOR UPDATE
TO authenticated
USING (
  created_by = (SELECT auth.uid())
  AND lower(COALESCE(status, 'draft')) IN ('draft', 'submitted')
)
WITH CHECK (
  created_by = (SELECT auth.uid())
  AND lower(COALESCE(status, 'draft')) IN ('draft', 'submitted')
  AND reviewed_at IS NULL
  AND reviewed_by IS NULL
  AND completed_at IS NULL
  AND completed_by IS NULL
  AND completed_attempt_id IS NULL
  AND completion_output_item_id IS NULL
);

CREATE POLICY craft_plans_delete_owner_draft
ON public.craft_plans
FOR DELETE
TO authenticated
USING (
  created_by = (SELECT auth.uid())
  AND lower(COALESCE(status, 'draft')) = 'draft'
);

CREATE POLICY craft_plans_admin_all
ON public.craft_plans
FOR ALL
TO authenticated
USING ((SELECT private.current_user_is_admin()))
WITH CHECK ((SELECT private.current_user_is_admin()));

CREATE INDEX IF NOT EXISTS craft_plans_created_by_idx
ON public.craft_plans (created_by);

-- crafting_attempts: players can append reports only to plans they own. Attempt
-- rows are otherwise append-only for players; administrators retain full access.
REVOKE ALL ON TABLE public.crafting_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crafting_attempts TO authenticated;
GRANT ALL ON TABLE public.crafting_attempts TO service_role;

CREATE POLICY crafting_attempts_select_owner
ON public.crafting_attempts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.craft_plans AS cp
    WHERE cp.id = crafting_attempts.craft_plan_id
      AND cp.created_by = (SELECT auth.uid())
  )
);

CREATE POLICY crafting_attempts_insert_owner
ON public.crafting_attempts
FOR INSERT
TO authenticated
WITH CHECK (
  craft_plan_id IS NOT NULL
  AND lower(COALESCE(result_tier, '')) <> 'completed'
  AND EXISTS (
    SELECT 1
    FROM public.craft_plans AS cp
    WHERE cp.id = crafting_attempts.craft_plan_id
      AND cp.created_by = (SELECT auth.uid())
  )
);

CREATE POLICY crafting_attempts_admin_all
ON public.crafting_attempts
FOR ALL
TO authenticated
USING ((SELECT private.current_user_is_admin()))
WITH CHECK ((SELECT private.current_user_is_admin()));

CREATE INDEX IF NOT EXISTS crafting_attempts_craft_plan_id_idx
ON public.crafting_attempts (craft_plan_id);

-- Forage configuration remains readable by the current player-facing UI, but
-- only administrators can insert, update, or delete table configuration.
REVOKE ALL ON TABLE public.forage_tables FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.forage_tables TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.forage_tables TO authenticated;
GRANT ALL ON TABLE public.forage_tables TO service_role;

CREATE POLICY forage_tables_public_read
ON public.forage_tables
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY forage_tables_admin_write
ON public.forage_tables
FOR ALL
TO authenticated
USING ((SELECT private.current_user_is_admin()))
WITH CHECK ((SELECT private.current_user_is_admin()));

REVOKE ALL ON TABLE public.forage_table_entries FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.forage_table_entries TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.forage_table_entries TO authenticated;
GRANT ALL ON TABLE public.forage_table_entries TO service_role;

CREATE POLICY forage_table_entries_public_read
ON public.forage_table_entries
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY forage_table_entries_admin_write
ON public.forage_table_entries
FOR ALL
TO authenticated
USING ((SELECT private.current_user_is_admin()))
WITH CHECK ((SELECT private.current_user_is_admin()));

-- Preserve the current implementation functions in the private schema. Public
-- RPC names become authorization-enforcing wrappers, avoiding a rewrite of the
-- proven craft-completion transaction.
DO $move_functions$
BEGIN
  IF to_regprocedure('private.submit_craft_plan_impl(jsonb)') IS NULL THEN
    IF to_regprocedure('public.submit_craft_plan(jsonb)') IS NULL THEN
      RAISE EXCEPTION 'Required function public.submit_craft_plan(jsonb) is missing';
    END IF;
    EXECUTE 'ALTER FUNCTION public.submit_craft_plan(jsonb) SET SCHEMA private';
    EXECUTE 'ALTER FUNCTION private.submit_craft_plan(jsonb) RENAME TO submit_craft_plan_impl';
  END IF;

  IF to_regprocedure('private.submit_crafting_attempt_report_impl(jsonb)') IS NULL THEN
    IF to_regprocedure('public.submit_crafting_attempt_report(jsonb)') IS NULL THEN
      RAISE EXCEPTION 'Required function public.submit_crafting_attempt_report(jsonb) is missing';
    END IF;
    EXECUTE 'ALTER FUNCTION public.submit_crafting_attempt_report(jsonb) SET SCHEMA private';
    EXECUTE 'ALTER FUNCTION private.submit_crafting_attempt_report(jsonb) RENAME TO submit_crafting_attempt_report_impl';
  END IF;

  IF to_regprocedure('private.complete_craft_plan_v1_impl(uuid,uuid)') IS NULL THEN
    IF to_regprocedure('public.complete_craft_plan_v1(uuid,uuid)') IS NULL THEN
      RAISE EXCEPTION 'Required function public.complete_craft_plan_v1(uuid,uuid) is missing';
    END IF;
    EXECUTE 'ALTER FUNCTION public.complete_craft_plan_v1(uuid,uuid) SET SCHEMA private';
    EXECUTE 'ALTER FUNCTION private.complete_craft_plan_v1(uuid,uuid) RENAME TO complete_craft_plan_v1_impl';
  END IF;
END;
$move_functions$;

REVOKE ALL ON FUNCTION private.submit_craft_plan_impl(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.submit_crafting_attempt_report_impl(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.complete_craft_plan_v1_impl(uuid, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.submit_craft_plan_impl(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION private.submit_crafting_attempt_report_impl(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION private.complete_craft_plan_v1_impl(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.submit_craft_plan(p_plan jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $function$
DECLARE
  caller uuid := auth.uid();
  caller_role text := COALESCE(auth.role(), '');
  safe_plan jsonb := COALESCE(p_plan, '{}'::jsonb);
  requested_status text;
BEGIN
  IF jsonb_typeof(safe_plan) <> 'object' THEN
    RAISE EXCEPTION 'Craft plan payload must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  IF caller IS NULL AND caller_role <> 'service_role' THEN
    RAISE EXCEPTION 'Authentication is required to submit a craft plan'
      USING ERRCODE = '42501';
  END IF;

  IF caller_role <> 'service_role' THEN
    requested_status := lower(COALESCE(safe_plan->>'status', 'draft'));
    IF requested_status NOT IN ('draft', 'submitted') THEN
      requested_status := 'draft';
    END IF;

    safe_plan := safe_plan || jsonb_build_object(
      'created_by', caller,
      'status', requested_status
    );
  END IF;

  RETURN private.submit_craft_plan_impl(safe_plan);
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_crafting_attempt_report(p_attempt jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $function$
DECLARE
  caller uuid := auth.uid();
  caller_role text := COALESCE(auth.role(), '');
  safe_attempt jsonb := COALESCE(p_attempt, '{}'::jsonb);
  plan_id uuid;
  result_tier text := lower(COALESCE(safe_attempt->>'result_tier', ''));
BEGIN
  IF jsonb_typeof(safe_attempt) <> 'object' THEN
    RAISE EXCEPTION 'Craft attempt payload must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  IF caller IS NULL AND caller_role <> 'service_role' THEN
    RAISE EXCEPTION 'Authentication is required to submit a craft attempt'
      USING ERRCODE = '42501';
  END IF;

  plan_id := NULLIF(safe_attempt->>'craft_plan_id', '')::uuid;

  IF caller_role <> 'service_role' AND NOT private.current_user_is_admin() THEN
    IF plan_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.craft_plans AS cp
      WHERE cp.id = plan_id
        AND cp.created_by = caller
    ) THEN
      RAISE EXCEPTION 'Craft attempt must belong to a craft plan owned by the caller'
        USING ERRCODE = '42501';
    END IF;

    IF result_tier = 'completed' THEN
      RAISE EXCEPTION 'Only an administrator can create a completed craft attempt'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN private.submit_crafting_attempt_report_impl(safe_attempt);
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_craft_plan_v1(
  p_plan_id uuid,
  p_attempt_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $function$
DECLARE
  caller_role text := COALESCE(auth.role(), '');
BEGIN
  IF caller_role <> 'service_role' AND NOT private.current_user_is_admin() THEN
    RAISE EXCEPTION 'Only an administrator can complete a craft plan'
      USING ERRCODE = '42501';
  END IF;

  RETURN private.complete_craft_plan_v1_impl(p_plan_id, p_attempt_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_craft_plan(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_crafting_attempt_report(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_craft_plan_v1(uuid, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.submit_craft_plan(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_crafting_attempt_report(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_craft_plan_v1(uuid, uuid) TO authenticated, service_role;

COMMIT;
