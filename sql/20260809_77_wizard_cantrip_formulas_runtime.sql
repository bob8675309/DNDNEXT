-- Model TCE Cantrip Formulas as PHB Wizard Long-Rest runtime authority.
-- The feature replaces one existing class-owned Wizard cantrip assignment in place;
-- it never adds an extra cantrip row and it does not apply to the XPHB Wizard.

create or replace function private.wizard_cantrip_formulas_feature_level_v1()
returns integer
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $$
  select min(f.level)::integer
  from public.class_feature_catalog f
  where private.normalize_player_choice_name_v1(f.name)=private.normalize_player_choice_name_v1('Cantrip Formulas')
    and lower(coalesce(f.class_key,''))='wizard'
    and upper(coalesce(f.class_source,''))='PHB'
    and upper(coalesce(f.source,''))='TCE'
    and lower(coalesce(f.raw_payload->>'isClassFeatureVariant','false'))='true';
$$;

create or replace function private.wizard_cantrip_formulas_context_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_feature_level integer:=private.wizard_cantrip_formulas_feature_level_v1();
  v_acquired_at timestamptz;
begin
  if p_character_id is null or v_feature_level is null then
    return jsonb_build_object('eligible',false,'featureName','Cantrip Formulas','source','TCE');
  end if;

  select * into v_progression
  from public.character_progression
  where character_id=p_character_id;
  if not found then
    return jsonb_build_object('eligible',false,'featureName','Cantrip Formulas','source','TCE');
  end if;

  select * into v_class
  from public.class_catalog
  where id=v_progression.class_id;
  if not found
     or lower(coalesce(v_class.class_key,''))<>'wizard'
     or upper(coalesce(v_class.source,''))<>'PHB'
     or v_progression.class_level<v_feature_level then
    return jsonb_build_object(
      'eligible',false,
      'featureName','Cantrip Formulas',
      'source','TCE',
      'classSource',coalesce(v_class.source,''),
      'classLevel',coalesce(v_progression.class_level,0),
      'featureLevel',v_feature_level
    );
  end if;

  v_acquired_at:=private.character_class_feature_acquired_at_v1(
    p_character_id,'wizard','PHB',v_feature_level
  );

  return jsonb_build_object(
    'eligible',true,
    'featureName','Cantrip Formulas',
    'source','TCE',
    'className','Wizard',
    'classSource','PHB',
    'classLevel',v_progression.class_level,
    'featureLevel',v_feature_level,
    'acquiredAt',v_acquired_at
  );
end;
$$;

create or replace function private.wizard_cantrip_formulas_options_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_known jsonb:='[]'::jsonb;
  v_replacements jsonb:='[]'::jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'assignmentId',cs.id,
    'spellId',s.id,
    'name',s.name,
    'source',s.source,
    'description',coalesce(s.description,''),
    'prepared',cs.prepared,
    'castingStat',cs.casting_stat
  ) order by s.name),'[]'::jsonb)
  into v_known
  from public.character_spells cs
  join public.spells_catalog s on s.id=cs.spell_id
  where cs.character_id=p_character_id
    and cs.source_type='class'
    and cs.known
    and s.level=0
    and exists(
      select 1 from unnest(coalesce(s.classes,'{}'::text[])) c where lower(c)='wizard'
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'spellId',s.id,
    'name',s.name,
    'source',s.source,
    'description',coalesce(s.description,''),
    'castingTime',coalesce(s.casting_time,'')
  ) order by s.name),'[]'::jsonb)
  into v_replacements
  from public.spells_catalog_preferred s
  where s.level=0
    and exists(
      select 1 from unnest(coalesce(s.classes,'{}'::text[])) c where lower(c)='wizard'
    )
    and not exists(
      select 1
      from public.character_spells cs
      where cs.character_id=p_character_id
        and cs.spell_id=s.id
        and cs.known
    );

  return jsonb_build_object('known',v_known,'replacements',v_replacements);
end;
$$;

