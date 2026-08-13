-- First shared class-choice deltas for earned progression. These choices use
-- the same classFeatureChoices / featGrantInstances shapes as Character Forge.
-- More dependency-heavy families (Metamagic, Invocations, Mystic Arcanum) stay
-- behind the fail-closed gap guard until their child/replacement authority lands.

create or replace function private.player_sheet_skill_label_v1(p_key text)
returns text
language sql
immutable
set search_path to 'pg_catalog'
as $function$
  select case lower(btrim(coalesce(p_key,'')))
    when 'animalhandling' then 'Animal Handling'
    when 'sleightofhand' then 'Sleight of Hand'
    when 'acrobatics' then 'Acrobatics' when 'arcana' then 'Arcana' when 'athletics' then 'Athletics'
    when 'deception' then 'Deception' when 'history' then 'History' when 'insight' then 'Insight'
    when 'intimidation' then 'Intimidation' when 'investigation' then 'Investigation' when 'medicine' then 'Medicine'
    when 'nature' then 'Nature' when 'perception' then 'Perception' when 'performance' then 'Performance'
    when 'persuasion' then 'Persuasion' when 'religion' then 'Religion' when 'stealth' then 'Stealth'
    when 'survival' then 'Survival' else null end;
$function$;

create or replace function private.simple_level_class_choice_groups_v1(p_character_id uuid,p_to_level integer)
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
  v_class_key text;
  v_source text;
  v_to integer := greatest(1,least(20,coalesce(p_to_level,1)));
  v_groups jsonb := '[]'::jsonb;
  v_options jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_skill_key text;
  v_skill_label text;
  v_allowed_skills text[];
  v_existing_languages text[] := '{}'::text[];
  v_language text;
  v_standard_languages constant text[] := array['Common','Common Sign Language','Draconic','Dwarvish','Elvish','Giant','Gnomish','Goblin','Halfling','Orc'];
