-- Fix: PostgREST/Supabase RPC ambiguity caused by function overloading.
--
-- Symptom (browser console):
--   "Could not choose the best candidate function between:
--      public.reroll_merchant_inventory_v2(p_merchant_id => uuid, p_theme => text),
--      public.reroll_merchant_inventory_v2(p_merchant_id => uuid, p_theme => text, p_count => integer)"
--
-- Root cause:
--   Two overloaded functions share the same name. PostgREST RPC cannot reliably
--   disambiguate overloads.
--
-- Resolution (safe):
--   Rename the 2-argument overload so only ONE function named
--   public.reroll_merchant_inventory_v2 remains.
--
-- Notes:
--   - This does NOT delete the legacy function body; it just renames it.
--   - Your app should call the 3-arg version and always pass p_count.

BEGIN;

-- Optional: inspect current overloads
-- SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname='public' AND p.proname='reroll_merchant_inventory_v2';

DO $$
BEGIN
  -- If the 2-arg overload exists, rename it out of the way.
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'reroll_merchant_inventory_v2'
      AND pg_get_function_identity_arguments(p.oid) = 'uuid, text'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.reroll_merchant_inventory_v2(uuid, text) RENAME TO reroll_merchant_inventory_v2_legacy';
  END IF;
END $$;

COMMIT;

-- After running, you should see ONLY one remaining function with the original name:
-- SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname='public' AND p.proname IN ('reroll_merchant_inventory_v2','reroll_merchant_inventory_v2_legacy');
