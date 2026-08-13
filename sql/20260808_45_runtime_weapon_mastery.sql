-- XPHB class Weapon Mastery as Long-Rest runtime configuration.
-- Uses the generic character_runtime_feature_choices authority introduced by migration 44.
-- This intentionally does not create permanent Forge classFeatureChoices.

create or replace function private.xphb_class_weapon_mastery_count_v1(p_class_key text,p_level integer)
returns integer
language sql
immutable
set search_path=pg_catalog
as $$
  select case lower(coalesce(p_class_key,''))
    when 'barbarian' then case when coalesce(p_level,0)>=10 then 4 when coalesce(p_level,0)>=4 then 3 when coalesce(p_level,0)>=1 then 2 else 0 end
    when 'fighter' then case when coalesce(p_level,0)>=16 then 6 when coalesce(p_level,0)>=10 then 5 when coalesce(p_level,0)>=4 then 4 when coalesce(p_level,0)>=1 then 3 else 0 end
    when 'paladin' then case when coalesce(p_level,0)>=1 then 2 else 0 end
    when 'ranger' then case when coalesce(p_level,0)>=1 then 2 else 0 end
    when 'rogue' then case when coalesce(p_level,0)>=1 then 2 else 0 end
    else 0 end;
$$;

create or replace function private.xphb_class_weapon_mastery_options_v1(p_class_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_class_key text:=lower(coalesce(p_class_key,''));
  v_options jsonb:='[]'::jsonb;
begin
  if v_class_key not in ('barbarian','fighter','paladin','ranger','rogue') then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'itemId',i.id,
    'name',i.item_name,
    'source',coalesce(i.payload->>'source','XPHB'),
    'weaponCategory',coalesce(i.payload->>'weaponCategory',''),
    'itemType',coalesce(i.item_type,''),
    'mastery',coalesce(i.payload->'mastery','[]'::jsonb),
    'properties',coalesce(i.payload->'property','[]'::jsonb),
    'damage',coalesce(i.payload->>'damageText',i.payload->>'dmg1','')
  ) order by i.item_name),'[]'::jsonb)
  into v_options
  from public.items_catalog i
  where coalesce(i.item_rarity,'')='mundane'
    and upper(coalesce(i.payload->>'source','XPHB'))='XPHB'
    and coalesce((i.payload->>'weapon')::boolean,false)
    and not coalesce((i.payload->>'firearm')::boolean,false)
    and jsonb_typeof(coalesce(i.payload->'mastery','[]'::jsonb))='array'
    and jsonb_array_length(coalesce(i.payload->'mastery','[]'::jsonb))>0
    and (
      v_class_key in ('fighter','paladin','ranger')
      or (
        v_class_key='barbarian'
        and (
          upper(split_part(coalesce(i.payload->>'type',''),'|',1))='M'
          or lower(coalesce(i.item_type,'')) like '%melee%'
        )
      )
      or (
        v_class_key='rogue'
        and (
          lower(coalesce(i.payload->>'weaponCategory',''))='simple'
          or (
            lower(coalesce(i.payload->>'weaponCategory',''))='martial'
            and exists(
              select 1 from jsonb_array_elements_text(coalesce(i.payload->'property','[]'::jsonb)) prop
              where upper(split_part(prop,'|',1)) in ('F','L')
            )
          )
        )
      )
    );
  return coalesce(v_options,'[]'::jsonb);
end;
$$;

