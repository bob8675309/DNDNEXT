-- Progression v3: source-owned Sorcerer Metamagic additions and Warlock Mystic
-- Arcanum acquisitions. Optional replace-on-level-up semantics are deliberately
-- separate from these required acquisition deltas and can be layered on without
-- changing the permanent source identity established here.

create or replace function private.additional_level_class_choice_groups_v1(p_character_id uuid,p_to_level integer)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','private'
as $function$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_sheet jsonb := '{}'::jsonb;
  v_groups jsonb := '[]'::jsonb;
  v_options jsonb := '[]'::jsonb;
  v_existing text[] := '{}'::text[];
  v_name text;
  v_count integer := 0;
  v_spell_level integer := 0;
  v_to integer := greatest(1,least(20,coalesce(p_to_level,1)));
  v_metamagic constant text[] := array[
    'Careful Spell','Distant Spell','Empowered Spell','Extended Spell','Heightened Spell',
    'Quickened Spell','Seeking Spell','Subtle Spell','Transmuted Spell','Twinned Spell'
  ];
begin
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found then return v_groups; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found or upper(v_class.source)<>'XPHB' then return v_groups; end if;
  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id;

  if lower(v_class.class_key)='sorcerer' and v_to in (2,10,17) then
    v_count:=2;
    select coalesce(array_agg(lower(choice->>'name')),'{}'::text[])
    into v_existing
    from jsonb_each(coalesce(v_sheet->'classFeatureChoices','{}'::jsonb)) grp
    cross join lateral jsonb_array_elements(coalesce(grp.value->'selections','[]'::jsonb)) choice
    where lower(coalesce(grp.value->>'kind',''))='metamagic'
       or lower(coalesce(grp.value->>'sourceFeature',''))='metamagic';
    v_options:='[]'::jsonb;
    foreach v_name in array v_metamagic loop
      if lower(v_name)=any(v_existing) then continue; end if;
      v_options:=v_options||jsonb_build_array(jsonb_build_object(
        'key',lower(regexp_replace(v_name,'[^a-zA-Z0-9]+','-','g')),
        'value',v_name,'label',v_name,'source','XPHB','kind','metamagic'
      ));
    end loop;
    v_groups:=v_groups||jsonb_build_array(jsonb_build_object(
      'id','sorcerer-metamagic','label','Metamagic','kind','metamagic','sourceFeature','Metamagic','source','XPHB','level',2,'count',v_count,
      'helper','Choose the new Metamagic options gained at this Sorcerer level. Existing options are excluded.',
      'fields',jsonb_build_array(jsonb_build_object('id','selection','label','New Metamagic options','kind','metamagic','count',v_count,'required',true,'options',v_options))
    ));
  end if;

  if lower(v_class.class_key)='warlock' and v_to in (11,13,15,17) then
    v_spell_level:=case v_to when 11 then 6 when 13 then 7 when 15 then 8 else 9 end;
    select coalesce(jsonb_agg(jsonb_build_object(
      'key','spell-'||s.id::text,'value',s.id::text,'label',s.name,'source',s.source,'kind','spell',
      'metadata',jsonb_build_object('spellId',s.id,'spellKey',s.spell_key,'level',s.level,'school',s.school)
    ) order by s.name),'[]'::jsonb)
    into v_options
    from public.spells_catalog_preferred s
    where s.level=v_spell_level and 'Warlock'=any(coalesce(s.classes,'{}'::text[]));
    v_groups:=v_groups||jsonb_build_array(jsonb_build_object(
      'id','warlock-mystic-arcanum-'||v_spell_level::text,
      'label','Mystic Arcanum ('||v_spell_level::text||'th Level)',
      'kind','mystic-arcanum','sourceFeature','Mystic Arcanum','source','XPHB','level',v_to,'count',1,
      'helper','Choose the Warlock spell granted as this Mystic Arcanum. It is tracked independently from Pact Magic slots.',
      'fields',jsonb_build_array(jsonb_build_object('id','selection','label',v_spell_level::text||'th-level Warlock spell','kind','spell','count',1,'required',true,'options',v_options))
    ));
  end if;
  return v_groups;
