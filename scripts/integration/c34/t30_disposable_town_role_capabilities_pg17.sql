-- C34 T30 DISPOSABLE PG17 + GoTrue ONLY. Not a production migration.
-- Requires existing source-original Stage1/Stage2, and T29 scoped commerce
-- installation. No changes to global is_admin, merchant/wallet RPC or map.
\if :{?T30_DISPOSABLE_LOCAL_CONFIRMED}
\else
\echo 'T30 rejected: disposable local confirmation required.'
\quit 1
\endif
BEGIN;
DO $local_only$
BEGIN
 IF current_database() <> 'postgres' OR
    to_regprocedure('public.get_npc_profile_visible_v1(uuid)') IS NULL OR
    to_regprocedure('public.get_npc_dossier_admin_v1(uuid)') IS NULL OR
    to_regprocedure('public.get_character_editor_narrative_v1(uuid)') IS NULL OR
    to_regprocedure('public.buy_from_merchant(uuid,uuid,integer)') IS NULL OR
    to_regprocedure('public.stock_merchant_item(uuid,text,numeric,integer,jsonb)') IS NULL
 THEN RAISE EXCEPTION 'T30 requires local source-original Stage1/2/T29';
 END IF;
END
$local_only$;

CREATE OR REPLACE FUNCTION public.c34_town_role_capabilities_research_v1()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth'
AS $t30$
DECLARE v_role text;
BEGIN
 IF auth.uid() IS NULL THEN
   RAISE EXCEPTION 'Signed actor required' USING errcode='42501';
 END IF;
 -- Signed caller ONLY: never accept a target user id or editable JWT metadata.
 SELECT role INTO v_role FROM public.user_profiles WHERE id=auth.uid();
 v_role := coalesce(v_role,'');
 RETURN jsonb_build_object(
   'role',v_role,
   'canEditMerchantStock',v_role IN ('admin','gm','dm'),
   'canSetPlayerGold',v_role IN ('admin','gm','dm'),
   'canEditWorldTravel',v_role='admin',
   'canReadNpcDossier',v_role='admin',
   'canEditCharacterPrivacy',v_role='admin'
 );
END;
$t30$;
REVOKE ALL ON FUNCTION public.c34_town_role_capabilities_research_v1()
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.c34_town_role_capabilities_research_v1()
  TO authenticated;
COMMIT;
NOTIFY pgrst, 'reload schema';
