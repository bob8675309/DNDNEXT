-- C34 T46 RESEARCH CANDIDATE: per-user, GM-adjudicated progression discoveries.
-- NEVER APPLY TO HOSTED/PRODUCTION. This file intentionally depends on the
-- disposable P1.3 PG17 guard. A release migration requires a SEPARATE,
-- source-reconciled PR #345 Stage1-3 + full UI/role/legacy-reader plan.
BEGIN;
DO $c34_t46_guard$
BEGIN
 IF current_database() <> 'postgres'
 OR current_setting('server_version_num')::integer < 170000
 OR to_regclass('private.p13_levelup_case_guard') IS NULL
 OR to_regclass('auth.users') IS NULL
 OR to_regprocedure('public.get_character_progression_v1(uuid)') IS NULL
 OR to_regprocedure('private.can_manage_character_progression_v1(uuid)') IS NULL
 OR to_regprocedure('private.can_access_character_v1(uuid,text)') IS NULL
 OR to_regclass('public.user_profiles') IS NULL
 THEN RAISE EXCEPTION 'T46 CANDIDATE REFUSES production or incomplete isolated fixture'; END IF;
 IF md5(pg_get_functiondef('private.current_user_is_admin()'::regprocedure))
   <> '1fc5fbcb121b2862eeab869edfb3a209'
 THEN RAISE EXCEPTION 'Original admin-only role source drift; do not apply T46 scratch overlay'; END IF;
 IF position('select * into v_progression from public.character_progression'
  in lower(pg_get_functiondef('public.get_character_progression_v1(uuid)'::regprocedure))) = 0
 THEN RAISE EXCEPTION 'Original progression reader drift; stop'; END IF;
END $c34_t46_guard$;

-- Exactly one changed predicate in the source-original app role helper; this
-- is a disposable demonstration of the owner-approved exact role aliases,
-- NOT authorization to replace shared game helpers on hosted infrastructure.
CREATE OR REPLACE FUNCTION private.current_user_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles AS up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin', 'gm', 'dm')
    );
$function$;

-- Preserve historical #345 Stage1 sheet RLS candidate: visible NPCs do NOT
-- entitle signed outsiders to raw Sheet JSON. Stage2/3 client cutover remains held.
ALTER POLICY character_sheets_select_visible_or_assigned
ON public.character_sheets
USING ((SELECT private.can_access_character_v1(character_id,'edit')));

-- Full original progress reader retained verbatim EXCEPT one fail-closed
-- character-specific current-authority gate before the character SELECT.
create or replace function public.get_character_progression_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_character public.characters%rowtype;
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_current public.class_level_progression%rowtype;
  v_next public.class_level_progression%rowtype;
  v_floor bigint;
  v_next_threshold bigint;
  v_events jsonb := '[]'::jsonb;
  v_percent numeric := 0;
begin
  if auth.uid() is null and not private.current_user_is_admin() then
    raise exception 'Sign in is required to view character progression.' using errcode = '42501';
  end if;

  -- T46: full XP/class/session/event detail is never a public roster projection.
  -- Character editors and current Game Master authority only.
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to view full character progression.' using errcode = '42501';
  end if;

  select * into v_character from public.characters where id = p_character_id;
  if not found then raise exception 'Character not found.' using errcode = 'P0002'; end if;

  select * into v_progression from public.character_progression where character_id = p_character_id;
  if v_progression.character_id is null then
    return jsonb_build_object(
      'character', jsonb_build_object('id',v_character.id,'name',v_character.name,'kind',v_character.kind),
      'progression', null,
      'events', '[]'::jsonb
    );
  end if;

  select * into v_class from public.class_catalog where id = v_progression.class_id;
  select * into v_current from public.class_level_progression where class_id = v_progression.class_id and class_level = v_progression.class_level;
  select * into v_next from public.class_level_progression where class_id = v_progression.class_id and class_level = v_progression.class_level + 1;
  v_floor := public.xp_threshold_for_level_v1(v_progression.class_level);
  v_next_threshold := case when v_progression.class_level < 20 then public.xp_threshold_for_level_v1(v_progression.class_level + 1) else null end;
  if v_next_threshold is not null and v_next_threshold > v_floor then
    v_percent := greatest(0, least(100, round(((v_progression.experience_points - v_floor)::numeric / (v_next_threshold - v_floor)::numeric) * 100, 1)));
  elsif v_progression.class_level >= 20 then
    v_percent := 100;
  end if;

  select coalesce(jsonb_agg(event_row order by (event_row->>'created_at') desc), '[]'::jsonb)
  into v_events
  from (
    select to_jsonb(e) as event_row
    from public.character_level_events e
    where e.character_id = p_character_id
    order by e.created_at desc
    limit 20
  ) recent_events;

  return jsonb_build_object(
    'character', jsonb_build_object('id',v_character.id,'name',v_character.name,'kind',v_character.kind),
    'progression', to_jsonb(v_progression),
    'class', to_jsonb(v_class) - 'raw_payload',
    'currentLevel', to_jsonb(v_current) - 'raw_payload',
    'nextLevel', case when v_next.class_id is null then null else to_jsonb(v_next) - 'raw_payload' end,
    'xp', jsonb_build_object(
      'current', v_progression.experience_points,
      'levelFloor', v_floor,
      'nextThreshold', v_next_threshold,
      'intoLevel', greatest(0, v_progression.experience_points - v_floor),
      'neededForNext', case when v_next_threshold is null then 0 else greatest(0, v_next_threshold - v_progression.experience_points) end,
      'percent', v_percent
    ),
    'events', v_events
  );
