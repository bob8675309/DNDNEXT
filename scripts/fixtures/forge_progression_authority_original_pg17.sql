-- Original production function bodies copied read-only from DnDWeb Postgres 17.4 on 2026-11-05.
-- NEVER load onto production; held PR #324 disposable local GoTrue test only.
-- No source substitutions, stubs, omissions or rewritten validations in these functions.
-- PG17 md5(pg_get_functiondef) private.normalize_player_choice_name_v1(p_value text) = dd8cdd5b47efe99b1cfff9c2bf7635dd
CREATE OR REPLACE FUNCTION private.normalize_player_choice_name_v1(p_value text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
AS $function$
  select regexp_replace(
    lower(
      case
        when coalesce(btrim(p_value), '') ~ '^[^|[:space:]{}\[\]":,]+\|[^|[:space:]{}\[\]":,]+(?:\|.*)?$'
          then split_part(btrim(p_value), '|', 1)
        else coalesce(btrim(p_value), '')
      end
    ),
    '[^a-z0-9]+',
    '',
    'g'
  );
$function$;

-- PG17 md5(pg_get_functiondef) private.player_forge_choice_option_is_valid_v1(p_class_id uuid, p_class_level integer, p_subclass_name text, p_group jsonb, p_selection jsonb) = 586637a9e0e55e19ee335c3efd6ea2b9
CREATE OR REPLACE FUNCTION private.player_forge_choice_option_is_valid_v1(p_class_id uuid, p_class_level integer, p_subclass_name text, p_group jsonb, p_selection jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
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
$function$;

-- PG17 md5(pg_get_functiondef) private.validate_player_forge_authority_payload_v1() = 48006f8db76e9b32c96fcd2b6a4b3080
CREATE OR REPLACE FUNCTION private.validate_player_forge_authority_payload_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_sheet jsonb; v_creator text; v_legacy boolean := false; v_species_key text; v_group_key text; v_group jsonb; v_selection jsonb; v_group_count integer; v_flat_choices jsonb := '[]'::jsonb; v_allowed_feats text[] := array[]::text[]; v_sheet_feat_count integer := 0; v_invalid_feat_count integer := 0; v_missing_feat_count integer := 0; v_sheet_spell_count integer := 0; v_actual_spell_count integer := 0; v_invalid_sheet_spell_count integer := 0; v_missing_sheet_spell_count integer := 0;
begin
  select cs.sheet into v_sheet from public.character_sheets cs where cs.character_id = new.character_id;
  v_creator := coalesce(v_sheet #>> '{meta,creator}', ''); if v_creator <> 'shared_character_forge_player_v2' then return new; end if;
  select exists (select 1 from private.player_forge_source_choice_legacy_v1 legacy where legacy.character_id = new.character_id) into v_legacy;
  if v_sheet ? 'feats' and jsonb_typeof(v_sheet -> 'feats') <> 'array' then raise exception 'Player Forge feats must be stored as an array.'; end if;
  if v_sheet ? 'spells' and jsonb_typeof(v_sheet -> 'spells') <> 'array' then raise exception 'Player Forge spells must be stored as an array.'; end if;
  if not v_legacy then
    if jsonb_typeof(coalesce(v_sheet -> 'speciesTraitChoices','{}'::jsonb)) <> 'object' or jsonb_typeof(coalesce(v_sheet -> 'speciesSkillChoices','[]'::jsonb)) <> 'array' or jsonb_typeof(coalesce(v_sheet -> 'speciesChoiceFeats','[]'::jsonb)) <> 'array' or jsonb_typeof(coalesce(v_sheet -> 'classFeatureChoices','{}'::jsonb)) <> 'object' or jsonb_typeof(coalesce(v_sheet -> 'classFeatureChoiceSummary','[]'::jsonb)) <> 'array' or jsonb_typeof(coalesce(v_sheet -> 'classChoiceFeats','[]'::jsonb)) <> 'array' or jsonb_typeof(coalesce(v_sheet -> 'sourceChoices','{}'::jsonb)) <> 'object' or jsonb_typeof(coalesce(v_sheet -> 'sourceChoiceSummary','[]'::jsonb)) <> 'array' or jsonb_typeof(coalesce(v_sheet -> 'featGrantInstances','[]'::jsonb)) <> 'array' then raise exception 'Player Forge source choices must use their canonical object and array shapes.'; end if;
    perform private.validate_player_forge_feat_instances_v1(v_sheet);
    v_species_key := private.normalize_player_choice_name_v1(coalesce(v_sheet #>> '{meta,speciesKey}', v_sheet ->> 'species', v_sheet ->> 'race', ''));
    if v_species_key = 'human' then
      if coalesce(v_sheet #>> '{speciesTraitChoices,skillful,skill}', '') = '' then raise exception 'Human Skillful requires one selected skill proficiency.'; end if;
      if not exists (select 1 from public.character_option_catalog_preferred o where o.option_type='skill' and private.normalize_player_choice_name_v1(o.option_key)=private.normalize_player_choice_name_v1(v_sheet #>> '{speciesTraitChoices,skillful,skill}')) then raise exception 'Human Skillful contains an invalid skill selection.'; end if;
      if coalesce(v_sheet #>> '{speciesTraitChoices,versatile,feat}', '') = '' then raise exception 'Human Versatile requires one selected Origin feat.'; end if;
      if not exists (select 1 from public.character_option_catalog_preferred o where o.option_type='feat' and o.category='O' and private.normalize_player_choice_name_v1(o.name)=private.normalize_player_choice_name_v1(v_sheet #>> '{speciesTraitChoices,versatile,feat}')) then raise exception 'Human Versatile contains an invalid Origin feat selection.'; end if;
      if not exists (select 1 from jsonb_array_elements(coalesce(v_sheet -> 'speciesSkillChoices','[]'::jsonb)) choice where private.normalize_player_choice_name_v1(choice ->> 'value')=private.normalize_player_choice_name_v1(v_sheet #>> '{speciesTraitChoices,skillful,skill}')) then raise exception 'Human Skillful summary does not match the selected skill.'; end if;
      if not exists (select 1 from jsonb_array_elements(coalesce(v_sheet -> 'speciesChoiceFeats','[]'::jsonb)) choice where private.normalize_player_choice_name_v1(coalesce(choice ->> 'label',choice ->> 'name'))=private.normalize_player_choice_name_v1(v_sheet #>> '{speciesTraitChoices,versatile,feat}')) then raise exception 'Human Versatile feat summary does not match the selected Origin feat.'; end if;
    end if;
    for v_group_key,v_group in select key,value from jsonb_each(coalesce(v_sheet -> 'classFeatureChoices','{}'::jsonb)) loop
      if jsonb_typeof(v_group)<>'object' or jsonb_typeof(coalesce(v_group -> 'selections','[]'::jsonb))<>'array' then raise exception 'Each class feature choice group must be an object with a selections array.'; end if;
      begin v_group_count := (v_group ->> 'count')::integer; exception when others then raise exception 'Each class feature choice group must have an integer count.'; end;
      if v_group_count < 1 or coalesce((v_group ->> 'level')::integer,1)>new.class_level or jsonb_array_length(v_group -> 'selections')<>v_group_count then raise exception 'Class feature choice group % is incomplete or not available at this level.',v_group_key; end if;
      if (select count(distinct private.normalize_player_choice_name_v1(choice ->> 'name')) from jsonb_array_elements(v_group -> 'selections') choice) <> v_group_count then raise exception 'Class feature choice group % contains empty or duplicate selections.',v_group_key; end if;
      for v_selection in select value from jsonb_array_elements(v_group -> 'selections') loop
        if not private.player_forge_choice_option_is_valid_v1(new.class_id,new.class_level,new.subclass_name,v_group,v_selection) then raise exception 'Class feature choice % in group % is not valid for this class, subclass, source, or level.',coalesce(v_selection ->> 'name','unknown'),v_group_key; end if;
        v_flat_choices := v_flat_choices || jsonb_build_array(jsonb_build_object('groupId',v_group_key,'groupLabel',coalesce(v_group ->> 'label',''),'groupKind',coalesce(v_group ->> 'kind',''),'level',coalesce((v_group ->> 'level')::integer,1),'key',coalesce(v_selection ->> 'key',''),'name',coalesce(v_selection ->> 'name',''),'source',coalesce(v_selection ->> 'source',''),'kind',coalesce(v_selection ->> 'kind','')));
      end loop;
    end loop;
    if jsonb_array_length(v_flat_choices) <> jsonb_array_length(coalesce(v_sheet -> 'classFeatureChoiceSummary','[]'::jsonb)) or exists (select 1 from jsonb_array_elements(v_flat_choices) expected where not exists (select 1 from jsonb_array_elements(coalesce(v_sheet -> 'classFeatureChoiceSummary','[]'::jsonb)) actual where actual ->> 'groupId'=expected ->> 'groupId' and actual ->> 'key'=expected ->> 'key' and private.normalize_player_choice_name_v1(actual ->> 'name')=private.normalize_player_choice_name_v1(expected ->> 'name') and coalesce(actual ->> 'source','')=coalesce(expected ->> 'source',''))) then raise exception 'Class feature choice summary must exactly match the validated group selections.'; end if;
  end if;
  select coalesce(array_agg(distinct feat_name) filter (where feat_name <> ''),array[]::text[]) into v_allowed_feats from (
    select private.normalize_player_choice_name_v1(value) feat_name from unnest(array[coalesce(v_sheet #>> '{meta,originFeat}',''),coalesce(v_sheet #>> '{meta,backgroundFeatChoice}',''),coalesce(v_sheet #>> '{meta,speciesBonusFeat}','')]) value
    union select private.normalize_player_choice_name_v1(coalesce(choice ->> 'label',choice ->> 'name')) from jsonb_array_elements(coalesce(v_sheet -> 'speciesChoiceFeats','[]'::jsonb)) choice
    union select private.normalize_player_choice_name_v1(choice ->> 'name') from jsonb_array_elements(coalesce(v_sheet -> 'classChoiceFeats','[]'::jsonb)) choice
    union select private.normalize_player_choice_name_v1(instance ->> 'name') from jsonb_array_elements(coalesce(v_sheet -> 'featGrantInstances','[]'::jsonb)) instance
  ) allowed;
  select count(*),count(*) filter (where private.normalize_player_choice_name_v1(value) <> all(v_allowed_feats)) into v_sheet_feat_count,v_invalid_feat_count from jsonb_array_elements_text(coalesce(v_sheet -> 'feats','[]'::jsonb)) value;
  select count(*) into v_missing_feat_count from unnest(v_allowed_feats) allowed where not exists (select 1 from jsonb_array_elements_text(coalesce(v_sheet -> 'feats','[]'::jsonb)) value where private.normalize_player_choice_name_v1(value)=allowed);
  if v_invalid_feat_count>0 or v_missing_feat_count>0 or v_sheet_feat_count<>cardinality(v_allowed_feats) then raise exception 'Player Forge feats must exactly match their validated source-owned feat grants.'; end if;
  select count(*) into v_sheet_spell_count from (select distinct lower(btrim(value)) spell_name from jsonb_array_elements_text(coalesce(v_sheet -> 'spells','[]'::jsonb)) value where btrim(value)<>'') names;
  select count(*) into v_actual_spell_count from public.character_spells cs where cs.character_id=new.character_id and cs.source_type='class';
  select count(*) into v_invalid_sheet_spell_count from (select distinct lower(btrim(value)) spell_name from jsonb_array_elements_text(coalesce(v_sheet -> 'spells','[]'::jsonb)) value where btrim(value)<>'') listed where not exists (select 1 from public.character_spells cs join public.spells_catalog s on s.id=cs.spell_id where cs.character_id=new.character_id and cs.source_type='class' and lower(s.name)=listed.spell_name);
  select count(*) into v_missing_sheet_spell_count from public.character_spells cs join public.spells_catalog s on s.id=cs.spell_id where cs.character_id=new.character_id and cs.source_type='class' and not exists (select 1 from jsonb_array_elements_text(coalesce(v_sheet -> 'spells','[]'::jsonb)) value where lower(btrim(value))=lower(s.name));
  if v_sheet_spell_count<>v_actual_spell_count or v_invalid_sheet_spell_count>0 or v_missing_sheet_spell_count>0 then raise exception 'The player sheet spell summary must exactly match its validated starting spell assignments.'; end if;
  return new;
end;
$function$;

-- PG17 md5(pg_get_functiondef) private.validate_player_forge_feat_instances_v1(p_sheet jsonb) = 409802af8c5255171ff41bb4a0da694f
CREATE OR REPLACE FUNCTION private.validate_player_forge_feat_instances_v1(p_sheet jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_instances jsonb := coalesce(p_sheet -> 'featGrantInstances', '[]'::jsonb);
  v_instance jsonb;
  v_instance_key text;
  v_option_id uuid;
  v_catalog public.character_option_catalog%rowtype;
  v_level integer := greatest(1, least(20, coalesce(nullif(p_sheet ->> 'level', '')::integer, 1)));
  v_seen_keys text[] := '{}'::text[];
  v_seen_nonrepeatable uuid[] := '{}'::uuid[];
begin
  if jsonb_typeof(v_instances) <> 'array' then raise exception 'featGrantInstances must be a JSON array.'; end if;
  if jsonb_array_length(v_instances) > 100 then raise exception 'Too many feat or boon grant instances.'; end if;
  for v_instance in select value from jsonb_array_elements(v_instances) loop
    if jsonb_typeof(v_instance) <> 'object' then raise exception 'Each feat or boon grant instance must be an object.'; end if;
    v_instance_key := nullif(btrim(v_instance ->> 'instanceId'), '');
    if v_instance_key is null then raise exception 'Every feat or boon grant instance requires an instanceId.'; end if;
    if v_instance_key = any(v_seen_keys) then raise exception 'Duplicate feat or boon grant instance %.', v_instance_key; end if;
    v_seen_keys := array_append(v_seen_keys, v_instance_key);
    begin v_option_id := nullif(btrim(v_instance ->> 'optionId'), '')::uuid; exception when invalid_text_representation then raise exception 'Grant instance % has an invalid optionId.', v_instance_key; end;
    if v_option_id is null then raise exception 'Grant instance % must reference a canonical feat or boon option.', v_instance_key; end if;
    select * into v_catalog from public.character_option_catalog where id = v_option_id and option_type in ('feat','boon');
    if not found then raise exception 'Grant instance % references an unavailable feat or boon.', v_instance_key; end if;
    if private.normalize_player_choice_name_v1(v_instance ->> 'name') <> private.normalize_player_choice_name_v1(v_catalog.name) then raise exception 'Grant instance % does not match its canonical option name.', v_instance_key; end if;
    if nullif(btrim(v_instance ->> 'source'), '') is not null and upper(btrim(v_instance ->> 'source')) <> upper(v_catalog.source) then raise exception 'Grant instance % does not match its canonical option source.', v_instance_key; end if;
    if nullif(btrim(v_instance ->> 'optionType'), '') is not null and lower(btrim(v_instance ->> 'optionType')) <> lower(v_catalog.option_type) then raise exception 'Grant instance % does not match its canonical option type.', v_instance_key; end if;
    if coalesce((v_instance ->> 'acquisitionLevel')::integer, 1) < 1 or coalesce((v_instance ->> 'acquisitionLevel')::integer, 1) > v_level then raise exception 'Grant instance % has an invalid acquisition level.', v_instance_key; end if;
    if jsonb_typeof(coalesce(v_instance -> 'choices', '{}'::jsonb)) <> 'object' then raise exception 'Grant instance % choices must be an object.', v_instance_key; end if;
    if jsonb_typeof(coalesce(v_instance -> 'fixedEffects', '[]'::jsonb)) <> 'array' then raise exception 'Grant instance % effects must be an array.', v_instance_key; end if;
    if not coalesce((v_catalog.metadata ->> 'repeatable')::boolean, false) then
      if v_option_id = any(v_seen_nonrepeatable) then raise exception '% is not repeatable.', v_catalog.name; end if;
      v_seen_nonrepeatable := array_append(v_seen_nonrepeatable, v_option_id);
    end if;
  end loop;
end;
$function$;

-- PG17 md5(pg_get_functiondef) public.character_source_priority_v1(p_source text) = fdcc080cd95e6ce282631191869893c1
CREATE OR REPLACE FUNCTION public.character_source_priority_v1(p_source text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select case upper(coalesce(p_source,''))
    when 'XPHB' then 0
    when 'EFA' then 1
    when 'TCE' then 2
    when 'PHB' then 3
    else 10
  end;
$function$;
