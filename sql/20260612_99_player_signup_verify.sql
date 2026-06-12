-- DNDNext player signup/profile verification.
-- Read-only. Raises an exception when provisioning or access controls are missing.

DO $verify$
DECLARE
  auth_user_count integer;
  player_profile_count integer;
  role_profile_count integer;
  duplicate_user_count integer;
  missing_policies text[];
BEGIN
  SELECT count(*) INTO auth_user_count FROM auth.users;
  SELECT count(DISTINCT user_id) INTO player_profile_count
  FROM public.players
  WHERE user_id IS NOT NULL;
  SELECT count(*) INTO role_profile_count
  FROM public.user_profiles
  WHERE id IN (SELECT id FROM auth.users);

  IF player_profile_count <> auth_user_count THEN
    RAISE EXCEPTION 'Signup verification failed: % auth users but % player rows',
      auth_user_count, player_profile_count;
  END IF;

  IF role_profile_count <> auth_user_count THEN
    RAISE EXCEPTION 'Signup verification failed: % auth users but % role rows',
      auth_user_count, role_profile_count;
  END IF;

  SELECT count(*) INTO duplicate_user_count
  FROM (
    SELECT user_id
    FROM public.players
    WHERE user_id IS NOT NULL
    GROUP BY user_id
    HAVING count(*) > 1
  ) duplicates;

  IF duplicate_user_count <> 0 THEN
    RAISE EXCEPTION 'Signup verification failed: duplicate player rows exist for % users',
      duplicate_user_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger trigger_row
    JOIN pg_class table_row ON table_row.oid = trigger_row.tgrelid
    JOIN pg_namespace schema_row ON schema_row.oid = table_row.relnamespace
    WHERE schema_row.nspname = 'auth'
      AND table_row.relname = 'users'
      AND trigger_row.tgname = 'on_auth_user_created'
      AND NOT trigger_row.tgisinternal
      AND trigger_row.tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'Signup verification failed: auth user provisioning trigger is missing';
  END IF;

  IF position(
    'values (new.id, ''player'')'
    IN lower(pg_get_functiondef('public.sync_user_profile()'::regprocedure))
  ) = 0 THEN
    RAISE EXCEPTION 'Signup verification failed: new profiles are not forced to player';
  END IF;

  IF has_table_privilege('anon', 'public.players', 'SELECT')
     OR has_table_privilege('anon', 'public.players', 'INSERT')
     OR has_table_privilege('anon', 'public.players', 'UPDATE')
     OR has_table_privilege('anon', 'public.players', 'DELETE') THEN
    RAISE EXCEPTION 'Signup verification failed: anon retains direct players-table privileges';
  END IF;

  SELECT array_agg(required.policy_name ORDER BY required.policy_name)
  INTO missing_policies
  FROM (
    VALUES
      ('players_select_self'),
      ('players_insert_self'),
      ('players_update_self'),
      ('players_admin_all')
  ) required(policy_name)
  LEFT JOIN pg_policies policy_row
    ON policy_row.schemaname = 'public'
   AND policy_row.tablename = 'players'
   AND policy_row.policyname = required.policy_name
  WHERE policy_row.policyname IS NULL;

  IF missing_policies IS NOT NULL THEN
    RAISE EXCEPTION 'Signup verification failed: policies missing %', missing_policies;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE role = 'admin') THEN
    RAISE EXCEPTION 'Signup verification failed: no administrator profile remains';
  END IF;
END;
$verify$;

SELECT jsonb_build_object(
  'status', 'ok',
  'auth_users', (SELECT count(*) FROM auth.users),
  'player_rows', (SELECT count(*) FROM public.players WHERE user_id IS NOT NULL),
  'role_rows', (SELECT count(*) FROM public.user_profiles),
  'admin_rows', (SELECT count(*) FROM public.user_profiles WHERE role = 'admin'),
  'trigger_function', pg_get_functiondef('public.sync_user_profile()'::regprocedure)
) AS player_signup_verification;
