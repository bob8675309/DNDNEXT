-- Exact deployed public.set_character_progression_v1 copied READ-ONLY
-- from live DnDWeb PG17.4; MD5 pg_get_functiondef=eb467b7c7a8d548581a36cfcb0d8f77b
-- Scratch isolated PG17 only; no production RPC or SQL changes.
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