create or replace function private.sync_wizard_cantrip_formulas_projection_v1(
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
    v_sheet:=v_sheet #- array['runtimeFeatures','wizardCantripFormulas'];
  else
    v_sheet:=jsonb_set(v_sheet,'{runtimeFeatures,wizardCantripFormulas}',p_state,true);
  end if;

  update public.character_sheets
  set sheet=v_sheet,updated_at=now()
  where character_id=p_character_id;
end;
$$;

create or replace function public.get_character_wizard_cantrip_formulas_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_context jsonb:=private.wizard_cantrip_formulas_context_v1(p_character_id);
  v_options jsonb:='{}'::jsonb;
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_had_runtime boolean:=false;
  v_latest_long_rest timestamptz;
  v_acquired_at timestamptz;
  v_can_configure boolean:=false;
begin
  if not private.can_manage_character_spell_resources_v1(p_character_id) then
    raise exception 'You do not have permission to review Cantrip Formulas for this character.' using errcode='42501';
  end if;
  if not coalesce((v_context->>'eligible')::boolean,false) then
    return jsonb_build_object('available',false,'featureName','Cantrip Formulas','source','TCE','context',v_context);
  end if;

  begin
    v_acquired_at:=(v_context->>'acquiredAt')::timestamptz;
  exception when others then
    v_acquired_at:=null;
  end;

  select max(completed_at) into v_latest_long_rest
  from public.character_rest_log
  where character_id=p_character_id and rest_type='long_rest';

  select * into v_runtime
  from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key='wizard-cantrip-formulas';
  v_had_runtime:=found;

  v_can_configure:=v_latest_long_rest is not null
    and (v_acquired_at is null or v_latest_long_rest>v_acquired_at)
    and (not v_had_runtime or v_latest_long_rest>v_runtime.replacement_anchor_at);

  v_options:=private.wizard_cantrip_formulas_options_v1(p_character_id);

  return jsonb_build_object(
    'available',true,
    'featureName','Cantrip Formulas',
    'source','TCE',
    'cadence','long_rest',
    'context',v_context,
    'latestLongRestAt',v_latest_long_rest,
    'canConfigure',v_can_configure,
    'lastReplacement',case when v_had_runtime then v_runtime.state else '{}'::jsonb end,
    'knownCantrips',coalesce(v_options->'known','[]'::jsonb),
    'replacementOptions',coalesce(v_options->'replacements','[]'::jsonb),
    'helper','After a qualifying Long Rest, replace one class-owned Wizard cantrip you know with another cantrip from the Wizard spell list. The existing class spell assignment is changed in place; no extra cantrip row is created.'
  );
end;
$$;

create or replace function public.configure_character_wizard_cantrip_formulas_v1(
  p_character_id uuid,
  p_from_assignment_id uuid,
  p_to_spell_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_context jsonb:=private.wizard_cantrip_formulas_context_v1(p_character_id);
  v_from_assignment public.character_spells%rowtype;
  v_from_spell public.spells_catalog%rowtype;
  v_to_spell public.spells_catalog%rowtype;
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_had_runtime boolean:=false;
  v_latest_long_rest timestamptz;
  v_acquired_at timestamptz;
  v_state jsonb;
  v_active_encounter jsonb;
begin
  if not private.can_manage_character_spell_resources_v1(p_character_id) then
    raise exception 'You do not have permission to configure Cantrip Formulas for this character.' using errcode='42501';
  end if;
  if not coalesce((v_context->>'eligible')::boolean,false) then
    raise exception 'Cantrip Formulas requires a PHB Wizard of the source-defined feature level or higher.';
  end if;
  if p_from_assignment_id is null or p_to_spell_id is null then
    raise exception 'Choose a known Wizard cantrip to replace and a new Wizard cantrip.';
  end if;

  v_active_encounter:=private.character_active_encounter_v1(p_character_id);
  if v_active_encounter is not null then
    raise exception 'Cantrip Formulas cannot be configured while this character is in an active encounter.';
  end if;

  select cs.* into v_from_assignment
  from public.character_spells cs
  join public.spells_catalog s on s.id=cs.spell_id
  where cs.id=p_from_assignment_id
    and cs.character_id=p_character_id
    and cs.source_type='class'
    and cs.known
    and s.level=0
    and exists(
      select 1 from unnest(coalesce(s.classes,'{}'::text[])) c where lower(c)='wizard'
    )
  for update of cs;
  if not found then
    raise exception 'The cantrip being replaced must be a class-owned Wizard cantrip this character currently knows.';
  end if;

  select * into v_from_spell from public.spells_catalog where id=v_from_assignment.spell_id;
  if not found then raise exception 'The current Wizard cantrip could not be resolved.'; end if;

  select * into v_to_spell from public.spells_catalog where id=p_to_spell_id;
  if not found
     or v_to_spell.level<>0
     or not exists(
       select 1
       from public.spells_catalog_preferred preferred
       where preferred.id=p_to_spell_id
         and preferred.level=0
         and exists(
           select 1 from unnest(coalesce(preferred.classes,'{}'::text[])) c where lower(c)='wizard'
         )
     ) then
    raise exception 'The replacement must be a preferred cantrip from the Wizard spell list.';
  end if;
  if v_from_assignment.spell_id=p_to_spell_id then
    raise exception 'Choose a different Wizard cantrip from the one being replaced.';
  end if;
  if exists(
    select 1
    from public.character_spells cs
    where cs.character_id=p_character_id
      and cs.spell_id=p_to_spell_id
      and cs.known
  ) then
    raise exception 'The character already knows the selected replacement cantrip.';
  end if;

  begin
    v_acquired_at:=(v_context->>'acquiredAt')::timestamptz;
  exception when others then
    v_acquired_at:=null;
  end;

  select max(completed_at) into v_latest_long_rest
  from public.character_rest_log
  where character_id=p_character_id and rest_type='long_rest';
  if v_latest_long_rest is null or (v_acquired_at is not null and v_latest_long_rest<=v_acquired_at) then
    raise exception 'Finish a Long Rest after acquiring Cantrip Formulas before replacing a cantrip.';
  end if;

  select * into v_runtime
  from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key='wizard-cantrip-formulas'
  for update;
  v_had_runtime:=found;
  if v_had_runtime and v_latest_long_rest<=v_runtime.replacement_anchor_at then
    raise exception 'Cantrip Formulas has already been used for this Long Rest.';
  end if;

  update public.character_spells
  set spell_id=p_to_spell_id,
      raw_payload=coalesce(raw_payload,'{}'::jsonb)||jsonb_build_object(
        'cantripFormulas',true,
        'cantripFormulasFeature','Cantrip Formulas',
        'cantripFormulasSource','TCE',
        'cantripFormulasPreviousSpellId',v_from_spell.id,
        'cantripFormulasPreviousCantrip',v_from_spell.name,
        'cantripFormulasConfiguredRestAt',v_latest_long_rest
      ),
      updated_at=now()
  where id=p_from_assignment_id and character_id=p_character_id;
  if not found then raise exception 'The Wizard cantrip assignment changed before Cantrip Formulas could be applied.'; end if;

  v_state:=jsonb_build_object(
    'configured',true,
    'featureKey','wizard-cantrip-formulas',
    'featureName','Cantrip Formulas',
    'source','TCE',
    'classSource','PHB',
    'assignmentId',p_from_assignment_id,
    'fromSpell',jsonb_build_object('spellId',v_from_spell.id,'name',v_from_spell.name,'source',v_from_spell.source),
    'toSpell',jsonb_build_object('spellId',v_to_spell.id,'name',v_to_spell.name,'source',v_to_spell.source),
    'configuredAt',timezone('utc',now()),
    'configuredRestAt',v_latest_long_rest,
    'configuredBy','long_rest_replacement'
  );

  insert into public.character_runtime_feature_choices(
    character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at
  ) values(
    p_character_id,'wizard-cantrip-formulas','Cantrip Formulas','TCE','long_rest',v_state,v_latest_long_rest,now(),now()
  ) on conflict(character_id,feature_key) do update set
    feature_name=excluded.feature_name,
    source=excluded.source,
    cadence=excluded.cadence,
    state=excluded.state,
    replacement_anchor_at=excluded.replacement_anchor_at,
    updated_at=now();

  perform private.sync_wizard_cantrip_formulas_projection_v1(p_character_id,v_state);
  return public.get_character_wizard_cantrip_formulas_v1(p_character_id);
end;
$$;

revoke all on function private.wizard_cantrip_formulas_feature_level_v1() from public,anon,authenticated;
revoke all on function private.wizard_cantrip_formulas_context_v1(uuid) from public,anon,authenticated;
revoke all on function private.wizard_cantrip_formulas_options_v1(uuid) from public,anon,authenticated;
revoke all on function private.sync_wizard_cantrip_formulas_projection_v1(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.wizard_cantrip_formulas_feature_level_v1() to service_role;
grant execute on function private.wizard_cantrip_formulas_context_v1(uuid) to service_role;
grant execute on function private.wizard_cantrip_formulas_options_v1(uuid) to service_role;
grant execute on function private.sync_wizard_cantrip_formulas_projection_v1(uuid,jsonb) to service_role;

revoke all on function public.get_character_wizard_cantrip_formulas_v1(uuid) from public,anon;
revoke all on function public.configure_character_wizard_cantrip_formulas_v1(uuid,uuid,uuid) from public,anon;
grant execute on function public.get_character_wizard_cantrip_formulas_v1(uuid) to authenticated,service_role;
grant execute on function public.configure_character_wizard_cantrip_formulas_v1(uuid,uuid,uuid) to authenticated,service_role;
