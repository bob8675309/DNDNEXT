-- Astral Elf / Astral Trance runtime proficiency authority.
-- Source: AAG Astral Elf. Astral Trance is not a permanent Forge choice.
-- After a Long Rest/trance, choose one skill and one PHB weapon or tool proficiency;
-- both expire at the next Long Rest before a new pair is configured.

create or replace function private.astral_trance_skill_key_v1(p_name text)
returns text
language sql
immutable
security definer
set search_path=pg_catalog,public,private,auth
as $$
  select case private.normalize_player_choice_name_v1(p_name)
    when 'animal handling' then 'animalHandling'
    when 'sleight of hand' then 'sleightOfHand'
    when 'acrobatics' then 'acrobatics'
    when 'arcana' then 'arcana'
    when 'athletics' then 'athletics'
    when 'deception' then 'deception'
    when 'history' then 'history'
    when 'insight' then 'insight'
    when 'intimidation' then 'intimidation'
    when 'investigation' then 'investigation'
    when 'medicine' then 'medicine'
    when 'nature' then 'nature'
    when 'perception' then 'perception'
    when 'performance' then 'performance'
    when 'persuasion' then 'persuasion'
    when 'religion' then 'religion'
    when 'stealth' then 'stealth'
    when 'survival' then 'survival'
    else null
  end;
$$;

create or replace function private.astral_trance_skill_options_v1()
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'key',private.astral_trance_skill_key_v1(c.name),
    'name',c.name,
    'ability',coalesce(c.metadata->>'ability',''),
    'catalogSource',c.source
  ) order by c.name),'[]'::jsonb)
  from public.character_option_catalog_preferred c
  where c.option_type='skill'
    and private.astral_trance_skill_key_v1(c.name) is not null;
$$;

create or replace function private.astral_trance_training_options_v1()
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
  -- AAG references the PHB equipment list. DNDNext globally prefers the 2024
  -- PHB catalogue row when names are duplicated, while retaining the PHB set's
  -- weapon/tool semantics. Firearms remain excluded by campaign platform policy.
  select coalesce(jsonb_agg(jsonb_build_object(
    'itemId',i.id,
    'itemKey',i.item_key,
    'name',i.item_name,
    'kind',case when lower(coalesce(i.item_type,'')) like '%weapon' then 'weapon' else 'tool' end,
    'itemType',i.item_type,
    'catalogSource',coalesce(i.payload->>'source','XPHB')
  ) order by case when lower(coalesce(i.item_type,'')) like '%weapon' then 0 else 1 end,i.item_name),'[]'::jsonb)
  from public.items_catalog i
  where lower(coalesce(i.item_rarity,''))='mundane'
    and coalesce(i.payload->>'source','')='XPHB'
    and lower(i.item_name) not in ('musket','pistol')
    and (
      lower(coalesce(i.item_type,'')) in ('melee weapon','ranged weapon','tools','instrument')
    );
$$;

