-- DNDNext P1.3 research STAGE TWO; UNAPPLIED / NOT ROLLOUT READY.
-- Requires previous 20261104_npc_player_safe_profile_rls_v1.sql and a
-- simultaneous client cutover. NEVER execute this against live DnDWeb.
-- Direct authenticated SELECT on private characters lore is removed here;
-- Admin dossier read is a separate authenticated/authorized RPC.
BEGIN;
DO $preflight$
DECLARE v_qual text;
BEGIN
 IF to_regprocedure('public.get_npc_profile_visible_v1(uuid)') IS NULL THEN
  RAISE EXCEPTION 'Safe NPC Profile stage one must be installed first';
 END IF;
 SELECT qual INTO v_qual FROM pg_policies WHERE schemaname='public'
  AND tablename='character_sheets'
  AND policyname='character_sheets_select_visible_or_assigned'
  AND cmd='SELECT';
 IF v_qual NOT LIKE '%can_access_character_v1%' THEN
  RAISE EXCEPTION 'Sheet RLS did not enter guarded editor-only stage';
 END IF;
END $preflight$;

-- Narrow table COLUMN ACL is a role-wide change, including for Admin users
-- accessing the table directly. Deploy ONLY with fully migrated Admin NPC,
-- Forge/player profile and shared NPC Profile readers. Column ACL DOES NOT
-- replace row-level policies or prevent SECURITY DEFINER functions bypassing.
REVOKE SELECT (
 background,motivation,quirk,mannerism,voice
) ON public.characters FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_npc_dossier_admin_v1(p_character_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $fn$
DECLARE v_dossier jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT private.current_user_is_admin() THEN
  RAISE EXCEPTION 'GM-only NPC dossier access denied' USING errcode='42501';
 END IF;

 SELECT to_jsonb(c)
  || jsonb_build_object(
    'character_sheet',coalesce(cs.sheet,'{}'::jsonb)
  )
 INTO v_dossier
 FROM public.characters c
 LEFT JOIN public.character_sheets cs ON cs.character_id=c.id
 WHERE c.id=p_character_id;

 RETURN v_dossier;
END;
$fn$;
REVOKE ALL ON FUNCTION public.get_npc_dossier_admin_v1(uuid)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_npc_dossier_admin_v1(uuid)
TO authenticated;

-- Editor-only non-secret narrative projection required by the role-wide
-- column SELECT revoke. A user must have CURRENT can_edit authority;
-- inventory-only, convert-only and visible outsiders cannot read this.
CREATE OR REPLACE FUNCTION public.get_character_editor_narrative_v1(p_character_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $fn$
  SELECT jsonb_build_object(
    'id',c.id,
    'background',c.background,
    'motivation',c.motivation,
    'quirk',c.quirk,
    'mannerism',c.mannerism,
    'voice',c.voice
  )
  FROM public.characters c
  WHERE c.id=p_character_id
    AND auth.uid() IS NOT NULL
    AND private.can_access_character_v1(c.id,'edit');
$fn$;
REVOKE ALL ON FUNCTION public.get_character_editor_narrative_v1(uuid)
FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_character_editor_narrative_v1(uuid)
TO authenticated;
COMMIT;
