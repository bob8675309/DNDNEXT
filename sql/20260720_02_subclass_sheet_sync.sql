-- Keep the player-facing sheet mirror aligned when an administrator changes
-- a source-backed subclass outside the transactional level-up flow.

create or replace function public.set_character_progression_v2(
  p_character_id uuid,
  p_class_key text,
  p_source text default 'XPHB',
  p_level integer default 1,
  p_experience_points bigint default 0,
  p_subclass_name text default null,
  p_subclass_source text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
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
$$;

revoke all on function public.set_character_progression_v2(uuid,text,text,integer,bigint,text,text) from public, anon;
grant execute on function public.set_character_progression_v2(uuid,text,text,integer,bigint,text,text) to authenticated;