end;
$function$;

create or replace function private.apply_additional_level_class_choices_v1(p_character_id uuid,p_to_level integer,p_selections jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth'
as $function$
declare
  v_groups jsonb:=private.additional_level_class_choice_groups_v1(p_character_id,p_to_level);
  v_sheet jsonb;
  v_group jsonb;
  v_field jsonb;
  v_selected jsonb;
  v_key text;
  v_option jsonb;
  v_count integer;
  v_class_choices jsonb;
  v_existing_group jsonb;
  v_existing_selections jsonb;
  v_serialized jsonb;
  v_summary jsonb:='[]'::jsonb;
  v_spell public.spells_catalog%rowtype;
  v_spell_id uuid;
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_source_key text;
begin
  if jsonb_typeof(coalesce(p_selections,'{}'::jsonb))<>'object' then raise exception 'Additional class choice selections must be an object.'; end if;
  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  select * into v_progression from public.character_progression where character_id=p_character_id;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  v_class_choices:=case when jsonb_typeof(v_sheet->'classFeatureChoices')='object' then v_sheet->'classFeatureChoices' else '{}'::jsonb end;

  if jsonb_array_length(v_groups)=0 then
    if exists(select 1 from jsonb_object_keys(coalesce(p_selections,'{}'::jsonb))) then raise exception 'This level has no additional class choice acquisitions.'; end if;
    return v_summary;
  end if;

  for v_group in select value from jsonb_array_elements(v_groups) loop
    v_field:=v_group->'fields'->0;
    v_selected:=coalesce(p_selections #> array[v_group->>'id',v_field->>'id'],'[]'::jsonb);
    if jsonb_typeof(v_selected)<>'array' then raise exception '% selections must be an array.',v_group->>'label'; end if;
    v_count:=coalesce((v_field->>'count')::integer,1);
    if jsonb_array_length(v_selected)<>v_count then raise exception '% requires exactly % new choice(s).',v_group->>'label',v_count; end if;
    if (select count(distinct value) from jsonb_array_elements_text(v_selected))<>v_count then raise exception '% selections must be distinct.',v_group->>'label'; end if;
    v_serialized:='[]'::jsonb;

    for v_key in select value from jsonb_array_elements_text(v_selected) loop
      select value into v_option from jsonb_array_elements(v_field->'options') where value->>'key'=v_key limit 1;
      if v_option is null then raise exception '% contains a choice that is not source-legal.',v_group->>'label'; end if;
      v_serialized:=v_serialized||jsonb_build_array(jsonb_build_object(
        'key',v_option->>'key','name',v_option->>'label','source',coalesce(v_option->>'source','XPHB'),'kind',coalesce(v_option->>'kind',v_group->>'kind')
      ));

      if v_group->>'kind'='mystic-arcanum' then
        begin v_spell_id:=(v_option #>> '{metadata,spellId}')::uuid; exception when others then raise exception 'Mystic Arcanum requires a canonical spell.'; end;
        select * into v_spell from public.spells_catalog_preferred where id=v_spell_id;
        if not found or v_spell.level<>(v_option #>> '{metadata,level}')::integer or not ('Warlock'=any(coalesce(v_spell.classes,'{}'::text[]))) then
          raise exception 'The selected Mystic Arcanum spell is not legal.';
        end if;
        v_source_key:=v_group->>'id';
        insert into public.character_spells(
          character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,
          uses_max,uses_remaining,recharge,casting_stat,raw_payload
        ) values(
          p_character_id,v_spell.id,'class-feature',v_source_key,v_group->>'label',true,true,true,
          1,1,'long-rest',v_class.spellcasting_ability,
          jsonb_build_object('creator','character_progression_v3','feature','Mystic Arcanum','grantedAtLevel',p_to_level,'spellLevel',v_spell.level)
        ) on conflict(character_id,spell_id,source_type,source_key) do update
          set known=true,prepared=true,always_available=true,uses_max=1,uses_remaining=1,recharge='long-rest',casting_stat=excluded.casting_stat,raw_payload=excluded.raw_payload,updated_at=now();
      end if;
    end loop;

    v_existing_group:=coalesce(v_class_choices->(v_group->>'id'),'{}'::jsonb);
    v_existing_selections:=case when jsonb_typeof(v_existing_group->'selections')='array' then v_existing_group->'selections' else '[]'::jsonb end;
    for v_option in select value from jsonb_array_elements(v_serialized) loop
      if exists(select 1 from jsonb_array_elements(v_existing_selections) prior where private.normalize_player_choice_name_v1(prior->>'name')=private.normalize_player_choice_name_v1(v_option->>'name')) then
        raise exception '% is already selected for %.',v_option->>'name',v_group->>'label';
      end if;
      v_existing_selections:=v_existing_selections||jsonb_build_array(v_option);
    end loop;
    v_class_choices:=jsonb_set(v_class_choices,array[v_group->>'id'],jsonb_build_object(
      'label',v_group->>'label','kind',v_group->>'kind','sourceFeature',v_group->>'sourceFeature','source','XPHB',
      'level',coalesce((v_existing_group->>'level')::integer,(v_group->>'level')::integer),
      'count',jsonb_array_length(v_existing_selections),'placement','class','subclassName',null,'cadence','creation','replacementCadence','level-up',
      'selections',v_existing_selections
    ),true);
    v_summary:=v_summary||jsonb_build_array(jsonb_build_object('groupId',v_group->>'id','label',v_group->>'label','kind',v_group->>'kind','selections',v_serialized));
  end loop;

  if exists(select 1 from jsonb_object_keys(p_selections) supplied where not exists(select 1 from jsonb_array_elements(v_groups) g where g->>'id'=supplied)) then
    raise exception 'Additional class choice payload contains an unexpected group.';
  end if;

  v_sheet:=jsonb_set(v_sheet,'{classFeatureChoices}',v_class_choices,true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now() where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);
  return v_summary;
end;
$function$;

create or replace function public.get_character_level_class_choice_options_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','private','auth'
as $function$
declare v_progression public.character_progression%rowtype; v_groups jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to review this character.' using errcode='42501'; end if;
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found or v_progression.class_level>=20 then return jsonb_build_object('required',false,'groups','[]'::jsonb); end if;
  v_groups:=private.simple_level_class_choice_groups_v1(p_character_id,v_progression.class_level+1)
    ||private.additional_level_class_choice_groups_v1(p_character_id,v_progression.class_level+1);
  return jsonb_build_object('required',jsonb_array_length(v_groups)>0,'level',v_progression.class_level+1,'groups',v_groups);
end;
$function$;

create or replace function private.level_up_persistent_choice_gaps_v1(p_class_key text,p_class_source text,p_from_level integer,p_to_level integer)
returns jsonb
language plpgsql
immutable
set search_path to 'pg_catalog'
as $function$
declare
  v_class text:=lower(btrim(coalesce(p_class_key,'')));
  v_source text:=upper(btrim(coalesce(p_class_source,'')));
  v_from integer:=greatest(1,coalesce(p_from_level,1));
  v_to integer:=greatest(1,coalesce(p_to_level,1));
  v_out jsonb:='[]'::jsonb;
  v_warlock_before integer:=0;
  v_warlock_after integer:=0;
begin
  if v_source<>'XPHB' or v_to<>v_from+1 then return v_out; end if;
  if v_class='bard' and v_to=10 then
    v_out:=v_out||jsonb_build_array('Magical Secrets spell access');
  elsif v_class='warlock' then
    v_warlock_before:=case when v_from>=18 then 10 when v_from>=15 then 9 when v_from>=12 then 8 when v_from>=9 then 7 when v_from>=7 then 6 when v_from>=5 then 5 when v_from>=2 then 3 else 1 end;
    v_warlock_after:=case when v_to>=18 then 10 when v_to>=15 then 9 when v_to>=12 then 8 when v_to>=9 then 7 when v_to>=7 then 6 when v_to>=5 then 5 when v_to>=2 then 3 else 1 end;
    if v_warlock_after>v_warlock_before then v_out:=v_out||jsonb_build_array('Eldritch Invocations +'||(v_warlock_after-v_warlock_before)::text); end if;
  end if;
  return v_out;
end;
$function$;

create or replace function private.unsupported_level_choice_features_v1(p_features jsonb)
returns jsonb
language plpgsql
immutable
set search_path to 'pg_catalog'
as $function$
declare v_result jsonb:='[]'::jsonb; v_feature jsonb; v_name text;
begin
  if jsonb_typeof(coalesce(p_features,'[]'::jsonb))<>'array' then return v_result; end if;
  for v_feature in select value from jsonb_array_elements(p_features) loop
    v_name:=lower(btrim(coalesce(v_feature->>'name','')));
    if v_name in ('divine order','primal order','eldritch invocations','eldritch invocation','magical secrets') then
      v_result:=v_result||jsonb_build_array(v_feature->>'name');
    elsif v_name='epic boon' then
      v_result:=v_result||jsonb_build_array(v_feature->>'name');
    end if;
  end loop;
  return v_result;
end;
$function$;

create or replace function public.complete_character_level_up_v3(p_character_id uuid,p_selections jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth'
as $function$
declare
  v_input jsonb:=coalesce(p_selections,'{}'::jsonb);
  v_progression public.character_progression%rowtype;
  v_next public.class_level_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_instance jsonb:=coalesce(v_input->'advancement_instance','{}'::jsonb);
  v_requires_asi boolean:=false;
  v_requires_epic boolean:=false;
  v_option_id uuid;
  v_option public.character_option_catalog%rowtype;
  v_base jsonb;
  v_result jsonb;
  v_sanitized jsonb;
  v_level_choice jsonb;
  v_session_id uuid;
  v_simple_groups jsonb:='[]'::jsonb;
  v_additional_groups jsonb:='[]'::jsonb;
  v_simple_input jsonb:='{}'::jsonb;
  v_additional_input jsonb:='{}'::jsonb;
  v_all_input jsonb:=coalesce(v_input->'class_choice_selections','{}'::jsonb);
  v_key text;
  v_class_choice_summary jsonb:='[]'::jsonb;
  v_part jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to level this character.' using errcode='42501'; end if;
  if jsonb_typeof(v_input)<>'object' or jsonb_typeof(v_all_input)<>'object' then raise exception 'Level-up selections must be JSON objects.'; end if;
  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if not found then raise exception 'Character progression has not been initialized.' using errcode='P0002'; end if;
  if v_progression.class_level>=20 then raise exception 'This character is already level 20.'; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  select * into v_next from public.class_level_progression where class_id=v_progression.class_id and class_level=v_progression.class_level+1;
  if not found then raise exception 'Next-level progression metadata is unavailable.'; end if;
  if jsonb_array_length(private.level_up_persistent_choice_gaps_v1(v_class.class_key,v_class.source,v_progression.class_level,v_next.class_level))>0 then
    raise exception 'This level still contains a persistent class choice that is not connected to progression v3.';
  end if;

  v_simple_groups:=private.simple_level_class_choice_groups_v1(p_character_id,v_next.class_level);
  v_additional_groups:=private.additional_level_class_choice_groups_v1(p_character_id,v_next.class_level);
  for v_key in select key from jsonb_each(v_all_input) loop
    if exists(select 1 from jsonb_array_elements(v_simple_groups) g where g->>'id'=v_key) then
      v_simple_input:=jsonb_set(v_simple_input,array[v_key],v_all_input->v_key,true);
    elsif exists(select 1 from jsonb_array_elements(v_additional_groups) g where g->>'id'=v_key) then
      v_additional_input:=jsonb_set(v_additional_input,array[v_key],v_all_input->v_key,true);
    else
      raise exception 'Class choice payload contains an unexpected group: %.',v_key;
    end if;
  end loop;
  if jsonb_array_length(v_simple_groups)>0 then
    v_part:=private.apply_simple_level_class_choices_v1(p_character_id,v_next.class_level,v_simple_input);
    v_class_choice_summary:=v_class_choice_summary||coalesce(v_part,'[]'::jsonb);
  end if;
  if jsonb_array_length(v_additional_groups)>0 then
    v_part:=private.apply_additional_level_class_choices_v1(p_character_id,v_next.class_level,v_additional_input);
    v_class_choice_summary:=v_class_choice_summary||coalesce(v_part,'[]'::jsonb);
  end if;
  if jsonb_array_length(v_simple_groups)=0 and jsonb_array_length(v_additional_groups)=0 and exists(select 1 from jsonb_object_keys(v_all_input)) then
    raise exception 'This level does not accept class-choice selections.';
  end if;

  v_requires_asi:=private.level_has_feature_v1(v_next.features,'Ability Score Improvement');
  v_requires_epic:=private.level_has_feature_v1(v_next.features,'Epic Boon');
  if v_requires_asi or v_requires_epic then
    v_option_id:=private.level_up_advancement_option_id_v1(p_character_id,v_next.class_level,v_instance,v_requires_epic);
    select * into v_option from public.character_option_catalog where id=v_option_id;
  elsif jsonb_typeof(v_input->'advancement_instance') is not null then
    raise exception 'This level does not grant a feat or Epic Boon advancement.';
  end if;

  v_base:=jsonb_strip_nulls(jsonb_build_object(
    'hp_method',v_input->>'hp_method','subclass_name',nullif(v_input->>'subclass_name',''),
    'subclass_source',nullif(v_input->>'subclass_source',''),'spell_choices',coalesce(v_input->'spell_choices','[]'::jsonb)
  ));
  if v_requires_asi then
    v_base:=v_base||jsonb_build_object('advancement_type','feat','feat_name',v_option.name);
    v_result:=public.complete_character_level_up_v2(p_character_id,v_base);
  elsif v_requires_epic then
    v_result:=private.complete_epic_level_up_base_v1(p_character_id,v_base);
  else
    v_result:=public.complete_character_level_up_v2(p_character_id,v_base);
  end if;

  perform private.sync_player_forge_class_spell_summary_v1(p_character_id);
  if v_option_id is not null then v_sanitized:=private.apply_character_level_advancement_v1(p_character_id,v_next.class_level,v_option_id,v_instance); end if;
  select coalesce(level_choices->(v_next.class_level::text),'{}'::jsonb) into v_level_choice from public.character_progression where character_id=p_character_id;
  if v_sanitized is not null then v_level_choice:=v_level_choice||jsonb_build_object('advancement_instance',v_sanitized); end if;
  if jsonb_array_length(v_class_choice_summary)>0 then v_level_choice:=v_level_choice||jsonb_build_object('class_choice_delta',v_class_choice_summary); end if;
  update public.character_progression set level_choices=jsonb_set(coalesce(level_choices,'{}'::jsonb),array[v_next.class_level::text],v_level_choice,true),updated_at=now() where character_id=p_character_id;

  select id into v_session_id from public.character_level_up_sessions where character_id=p_character_id and to_level=v_next.class_level and status='completed' order by completed_at desc limit 1;
  if v_session_id is not null then
    update public.character_level_up_sessions
    set selections=coalesce(selections,'{}'::jsonb)
      ||case when v_sanitized is not null then jsonb_build_object('advancement_instance',v_sanitized) else '{}'::jsonb end
      ||case when jsonb_array_length(v_class_choice_summary)>0 then jsonb_build_object('class_choice_delta',v_class_choice_summary) else '{}'::jsonb end,
      updated_at=now() where id=v_session_id;
  end if;
  update public.character_level_events
  set details=coalesce(details,'{}'::jsonb)
    ||case when v_sanitized is not null then jsonb_build_object('advancementOptionId',v_option.id,'advancementName',v_option.name,'advancementSource',v_option.source,'advancementInstance',v_sanitized) else '{}'::jsonb end
    ||case when jsonb_array_length(v_class_choice_summary)>0 then jsonb_build_object('classChoiceDelta',v_class_choice_summary) else '{}'::jsonb end
  where id=(select id from public.character_level_events where character_id=p_character_id and event_type='level_up_completed' and to_level=v_next.class_level order by created_at desc limit 1);

  return coalesce(v_result,'{}'::jsonb)||jsonb_build_object('progression',public.get_character_progression_v1(p_character_id),'advancement',v_sanitized,'classChoices',v_class_choice_summary);
end;
$function$;
