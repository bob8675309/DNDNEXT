-- Extend the existing deferred Forge authority validator so every validated
-- feat grant instance (including higher-level and repeatable feats) participates
-- in the exact sheet-feat contract instead of being rejected as an unknown feat.

create or replace function private.validate_player_forge_authority_payload_v1()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_sheet jsonb;
  v_creator text;
  v_legacy boolean := false;
  v_species_key text;
  v_group_key text;
  v_group jsonb;
  v_selection jsonb;
  v_group_count integer;
  v_flat_choices jsonb := '[]'::jsonb;
  v_allowed_feats text[] := array[]::text[];
  v_sheet_feat_count integer := 0;
  v_invalid_feat_count integer := 0;
  v_missing_feat_count integer := 0;
  v_sheet_spell_count integer := 0;
  v_actual_spell_count integer := 0;
  v_invalid_sheet_spell_count integer := 0;
  v_missing_sheet_spell_count integer := 0;
begin
  select cs.sheet into v_sheet
  from public.character_sheets cs
  where cs.character_id = new.character_id;

  v_creator := coalesce(v_sheet #>> '{meta,creator}', '');
  if v_creator <> 'shared_character_forge_player_v2' then
    return new;
  end if;

  select exists (
    select 1 from private.player_forge_source_choice_legacy_v1 legacy
    where legacy.character_id = new.character_id
  ) into v_legacy;

  if v_sheet ? 'feats' and jsonb_typeof(v_sheet -> 'feats') <> 'array' then
    raise exception 'Player Forge feats must be stored as an array.';
  end if;
  if v_sheet ? 'spells' and jsonb_typeof(v_sheet -> 'spells') <> 'array' then
    raise exception 'Player Forge spells must be stored as an array.';
  end if;

  if not v_legacy then
    if jsonb_typeof(coalesce(v_sheet -> 'speciesTraitChoices', '{}'::jsonb)) <> 'object'
       or jsonb_typeof(coalesce(v_sheet -> 'speciesSkillChoices', '[]'::jsonb)) <> 'array'
       or jsonb_typeof(coalesce(v_sheet -> 'speciesChoiceFeats', '[]'::jsonb)) <> 'array'
       or jsonb_typeof(coalesce(v_sheet -> 'classFeatureChoices', '{}'::jsonb)) <> 'object'
       or jsonb_typeof(coalesce(v_sheet -> 'classFeatureChoiceSummary', '[]'::jsonb)) <> 'array'
       or jsonb_typeof(coalesce(v_sheet -> 'classChoiceFeats', '[]'::jsonb)) <> 'array'
       or jsonb_typeof(coalesce(v_sheet -> 'sourceChoices', '{}'::jsonb)) <> 'object'
       or jsonb_typeof(coalesce(v_sheet -> 'sourceChoiceSummary', '[]'::jsonb)) <> 'array'
       or jsonb_typeof(coalesce(v_sheet -> 'featGrantInstances', '[]'::jsonb)) <> 'array' then
      raise exception 'Player Forge source choices must use their canonical object and array shapes.';
    end if;

    perform private.validate_player_forge_feat_instances_v1(v_sheet);

    v_species_key := private.normalize_player_choice_name_v1(
      coalesce(v_sheet #>> '{meta,speciesKey}', v_sheet ->> 'species', v_sheet ->> 'race', '')
    );

    if v_species_key = 'human' then
      if coalesce(v_sheet #>> '{speciesTraitChoices,skillful,skill}', '') = '' then
        raise exception 'Human Skillful requires one selected skill proficiency.';
      end if;
      if not exists (
        select 1 from public.character_option_catalog_preferred o
        where o.option_type = 'skill'
          and private.normalize_player_choice_name_v1(o.option_key) = private.normalize_player_choice_name_v1(v_sheet #>> '{speciesTraitChoices,skillful,skill}')
      ) then
        raise exception 'Human Skillful contains an invalid skill selection.';
      end if;
      if coalesce(v_sheet #>> '{speciesTraitChoices,versatile,feat}', '') = '' then
        raise exception 'Human Versatile requires one selected Origin feat.';
      end if;
      if not exists (
        select 1 from public.character_option_catalog_preferred o
        where o.option_type = 'feat' and o.category = 'O'
          and private.normalize_player_choice_name_v1(o.name) = private.normalize_player_choice_name_v1(v_sheet #>> '{speciesTraitChoices,versatile,feat}')
      ) then
        raise exception 'Human Versatile contains an invalid Origin feat selection.';
      end if;
      if not exists (
        select 1 from jsonb_array_elements(coalesce(v_sheet -> 'speciesSkillChoices', '[]'::jsonb)) choice
        where private.normalize_player_choice_name_v1(choice ->> 'value') = private.normalize_player_choice_name_v1(v_sheet #>> '{speciesTraitChoices,skillful,skill}')
      ) then
        raise exception 'Human Skillful summary does not match the selected skill.';
      end if;
      if not exists (
        select 1 from jsonb_array_elements(coalesce(v_sheet -> 'speciesChoiceFeats', '[]'::jsonb)) choice
        where private.normalize_player_choice_name_v1(coalesce(choice ->> 'label', choice ->> 'name')) = private.normalize_player_choice_name_v1(v_sheet #>> '{speciesTraitChoices,versatile,feat}')
      ) then
        raise exception 'Human Versatile feat summary does not match the selected Origin feat.';
      end if;
    end if;

    for v_group_key, v_group in
      select key, value from jsonb_each(coalesce(v_sheet -> 'classFeatureChoices', '{}'::jsonb))
    loop
      if jsonb_typeof(v_group) <> 'object' or jsonb_typeof(coalesce(v_group -> 'selections', '[]'::jsonb)) <> 'array' then
        raise exception 'Each class feature choice group must be an object with a selections array.';
      end if;
      begin
        v_group_count := (v_group ->> 'count')::integer;
      exception when others then
        raise exception 'Each class feature choice group must have an integer count.';
      end;
      if v_group_count < 1
         or coalesce((v_group ->> 'level')::integer, 1) > new.class_level
         or jsonb_array_length(v_group -> 'selections') <> v_group_count then
        raise exception 'Class feature choice group % is incomplete or not available at this level.', v_group_key;
      end if;
      if (
        select count(distinct private.normalize_player_choice_name_v1(choice ->> 'name'))
        from jsonb_array_elements(v_group -> 'selections') choice
      ) <> v_group_count then
        raise exception 'Class feature choice group % contains empty or duplicate selections.', v_group_key;
      end if;
      for v_selection in select value from jsonb_array_elements(v_group -> 'selections')
      loop
        if not private.player_forge_choice_option_is_valid_v1(new.class_id,new.class_level,new.subclass_name,v_group,v_selection) then
          raise exception 'Class feature choice % in group % is not valid for this class, subclass, source, or level.', coalesce(v_selection ->> 'name', 'unknown'), v_group_key;
        end if;
        v_flat_choices := v_flat_choices || jsonb_build_array(jsonb_build_object(
          'groupId',v_group_key,'groupLabel',coalesce(v_group ->> 'label',''),'groupKind',coalesce(v_group ->> 'kind',''),
          'level',coalesce((v_group ->> 'level')::integer,1),'key',coalesce(v_selection ->> 'key',''),
          'name',coalesce(v_selection ->> 'name',''),'source',coalesce(v_selection ->> 'source',''),'kind',coalesce(v_selection ->> 'kind','')
        ));
      end loop;
    end loop;

    if jsonb_array_length(v_flat_choices) <> jsonb_array_length(coalesce(v_sheet -> 'classFeatureChoiceSummary', '[]'::jsonb))
       or exists (
         select 1 from jsonb_array_elements(v_flat_choices) expected
         where not exists (
           select 1 from jsonb_array_elements(coalesce(v_sheet -> 'classFeatureChoiceSummary', '[]'::jsonb)) actual
           where actual ->> 'groupId' = expected ->> 'groupId'
             and actual ->> 'key' = expected ->> 'key'
             and private.normalize_player_choice_name_v1(actual ->> 'name') = private.normalize_player_choice_name_v1(expected ->> 'name')
             and coalesce(actual ->> 'source','') = coalesce(expected ->> 'source','')
         )
       ) then
      raise exception 'Class feature choice summary must exactly match the validated group selections.';
    end if;
  end if;

  select coalesce(array_agg(distinct feat_name) filter (where feat_name <> ''), array[]::text[])
  into v_allowed_feats
  from (
    select private.normalize_player_choice_name_v1(value) as feat_name
    from unnest(array[
      coalesce(v_sheet #>> '{meta,originFeat}', ''),
      coalesce(v_sheet #>> '{meta,backgroundFeatChoice}', ''),
      coalesce(v_sheet #>> '{meta,speciesBonusFeat}', '')
    ]) value
    union
    select private.normalize_player_choice_name_v1(coalesce(choice ->> 'label', choice ->> 'name'))
    from jsonb_array_elements(coalesce(v_sheet -> 'speciesChoiceFeats', '[]'::jsonb)) choice
    union
    select private.normalize_player_choice_name_v1(choice ->> 'name')
    from jsonb_array_elements(coalesce(v_sheet -> 'classChoiceFeats', '[]'::jsonb)) choice
    union
    select private.normalize_player_choice_name_v1(instance ->> 'name')
    from jsonb_array_elements(coalesce(v_sheet -> 'featGrantInstances', '[]'::jsonb)) instance
  ) allowed;

  select count(*), count(*) filter (where private.normalize_player_choice_name_v1(value) <> all(v_allowed_feats))
  into v_sheet_feat_count, v_invalid_feat_count
  from jsonb_array_elements_text(coalesce(v_sheet -> 'feats', '[]'::jsonb)) value;

  select count(*) into v_missing_feat_count
  from unnest(v_allowed_feats) allowed
  where not exists (
    select 1 from jsonb_array_elements_text(coalesce(v_sheet -> 'feats', '[]'::jsonb)) value
    where private.normalize_player_choice_name_v1(value) = allowed
  );

  if v_invalid_feat_count > 0 or v_missing_feat_count > 0 or v_sheet_feat_count <> cardinality(v_allowed_feats) then
    raise exception 'Player Forge feats must exactly match their validated source-owned feat grants.';
  end if;

  select count(*) into v_sheet_spell_count
  from (
    select distinct lower(btrim(value)) as spell_name
    from jsonb_array_elements_text(coalesce(v_sheet -> 'spells', '[]'::jsonb)) value
    where btrim(value) <> ''
  ) names;

  select count(*) into v_actual_spell_count
  from public.character_spells cs
  where cs.character_id = new.character_id and cs.source_type = 'class';

  select count(*) into v_invalid_sheet_spell_count
  from (
    select distinct lower(btrim(value)) as spell_name
    from jsonb_array_elements_text(coalesce(v_sheet -> 'spells', '[]'::jsonb)) value
    where btrim(value) <> ''
  ) listed
  where not exists (
    select 1 from public.character_spells cs
    join public.spells_catalog s on s.id = cs.spell_id
    where cs.character_id = new.character_id and cs.source_type = 'class' and lower(s.name) = listed.spell_name
  );

  select count(*) into v_missing_sheet_spell_count
  from public.character_spells cs
  join public.spells_catalog s on s.id = cs.spell_id
  where cs.character_id = new.character_id and cs.source_type = 'class'
    and not exists (
      select 1 from jsonb_array_elements_text(coalesce(v_sheet -> 'spells', '[]'::jsonb)) value
      where lower(btrim(value)) = lower(s.name)
    );

  if v_sheet_spell_count <> v_actual_spell_count or v_invalid_sheet_spell_count > 0 or v_missing_sheet_spell_count > 0 then
    raise exception 'The player sheet spell summary must exactly match its validated starting spell assignments.';
  end if;

  return new;
end;
$function$;
