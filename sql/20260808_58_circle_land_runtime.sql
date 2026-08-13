-- XPHB Druid / Circle of the Land Circle Spells runtime authority.
-- Source cadence: whenever a Long Rest finishes, choose Arid, Polar, Temperate,
-- or Tropical. The prior land/spell package expires at that Long Rest; the new
-- package is then chosen for that rest cycle. Spell lists are parsed from the
-- imported XPHB Circle Spells source table rather than duplicated by hand.

create or replace function private.circle_land_source_table_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_payload jsonb;
  v_entries jsonb;
  v_table jsonb;
begin
  select raw_payload,entries into v_payload,v_entries
  from public.class_feature_catalog
  where lower(class_key)='druid'
    and upper(class_source)='XPHB'
    and lower(name)='circle spells'
    and lower(coalesce(subclass_name,'')) like '%land%'
  order by level,id
  limit 1;

  if v_payload is null and v_entries is null then
    raise exception 'The imported XPHB Circle Spells source row is unavailable.';
  end if;

  select node into v_table
  from (
    select node
    from jsonb_path_query(coalesce(v_payload,'{}'::jsonb),'$.**') as q(node)
    union all
    select node
    from jsonb_path_query(coalesce(v_entries,'[]'::jsonb),'$.**') as q(node)
  ) src
  where jsonb_typeof(node)='object'
    and node ? 'rows'
    and node ? 'colLabels'
    and lower(node::text) like '%arid%'
    and lower(node::text) like '%polar%'
    and lower(node::text) like '%temperate%'
    and lower(node::text) like '%tropical%'
  limit 1;

  if v_table is null then
    raise exception 'Could not resolve the imported XPHB Circle Spells land table.';
  end if;
  return v_table;
end;
$$;

create or replace function private.circle_land_spell_names_from_cell_v1(p_cell jsonb)
returns text[]
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_text text:=coalesce(p_cell::text,'');
  v_names text[];
begin
  select array_agg(distinct btrim(m[1]) order by btrim(m[1])) into v_names
  from regexp_matches(v_text,E'\\{@spell[[:space:]]+([^|}]+)(?:\\|[^}]*)?\\}','gi') as m;

  if coalesce(array_length(v_names,1),0)>0 then return v_names; end if;

  -- Fail-safe fallback for a future importer that stores plain spell names in
  -- the table cell while retaining the same land-table structure.
  select array_agg(distinct s.name order by s.name) into v_names
  from public.spells_catalog_preferred s
  where s.source='XPHB'
    and s.level between 0 and 9
    and lower(v_text) ~ ('(^|[^a-z])'||regexp_replace(lower(s.name),'([\\.\\+\\*\\?\\[\\^\\]\\$\\(\\)\\{\\}=!<>|:\\-])','\\\\\\1','g')||'([^a-z]|$)');

  return coalesce(v_names,'{}'::text[]);
end;
$$;

create or replace function private.circle_land_spell_matrix_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_table jsonb:=private.circle_land_source_table_v1();
  v_level_col integer;
  v_land record;
  v_row jsonb;
  v_level integer;
  v_cell jsonb;
  v_spell_name text;
  v_spell public.spells_catalog%rowtype;
  v_spells jsonb;
  v_unlocks jsonb;
  v_result jsonb:='[]'::jsonb;
begin
  select ordinality-1 into v_level_col
  from jsonb_array_elements_text(v_table->'colLabels') with ordinality c(label,ordinality)
  where lower(c.label) like '%druid%' and lower(c.label) like '%level%'
  limit 1;
  if v_level_col is null then v_level_col:=0; end if;

  for v_land in
    select * from (values
      ('arid','Arid'),('polar','Polar'),('temperate','Temperate'),('tropical','Tropical')
    ) as lands(key,name)
  loop
    select ordinality-1 into strict v_land.col_index
    from jsonb_array_elements_text(v_table->'colLabels') with ordinality c(label,ordinality)
    where lower(btrim(c.label))=lower(v_land.name)
    limit 1;

    v_unlocks:='[]'::jsonb;
    for v_row in select value from jsonb_array_elements(v_table->'rows') loop
      if jsonb_typeof(v_row)<>'array' or jsonb_array_length(v_row)<=greatest(v_level_col,v_land.col_index) then continue; end if;
      v_level:=nullif(regexp_replace(coalesce(v_row->>v_level_col,''),'[^0-9]','','g'),'')::integer;
      if v_level is null then continue; end if;
      v_cell:=v_row->v_land.col_index;
      v_spells:='[]'::jsonb;
      foreach v_spell_name in array private.circle_land_spell_names_from_cell_v1(v_cell) loop
        select * into v_spell
        from public.spells_catalog_preferred
        where lower(name)=lower(v_spell_name) and source='XPHB'
        limit 1;
        if not found then
          raise exception 'Circle Spells source spell % could not be resolved to a preferred XPHB catalogue row.',v_spell_name;
        end if;
        v_spells:=v_spells||jsonb_build_array(jsonb_build_object(
          'spellId',v_spell.id,'name',v_spell.name,'spellLevel',v_spell.level,'source',v_spell.source
        ));
      end loop;
      if jsonb_array_length(v_spells)=0 then
        raise exception 'Circle Spells source table produced no spells for % at Druid level %.',v_land.name,v_level;
      end if;
      v_unlocks:=v_unlocks||jsonb_build_array(jsonb_build_object('druidLevel',v_level,'spells',v_spells));
    end loop;
    if jsonb_array_length(v_unlocks)=0 then
      raise exception 'Circle Spells source table produced no unlock rows for %.',v_land.name;
    end if;
    v_result:=v_result||jsonb_build_array(jsonb_build_object('key',v_land.key,'name',v_land.name,'source','XPHB','unlocks',v_unlocks));
  end loop;

  return v_result;
