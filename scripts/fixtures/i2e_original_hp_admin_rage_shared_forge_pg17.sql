-- I2-E source-original HP, Admin progression and Rage/action-state functions.
-- EXACT original hosted source bodies captured through SELECT-only pg_get_functiondef
-- on Nov 11 2026; no live row/sheet data was read.
-- DISPOSABLE ONLY, after unchanged I1-B..O + I2C + I2D signed suites.
-- Install the original three *before* new original RED assertions.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR to_regclass('private.test_admins') IS NULL
 OR md5(pg_get_functiondef('private.create_player_character_v2_source_20261105(jsonb,jsonb)'::regprocedure))<>'00b2167041b9c2e4e1a98d3873839f37'
 OR md5(pg_get_functiondef('public.set_character_progression_v1(uuid,text,text,integer,bigint,text,text)'::regprocedure))<>'eb467b7c7a8d548581a36cfcb0d8f77b'
 THEN RAISE EXCEPTION 'I2-E must run only after signed full inherited Forge+Option A I2D disposable scratch'; END IF;
END $guard$;

-- SOURCE ORIGINAL public.adjust_character_hit_points_v1(p_character_id uuid, p_amount integer, p_temp_hp integer), md5=f855be60d971aa63e32ade327d14c369
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
$function$
;

-- SOURCE ORIGINAL public.set_character_progression_v2(p_character_id uuid, p_class_key text, p_source text, p_level integer, p_experience_points bigint, p_subclass_name text, p_subclass_source text), md5=c4ea1c7993912f6b4c6fe9ee7b25343f
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
$function$
;

-- SOURCE ORIGINAL public.update_character_sheet_action_state_v1(p_character_id uuid, p_action_key text, p_operation text), md5=313a533250724b2e2abc754899d0f8d4
CREATE OR REPLACE FUNCTION public.update_character_sheet_action_state_v1(p_character_id uuid, p_action_key text, p_operation text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_sheet jsonb;
  v_action_key text := lower(trim(coalesce(p_action_key,'')));
  v_operation text := lower(trim(coalesce(p_operation,'')));
  v_class_key text;
  v_level integer;
  v_max integer;
  v_remaining integer;
  v_active boolean;
  v_current_state jsonb;
  v_next_state jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to use this character''s sheet actions.' using errcode = '42501';
  end if;
  if v_operation not in ('activate','deactivate','reset') then
    raise exception 'Unsupported sheet action operation.' using errcode = '22023';
  end if;

  select sheet into v_sheet
  from public.character_sheets
  where character_id=p_character_id
  for update;

  if v_sheet is null then
    raise exception 'No character sheet exists for this character.' using errcode = 'P0002';
  end if;

  v_class_key := lower(trim(coalesce(
    v_sheet->>'classKey',
    v_sheet#>>'{meta,classKey}',
    v_sheet->>'className',
    v_sheet->>'class',
    ''
  )));
  v_class_key := regexp_replace(v_class_key,'[^a-z0-9]+','-','g');
  v_class_key := trim(both '-' from v_class_key);

  if coalesce(v_sheet->>'level',v_sheet#>>'{meta,level}','') ~ '^\d+$' then
    v_level := greatest(1,least(20,coalesce(v_sheet->>'level',v_sheet#>>'{meta,level}')::integer));
  else
    v_level := 1;
  end if;

  if v_action_key = 'rage' then
    if v_class_key <> 'barbarian' then
      raise exception 'Rage is only available to a Barbarian sheet.' using errcode = '22023';
    end if;
    if coalesce(v_sheet->>'rages','') ~ '^\d+$' then
      v_max := greatest(0,least(99,(v_sheet->>'rages')::integer));
    else
      v_max := case
        when v_level <= 2 then 2
        when v_level <= 5 then 3
        when v_level <= 11 then 4
        when v_level <= 16 then 5
        else 6
      end;
    end if;
  else
    raise exception 'Unsupported sheet action.' using errcode = '22023';
  end if;

  v_current_state := case
    when jsonb_typeof(v_sheet#>'{actionState,rage}') = 'object' then v_sheet#>'{actionState,rage}'
    else '{}'::jsonb
  end;
  v_active := coalesce((v_current_state->>'active')::boolean,false);
  if coalesce(v_current_state->>'usesRemaining','') ~ '^\d+$' then
    v_remaining := greatest(0,least(v_max,(v_current_state->>'usesRemaining')::integer));
  else
    v_remaining := v_max;
  end if;

  if v_operation = 'activate' and not v_active then
    if v_remaining <= 0 then
      raise exception 'No Rage uses remain. Reset uses after the appropriate rest.' using errcode = '22023';
    end if;
    v_remaining := v_remaining-1;
    v_active := true;
  elsif v_operation = 'deactivate' then
    v_active := false;
  elsif v_operation = 'reset' then
    v_active := false;
    v_remaining := v_max;
  end if;

  v_next_state := jsonb_build_object(
    'active',v_active,
    'usesRemaining',v_remaining,
    'usesMax',v_max,
    'updatedAt',timezone('utc',now())
  );
  v_sheet := jsonb_set(v_sheet,'{actionState}',coalesce(v_sheet->'actionState','{}'::jsonb),true);
  v_sheet := jsonb_set(v_sheet,'{actionState,rage}',v_next_state,true);

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
    'actionKey',v_action_key,
    'operation',v_operation,
    'active',v_active,
    'usesRemaining',v_remaining,
    'usesMax',v_max,
    'sheet',v_sheet
  );
end;
$function$
;

DO $verify$
BEGIN
 IF md5(pg_get_functiondef('public.adjust_character_hit_points_v1(uuid,integer,integer)'::regprocedure))<>'f855be60d971aa63e32ade327d14c369' THEN RAISE EXCEPTION 'I2E original source drift public.adjust_character_hit_points_v1'; END IF;
 IF md5(pg_get_functiondef('public.set_character_progression_v2(uuid,text,text,integer,bigint,text,text)'::regprocedure))<>'c4ea1c7993912f6b4c6fe9ee7b25343f' THEN RAISE EXCEPTION 'I2E original source drift public.set_character_progression_v2'; END IF;
 IF md5(pg_get_functiondef('public.update_character_sheet_action_state_v1(uuid,text,text)'::regprocedure))<>'313a533250724b2e2abc754899d0f8d4' THEN RAISE EXCEPTION 'I2E original source drift public.update_character_sheet_action_state_v1'; END IF;
 IF md5(pg_get_functiondef('public.set_character_progression_v1(uuid,text,text,integer,bigint,text,text)'::regprocedure))<>'eb467b7c7a8d548581a36cfcb0d8f77b'
 THEN RAISE EXCEPTION 'Original admin-v1 canonical caller source drift'; END IF;
END $verify$;

REVOKE ALL ON FUNCTION public.adjust_character_hit_points_v1(uuid,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.adjust_character_hit_points_v1(uuid,integer,integer) TO authenticated;
REVOKE ALL ON FUNCTION public.set_character_progression_v2(uuid,text,text,integer,bigint,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_character_progression_v2(uuid,text,text,integer,bigint,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.update_character_sheet_action_state_v1(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_character_sheet_action_state_v1(uuid,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
\echo 'PASS I2E-ORIGINAL: all 3 exact live-source HP/Admin/Rage functions reinstalled in disposable scratch; original canonical progression v1 unchanged'
