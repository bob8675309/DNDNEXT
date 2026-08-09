-- XPHB Boon of Energy Resistance as per-feat-instance runtime authority.
-- Source: choose two listed resistances when the boon is acquired; after a Long Rest,
-- both choices may be changed. Acquisition history remains in character_option_grant_instances.
-- Current resistances live in character_runtime_feature_choices. No inventory/combat/world state is mutated here.

create or replace function private.boon_energy_resistance_feature_key_v1(p_instance_key text)
returns text
language sql
immutable
set search_path=pg_catalog
as $$
  select 'boon-energy-resistance:'||substr(md5(coalesce(p_instance_key,'')),1,16);
$$;

create or replace function private.boon_energy_resistance_options_v1()
returns jsonb
language sql
immutable
security definer
set search_path=pg_catalog,public,private,auth
as $$
  select jsonb_agg(jsonb_build_object('key',v.key,'name',v.name,'source','XPHB') order by v.ord)
  from (values
    (1,'acid','Acid'),
    (2,'cold','Cold'),
    (3,'fire','Fire'),
    (4,'lightning','Lightning'),
    (5,'necrotic','Necrotic'),
    (6,'poison','Poison'),
    (7,'psychic','Psychic'),
    (8,'radiant','Radiant'),
    (9,'thunder','Thunder')
  ) as v(ord,key,name);
$$;

create or replace function private.boon_energy_resistance_choices_v1(p_choices jsonb)
returns text[]
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_output text[]:='{}'::text[];
  v_choice jsonb;
  v_key text;
begin
  for v_choice in
    select choice
    from jsonb_each(coalesce(p_choices,'{}'::jsonb)) field
    cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice
    where choice->>'kind'='energy-resistance'
  loop
    v_key:=lower(btrim(coalesce(v_choice->>'value',v_choice->>'label','')));
    if v_key<>'' then v_output:=array_append(v_output,v_key); end if;
  end loop;
  return v_output;
end;
$$;

create or replace function private.validate_boon_energy_resistance_pair_v1(p_damage_types text[])
returns text[]
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_key text;
  v_normalized text[]:='{}'::text[];
begin
  if p_damage_types is null or cardinality(p_damage_types)<>2 then
    raise exception 'Boon of Energy Resistance requires exactly two damage types.';
  end if;
  foreach v_key in array p_damage_types loop
    v_key:=lower(btrim(coalesce(v_key,'')));
    if not exists(
      select 1 from jsonb_array_elements(private.boon_energy_resistance_options_v1()) entry(value)
      where entry.value->>'key'=v_key
    ) then
      raise exception 'Boon of Energy Resistance contains an invalid damage type: %.',coalesce(v_key,'');
    end if;
    v_normalized:=array_append(v_normalized,v_key);
  end loop;
  if (select count(distinct x) from unnest(v_normalized) x)<>2 then
    raise exception 'Boon of Energy Resistance choices must be distinct.';
  end if;
  return v_normalized;
end;
$$;