create or replace function public.get_character_weapon_mastery_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_capacity integer:=0;
  v_selected_count integer:=0;
  v_latest_long_rest timestamptz;
  v_configured boolean:=false;
  v_can_replace boolean:=false;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to review Weapon Mastery for this character.' using errcode='42501';
  end if;
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found then return jsonb_build_object('available',false,'reason','Character progression is unavailable.'); end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found or upper(coalesce(v_class.source,''))<>'XPHB' then
    return jsonb_build_object('available',false,'reason','This runtime Weapon Mastery adapter currently supports XPHB class features.');
  end if;
  v_capacity:=private.xphb_class_weapon_mastery_count_v1(v_class.class_key,v_progression.class_level);
  if v_capacity<=0 then
    return jsonb_build_object('available',false,'reason','This class does not currently grant the XPHB Weapon Mastery class feature.','classLevel',v_progression.class_level);
  end if;

  select * into v_runtime from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key='class-weapon-mastery';
  if found and jsonb_typeof(v_runtime.state->'selections')='array' then
    v_selected_count:=jsonb_array_length(v_runtime.state->'selections');
  end if;
  v_configured:=v_selected_count=v_capacity;
  select max(completed_at) into v_latest_long_rest from public.character_rest_log
  where character_id=p_character_id and rest_type='long_rest';
  v_can_replace:=v_selected_count>0 and v_latest_long_rest is not null and v_latest_long_rest>v_runtime.replacement_anchor_at;

  return jsonb_build_object(
    'available',true,
    'featureKey','class-weapon-mastery',
    'featureName','Weapon Mastery',
    'source','XPHB',
    'cadence','long_rest',
    'classKey',v_class.class_key,
    'className',v_class.class_name,
    'classLevel',v_progression.class_level,
    'capacity',v_capacity,
    'selectedCount',v_selected_count,
    'missingCount',greatest(0,v_capacity-v_selected_count),
    'configured',v_configured,
    'canReplaceOne',v_can_replace,
    'replacementAnchorAt',case when v_selected_count>0 then v_runtime.replacement_anchor_at else null end,
    'latestLongRestAt',v_latest_long_rest,
    'state',case when v_selected_count>0 then v_runtime.state else jsonb_build_object('selections','[]'::jsonb) end,
    'options',private.xphb_class_weapon_mastery_options_v1(v_class.class_key),
    'helper','Choose the weapon kinds whose mastery properties this character can currently use. New capacity gained from class levels can be filled immediately. After a Long Rest, one previously chosen weapon kind can be changed.'
  );
end;
$$;

