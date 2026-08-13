-- Shared normalized Battle Master maneuver authority for higher-level Forge and earned progression.

create or replace function private.battle_master_maneuver_slot_level_v1(p_slot integer)
returns integer
language sql
immutable
set search_path=pg_catalog
as $$
  select case greatest(1,least(9,coalesce(p_slot,1)))
    when 1 then 3 when 2 then 3 when 3 then 3
    when 4 then 7 when 5 then 7
    when 6 then 10 when 7 then 10
    when 8 then 15 when 9 then 15 end;
$$;

create or replace function private.is_xphb_battle_master_v1(p_class_id uuid,p_subclass_name text,p_subclass_source text)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $$
  select exists(
    select 1 from public.class_catalog c
    where c.id=p_class_id and lower(coalesce(c.class_key,''))='fighter' and upper(coalesce(c.source,''))='XPHB'
  )
  and private.normalize_player_choice_name_v1(coalesce(p_subclass_name,''))=private.normalize_player_choice_name_v1('Battle Master')
  and upper(coalesce(nullif(p_subclass_source,''),'XPHB'))='XPHB';
$$;

create or replace function private.materialize_player_forge_battle_master_maneuvers_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_sheet jsonb:='{}'::jsonb;
  v_expected integer:=0;
  v_selected jsonb:='[]'::jsonb;
  v_names text[]:='{}'::text[];
  v_choice jsonb;
  v_name text;
  v_option public.class_feature_option_catalog%rowtype;
  v_slot integer:=0;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=new.character_id;
  if coalesce(v_sheet#>>'{meta,creator}','')<>'shared_character_forge_player_v2' then return new; end if;

  if not private.is_xphb_battle_master_v1(new.class_id,new.subclass_name,new.subclass_source) then return new; end if;
  v_expected:=private.battle_master_maneuver_count_v1(new.class_level);
  if v_expected<=0 then raise exception 'Battle Master requires Fighter level 3 or higher.'; end if;

  select coalesce(jsonb_agg(sel.value order by grp.key,sel.ord),'[]'::jsonb)
  into v_selected
  from jsonb_each(case when jsonb_typeof(v_sheet->'classFeatureChoices')='object' then v_sheet->'classFeatureChoices' else '{}'::jsonb end) grp
  cross join lateral jsonb_array_elements(case when jsonb_typeof(grp.value->'selections')='array' then grp.value->'selections' else '[]'::jsonb end) with ordinality sel(value,ord)
  where grp.value->>'kind'='battle-master-maneuver'
    and private.normalize_player_choice_name_v1(coalesce(grp.value->>'subclassName','Battle Master'))=private.normalize_player_choice_name_v1('Battle Master');

  if jsonb_array_length(v_selected)<>v_expected then
    raise exception 'Battle Master Fighter level % requires exactly % maneuver choice(s); received %.',new.class_level,v_expected,jsonb_array_length(v_selected);
  end if;

  for v_choice in select value from jsonb_array_elements(v_selected) loop
    v_name:=coalesce(nullif(v_choice->>'name',''),nullif(v_choice->>'label',''),nullif(v_choice->>'value',''),v_choice->>'key','');
    select * into v_option from public.class_feature_option_catalog o
    where o.option_type='battle-master-maneuver' and o.source='XPHB' and lower(coalesce(o.class_key,''))='fighter'
      and private.normalize_player_choice_name_v1(o.name)=private.normalize_player_choice_name_v1(v_name)
    limit 1;
    if not found then raise exception 'Battle Master contains an unknown maneuver choice: %.',v_name; end if;
    if private.normalize_player_choice_name_v1(v_option.name)=any(v_names) then raise exception 'Battle Master maneuver choices must be distinct.'; end if;
    v_names:=array_append(v_names,private.normalize_player_choice_name_v1(v_option.name));
    v_slot:=v_slot+1;
    insert into public.character_class_option_grant_instances(
      character_id,instance_key,option_catalog_id,option_type,acquired_level,choices,metadata,updated_at
    ) values(
      new.character_id,'battle-master-maneuver-slot-'||v_slot::text,v_option.id,'battle-master-maneuver',
      private.battle_master_maneuver_slot_level_v1(v_slot),'{}'::jsonb,
      jsonb_build_object('source','player-forge','family','battle-master-maneuver','slot',v_slot),now()
    );
  end loop;
  return new;
end;
$$;

create or replace function private.validate_existing_battle_master_maneuvers_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_expected integer:=0;
  v_actual integer:=0;
  v_battle_master boolean:=false;
  v_distinct integer:=0;
begin
  v_battle_master:=private.is_xphb_battle_master_v1(new.class_id,new.subclass_name,new.subclass_source);
  select count(*) into v_actual from public.character_class_option_grant_instances g
  where g.character_id=new.character_id and g.option_type='battle-master-maneuver';

  if not v_battle_master then
    if v_actual>0 then raise exception 'A non-Battle-Master progression cannot retain normalized Battle Master maneuver instances.'; end if;
    return new;
  end if;

  v_expected:=private.battle_master_maneuver_count_v1(new.class_level);
  if v_actual<>v_expected then
    raise exception 'Battle Master Fighter level % requires % normalized maneuver instance(s); found %.',new.class_level,v_expected,v_actual;
  end if;
  select count(distinct g.option_catalog_id) into v_distinct
  from public.character_class_option_grant_instances g
  join public.class_feature_option_catalog o on o.id=g.option_catalog_id
  where g.character_id=new.character_id and g.option_type='battle-master-maneuver'
    and o.option_type='battle-master-maneuver' and o.source='XPHB' and lower(coalesce(o.class_key,''))='fighter';
  if v_distinct<>v_expected then raise exception 'Battle Master maneuver instances must be distinct canonical XPHB maneuvers.'; end if;
  return new;
end;
$$;

drop trigger if exists character_progression_materialize_battle_master_maneuvers_v1 on public.character_progression;
create constraint trigger character_progression_materialize_battle_master_maneuvers_v1
after insert on public.character_progression
deferrable initially deferred
for each row execute function private.materialize_player_forge_battle_master_maneuvers_v1();

drop trigger if exists character_progression_validate_battle_master_maneuvers_v1 on public.character_progression;
create constraint trigger character_progression_validate_battle_master_maneuvers_v1
after update of class_id,subclass_name,subclass_source,class_level,level_choices on public.character_progression
deferrable initially deferred
for each row execute function private.validate_existing_battle_master_maneuvers_v1();

create or replace function private.level_up_battle_master_maneuver_group_v1(p_character_id uuid,p_to_level integer)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_current_bm boolean:=false;
  v_entry_candidate boolean:=false;
  v_before integer:=0;
  v_after integer:=0;
  v_delta integer:=0;
  v_actual integer:=0;
  v_known_names text[]:='{}'::text[];
  v_new_options jsonb:='[]'::jsonb;
  v_replace_options jsonb:='[]'::jsonb;
  v_replace_keys jsonb:='[]'::jsonb;
  v_fields jsonb:='[]'::jsonb;
  v_required boolean:=true;
begin
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found or p_to_level<>v_progression.class_level+1 then return '[]'::jsonb; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found or lower(coalesce(v_class.class_key,''))<>'fighter' or upper(coalesce(v_class.source,''))<>'XPHB' then return '[]'::jsonb; end if;

  v_current_bm:=private.normalize_player_choice_name_v1(coalesce(v_progression.subclass_name,''))=private.normalize_player_choice_name_v1('Battle Master');
  v_entry_candidate:=p_to_level=3 and coalesce(btrim(v_progression.subclass_name),'')='';
  if not v_current_bm and not v_entry_candidate then return '[]'::jsonb; end if;

  v_before:=case when v_current_bm then private.battle_master_maneuver_count_v1(v_progression.class_level) else 0 end;
  v_after:=private.battle_master_maneuver_count_v1(p_to_level);
  v_delta:=v_after-v_before;
  if v_delta<=0 then return '[]'::jsonb; end if;

  select count(*) into v_actual from public.character_class_option_grant_instances g
  where g.character_id=p_character_id and g.option_type='battle-master-maneuver';
  if v_actual<>v_before then
    raise exception 'This Battle Master has % normalized maneuver instance(s), but Fighter level % requires %. Resolve maneuver history before leveling.',v_actual,v_progression.class_level,v_before;
  end if;

  select coalesce(array_agg(private.normalize_player_choice_name_v1(o.name)),'{}'::text[])
  into v_known_names
  from public.character_class_option_grant_instances g
  join public.class_feature_option_catalog o on o.id=g.option_catalog_id
  where g.character_id=p_character_id and g.option_type='battle-master-maneuver';

  select coalesce(jsonb_agg(jsonb_build_object(
    'key',o.option_key,'value',o.option_key,'label',o.name,'source',o.source,'kind','battle-master-maneuver',
    'metadata',jsonb_build_object('optionId',o.id,'optionKey',o.option_key,'uniqueFamily','battle-master-maneuver')
  ) order by o.name),'[]'::jsonb)
  into v_new_options
  from public.class_feature_option_catalog o
  where o.option_type='battle-master-maneuver' and o.source='XPHB' and lower(coalesce(o.class_key,''))='fighter'
    and not(private.normalize_player_choice_name_v1(o.name)=any(v_known_names));

  v_required:=not v_entry_candidate;
  v_fields:=jsonb_build_array(jsonb_build_object(
    'id','maneuvers','label',case when v_entry_candidate then 'Battle Master only — choose 3 maneuvers' else 'New Battle Master maneuvers' end,
    'kind','battle-master-maneuver','count',v_delta,'required',v_required,'cadence','level-up','replacementCadence','level-up',
    'options',v_new_options,
    'helper',case when v_entry_candidate then 'Fill this only if you select Battle Master as your Fighter subclass.' else 'Choose the new maneuvers learned at this Fighter level.' end
  ));

  if v_current_bm and v_before>0 then
    select coalesce(jsonb_agg(jsonb_build_object(
      'key',g.instance_key,'value',g.instance_key,'label',o.name,'source',o.source,'kind','battle-master-maneuver-instance',
      'metadata',jsonb_build_object('instanceKey',g.instance_key,'optionId',o.id,'optionKey',o.option_key,'acquiredLevel',g.acquired_level)
    ) order by g.instance_key),'[]'::jsonb),
    coalesce(jsonb_agg(to_jsonb(g.instance_key) order by g.instance_key),'[]'::jsonb)
    into v_replace_options,v_replace_keys
    from public.character_class_option_grant_instances g
    join public.class_feature_option_catalog o on o.id=g.option_catalog_id
    where g.character_id=p_character_id and g.option_type='battle-master-maneuver';

    v_fields:=v_fields||jsonb_build_array(
      jsonb_build_object('id','replace','label','Maneuver to replace','kind','battle-master-maneuver-instance','count',1,'required',false,'cadence','level-up','replacementCadence','level-up','options',v_replace_options),
      jsonb_build_object('id','with','label','Replacement maneuver','kind','battle-master-maneuver','count',1,'required',true,'cadence','level-up','replacementCadence','level-up','options',v_new_options,
        'activeWhen',jsonb_build_object('groupId','fighter-battle-master-maneuvers','fieldId','replace','values',v_replace_keys),
        'distinctFromFieldId','maneuvers')
    );
  end if;

  return jsonb_build_array(jsonb_build_object(
    'id','fighter-battle-master-maneuvers','ownerType','class-option','ownerKey','fighter-battle-master-maneuvers',
    'label',case when v_entry_candidate then 'Battle Master Combat Superiority' else 'Battle Master maneuver training' end,
    'source','XPHB','placement','class','level',p_to_level,
    'helper',case when v_entry_candidate then 'These choices apply only when Battle Master is the subclass selected for level 3.' else 'Learn two new maneuvers; you may also replace one maneuver you already know.' end,
    'metadata',jsonb_build_object('family','battle-master-maneuver','conditionalSubclass',case when v_entry_candidate then 'Battle Master' else null end,'replacementCadence','level-up','delta',v_delta),
    'fields',v_fields
  ));
end;
$$;

create or replace function private.apply_level_up_battle_master_maneuvers_v1(
  p_character_id uuid,
  p_to_level integer,
  p_group jsonb,
  p_selected_subclass text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_effective_subclass text;
  v_current_bm boolean:=false;
  v_effective_bm boolean:=false;
  v_before integer:=0;
  v_after integer:=0;
  v_delta integer:=0;
  v_actual integer:=0;
  v_new jsonb:=coalesce(p_group->'maneuvers','[]'::jsonb);
  v_replace jsonb:=coalesce(p_group->'replace','[]'::jsonb);
  v_with jsonb:=coalesce(p_group->'with','[]'::jsonb);
  v_keys text[]:='{}'::text[];
  v_key text;
  v_option public.class_feature_option_catalog%rowtype;
  v_replace_key text;
  v_replace_row public.character_class_option_grant_instances%rowtype;
  v_old public.class_feature_option_catalog%rowtype;
  v_slot integer;
  v_sheet jsonb:='{}'::jsonb;
  v_choices jsonb:='{}'::jsonb;
  v_group_key text;
  v_serialized jsonb:='[]'::jsonb;
  v_summary jsonb:='[]'::jsonb;
begin
  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if not found then raise exception 'Character progression has not been initialized.'; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found or lower(coalesce(v_class.class_key,''))<>'fighter' or upper(coalesce(v_class.source,''))<>'XPHB' then
    if exists(select 1 from jsonb_each(coalesce(p_group,'{}'::jsonb)) e where jsonb_typeof(e.value)='array' and jsonb_array_length(e.value)>0) then raise exception 'Battle Master maneuver selections are only valid for an XPHB Fighter.'; end if;
    return '[]'::jsonb;
  end if;

  v_current_bm:=private.normalize_player_choice_name_v1(coalesce(v_progression.subclass_name,''))=private.normalize_player_choice_name_v1('Battle Master');
  v_effective_subclass:=coalesce(nullif(btrim(p_selected_subclass),''),v_progression.subclass_name,'');
  v_effective_bm:=private.normalize_player_choice_name_v1(v_effective_subclass)=private.normalize_player_choice_name_v1('Battle Master');

  if not v_effective_bm then
    if exists(select 1 from jsonb_each(coalesce(p_group,'{}'::jsonb)) e where jsonb_typeof(e.value)='array' and jsonb_array_length(e.value)>0) then raise exception 'Battle Master maneuver choices were supplied, but Battle Master is not the selected subclass.'; end if;
    return '[]'::jsonb;
  end if;

  v_before:=case when v_current_bm then private.battle_master_maneuver_count_v1(v_progression.class_level) else 0 end;
  v_after:=private.battle_master_maneuver_count_v1(p_to_level);
  v_delta:=v_after-v_before;
  if v_delta<=0 then
    if jsonb_array_length(v_new)>0 or jsonb_array_length(v_replace)>0 or jsonb_array_length(v_with)>0 then raise exception 'This Fighter level does not change Battle Master maneuvers.'; end if;
    return '[]'::jsonb;
  end if;

  select count(*) into v_actual from public.character_class_option_grant_instances g where g.character_id=p_character_id and g.option_type='battle-master-maneuver';
  if v_actual<>v_before then raise exception 'This Battle Master has % normalized maneuver instance(s), but the current level requires %.',v_actual,v_before; end if;
  if jsonb_typeof(v_new)<>'array' or jsonb_array_length(v_new)<>v_delta then raise exception 'Battle Master requires exactly % new maneuver choice(s) at Fighter level %.',v_delta,p_to_level; end if;
  if (select count(distinct value) from jsonb_array_elements_text(v_new))<>v_delta then raise exception 'New Battle Master maneuvers must be distinct.'; end if;

  for v_key in select value from jsonb_array_elements_text(v_new) loop
    select * into v_option from public.class_feature_option_catalog o where o.option_key=v_key and o.option_type='battle-master-maneuver' and o.source='XPHB' and lower(coalesce(o.class_key,''))='fighter';
    if not found then raise exception 'A selected Battle Master maneuver is not source-legal.'; end if;
    if exists(select 1 from public.character_class_option_grant_instances g where g.character_id=p_character_id and g.option_type='battle-master-maneuver' and g.option_catalog_id=v_option.id) then raise exception '% is already known.',v_option.name; end if;
    v_keys:=array_append(v_keys,v_key);
  end loop;

  if jsonb_array_length(v_replace)=0 then
    if jsonb_array_length(v_with)>0 then raise exception 'Choose the maneuver being replaced first.'; end if;
  else
    if not v_current_bm or v_before<=0 then raise exception 'Maneuver replacement is only available when learning additional Battle Master maneuvers.'; end if;
    if jsonb_array_length(v_replace)<>1 or jsonb_array_length(v_with)<>1 then raise exception 'Maneuver replacement requires exactly one old maneuver and one replacement maneuver.'; end if;
    v_replace_key:=v_replace->>0;
    select * into v_replace_row from public.character_class_option_grant_instances g where g.character_id=p_character_id and g.instance_key=v_replace_key and g.option_type='battle-master-maneuver' for update;
    if not found then raise exception 'The maneuver being replaced is not currently known.'; end if;
    select * into v_old from public.class_feature_option_catalog where id=v_replace_row.option_catalog_id;
    v_key:=v_with->>0;
    if v_key=any(v_keys) then raise exception 'The replacement maneuver must be different from the newly learned maneuvers.'; end if;
    select * into v_option from public.class_feature_option_catalog o where o.option_key=v_key and o.option_type='battle-master-maneuver' and o.source='XPHB' and lower(coalesce(o.class_key,''))='fighter';
    if not found then raise exception 'The replacement maneuver is not source-legal.'; end if;
    if v_option.id=v_old.id then raise exception 'Choose a different maneuver to replace %.',v_old.name; end if;
    if exists(select 1 from public.character_class_option_grant_instances g where g.character_id=p_character_id and g.option_type='battle-master-maneuver' and g.instance_key<>v_replace_key and g.option_catalog_id=v_option.id) then raise exception '% is already known.',v_option.name; end if;
    update public.character_class_option_grant_instances
    set option_catalog_id=v_option.id,metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('lastReplacementLevel',p_to_level,'previousOptionKey',v_old.option_key,'replacementSource','level-up'),updated_at=now()
    where id=v_replace_row.id;
    v_summary:=v_summary||jsonb_build_array(jsonb_build_object('family','battle-master-maneuver','type','replacement','instanceKey',v_replace_key,'replaced',v_old.name,'with',v_option.name,'level',p_to_level,'source','XPHB'));
  end if;

  v_slot:=v_before;
  for v_key in select value from jsonb_array_elements_text(v_new) loop
    v_slot:=v_slot+1;
    select * into v_option from public.class_feature_option_catalog where option_key=v_key and option_type='battle-master-maneuver' and source='XPHB' and lower(coalesce(class_key,''))='fighter';
    insert into public.character_class_option_grant_instances(character_id,instance_key,option_catalog_id,option_type,acquired_level,choices,metadata,updated_at)
    values(p_character_id,'battle-master-maneuver-slot-'||v_slot::text,v_option.id,'battle-master-maneuver',private.battle_master_maneuver_slot_level_v1(v_slot),'{}'::jsonb,jsonb_build_object('source','level-up','family','battle-master-maneuver','slot',v_slot),now());
    v_summary:=v_summary||jsonb_build_array(jsonb_build_object('family','battle-master-maneuver','type','acquisition','instanceKey','battle-master-maneuver-slot-'||v_slot::text,'name',v_option.name,'level',p_to_level,'source','XPHB'));
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('key',o.option_key,'name',o.name,'source',o.source,'kind','battle-master-maneuver') order by g.instance_key),'[]'::jsonb)
  into v_serialized
  from public.character_class_option_grant_instances g join public.class_feature_option_catalog o on o.id=g.option_catalog_id
  where g.character_id=p_character_id and g.option_type='battle-master-maneuver';

  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  v_choices:=case when jsonb_typeof(v_sheet->'classFeatureChoices')='object' then v_sheet->'classFeatureChoices' else '{}'::jsonb end;
  select key into v_group_key from jsonb_each(v_choices) entry
  where entry.value->>'kind'='battle-master-maneuver'
    and private.normalize_player_choice_name_v1(coalesce(entry.value->>'subclassName','Battle Master'))=private.normalize_player_choice_name_v1('Battle Master')
  order by key limit 1;
  v_group_key:=coalesce(v_group_key,'fighter-xphb-battle-master-3-maneuver-options-0');
  v_choices:=jsonb_set(v_choices,array[v_group_key],jsonb_build_object(
    'label','Maneuver Options','kind','battle-master-maneuver','sourceFeature','Maneuver Options','source','XPHB','level',3,'count',v_after,
    'placement','class','subclassName','Battle Master','cadence','creation','replacementCadence','level-up','selections',v_serialized
  ),true);
  v_sheet:=jsonb_set(v_sheet,'{classFeatureChoices}',v_choices,true);
  v_sheet:=jsonb_set(v_sheet,'{meta,classFeatureChoices}',v_choices,true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now() where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);
  return v_summary;
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
  v_battle_master jsonb:='[]'::jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to review these class choices.' using errcode='42501'; end if;
  v_base:=public.get_character_level_class_choice_options_v1(p_character_id);
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found or v_progression.class_level>=20 then return v_base; end if;
  v_extra:=private.level_up_warlock_invocation_groups_v1(p_character_id,v_progression.class_level+1);
  v_replacement:=private.level_up_warlock_invocation_replacement_group_v1(p_character_id,v_progression.class_level+1);
  v_battle_master:=private.level_up_battle_master_maneuver_group_v1(p_character_id,v_progression.class_level+1);
  return jsonb_set(coalesce(v_base,'{}'::jsonb),'{groups}',coalesce(v_base->'groups','[]'::jsonb)||coalesce(v_extra,'[]'::jsonb)||coalesce(v_replacement,'[]'::jsonb)||coalesce(v_battle_master,'[]'::jsonb),true);
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
  v_battle_master jsonb:=coalesce(v_all_class->'fighter-battle-master-maneuvers','{}'::jsonb);
  v_forward_class jsonb:=v_all_class-'warlock-invocation-replacement'-'fighter-battle-master-maneuvers';
  v_feat_instances jsonb:=coalesce(v_input->'class_option_feat_instances','[]'::jsonb);
  v_invocation_summary jsonb:='[]'::jsonb;
  v_battle_summary jsonb:='[]'::jsonb;
  v_standard_summary jsonb:='[]'::jsonb;
  v_summary jsonb:='[]'::jsonb;
  v_result jsonb;
  v_forward_input jsonb;
  v_level_choice jsonb:='{}'::jsonb;
  v_session_id uuid;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to level this character.' using errcode='42501'; end if;
  if jsonb_typeof(v_input)<>'object' or jsonb_typeof(v_replacements)<>'object' or jsonb_typeof(v_all_class)<>'object' or jsonb_typeof(v_feat_instances)<>'array' then raise exception 'Level-up source selections have an invalid shape.'; end if;
  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if not found or v_progression.class_level>=20 then raise exception 'Character progression is unavailable for another level.'; end if;
  v_to:=v_progression.class_level+1;

  v_invocation_summary:=private.apply_level_up_warlock_invocation_replacement_v2(p_character_id,v_to,v_invocation_replacement,v_all_class,v_feat_instances);
  v_battle_summary:=private.apply_level_up_battle_master_maneuvers_v1(p_character_id,v_to,v_battle_master,v_input->>'subclass_name');
  v_standard_summary:=private.apply_level_up_replacements_v1(p_character_id,v_to,v_replacements);
  v_summary:=coalesce(v_invocation_summary,'[]'::jsonb)||coalesce(v_battle_summary,'[]'::jsonb)||coalesce(v_standard_summary,'[]'::jsonb);

  v_forward_input:=jsonb_set(v_input,'{class_choice_selections}',v_forward_class,true);
  v_result:=public.complete_character_level_up_v4(p_character_id,v_forward_input-'replacement_selections');
  perform private.sync_character_eldritch_invocations_v1(p_character_id);

  if jsonb_array_length(v_summary)>0 then
    select coalesce(level_choices->v_to::text,'{}'::jsonb) into v_level_choice from public.character_progression where character_id=p_character_id;
    v_level_choice:=v_level_choice||jsonb_build_object('replacements',v_summary);
    update public.character_progression set level_choices=jsonb_set(coalesce(level_choices,'{}'::jsonb),array[v_to::text],v_level_choice,true),updated_at=now() where character_id=p_character_id;
    select id into v_session_id from public.character_level_up_sessions where character_id=p_character_id and to_level=v_to and status='completed' order by completed_at desc limit 1;
    if v_session_id is not null then
      update public.character_level_up_sessions set selections=coalesce(selections,'{}'::jsonb)||jsonb_build_object('replacement_selections',v_replacements,'invocation_replacement_selection',v_invocation_replacement,'battle_master_maneuvers',v_battle_master,'replacements',v_summary),updated_at=now() where id=v_session_id;
    end if;
    update public.character_level_events set details=coalesce(details,'{}'::jsonb)||jsonb_build_object('replacements',v_summary)
    where id=(select id from public.character_level_events where character_id=p_character_id and event_type='level_up_completed' and to_level=v_to order by created_at desc limit 1);
  end if;

  return coalesce(v_result,'{}'::jsonb)||jsonb_build_object('replacements',v_summary,'progression',public.get_character_progression_v1(p_character_id));
