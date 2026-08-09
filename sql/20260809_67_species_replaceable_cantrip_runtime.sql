-- Source-correct Species cantrip replacement authority.
-- XPHB High Elf starts with Prestidigitation; after a newer Long Rest it may be
-- replaced by a different Wizard cantrip.
-- EFA Khoravar Fey Gift starts with Friends; after a newer Long Rest it may be
-- replaced by a different Cleric, Druid, or Wizard cantrip.
-- The spellcasting ability remains the permanent Forge choice; only the cantrip
-- is runtime-replaceable.

create or replace function private.species_replaceable_cantrip_feature_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_sheet jsonb:='{}'::jsonb;
  v_group jsonb;
  v_casting_stat text;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets where character_id=p_character_id;
  if not found then return jsonb_build_object('available',false); end if;

  if private.character_has_species_source_v1(p_character_id,'Khoravar','EFA') then
    select entry.value into v_group
    from jsonb_each(coalesce(v_sheet->'sourceChoices','{}'::jsonb)) entry
    where coalesce(entry.value->>'ownerType','')='species'
      and upper(coalesce(entry.value->>'source',''))='EFA'
      and private.normalize_player_choice_name_v1(entry.value->>'label')='feygift'
    limit 1;
    v_casting_stat:=lower(coalesce(v_group #>> '{fields,feature-ability,selections,0,value}',''));
    return jsonb_build_object(
      'available',true,
      'featureKey','khoravar-fey-gift-cantrip',
      'featureName','Fey Gift',
      'source','EFA',
      'speciesName','Khoravar',
      'initialCantripName','Friends',
      'castingStat',v_casting_stat,
      'listClasses',jsonb_build_array('Cleric','Druid','Wizard')
    );
  end if;

  if private.character_has_species_source_v1(p_character_id,'Elf','XPHB') then
    select entry.value into v_group
    from jsonb_each(coalesce(v_sheet->'sourceChoices','{}'::jsonb)) entry
    where coalesce(entry.value->>'ownerType','')='species'
      and upper(coalesce(entry.value->>'source',''))='XPHB'
      and private.normalize_player_choice_name_v1(entry.value->>'label')='elvenlineage'
      and exists(
        select 1
        from jsonb_array_elements(coalesce(entry.value #> '{fields,lineage,selections}','[]'::jsonb)) selected
        where private.normalize_player_choice_name_v1(coalesce(selected->>'label',selected->>'value',selected->>'key'))='highelf'
      )
    limit 1;
    if v_group is null then return jsonb_build_object('available',false); end if;
    v_casting_stat:=lower(coalesce(v_group #>> '{fields,spellcasting-ability,selections,0,value}',''));
    return jsonb_build_object(
      'available',true,
      'featureKey','high-elf-lineage-cantrip',
      'featureName','Elven Lineage — High Elf',
      'source','XPHB',
      'speciesName','Elf',
      'initialCantripName','Prestidigitation',
      'castingStat',v_casting_stat,
      'listClasses',jsonb_build_array('Wizard')
    );
  end if;

  return jsonb_build_object('available',false);
end;
$$;

create or replace function private.species_replaceable_cantrip_options_v1(p_feature_key text)
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'spellId',s.id,
    'name',s.name,
    'source',s.source,
    'description',coalesce(s.description,''),
    'classes',to_jsonb(coalesce(s.classes,'{}'::text[]))
  ) order by s.name),'[]'::jsonb)
  from public.spells_catalog_preferred s
  where s.level=0
    and (
      (p_feature_key='high-elf-lineage-cantrip' and exists(
        select 1 from unnest(coalesce(s.classes,'{}'::text[])) c where lower(c)='wizard'
      ))
      or
      (p_feature_key='khoravar-fey-gift-cantrip' and exists(
        select 1 from unnest(coalesce(s.classes,'{}'::text[])) c where lower(c) in ('cleric','druid','wizard')
      ))
    );
$$;

create or replace function private.set_species_replaceable_cantrip_projection_v1(
  p_character_id uuid,
  p_state jsonb
)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_sheet jsonb:='{}'::jsonb;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets
  where character_id=p_character_id
  for update;
  if not found then return; end if;

  if coalesce(jsonb_typeof(v_sheet->'runtimeFeatures'),'')<>'object' then
    v_sheet:=jsonb_set(v_sheet,'{runtimeFeatures}','{}'::jsonb,true);
  end if;
  if p_state is null then
    v_sheet:=v_sheet #- array['runtimeFeatures','speciesReplaceableCantrip'];
  else
    v_sheet:=jsonb_set(v_sheet,'{runtimeFeatures,speciesReplaceableCantrip}',p_state,true);
  end if;
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
end;
$$;

create or replace function private.materialize_player_forge_species_replaceable_cantrip_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_sheet jsonb:='{}'::jsonb;
  v_feature jsonb;
  v_spell public.spells_catalog%rowtype;
  v_feature_key text;
  v_feature_name text;
  v_source text;
  v_initial_name text;
  v_casting_stat text;
  v_state jsonb;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets where character_id=new.character_id;
  if coalesce(v_sheet #>> '{meta,creator}','')<>'shared_character_forge_player_v2' then return new; end if;

  v_feature:=private.species_replaceable_cantrip_feature_v1(new.character_id);
  if not coalesce((v_feature->>'available')::boolean,false) then return new; end if;

  v_feature_key:=v_feature->>'featureKey';
  v_feature_name:=v_feature->>'featureName';
  v_source:=v_feature->>'source';
  v_initial_name:=v_feature->>'initialCantripName';
  v_casting_stat:=lower(coalesce(v_feature->>'castingStat',''));
  if v_casting_stat not in ('int','wis','cha') then
    raise exception '% requires a permanent Intelligence, Wisdom, or Charisma spellcasting-ability choice.',v_feature_name;
  end if;

  select s.* into v_spell
  from public.spells_catalog_preferred s
  where lower(s.name)=lower(v_initial_name) and s.level=0
  limit 1;
  if not found or not exists(
    select 1 from jsonb_array_elements(private.species_replaceable_cantrip_options_v1(v_feature_key)) option
    where option->>'spellId'=v_spell.id::text
  ) then
    raise exception 'Could not resolve the source-fixed initial cantrip % for %.',v_initial_name,v_feature_name;
  end if;

  v_state:=jsonb_build_object(
    'configured',true,
    'featureKey',v_feature_key,
    'featureName',v_feature_name,
    'source',v_source,
    'spellId',v_spell.id,
    'cantripName',v_spell.name,
    'castingStat',v_casting_stat,
    'initial',true,
    'configuredAt',timezone('utc',now()),
    'configuredRestAt',null
  );

  delete from public.character_spells
  where character_id=new.character_id
    and source_type='species'
    and source_key=v_feature_key;

  insert into public.character_spells(
    character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,
    uses_max,uses_remaining,recharge,casting_stat,raw_payload,created_at,updated_at
  ) values(
    new.character_id,v_spell.id,'species',v_feature_key,v_feature_name,true,true,true,
    null,null,null,v_casting_stat,jsonb_build_object(
      'creator','shared_character_forge_player_v3',
      'runtimeFeatureKey',v_feature_key,
      'runtimeFeatureName',v_feature_name,
      'speciesReplaceableCantrip',true,
      'sourceTrait',v_feature_name,
      'catalogSource',v_spell.source,
      'initial',true
    ),now(),now()
  );

  insert into public.character_runtime_feature_choices(
    character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at
  ) values(
    new.character_id,v_feature_key,v_feature_name,v_source,'long_rest',v_state,timezone('utc',now()),now(),now()
  ) on conflict(character_id,feature_key) do update set
    feature_name=excluded.feature_name,
    source=excluded.source,
    cadence=excluded.cadence,
    state=excluded.state,
    replacement_anchor_at=excluded.replacement_anchor_at,
    updated_at=now();

  perform private.set_species_replaceable_cantrip_projection_v1(new.character_id,v_state);
  return new;
end;
$$;

drop trigger if exists character_progression_materialize_species_cantrip_v1 on public.character_progression;
create constraint trigger character_progression_materialize_species_cantrip_v1
after insert on public.character_progression
deferrable initially deferred
for each row execute function private.materialize_player_forge_species_replaceable_cantrip_v1();

create or replace function public.get_character_species_replaceable_cantrip_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_feature jsonb;
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_latest_long_rest timestamptz;
  v_configured boolean:=false;
  v_can_replace boolean:=false;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to review this Species cantrip.' using errcode='42501';
  end if;
  v_feature:=private.species_replaceable_cantrip_feature_v1(p_character_id);
  if not coalesce((v_feature->>'available')::boolean,false) then
    return jsonb_build_object('available',false);
  end if;

  select * into v_runtime
  from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key=v_feature->>'featureKey';

  v_configured:=found
    and coalesce((v_runtime.state->>'configured')::boolean,false)
    and nullif(v_runtime.state->>'spellId','') is not null
    and lower(coalesce(v_runtime.state->>'castingStat','')) in ('int','wis','cha');
  v_latest_long_rest:=private.species_runtime_latest_long_rest_v1(p_character_id);
  v_can_replace:=v_configured and v_latest_long_rest is not null
    and v_latest_long_rest>coalesce(v_runtime.replacement_anchor_at,'epoch'::timestamptz);

  return jsonb_build_object(
    'available',true,
    'featureKey',v_feature->>'featureKey',
    'featureName',v_feature->>'featureName',
    'source',v_feature->>'source',
    'configured',v_configured,
    'canReplace',v_can_replace,
    'latestLongRestAt',v_latest_long_rest,
    'replacementAnchorAt',case when found then v_runtime.replacement_anchor_at else null end,
    'state',case when found then v_runtime.state else jsonb_build_object('configured',false) end,
    'options',private.species_replaceable_cantrip_options_v1(v_feature->>'featureKey'),
    'helper',case when v_feature->>'featureKey'='high-elf-lineage-cantrip'
      then 'High Elf begins with Prestidigitation. After a newer Long Rest, you may replace the current cantrip with a different Wizard cantrip; the lineage spellcasting ability does not change.'
      else 'Khoravar begins with Friends. After a newer Long Rest, you may replace the current cantrip with a different Cleric, Druid, or Wizard cantrip; the Fey Gift spellcasting ability does not change.' end
  );
end;
$$;

create or replace function public.configure_character_species_replaceable_cantrip_v1(
  p_character_id uuid,
  p_spell_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_feature jsonb;
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_spell public.spells_catalog%rowtype;
  v_feature_key text;
  v_feature_name text;
  v_source text;
  v_casting_stat text;
  v_latest_long_rest timestamptz;
  v_state jsonb;
  v_active_encounter jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to replace this Species cantrip.' using errcode='42501';
  end if;
  v_feature:=private.species_replaceable_cantrip_feature_v1(p_character_id);
  if not coalesce((v_feature->>'available')::boolean,false) then
    raise exception 'This character does not have a replaceable Species cantrip.';
  end if;

  v_active_encounter:=private.character_active_encounter_v1(p_character_id);
  if v_active_encounter is not null then
    raise exception 'A Species cantrip cannot be replaced while this character is in an active encounter.';
  end if;

  v_feature_key:=v_feature->>'featureKey';
  v_feature_name:=v_feature->>'featureName';
  v_source:=v_feature->>'source';
  v_casting_stat:=lower(coalesce(v_feature->>'castingStat',''));
  if v_casting_stat not in ('int','wis','cha') then
    raise exception '% has no valid permanent spellcasting-ability choice.',v_feature_name;
  end if;

  select * into v_runtime
  from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key=v_feature_key
  for update;
  if not found or not coalesce((v_runtime.state->>'configured')::boolean,false) then
    raise exception 'The source-fixed initial Species cantrip has not been materialized.';
  end if;

  v_latest_long_rest:=private.species_runtime_latest_long_rest_v1(p_character_id);
  if v_latest_long_rest is null or v_latest_long_rest<=coalesce(v_runtime.replacement_anchor_at,'epoch'::timestamptz) then
    raise exception 'Finish a newer Long Rest before replacing this Species cantrip.';
  end if;
  if v_runtime.state->>'spellId'=p_spell_id::text then
    raise exception 'Choose a different cantrip from the current Species cantrip.';
  end if;

  select s.* into v_spell from public.spells_catalog s where s.id=p_spell_id;
  if not found or v_spell.level<>0 or not exists(
    select 1 from jsonb_array_elements(private.species_replaceable_cantrip_options_v1(v_feature_key)) option
    where option->>'spellId'=p_spell_id::text
  ) then
    raise exception 'The selected cantrip is not legal for this Species feature.';
  end if;

  v_state:=jsonb_build_object(
    'configured',true,
    'featureKey',v_feature_key,
    'featureName',v_feature_name,
    'source',v_source,
    'spellId',v_spell.id,
    'cantripName',v_spell.name,
    'castingStat',v_casting_stat,
    'initial',false,
    'configuredAt',timezone('utc',now()),
    'configuredRestAt',v_latest_long_rest,
    'previousCantrip',jsonb_build_object(
      'spellId',v_runtime.state->>'spellId',
      'cantripName',v_runtime.state->>'cantripName'
    )
  );

  delete from public.character_spells
  where character_id=p_character_id
    and source_type='species'
    and source_key=v_feature_key;

  insert into public.character_spells(
    character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,
    uses_max,uses_remaining,recharge,casting_stat,raw_payload,created_at,updated_at
  ) values(
    p_character_id,v_spell.id,'species',v_feature_key,v_feature_name,true,true,true,
    null,null,null,v_casting_stat,jsonb_build_object(
      'runtimeFeatureKey',v_feature_key,
      'runtimeFeatureName',v_feature_name,
      'speciesReplaceableCantrip',true,
      'sourceTrait',v_feature_name,
      'catalogSource',v_spell.source,
      'runtimeGrant',true
    ),now(),now()
  );

  update public.character_runtime_feature_choices
  set state=v_state,replacement_anchor_at=v_latest_long_rest,updated_at=now()
  where character_id=p_character_id and feature_key=v_feature_key;

  perform private.set_species_replaceable_cantrip_projection_v1(p_character_id,v_state);
  return public.get_character_species_replaceable_cantrip_v1(p_character_id);
end;
$$;

revoke all on function private.species_replaceable_cantrip_feature_v1(uuid) from public,anon,authenticated;
revoke all on function private.species_replaceable_cantrip_options_v1(text) from public,anon,authenticated;
revoke all on function private.set_species_replaceable_cantrip_projection_v1(uuid,jsonb) from public,anon,authenticated;
revoke all on function private.materialize_player_forge_species_replaceable_cantrip_v1() from public,anon,authenticated;
grant execute on function private.species_replaceable_cantrip_feature_v1(uuid) to service_role;
grant execute on function private.species_replaceable_cantrip_options_v1(text) to service_role;
grant execute on function private.set_species_replaceable_cantrip_projection_v1(uuid,jsonb) to service_role;
grant execute on function private.materialize_player_forge_species_replaceable_cantrip_v1() to service_role;

revoke all on function public.get_character_species_replaceable_cantrip_v1(uuid) from public,anon;
revoke all on function public.configure_character_species_replaceable_cantrip_v1(uuid,uuid) from public,anon;
grant execute on function public.get_character_species_replaceable_cantrip_v1(uuid) to authenticated,service_role;
grant execute on function public.configure_character_species_replaceable_cantrip_v1(uuid,uuid) to authenticated,service_role;