create or replace function public.configure_character_weapon_mastery_v1(p_character_id uuid,p_item_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_capacity integer:=0;
  v_old jsonb:='[]'::jsonb;
  v_old_count integer:=0;
  v_changed_existing integer:=0;
  v_latest_long_rest timestamptz;
  v_anchor timestamptz;
  v_new_state jsonb:='[]'::jsonb;
  v_names jsonb:='[]'::jsonb;
  v_item_id uuid;
  v_item public.items_catalog%rowtype;
  v_option jsonb;
  v_index integer:=0;
  v_old_item_id uuid;
  v_options jsonb:='[]'::jsonb;
  v_sheet jsonb:='{}'::jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to configure Weapon Mastery for this character.' using errcode='42501';
  end if;
  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if not found then raise exception 'Character progression is unavailable.'; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found or upper(coalesce(v_class.source,''))<>'XPHB' then raise exception 'This Weapon Mastery adapter requires an XPHB class.'; end if;
  v_capacity:=private.xphb_class_weapon_mastery_count_v1(v_class.class_key,v_progression.class_level);
  if v_capacity<=0 then raise exception 'This class does not grant the XPHB Weapon Mastery class feature.'; end if;
  if p_item_ids is null or cardinality(p_item_ids)<>v_capacity then
    raise exception 'Weapon Mastery requires exactly % current weapon choice(s) at % level %.',v_capacity,v_class.class_name,v_progression.class_level;
  end if;
  if (select count(distinct item_id) from unnest(p_item_ids) as chosen(item_id))<>v_capacity then
    raise exception 'Weapon Mastery weapon choices must be distinct.';
  end if;

  v_options:=private.xphb_class_weapon_mastery_options_v1(v_class.class_key);
  foreach v_item_id in array p_item_ids loop
    select entry.value into v_option from jsonb_array_elements(v_options) entry(value)
    where entry.value->>'itemId'=v_item_id::text limit 1;
    if v_option is null then raise exception 'A selected Weapon Mastery weapon is not source-legal for this class.'; end if;
    select * into v_item from public.items_catalog where id=v_item_id;
    v_index:=v_index+1;
    v_new_state:=v_new_state||jsonb_build_array(jsonb_build_object(
      'slot',v_index,
      'itemId',v_item.id,
      'name',v_item.item_name,
      'source',coalesce(v_item.payload->>'source','XPHB'),
      'weaponCategory',coalesce(v_item.payload->>'weaponCategory',''),
      'mastery',coalesce(v_item.payload->'mastery','[]'::jsonb),
      'properties',coalesce(v_item.payload->'property','[]'::jsonb)
    ));
    v_names:=v_names||to_jsonb(v_item.item_name);
  end loop;

  select * into v_runtime from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key='class-weapon-mastery' for update;
  if found then
    v_old:=case when jsonb_typeof(v_runtime.state->'selections')='array' then v_runtime.state->'selections' else '[]'::jsonb end;
    v_old_count:=jsonb_array_length(v_old);
    if v_old_count>v_capacity then raise exception 'Existing Weapon Mastery state exceeds this class level''s source capacity.'; end if;
    for v_index in 0..greatest(v_old_count-1,-1) loop
      exit when v_index<0;
      begin v_old_item_id:=nullif(v_old#>>array[v_index::text,'itemId'],'')::uuid; exception when others then v_old_item_id:=null; end;
      if v_old_item_id is distinct from p_item_ids[v_index+1] then v_changed_existing:=v_changed_existing+1; end if;
    end loop;
    if v_changed_existing>1 then raise exception 'After a Long Rest, Weapon Mastery can change only one previously chosen weapon.'; end if;
    if v_changed_existing=0 and v_old_count=v_capacity then return public.get_character_weapon_mastery_v1(p_character_id); end if;
    if v_changed_existing=1 then
      select max(completed_at) into v_latest_long_rest from public.character_rest_log
      where character_id=p_character_id and rest_type='long_rest';
      if v_latest_long_rest is null or v_latest_long_rest<=v_runtime.replacement_anchor_at then
        raise exception 'Finish a new Long Rest before changing a mastered weapon.';
      end if;
      v_anchor:=v_latest_long_rest;
    else
      v_anchor:=v_runtime.replacement_anchor_at;
    end if;
  else
    v_anchor:=now();
  end if;

  insert into public.character_runtime_feature_choices(character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at)
  values(p_character_id,'class-weapon-mastery','Weapon Mastery','XPHB','long_rest',jsonb_build_object(
    'selections',v_new_state,
    'capacity',v_capacity,
    'classKey',v_class.class_key,
    'classLevel',v_progression.class_level,
    'lastChangedExistingCount',v_changed_existing
  ),v_anchor,now(),now())
  on conflict(character_id,feature_key) do update set
    feature_name=excluded.feature_name,source=excluded.source,cadence=excluded.cadence,state=excluded.state,
    replacement_anchor_at=excluded.replacement_anchor_at,updated_at=now();

  -- Keep the legacy sheet field as a derived projection only; runtime state is authoritative.
  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  v_sheet:=jsonb_set(v_sheet,'{weaponMasteries}',v_names,true);
  v_sheet:=jsonb_set(v_sheet,'{meta,weaponMasteries}',v_names,true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now()
  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);

  return public.get_character_weapon_mastery_v1(p_character_id)||jsonb_build_object(
    'changedExisting',v_changed_existing,
    'addedCapacity',greatest(0,v_capacity-v_old_count)
  );
end;
$$;

revoke all on function private.xphb_class_weapon_mastery_count_v1(text,integer) from public,anon,authenticated;
revoke all on function private.xphb_class_weapon_mastery_options_v1(text) from public,anon,authenticated;
revoke all on function public.get_character_weapon_mastery_v1(uuid) from public,anon;
revoke all on function public.configure_character_weapon_mastery_v1(uuid,uuid[]) from public,anon;
grant execute on function private.xphb_class_weapon_mastery_count_v1(text,integer) to service_role;
grant execute on function private.xphb_class_weapon_mastery_options_v1(text) to service_role;
grant execute on function public.get_character_weapon_mastery_v1(uuid) to authenticated,service_role;
grant execute on function public.configure_character_weapon_mastery_v1(uuid,uuid[]) to authenticated,service_role;