end;
$$;

revoke all on function private.battle_master_maneuver_slot_level_v1(integer) from public,anon,authenticated;
revoke all on function private.is_xphb_battle_master_v1(uuid,text,text) from public,anon,authenticated;
revoke all on function private.materialize_player_forge_battle_master_maneuvers_v1() from public,anon,authenticated;
revoke all on function private.validate_existing_battle_master_maneuvers_v1() from public,anon,authenticated;
revoke all on function private.level_up_battle_master_maneuver_group_v1(uuid,integer) from public,anon,authenticated;
revoke all on function private.apply_level_up_battle_master_maneuvers_v1(uuid,integer,jsonb,text) from public,anon,authenticated;
revoke all on function public.complete_character_level_up_v5(uuid,jsonb) from public,anon;
grant execute on function private.battle_master_maneuver_slot_level_v1(integer) to service_role;
grant execute on function private.is_xphb_battle_master_v1(uuid,text,text) to service_role;
grant execute on function private.materialize_player_forge_battle_master_maneuvers_v1() to service_role;
grant execute on function private.validate_existing_battle_master_maneuvers_v1() to service_role;
grant execute on function private.level_up_battle_master_maneuver_group_v1(uuid,integer) to service_role;
grant execute on function private.apply_level_up_battle_master_maneuvers_v1(uuid,integer,jsonb,text) to service_role;
grant execute on function public.complete_character_level_up_v5(uuid,jsonb) to authenticated,service_role;