begin
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found then return v_groups; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found then return v_groups; end if;
  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id;
  v_class_key:=lower(v_class.class_key); v_source:=upper(v_class.source);
  if v_source<>'XPHB' then return v_groups; end if;

  -- Fighting Style is a 2024 Fighting Style feat grant.
  if (v_class_key='paladin' and v_to=2) or (v_class_key='ranger' and v_to=2) then
    select coalesce(jsonb_agg(jsonb_build_object(
      'key','feat-'||o.id::text,'value',o.id::text,'label',o.name,'source',o.source,'kind','feat',
      'metadata',jsonb_build_object('optionId',o.id,'optionKey',o.option_key,'optionType',o.option_type,'category',o.category)
    ) order by o.name),'[]'::jsonb)
    into v_options
    from public.character_option_catalog_preferred o
    where o.option_type='feat' and o.category='FS' and private.character_option_prerequisites_met_v1(p_character_id,o.id,v_to);
    v_groups:=v_groups||jsonb_build_array(jsonb_build_object(
      'id',v_class_key||'-fighting-style','label','Fighting Style','kind','fighting-style','sourceFeature','Fighting Style','source','XPHB','level',v_to,'count',1,
      'fields',jsonb_build_array(jsonb_build_object('id','selection','label','Fighting Style','kind','feat','count',1,'required',true,'options',v_options))
    ));
  end if;

  -- Expertise totals are cumulative; this function emits only the new delta.
  v_count:=0; v_allowed_skills:=null;
  if v_class_key='bard' and v_to in (2,9) then v_count:=2;
  elsif v_class_key='ranger' and v_to=2 then v_count:=1;
  elsif v_class_key='ranger' and v_to=9 then v_count:=2;
  elsif v_class_key='rogue' and v_to=6 then v_count:=2;
  elsif v_class_key='wizard' and v_to=2 then v_count:=1; v_allowed_skills:=array['arcana','history','investigation','medicine','nature','religion'];
  end if;
  if v_count>0 then
    v_options:='[]'::jsonb;
    for v_skill_key in select key from jsonb_each(coalesce(v_sheet #> '{proficiencies,skills}','{}'::jsonb)) where coalesce((value->>'proficient')::boolean,false) loop
      if v_allowed_skills is not null and not (lower(v_skill_key)=any(v_allowed_skills)) then continue; end if;
      if coalesce((v_sheet #>> array['proficiencies','skills',v_skill_key,'expertise'])::boolean,false) then continue; end if;
      if exists(select 1 from jsonb_array_elements_text(coalesce(v_sheet->'expertiseSkills','[]'::jsonb)) e where lower(e)=lower(v_skill_key)) then continue; end if;
      v_skill_label:=private.player_sheet_skill_label_v1(v_skill_key);
      if v_skill_label is not null then v_options:=v_options||jsonb_build_array(jsonb_build_object('key',v_skill_key,'value',v_skill_key,'label',v_skill_label,'source','XPHB','kind','expertise')); end if;
    end loop;
    v_groups:=v_groups||jsonb_build_array(jsonb_build_object(
      'id',v_class_key||'-expertise','label',case when v_class_key='wizard' then 'Scholar Expertise' else 'Expertise' end,
      'kind','expertise','sourceFeature',case when v_class_key='wizard' then 'Scholar' when v_class_key='ranger' then 'Deft Explorer' else 'Expertise' end,
      'source','XPHB','level',v_to,'count',v_count,
      'fields',jsonb_build_array(jsonb_build_object('id','selection','label','Choose expertise skill','kind','expertise','count',v_count,'required',true,'options',v_options))
    ));
  end if;

  -- Barbarian Primal Knowledge: one additional skill from the Barbarian list.
  if v_class_key='barbarian' and v_to=3 then
    v_options:='[]'::jsonb;
    v_allowed_skills:=array['animalHandling','athletics','intimidation','nature','perception','survival'];
    foreach v_skill_key in array v_allowed_skills loop
      if coalesce((v_sheet #>> array['proficiencies','skills',v_skill_key,'proficient'])::boolean,false) then continue; end if;
      v_skill_label:=private.player_sheet_skill_label_v1(v_skill_key);
      v_options:=v_options||jsonb_build_array(jsonb_build_object('key',v_skill_key,'value',v_skill_key,'label',v_skill_label,'source','XPHB','kind','skill'));
    end loop;
    v_groups:=v_groups||jsonb_build_array(jsonb_build_object(
      'id','barbarian-primal-knowledge','label','Primal Knowledge','kind','skill-choice','sourceFeature','Primal Knowledge','source','XPHB','level',3,'count',1,
      'fields',jsonb_build_array(jsonb_build_object('id','selection','label','Additional Barbarian skill','kind','skill','count',1,'required',true,'options',v_options))
    ));
  end if;

  -- Ranger Deft Explorer: two additional standard languages at level 2.
  if v_class_key='ranger' and v_to=2 then
    if jsonb_typeof(v_sheet->'languages')='array' then select coalesce(array_agg(lower(value)),'{}'::text[]) into v_existing_languages from jsonb_array_elements_text(v_sheet->'languages'); end if;
    v_options:='[]'::jsonb;
    foreach v_language in array v_standard_languages loop
      if lower(v_language)=any(v_existing_languages) then continue; end if;
      v_options:=v_options||jsonb_build_array(jsonb_build_object('key',lower(regexp_replace(v_language,'[^a-zA-Z0-9]+','-','g')),'value',v_language,'label',v_language,'source','XPHB','kind','language'));
    end loop;
    v_groups:=v_groups||jsonb_build_array(jsonb_build_object(
      'id','ranger-deft-explorer-languages','label','Deft Explorer Languages','kind','language','sourceFeature','Deft Explorer','source','XPHB','level',2,'count',2,
      'fields',jsonb_build_array(jsonb_build_object('id','selection','label','Additional standard languages','kind','language','count',2,'required',true,'options',v_options))
    ));
  end if;

  if v_class_key='cleric' and v_to=7 then
    v_groups:=v_groups||jsonb_build_array(jsonb_build_object(
      'id','cleric-blessed-strikes','label','Blessed Strikes','kind','enum','sourceFeature','Blessed Strikes','source','XPHB','level',7,'count',1,
      'fields',jsonb_build_array(jsonb_build_object('id','selection','label','Blessed Strikes option','kind','enum','count',1,'required',true,
        'options',jsonb_build_array(jsonb_build_object('key','divine-strike','value','Divine Strike','label','Divine Strike','source','XPHB','kind','enum'),jsonb_build_object('key','potent-spellcasting','value','Potent Spellcasting','label','Potent Spellcasting','source','XPHB','kind','enum'))))
    ));
  end if;
  if v_class_key='druid' and v_to=7 then
    v_groups:=v_groups||jsonb_build_array(jsonb_build_object(
      'id','druid-elemental-fury','label','Elemental Fury','kind','enum','sourceFeature','Elemental Fury','source','XPHB','level',7,'count',1,
      'fields',jsonb_build_array(jsonb_build_object('id','selection','label','Elemental Fury option','kind','enum','count',1,'required',true,
        'options',jsonb_build_array(jsonb_build_object('key','potent-spellcasting','value','Potent Spellcasting','label','Potent Spellcasting','source','XPHB','kind','enum'),jsonb_build_object('key','primal-strike','value','Primal Strike','label','Primal Strike','source','XPHB','kind','enum'))))
    ));
  end if;

  return v_groups;
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
  v_groups:=private.simple_level_class_choice_groups_v1(p_character_id,v_progression.class_level+1);
  return jsonb_build_object('required',jsonb_array_length(v_groups)>0,'level',v_progression.class_level+1,'groups',v_groups);
end;
$function$;
grant execute on function public.get_character_level_class_choice_options_v1(uuid) to authenticated;

create or replace function private.apply_simple_level_class_choices_v1(p_character_id uuid,p_to_level integer,p_selections jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth'
as $function$
declare
  v_groups jsonb:=private.simple_level_class_choice_groups_v1(p_character_id,p_to_level);
  v_sheet jsonb;
  v_group jsonb;
  v_field jsonb;
  v_selected jsonb;
  v_selected_key text;
  v_option jsonb;
  v_count integer;
  v_class_choices jsonb;
  v_existing_group jsonb;
  v_existing_selections jsonb;
  v_serialized_selections jsonb;
  v_skill_key text;
  v_language text;
  v_languages jsonb;
  v_expertise jsonb;
  v_option_id uuid;
  v_catalog public.character_option_catalog%rowtype;
  v_instance_key text;
  v_feat_instances jsonb;
  v_feats jsonb;
  v_summary jsonb:='[]'::jsonb;
begin
  if jsonb_typeof(coalesce(p_selections,'{}'::jsonb))<>'object' then raise exception 'Class choice selections must be an object.'; end if;
  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  v_class_choices:=case when jsonb_typeof(v_sheet->'classFeatureChoices')='object' then v_sheet->'classFeatureChoices' else '{}'::jsonb end;
  v_feat_instances:=case when jsonb_typeof(v_sheet->'featGrantInstances')='array' then v_sheet->'featGrantInstances' else '[]'::jsonb end;
  v_feats:=case when jsonb_typeof(v_sheet->'feats')='array' then v_sheet->'feats' else '[]'::jsonb end;

  if jsonb_array_length(v_groups)=0 then
    if jsonb_object_length(coalesce(p_selections,'{}'::jsonb))>0 then raise exception 'This level has no supported simple class choices.'; end if;
    return '[]'::jsonb;
  end if;

  for v_group in select value from jsonb_array_elements(v_groups) loop
    v_field:=v_group->'fields'->0;
    v_selected:=coalesce(p_selections #> array[v_group->>'id',v_field->>'id'],'[]'::jsonb);
    if jsonb_typeof(v_selected)<>'array' then raise exception '% selections must be an array.',v_group->>'label'; end if;
    v_count:=coalesce((v_field->>'count')::integer,1);
    if jsonb_array_length(v_selected)<>v_count then raise exception '% requires exactly % choice(s).',v_group->>'label',v_count; end if;
    if (select count(distinct value) from jsonb_array_elements_text(v_selected))<>v_count then raise exception '% choices must be distinct.',v_group->>'label'; end if;
    v_serialized_selections:='[]'::jsonb;

    for v_selected_key in select value from jsonb_array_elements_text(v_selected) loop
      select value into v_option from jsonb_array_elements(coalesce(v_field->'options','[]'::jsonb)) where value->>'key'=v_selected_key limit 1;
      if v_option is null then raise exception '% contains a choice that is not source-legal for this character.',v_group->>'label'; end if;
      v_serialized_selections:=v_serialized_selections||jsonb_build_array(jsonb_build_object('key',v_option->>'key','name',v_option->>'label','source',coalesce(v_option->>'source','XPHB'),'kind',coalesce(v_option->>'kind',v_field->>'kind')));

      if v_field->>'kind'='expertise' then
        v_skill_key:=v_option->>'value';
        if not coalesce((v_sheet #>> array['proficiencies','skills',v_skill_key,'proficient'])::boolean,false) then raise exception 'Expertise requires proficiency in %.',v_option->>'label'; end if;
        v_sheet:=jsonb_set(v_sheet,array['proficiencies','skills',v_skill_key],coalesce(v_sheet #> array['proficiencies','skills',v_skill_key],'{}'::jsonb)||jsonb_build_object('expertise',true),true);
        v_expertise:=case when jsonb_typeof(v_sheet->'expertiseSkills')='array' then v_sheet->'expertiseSkills' else '[]'::jsonb end;
        if not exists(select 1 from jsonb_array_elements_text(v_expertise) e where e=v_skill_key) then v_expertise:=v_expertise||to_jsonb(v_skill_key); end if;
        v_sheet:=jsonb_set(v_sheet,'{expertiseSkills}',v_expertise,true);
      elsif v_field->>'kind'='skill' then
        v_skill_key:=v_option->>'value';
        if coalesce((v_sheet #>> array['proficiencies','skills',v_skill_key,'proficient'])::boolean,false) then raise exception '% is already proficient.',v_option->>'label'; end if;
        if jsonb_typeof(v_sheet #> '{proficiencies,skills}')<>'object' then v_sheet:=jsonb_set(v_sheet,'{proficiencies,skills}','{}'::jsonb,true); end if;
        v_sheet:=jsonb_set(v_sheet,array['proficiencies','skills',v_skill_key],coalesce(v_sheet #> array['proficiencies','skills',v_skill_key],'{}'::jsonb)||jsonb_build_object('proficient',true),true);
      elsif v_field->>'kind'='language' then
        v_language:=v_option->>'value';
        v_languages:=case when jsonb_typeof(v_sheet->'languages')='array' then v_sheet->'languages' else '[]'::jsonb end;
        if exists(select 1 from jsonb_array_elements_text(v_languages) l where lower(l)=lower(v_language)) then raise exception '% is already known.',v_language; end if;
        v_languages:=v_languages||to_jsonb(v_language);
        v_sheet:=jsonb_set(v_sheet,'{languages}',v_languages,true);
        v_sheet:=jsonb_set(v_sheet,'{meta,languages}',v_languages,true);
      elsif v_field->>'kind'='feat' then
        begin v_option_id:=(v_option #>> '{metadata,optionId}')::uuid; exception when others then raise exception 'Fighting Style must reference a canonical feat.'; end;
        select * into v_catalog from public.character_option_catalog where id=v_option_id and option_type='feat' and category='FS';
        if not found or not private.character_option_prerequisites_met_v1(p_character_id,v_catalog.id,p_to_level) then raise exception '% is not a legal Fighting Style for this character.',v_option->>'label'; end if;
        v_instance_key:='class-'||lower(regexp_replace(v_group->>'id','[^a-zA-Z0-9]+','-','g'))||'-feat-1';
        if exists(select 1 from public.character_option_grant_instances where character_id=p_character_id and instance_key=v_instance_key) then raise exception 'This Fighting Style acquisition is already recorded.'; end if;
        v_feat_instances:=v_feat_instances||jsonb_build_array(jsonb_build_object(
          'instanceId',v_instance_key,'optionId',v_catalog.id,'optionKey',v_catalog.option_key,'optionType','feat','name',v_catalog.name,'source',v_catalog.source,'category',v_catalog.category,
          'repeatable',coalesce((v_catalog.metadata->>'repeatable')::boolean,false),'acquisitionOwnerType','class','acquisitionOwnerKey',v_group->>'id','acquisitionLabel',v_group->>'label','acquisitionLevel',p_to_level,
          'fixedEffects','[]'::jsonb,'fixedSpellTokens','[]'::jsonb,'choices','{}'::jsonb
        ));
        if not exists(select 1 from jsonb_array_elements_text(v_feats) f where private.normalize_player_choice_name_v1(f)=private.normalize_player_choice_name_v1(v_catalog.name)) then v_feats:=v_feats||to_jsonb(v_catalog.name); end if;
        insert into public.character_option_grant_instances(character_id,option_id,option_key,option_type,option_name,option_source,instance_key,acquisition_owner_type,acquisition_owner_key,acquisition_label,acquisition_level,choices,effects,fixed_spell_tokens,repeatable,granted_by,updated_at)
        values(p_character_id,v_catalog.id,v_catalog.option_key,'feat',v_catalog.name,v_catalog.source,v_instance_key,'class',v_group->>'id',v_group->>'label',p_to_level,'{}'::jsonb,'[]'::jsonb,'[]'::jsonb,coalesce((v_catalog.metadata->>'repeatable')::boolean,false),auth.uid(),now());
        insert into public.character_option_grants(character_id,option_id,notes,granted_by,updated_at) values(p_character_id,v_catalog.id,'Earned through the '||(v_group->>'label')||' class feature at level '||p_to_level::text||'.',auth.uid(),now()) on conflict(character_id,option_id) do nothing;
      end if;
    end loop;

    v_existing_group:=coalesce(v_class_choices->(v_group->>'id'),'{}'::jsonb);
    v_existing_selections:=case when jsonb_typeof(v_existing_group->'selections')='array' then v_existing_group->'selections' else '[]'::jsonb end;
    for v_option in select value from jsonb_array_elements(v_serialized_selections) loop
      if not exists(select 1 from jsonb_array_elements(v_existing_selections) prior where private.normalize_player_choice_name_v1(prior->>'name')=private.normalize_player_choice_name_v1(v_option->>'name')) then v_existing_selections:=v_existing_selections||jsonb_build_array(v_option); end if;
    end loop;
    v_class_choices:=jsonb_set(v_class_choices,array[v_group->>'id'],jsonb_build_object(
      'label',v_group->>'label','kind',v_group->>'kind','sourceFeature',v_group->>'sourceFeature','source','XPHB','level',coalesce((v_existing_group->>'level')::integer,(v_group->>'level')::integer),
      'count',jsonb_array_length(v_existing_selections),'placement','class','subclassName',null,'cadence','creation','replacementCadence',null,'selections',v_existing_selections
    ),true);
    v_summary:=v_summary||jsonb_build_array(jsonb_build_object('groupId',v_group->>'id','label',v_group->>'label','kind',v_group->>'kind','selections',v_serialized_selections));
  end loop;

  -- Reject unexpected group IDs supplied by the client.
  if exists(select 1 from jsonb_object_keys(p_selections) supplied where not exists(select 1 from jsonb_array_elements(v_groups) g where g->>'id'=supplied)) then raise exception 'Class choice payload contains an unexpected group.'; end if;

  v_sheet:=jsonb_set(v_sheet,'{classFeatureChoices}',v_class_choices,true);
  v_sheet:=jsonb_set(v_sheet,'{featGrantInstances}',v_feat_instances,true);
  v_sheet:=jsonb_set(v_sheet,'{feats}',v_feats,true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now() where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);
  return v_summary;
end;
$function$;
