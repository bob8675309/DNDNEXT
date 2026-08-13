-- Source-aware validation for nested and prose-defined Player Forge class choices.
-- The existing deferred authority validator calls player_forge_choice_option_is_valid_v1;
-- this migration expands that function for spells, languages, skills, and dependent choices.

create or replace function private.player_forge_choice_option_is_valid_v1(
  p_class_id uuid,
  p_class_level integer,
  p_subclass_name text,
  p_group jsonb,
  p_selection jsonb
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_kind text := coalesce(p_group ->> 'kind', '');
  v_name text := coalesce(p_selection ->> 'name', '');
  v_source text := coalesce(p_selection ->> 'source', '');
  v_source_feature text := coalesce(p_group ->> 'sourceFeature', p_group ->> 'label', '');
  v_constraints jsonb := coalesce(p_group -> 'constraints', '{}'::jsonb);
  v_class_key text;
  v_class_source text;
  v_feature_exists boolean := false;
begin
  if btrim(v_name) = '' then return false; end if;

  select cc.class_key, cc.source into v_class_key, v_class_source
  from public.class_catalog cc where cc.id = p_class_id;
  if v_class_key is null then return false; end if;

  select exists (
    select 1
    from public.class_feature_catalog f
    where f.class_key = v_class_key
      and f.class_source = v_class_source
      and f.level <= p_class_level
      and private.normalize_player_choice_name_v1(f.name) = private.normalize_player_choice_name_v1(v_source_feature)
      and (
        f.feature_type = 'class'
        or (
          f.feature_type = 'subclass'
          and private.normalize_player_choice_name_v1(coalesce(f.subclass_name, f.subclass_short_name, ''))
              = private.normalize_player_choice_name_v1(coalesce(p_subclass_name, ''))
        )
      )
  ) into v_feature_exists;

  if v_kind = 'fighting-style' then
    return exists (
      select 1 from public.character_option_catalog_preferred o
      where o.option_type = 'feat' and o.category in ('FS', 'FS:P', 'FS:R')
        and private.normalize_player_choice_name_v1(o.name) = private.normalize_player_choice_name_v1(v_name)
        and (v_source = '' or o.source = v_source)
    );
  end if;

  if v_kind = 'expertise' then
    return exists (
      select 1 from public.character_option_catalog_preferred o
      where o.option_type = 'skill'
        and private.normalize_player_choice_name_v1(o.name) = private.normalize_player_choice_name_v1(v_name)
    );
  end if;

  if v_kind = 'skill-choice' then
    return v_feature_exists and exists (
      select 1 from public.character_option_catalog_preferred o
      where o.option_type = 'skill'
        and private.normalize_player_choice_name_v1(o.name) = private.normalize_player_choice_name_v1(v_name)
    ) and exists (
      select 1 from public.class_feature_catalog f
      where f.class_key = v_class_key and f.class_source = v_class_source and f.level <= p_class_level
        and private.normalize_player_choice_name_v1(f.name) = private.normalize_player_choice_name_v1(v_source_feature)
        and position(private.normalize_player_choice_name_v1(v_name) in private.normalize_player_choice_name_v1(coalesce(f.description, '') || ' ' || coalesce(f.entries::text, ''))) > 0
    );
  end if;

  if v_kind in ('weapon-mastery', 'kensei-weapon') then
    return exists (
      select 1 from public.items_catalog i
      where private.normalize_player_choice_name_v1(i.item_name) = private.normalize_player_choice_name_v1(v_name)
        and coalesce(i.item_rarity, '') = 'mundane'
        and coalesce(i.payload ->> 'source', 'XPHB') = coalesce(nullif(v_source, ''), coalesce(i.payload ->> 'source', 'XPHB'))
    );
  end if;

  if v_kind = 'language' then
    return private.normalize_player_choice_name_v1(v_name) = any(array[
      'commonsignlanguage','draconic','dwarvish','elvish','giant','gnomish','goblin','halfling','orc',
      'abyssal','celestial','deepspeech','druidic','infernal','primordial','sylvan','thievescant','undercommon'
    ]) and v_feature_exists;
  end if;

  if v_kind = 'spell' then
    if not (v_feature_exists or p_group ? 'activeWhen') then return false; end if;
    return exists (
      select 1
      from public.spells_catalog s
      where private.normalize_player_choice_name_v1(s.name) = private.normalize_player_choice_name_v1(v_name)
        and (v_source = '' or s.source = v_source)
        and (
          not (v_constraints ? 'spellLevel')
          or s.level = (v_constraints ->> 'spellLevel')::integer
        )
        and (
          not (v_constraints ? 'maxSpellLevel')
          or s.level <= (v_constraints ->> 'maxSpellLevel')::integer
        )
        and (
          not (v_constraints ? 'ritual')
          or s.ritual = (v_constraints ->> 'ritual')::boolean
        )
        and (
          coalesce((v_constraints ->> 'damageOnly')::boolean, false) = false
          or coalesce(array_length(s.damage_types, 1), 0) > 0
          or coalesce(s.damage_dice, '') <> ''
        )
        and (
          not (v_constraints ? 'spellClasses')
          or exists (
            select 1 from jsonb_array_elements_text(v_constraints -> 'spellClasses') wanted
            where exists (select 1 from unnest(coalesce(s.classes, array[]::text[])) listed where lower(listed) = lower(wanted))
          )
        )
        and (
          not (v_constraints ? 'schools')
          or exists (
            select 1 from jsonb_array_elements_text(v_constraints -> 'schools') wanted
            where private.normalize_player_choice_name_v1(wanted) = private.normalize_player_choice_name_v1(coalesce(s.school, s.school_code, ''))
          )
        )
        and (
          not (v_constraints ? 'castingTimeIncludes')
          or (
            private.normalize_player_choice_name_v1(v_constraints ->> 'castingTimeIncludes') = 'action'
            and lower(btrim(coalesce(s.casting_time, ''))) in ('action', '1 action')
          )
          or lower(coalesce(s.casting_time, '')) like '%' || lower(v_constraints ->> 'castingTimeIncludes') || '%'
        )
        and (
          private.normalize_player_choice_name_v1(v_source_feature) not in ('agonizingblast','eldritchspear','repellingblast')
          or (s.level = 0 and exists (select 1 from unnest(coalesce(s.classes, array[]::text[])) listed where lower(listed) = 'warlock')
              and (coalesce(array_length(s.damage_types, 1), 0) > 0 or coalesce(s.damage_dice, '') <> ''))
        )
        and (
          private.normalize_player_choice_name_v1(v_source_feature) <> 'pactofthetome'
          or (s.level = 0 or (s.level = 1 and s.ritual))
        )
        and (
          private.normalize_player_choice_name_v1(v_source_feature) <> 'mysticarcanum'
          or exists (select 1 from unnest(coalesce(s.classes, array[]::text[])) listed where lower(listed) = 'warlock')
        )
    );
  end if;

  if coalesce(p_selection ->> 'kind', '') = 'feat' or v_kind = 'feat' then
    return exists (
      select 1 from public.character_option_catalog_preferred o
      where o.option_type = 'feat'
        and private.normalize_player_choice_name_v1(o.name) = private.normalize_player_choice_name_v1(v_name)
        and (v_source = '' or o.source = v_source)
        and (
          private.normalize_player_choice_name_v1(v_source_feature) <> 'lessonsofthefirstones'
          or o.category = 'O'
        )
    );
  end if;

  return v_feature_exists and exists (
    select 1
    from public.class_feature_catalog f
    where f.class_key = v_class_key and f.class_source = v_class_source and f.level <= p_class_level
      and private.normalize_player_choice_name_v1(f.name) = private.normalize_player_choice_name_v1(v_source_feature)
      and (
        f.feature_type = 'class'
        or (
          f.feature_type = 'subclass'
          and private.normalize_player_choice_name_v1(coalesce(f.subclass_name, f.subclass_short_name, ''))
              = private.normalize_player_choice_name_v1(coalesce(p_subclass_name, ''))
        )
      )
      and position(
        private.normalize_player_choice_name_v1(v_name)
        in private.normalize_player_choice_name_v1(coalesce(f.description, '') || ' ' || coalesce(f.entries::text, '') || ' ' || coalesce(f.raw_payload::text, ''))
      ) > 0
  );
end;
$$;

revoke all on function private.player_forge_choice_option_is_valid_v1(uuid, integer, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function private.player_forge_choice_option_is_valid_v1(uuid, integer, text, jsonb, jsonb)
  to service_role;

create or replace function private.validate_player_forge_nested_choice_payload_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_sheet jsonb;
  v_choices jsonb;
  v_group_key text;
  v_group jsonb;
  v_required_name text;
  v_expected_children integer;
  v_completed_children integer;
begin
  select cs.sheet into v_sheet from public.character_sheets cs where cs.character_id = new.character_id;
  if coalesce(v_sheet #>> '{meta,creator}', '') <> 'shared_character_forge_player_v2' then return new; end if;
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

  for v_required_name in select unnest(array['Agonizing Blast','Eldritch Spear','Repelling Blast','Lessons of the First Ones','Pact of the Tome'])
  loop
    if exists (
      select 1 from jsonb_each(v_choices) parent_group
      cross join lateral jsonb_array_elements(coalesce(parent_group.value -> 'selections', '[]'::jsonb)) chosen
      where private.normalize_player_choice_name_v1(chosen ->> 'name') = private.normalize_player_choice_name_v1(v_required_name)
    ) then
      v_expected_children := case when private.normalize_player_choice_name_v1(v_required_name) = 'pactofthetome' then 2 else 1 end;
      select count(*) into v_completed_children
      from jsonb_each(v_choices) child_group
      where exists (
        select 1 from jsonb_array_elements_text(coalesce(child_group.value #> '{activeWhen,optionNames}', '[]'::jsonb)) required
        where private.normalize_player_choice_name_v1(required) = private.normalize_player_choice_name_v1(v_required_name)
      )
      and jsonb_array_length(coalesce(child_group.value -> 'selections', '[]'::jsonb)) = (child_group.value ->> 'count')::integer;

      if v_completed_children < v_expected_children then
        raise exception 'Class choice % requires % dependent selection group(s) to be complete.', v_required_name, v_expected_children;
      end if;
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function private.validate_player_forge_nested_choice_payload_v1() from public, anon, authenticated;
grant execute on function private.validate_player_forge_nested_choice_payload_v1() to service_role;

drop trigger if exists character_progression_validate_player_forge_nested_choices_v1 on public.character_progression;
create constraint trigger character_progression_validate_player_forge_nested_choices_v1
after insert or update of class_id, class_level, subclass_name, subclass_source, level_choices
on public.character_progression
deferrable initially deferred
for each row execute function private.validate_player_forge_nested_choice_payload_v1();
