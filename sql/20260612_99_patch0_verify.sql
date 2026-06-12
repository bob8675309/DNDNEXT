-- DNDNext Patch 0 verification.
-- Read-only. Raises an exception if a required security control is missing.

DO $verify$
DECLARE
  missing_rls text[];
  unexpected_anon_writes integer;
  missing_policies text[];
BEGIN
  SELECT array_agg(required.table_name ORDER BY required.table_name)
  INTO missing_rls
  FROM (
    VALUES
      ('user_profiles'),
      ('craft_plans'),
      ('crafting_attempts'),
      ('forage_tables'),
      ('forage_table_entries')
  ) AS required(table_name)
  LEFT JOIN pg_class AS c ON c.relname = required.table_name
  LEFT JOIN pg_namespace AS n ON n.oid = c.relnamespace AND n.nspname = 'public'
  WHERE c.oid IS NULL OR NOT c.relrowsecurity;

  IF missing_rls IS NOT NULL THEN
    RAISE EXCEPTION 'Patch 0 verification failed: RLS missing for %', missing_rls;
  END IF;

  SELECT count(*)
  INTO unexpected_anon_writes
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND grantee = 'anon'
    AND table_name IN (
      'user_profiles',
      'craft_plans',
      'crafting_attempts',
      'forage_tables',
      'forage_table_entries'
    )
    AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');

  IF unexpected_anon_writes <> 0 THEN
    RAISE EXCEPTION 'Patch 0 verification failed: anon retains % write grants', unexpected_anon_writes;
  END IF;

  IF has_function_privilege('anon', 'public.submit_craft_plan(jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.submit_crafting_attempt_report(jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.complete_craft_plan_v1(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Patch 0 verification failed: anon can execute a crafting write RPC';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.submit_craft_plan(jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.submit_crafting_attempt_report(jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.complete_craft_plan_v1(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Patch 0 verification failed: authenticated RPC grants are incomplete';
  END IF;

  IF to_regprocedure('private.current_user_is_admin()') IS NULL
     OR to_regprocedure('private.submit_craft_plan_impl(jsonb)') IS NULL
     OR to_regprocedure('private.submit_crafting_attempt_report_impl(jsonb)') IS NULL
     OR to_regprocedure('private.complete_craft_plan_v1_impl(uuid,uuid)') IS NULL
     OR to_regprocedure('private.guard_craft_plan_update()') IS NULL THEN
    RAISE EXCEPTION 'Patch 0 verification failed: a private authorization/implementation function is missing';
  END IF;

  IF has_function_privilege('anon', 'private.submit_craft_plan_impl(jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'private.submit_craft_plan_impl(jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'private.submit_crafting_attempt_report_impl(jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'private.submit_crafting_attempt_report_impl(jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'private.complete_craft_plan_v1_impl(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'private.complete_craft_plan_v1_impl(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Patch 0 verification failed: a private implementation RPC is directly executable by a browser role';
  END IF;

  SELECT array_agg(required.policy_name ORDER BY required.policy_name)
  INTO missing_policies
  FROM (
    VALUES
      ('user_profiles', 'user_profiles_select_self'),
      ('user_profiles', 'user_profiles_insert_self_player'),
      ('user_profiles', 'user_profiles_admin_all'),
      ('craft_plans', 'craft_plans_select_owner'),
      ('craft_plans', 'craft_plans_insert_owner'),
      ('craft_plans', 'craft_plans_update_owner_pending'),
      ('craft_plans', 'craft_plans_delete_owner_draft'),
      ('craft_plans', 'craft_plans_admin_all'),
      ('crafting_attempts', 'crafting_attempts_select_owner'),
      ('crafting_attempts', 'crafting_attempts_insert_owner'),
      ('crafting_attempts', 'crafting_attempts_admin_all'),
      ('forage_tables', 'forage_tables_public_read'),
      ('forage_tables', 'forage_tables_admin_write'),
      ('forage_table_entries', 'forage_table_entries_public_read'),
      ('forage_table_entries', 'forage_table_entries_admin_write')
  ) AS required(table_name, policy_name)
  LEFT JOIN pg_policies AS p
    ON p.schemaname = 'public'
   AND p.tablename = required.table_name
   AND p.policyname = required.policy_name
  WHERE p.policyname IS NULL;

  IF missing_policies IS NOT NULL THEN
    RAISE EXCEPTION 'Patch 0 verification failed: policies missing %', missing_policies;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger AS t
    JOIN pg_class AS c ON c.oid = t.tgrelid
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'craft_plans'
      AND t.tgname = 'craft_plans_guard_non_admin_update'
      AND NOT t.tgisinternal
      AND t.tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'Patch 0 verification failed: craft plan update guard trigger is missing or disabled';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Patch 0 verification failed: no administrator profile remains';
  END IF;
END;
$verify$;

SELECT jsonb_build_object(
  'status', 'ok',
  'rls_tables', (
    SELECT jsonb_agg(jsonb_build_object('table', c.relname, 'rls', c.relrowsecurity) ORDER BY c.relname)
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('user_profiles','craft_plans','crafting_attempts','forage_tables','forage_table_entries')
  ),
  'data_counts', jsonb_build_object(
    'recipes', (SELECT count(*) FROM public.recipes),
    'alchemy_recipes', (SELECT count(*) FROM public.recipes WHERE lower(COALESCE(discipline,'')) = 'alchemy'),
    'alchemy_catalog_items', (SELECT count(*) FROM public.items_catalog WHERE COALESCE(payload->'alchemy'->>'kind','') = 'ingredient'),
    'forage_tables', (SELECT count(*) FROM public.forage_tables),
    'forage_entries', (SELECT count(*) FROM public.forage_table_entries),
    'craft_plans', (SELECT count(*) FROM public.craft_plans),
    'crafting_attempts', (SELECT count(*) FROM public.crafting_attempts)
  )
) AS patch0_verification;
