-- DNDNext anonymous helper RPC cleanup
--
-- The reviewed frontend only calls public.is_admin() after an authenticated
-- session exists. The preferred-version helpers are internal guards used by
-- authenticated character-creation and level-up transactions. None of these
-- helpers need to be executable by unsigned clients.
--
-- Function bodies and authenticated behavior are intentionally unchanged.

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_preferred_class_version_v1(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_preferred_spell_version_v1(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_preferred_class_version_v1(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_preferred_spell_version_v1(uuid) TO authenticated, service_role;

DO $postconditions$
BEGIN
  IF has_function_privilege('anon', 'public.is_admin()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.is_admin(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.is_preferred_class_version_v1(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.is_preferred_spell_version_v1(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'One or more reviewed helper RPCs remain anonymously executable';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.is_admin(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.is_preferred_class_version_v1(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.is_preferred_spell_version_v1(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated helper RPC access was not preserved';
  END IF;
END
$postconditions$;