create or replace function private.sync_boon_energy_resistance_projection_v1(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_sheet jsonb:='{}'::jsonb;
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_projection jsonb:='{}'::jsonb;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets where character_id=p_character_id for update;
  if not found then return '{}'::jsonb; end if;

  select * into v_runtime
  from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key like 'boon-energy-resistance:%'
  order by updated_at desc limit 1;

  if found then
    v_projection:=jsonb_build_object(
      'instanceKey',v_runtime.state->>'instanceKey',
      'resistances',coalesce(v_runtime.state->'resistances','[]'::jsonb),
      'resistanceNames',coalesce(v_runtime.state->'resistanceNames','[]'::jsonb),
      'replacementAnchorAt',v_runtime.replacement_anchor_at
    );
  end if;

  if coalesce(jsonb_typeof(v_sheet->'runtimeFeatures'),'')<>'object' then
    v_sheet:=jsonb_set(v_sheet,'{runtimeFeatures}','{}'::jsonb,true);
  end if;
  v_sheet:=jsonb_set(v_sheet,'{runtimeFeatures,boonEnergyResistance}',v_projection,true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  return v_projection;
end;
$$;

create or replace function private.materialize_boon_energy_resistance_instance_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_pair text[];
  v_feature_key text;
  v_names jsonb;
  v_state jsonb;
begin
  if private.normalize_player_choice_name_v1(new.option_name)<>private.normalize_player_choice_name_v1('Boon of Energy Resistance')
     or upper(coalesce(new.option_source,''))<>'XPHB' then
    return new;
  end if;

  v_pair:=private.validate_boon_energy_resistance_pair_v1(private.boon_energy_resistance_choices_v1(new.choices));
  select jsonb_agg(entry.value->>'name' order by array_position(v_pair,entry.value->>'key')) into v_names
  from jsonb_array_elements(private.boon_energy_resistance_options_v1()) entry(value)
  where entry.value->>'key'=any(v_pair);

  v_feature_key:=private.boon_energy_resistance_feature_key_v1(new.instance_key);
  v_state:=jsonb_build_object(
    'configured',true,
    'instanceKey',new.instance_key,
    'optionId',new.option_id,
    'resistances',to_jsonb(v_pair),
    'resistanceNames',coalesce(v_names,'[]'::jsonb),
    'configuredAt',timezone('utc',now()),
    'configuredBy','acquisition'
  );

  insert into public.character_runtime_feature_choices(
    character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at
  ) values(
    new.character_id,v_feature_key,'Boon of Energy Resistance','XPHB','long_rest',v_state,now(),now(),now()
  ) on conflict(character_id,feature_key) do nothing;

  perform private.sync_boon_energy_resistance_projection_v1(new.character_id);
  return new;
end;
$$;

drop trigger if exists character_option_grant_instance_boon_energy_resistance_v1 on public.character_option_grant_instances;
create trigger character_option_grant_instance_boon_energy_resistance_v1
after insert on public.character_option_grant_instances
for each row execute function private.materialize_boon_energy_resistance_instance_v1();

create or replace function private.character_runtime_damage_resistances_v1(p_character_id uuid)
returns text[]
language sql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
  select coalesce(array_agg(distinct lower(x.resistance)) filter(where btrim(coalesce(x.resistance,''))<>''),'{}'::text[])
  from (
    select state->>'resistance' as resistance
    from public.character_runtime_feature_choices
    where character_id=p_character_id
      and feature_key in ('dread-allegiance','fiendish-resilience')
      and coalesce((state->>'configured')::boolean,false)
    union all
    select value as resistance
    from public.character_runtime_feature_choices r
    cross join lateral jsonb_array_elements_text(coalesce(r.state->'resistances','[]'::jsonb)) value
    where r.character_id=p_character_id
      and r.feature_key like 'boon-energy-resistance:%'
      and coalesce((r.state->>'configured')::boolean,false)
  ) x;
$$;

create or replace function public.get_character_boon_energy_resistance_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_instances jsonb:='[]'::jsonb;
  v_grant public.character_option_grant_instances%rowtype;
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_feature_key text;
  v_latest_long_rest timestamptz;
  v_configured boolean;
  v_can_replace boolean;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to review Boon of Energy Resistance for this character.' using errcode='42501';
  end if;

  select max(completed_at) into v_latest_long_rest
  from public.character_rest_log
  where character_id=p_character_id and rest_type='long_rest';

  for v_grant in
    select gi.* from public.character_option_grant_instances gi
    where gi.character_id=p_character_id
      and private.normalize_player_choice_name_v1(gi.option_name)=private.normalize_player_choice_name_v1('Boon of Energy Resistance')
      and upper(coalesce(gi.option_source,''))='XPHB'
    order by gi.acquisition_level nulls first,gi.instance_key
  loop
    v_feature_key:=private.boon_energy_resistance_feature_key_v1(v_grant.instance_key);
    select * into v_runtime from public.character_runtime_feature_choices
    where character_id=p_character_id and feature_key=v_feature_key;
    v_configured:=found
      and coalesce((v_runtime.state->>'configured')::boolean,false)
      and jsonb_typeof(v_runtime.state->'resistances')='array'
      and jsonb_array_length(v_runtime.state->'resistances')=2;
    v_can_replace:=v_configured and v_latest_long_rest is not null and v_latest_long_rest>v_runtime.replacement_anchor_at;
    v_instances:=v_instances||jsonb_build_array(jsonb_build_object(
      'instanceKey',v_grant.instance_key,
      'featureKey',v_feature_key,
      'optionId',v_grant.option_id,
      'acquisitionLevel',v_grant.acquisition_level,
      'configured',v_configured,
      'canConfigure',not v_configured,
      'canReplace',v_can_replace,
      'replacementAnchorAt',case when v_configured then v_runtime.replacement_anchor_at else null end,
      'latestLongRestAt',v_latest_long_rest,
      'state',case when v_configured then v_runtime.state else '{}'::jsonb end
    ));
  end loop;

  return jsonb_build_object(
    'available',jsonb_array_length(v_instances)>0,
    'featureName','Boon of Energy Resistance',
    'source','XPHB',
    'cadence','long_rest',
    'instances',v_instances,
    'options',private.boon_energy_resistance_options_v1(),
    'runtimeResistances',to_jsonb(private.character_runtime_damage_resistances_v1(p_character_id)),
    'helper','Choose two Energy Resistances when the Boon is gained. After a newer Long Rest, both choices may be changed together.'
  );
end;
$$;

create or replace function public.configure_character_boon_energy_resistance_v1(
  p_character_id uuid,
  p_instance_key text,
  p_damage_types text[]
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_grant public.character_option_grant_instances%rowtype;
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_pair text[];
  v_feature_key text;
  v_latest_long_rest timestamptz;
  v_anchor timestamptz;
  v_names jsonb;
  v_state jsonb;
  v_existing text[]:='{}'::text[];
  v_active_encounter jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to configure Boon of Energy Resistance for this character.' using errcode='42501';
  end if;
  if nullif(btrim(coalesce(p_instance_key,'')),'') is null then
    raise exception 'Boon of Energy Resistance requires a feat instance.';
  end if;

  select * into v_grant from public.character_option_grant_instances gi
  where gi.character_id=p_character_id and gi.instance_key=p_instance_key
    and private.normalize_player_choice_name_v1(gi.option_name)=private.normalize_player_choice_name_v1('Boon of Energy Resistance')
    and upper(coalesce(gi.option_source,''))='XPHB'
  for update;
  if not found then raise exception 'The requested XPHB Boon of Energy Resistance instance is unavailable.'; end if;

  v_active_encounter:=private.character_active_encounter_v1(p_character_id);
  if v_active_encounter is not null then
    raise exception 'Boon of Energy Resistance cannot be changed while this character is in an active encounter.';
  end if;

  v_pair:=private.validate_boon_energy_resistance_pair_v1(p_damage_types);
  v_feature_key:=private.boon_energy_resistance_feature_key_v1(v_grant.instance_key);
  select * into v_runtime from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key=v_feature_key for update;

  if found and jsonb_typeof(v_runtime.state->'resistances')='array' then
    select coalesce(array_agg(value order by value),'{}'::text[]) into v_existing
    from jsonb_array_elements_text(v_runtime.state->'resistances') value;
    if v_existing=(select array_agg(x order by x) from unnest(v_pair) x) then
      return public.get_character_boon_energy_resistance_v1(p_character_id);
    end if;
    select max(completed_at) into v_latest_long_rest
    from public.character_rest_log
    where character_id=p_character_id and rest_type='long_rest';
    if v_latest_long_rest is null or v_latest_long_rest<=v_runtime.replacement_anchor_at then
      raise exception 'Finish a newer Long Rest before changing Boon of Energy Resistance.';
    end if;
    v_anchor:=v_latest_long_rest;
  else
    v_anchor:=now();
  end if;

  select jsonb_agg(entry.value->>'name' order by array_position(v_pair,entry.value->>'key')) into v_names
  from jsonb_array_elements(private.boon_energy_resistance_options_v1()) entry(value)
  where entry.value->>'key'=any(v_pair);

  v_state:=jsonb_build_object(
    'configured',true,
    'instanceKey',v_grant.instance_key,
    'optionId',v_grant.option_id,
    'resistances',to_jsonb(v_pair),
    'resistanceNames',coalesce(v_names,'[]'::jsonb),
    'configuredAt',timezone('utc',now()),
    'configuredBy',case when found then 'long_rest_replacement' else 'legacy_initial_configuration' end,
    'previousResistances',case when found then coalesce(v_runtime.state->'resistances','[]'::jsonb) else '[]'::jsonb end
  );

  insert into public.character_runtime_feature_choices(
    character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at
  ) values(
    p_character_id,v_feature_key,'Boon of Energy Resistance','XPHB','long_rest',v_state,v_anchor,now(),now()
  ) on conflict(character_id,feature_key) do update set
    feature_name=excluded.feature_name,source=excluded.source,cadence=excluded.cadence,state=excluded.state,
    replacement_anchor_at=excluded.replacement_anchor_at,updated_at=now();

  perform private.sync_boon_energy_resistance_projection_v1(p_character_id);
  return public.get_character_boon_energy_resistance_v1(p_character_id);
end;
$$;

revoke all on function private.boon_energy_resistance_feature_key_v1(text) from public,anon,authenticated;
revoke all on function private.boon_energy_resistance_options_v1() from public,anon,authenticated;
revoke all on function private.boon_energy_resistance_choices_v1(jsonb) from public,anon,authenticated;
revoke all on function private.validate_boon_energy_resistance_pair_v1(text[]) from public,anon,authenticated;
revoke all on function private.sync_boon_energy_resistance_projection_v1(uuid) from public,anon,authenticated;
revoke all on function private.materialize_boon_energy_resistance_instance_v1() from public,anon,authenticated;
revoke all on function private.character_runtime_damage_resistances_v1(uuid) from public,anon,authenticated;
grant execute on function private.boon_energy_resistance_feature_key_v1(text) to service_role;
grant execute on function private.boon_energy_resistance_options_v1() to service_role;
grant execute on function private.boon_energy_resistance_choices_v1(jsonb) to service_role;
grant execute on function private.validate_boon_energy_resistance_pair_v1(text[]) to service_role;
grant execute on function private.sync_boon_energy_resistance_projection_v1(uuid) to service_role;
grant execute on function private.materialize_boon_energy_resistance_instance_v1() to service_role;
grant execute on function private.character_runtime_damage_resistances_v1(uuid) to service_role;

revoke all on function public.get_character_boon_energy_resistance_v1(uuid) from public,anon;
revoke all on function public.configure_character_boon_energy_resistance_v1(uuid,text,text[]) from public,anon;
grant execute on function public.get_character_boon_energy_resistance_v1(uuid) to authenticated,service_role;
grant execute on function public.configure_character_boon_energy_resistance_v1(uuid,text,text[]) to authenticated,service_role;
