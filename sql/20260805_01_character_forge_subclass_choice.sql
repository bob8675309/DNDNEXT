-- Character Forge acceptance correction: validate and persist starting subclass choices.

create or replace function private.apply_character_forge_subclass_choice_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_sheet jsonb := '{}'::jsonb;
  v_meta jsonb := '{}'::jsonb;
  v_creator text := '';
  v_requested_name text;
  v_requested_source text;
  v_class_key text;
  v_class_source text;
  v_subclass_name text;
  v_subclass_source text;
  v_entry_level integer;
  v_first_available_level integer;
begin
  select coalesce(cs.sheet, '{}'::jsonb)
    into v_sheet
  from public.character_sheets cs
  where cs.character_id = new.character_id;

  v_meta := coalesce(v_sheet->'meta', '{}'::jsonb);
  v_creator := lower(btrim(coalesce(v_meta->>'creator', '')));
  v_requested_name := nullif(btrim(coalesce(v_sheet->>'subclassName', v_meta->>'subclassName')), '');
  v_requested_source := nullif(btrim(coalesce(v_sheet->>'subclassSource', v_meta->>'subclassSource')), '');

  select c.class_key, c.source
    into v_class_key, v_class_source
  from public.class_catalog c
  where c.id = new.class_id;

  if v_class_key is null then
    return new;
  end if;

  select min(
    case
      when upper(coalesce(v_class_source, '')) = 'XPHB'
       and upper(coalesce(f.class_source, '')) <> 'XPHB'
       and greatest(1, least(20, coalesce(f.level, 1))) < 3
        then 3
      else greatest(1, least(20, coalesce(f.level, 1)))
    end
  )
    into v_first_available_level
  from public.class_feature_catalog f
  where f.feature_type = 'subclass'
    and lower(f.class_key) = lower(v_class_key)
    and nullif(btrim(coalesce(f.subclass_name, f.subclass_short_name)), '') is not null;

  if v_requested_name is null then
    if v_creator = 'shared_character_forge_player_v2'
       and v_first_available_level is not null
       and new.class_level >= v_first_available_level then
      raise exception 'Choose a subclass for % level % before creating this character.', v_class_key, new.class_level;
    end if;
    return new;
  end if;

  with candidates as (
    select
      coalesce(nullif(btrim(f.subclass_name), ''), nullif(btrim(f.subclass_short_name), '')) as subclass_name,
      f.source as subclass_source,
      min(
        case
          when upper(coalesce(v_class_source, '')) = 'XPHB'
           and upper(coalesce(f.class_source, '')) <> 'XPHB'
           and greatest(1, least(20, coalesce(f.level, 1))) < 3
            then 3
          else greatest(1, least(20, coalesce(f.level, 1)))
        end
      ) as entry_level
    from public.class_feature_catalog f
    where f.feature_type = 'subclass'
      and lower(f.class_key) = lower(v_class_key)
      and lower(btrim(coalesce(f.subclass_name, f.subclass_short_name, ''))) = lower(v_requested_name)
      and (v_requested_source is null or upper(btrim(f.source)) = upper(v_requested_source))
    group by
      coalesce(nullif(btrim(f.subclass_name), ''), nullif(btrim(f.subclass_short_name), '')),
      f.source
  )
  select c.subclass_name, c.subclass_source, c.entry_level
    into v_subclass_name, v_subclass_source, v_entry_level
  from candidates c
  order by
    case when upper(c.subclass_source) = upper(coalesce(v_requested_source, c.subclass_source)) then 0 else 1 end,
    c.entry_level asc
  limit 1;

  if v_subclass_name is null then
    raise exception 'The selected subclass % is not available for the % class.', v_requested_name, v_class_key;
  end if;

  if new.class_level < v_entry_level then
    raise exception '% becomes available at class level %, but this character starts at level %.', v_subclass_name, v_entry_level, new.class_level;
  end if;

  new.subclass_name := v_subclass_name;
  new.subclass_source := v_subclass_source;
  new.level_choices := coalesce(new.level_choices, '{}'::jsonb) || jsonb_build_object(
    'startingSubclass', jsonb_build_object(
      'name', v_subclass_name,
      'source', v_subclass_source,
      'entryLevel', v_entry_level,
      'creator', coalesce(nullif(v_creator, ''), 'character_forge')
    )
  );

  return new;
end;
$$;

drop trigger if exists character_progression_apply_forge_subclass_v1 on public.character_progression;
create trigger character_progression_apply_forge_subclass_v1
before insert on public.character_progression
for each row execute function private.apply_character_forge_subclass_choice_v1();

revoke all on function private.apply_character_forge_subclass_choice_v1() from public;
