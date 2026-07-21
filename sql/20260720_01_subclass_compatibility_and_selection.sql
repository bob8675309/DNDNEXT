-- Source-aware subclass discovery and validated character progression selection.
-- Supplemental subclasses remain attached to their original class lineage in
-- the imported 5etools data, so consumers must resolve them by class key and
-- carry the actual subclass source through progression updates.

create or replace function public.get_class_subclass_options_v1(
  p_class_key text,
  p_class_source text default 'XPHB'
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  with grouped as (
    select
      lower(btrim(c.class_key)) as class_key,
      c.class_source,
      c.subclass_name,
      coalesce(nullif(btrim(c.subclass_short_name),''), c.subclass_name) as subclass_short_name,
      c.source,
      count(*)::integer as feature_count,
      count(*) filter (where nullif(btrim(coalesce(c.description,'')),'') is not null)::integer as described_feature_count,
      min(c.level)::integer as first_level,
      max(c.updated_at) as updated_at
    from public.class_feature_catalog c
    where c.feature_type = 'subclass'
      and lower(btrim(c.class_key)) = lower(btrim(coalesce(p_class_key,'')))
      and nullif(btrim(c.subclass_name),'') is not null
    group by c.class_key, c.class_source, c.subclass_name, c.subclass_short_name, c.source
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'key', class_key || ':' || lower(source) || ':' || regexp_replace(lower(subclass_short_name),'[^a-z0-9]+','-','g'),
    'classKey', class_key,
    'classSource', class_source,
    'name', subclass_name,
    'shortName', subclass_short_name,
    'source', source,
    'featureCount', feature_count,
    'describedFeatureCount', described_feature_count,
    'firstLevel', first_level,
    'matchesClassSource', upper(class_source) = upper(btrim(coalesce(p_class_source,'')))
  ) order by lower(subclass_name), upper(source), upper(class_source)), '[]'::jsonb)
  from grouped;
$$;

revoke all on function public.get_class_subclass_options_v1(text,text) from public, anon;
grant execute on function public.get_class_subclass_options_v1(text,text) to authenticated;

create or replace function private.resolve_subclass_choice_v1(
  p_class_key text,
  p_class_source text,
  p_subclass_name text,
  p_subclass_source text
)
returns table(
  subclass_name text,
  subclass_short_name text,
  subclass_source text,
  subclass_class_source text
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select
    c.subclass_name,
    coalesce(nullif(btrim(c.subclass_short_name),''), c.subclass_name),
    c.source,
    c.class_source
  from public.class_feature_catalog c
  where c.feature_type = 'subclass'
    and lower(btrim(c.class_key)) = lower(btrim(coalesce(p_class_key,'')))
    and upper(btrim(c.source)) = upper(btrim(coalesce(p_subclass_source,'')))
    and (
      lower(btrim(c.subclass_name)) = lower(btrim(coalesce(p_subclass_name,'')))
      or lower(btrim(coalesce(c.subclass_short_name,''))) = lower(btrim(coalesce(p_subclass_name,'')))
    )
  group by c.subclass_name, c.subclass_short_name, c.source, c.class_source
  order by
    (upper(c.class_source) = upper(btrim(coalesce(p_class_source,'')))) desc,
    count(*) filter (where nullif(btrim(coalesce(c.description,'')),'') is not null) desc,
    count(*) desc,
    c.subclass_name
  limit 1;
$$;

revoke all on function private.resolve_subclass_choice_v1(text,text,text,text) from public, anon, authenticated;

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

  return public.get_character_progression_v1(p_character_id);
end;
$$;

revoke all on function public.set_character_progression_v2(uuid,text,text,integer,bigint,text,text) from public, anon;
grant execute on function public.set_character_progression_v2(uuid,text,text,integer,bigint,text,text) to authenticated;

create or replace function public.complete_character_level_up_v2(
  p_character_id uuid,
  p_selections jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_choice record;
  v_selections jsonb := coalesce(p_selections,'{}'::jsonb);
  v_name text := nullif(btrim(coalesce(v_selections->>'subclass_name','')),'');
  v_source text := nullif(btrim(coalesce(v_selections->>'subclass_source','')),'');
  v_sheet jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to complete this level up.' using errcode = '42501';
  end if;

  select * into v_progression
  from public.character_progression
  where character_id = p_character_id;
  if v_progression.character_id is null then
    raise exception 'Character progression has not been initialized.' using errcode = 'P0002';
  end if;

  select * into v_class from public.class_catalog where id = v_progression.class_id;
  if v_name is not null then
    if v_source is null then
      raise exception 'Choose a source-backed subclass.';
    end if;
    select * into v_choice
    from private.resolve_subclass_choice_v1(v_class.class_key,v_class.source,v_name,v_source);
    if v_choice.subclass_name is null then
      raise exception 'Subclass % from source % is not available for %.', v_name, v_source, v_class.class_name using errcode = 'P0002';
    end if;
    v_name := v_choice.subclass_name;
    v_source := v_choice.subclass_source;
    v_selections := jsonb_set(v_selections,'{subclass_name}',to_jsonb(v_name),true);
    v_selections := jsonb_set(v_selections,'{subclass_source}',to_jsonb(v_source),true);
  end if;

  perform public.complete_character_level_up_v1(p_character_id,v_selections);

  if v_name is not null then
    update public.character_progression
    set subclass_name = v_name,
        subclass_source = v_source,
        updated_at = now()
    where character_id = p_character_id;

    select coalesce(sheet,'{}'::jsonb) into v_sheet
    from public.character_sheets
    where character_id = p_character_id
    for update;
    v_sheet := v_sheet || jsonb_build_object(
      'subclass', v_name,
      'subclassSource', v_source,
      'meta', coalesce(v_sheet->'meta','{}'::jsonb) || jsonb_build_object(
        'subclass', v_name,
        'subclassSource', v_source
      )
    );
    update public.character_sheets
    set sheet = v_sheet, updated_at = now()
    where character_id = p_character_id;

    update public.players p
    set sheet = v_sheet, updated_at = now()
    where p.user_id in (
      select cp.user_id
      from public.character_permissions cp
      where cp.character_id = p_character_id
    );
  end if;

  return public.get_character_progression_v1(p_character_id);
end;
$$;

revoke all on function public.complete_character_level_up_v2(uuid,jsonb) from public, anon;
grant execute on function public.complete_character_level_up_v2(uuid,jsonb) to authenticated;
