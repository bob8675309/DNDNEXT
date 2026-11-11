-- I1-O ORIGINAL PG17 SOURCE: SELECT-only extracted from live DnDWeb on 2026-11-11 UTC.
-- Only install in the already-running DISPOSABLE LOCAL signed I1-M PG17/GoTrue
-- test after I1M-01..06. Never apply to hosted Supabase.
-- Original source bodies are byte-for-byte pg_get_functiondef outputs and
-- guarded by their respective independently observed MD5 fingerprints.
\set ON_ERROR_STOP on
DO $i1o_start$
BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR to_regprocedure('private.sync_character_artificer_plan_projection_v1(uuid)') IS NULL
 OR (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.character_progression'::regclass AND NOT tgisinternal AND tgenabled='O'
 AND tgname IN ('character_progression_validate_player_forge_class_options_v1',
 'character_progression_reject_unmarked_legacy_warlock_invocation',
 'character_progression_validate_player_forge_class_options_v2',
 'character_progression_materialize_eladrin_season_v1',
 'character_progression_materialize_player_forge_khoravar_skill_v',
 'character_progression_materialize_species_cantrip_v1',
 'character_progression_materialize_player_forge_artificer_plans_'))<>7
 THEN RAISE EXCEPTION 'I1-O source may only install after source-locked I1M signed scratch cases'; END IF;
END $i1o_start$;

-- Existing original Admin setter needs these columns in the reduced Forge
-- table and its history reader needs source row for level 2.
ALTER TABLE public.character_progression ADD COLUMN IF NOT EXISTS subclass_name text;
ALTER TABLE public.character_progression ADD COLUMN IF NOT EXISTS subclass_source text;
INSERT INTO public.class_level_progression(class_id,class_level,xp_threshold,proficiency_bonus,spell_slots)
SELECT '00000000-0000-0000-0000-000000000001',2,300,2,'{}'::jsonb
WHERE NOT EXISTS(SELECT 1 FROM public.class_level_progression
 WHERE class_id='00000000-0000-0000-0000-000000000001' AND class_level=2);