create or replace function private.character_has_astral_trance_v1(p_character_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_sheet jsonb:='{}'::jsonb;
  v_species text;
  v_source text;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets where character_id=p_character_id;
  if not found then return false; end if;
  v_species:=private.normalize_player_choice_name_v1(coalesce(v_sheet->>'species',v_sheet->>'race',v_sheet#>>'{meta,species}',''));
  v_source:=upper(btrim(coalesce(v_sheet#>>'{meta,speciesSource}','')));
  return v_species='astral elf' and v_source='AAG';
end;
$$;

create or replace function private.clear_astral_trance_runtime_projection_v1(p_character_id uuid,p_expired_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_sheet jsonb:='{}'::jsonb;
  v_expired timestamptz:=coalesce(p_expired_at,timezone('utc',now()));
begin
  select * into v_runtime from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key='astral-trance'
  for update;
  if not found then return jsonb_build_object('cleared',false,'reason','not configured'); end if;

  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets where character_id=p_character_id for update;
  if found then
    v_sheet:=v_sheet #- array['runtimeProficiencies','astralTrance'];
    update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  end if;

  update public.character_runtime_feature_choices
  set state=jsonb_build_object(
        'configured',false,
        'expiredAt',v_expired,
        'previousSkill',v_runtime.state->'skill',
        'previousTraining',v_runtime.state->'training'
      ),
      replacement_anchor_at=v_expired,
      updated_at=now()
  where character_id=p_character_id and feature_key='astral-trance';

  return jsonb_build_object('cleared',true,'expiredAt',v_expired);
end;
$$;

create or replace function private.expire_astral_trance_after_long_rest_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
begin
  if new.rest_type='long_rest' and private.character_has_astral_trance_v1(new.character_id) then
    perform private.clear_astral_trance_runtime_projection_v1(new.character_id,new.completed_at);
  end if;
  return new;
end;
$$;

drop trigger if exists character_rest_expire_astral_trance_v1 on public.character_rest_log;
create trigger character_rest_expire_astral_trance_v1
after insert on public.character_rest_log
for each row execute function private.expire_astral_trance_after_long_rest_v1();

create or replace function public.get_character_astral_trance_v1(p_character_id uuid)
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
  v_can_configure boolean:=false;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to review Astral Trance for this character.' using errcode='42501';
  end if;
  if not private.character_has_astral_trance_v1(p_character_id) then
    return jsonb_build_object('available',false,'reason','Astral Trance is available only to an AAG Astral Elf.');
  end if;

  select max(completed_at) into v_latest_long_rest
  from public.character_rest_log
  where character_id=p_character_id and rest_type='long_rest';

  select * into v_runtime from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key='astral-trance';
  v_configured:=found
    and coalesce((v_runtime.state->>'configured')::boolean,false)
    and coalesce(v_runtime.state#>>'{skill,key}','')<>''
    and coalesce(v_runtime.state#>>'{training,itemId}','')<>'';
  v_can_configure:=v_latest_long_rest is not null and not v_configured;

  return jsonb_build_object(
    'available',true,
    'featureKey','astral-trance',
    'featureName','Astral Trance',
    'source','AAG',
    'cadence','long_rest',
    'configured',v_configured,
    'canConfigure',v_can_configure,
    'latestLongRestAt',v_latest_long_rest,
    'replacementAnchorAt',case when found then v_runtime.replacement_anchor_at else null end,
    'state',case when found then v_runtime.state else jsonb_build_object('configured',false) end,
    'skillOptions',private.astral_trance_skill_options_v1(),
    'trainingOptions',private.astral_trance_training_options_v1(),
    'helper','Astral Trance is chosen after a Long Rest, not during character creation. Choose one skill and one PHB weapon or tool proficiency. Both expire at the next Long Rest, when a new pair can be chosen.'
  );
end;
$$;

create or replace function public.configure_character_astral_trance_v1(p_character_id uuid,p_skill_key text,p_training_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_skill jsonb;
  v_training jsonb;
  v_latest_long_rest timestamptz;
  v_sheet jsonb:='{}'::jsonb;
  v_state jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to configure Astral Trance for this character.' using errcode='42501';
  end if;
  if not private.character_has_astral_trance_v1(p_character_id) then
    raise exception 'Astral Trance requires an AAG Astral Elf.';
  end if;

  select entry.value into v_skill
  from jsonb_array_elements(private.astral_trance_skill_options_v1()) entry(value)
  where entry.value->>'key'=btrim(coalesce(p_skill_key,''))
  limit 1;
  if v_skill is null then raise exception 'Choose one source-legal Astral Trance skill proficiency.'; end if;

  select entry.value into v_training
  from jsonb_array_elements(private.astral_trance_training_options_v1()) entry(value)
  where entry.value->>'itemId'=p_training_item_id::text
  limit 1;
  if v_training is null then raise exception 'Choose one source-legal Astral Trance PHB weapon or tool proficiency.'; end if;

  select max(completed_at) into v_latest_long_rest
  from public.character_rest_log
  where character_id=p_character_id and rest_type='long_rest';
  if v_latest_long_rest is null then
    raise exception 'Finish a Long Rest before choosing Astral Trance proficiencies.';
  end if;

  select * into v_runtime from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key='astral-trance'
  for update;
  if found and coalesce((v_runtime.state->>'configured')::boolean,false) then
    raise exception 'Astral Trance proficiencies are already chosen for the current Long Rest.';
  end if;

  v_state:=jsonb_build_object(
    'configured',true,
    'configuredRestAt',v_latest_long_rest,
    'skill',v_skill,
    'training',v_training
  );

  insert into public.character_runtime_feature_choices(
    character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at
  ) values(
    p_character_id,'astral-trance','Astral Trance','AAG','long_rest',v_state,v_latest_long_rest,now(),now()
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
  v_sheet:=jsonb_set(v_sheet,'{runtimeProficiencies,astralTrance}',v_state,true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;

  return public.get_character_astral_trance_v1(p_character_id);
end;
$$;

revoke all on function private.astral_trance_skill_key_v1(text) from public,anon,authenticated;
revoke all on function private.astral_trance_skill_options_v1() from public,anon,authenticated;
revoke all on function private.astral_trance_training_options_v1() from public,anon,authenticated;
revoke all on function private.character_has_astral_trance_v1(uuid) from public,anon,authenticated;
revoke all on function private.clear_astral_trance_runtime_projection_v1(uuid,timestamptz) from public,anon,authenticated;
revoke all on function private.expire_astral_trance_after_long_rest_v1() from public,anon,authenticated;
grant execute on function private.astral_trance_skill_key_v1(text) to service_role;
grant execute on function private.astral_trance_skill_options_v1() to service_role;
grant execute on function private.astral_trance_training_options_v1() to service_role;
grant execute on function private.character_has_astral_trance_v1(uuid) to service_role;
grant execute on function private.clear_astral_trance_runtime_projection_v1(uuid,timestamptz) to service_role;
grant execute on function private.expire_astral_trance_after_long_rest_v1() to service_role;
revoke all on function public.get_character_astral_trance_v1(uuid) from public,anon;
revoke all on function public.configure_character_astral_trance_v1(uuid,text,uuid) from public,anon;
grant execute on function public.get_character_astral_trance_v1(uuid) to authenticated,service_role;
grant execute on function public.configure_character_astral_trance_v1(uuid,text,uuid) to authenticated,service_role;
