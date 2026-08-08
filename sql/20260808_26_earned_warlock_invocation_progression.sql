-- Required XPHB Warlock Invocation gains for earned progression.
-- Acquisition history is normalized in character_class_option_grant_instances.
-- Optional replacement is deliberately separate and is not performed here.

create or replace function private.level_up_warlock_invocation_groups_v1(
  p_character_id uuid,
  p_to_level integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_before integer:=0;
  v_after integer:=0;
  v_actual integer:=0;
  v_slot integer;
  v_slot_level integer;
  v_group_id text;
  v_options jsonb:='[]'::jsonb;
  v_fields jsonb:='[]'::jsonb;
  v_groups jsonb:='[]'::jsonb;
  v_option public.class_feature_option_catalog%rowtype;
  v_child_kind text;
  v_child_id text;
  v_child_options jsonb:='[]'::jsonb;
begin
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found then return '[]'::jsonb; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if lower(v_class.class_key)<>'warlock' or upper(v_class.source)<>'XPHB' then return '[]'::jsonb; end if;

  v_before:=private.xphb_warlock_invocation_count_v1(v_progression.class_level);
  v_after:=private.xphb_warlock_invocation_count_v1(p_to_level);
  select count(*) into v_actual from public.character_class_option_grant_instances g
  where g.character_id=p_character_id and g.option_type='eldritch-invocation';
  if v_actual<>v_before then
    raise exception 'This Warlock has % normalized Invocation instance(s), but level % requires %. Resolve current Invocation history before leveling.',v_actual,v_progression.class_level,v_before;
  end if;
  if v_after<=v_before then return '[]'::jsonb; end if;

  for v_slot in v_before+1..v_after loop
    v_slot_level:=private.xphb_warlock_invocation_slot_level_v1(v_slot);
    v_group_id:='warlock-invocation-slot-'||v_slot::text;
    select coalesce(jsonb_agg(jsonb_build_object(
      'key',o.option_key,'value',o.option_key,'label',o.name,'source',o.source,'kind','eldritch-invocation','description',coalesce(o.description,''),
      'metadata',jsonb_build_object('optionId',o.id,'optionKey',o.option_key,'repeatable',o.repeatable,'prerequisites',o.prerequisites,'choiceSchema',o.choice_schema,'requiresOptions',coalesce(o.prerequisites->'requiresOptions','[]'::jsonb),'uniqueFamily','eldritch-invocation')
    ) order by o.name),'[]'::jsonb) into v_options
    from public.class_feature_option_catalog o
    where o.option_type='eldritch-invocation' and o.source='XPHB' and lower(coalesce(o.class_key,''))='warlock'
      and coalesce((o.prerequisites->>'minClassLevel')::integer,1)<=v_slot_level
      and (o.repeatable or not exists(
        select 1 from public.character_class_option_grant_instances g
        join public.class_feature_option_catalog prior on prior.id=g.option_catalog_id
        where g.character_id=p_character_id and g.option_type='eldritch-invocation'
          and private.normalize_player_choice_name_v1(prior.name)=private.normalize_player_choice_name_v1(o.name)
      ));

    v_fields:=jsonb_build_array(jsonb_build_object(
      'id','invocation','label','Invocation '||v_slot::text,'kind','eldritch-invocation','count',1,'required',true,
      'cadence','level-up','replacementCadence','level-up','options',v_options,
      'metadata',jsonb_build_object('slot',v_slot,'acquisitionLevel',v_slot_level,'family','eldritch-invocation')
    ));

    for v_option in
      select * from public.class_feature_option_catalog o
      where o.option_type='eldritch-invocation' and o.source='XPHB' and lower(coalesce(o.class_key,''))='warlock'
        and coalesce((o.prerequisites->>'minClassLevel')::integer,1)<=v_slot_level
        and coalesce(o.choice_schema->>'kind','') in ('warlock-damage-cantrip','warlock-attack-cantrip','origin-feat')
      order by o.name
    loop
      v_child_kind:=coalesce(v_option.choice_schema->>'kind','');
      v_child_id:='child-'||trim(both '-' from regexp_replace(lower(v_option.name),'[^a-z0-9]+','-','g'));
      if v_child_kind in ('warlock-damage-cantrip','warlock-attack-cantrip') then
        select coalesce(jsonb_agg(jsonb_build_object(
          'key',s.id::text,'value',s.id::text,'label',s.name,'source',s.source,'kind','spell','description',coalesce(s.description,''),
          'metadata',jsonb_build_object('spellId',s.id,'spellKey',s.spell_key,'level',s.level,'rangeText',s.range_text,'rangeDistance',s.range_distance,'rangeUnit',s.range_unit,'attackType',s.attack_type,'damageDice',s.damage_dice,'damageTypes',coalesce(to_jsonb(s.damage_types),'[]'::jsonb),'distinctInvocationOptionKey',v_option.option_key)
        ) order by s.name),'[]'::jsonb) into v_child_options
        from public.spells_catalog_preferred s
        where s.level=0
          and exists(select 1 from unnest(coalesce(s.classes,'{}'::text[])) c where lower(c)='warlock')
          and (coalesce(array_length(s.damage_types,1),0)>0 or coalesce(s.damage_dice,'')<>'')
          and (v_child_kind<>'warlock-attack-cantrip' or coalesce(btrim(s.attack_type),'')<>'')
          and (
            coalesce((v_option.choice_schema->>'minRangeFeet')::integer,0)=0
            or (lower(coalesce(s.range_unit,'')) in ('feet','foot','ft') and coalesce(s.range_distance,0)>=(v_option.choice_schema->>'minRangeFeet')::integer)
            or (lower(coalesce(s.range_unit,'')) in ('mile','miles') and coalesce(s.range_distance,0)>0)
          );
      else
        select coalesce(jsonb_agg(jsonb_build_object(
          'key',f.id::text,'value',f.id::text,'label',f.name,'source',f.source,'kind','feat','description',coalesce(f.description,''),
          'metadata',jsonb_build_object('optionId',f.id,'optionKey',f.option_key,'category',f.category,'featMetadata',coalesce(f.metadata,'{}'::jsonb),'rawPayload',coalesce(f.raw_payload,'{}'::jsonb),'distinctInvocationOptionKey',v_option.option_key)
        ) order by f.name),'[]'::jsonb) into v_child_options
        from public.character_option_catalog_preferred f
        where f.option_type='feat' and f.category=coalesce(v_option.choice_schema->>'category','O');
      end if;
      v_fields:=v_fields||jsonb_build_array(jsonb_build_object(
        'id',v_child_id,'label',v_option.name||case when v_child_kind='origin-feat' then ': Origin feat' else ': affected cantrip' end,
        'kind',case when v_child_kind='origin-feat' then 'feat' else 'spell' end,'count',1,'required',true,'cadence','level-up','options',v_child_options,
        'activeWhen',jsonb_build_object('groupId',v_group_id,'fieldId','invocation','values',jsonb_build_array(v_option.option_key)),
        'metadata',jsonb_build_object('invocationOptionKey',v_option.option_key,'choiceKind',v_child_kind,'distinctPerRepeat',coalesce((v_option.choice_schema->>'distinctPerRepeat')::boolean,false))
      ));
    end loop;

    v_groups:=v_groups||jsonb_build_array(jsonb_build_object(
      'id',v_group_id,'ownerType','class-option','ownerKey','warlock-invocation-'||v_slot::text,'label','Eldritch Invocation '||v_slot::text,
      'source','XPHB','placement','class','level',v_slot_level,
      'helper','Invocation slot gained at Warlock level '||v_slot_level::text||'. Optional replacement is handled separately from this acquisition.',
      'fields',v_fields,'metadata',jsonb_build_object('family','eldritch-invocation','slot',v_slot,'acquisitionLevel',v_slot_level)
    ));
  end loop;
  return v_groups;
end;
$$;

create or replace function public.get_character_level_class_choice_options_v2(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare v_base jsonb; v_progression public.character_progression%rowtype; v_extra jsonb:='[]'::jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to review these class choices.' using errcode='42501'; end if;
  v_base:=public.get_character_level_class_choice_options_v1(p_character_id);
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found or v_progression.class_level>=20 then return v_base; end if;
  v_extra:=private.level_up_warlock_invocation_groups_v1(p_character_id,v_progression.class_level+1);
  return jsonb_set(coalesce(v_base,'{}'::jsonb),'{groups}',coalesce(v_base->'groups','[]'::jsonb)||coalesce(v_extra,'[]'::jsonb),true);
end;
$$;

create or replace function private.apply_level_up_warlock_invocations_v1(
  p_character_id uuid,
  p_to_level integer,
  p_selections jsonb,
  p_feat_instances jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_progression public.character_progression%rowtype; v_class public.class_catalog%rowtype;
  v_before integer:=0; v_after integer:=0; v_actual integer:=0; v_slot integer; v_slot_level integer; v_group_id text;
  v_invocation_key text; v_option public.class_feature_option_catalog%rowtype; v_selected_names text[]:='{}'::text[]; v_requirement text;
  v_child_kind text; v_child_id text; v_child_key text; v_child_choice jsonb; v_spell public.spells_catalog%rowtype; v_spell_id uuid; v_feat_id uuid;
  v_feat_instance jsonb; v_feat_result jsonb; v_summary jsonb:='[]'::jsonb; v_group_serialized jsonb; v_source_additions jsonb:='{}'::jsonb;
  v_seen_children text[]:='{}'::text[]; v_child_token text; v_sheet jsonb;
begin
  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if not found then raise exception 'Character progression has not been initialized.'; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if lower(v_class.class_key)<>'warlock' or upper(v_class.source)<>'XPHB' then
    if exists(select 1 from jsonb_object_keys(coalesce(p_selections,'{}'::jsonb)) k where k like 'warlock-invocation-slot-%') then raise exception 'Invocation selections are only valid for an XPHB Warlock.'; end if;
    return '[]'::jsonb;
  end if;
  v_before:=private.xphb_warlock_invocation_count_v1(v_progression.class_level); v_after:=private.xphb_warlock_invocation_count_v1(p_to_level);
  select count(*) into v_actual from public.character_class_option_grant_instances g where g.character_id=p_character_id and g.option_type='eldritch-invocation';
  if v_actual<>v_before then raise exception 'This Warlock has % normalized Invocation instance(s), but level % requires %. Resolve current Invocation history before leveling.',v_actual,v_progression.class_level,v_before; end if;
  select coalesce(array_agg(private.normalize_player_choice_name_v1(o.name) order by g.acquired_level,g.instance_key),'{}'::text[])
  into v_selected_names from public.character_class_option_grant_instances g join public.class_feature_option_catalog o on o.id=g.option_catalog_id
  where g.character_id=p_character_id and g.option_type='eldritch-invocation';
  select coalesce(array_agg(private.normalize_player_choice_name_v1(o.name)||'|'||coalesce(g.choices#>>'{child,value}',g.choices#>>'{child,key}','')) filter (where coalesce(g.choices#>>'{child,value}',g.choices#>>'{child,key}','')<>''),'{}'::text[])
  into v_seen_children from public.character_class_option_grant_instances g join public.class_feature_option_catalog o on o.id=g.option_catalog_id
  where g.character_id=p_character_id and g.option_type='eldritch-invocation';

  if v_after<=v_before then
    if exists(select 1 from jsonb_object_keys(coalesce(p_selections,'{}'::jsonb)) k where k like 'warlock-invocation-slot-%') then raise exception 'This level does not grant a new Invocation slot.'; end if;
    return '[]'::jsonb;
  end if;

  for v_slot in v_before+1..v_after loop
    v_slot_level:=private.xphb_warlock_invocation_slot_level_v1(v_slot); v_group_id:='warlock-invocation-slot-'||v_slot::text;
    if jsonb_array_length(coalesce(p_selections#>array[v_group_id,'invocation'],'[]'::jsonb))<>1 then raise exception 'Invocation slot % requires exactly one Invocation.',v_slot; end if;
    v_invocation_key:=(p_selections#>array[v_group_id,'invocation']->>0);
    select * into v_option from public.class_feature_option_catalog o where o.option_key=v_invocation_key and o.option_type='eldritch-invocation' and o.source='XPHB' and lower(coalesce(o.class_key,''))='warlock';
    if not found then raise exception 'Invocation slot % contains an unknown option.',v_slot; end if;
    if coalesce((v_option.prerequisites->>'minClassLevel')::integer,1)>v_slot_level then raise exception '% is not available for Invocation slot %.',v_option.name,v_slot; end if;
    if not v_option.repeatable and private.normalize_player_choice_name_v1(v_option.name)=any(v_selected_names) then raise exception '% is not repeatable and is already known.',v_option.name; end if;
    for v_requirement in select value from jsonb_array_elements_text(coalesce(v_option.prerequisites->'requiresOptions','[]'::jsonb)) loop
      if not(private.normalize_player_choice_name_v1(v_requirement)=any(v_selected_names)) then raise exception '% requires % to be known first.',v_option.name,v_requirement; end if;
    end loop;

    v_child_kind:=coalesce(v_option.choice_schema->>'kind',''); v_child_choice:=null; v_feat_result:=null;
    if v_child_kind in ('warlock-damage-cantrip','warlock-attack-cantrip','origin-feat') then
      v_child_id:='child-'||trim(both '-' from regexp_replace(lower(v_option.name),'[^a-z0-9]+','-','g'));
      if jsonb_array_length(coalesce(p_selections#>array[v_group_id,v_child_id],'[]'::jsonb))<>1 then raise exception '% requires exactly one dependent choice.',v_option.name; end if;
      v_child_key:=(p_selections#>array[v_group_id,v_child_id]->>0);
      if v_child_kind in ('warlock-damage-cantrip','warlock-attack-cantrip') then
        begin v_spell_id:=v_child_key::uuid; exception when others then raise exception '% requires a valid cantrip id.',v_option.name; end;
        select * into v_spell from public.spells_catalog s where s.id=v_spell_id and public.is_preferred_spell_version_v1(s.id);
        if not found or v_spell.level<>0 or not exists(select 1 from unnest(coalesce(v_spell.classes,'{}'::text[])) c where lower(c)='warlock') or (coalesce(array_length(v_spell.damage_types,1),0)=0 and coalesce(v_spell.damage_dice,'')='') then raise exception '% requires a preferred Warlock damage cantrip.',v_option.name; end if;
        if v_child_kind='warlock-attack-cantrip' and coalesce(btrim(v_spell.attack_type),'')='' then raise exception '% requires an attack-roll cantrip.',v_option.name; end if;
        if coalesce((v_option.choice_schema->>'minRangeFeet')::integer,0)>0 and not((lower(coalesce(v_spell.range_unit,'')) in ('feet','foot','ft') and coalesce(v_spell.range_distance,0)>=(v_option.choice_schema->>'minRangeFeet')::integer) or (lower(coalesce(v_spell.range_unit,'')) in ('mile','miles') and coalesce(v_spell.range_distance,0)>0)) then raise exception '% requires a cantrip with sufficient range.',v_option.name; end if;
        v_child_choice:=jsonb_build_object('key',v_spell.id::text,'value',v_spell.id::text,'label',v_spell.name,'source',v_spell.source,'kind','spell','metadata',jsonb_build_object('spellId',v_spell.id,'spellKey',v_spell.spell_key));
      else
        begin v_feat_id:=v_child_key::uuid; exception when others then raise exception 'Lessons of the First Ones requires a valid Origin feat id.'; end;
        if not exists(select 1 from public.character_option_catalog_preferred f where f.id=v_feat_id and f.option_type='feat' and f.category=coalesce(v_option.choice_schema->>'category','O')) then raise exception 'Lessons of the First Ones requires a source-valid Origin feat.'; end if;
        select instance into v_feat_instance from jsonb_array_elements(coalesce(p_feat_instances,'[]'::jsonb)) instance where instance->>'acquisitionOwnerKey'=v_group_id and instance->>'optionId'=v_feat_id::text limit 1;
        if v_feat_instance is null then raise exception 'Lessons of the First Ones requires its nested Origin feat choices to be complete.'; end if;
        v_feat_result:=private.apply_source_owned_origin_feat_v1(p_character_id,p_to_level,v_feat_id,v_feat_instance,'invocation-'||v_group_id||'-origin-feat','class-option',v_group_id);
        v_child_choice:=jsonb_build_object('key',v_feat_id::text,'value',v_feat_id::text,'label',v_feat_result->>'name','source',v_feat_result->>'source','kind','feat','metadata',jsonb_build_object('optionId',v_feat_id));
      end if;
      v_child_token:=private.normalize_player_choice_name_v1(v_option.name)||'|'||coalesce(v_child_choice->>'value',v_child_choice->>'key','');
      if coalesce((v_option.choice_schema->>'distinctPerRepeat')::boolean,false) and v_child_token=any(v_seen_children) then raise exception 'Repeated % instances must use different dependent choices.',v_option.name; end if;
      v_seen_children:=array_append(v_seen_children,v_child_token);
    end if;

    insert into public.character_class_option_grant_instances(character_id,instance_key,option_catalog_id,option_type,acquired_level,choices,metadata,updated_at)
    values(p_character_id,v_group_id,v_option.id,'eldritch-invocation',v_slot_level,case when v_child_choice is null then '{}'::jsonb else jsonb_build_object('child',v_child_choice) end,jsonb_build_object('source','level-up','slot',v_slot,'family','eldritch-invocation'),now());

    v_group_serialized:=jsonb_build_object('ownerType','class-option','ownerKey','warlock-invocation-'||v_slot::text,'label','Eldritch Invocation '||v_slot::text,'source','XPHB','placement','class','level',v_slot_level,'metadata',jsonb_build_object('family','eldritch-invocation','slot',v_slot,'acquisitionLevel',v_slot_level),'fields',jsonb_build_object('invocation',jsonb_build_object('label','Invocation '||v_slot::text,'kind','eldritch-invocation','count',1,'required',true,'cadence','level-up','replacementCadence','level-up','selections',jsonb_build_array(jsonb_build_object('key',v_option.option_key,'value',v_option.option_key,'label',v_option.name,'source',v_option.source,'kind','eldritch-invocation')))));
    if v_child_choice is not null then v_group_serialized:=jsonb_set(v_group_serialized,array['fields',coalesce(v_child_id,'child')],jsonb_build_object('label',case when v_child_kind='origin-feat' then v_option.name||': Origin feat' else v_option.name||': affected cantrip' end,'kind',case when v_child_kind='origin-feat' then 'feat' else 'spell' end,'count',1,'required',true,'cadence','level-up','activeWhen',jsonb_build_object('groupId',v_group_id,'fieldId','invocation','values',jsonb_build_array(v_option.option_key)),'selections',jsonb_build_array(v_child_choice)),true); end if;
    v_source_additions:=jsonb_set(v_source_additions,array[v_group_id],v_group_serialized,true);
    v_summary:=v_summary||jsonb_build_array(jsonb_build_object('groupId',v_group_id,'groupLabel','Eldritch Invocation '||v_slot::text,'groupKind','eldritch-invocation','level',v_slot_level,'key',v_option.option_key,'name',v_option.name,'source',v_option.source,'kind','eldritch-invocation','child',v_child_choice,'featInstance',v_feat_result));
    v_selected_names:=array_append(v_selected_names,private.normalize_player_choice_name_v1(v_option.name));
  end loop;

  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  v_sheet:=jsonb_set(v_sheet,'{sourceChoices}',(case when jsonb_typeof(v_sheet->'sourceChoices')='object' then v_sheet->'sourceChoices' else '{}'::jsonb end)||v_source_additions,true);
  v_sheet:=jsonb_set(v_sheet,'{sourceChoiceSummary}',(case when jsonb_typeof(v_sheet->'sourceChoiceSummary')='array' then v_sheet->'sourceChoiceSummary' else '[]'::jsonb end)||v_summary,true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now() where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);
  return v_summary;
end;
$$;

create or replace function private.level_up_persistent_choice_gaps_v1(p_class_key text,p_class_source text,p_from_level integer,p_to_level integer)
returns jsonb
language plpgsql immutable set search_path=pg_catalog as $$
begin
  -- Required XPHB Warlock Invocation gains are handled by progression v4 using normalized instance authority.
  return '[]'::jsonb;
end;
$$;

create or replace function public.complete_character_level_up_v4(p_character_id uuid,p_selections jsonb)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_input jsonb:=coalesce(p_selections,'{}'::jsonb); v_progression public.character_progression%rowtype; v_to integer;
  v_all_class jsonb:=coalesce(v_input->'class_choice_selections','{}'::jsonb); v_invocation jsonb:='{}'::jsonb; v_other jsonb:='{}'::jsonb; v_key text;
  v_feat_instances jsonb:=coalesce(v_input->'class_option_feat_instances','[]'::jsonb); v_invocation_summary jsonb:='[]'::jsonb; v_v3_input jsonb; v_result jsonb; v_tough_bonus integer:=0;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to level this character.' using errcode='42501'; end if;
  if jsonb_typeof(v_input)<>'object' or jsonb_typeof(v_all_class)<>'object' or jsonb_typeof(v_feat_instances)<>'array' then raise exception 'Level-up source selections have an invalid shape.'; end if;
  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if not found or v_progression.class_level>=20 then raise exception 'Character progression is unavailable for another level.'; end if;
  v_to:=v_progression.class_level+1;
  for v_key in select key from jsonb_each(v_all_class) loop
    if v_key like 'warlock-invocation-slot-%' then v_invocation:=jsonb_set(v_invocation,array[v_key],v_all_class->v_key,true);
    else v_other:=jsonb_set(v_other,array[v_key],v_all_class->v_key,true); end if;
  end loop;
  v_invocation_summary:=private.apply_level_up_warlock_invocations_v1(p_character_id,v_to,v_invocation,v_feat_instances);
  v_v3_input:=(v_input-'class_option_feat_instances')||jsonb_build_object('class_choice_selections',v_other);
  v_result:=public.complete_character_level_up_v3(p_character_id,v_v3_input);
  v_tough_bonus:=private.apply_tough_progression_bonus_v1(p_character_id,v_to);
  return coalesce(v_result,'{}'::jsonb)||jsonb_build_object('invocations',v_invocation_summary,'toughProgressionBonus',v_tough_bonus,'progression',public.get_character_progression_v1(p_character_id));
end;
$$;

revoke all on function public.complete_character_level_up_v3(uuid,jsonb) from authenticated,anon,public;
grant execute on function public.complete_character_level_up_v3(uuid,jsonb) to service_role;
revoke all on function public.complete_character_level_up_v4(uuid,jsonb) from public;
grant execute on function public.complete_character_level_up_v4(uuid,jsonb) to authenticated,service_role;
revoke all on function public.get_character_level_class_choice_options_v2(uuid) from public;
grant execute on function public.get_character_level_class_choice_options_v2(uuid) to authenticated,service_role;
