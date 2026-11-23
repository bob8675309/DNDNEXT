-- RESEARCH-ONLY: new independent, versioned sandbox functions; do not modify legacy helpers.
-- Loaded on EMPTY disposable PG17/GoTrue after original-source RED.
-- No hosted SQL, migration, RLS installation or gameplay import. Current JWT actor only.
CREATE OR REPLACE FUNCTION private.p13_research_current_actor_is_manager_v1()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth'
AS $research$
 SELECT auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.user_profiles up
  WHERE up.id=auth.uid() AND up.role IN ('admin','gm','dm')
 );
$research$;
REVOKE ALL ON FUNCTION private.p13_research_current_actor_is_manager_v1() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.p13_research_current_actor_is_manager_v1() TO authenticated;

CREATE OR REPLACE FUNCTION public.p13_research_current_actor_is_manager_v1()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER
SET search_path TO 'pg_catalog','public','private','auth'
AS $research$
 SELECT auth.uid() IS NOT NULL AND private.p13_research_current_actor_is_manager_v1();
$research$;
REVOKE ALL ON FUNCTION public.p13_research_current_actor_is_manager_v1() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.p13_research_current_actor_is_manager_v1() TO authenticated;

CREATE OR REPLACE FUNCTION public.p13_research_get_npc_dossier_v1(p_character_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $research$
DECLARE v_dossier jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT private.p13_research_current_actor_is_manager_v1() THEN
  RAISE EXCEPTION 'GM-only NPC dossier access denied' USING errcode='42501';
 END IF;
 SELECT to_jsonb(c)||jsonb_build_object('character_sheet',coalesce(cs.sheet,'{}'::jsonb))
 INTO v_dossier FROM public.characters c
 LEFT JOIN public.character_sheets cs ON cs.character_id=c.id
 WHERE c.id=p_character_id;
 RETURN v_dossier;
END;
$research$;
REVOKE ALL ON FUNCTION public.p13_research_get_npc_dossier_v1(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.p13_research_get_npc_dossier_v1(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.p13_research_get_editor_narrative_v1(p_character_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $research$
 SELECT jsonb_build_object(
  'id',c.id,'background',c.background,'motivation',c.motivation,
  'quirk',c.quirk,'mannerism',c.mannerism,'voice',c.voice
 ) FROM public.characters c
 WHERE c.id=p_character_id AND auth.uid() IS NOT NULL AND (
  private.p13_research_current_actor_is_manager_v1()
  OR EXISTS (SELECT 1 FROM public.character_permissions cp WHERE cp.character_id=c.id AND cp.user_id=auth.uid() AND cp.can_edit)
 );
$research$;
REVOKE ALL ON FUNCTION public.p13_research_get_editor_narrative_v1(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.p13_research_get_editor_narrative_v1(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.p13_research_can_edit_creator_backstory_v1(p_character_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $research$
 SELECT auth.uid() IS NOT NULL AND (
  private.p13_research_current_actor_is_manager_v1()
  OR (
   EXISTS (SELECT 1 FROM public.character_permissions cp WHERE cp.character_id=p_character_id AND cp.user_id=auth.uid() AND cp.can_edit)
   AND EXISTS (SELECT 1 FROM private.character_creator_attribution attr WHERE attr.character_id=p_character_id AND attr.creator_user_id=auth.uid())
  )
 );
$research$;
REVOKE ALL ON FUNCTION public.p13_research_can_edit_creator_backstory_v1(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.p13_research_can_edit_creator_backstory_v1(uuid) TO authenticated;
