-- DNDNext REVIEW-ONLY candidate: inventory character-owner CHECK plus direct-DML RLS.
-- NOT A MIGRATION; no permission to deploy. On held PR #324 only.
-- Apply to disposable source-shaped PG17 + real GoTrue/PostgREST for J85+.
-- Future production migration MUST be generated via Supabase CLI, reviewed,
-- versioned and explicitly approved after full original/browser acceptance.
-- This source is intentionally never imported by runtime application code.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '20s';

DO $preflight$
BEGIN
 IF current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 THEN RAISE EXCEPTION 'Inventory candidate reviewed only against PostgreSQL 17'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM pg_class c
   WHERE c.oid='public.inventory_items'::regclass
     AND c.relrowsecurity AND NOT c.relforcerowsecurity
 ) THEN RAISE EXCEPTION 'Unexpected inventory RLS flags; refuse migration'; END IF;
 -- Explicit catalog EXISTS guards avoid ambiguous SELECT ... INTO record aliases.
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint c
   WHERE c.conrelid='public.inventory_items'::regclass
     AND c.conname='inventory_items_owner_type_chk'
     AND c.contype='c' AND NOT c.convalidated
     AND pg_get_constraintdef(c.oid,true)
       = 'CHECK (owner_type = ANY (ARRAY[''player''::text, ''npc''::text, ''merchant''::text])) NOT VALID'
 ) OR NOT EXISTS (
   SELECT 1 FROM pg_constraint c
   WHERE c.conrelid='public.inventory_items'::regclass
     AND c.conname='inventory_items_owner_type_check'
     AND c.contype='c' AND c.convalidated
     AND pg_get_constraintdef(c.oid,true)
       = 'CHECK (owner_type = ANY (ARRAY[''player''::text, ''npc''::text, ''merchant''::text, ''character''::text]))'
 ) THEN RAISE EXCEPTION 'Inventory owner CHECK source/validation changed; refuse migration'; END IF;
  IF (SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass)<>4
    OR (SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass
      AND polpermissive AND polroles=ARRAY['authenticated'::regrole::oid]
      AND ((polname='inventory_items_insert_owner_or_admin' AND polcmd='a')
        OR (polname='inventory_items_update_owner_or_admin' AND polcmd='w')
        OR (polname='inventory_items_delete_owner_or_admin' AND polcmd='d')
        OR (polname='inventory_items_select_owner_or_admin' AND polcmd='r')))<>4
  THEN RAISE EXCEPTION 'Unexpected inventory policies/roles, fail closed'; END IF;
  IF (SELECT count(*) FROM pg_policy
    WHERE polrelid='public.inventory_items'::regclass
      AND polname IN ('inventory_items_insert_owner_or_admin',
       'inventory_items_update_owner_or_admin','inventory_items_delete_owner_or_admin')
      AND ((coalesce(pg_get_expr(polqual,polrelid),'') NOT LIKE '%auth.uid%'
            AND polcmd<>'a')
       OR coalesce(pg_get_expr(polwithcheck,polrelid),'') NOT LIKE '%auth.uid%'
          AND polcmd IN ('a','w')
       OR coalesce(pg_get_expr(polwithcheck,polrelid),'') LIKE '%character%')) > 0
  THEN RAISE EXCEPTION 'Inventory pre-existing DML policy expression drift'; END IF;
  IF to_regprocedure('private.current_user_is_admin()') IS NULL
   OR to_regprocedure('private.can_access_character_v1(uuid,text)') IS NULL
   OR md5(pg_get_functiondef('private.can_access_character_v1(uuid,text)'::regprocedure))
      <>'97b5e6b059e6467e24c4283fe420c83e'
   OR NOT has_function_privilege('authenticated','private.can_access_character_v1(uuid,text)','EXECUTE')
   OR NOT has_schema_privilege('authenticated','private','USAGE')
   OR to_regprocedure('private.materialize_player_forge_starting_equipment_v1(uuid)') IS NULL
   OR md5(pg_get_functiondef('private.materialize_player_forge_starting_equipment_v1(uuid)'::regprocedure))
     <>'653e1b9d7cc47dcff2cef33a674b97f4'
   OR NOT has_table_privilege('authenticated','public.inventory_items','INSERT')
   OR NOT has_table_privilege('authenticated','public.inventory_items','UPDATE')
   OR NOT has_table_privilege('authenticated','public.inventory_items','DELETE')
  THEN RAISE EXCEPTION 'Inventory original materializer or authenticated DML grant drift'; END IF;
