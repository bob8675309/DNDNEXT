-- Safe XPHB Eldritch Invocation replacement on Warlock level gain.
-- Replacement is surfaced as an optional class-option group so the existing nested
-- Origin-feat renderer can collect full Lessons of the First Ones feat instances.

create or replace function private.validate_existing_normalized_warlock_invocations_v2()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_sheet jsonb:='{}'::jsonb;
  v_class public.class_catalog%rowtype;
  v_expected integer:=0;
  v_actual integer:=0;
  v_selected_names text[]:='{}'::text[];
  v_seen_nonrepeatable text[]:='{}'::text[];
  v_seen_children text[]:='{}'::text[];
  v_row record;
  v_requirement text;
  v_child_kind text;
  v_child_key text;
  v_child_token text;
  v_spell public.spells_catalog%rowtype;
  v_spell_id uuid;
  v_feat_id uuid;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=new.character_id;
  if coalesce(v_sheet#>>'{meta,creator}','')<>'shared_character_forge_player_v2' then return new; end if;

  select * into v_class from public.class_catalog where id=new.class_id;
  if not found then return new; end if;

  select count(*) into v_actual
  from public.character_class_option_grant_instances g
  where g.character_id=new.character_id and g.option_type='eldritch-invocation';

  if lower(coalesce(v_class.class_key,''))<>'warlock' or upper(coalesce(v_class.source,''))<>'XPHB' then
    if v_actual>0 then raise exception 'A non-Warlock progression cannot retain normalized Eldritch Invocation instances.'; end if;
    return new;
  end if;

  v_expected:=private.xphb_warlock_invocation_count_v1(new.class_level);
  if v_actual<>v_expected then
    raise exception 'Warlock level % requires exactly % normalized Invocation instance(s); found %.',new.class_level,v_expected,v_actual;
  end if;

  select coalesce(array_agg(private.normalize_player_choice_name_v1(o.name) order by g.instance_key),'{}'::text[])
  into v_selected_names
  from public.character_class_option_grant_instances g
  join public.class_feature_option_catalog o on o.id=g.option_catalog_id
  where g.character_id=new.character_id and g.option_type='eldritch-invocation';

  for v_row in
    select g.*,o.name,o.source,o.class_key,o.repeatable,o.prerequisites,o.choice_schema
    from public.character_class_option_grant_instances g
    join public.class_feature_option_catalog o on o.id=g.option_catalog_id
    where g.character_id=new.character_id and g.option_type='eldritch-invocation'
    order by g.instance_key
  loop
    if v_row.source<>'XPHB' or lower(coalesce(v_row.class_key,''))<>'warlock' then
      raise exception 'Normalized Invocation % is not a canonical XPHB Warlock option.',v_row.instance_key;
    end if;
    if coalesce((v_row.prerequisites->>'minClassLevel')::integer,1)>new.class_level then
      raise exception '% is not legal at Warlock level %.',v_row.name,new.class_level;
    end if;
    if not v_row.repeatable then
      if private.normalize_player_choice_name_v1(v_row.name)=any(v_seen_nonrepeatable) then raise exception '% is not repeatable.',v_row.name; end if;
      v_seen_nonrepeatable:=array_append(v_seen_nonrepeatable,private.normalize_player_choice_name_v1(v_row.name));
    end if;
    for v_requirement in select value from jsonb_array_elements_text(coalesce(v_row.prerequisites->'requiresOptions','[]'::jsonb))
    loop
      if not(private.normalize_player_choice_name_v1(v_requirement)=any(v_selected_names)) then
        raise exception '% requires % to be part of the current Invocation set.',v_row.name,v_requirement;
      end if;
    end loop;

    v_child_kind:=coalesce(v_row.choice_schema->>'kind','');
    v_child_key:=coalesce(v_row.choices#>>'{child,value}',v_row.choices#>>'{child,key}','');
    if v_child_kind in ('warlock-damage-cantrip','warlock-attack-cantrip') then
      if v_child_key='' then raise exception '% requires an affected cantrip.',v_row.name; end if;
      begin v_spell_id:=v_child_key::uuid; exception when others then raise exception '% contains an invalid affected cantrip.',v_row.name; end;
      select * into v_spell from public.spells_catalog s where s.id=v_spell_id and public.is_preferred_spell_version_v1(s.id);
      if not found or v_spell.level<>0
         or not exists(select 1 from unnest(coalesce(v_spell.classes,'{}'::text[])) c where lower(c)='warlock')
         or (coalesce(array_length(v_spell.damage_types,1),0)=0 and coalesce(v_spell.damage_dice,'')='') then
        raise exception '% requires a preferred Warlock damage cantrip.',v_row.name;
      end if;
      if v_child_kind='warlock-attack-cantrip' and coalesce(btrim(v_spell.attack_type),'')='' then raise exception '% requires an attack-roll cantrip.',v_row.name; end if;
      if coalesce((v_row.choice_schema->>'minRangeFeet')::integer,0)>0 and not(
        (lower(coalesce(v_spell.range_unit,'')) in ('feet','foot','ft') and coalesce(v_spell.range_distance,0)>=(v_row.choice_schema->>'minRangeFeet')::integer)
        or (lower(coalesce(v_spell.range_unit,'')) in ('mile','miles') and coalesce(v_spell.range_distance,0)>0)
      ) then raise exception '% requires a cantrip with sufficient range.',v_row.name; end if;
      v_child_token:=private.normalize_player_choice_name_v1(v_row.name)||'|'||v_spell.id::text;
      if coalesce((v_row.choice_schema->>'distinctPerRepeat')::boolean,false) and v_child_token=any(v_seen_children) then
        raise exception 'Repeated % instances must use different dependent choices.',v_row.name;
      end if;
      v_seen_children:=array_append(v_seen_children,v_child_token);
    elsif v_child_kind='origin-feat' then
      if v_child_key='' then raise exception '% requires an Origin feat.',v_row.name; end if;
      begin v_feat_id:=v_child_key::uuid; exception when others then raise exception '% contains an invalid Origin feat id.',v_row.name; end;
      if not exists(
        select 1 from public.character_option_catalog_preferred f
        where f.id=v_feat_id and f.option_type='feat' and f.category=coalesce(v_row.choice_schema->>'category','O')
      ) then raise exception '% requires a source-valid Origin feat.',v_row.name; end if;
      if not exists(
        select 1 from public.character_option_grant_instances gi
        where gi.character_id=new.character_id
          and gi.acquisition_owner_type='class-option'
          and gi.acquisition_owner_key=v_row.instance_key
          and gi.option_id=v_feat_id
      ) then raise exception '% is missing its owned Origin feat instance.',v_row.name; end if;
      v_child_token:=private.normalize_player_choice_name_v1(v_row.name)||'|'||v_feat_id::text;
      if coalesce((v_row.choice_schema->>'distinctPerRepeat')::boolean,false) and v_child_token=any(v_seen_children) then
        raise exception 'Repeated % instances must use different dependent choices.',v_row.name;
      end if;
      v_seen_children:=array_append(v_seen_children,v_child_token);
    elsif v_child_key<>'' then
      raise exception '% does not accept a persistent dependent choice.',v_row.name;
    end if;
  end loop;
  return new;
end;
$$;

-- Initial Forge creation still materializes from sourceChoices. Later progression updates
-- validate the normalized current state instead of reconstructing it under slot-acquisition rules.
drop trigger if exists character_progression_validate_player_forge_class_options_v1 on public.character_progression;
drop trigger if exists character_progression_validate_player_forge_class_options_v2 on public.character_progression;
create constraint trigger character_progression_validate_player_forge_class_options_v1
after insert on public.character_progression
deferrable initially deferred
for each row execute function private.validate_and_materialize_player_forge_class_options_v1();
create constraint trigger character_progression_validate_player_forge_class_options_v2
after update of class_id,class_level,level_choices on public.character_progression
deferrable initially deferred
for each row execute function private.validate_existing_normalized_warlock_invocations_v2();

create or replace function private.level_up_warlock_invocation_replacement_group_v1(p_character_id uuid,p_to_level integer)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_expected integer:=0;
  v_actual integer:=0;
  v_group_id text:='warlock-invocation-replacement';
  v_replace_options jsonb:='[]'::jsonb;
  v_replace_keys jsonb:='[]'::jsonb;
  v_with_options jsonb:='[]'::jsonb;
  v_fields jsonb:='[]'::jsonb;
  v_option public.class_feature_option_catalog%rowtype;
  v_child_kind text;
  v_child_id text;
  v_child_options jsonb:='[]'::jsonb;
begin
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found or p_to_level<>v_progression.class_level+1 then return '[]'::jsonb; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found or lower(coalesce(v_class.class_key,''))<>'warlock' or upper(coalesce(v_class.source,''))<>'XPHB' then return '[]'::jsonb; end if;
  if not exists(
    select 1 from public.class_feature_catalog f
    where f.class_key='warlock' and f.class_source='XPHB' and f.name='Eldritch Invocations'
      and lower(coalesce(f.description,'')) like '%whenever you gain a warlock level%'
      and lower(coalesce(f.description,'')) like '%replace one of your invocations%'
  ) then return '[]'::jsonb; end if;

  v_expected:=private.xphb_warlock_invocation_count_v1(v_progression.class_level);
  select count(*) into v_actual from public.character_class_option_grant_instances g
  where g.character_id=p_character_id and g.option_type='eldritch-invocation';
  if v_actual<>v_expected then
    raise exception 'This Warlock has % normalized Invocation instance(s), but level % requires %. Resolve current Invocation history before leveling.',v_actual,v_progression.class_level,v_expected;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'key',g.instance_key,'value',g.instance_key,'label',o.name,'source',o.source,'kind','eldritch-invocation-instance','description',coalesce(o.description,''),
    'metadata',jsonb_build_object('instanceKey',g.instance_key,'optionId',o.id,'optionKey',o.option_key,'acquiredLevel',g.acquired_level,'prerequisites',o.prerequisites,'choiceSchema',o.choice_schema)
  ) order by g.instance_key),'[]'::jsonb),
  coalesce(jsonb_agg(to_jsonb(g.instance_key) order by g.instance_key),'[]'::jsonb)
  into v_replace_options,v_replace_keys
  from public.character_class_option_grant_instances g
  join public.class_feature_option_catalog o on o.id=g.option_catalog_id
  where g.character_id=p_character_id and g.option_type='eldritch-invocation'
    and not exists(
      select 1
      from public.character_class_option_grant_instances dependent
      join public.class_feature_option_catalog dep_option on dep_option.id=dependent.option_catalog_id
      cross join lateral jsonb_array_elements_text(coalesce(dep_option.prerequisites->'requiresOptions','[]'::jsonb)) req(value)
      where dependent.character_id=p_character_id and dependent.option_type='eldritch-invocation' and dependent.instance_key<>g.instance_key
        and private.normalize_player_choice_name_v1(req.value)=private.normalize_player_choice_name_v1(o.name)
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'key',o.option_key,'value',o.option_key,'label',o.name,'source',o.source,'kind','eldritch-invocation','description',coalesce(o.description,''),
    'metadata',jsonb_build_object('optionId',o.id,'optionKey',o.option_key,'repeatable',o.repeatable,'prerequisites',o.prerequisites,'choiceSchema',o.choice_schema,'requiresOptions',coalesce(o.prerequisites->'requiresOptions','[]'::jsonb),'uniqueFamily','eldritch-invocation')
  ) order by o.name),'[]'::jsonb)
  into v_with_options
  from public.class_feature_option_catalog o
  where o.option_type='eldritch-invocation' and o.source='XPHB' and lower(coalesce(o.class_key,''))='warlock'
    and coalesce((o.prerequisites->>'minClassLevel')::integer,1)<=p_to_level;

  if jsonb_array_length(v_replace_options)=0 or jsonb_array_length(v_with_options)=0 then return '[]'::jsonb; end if;
  v_fields:=jsonb_build_array(
    jsonb_build_object('id','replace','label','Invocation to replace','kind','eldritch-invocation-instance','count',1,'required',false,'cadence','level-up','replacementCadence','level-up','options',v_replace_options),
    jsonb_build_object('id','with','label','New Invocation','kind','eldritch-invocation','count',1,'required',true,'cadence','level-up','replacementCadence','level-up','options',v_with_options,
      'activeWhen',jsonb_build_object('groupId',v_group_id,'fieldId','replace','values',v_replace_keys))
  );

  for v_option in
    select * from public.class_feature_option_catalog o
    where o.option_type='eldritch-invocation' and o.source='XPHB' and lower(coalesce(o.class_key,''))='warlock'
      and coalesce((o.prerequisites->>'minClassLevel')::integer,1)<=p_to_level
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
      'id',v_child_id,
      'label',v_option.name||case when v_child_kind='origin-feat' then ': Origin feat' else ': affected cantrip' end,
      'kind',case when v_child_kind='origin-feat' then 'feat' else 'spell' end,
      'count',1,'required',true,'cadence','level-up','replacementCadence','level-up','options',v_child_options,
      'activeWhen',jsonb_build_object('groupId',v_group_id,'fieldId','with','values',jsonb_build_array(v_option.option_key)),
      'metadata',jsonb_build_object('invocationOptionKey',v_option.option_key,'choiceKind',v_child_kind,'distinctPerRepeat',coalesce((v_option.choice_schema->>'distinctPerRepeat')::boolean,false))
    ));
  end loop;

  return jsonb_build_array(jsonb_build_object(
    'id',v_group_id,'ownerType','class-option','ownerKey',v_group_id,'label','Replace an Eldritch Invocation',
    'source','XPHB','placement','class','level',p_to_level,
    'helper','Optional: when you gain a Warlock level, replace one Invocation with another for which you qualify. An Invocation used as a prerequisite by another current Invocation cannot be replaced.',
    'fields',v_fields,
    'metadata',jsonb_build_object('family','eldritch-invocation-replacement','replacementCadence','level-up')
  ));
