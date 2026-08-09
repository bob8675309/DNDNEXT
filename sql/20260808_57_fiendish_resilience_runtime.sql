-- XPHB Warlock / Fiend Patron Fiendish Resilience runtime authority.
-- Source cadence: choose one damage type other than Force whenever you finish a
-- Short or Long Rest. The current resistance persists until replaced.

create or replace function private.character_has_fiendish_resilience_v1(p_character_id uuid)
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
     and lower(f.name)='fiendish resilience'
     and upper(f.class_source)='XPHB'
     and private.normalize_player_choice_name_v1(f.subclass_name)=private.normalize_player_choice_name_v1(cp.subclass_name)
    where cp.character_id=p_character_id
      and lower(c.class_key)='warlock'
      and upper(c.source)='XPHB'
      and cp.class_level>=f.level
      and upper(btrim(coalesce(cp.subclass_source,'')))='XPHB'
  );
$$;

create or replace function private.fiendish_resilience_acquired_at_v1(p_character_id uuid)
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
   and lower(f.name)='fiendish resilience'
   and upper(f.class_source)='XPHB'
   and private.normalize_player_choice_name_v1(f.subclass_name)=private.normalize_player_choice_name_v1(cp.subclass_name)
  where cp.character_id=p_character_id;

  if v_required_level is null then return null; end if;

  -- Level-event schemas have evolved. Read common keys from row JSON so this
  -- helper remains compatible with the live audit table without weakening the
  -- source-level requirement.
  select min(coalesce(
    nullif(to_jsonb(e)->>'completed_at','')::timestamptz,
    nullif(to_jsonb(e)->>'created_at','')::timestamptz,
    nullif(to_jsonb(e)->>'updated_at','')::timestamptz
  )) into v_event_at
  from public.character_level_events e
  where e.character_id=p_character_id
    and coalesce(
      nullif(to_jsonb(e)->>'to_level','')::integer,
      nullif(to_jsonb(e)->>'new_level','')::integer,
      nullif(to_jsonb(e)->>'level','')::integer,
      0
    )>=v_required_level
    and coalesce(
      nullif(to_jsonb(e)->>'from_level','')::integer,
      nullif(to_jsonb(e)->>'old_level','')::integer,
      0
    )<v_required_level;

  if v_event_at is not null then return v_event_at; end if;

  -- Direct higher-level Forge creation may have no earned-level event. In that
  -- case the character creation timestamp is the feature-acquisition anchor.
  select created_at into v_created_at from public.characters where id=p_character_id;
  return v_created_at;
end;
$$;

create or replace function private.fiendish_resilience_options_v1()
returns jsonb
language sql
immutable
security definer
set search_path=pg_catalog,public,private,auth
as $$
  select jsonb_agg(jsonb_build_object('key',v.key,'name',v.name,'source','XPHB') order by v.ord)
  from (values
    (1,'acid','Acid'),
    (2,'bludgeoning','Bludgeoning'),
    (3,'cold','Cold'),
    (4,'fire','Fire'),
    (5,'lightning','Lightning'),
    (6,'necrotic','Necrotic'),
    (7,'piercing','Piercing'),
    (8,'poison','Poison'),
    (9,'psychic','Psychic'),
    (10,'radiant','Radiant'),
    (11,'slashing','Slashing'),
    (12,'thunder','Thunder')
  ) as v(ord,key,name);
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
      and feature_key in ('dread-allegiance','fiendish-resilience')
      and coalesce((state->>'configured')::boolean,false)
  ) x;
$$;

create or replace function public.get_character_fiendish_resilience_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_latest_rest timestamptz;
  v_acquired_at timestamptz;
  v_configured boolean:=false;
  v_can_configure boolean:=false;
  v_can_replace boolean:=false;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to review Fiendish Resilience for this character.' using errcode='42501';
  end if;
  if not private.character_has_fiendish_resilience_v1(p_character_id) then
    return jsonb_build_object('available',false,'reason','Fiendish Resilience requires an XPHB Warlock with the Fiend Patron at the feature level.');
  end if;

  v_acquired_at:=private.fiendish_resilience_acquired_at_v1(p_character_id);

  select max(completed_at) into v_latest_rest
  from public.character_rest_log
  where character_id=p_character_id and rest_type in ('short_rest','long_rest');

  select * into v_runtime
  from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key='fiendish-resilience';

  v_configured:=found
    and coalesce((v_runtime.state->>'configured')::boolean,false)
    and coalesce(v_runtime.state->>'resistance','') in (
      'acid','bludgeoning','cold','fire','lightning','necrotic','piercing','poison','psychic','radiant','slashing','thunder'
    );

  v_can_configure:=not v_configured
    and v_latest_rest is not null
    and v_acquired_at is not null
    and v_latest_rest>v_acquired_at;

  v_can_replace:=v_configured
    and v_latest_rest is not null
    and (v_runtime.replacement_anchor_at is null or v_latest_rest>v_runtime.replacement_anchor_at);

  return jsonb_build_object(
    'available',true,
    'featureKey','fiendish-resilience',
    'featureName','Fiendish Resilience',
    'source','XPHB',
    'cadence','short_or_long_rest',
    'configured',v_configured,
    'canConfigure',v_can_configure,
    'canReplace',v_can_replace,
    'acquiredAt',v_acquired_at,
    'latestQualifyingRestAt',v_latest_rest,
    'replacementAnchorAt',case when found then v_runtime.replacement_anchor_at else null end,
    'state',case when found then v_runtime.state else jsonb_build_object('configured',false) end,
    'options',private.fiendish_resilience_options_v1(),
    'runtimeResistances',to_jsonb(private.character_runtime_damage_resistances_v1(p_character_id)),
    'helper','After gaining Fiendish Resilience, finish a Short or Long Rest to choose one damage type other than Force. The current resistance persists until you replace it after a later Short or Long Rest.'
  );
