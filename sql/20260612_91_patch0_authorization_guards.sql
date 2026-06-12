-- DNDNext Patch 0 follow-up guards.
-- Applies after 20260612_90_patch0_crafting_authorization_hardening.sql.

BEGIN;

-- Preserve new-user onboarding without allowing role escalation. A signed-in
-- user may create only their own profile row, and only with the player role.
DROP POLICY IF EXISTS user_profiles_insert_self_player ON public.user_profiles;
CREATE POLICY user_profiles_insert_self_player
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  id = (SELECT auth.uid())
  AND COALESCE(role, 'player') = 'player'
);

-- Defense in depth for direct table updates. Owners may revise pending plan
-- details, but review/completion fields remain administrator-controlled even if
-- a future policy accidentally becomes too permissive.
CREATE OR REPLACE FUNCTION private.guard_craft_plan_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $function$
BEGIN
  IF COALESCE(auth.role(), '') = 'service_role'
     OR private.current_user_is_admin() THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR OLD.created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the plan owner or an administrator may update this craft plan'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Craft plan ownership cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  IF lower(COALESCE(NEW.status, 'draft')) NOT IN ('draft', 'submitted') THEN
    RAISE EXCEPTION 'Only an administrator may review, approve, reject, cancel, or complete a craft plan'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
     OR NEW.completed_by IS DISTINCT FROM OLD.completed_by
     OR NEW.completed_attempt_id IS DISTINCT FROM OLD.completed_attempt_id
     OR NEW.completion_output_item_id IS DISTINCT FROM OLD.completion_output_item_id
     OR NEW.completion_report IS DISTINCT FROM OLD.completion_report
     OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
     OR NEW.completion_notes IS DISTINCT FROM OLD.completion_notes THEN
    RAISE EXCEPTION 'Review and completion fields are administrator-controlled'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.guard_craft_plan_update() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.guard_craft_plan_update() TO service_role;

DROP TRIGGER IF EXISTS craft_plans_guard_non_admin_update ON public.craft_plans;
CREATE TRIGGER craft_plans_guard_non_admin_update
BEFORE UPDATE ON public.craft_plans
FOR EACH ROW
EXECUTE FUNCTION private.guard_craft_plan_update();

NOTIFY pgrst, 'reload schema';

COMMIT;