END $preflight$;

-- Existing GM/admin direct DML stays available. Ordinary user-owned item DML
-- retains existing semantics. Direct non-Admin rows of owner_type='character'
-- are forbidden: only original privileged RPC/materializer may create/update
-- character-owned equipment. Restrict OLD and NEW rows on UPDATE to prevent
-- simple character->player laundering, not just player->character minting.
ALTER POLICY inventory_items_insert_owner_or_admin ON public.inventory_items
  WITH CHECK (
    (user_id = (SELECT auth.uid()) AND owner_type IS DISTINCT FROM 'character')
    OR (SELECT private.current_user_is_admin())
  );

ALTER POLICY inventory_items_update_owner_or_admin ON public.inventory_items
  USING (
    (user_id = (SELECT auth.uid()) AND owner_type IS DISTINCT FROM 'character')
    OR (SELECT private.current_user_is_admin())
  )
  WITH CHECK (
    (user_id = (SELECT auth.uid()) AND owner_type IS DISTINCT FROM 'character')
    OR (SELECT private.current_user_is_admin())
  );

ALTER POLICY inventory_items_delete_owner_or_admin ON public.inventory_items
  USING (
    (user_id = (SELECT auth.uid()) AND owner_type IS DISTINCT FROM 'character')
    OR (SELECT private.current_user_is_admin())
  );

-- Tighten direct READ access to newly materialized character-owned rows
-- using unchanged source-original private.can_access_character_v1.
-- A revoked user_id owner may no longer SELECT the character-owned item.
-- CASE guards malformed owner_id before UUID cast.
ALTER POLICY inventory_items_select_owner_or_admin ON public.inventory_items
 USING (
   (SELECT private.current_user_is_admin())
   OR (
     user_id = (SELECT auth.uid())
     AND CASE
       WHEN owner_type = 'character' THEN
         CASE
           WHEN owner_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
             THEN private.can_access_character_v1(owner_id::uuid, 'inventory')
           ELSE false
         END
       ELSE true
     END
   )
 );

-- After RLS hardening, the already VALID newer owner CHECK remains authoritative.
-- No CASCADE. ACCESS EXCLUSIVE lock is acquired; 2s timeout aborts atomically.
ALTER TABLE public.inventory_items DROP CONSTRAINT inventory_items_owner_type_chk;

DO $postflight$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_constraint
   WHERE conrelid='public.inventory_items'::regclass
   AND conname='inventory_items_owner_type_chk')
 OR NOT EXISTS (SELECT 1 FROM pg_constraint
   WHERE conrelid='public.inventory_items'::regclass
   AND conname='inventory_items_owner_type_check' AND convalidated)
 OR (SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass)<>4
 OR (SELECT count(*) FROM pg_policy WHERE polrelid='public.inventory_items'::regclass
   AND polname IN ('inventory_items_insert_owner_or_admin',
    'inventory_items_update_owner_or_admin','inventory_items_delete_owner_or_admin',
    'inventory_items_select_owner_or_admin')
   AND (coalesce(pg_get_expr(polqual,polrelid),'') LIKE '%character%'
     OR coalesce(pg_get_expr(polwithcheck,polrelid),'') LIKE '%character%'))<>4
 THEN RAISE EXCEPTION 'Inventory postflight policy/constraint invariant failed'; END IF;
END $postflight$;
COMMIT;

-- NOT IN THIS CANDIDATE: full production browser, direct NPC/merchant
-- transfer permissions, all Forge trigger graphs,
-- inventory-crafting game authority, RLS/role hardening of other tables.
-- THIS DOES NOT AUTHORIZE A PRODUCTION RELEASE.