-- EXACT LIVE PG17 original private.can_manage_character_progression_v1 source MD5 ac70e4ec033d86c4e0a254d50d429a45
CREATE OR REPLACE FUNCTION private.can_manage_character_progression_v1(p_character_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
  select private.current_user_is_admin()
    or exists (
      select 1 from public.character_permissions cp
      where cp.character_id = p_character_id
        and cp.user_id = auth.uid()
        and cp.can_edit
    );
$function$;


-- EXACT LIVE PG17 original public.xp_threshold_for_level_v1 source MD5 d6111bcc35c85343df319fd5dc3d76e2
CREATE OR REPLACE FUNCTION public.xp_threshold_for_level_v1(p_level integer)
 RETURNS bigint
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select (array[
    0::bigint, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
    85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000
  ])[greatest(1, least(20, coalesce(p_level, 1)))];
$function$;


-- EXACT LIVE PG17 original public.get_character_progression_v1 source MD5 8df340fa72ee78973e6c6616e32e1ba8
CREATE OR REPLACE FUNCTION public.get_character_progression_v1(p_character_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
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
$function$;


-- EXACT LIVE PG17 original public.set_character_progression_v1 source MD5 eb467b7c7a8d548581a36cfcb0d8f77b
CREATE OR REPLACE FUNCTION public.set_character_progression_v1(p_character_id uuid, p_class_key text, p_source text DEFAULT 'XPHB'::text, p_level integer DEFAULT 1, p_experience_points bigint DEFAULT 0, p_subclass_name text DEFAULT NULL::text, p_subclass_source text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_class public.class_catalog%rowtype;
  v_before public.character_progression%rowtype;
  v_level integer := greatest(1, least(20, coalesce(p_level, 1)));
  v_xp bigint := greatest(0, coalesce(p_experience_points, 0));
  v_pending boolean;
  v_sheet jsonb;
begin
  perform private.require_character_admin_v1();
  if not exists (select 1 from public.characters where id = p_character_id) then
    raise exception 'Character not found.' using errcode = 'P0002';
  end if;

  select * into v_class
  from public.class_catalog
  where class_key = lower(btrim(coalesce(p_class_key,'')))
    and source = upper(btrim(coalesce(p_source,'XPHB')))
  limit 1;
  if v_class.id is null then
    raise exception 'Class % from source % is not available.', p_class_key, p_source using errcode = 'P0002';
  end if;

  select * into v_before from public.character_progression where character_id = p_character_id;
  v_pending := v_level < 20 and v_xp >= public.xp_threshold_for_level_v1(v_level + 1);

  insert into public.character_progression (
    character_id, class_id, subclass_name, subclass_source, class_level, experience_points,
    pending_level_up, created_by, updated_at
  ) values (
    p_character_id, v_class.id, nullif(btrim(p_subclass_name),''), nullif(btrim(p_subclass_source),''),
    v_level, v_xp, v_pending, auth.uid(), now()
  )
  on conflict (character_id) do update set
    class_id = excluded.class_id,
    subclass_name = excluded.subclass_name,
    subclass_source = excluded.subclass_source,
    class_level = excluded.class_level,
    experience_points = excluded.experience_points,
    pending_level_up = excluded.pending_level_up,
    updated_at = now();

  select sheet into v_sheet from public.character_sheets where character_id = p_character_id;
  v_sheet := coalesce(v_sheet, '{}'::jsonb)
    || jsonb_build_object(
      'classKey', v_class.class_key,
      'className', v_class.class_name,
      'class', v_class.class_name,
      'level', v_level,
      'rulesetSource', v_class.source,
      'ruleset', v_class.ruleset,
      'proficiencyBonus', 2 + floor((v_level - 1) / 4.0)::integer,
      'hitDice', v_level::text || 'd' || coalesce(v_class.hit_die, 8)::text
    );
  v_sheet := v_sheet || jsonb_build_object(
    'meta', coalesce(v_sheet->'meta','{}'::jsonb) || jsonb_build_object(
      'classKey', v_class.class_key,
      'className', v_class.class_name,
      'level', v_level,
      'rulesetSource', v_class.source,
      'ruleset', v_class.ruleset
    )
  );

  insert into public.character_sheets(character_id, sheet, updated_at)
  values (p_character_id, v_sheet, now())
  on conflict (character_id) do update set sheet = excluded.sheet, updated_at = now();

  insert into public.character_level_events (
    character_id, event_type, from_level, to_level, xp_before, xp_after, details, created_by
  ) values (
    p_character_id,
    case when v_before.character_id is null then 'progression_initialized' else 'progression_admin_updated' end,
    v_before.class_level,
    v_level,
    v_before.experience_points,
    v_xp,
    jsonb_build_object('classKey',v_class.class_key,'className',v_class.class_name,'source',v_class.source,'ruleset',v_class.ruleset),
    auth.uid()
  );

  return public.get_character_progression_v1(p_character_id);
end;
$function$;


-- EXACT LIVE PG17 original public.set_character_progression_v2 source MD5 c4ea1c7993912f6b4c6fe9ee7b25343f
CREATE OR REPLACE FUNCTION public.set_character_progression_v2(p_character_id uuid, p_class_key text, p_source text DEFAULT 'XPHB'::text, p_level integer DEFAULT 1, p_experience_points bigint DEFAULT 0, p_subclass_name text DEFAULT NULL::text, p_subclass_source text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_choice record;
  v_name text := nullif(btrim(coalesce(p_subclass_name,'')),'');
  v_source text := nullif(btrim(coalesce(p_subclass_source,'')),'');
  v_sheet jsonb;
begin
  if v_name is not null then
    if v_source is null then
      raise exception 'Choose a source-backed subclass.';
    end if;
    select * into v_choice
    from private.resolve_subclass_choice_v1(p_class_key,p_source,v_name,v_source);
    if v_choice.subclass_name is null then
      raise exception 'Subclass % from source % is not available for %.', v_name, v_source, p_class_key using errcode = 'P0002';
    end if;
    v_name := v_choice.subclass_name;
    v_source := v_choice.subclass_source;
  else
    v_source := null;
  end if;

  perform public.set_character_progression_v1(
    p_character_id,
    p_class_key,
    p_source,
    p_level,
    p_experience_points,
    v_name,
    v_source
  );

  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets
  where character_id = p_character_id
  for update;

  if v_name is null then
    v_sheet := (v_sheet - 'subclass' - 'subclassSource') || jsonb_build_object(
      'meta', coalesce(v_sheet->'meta','{}'::jsonb) - 'subclass' - 'subclassSource'
    );
  else
    v_sheet := v_sheet || jsonb_build_object(
      'subclass', v_name,
      'subclassSource', v_source,
      'meta', coalesce(v_sheet->'meta','{}'::jsonb) || jsonb_build_object(
        'subclass', v_name,
        'subclassSource', v_source
      )
    );
  end if;

  update public.character_sheets
  set sheet = v_sheet, updated_at = now()
  where character_id = p_character_id;

  update public.players p
  set sheet = v_sheet, updated_at = now()
  where p.user_id in (
    select cp.user_id
    from public.character_permissions cp
    where cp.character_id = p_character_id and cp.can_edit
  );

  return public.get_character_progression_v1(p_character_id);
end;
$function$;


-- EXACT LIVE PG17 original public.adjust_character_hit_points_v1 source MD5 f855be60d971aa63e32ade327d14c369
CREATE OR REPLACE FUNCTION public.adjust_character_hit_points_v1(p_character_id uuid, p_amount integer DEFAULT 0, p_temp_hp integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_sheet jsonb;
  v_max integer;
  v_current integer;
  v_temp integer;
  v_damage integer;
  v_absorbed integer;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to change this character''s hit points.' using errcode = '42501';
  end if;
  if abs(coalesce(p_amount,0)) > 100000 then
    raise exception 'Hit point changes are limited to 100000 at a time.';
  end if;
  if p_temp_hp is not null and (p_temp_hp < 0 or p_temp_hp > 100000) then
    raise exception 'Temporary hit points must be between 0 and 100000.';
  end if;

  select sheet into v_sheet
  from public.character_sheets
  where character_id = p_character_id
  for update;

  if v_sheet is null then
    raise exception 'No character sheet exists for this character.' using errcode = 'P0002';
  end if;

  begin
    v_max := greatest(0,coalesce(nullif(v_sheet->>'maxHp','')::integer,nullif(v_sheet->>'hp','')::integer,0));
    v_current := greatest(0,least(v_max,coalesce(nullif(v_sheet->>'hp','')::integer,v_max)));
    v_temp := greatest(0,coalesce(nullif(v_sheet->>'tempHp','')::integer,0));
  exception when others then
    raise exception 'The character sheet contains invalid hit point values.';
  end;

  if coalesce(p_amount,0) < 0 then
    v_damage := abs(p_amount);
    v_absorbed := least(v_temp,v_damage);
    v_temp := v_temp - v_absorbed;
    v_current := greatest(0,v_current-(v_damage-v_absorbed));
  elsif coalesce(p_amount,0) > 0 then
    v_current := least(v_max,v_current+p_amount);
  end if;

  if p_temp_hp is not null then
    v_temp := p_temp_hp;
  end if;

  v_sheet := jsonb_set(v_sheet,'{hp}',to_jsonb(v_current),true);
  v_sheet := jsonb_set(v_sheet,'{maxHp}',to_jsonb(v_max),true);
  v_sheet := jsonb_set(v_sheet,'{tempHp}',to_jsonb(v_temp),true);

  update public.character_sheets
  set sheet=v_sheet,updated_at=now()
  where character_id=p_character_id;

  update public.players p
  set sheet=v_sheet,updated_at=now()
  where p.user_id in (
    select cp.user_id
    from public.character_permissions cp
    where cp.character_id=p_character_id and cp.can_edit
  );

  return jsonb_build_object(
    'characterId',p_character_id,
    'currentHp',v_current,
    'maxHp',v_max,
    'tempHp',v_temp,
    'sheet',v_sheet
  );
end;
$function$;



DO $i1o_post$
BEGIN
 IF md5(pg_get_functiondef('private.can_manage_character_progression_v1(uuid)'::regprocedure))<>'ac70e4ec033d86c4e0a254d50d429a45' THEN RAISE EXCEPTION 'I1-O original function drift: private.can_manage_character_progression_v1'; END IF;
 IF md5(pg_get_functiondef('public.xp_threshold_for_level_v1(integer)'::regprocedure))<>'d6111bcc35c85343df319fd5dc3d76e2' THEN RAISE EXCEPTION 'I1-O original function drift: public.xp_threshold_for_level_v1'; END IF;
 IF md5(pg_get_functiondef('public.get_character_progression_v1(uuid)'::regprocedure))<>'8df340fa72ee78973e6c6616e32e1ba8' THEN RAISE EXCEPTION 'I1-O original function drift: public.get_character_progression_v1'; END IF;
 IF md5(pg_get_functiondef('public.set_character_progression_v1(uuid,text,text,integer,bigint,text,text)'::regprocedure))<>'eb467b7c7a8d548581a36cfcb0d8f77b' THEN RAISE EXCEPTION 'I1-O original function drift: public.set_character_progression_v1'; END IF;
 IF md5(pg_get_functiondef('public.set_character_progression_v2(uuid,text,text,integer,bigint,text,text)'::regprocedure))<>'c4ea1c7993912f6b4c6fe9ee7b25343f' THEN RAISE EXCEPTION 'I1-O original function drift: public.set_character_progression_v2'; END IF;
 IF md5(pg_get_functiondef('public.adjust_character_hit_points_v1(uuid,integer,integer)'::regprocedure))<>'f855be60d971aa63e32ade327d14c369' THEN RAISE EXCEPTION 'I1-O original function drift: public.adjust_character_hit_points_v1'; END IF;
END $i1o_post$;

-- Real clients call the two public RPСs. Original private helpers remain
-- inaccessible directly to signed clients in this reduced local fixture.
REVOKE ALL ON FUNCTION private.can_manage_character_progression_v1(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.adjust_character_hit_points_v1(uuid,integer,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.set_character_progression_v2(uuid,text,text,integer,bigint,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.set_character_progression_v1(uuid,text,text,integer,bigint,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.get_character_progression_v1(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.adjust_character_hit_points_v1(uuid,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_character_progression_v2(uuid,text,text,integer,bigint,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_character_progression_v1(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
\echo 'PASS I1O-ORIGINAL: six exact live PG17 progression/HP helpers source-hash-verified in disposable signed Forge'
