-- C34 T36 TEST-ONLY: source-original NPC manager's direct narrative UPDATE
-- fails 42501 after authentic Stage2 five-column SELECT REVOKE. The correct
-- remedy is a guarded, narrowly whitelisted signed writer, never a global GRANT.
-- THIS FILE MUST RUN ONLY IN EPHEMERAL CI PG17, NOT ON HOSTED DNDWEB.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='75s';
DO $t36_gate$
BEGIN
 IF current_database()<>'postgres'
    OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
    OR to_regprocedure('private.can_access_character_v1(uuid,text)') IS NULL
    OR to_regprocedure('private.current_user_is_admin()') IS NULL
    OR to_regprocedure('public.get_npc_dossier_admin_v1(uuid)') IS NULL
    OR to_regprocedure('public.get_character_editor_narrative_v1(uuid)') IS NULL
    OR to_regprocedure('public.c34_game_manager_capabilities_research_v1()') IS NULL
    OR to_regprocedure('public.c34_npc_narrative_save_research_v1(uuid,jsonb)') IS NOT NULL
    OR to_regclass('public.characters') IS NULL
    OR has_column_privilege('authenticated','public.characters','background','SELECT')
    OR md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))
       <> '1dbe8c24c4c718396d7256f6f7465354'
 THEN RAISE EXCEPTION 'T36 REFUSE: requires unchanged disposable PG17 Stage2 ACL and signed T31 role source'; END IF;
END;
$t36_gate$;

CREATE OR REPLACE FUNCTION public.c34_npc_narrative_save_research_v1(
 p_character_id uuid, p_patch jsonb
)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $t36_guarded$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR p_character_id IS NULL
    OR NOT private.can_access_character_v1(p_character_id,'edit') THEN
   RAISE EXCEPTION 'NPC narrative editor permission required' USING errcode='42501';
 END IF;
 IF p_patch IS NULL OR jsonb_typeof(p_patch)<>'object' OR p_patch='{}'::jsonb THEN
   RAISE EXCEPTION 'Expected nonempty narrative patch object' USING errcode='22023';
 END IF;
 IF EXISTS(
   SELECT 1 FROM jsonb_each(p_patch) AS fields(key,value)
   WHERE fields.key NOT IN (
    'role','affiliation','description','background','motivation',
    'quirk','mannerism','voice'
   ) OR jsonb_typeof(fields.value) NOT IN ('string','null')
 ) THEN
   RAISE EXCEPTION 'Only narrative text columns may be edited' USING errcode='22023';
 END IF;
 -- Original /npcs onSave controls all eight keys and its original text/null
 -- semantics. This does NOT change secret, creator attribution, tags, kind,
 -- location, trade, world travel, inventory, wallet or sheet permissions.
 UPDATE public.characters AS c
 SET role=CASE WHEN p_patch ? 'role'
      THEN nullif(btrim(p_patch->>'role'),'') ELSE c.role END,
     affiliation=CASE WHEN p_patch ? 'affiliation'
      THEN nullif(btrim(p_patch->>'affiliation'),'') ELSE c.affiliation END,
     description=CASE WHEN p_patch ? 'description'
      THEN nullif(btrim(p_patch->>'description'),'') ELSE c.description END,
     background=CASE WHEN p_patch ? 'background'
      THEN nullif(btrim(p_patch->>'background'),'') ELSE c.background END,
     motivation=CASE WHEN p_patch ? 'motivation'
      THEN nullif(btrim(p_patch->>'motivation'),'') ELSE c.motivation END,
     quirk=CASE WHEN p_patch ? 'quirk'
      THEN nullif(btrim(p_patch->>'quirk'),'') ELSE c.quirk END,
     mannerism=CASE WHEN p_patch ? 'mannerism'
      THEN nullif(btrim(p_patch->>'mannerism'),'') ELSE c.mannerism END,
     voice=CASE WHEN p_patch ? 'voice'
      THEN nullif(btrim(p_patch->>'voice'),'') ELSE c.voice END,
     updated_at=timezone('utc',now())
 WHERE c.id=p_character_id
   AND c.kind IN ('npc','merchant')
   AND private.can_access_character_v1(c.id,'edit')
 RETURNING c.id INTO v_id;
 IF v_id IS NULL THEN
   RAISE EXCEPTION 'NPC narrative editor permission required' USING errcode='42501';
 END IF;
 RETURN true;
END;
$t36_guarded$;

REVOKE ALL ON FUNCTION public.c34_npc_narrative_save_research_v1(uuid,jsonb)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.c34_npc_narrative_save_research_v1(uuid,jsonb)
 TO authenticated;
COMMIT;
NOTIFY pgrst,'reload schema';
