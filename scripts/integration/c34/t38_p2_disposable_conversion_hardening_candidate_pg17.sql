-- C34 T38-P2-R2: disposable-only conversion hardening candidate.
-- NEVER apply to hosted or production. Requires signed original R1 RED first.
\if :{?T38_P2_HARDENING_DISPOSABLE_CONFIRMED}
\else
\echo 'REFUSE T38-P2-R2: disposable confirmation missing'
\quit 1
\endif
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $original_only$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.test_admins') IS NULL
 OR to_regclass('public.character_permissions') IS NULL
 OR to_regclass('public.character_stock') IS NULL
 OR to_regclass('public.character_sheets') IS NULL
 OR to_regclass('public.user_profiles') IS NULL
 OR md5(pg_get_functiondef('public.set_character_kind(uuid,text)'::regprocedure))
  <> '04588d4b433b13c92e612039a7c7e56e'
 OR md5(pg_get_functiondef('public.convert_character_type(uuid,text)'::regprocedure))
  <> '1a6ab5aa4bc58eceace51ad3803ed961'
 OR md5(pg_get_functiondef('private.can_access_character_v1(uuid,text)'::regprocedure))
  <> '97b5e6b059e6467e24c4283fe420c83e'
 OR has_table_privilege('authenticated','public.characters','UPDATE')
 OR NOT has_column_privilege('authenticated','public.characters','kind','UPDATE')
 OR NOT has_column_privilege('authenticated','public.characters','storefront_enabled','UPDATE')
 THEN RAISE EXCEPTION 'T38 REFUSE: original signed baseline or narrow ACL drift'; END IF;
END $original_only$;

-- can_edit is a ROW-level grant, not a can_convert column grant. Remove only
-- direct kind UPDATE; the original merchant Store checkbox still needs UPDATE
-- on storefront_enabled and must not be broken by this security candidate.
REVOKE UPDATE (kind) ON TABLE public.characters FROM authenticated;

-- Preserve every original read/inventory/edit behavior and change only
-- 'convert' from (can_convert OR can_edit) to exact can_convert.
CREATE OR REPLACE FUNCTION private.can_access_character_v1(
 p_character_id uuid, p_permission text DEFAULT 'read'::text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $t38_acl$
 SELECT private.current_user_is_admin()
 OR EXISTS(
  SELECT 1 FROM public.character_permissions cp
  WHERE cp.character_id=p_character_id
    AND cp.user_id=auth.uid()
    AND CASE lower(coalesce(p_permission,'read'))
      WHEN 'inventory' THEN cp.can_inventory OR cp.can_edit
      WHEN 'convert' THEN cp.can_convert
      WHEN 'edit' THEN cp.can_edit
      ELSE cp.can_inventory OR cp.can_edit OR cp.can_convert
    END
 );
$t38_acl$;

-- Same public entrypoint and storefront/stock semantics for ACTUAL changes;
-- roles checked from the canonical DB, never JWT user_metadata.
CREATE OR REPLACE FUNCTION public.set_character_kind(p_character_id uuid,p_target text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $t38_convert$
DECLARE
 v_actor uuid:=auth.uid();
 v_role text;
 v_manager boolean:=false;
 v_delegate boolean:=false;
 v_target text;
 v_from text;
BEGIN
 IF v_actor IS NULL THEN
  RAISE EXCEPTION 'Conversion requires sign-in' USING ERRCODE='42501';
 END IF;
 -- Hold the actor's current role/delegation rows stable throughout the RPC.
 SELECT up.role INTO v_role FROM public.user_profiles up
  WHERE up.id=v_actor FOR SHARE;
 v_manager:=coalesce(v_role IN ('admin','gm','dm'),false);
 IF NOT v_manager THEN
  SELECT cp.can_convert INTO v_delegate FROM public.character_permissions cp
   WHERE cp.character_id=p_character_id AND cp.user_id=v_actor FOR SHARE;
 END IF;
 IF NOT v_manager AND NOT coalesce(v_delegate,false) THEN
  RAISE EXCEPTION 'Character conversion permission required' USING ERRCODE='42501';
 END IF;
 IF p_character_id IS NULL THEN
  RAISE EXCEPTION 'Character ID required' USING ERRCODE='22023';
 END IF;
 v_target:=lower(coalesce(p_target,''));
 IF v_target NOT IN ('npc','merchant') THEN
  RAISE EXCEPTION 'Invalid target kind' USING ERRCODE='22023';
 END IF;
 -- Serialize concurrent character conversions before touching stock.
 SELECT c.kind INTO v_from FROM public.characters c
  WHERE c.id=p_character_id FOR UPDATE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Character not found' USING ERRCODE='22023';
 END IF;
 IF v_from NOT IN ('npc','merchant') THEN
  RAISE EXCEPTION 'Only NPCs or merchants can convert' USING ERRCODE='22023';
 END IF;
 -- A repeat conversion MUST NOT delete merchant stock or alter metadata.
 IF v_from=v_target THEN RETURN; END IF;
 DELETE FROM public.character_stock s WHERE s.character_id=p_character_id;
 IF v_target='merchant' THEN
  UPDATE public.characters
   SET kind='merchant',storefront_enabled=true,updated_at=now()
   WHERE id=p_character_id;
 ELSE
  UPDATE public.characters
   SET kind='npc',storefront_enabled=false,
    storefront_title=NULL,storefront_tagline=NULL,
    storefront_bg_url=NULL,storefront_bg_video_url=NULL,
    storefront_bg_image_url=NULL,updated_at=now()
   WHERE id=p_character_id;
 END IF;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Conversion update failed' USING ERRCODE='23514';
 END IF;
END;
$t38_convert$;

-- The original compatibility alias is deliberately unmodified.
DO $check$
BEGIN
 IF has_table_privilege('authenticated','public.characters','UPDATE')
 OR has_column_privilege('authenticated','public.characters','kind','UPDATE')
 OR NOT has_column_privilege('authenticated','public.characters','storefront_enabled','UPDATE')
 OR md5(pg_get_functiondef('public.convert_character_type(uuid,text)'::regprocedure))
  <> '1a6ab5aa4bc58eceace51ad3803ed961'
 OR position('WHEN ''convert'' THEN cp.can_convert' IN
  pg_get_functiondef('private.can_access_character_v1(uuid,text)'::regprocedure))=0
 THEN RAISE EXCEPTION 'T38 candidate authorization/alias integrity failure'; END IF;
END $check$;
COMMIT;
NOTIFY pgrst,'reload schema';
