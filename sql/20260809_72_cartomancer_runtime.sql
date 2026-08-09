-- BMT Cartomancer authority.
-- Card Tricks permanently grants Prestidigitation through the normalized feat instance.
-- Hidden Ace is Long-Rest runtime state: choose one 1-Action spell from the character's
-- class list at a level for which the character has spell slots. The card lasts 8 hours.
-- Casting/consuming the card as a Bonus Action is action execution and is deliberately
-- not implemented in this migration.

update public.character_option_catalog
set metadata=jsonb_set(
      jsonb_set(
        coalesce(metadata,'{}'::jsonb),
        '{cartomancerFixedSpells}',
        jsonb_build_array('Prestidigitation|XPHB'),
        true
      ),
      '{additionalSpells}',
      '[]'::jsonb,
      true
    ),
    updated_at=now()
where option_type='feat'
  and private.normalize_player_choice_name_v1(name)=private.normalize_player_choice_name_v1('Cartomancer')
  and upper(source)='BMT';

create or replace function private.cartomancer_family_v1(p_option_name text,p_option_source text)
returns boolean
language sql
immutable
set search_path=pg_catalog
as $$
  select lower(regexp_replace(coalesce(p_option_name,''),'[^a-zA-Z0-9]+','','g'))='cartomancer'
     and upper(coalesce(p_option_source,''))='BMT';
$$;

create or replace function private.cartomancer_feature_key_v1(p_instance_key text)
returns text
language sql
immutable
set search_path=pg_catalog
as $$
  select 'cartomancer-hidden-ace:'||substr(md5(coalesce(p_instance_key,'')),1,16);
$$;

create or replace function private.cartomancer_character_context_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
begin
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found then return '{}'::jsonb; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found then return '{}'::jsonb; end if;
  return jsonb_build_object(
    'classId',v_class.id,
    'classKey',v_class.class_key,
    'className',v_class.class_name,
    'classSource',v_class.source,
    'classLevel',v_progression.class_level,
    'spellcastingAbility',lower(coalesce(v_class.spellcasting_ability,''))
  );
end;
$$;

create or replace function private.cartomancer_hidden_ace_spell_options_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_context jsonb:=private.cartomancer_character_context_v1(p_character_id);
  v_class_name text:=v_context->>'className';
  v_output jsonb:='[]'::jsonb;
begin
  if nullif(v_class_name,'') is null or nullif(v_context->>'spellcastingAbility','') is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'spellId',s.id,
    'spellKey',s.spell_key,
    'name',s.name,
    'source',s.source,
    'level',s.level,
    'school',s.school,
    'castingTime',s.casting_time
  ) order by s.level,s.name),'[]'::jsonb)
  into v_output
  from public.spells_catalog_preferred s
  where s.level between 1 and 9
    and exists(
      select 1 from unnest(coalesce(s.classes,'{}'::text[])) class_name
      where private.normalize_player_choice_name_v1(class_name)=private.normalize_player_choice_name_v1(v_class_name)
    )
    and exists(
      select 1 from public.character_spell_slots css
      where css.character_id=p_character_id
        and css.slot_level=s.level
        and css.slots_max>0
    )
    and exists(
      select 1 from jsonb_array_elements(coalesce(s.casting_time_json,'[]'::jsonb)) entry(value)
      where coalesce((entry.value->>'number')::integer,0)=1
        and lower(coalesce(entry.value->>'unit',''))='action'
    );
  return v_output;
end;
$$;