end;
$$;

create or replace function private.character_has_circle_land_spells_v1(p_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
  select exists(
    select 1
    from public.character_progression cp
    join public.class_catalog c on c.id=cp.class_id
    join public.class_feature_catalog f
      on lower(f.class_key)=lower(c.class_key)
     and upper(f.class_source)=upper(c.source)
     and lower(f.name)='circle spells'
     and upper(f.class_source)='XPHB'
     and private.normalize_player_choice_name_v1(f.subclass_name)=private.normalize_player_choice_name_v1(cp.subclass_name)
    where cp.character_id=p_character_id
      and lower(c.class_key)='druid'
      and upper(c.source)='XPHB'
      and cp.class_level>=f.level
      and upper(btrim(coalesce(cp.subclass_source,'')))='XPHB'
  );
$$;

create or replace function private.circle_land_spells_acquired_at_v1(p_character_id uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_required_level integer;
  v_event_at timestamptz;
  v_created_at timestamptz;
begin
  select min(f.level) into v_required_level
  from public.character_progression cp
  join public.class_catalog c on c.id=cp.class_id
  join public.class_feature_catalog f
    on lower(f.class_key)=lower(c.class_key)
   and upper(f.class_source)=upper(c.source)
   and lower(f.name)='circle spells'
   and upper(f.class_source)='XPHB'
   and private.normalize_player_choice_name_v1(f.subclass_name)=private.normalize_player_choice_name_v1(cp.subclass_name)
  where cp.character_id=p_character_id;
  if v_required_level is null then return null; end if;

  select min(coalesce(
    nullif(to_jsonb(e)->>'completed_at','')::timestamptz,
    nullif(to_jsonb(e)->>'created_at','')::timestamptz,
    nullif(to_jsonb(e)->>'updated_at','')::timestamptz
  )) into v_event_at
  from public.character_level_events e
  where e.character_id=p_character_id
    and coalesce(nullif(to_jsonb(e)->>'to_level','')::integer,nullif(to_jsonb(e)->>'new_level','')::integer,nullif(to_jsonb(e)->>'level','')::integer,0)>=v_required_level
    and coalesce(nullif(to_jsonb(e)->>'from_level','')::integer,nullif(to_jsonb(e)->>'old_level','')::integer,0)<v_required_level;
  if v_event_at is not null then return v_event_at; end if;
  select created_at into v_created_at from public.characters where id=p_character_id;
  return v_created_at;
end;
$$;

create or replace function private.clear_circle_land_runtime_v1(p_character_id uuid,p_rest_at timestamptz)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_sheet jsonb:='{}'::jsonb;
  v_runtime public.character_runtime_feature_choices%rowtype;
begin
  if not private.character_has_circle_land_spells_v1(p_character_id) then return; end if;

  delete from public.character_spells
  where character_id=p_character_id
    and source_type='class-feature'
    and source_key='circle-of-the-land'
    and coalesce(raw_payload->>'runtimeFeatureKey','')='circle-of-the-land';

  select * into v_runtime
  from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key='circle-of-the-land'
  for update;

  if found then
    update public.character_runtime_feature_choices
    set state=jsonb_build_object(
      'configured',false,
      'expiredAt',p_rest_at,
      'previousLandKey',v_runtime.state->>'landKey',
      'previousLandName',v_runtime.state->>'landName',
      'previousSpellIds',coalesce(v_runtime.state->'spellIds','[]'::jsonb),
      'previousSpellNames',coalesce(v_runtime.state->'spellNames','[]'::jsonb)
    ), replacement_anchor_at=p_rest_at, updated_at=now()
    where character_id=p_character_id and feature_key='circle-of-the-land';
  end if;

  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets where character_id=p_character_id for update;
  if found and v_sheet#>'{runtimeFeatures,circleOfTheLand}' is not null then
    v_sheet:=v_sheet #- array['runtimeFeatures','circleOfTheLand'];
    update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  end if;
end;
$$;

create or replace function private.character_rest_expire_circle_land_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
begin
  if new.rest_type='long_rest' then
    perform private.clear_circle_land_runtime_v1(new.character_id,new.completed_at);
  end if;
  return new;
end;
$$;

drop trigger if exists character_rest_expire_circle_land_v1 on public.character_rest_log;
create trigger character_rest_expire_circle_land_v1
after insert on public.character_rest_log
for each row execute function private.character_rest_expire_circle_land_v1();

create or replace function public.get_character_circle_land_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_latest_long_rest timestamptz;
  v_acquired_at timestamptz;
  v_level integer;
  v_configured boolean:=false;
  v_can_configure boolean:=false;
  v_matrix jsonb:=private.circle_land_spell_matrix_v1();
  v_options jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to review Circle of the Land spells for this character.' using errcode='42501';
  end if;
  if not private.character_has_circle_land_spells_v1(p_character_id) then
    return jsonb_build_object('available',false,'reason','Circle Spells requires an XPHB Druid with Circle of the Land at the feature level.');
  end if;

  select cp.class_level into v_level from public.character_progression cp where cp.character_id=p_character_id;
  v_acquired_at:=private.circle_land_spells_acquired_at_v1(p_character_id);
  select max(completed_at) into v_latest_long_rest
  from public.character_rest_log
  where character_id=p_character_id and rest_type='long_rest';

  select * into v_runtime
  from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key='circle-of-the-land';

  v_configured:=found
    and coalesce((v_runtime.state->>'configured')::boolean,false)
    and coalesce(v_runtime.state->>'landKey','') in ('arid','polar','temperate','tropical')
    and v_latest_long_rest is not null
    and (v_runtime.state->>'configuredRestAt')::timestamptz=v_latest_long_rest;

  v_can_configure:=not v_configured
    and v_latest_long_rest is not null
    and v_acquired_at is not null
    and v_latest_long_rest>v_acquired_at;

  select coalesce(jsonb_agg(jsonb_build_object(
    'key',land->>'key','name',land->>'name','source','XPHB',
    'spells',coalesce((
      select jsonb_agg(distinct spell order by spell->>'name')
      from jsonb_array_elements(land->'unlocks') unlock
      cross join lateral jsonb_array_elements(unlock->'spells') spell
      where (unlock->>'druidLevel')::integer<=v_level
    ),'[]'::jsonb)
  ) order by land->>'name'),'[]'::jsonb) into v_options
  from jsonb_array_elements(v_matrix) land;

  return jsonb_build_object(
    'available',true,'featureKey','circle-of-the-land','featureName','Circle Spells','source','XPHB','cadence','long_rest',
    'configured',v_configured,'canConfigure',v_can_configure,'acquiredAt',v_acquired_at,'latestLongRestAt',v_latest_long_rest,
    'state',case when found then v_runtime.state else jsonb_build_object('configured',false) end,
    'options',v_options,
    'helper','Whenever you finish a Long Rest, choose Arid, Polar, Temperate, or Tropical. The prior land spell package ends at that Long Rest; choose the new package for the current rest cycle. Circle Spells are always prepared and do not replace ordinary Druid prepared-spell authority.'
  );
end;
$$;

create or replace function public.configure_character_circle_land_v1(p_character_id uuid,p_land_key text)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_key text:=lower(btrim(coalesce(p_land_key,'')));
  v_profile jsonb;
  v_option jsonb;
  v_spell jsonb;
  v_spell_row public.spells_catalog%rowtype;
  v_latest_long_rest timestamptz;
  v_acquired_at timestamptz;
  v_state jsonb;
  v_sheet jsonb:='{}'::jsonb;
  v_spell_ids jsonb:='[]'::jsonb;
  v_spell_names jsonb:='[]'::jsonb;
  v_active_encounter jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to configure Circle of the Land spells for this character.' using errcode='42501';
  end if;
  if not private.character_has_circle_land_spells_v1(p_character_id) then
    raise exception 'Circle Spells requires an XPHB Druid with Circle of the Land at the feature level.';
  end if;
  v_active_encounter:=private.character_active_encounter_v1(p_character_id);
  if v_active_encounter is not null then
    raise exception 'Circle of the Land spells cannot be changed while this character is in an active encounter.';
  end if;

  v_profile:=public.get_character_circle_land_v1(p_character_id);
  if coalesce((v_profile->>'canConfigure')::boolean,false) is not true then
    raise exception 'Finish a Long Rest after gaining Circle Spells before choosing a land for the current rest cycle.';
  end if;
  v_latest_long_rest:=(v_profile->>'latestLongRestAt')::timestamptz;
  v_acquired_at:=(v_profile->>'acquiredAt')::timestamptz;
  if v_latest_long_rest is null or v_acquired_at is null or v_latest_long_rest<=v_acquired_at then
    raise exception 'Finish a Long Rest after gaining Circle Spells before choosing a land for the current rest cycle.';
  end if;

  select entry.value into v_option
  from jsonb_array_elements(v_profile->'options') entry(value)
  where entry.value->>'key'=v_key
  limit 1;
  if v_option is null then
    raise exception 'Choose Arid, Polar, Temperate, or Tropical for Circle of the Land.';
  end if;

  delete from public.character_spells
  where character_id=p_character_id
    and source_type='class-feature'
    and source_key='circle-of-the-land'
    and coalesce(raw_payload->>'runtimeFeatureKey','')='circle-of-the-land';

  for v_spell in select value from jsonb_array_elements(v_option->'spells') loop
    select * into v_spell_row from public.spells_catalog where id=(v_spell->>'spellId')::uuid;
    if not found or v_spell_row.source<>'XPHB' then
      raise exception 'Circle of the Land spell % is unavailable in the preferred XPHB catalogue.',v_spell->>'name';
    end if;
    insert into public.character_spells(
      character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,
      uses_max,uses_remaining,recharge,casting_stat,raw_payload,created_at,updated_at
    ) values(
      p_character_id,v_spell_row.id,'class-feature','circle-of-the-land','Circle Spells',true,true,true,
      null,null,null,'wis',jsonb_build_object(
        'runtimeFeatureKey','circle-of-the-land','runtimeFeatureName','Circle Spells','landKey',v_key,
        'landName',v_option->>'name','catalogSource',v_spell_row.source,'runtimeGrant',true
      ),now(),now()
    );
    v_spell_ids:=v_spell_ids||jsonb_build_array(v_spell_row.id);
    v_spell_names:=v_spell_names||jsonb_build_array(v_spell_row.name);
  end loop;

  if jsonb_array_length(v_spell_ids)=0 then raise exception 'The selected Circle land produced no spells for this Druid level.'; end if;

  v_state:=jsonb_build_object(
    'configured',true,'landKey',v_key,'landName',v_option->>'name','configuredAt',timezone('utc',now()),
    'configuredRestAt',v_latest_long_rest,'spellIds',v_spell_ids,'spellNames',v_spell_names
  );

  insert into public.character_runtime_feature_choices(
    character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at
  ) values(
    p_character_id,'circle-of-the-land','Circle Spells','XPHB','long_rest',v_state,v_latest_long_rest,now(),now()
  ) on conflict(character_id,feature_key) do update set
    feature_name=excluded.feature_name,source=excluded.source,cadence=excluded.cadence,state=excluded.state,
    replacement_anchor_at=excluded.replacement_anchor_at,updated_at=now();

  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  if not found then raise exception 'Character sheet is unavailable.'; end if;
  v_sheet:=jsonb_set(v_sheet,'{runtimeFeatures,circleOfTheLand}',v_state,true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;

  return public.get_character_circle_land_v1(p_character_id);
end;
$$;

revoke all on function private.circle_land_source_table_v1() from public,anon,authenticated;
revoke all on function private.circle_land_spell_names_from_cell_v1(jsonb) from public,anon,authenticated;
revoke all on function private.circle_land_spell_matrix_v1() from public,anon,authenticated;
revoke all on function private.character_has_circle_land_spells_v1(uuid) from public,anon,authenticated;
revoke all on function private.circle_land_spells_acquired_at_v1(uuid) from public,anon,authenticated;
revoke all on function private.clear_circle_land_runtime_v1(uuid,timestamptz) from public,anon,authenticated;
revoke all on function private.character_rest_expire_circle_land_v1() from public,anon,authenticated;
grant execute on function private.circle_land_source_table_v1() to service_role;
grant execute on function private.circle_land_spell_names_from_cell_v1(jsonb) to service_role;
grant execute on function private.circle_land_spell_matrix_v1() to service_role;
grant execute on function private.character_has_circle_land_spells_v1(uuid) to service_role;
grant execute on function private.circle_land_spells_acquired_at_v1(uuid) to service_role;
grant execute on function private.clear_circle_land_runtime_v1(uuid,timestamptz) to service_role;
grant execute on function private.character_rest_expire_circle_land_v1() to service_role;
revoke all on function public.get_character_circle_land_v1(uuid) from public,anon;
revoke all on function public.configure_character_circle_land_v1(uuid,text) from public,anon;
grant execute on function public.get_character_circle_land_v1(uuid) to authenticated,service_role;
grant execute on function public.configure_character_circle_land_v1(uuid,text) to authenticated,service_role;
