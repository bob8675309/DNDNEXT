-- Source-original DnDWeb read-only pg_get_functiondef, 2026-11-06, md5 df2861cc76b0b74bb7cd57fbe61c9a05
-- EXECUTE ONLY on disposable Supabase local PG17, never live or staging.
CREATE OR REPLACE FUNCTION private.validate_player_forge_nested_choice_payload_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_sheet jsonb;
  v_choices jsonb;
  v_group_key text;
  v_group jsonb;
  v_required_name text;
  v_completed_children integer;
begin
  select cs.sheet into v_sheet
  from public.character_sheets cs
  where cs.character_id = new.character_id;

  if coalesce(v_sheet #>> '{meta,creator}', '') <> 'shared_character_forge_player_v2' then
    return new;
  end if;

  v_choices := coalesce(v_sheet -> 'classFeatureChoices', '{}'::jsonb);

  for v_group_key, v_group in select key, value from jsonb_each(v_choices)
  loop
    if v_group ? 'activeWhen' and jsonb_typeof(v_group -> 'activeWhen') = 'object' then
      if not exists (
        select 1
        from jsonb_array_elements_text(coalesce(v_group #> '{activeWhen,optionNames}', '[]'::jsonb)) required
        where exists (
          select 1
          from jsonb_each(v_choices) parent_group
          cross join lateral jsonb_array_elements(coalesce(parent_group.value -> 'selections', '[]'::jsonb)) chosen
          where private.normalize_player_choice_name_v1(chosen ->> 'name') = private.normalize_player_choice_name_v1(required)
        )
      ) then
        raise exception 'Dependent class choice group % is active without its required parent option.', v_group_key;
      end if;
    end if;
  end loop;

  for v_required_name in
    select unnest(array['Agonizing Blast','Eldritch Spear','Repelling Blast','Lessons of the First Ones'])
  loop
    if exists (
      select 1
      from jsonb_each(v_choices) parent_group
      cross join lateral jsonb_array_elements(coalesce(parent_group.value -> 'selections', '[]'::jsonb)) chosen
      where private.normalize_player_choice_name_v1(chosen ->> 'name') = private.normalize_player_choice_name_v1(v_required_name)
    ) then
      select count(*) into v_completed_children
      from jsonb_each(v_choices) child_group
      where exists (
        select 1
        from jsonb_array_elements_text(coalesce(child_group.value #> '{activeWhen,optionNames}', '[]'::jsonb)) required
        where private.normalize_player_choice_name_v1(required) = private.normalize_player_choice_name_v1(v_required_name)
      )
      and jsonb_array_length(coalesce(child_group.value -> 'selections', '[]'::jsonb)) = (child_group.value ->> 'count')::integer;

      if v_completed_children < 1 then
        raise exception 'Class choice % requires its dependent selection group to be complete.', v_required_name;
      end if;
    end if;
  end loop;

  return new;
end;
$function$;
