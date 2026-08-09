-- XPHB Rogue / Scion of the Three Dread Allegiance runtime authority.
-- Initial allegiance is available immediately when the feature exists. The current
-- allegiance persists until changed. A newer Long Rest permits one replacement.
-- The selected cantrip is materialized as a class-feature spell assignment; the
-- selected resistance remains canonical runtime state for sheet/runtime consumers.

create or replace function private.character_has_dread_allegiance_v1(p_character_id uuid)
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
    where cp.character_id=p_character_id
      and lower(c.class_key)='rogue'
      and upper(c.source)='XPHB'
      and cp.class_level>=3
      and private.normalize_player_choice_name_v1(cp.subclass_name)='scionofthethree'
      and upper(btrim(coalesce(cp.subclass_source,'')))='XPHB'
  );
$$;

create or replace function private.dread_allegiance_options_v1()
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'key',v.key,
    'name',v.name,
    'resistance',v.resistance,
    'cantripName',v.cantrip_name,
    'spellId',s.id,
    'spellSource',s.source,
    'source','XPHB'
  ) order by v.ord),'[]'::jsonb)
  from (values
    (1,'bane','Bane','psychic','Minor Illusion'),
    (2,'bhaal','Bhaal','poison','Blade Ward'),
    (3,'myrkul','Myrkul','necrotic','Chill Touch')
  ) as v(ord,key,name,resistance,cantrip_name)
  join public.spells_catalog_preferred s
    on lower(s.name)=lower(v.cantrip_name)
   and s.source='XPHB'
   and s.level=0;
$$;

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
      and feature_key='dread-allegiance'
      and coalesce((state->>'configured')::boolean,false)
  ) x;
$$;

create or replace function public.get_character_dread_allegiance_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_latest_long_rest timestamptz;
  v_configured boolean:=false;
  v_can_replace boolean:=false;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to review Dread Allegiance for this character.' using errcode='42501';
  end if;
  if not private.character_has_dread_allegiance_v1(p_character_id) then
    return jsonb_build_object('available',false,'reason','Dread Allegiance requires an XPHB Rogue 3+ with the Scion of the Three subclass.');
  end if;

  select max(completed_at) into v_latest_long_rest
  from public.character_rest_log
  where character_id=p_character_id and rest_type='long_rest';

  select * into v_runtime
  from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key='dread-allegiance';

  v_configured:=found
    and coalesce((v_runtime.state->>'configured')::boolean,false)
    and coalesce(v_runtime.state->>'allegianceKey','') in ('bane','bhaal','myrkul')
    and btrim(coalesce(v_runtime.state->>'resistance',''))<>''
    and nullif(v_runtime.state->>'spellId','') is not null;

  v_can_replace:=v_configured
    and v_latest_long_rest is not null
    and (v_runtime.replacement_anchor_at is null or v_latest_long_rest>v_runtime.replacement_anchor_at);

  return jsonb_build_object(
    'available',true,
    'featureKey','dread-allegiance',
    'featureName','Dread Allegiance',
    'source','XPHB',
    'cadence','long_rest',
    'configured',v_configured,
    'canConfigure',not v_configured,
    'canReplace',v_can_replace,
    'latestLongRestAt',v_latest_long_rest,
    'replacementAnchorAt',case when found then v_runtime.replacement_anchor_at else null end,
    'state',case when found then v_runtime.state else jsonb_build_object('configured',false) end,
    'options',private.dread_allegiance_options_v1(),
    'runtimeResistances',to_jsonb(private.character_runtime_damage_resistances_v1(p_character_id)),
    'helper','Choose Bane, Bhaal, or Myrkul immediately when Dread Allegiance is gained. The current allegiance persists until changed. After a newer Long Rest, you may change it once; the selected resistance and Intelligence-based cantrip change together.'
  );
end;
$$;