end;
$$;

create or replace function public.configure_character_fiendish_resilience_v1(
  p_character_id uuid,
  p_damage_type text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_key text:=lower(btrim(coalesce(p_damage_type,'')));
  v_option jsonb;
  v_acquired_at timestamptz;
  v_latest_rest timestamptz;
  v_anchor timestamptz;
  v_state jsonb;
  v_sheet jsonb:='{}'::jsonb;
  v_active_encounter jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to configure Fiendish Resilience for this character.' using errcode='42501';
  end if;
  if not private.character_has_fiendish_resilience_v1(p_character_id) then
    raise exception 'Fiendish Resilience requires an XPHB Warlock with the Fiend Patron at the feature level.';
  end if;

  v_active_encounter:=private.character_active_encounter_v1(p_character_id);
  if v_active_encounter is not null then
    raise exception 'Fiendish Resilience cannot be changed while this character is in an active encounter.';
  end if;

  select entry.value into v_option
  from jsonb_array_elements(private.fiendish_resilience_options_v1()) entry(value)
  where entry.value->>'key'=v_key
  limit 1;
  if v_option is null then
    raise exception 'Choose a Fiendish Resilience damage type other than Force.';
  end if;

  v_acquired_at:=private.fiendish_resilience_acquired_at_v1(p_character_id);
  select max(completed_at) into v_latest_rest
  from public.character_rest_log
  where character_id=p_character_id and rest_type in ('short_rest','long_rest');

  if v_latest_rest is null or v_acquired_at is null or v_latest_rest<=v_acquired_at then
    raise exception 'Finish a Short or Long Rest after gaining Fiendish Resilience before choosing a resistance.';
  end if;

  select * into v_runtime
  from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key='fiendish-resilience'
  for update;

  if found and coalesce((v_runtime.state->>'configured')::boolean,false) then
    if v_runtime.replacement_anchor_at is not null and v_latest_rest<=v_runtime.replacement_anchor_at then
      raise exception 'Finish a newer Short or Long Rest before changing Fiendish Resilience.';
    end if;
  end if;

  v_anchor:=v_latest_rest;
  v_state:=jsonb_build_object(
    'configured',true,
    'resistance',v_key,
    'resistanceName',v_option->>'name',
    'configuredAt',timezone('utc',now()),
    'configuredRestAt',v_latest_rest,
    'previousResistance',case when found then v_runtime.state->>'resistance' else null end
  );

  insert into public.character_runtime_feature_choices(
    character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at
  ) values(
    p_character_id,'fiendish-resilience','Fiendish Resilience','XPHB','short_or_long_rest',v_state,v_anchor,now(),now()
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
  v_sheet:=jsonb_set(v_sheet,'{runtimeFeatures,fiendishResilience}',v_state,true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;

  return public.get_character_fiendish_resilience_v1(p_character_id);
end;
$$;

revoke all on function private.character_has_fiendish_resilience_v1(uuid) from public,anon,authenticated;
revoke all on function private.fiendish_resilience_acquired_at_v1(uuid) from public,anon,authenticated;
revoke all on function private.fiendish_resilience_options_v1() from public,anon,authenticated;
revoke all on function private.character_runtime_damage_resistances_v1(uuid) from public,anon,authenticated;
grant execute on function private.character_has_fiendish_resilience_v1(uuid) to service_role;
grant execute on function private.fiendish_resilience_acquired_at_v1(uuid) to service_role;
grant execute on function private.fiendish_resilience_options_v1() to service_role;
grant execute on function private.character_runtime_damage_resistances_v1(uuid) to service_role;
revoke all on function public.get_character_fiendish_resilience_v1(uuid) from public,anon;
revoke all on function public.configure_character_fiendish_resilience_v1(uuid,text) from public,anon;
grant execute on function public.get_character_fiendish_resilience_v1(uuid) to authenticated,service_role;
grant execute on function public.configure_character_fiendish_resilience_v1(uuid,text) to authenticated,service_role;