create or replace function private.sync_cartomancer_projection_v1(p_character_id uuid)
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
  where character_id=p_character_id and feature_key like 'cartomancer-hidden-ace:%'
  order by updated_at desc limit 1;
  if found then
    v_projection:=jsonb_build_object(
      'instanceKey',v_runtime.state->>'instanceKey',
      'spell',coalesce(v_runtime.state->'spell','{}'::jsonb),
      'selectedAt',v_runtime.state->>'selectedAt',
      'expiresAt',v_runtime.state->>'expiresAt',
      'consumed',coalesce((v_runtime.state->>'consumed')::boolean,false),
      'replacementAnchorAt',v_runtime.replacement_anchor_at
    );
  end if;

  if coalesce(jsonb_typeof(v_sheet->'runtimeFeatures'),'')<>'object' then
    v_sheet:=jsonb_set(v_sheet,'{runtimeFeatures}','{}'::jsonb,true);
  end if;
  v_sheet:=jsonb_set(v_sheet,'{runtimeFeatures,cartomancerHiddenAce}',v_projection,true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  return v_projection;
end;
$$;

create or replace function private.materialize_cartomancer_instance_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_context jsonb;
  v_stat text;
  v_spell public.spells_catalog%rowtype;
begin
  if not private.cartomancer_family_v1(new.option_name,new.option_source) then return new; end if;
  v_context:=private.cartomancer_character_context_v1(new.character_id);
  v_stat:=nullif(v_context->>'spellcastingAbility','');
  if v_stat is null then raise exception 'Cartomancer requires a class with the Spellcasting feature.'; end if;

  select * into v_spell from public.spells_catalog_preferred
  where private.normalize_player_choice_name_v1(name)=private.normalize_player_choice_name_v1('Prestidigitation')
    and level=0
  order by case when source='XPHB' then 0 when source='PHB' then 1 else 2 end,name
  limit 1;
  if v_spell.id is null then raise exception 'Cartomancer could not resolve Prestidigitation.'; end if;

  if not exists(
    select 1 from public.character_spells
    where character_id=new.character_id and spell_id=v_spell.id and source_type='feat' and source_key=new.instance_key
  ) then
    insert into public.character_spells(
      character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,
      casting_stat,raw_payload,created_at,updated_at
    ) values(
      new.character_id,v_spell.id,'feat',new.instance_key,'Cartomancer • Card Tricks',true,true,true,
      v_stat,jsonb_build_object(
        'cartomancer',true,'cardTricks',true,'sourceFeat','Cartomancer','source','BMT',
        'instanceKey',new.instance_key,'grantedAtLevel',new.acquisition_level
      ),now(),now()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists character_option_grant_instance_cartomancer_v1 on public.character_option_grant_instances;
create trigger character_option_grant_instance_cartomancer_v1
after insert on public.character_option_grant_instances
for each row execute function private.materialize_cartomancer_instance_v1();

create or replace function private.expire_cartomancer_hidden_ace_on_long_rest_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
begin
  if new.rest_type<>'long_rest' then return new; end if;
  delete from public.character_runtime_feature_choices
  where character_id=new.character_id and feature_key like 'cartomancer-hidden-ace:%';
  if found then perform private.sync_cartomancer_projection_v1(new.character_id); end if;
  return new;
end;
$$;

drop trigger if exists character_rest_log_expire_cartomancer_hidden_ace_v1 on public.character_rest_log;
create trigger character_rest_log_expire_cartomancer_hidden_ace_v1
after insert on public.character_rest_log
for each row execute function private.expire_cartomancer_hidden_ace_on_long_rest_v1();

create or replace function public.get_character_cartomancer_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_grant public.character_option_grant_instances%rowtype;
  v_context jsonb:=private.cartomancer_character_context_v1(p_character_id);
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_feature_key text;
  v_latest_long_rest timestamptz;
  v_expires_at timestamptz;
  v_active boolean:=false;
  v_can_configure boolean:=false;
  v_prestidigitation boolean:=false;
  v_options jsonb:='[]'::jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to review Cartomancer for this character.' using errcode='42501';
  end if;

  select * into v_grant from public.character_option_grant_instances
  where character_id=p_character_id and private.cartomancer_family_v1(option_name,option_source)
  order by acquisition_level nulls first,instance_key limit 1;
  if not found then
    return jsonb_build_object('available',false,'featureName','Cartomancer','source','BMT','options','[]'::jsonb);
  end if;

  v_feature_key:=private.cartomancer_feature_key_v1(v_grant.instance_key);
  select * into v_runtime from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key=v_feature_key;
  select max(completed_at) into v_latest_long_rest
  from public.character_rest_log where character_id=p_character_id and rest_type='long_rest';

  if found then
    begin v_expires_at:=(v_runtime.state->>'expiresAt')::timestamptz; exception when others then v_expires_at:=null; end;
    v_active:=coalesce((v_runtime.state->>'configured')::boolean,false)
      and not coalesce((v_runtime.state->>'consumed')::boolean,false)
      and v_expires_at is not null and v_expires_at>now();
    v_can_configure:=v_latest_long_rest is not null
      and v_latest_long_rest>v_runtime.replacement_anchor_at
      and v_latest_long_rest+interval '8 hours'>now();
  else
    v_can_configure:=v_latest_long_rest is not null
      and v_latest_long_rest>v_grant.created_at
      and v_latest_long_rest+interval '8 hours'>now();
  end if;

  select exists(
    select 1 from public.character_spells cs join public.spells_catalog s on s.id=cs.spell_id
    where cs.character_id=p_character_id and cs.source_type='feat' and cs.source_key=v_grant.instance_key
      and private.normalize_player_choice_name_v1(s.name)=private.normalize_player_choice_name_v1('Prestidigitation')
  ) into v_prestidigitation;
  v_options:=private.cartomancer_hidden_ace_spell_options_v1(p_character_id);

  return jsonb_build_object(
    'available',true,
    'featureName','Cartomancer',
    'source','BMT',
    'instanceKey',v_grant.instance_key,
    'class',v_context,
    'cardTricksPrestidigitation',v_prestidigitation,
    'hiddenAceConfigured',found,
    'hiddenAceActive',v_active,
    'hiddenAceExpired',found and not v_active and not coalesce((v_runtime.state->>'consumed')::boolean,false),
    'canConfigureHiddenAce',v_can_configure,
    'latestLongRestAt',v_latest_long_rest,
    'state',case when found then v_runtime.state else '{}'::jsonb end,
    'options',v_options,
    'actionIntegration','deferred',
    'helper','Hidden Ace is chosen after a Long Rest, must be a 1-Action class spell at a level for which you have spell slots, and remains imbued for 8 hours. Bonus Action casting/consumption is not wired in this non-combat slice.'
  );
end;
$$;

create or replace function public.configure_character_cartomancer_hidden_ace_v1(
  p_character_id uuid,
  p_instance_key text,
  p_spell_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_grant public.character_option_grant_instances%rowtype;
  v_feature_key text;
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_latest_long_rest timestamptz;
  v_spell jsonb;
  v_state jsonb;
  v_active_encounter jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to configure Cartomancer for this character.' using errcode='42501';
  end if;
  select * into v_grant from public.character_option_grant_instances
  where character_id=p_character_id and instance_key=p_instance_key
    and private.cartomancer_family_v1(option_name,option_source)
  for update;
  if not found then raise exception 'The requested Cartomancer feat instance is unavailable.'; end if;

  v_active_encounter:=private.character_active_encounter_v1(p_character_id);
  if v_active_encounter is not null then raise exception 'Hidden Ace cannot be configured while this character is in an active encounter.'; end if;

  select max(completed_at) into v_latest_long_rest
  from public.character_rest_log where character_id=p_character_id and rest_type='long_rest';
  if v_latest_long_rest is null or v_latest_long_rest<=v_grant.created_at then
    raise exception 'Finish a Long Rest after gaining Cartomancer before choosing Hidden Ace.';
  end if;
  if v_latest_long_rest+interval '8 hours'<=now() then
    raise exception 'The current Hidden Ace selection window has expired; finish another Long Rest.';
  end if;

  v_feature_key:=private.cartomancer_feature_key_v1(v_grant.instance_key);
  select * into v_runtime from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key=v_feature_key for update;
  if found and v_latest_long_rest<=v_runtime.replacement_anchor_at then
    raise exception 'Hidden Ace has already been chosen for this Long Rest.';
  end if;

  select entry.value into v_spell
  from jsonb_array_elements(private.cartomancer_hidden_ace_spell_options_v1(p_character_id)) entry(value)
  where entry.value->>'spellId'=p_spell_id::text
  limit 1;
  if v_spell is null then
    raise exception 'Hidden Ace must use a 1-Action spell from your class list at a level for which you have spell slots.';
  end if;

  v_state:=jsonb_build_object(
    'configured',true,
    'instanceKey',v_grant.instance_key,
    'spell',v_spell,
    'selectedAt',v_latest_long_rest,
    'expiresAt',v_latest_long_rest+interval '8 hours',
    'consumed',false,
    'configuredBy','long_rest_configuration',
    'actionIntegration','deferred'
  );
  insert into public.character_runtime_feature_choices(
    character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at
  ) values(
    p_character_id,v_feature_key,'Cartomancer Hidden Ace','BMT','long_rest',v_state,v_latest_long_rest,now(),now()
  ) on conflict(character_id,feature_key) do update set
    feature_name=excluded.feature_name,source=excluded.source,cadence=excluded.cadence,
    state=excluded.state,replacement_anchor_at=excluded.replacement_anchor_at,updated_at=now();
  perform private.sync_cartomancer_projection_v1(p_character_id);
  return public.get_character_cartomancer_v1(p_character_id);
end;
$$;

revoke all on function private.cartomancer_family_v1(text,text) from public,anon,authenticated;
revoke all on function private.cartomancer_feature_key_v1(text) from public,anon,authenticated;
revoke all on function private.cartomancer_character_context_v1(uuid) from public,anon,authenticated;
revoke all on function private.cartomancer_hidden_ace_spell_options_v1(uuid) from public,anon,authenticated;
revoke all on function private.sync_cartomancer_projection_v1(uuid) from public,anon,authenticated;
revoke all on function private.materialize_cartomancer_instance_v1() from public,anon,authenticated;
revoke all on function private.expire_cartomancer_hidden_ace_on_long_rest_v1() from public,anon,authenticated;
grant execute on function private.cartomancer_family_v1(text,text) to service_role;
grant execute on function private.cartomancer_feature_key_v1(text) to service_role;
grant execute on function private.cartomancer_character_context_v1(uuid) to service_role;
grant execute on function private.cartomancer_hidden_ace_spell_options_v1(uuid) to service_role;
grant execute on function private.sync_cartomancer_projection_v1(uuid) to service_role;
grant execute on function private.materialize_cartomancer_instance_v1() to service_role;
grant execute on function private.expire_cartomancer_hidden_ace_on_long_rest_v1() to service_role;

revoke all on function public.get_character_cartomancer_v1(uuid) from public,anon;
revoke all on function public.configure_character_cartomancer_hidden_ace_v1(uuid,text,uuid) from public,anon;
grant execute on function public.get_character_cartomancer_v1(uuid) to authenticated,service_role;
grant execute on function public.configure_character_cartomancer_hidden_ace_v1(uuid,text,uuid) to authenticated,service_role;