create or replace function public.configure_character_dread_allegiance_v1(
  p_character_id uuid,
  p_allegiance_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_key text:=lower(btrim(coalesce(p_allegiance_key,'')));
  v_option jsonb;
  v_spell public.spells_catalog%rowtype;
  v_latest_long_rest timestamptz;
  v_anchor timestamptz;
  v_state jsonb;
  v_sheet jsonb:='{}'::jsonb;
  v_active_encounter jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to configure Dread Allegiance for this character.' using errcode='42501';
  end if;
  if not private.character_has_dread_allegiance_v1(p_character_id) then
    raise exception 'Dread Allegiance requires an XPHB Rogue 3+ with the Scion of the Three subclass.';
  end if;

  v_active_encounter:=private.character_active_encounter_v1(p_character_id);
  if v_active_encounter is not null then
    raise exception 'Dread Allegiance cannot be changed while this character is in an active encounter.';
  end if;

  select entry.value into v_option
  from jsonb_array_elements(private.dread_allegiance_options_v1()) entry(value)
  where entry.value->>'key'=v_key
  limit 1;
  if v_option is null then
    raise exception 'Choose Bane, Bhaal, or Myrkul for Dread Allegiance.';
  end if;

  select * into v_spell
  from public.spells_catalog
  where id=(v_option->>'spellId')::uuid;
  if not found or v_spell.level<>0 or v_spell.source<>'XPHB' then
    raise exception 'The selected Dread Allegiance cantrip is unavailable in the preferred XPHB spell catalogue.';
  end if;

  select max(completed_at) into v_latest_long_rest
  from public.character_rest_log
  where character_id=p_character_id and rest_type='long_rest';

  select * into v_runtime
  from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key='dread-allegiance'
  for update;

  if found and coalesce((v_runtime.state->>'configured')::boolean,false) then
    if v_latest_long_rest is null or (v_runtime.replacement_anchor_at is not null and v_latest_long_rest<=v_runtime.replacement_anchor_at) then
      raise exception 'Finish a newer Long Rest before changing Dread Allegiance.';
    end if;
    v_anchor:=v_latest_long_rest;
    v_state:=jsonb_build_object(
      'configured',true,
      'allegianceKey',v_key,
      'allegianceName',v_option->>'name',
      'resistance',v_option->>'resistance',
      'spellId',v_option->>'spellId',
      'cantripName',v_option->>'cantripName',
      'castingStat','int',
      'configuredAt',timezone('utc',now()),
      'configuredRestAt',v_latest_long_rest,
      'previousAllegiance',jsonb_build_object(
        'allegianceKey',v_runtime.state->>'allegianceKey',
        'allegianceName',v_runtime.state->>'allegianceName',
        'resistance',v_runtime.state->>'resistance',
        'spellId',v_runtime.state->>'spellId',
        'cantripName',v_runtime.state->>'cantripName'
      )
    );
  else
    v_anchor:=timezone('utc',now());
    v_state:=jsonb_build_object(
      'configured',true,
      'allegianceKey',v_key,
      'allegianceName',v_option->>'name',
      'resistance',v_option->>'resistance',
      'spellId',v_option->>'spellId',
      'cantripName',v_option->>'cantripName',
      'castingStat','int',
      'configuredAt',v_anchor,
      'configuredRestAt',v_latest_long_rest
    );
  end if;

  delete from public.character_spells
  where character_id=p_character_id
    and source_type='class-feature'
    and source_key='dread-allegiance'
    and coalesce(raw_payload->>'runtimeFeatureKey','')='dread-allegiance';

  insert into public.character_spells(
    character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,
    uses_max,uses_remaining,recharge,casting_stat,raw_payload,created_at,updated_at
  ) values(
    p_character_id,v_spell.id,'class-feature','dread-allegiance','Dread Allegiance',true,true,true,
    null,null,null,'int',jsonb_build_object(
      'runtimeFeatureKey','dread-allegiance',
      'runtimeFeatureName','Dread Allegiance',
      'allegianceKey',v_key,
      'allegianceName',v_option->>'name',
      'resistance',v_option->>'resistance',
      'cantripName',v_option->>'cantripName',
      'catalogSource',v_spell.source,
      'runtimeGrant',true
    ),now(),now()
  );

  insert into public.character_runtime_feature_choices(
    character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at
  ) values(
    p_character_id,'dread-allegiance','Dread Allegiance','XPHB','long_rest',v_state,v_anchor,now(),now()
  ) on conflict(character_id,feature_key) do update set
    feature_name=excluded.feature_name,
    source=excluded.source,
    cadence=excluded.cadence,
    state=excluded.state,
    replacement_anchor_at=excluded.replacement_anchor_at,
    updated_at=now();

  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets where character_id=p_character_id for update;
  if not found then raise exception 'Character sheet is unavailable.'; end if;
  v_sheet:=jsonb_set(v_sheet,'{runtimeFeatures,dreadAllegiance}',v_state,true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;

  return public.get_character_dread_allegiance_v1(p_character_id);
end;
$$;

revoke all on function private.character_has_dread_allegiance_v1(uuid) from public,anon,authenticated;
revoke all on function private.dread_allegiance_options_v1() from public,anon,authenticated;
revoke all on function private.character_runtime_damage_resistances_v1(uuid) from public,anon,authenticated;
grant execute on function private.character_has_dread_allegiance_v1(uuid) to service_role;
grant execute on function private.dread_allegiance_options_v1() to service_role;
grant execute on function private.character_runtime_damage_resistances_v1(uuid) to service_role;
revoke all on function public.get_character_dread_allegiance_v1(uuid) from public,anon;
revoke all on function public.configure_character_dread_allegiance_v1(uuid,text) from public,anon;
grant execute on function public.get_character_dread_allegiance_v1(uuid) to authenticated,service_role;
grant execute on function public.configure_character_dread_allegiance_v1(uuid,text) to authenticated,service_role;