end;
$$;

create or replace function public.get_character_level_class_choice_options_v2(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_base jsonb;
  v_progression public.character_progression%rowtype;
  v_extra jsonb:='[]'::jsonb;
  v_replacement jsonb:='[]'::jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to review these class choices.' using errcode='42501'; end if;
  v_base:=public.get_character_level_class_choice_options_v1(p_character_id);
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found or v_progression.class_level>=20 then return v_base; end if;
  v_extra:=private.level_up_warlock_invocation_groups_v1(p_character_id,v_progression.class_level+1);
  v_replacement:=private.level_up_warlock_invocation_replacement_group_v1(p_character_id,v_progression.class_level+1);
  return jsonb_set(coalesce(v_base,'{}'::jsonb),'{groups}',coalesce(v_base->'groups','[]'::jsonb)||coalesce(v_extra,'[]'::jsonb)||coalesce(v_replacement,'[]'::jsonb),true);
end;
$$;

create or replace function private.apply_level_up_warlock_invocation_replacement_v1(
  p_character_id uuid,
  p_to_level integer,
  p_group jsonb,
  p_all_class_selections jsonb,
  p_feat_instances jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_groups jsonb:=private.level_up_warlock_invocation_replacement_group_v1(p_character_id,p_to_level);
  v_replace jsonb:=coalesce(p_group->'replace','[]'::jsonb);
  v_with jsonb:=coalesce(p_group->'with','[]'::jsonb);
  v_target_key text;
  v_new_key text;
  v_target public.character_class_option_grant_instances%rowtype;
  v_old public.class_feature_option_catalog%rowtype;
  v_new public.class_feature_option_catalog%rowtype;
  v_requirement text;
  v_available_names text[]:='{}'::text[];
  v_pending_group text;
  v_pending_key text;
  v_pending_name text;
  v_child_kind text;
  v_child_id text;
  v_child_values jsonb:='[]'::jsonb;
  v_child_key text;
  v_child_choice jsonb;
  v_spell public.spells_catalog%rowtype;
  v_spell_id uuid;
  v_feat_id uuid;
  v_feat_instance jsonb;
  v_feat_result jsonb;
  v_removed_feat jsonb;
  v_old_feat_instance_key text;
  v_source_group jsonb;
  v_fields jsonb;
  v_sheet jsonb:='{}'::jsonb;
  v_summary jsonb;
  v_names jsonb='[]'::jsonb;
  v_existing_summary jsonb='[]'::jsonb;
begin
  if jsonb_typeof(coalesce(p_group,'{}'::jsonb))<>'object' then raise exception 'Invocation replacement selections must be an object.'; end if;
  if jsonb_array_length(v_replace)=0 then
    if exists(select 1 from jsonb_each(coalesce(p_group,'{}'::jsonb)) e where e.key<>'replace' and jsonb_typeof(e.value)='array' and jsonb_array_length(e.value)>0) then
      raise exception 'Choose the Invocation being replaced first.';
    end if;
    return '[]'::jsonb;
  end if;
  if jsonb_array_length(v_groups)=0 then raise exception 'Invocation replacement is not available on this level-up.'; end if;
  if jsonb_array_length(v_replace)<>1 or jsonb_array_length(v_with)<>1 then raise exception 'Invocation replacement requires exactly one old Invocation and one new Invocation.'; end if;

  v_target_key:=v_replace->>0;
  v_new_key:=v_with->>0;
  if not exists(select 1 from jsonb_array_elements(v_groups#>'{0,fields,0,options}') o where o->>'key'=v_target_key) then
    raise exception 'The selected Invocation cannot be replaced on this level-up.';
  end if;
  if not exists(select 1 from jsonb_array_elements(v_groups#>'{0,fields,1,options}') o where o->>'key'=v_new_key) then
    raise exception 'The replacement Invocation is not source-legal.';
  end if;

  select * into v_target from public.character_class_option_grant_instances g
  where g.character_id=p_character_id and g.instance_key=v_target_key and g.option_type='eldritch-invocation' for update;
  if not found then raise exception 'The Invocation instance being replaced is missing.'; end if;
  select * into v_old from public.class_feature_option_catalog where id=v_target.option_catalog_id;
  select * into v_new from public.class_feature_option_catalog
  where option_key=v_new_key and option_type='eldritch-invocation' and source='XPHB' and lower(coalesce(class_key,''))='warlock';
  if not found then raise exception 'The replacement Invocation is unavailable.'; end if;
  if v_new.id=v_old.id then raise exception 'Choose a different Invocation to replace %.',v_old.name; end if;
  if coalesce((v_new.prerequisites->>'minClassLevel')::integer,1)>p_to_level then raise exception '% is not available at Warlock level %.',v_new.name,p_to_level; end if;

  if exists(
    select 1
    from public.character_class_option_grant_instances dependent
    join public.class_feature_option_catalog dep_option on dep_option.id=dependent.option_catalog_id
    cross join lateral jsonb_array_elements_text(coalesce(dep_option.prerequisites->'requiresOptions','[]'::jsonb)) req(value)
    where dependent.character_id=p_character_id and dependent.option_type='eldritch-invocation' and dependent.instance_key<>v_target_key
      and private.normalize_player_choice_name_v1(req.value)=private.normalize_player_choice_name_v1(v_old.name)
  ) then raise exception '% cannot be replaced because another current Invocation requires it.',v_old.name; end if;

  if not v_new.repeatable and exists(
    select 1 from public.character_class_option_grant_instances g
    join public.class_feature_option_catalog o on o.id=g.option_catalog_id
    where g.character_id=p_character_id and g.option_type='eldritch-invocation' and g.instance_key<>v_target_key
      and private.normalize_player_choice_name_v1(o.name)=private.normalize_player_choice_name_v1(v_new.name)
  ) then raise exception '% is not repeatable and is already known.',v_new.name; end if;

  select coalesce(array_agg(private.normalize_player_choice_name_v1(o.name)),'{}'::text[])
  into v_available_names
  from public.character_class_option_grant_instances g
  join public.class_feature_option_catalog o on o.id=g.option_catalog_id
  where g.character_id=p_character_id and g.option_type='eldritch-invocation' and g.instance_key<>v_target_key;

  for v_pending_group in select key from jsonb_each(coalesce(p_all_class_selections,'{}'::jsonb)) where key like 'warlock-invocation-slot-%'
  loop
    if jsonb_array_length(coalesce(p_all_class_selections#>array[v_pending_group,'invocation'],'[]'::jsonb))=1 then
      v_pending_key:=p_all_class_selections#>array[v_pending_group,'invocation']->>0;
      select name into v_pending_name from public.class_feature_option_catalog
      where option_key=v_pending_key and option_type='eldritch-invocation' and source='XPHB' and lower(coalesce(class_key,''))='warlock';
      if found then v_available_names:=array_append(v_available_names,private.normalize_player_choice_name_v1(v_pending_name)); end if;
    end if;
  end loop;

  for v_requirement in select value from jsonb_array_elements_text(coalesce(v_new.prerequisites->'requiresOptions','[]'::jsonb))
  loop
    if not(private.normalize_player_choice_name_v1(v_requirement)=any(v_available_names)) then
      raise exception '% requires % to be known on the completed level.',v_new.name,v_requirement;
    end if;
  end loop;

  v_child_kind:=coalesce(v_new.choice_schema->>'kind','');
  v_child_choice:=null;
  v_feat_result:=null;
  if v_child_kind in ('warlock-damage-cantrip','warlock-attack-cantrip','origin-feat') then
    v_child_id:='child-'||trim(both '-' from regexp_replace(lower(v_new.name),'[^a-z0-9]+','-','g'));
    v_child_values:=coalesce(p_group->v_child_id,'[]'::jsonb);
    if jsonb_array_length(v_child_values)<>1 then raise exception '% requires exactly one dependent source choice.',v_new.name; end if;
    v_child_key:=v_child_values->>0;
    if v_child_kind in ('warlock-damage-cantrip','warlock-attack-cantrip') then
      begin v_spell_id:=v_child_key::uuid; exception when others then raise exception '% requires a valid cantrip id.',v_new.name; end;
      select * into v_spell from public.spells_catalog s where s.id=v_spell_id and public.is_preferred_spell_version_v1(s.id);
      if not found or v_spell.level<>0
         or not exists(select 1 from unnest(coalesce(v_spell.classes,'{}'::text[])) c where lower(c)='warlock')
         or (coalesce(array_length(v_spell.damage_types,1),0)=0 and coalesce(v_spell.damage_dice,'')='') then
        raise exception '% requires a preferred Warlock damage cantrip.',v_new.name;
      end if;
      if v_child_kind='warlock-attack-cantrip' and coalesce(btrim(v_spell.attack_type),'')='' then raise exception '% requires an attack-roll cantrip.',v_new.name; end if;
      if coalesce((v_new.choice_schema->>'minRangeFeet')::integer,0)>0 and not(
        (lower(coalesce(v_spell.range_unit,'')) in ('feet','foot','ft') and coalesce(v_spell.range_distance,0)>=(v_new.choice_schema->>'minRangeFeet')::integer)
        or (lower(coalesce(v_spell.range_unit,'')) in ('mile','miles') and coalesce(v_spell.range_distance,0)>0)
      ) then raise exception '% requires a cantrip with sufficient range.',v_new.name; end if;
      if coalesce((v_new.choice_schema->>'distinctPerRepeat')::boolean,false) and exists(
        select 1 from public.character_class_option_grant_instances g
        where g.character_id=p_character_id and g.option_type='eldritch-invocation' and g.instance_key<>v_target_key
          and g.option_catalog_id=v_new.id
          and coalesce(g.choices#>>'{child,value}',g.choices#>>'{child,key}','')=v_spell.id::text
      ) then raise exception 'Repeated % instances must use different dependent choices.',v_new.name; end if;
      v_child_choice:=jsonb_build_object('key',v_spell.id::text,'value',v_spell.id::text,'label',v_spell.name,'source',v_spell.source,'kind','spell','metadata',jsonb_build_object('spellId',v_spell.id,'spellKey',v_spell.spell_key));
    else
      begin v_feat_id:=v_child_key::uuid; exception when others then raise exception 'Lessons of the First Ones requires a valid Origin feat id.'; end;
      if not exists(select 1 from public.character_option_catalog_preferred f where f.id=v_feat_id and f.option_type='feat' and f.category=coalesce(v_new.choice_schema->>'category','O')) then
        raise exception 'Lessons of the First Ones requires a source-valid Origin feat.';
      end if;
      if coalesce((v_new.choice_schema->>'distinctPerRepeat')::boolean,false) and exists(
        select 1 from public.character_class_option_grant_instances g
        where g.character_id=p_character_id and g.option_type='eldritch-invocation' and g.instance_key<>v_target_key
          and g.option_catalog_id=v_new.id
          and coalesce(g.choices#>>'{child,value}',g.choices#>>'{child,key}','')=v_feat_id::text
      ) then raise exception 'Repeated % instances must use different dependent choices.',v_new.name; end if;
      select entry.value into v_feat_instance
      from jsonb_array_elements(coalesce(p_feat_instances,'[]'::jsonb)) entry(value)
      where entry.value->>'acquisitionOwnerKey'='warlock-invocation-replacement'
        and entry.value->>'optionId'=v_feat_id::text
      limit 1;
      if v_feat_instance is null then raise exception 'Lessons of the First Ones requires its nested Origin feat choices to be complete.'; end if;
      v_child_choice:=jsonb_build_object('key',v_feat_id::text,'value',v_feat_id::text,'label',coalesce(v_feat_instance->>'name','Origin feat'),'source',coalesce(v_feat_instance->>'source','XPHB'),'kind','feat','metadata',jsonb_build_object('optionId',v_feat_id));
    end if;
  else
    if exists(select 1 from jsonb_each(coalesce(p_group,'{}'::jsonb)) e where e.key not in ('replace','with') and jsonb_typeof(e.value)='array' and jsonb_array_length(e.value)>0) then
      raise exception '% does not accept a permanent dependent source choice.',v_new.name;
    end if;
  end if;

  if coalesce(v_old.choice_schema->>'kind','')='origin-feat' then
    select gi.instance_key into v_old_feat_instance_key
    from public.character_option_grant_instances gi
    where gi.character_id=p_character_id
      and gi.acquisition_owner_type='class-option'
      and gi.acquisition_owner_key=v_target_key
      and gi.option_id=(coalesce(v_target.choices#>>'{child,value}',v_target.choices#>>'{child,key}'))::uuid
    limit 1;
    if v_old_feat_instance_key is null then raise exception 'The Invocation being replaced is missing its owned Origin feat authority.'; end if;
    v_removed_feat:=private.remove_source_owned_origin_feat_v1(p_character_id,v_old_feat_instance_key,'class-option',v_target_key);
  elsif exists(
    select 1 from public.character_option_grant_instances gi
    where gi.character_id=p_character_id and gi.acquisition_owner_type='class-option' and gi.acquisition_owner_key=v_target_key
  ) then
    raise exception 'The Invocation being replaced has unexpected owned feat state.';
  end if;

  if v_child_kind='origin-feat' then
    v_feat_result:=private.apply_source_owned_origin_feat_v1(
      p_character_id,p_to_level,v_feat_id,v_feat_instance,
      'invocation-'||v_target_key||'-origin-feat','class-option',v_target_key
    );
    v_child_choice:=jsonb_build_object('key',v_feat_id::text,'value',v_feat_id::text,'label',v_feat_result->>'name','source',v_feat_result->>'source','kind','feat','metadata',jsonb_build_object('optionId',v_feat_id));
  end if;

  update public.character_class_option_grant_instances
  set option_catalog_id=v_new.id,
      choices=case when v_child_choice is null then '{}'::jsonb else jsonb_build_object('child',v_child_choice) end,
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('lastReplacementLevel',p_to_level,'previousOptionKey',v_old.option_key,'replacementSource','level-up'),
      updated_at=now()
  where id=v_target.id;

  v_fields:=jsonb_build_object(
    'invocation',jsonb_build_object('label','Current Invocation','kind','eldritch-invocation','count',1,'required',true,'cadence','level-up','replacementCadence','level-up',
      'selections',jsonb_build_array(jsonb_build_object('key',v_new.option_key,'value',v_new.option_key,'label',v_new.name,'source',v_new.source,'kind','eldritch-invocation')))
  );
  if v_child_choice is not null then
    v_child_id:='child-'||trim(both '-' from regexp_replace(lower(v_new.name),'[^a-z0-9]+','-','g'));
    v_fields:=jsonb_set(v_fields,array[v_child_id],jsonb_build_object(
      'label',v_new.name||case when v_child_kind='origin-feat' then ': Origin feat' else ': affected cantrip' end,
      'kind',case when v_child_kind='origin-feat' then 'feat' else 'spell' end,'count',1,'required',true,'cadence','level-up',
      'activeWhen',jsonb_build_object('groupId',v_target_key,'fieldId','invocation','values',jsonb_build_array(v_new.option_key)),
      'selections',jsonb_build_array(v_child_choice)
    ),true);
  end if;
  v_source_group:=jsonb_build_object(
    'ownerType','class-option','ownerKey',v_target_key,'label','Eldritch Invocation','source','XPHB','placement','class','level',v_target.acquired_level,
    'metadata',coalesce(v_target.metadata,'{}'::jsonb)||jsonb_build_object('family','eldritch-invocation','acquisitionLevel',v_target.acquired_level,'lastReplacementLevel',p_to_level),
    'fields',v_fields
  );

  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  v_sheet:=jsonb_set(v_sheet,array['sourceChoices',v_target_key],v_source_group,true);
  select coalesce(jsonb_agg(entry.value order by entry.ord),'[]'::jsonb) into v_existing_summary
  from jsonb_array_elements(case when jsonb_typeof(v_sheet->'sourceChoiceSummary')='array' then v_sheet->'sourceChoiceSummary' else '[]'::jsonb end) with ordinality entry(value,ord)
  where entry.value->>'groupId'<>v_target_key;

  v_summary:=jsonb_build_object(
    'family','eldritch-invocation','groupId',v_target_key,'level',p_to_level,'replaced',v_old.name,'with',v_new.name,'source','XPHB',
    'child',v_child_choice,'removedFeat',v_removed_feat,'featInstance',v_feat_result
  );
  v_sheet:=jsonb_set(v_sheet,'{sourceChoiceSummary}',v_existing_summary||jsonb_build_array(v_summary),true);
  select coalesce(jsonb_agg(o.name order by g.instance_key),'[]'::jsonb) into v_names
  from public.character_class_option_grant_instances g
  join public.class_feature_option_catalog o on o.id=g.option_catalog_id
  where g.character_id=p_character_id and g.option_type='eldritch-invocation';
  v_sheet:=jsonb_set(v_sheet,'{eldritchInvocations}',v_names,true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now()
  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);

  return jsonb_build_array(v_summary);
end;
$$;

create or replace function public.complete_character_level_up_v5(p_character_id uuid,p_selections jsonb)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_input jsonb:=coalesce(p_selections,'{}'::jsonb);
  v_progression public.character_progression%rowtype;
  v_to integer;
  v_replacements jsonb:=coalesce(v_input->'replacement_selections','{}'::jsonb);
  v_all_class jsonb:=coalesce(v_input->'class_choice_selections','{}'::jsonb);
  v_invocation_replacement jsonb:=coalesce(v_all_class->'warlock-invocation-replacement','{}'::jsonb);
  v_forward_class jsonb:=v_all_class-'warlock-invocation-replacement';
  v_feat_instances jsonb:=coalesce(v_input->'class_option_feat_instances','[]'::jsonb);
  v_invocation_summary jsonb:='[]'::jsonb;
  v_standard_summary jsonb:='[]'::jsonb;
  v_summary jsonb:='[]'::jsonb;
  v_result jsonb;
  v_forward_input jsonb;
  v_level_choice jsonb:='{}'::jsonb;
  v_session_id uuid;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to level this character.' using errcode='42501'; end if;
  if jsonb_typeof(v_input)<>'object' or jsonb_typeof(v_replacements)<>'object' or jsonb_typeof(v_all_class)<>'object' or jsonb_typeof(v_feat_instances)<>'array' then
    raise exception 'Level-up selections, class choices, replacement selections, and class-option feat instances have an invalid shape.';
  end if;
  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if not found or v_progression.class_level>=20 then raise exception 'Character progression is unavailable for another level.'; end if;
  v_to:=v_progression.class_level+1;

  v_invocation_summary:=private.apply_level_up_warlock_invocation_replacement_v1(
    p_character_id,v_to,v_invocation_replacement,v_all_class,v_feat_instances
  );
  v_standard_summary:=private.apply_level_up_replacements_v1(p_character_id,v_to,v_replacements);
  v_summary:=coalesce(v_invocation_summary,'[]'::jsonb)||coalesce(v_standard_summary,'[]'::jsonb);

  v_forward_input:=jsonb_set(v_input,'{class_choice_selections}',v_forward_class,true);
  v_result:=public.complete_character_level_up_v4(p_character_id,v_forward_input-'replacement_selections');

  if jsonb_array_length(v_summary)>0 then
    select coalesce(level_choices->v_to::text,'{}'::jsonb) into v_level_choice from public.character_progression where character_id=p_character_id;
    v_level_choice:=v_level_choice||jsonb_build_object('replacements',v_summary);
    update public.character_progression
    set level_choices=jsonb_set(coalesce(level_choices,'{}'::jsonb),array[v_to::text],v_level_choice,true),updated_at=now()
    where character_id=p_character_id;

    select id into v_session_id from public.character_level_up_sessions
    where character_id=p_character_id and to_level=v_to and status='completed'
    order by completed_at desc limit 1;
    if v_session_id is not null then
      update public.character_level_up_sessions
      set selections=coalesce(selections,'{}'::jsonb)||jsonb_build_object(
        'replacement_selections',v_replacements,
        'invocation_replacement_selection',v_invocation_replacement,
        'replacements',v_summary
      ),updated_at=now()
      where id=v_session_id;
    end if;

    update public.character_level_events
    set details=coalesce(details,'{}'::jsonb)||jsonb_build_object('replacements',v_summary)
    where id=(select id from public.character_level_events where character_id=p_character_id and event_type='level_up_completed' and to_level=v_to order by created_at desc limit 1);
  end if;

  return coalesce(v_result,'{}'::jsonb)||jsonb_build_object('replacements',v_summary,'progression',public.get_character_progression_v1(p_character_id));
end;
$$;

revoke all on function private.validate_existing_normalized_warlock_invocations_v2() from public,anon,authenticated;
revoke all on function private.level_up_warlock_invocation_replacement_group_v1(uuid,integer) from public,anon,authenticated;
revoke all on function private.apply_level_up_warlock_invocation_replacement_v1(uuid,integer,jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.complete_character_level_up_v5(uuid,jsonb) from public,anon;
grant execute on function private.validate_existing_normalized_warlock_invocations_v2() to service_role;
grant execute on function private.level_up_warlock_invocation_replacement_group_v1(uuid,integer) to service_role;
grant execute on function private.apply_level_up_warlock_invocation_replacement_v1(uuid,integer,jsonb,jsonb,jsonb) to service_role;
grant execute on function public.complete_character_level_up_v5(uuid,jsonb) to authenticated,service_role;
