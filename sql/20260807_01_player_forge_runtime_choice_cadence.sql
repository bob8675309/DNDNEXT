-- Character Forge cadence correction.
-- Pact of the Tome's Book of Shadows spell selections are chosen when the
-- book is conjured after a Short or Long Rest, so they are runtime state,
-- not permanent character-creation children. Other invocation follow-ups
-- remain persistent and continue to be required by the deferred validator.

create or replace function private.validate_player_forge_nested_choice_payload_v1()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
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

  -- These invocation selections create persistent dependent character state.
  -- Pact of the Tome is deliberately excluded: its cantrips and rituals are
  -- selected again whenever the Book of Shadows is conjured after a rest.
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