end;
$$;

-- PRIVATE per-viewer discovery receipt; readable and writable only through
-- guarded, tightly projected SECURITY DEFINER functions.
CREATE TABLE private.c34_t46_progression_discoveries (
 character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
 viewer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 field_key text NOT NULL CHECK (field_key IN ('class','level','xp')),
 revealed boolean NOT NULL DEFAULT true,
 discovery_source text NOT NULL CHECK (discovery_source IN ('gm_direct','dialogue','ability_check')),
 adjudication_note text NOT NULL DEFAULT '' CHECK (length(adjudication_note) <= 500),
 adjudicated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (character_id,viewer_user_id,field_key)
);
ALTER TABLE private.c34_t46_progression_discoveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.c34_t46_progression_discoveries FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.c34_t46_set_progression_discovery_v1(
 p_character_id uuid, p_viewer_user_id uuid, p_field_key text,
 p_revealed boolean, p_source text DEFAULT 'gm_direct',
 p_note text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $fn$
BEGIN
 IF auth.uid() IS NULL OR NOT private.current_user_is_admin() THEN
  RAISE EXCEPTION 'Game Master permission required to adjudicate discovery.'
   USING errcode='42501';
 END IF;
 IF p_character_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.characters WHERE id=p_character_id)
 THEN RAISE EXCEPTION 'Character not found' USING errcode='P0002'; END IF;
 IF p_viewer_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id=p_viewer_user_id)
 THEN RAISE EXCEPTION 'Viewer not found' USING errcode='P0002'; END IF;
 IF p_field_key NOT IN ('class','level','xp') OR p_field_key IS NULL
 THEN RAISE EXCEPTION 'Unsupported discovery field' USING errcode='22023'; END IF;
 IF p_source NOT IN ('gm_direct','dialogue','ability_check') OR p_source IS NULL
 THEN RAISE EXCEPTION 'Unsupported discovery evidence' USING errcode='22023'; END IF;
 IF p_revealed IS NULL OR length(coalesce(p_note,'')) > 500
 THEN RAISE EXCEPTION 'Invalid discovery decision' USING errcode='22023'; END IF;

 INSERT INTO private.c34_t46_progression_discoveries
 (character_id,viewer_user_id,field_key,revealed,discovery_source,adjudication_note,adjudicated_by,updated_at)
 VALUES (p_character_id,p_viewer_user_id,p_field_key,p_revealed,p_source,coalesce(p_note,''),auth.uid(),now())
 ON CONFLICT (character_id,viewer_user_id,field_key)
 DO UPDATE SET revealed=excluded.revealed,discovery_source=excluded.discovery_source,
 adjudication_note=excluded.adjudication_note,adjudicated_by=excluded.adjudicated_by,
 updated_at=now();

 RETURN jsonb_build_object('characterId',p_character_id,'viewerId',p_viewer_user_id,
  'fieldKey',p_field_key,'revealed',p_revealed);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.c34_t46_get_progression_discoveries_v1(p_character_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog','public','private','auth'
AS $fn$
DECLARE v_result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN
  RAISE EXCEPTION 'Sign in required for discovered character details.' USING errcode='42501';
 END IF;
 SELECT jsonb_strip_nulls(jsonb_build_object(
  'characterId',c.id,
  'class',CASE WHEN EXISTS (
   SELECT 1 FROM private.c34_t46_progression_discoveries d
   WHERE d.character_id=c.id AND d.viewer_user_id=auth.uid()
    AND d.field_key='class' AND d.revealed
   ) THEN jsonb_build_object('name',cc.class_name,'source',cc.source) END,
  'level',CASE WHEN EXISTS (
   SELECT 1 FROM private.c34_t46_progression_discoveries d
   WHERE d.character_id=c.id AND d.viewer_user_id=auth.uid()
    AND d.field_key='level' AND d.revealed
   ) THEN cp.class_level END,
  'xp',CASE WHEN EXISTS (
   SELECT 1 FROM private.c34_t46_progression_discoveries d
   WHERE d.character_id=c.id AND d.viewer_user_id=auth.uid()
    AND d.field_key='xp' AND d.revealed
   ) THEN cp.experience_points END
 ))
 INTO v_result
 FROM public.characters c
 JOIN public.character_progression cp ON cp.character_id=c.id
 JOIN public.class_catalog cc ON cc.id=cp.class_id
 WHERE c.id=p_character_id AND NOT coalesce(c.is_hidden,false)
 AND EXISTS (
  SELECT 1 FROM private.c34_t46_progression_discoveries d
  WHERE d.character_id=c.id AND d.viewer_user_id=auth.uid() AND d.revealed
 );
 RETURN v_result;
END;
$fn$;

-- No direct visibility of the private record even to can_edit or players.
REVOKE ALL ON FUNCTION public.c34_t46_set_progression_discovery_v1(uuid,uuid,text,boolean,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.c34_t46_set_progression_discovery_v1(uuid,uuid,text,boolean,text,text)
 TO authenticated;
REVOKE ALL ON FUNCTION public.c34_t46_get_progression_discoveries_v1(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.c34_t46_get_progression_discoveries_v1(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_character_progression_v1(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_character_progression_v1(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
