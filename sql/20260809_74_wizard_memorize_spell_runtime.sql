-- XPHB Wizard Memorize Spell runtime authority.
-- After a qualifying Short Rest, replace one prepared level-1+ Wizard spell from
-- the actual spellbook with another level-1+ spell in that spellbook.
-- Spellbook membership remains unchanged; character_spells.prepared is authority.

create or replace function private.wizard_memorize_spell_feature_level_v1()
returns integer
language sql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
  select min(level)::integer
  from public.class_feature_catalog
  where lower(class_key)='wizard'
    and upper(class_source)='XPHB'
    and private.normalize_player_choice_name_v1(name)=private.normalize_player_choice_name_v1('Memorize Spell');
$$;

create or replace function private.wizard_memorize_spell_context_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_feature_level integer:=private.wizard_memorize_spell_feature_level_v1();
  v_acquired_at timestamptz;
begin
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found or v_feature_level is null then return jsonb_build_object('eligible',false); end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found or lower(coalesce(v_class.class_key,''))<>'wizard' or upper(coalesce(v_class.source,''))<>'XPHB' or v_progression.class_level<v_feature_level then
    return jsonb_build_object('eligible',false,'featureLevel',v_feature_level);
  end if;
  v_acquired_at:=private.character_class_feature_acquired_at_v1(p_character_id,'wizard','XPHB',v_feature_level);
  return jsonb_build_object(
    'eligible',true,
    'classId',v_class.id,
    'classKey',v_class.class_key,
    'className',v_class.class_name,
    'classSource',v_class.source,
    'classLevel',v_progression.class_level,
    'featureLevel',v_feature_level,
    'acquiredAt',v_acquired_at
  );
end;
$$;

create or replace function private.wizard_memorize_spell_options_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_prepared jsonb:='[]'::jsonb;
  v_unprepared jsonb:='[]'::jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'spellId',s.id,'name',s.name,'source',s.source,'level',s.level,'school',s.school,
    'sourceType',cs.source_type,'sourceKey',cs.source_key
  ) order by s.level,s.name),'[]'::jsonb)
  into v_prepared
  from public.character_spells cs
  join public.spells_catalog_preferred s on s.id=cs.spell_id
  where cs.character_id=p_character_id
    and s.level>=1
    and coalesce(cs.prepared,false)
    and not coalesce(cs.always_available,false)
    and private.wizard_spellbook_has_spell_v1(p_character_id,cs.spell_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'spellId',s.id,'name',s.name,'source',s.source,'level',s.level,'school',s.school,
    'sourceType',cs.source_type,'sourceKey',cs.source_key
  ) order by s.level,s.name),'[]'::jsonb)
  into v_unprepared
  from public.character_spells cs
  join public.spells_catalog_preferred s on s.id=cs.spell_id
  where cs.character_id=p_character_id
    and s.level>=1
    and not coalesce(cs.prepared,false)
    and private.wizard_spellbook_has_spell_v1(p_character_id,cs.spell_id);

  return jsonb_build_object('prepared',v_prepared,'unprepared',v_unprepared);
end;
$$;

create or replace function private.sync_wizard_memorize_spell_projection_v1(p_character_id uuid)
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
  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  if not found then return '{}'::jsonb; end if;
  select * into v_runtime from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key='wizard-memorize-spell';
  if found then
    v_projection:=jsonb_build_object(
      'restAt',v_runtime.state->>'restAt',
      'fromSpell',coalesce(v_runtime.state->'fromSpell','{}'::jsonb),
      'toSpell',coalesce(v_runtime.state->'toSpell','{}'::jsonb),
      'configuredAt',v_runtime.state->>'configuredAt'
    );
  end if;
  if coalesce(jsonb_typeof(v_sheet->'runtimeFeatures'),'')<>'object' then
    v_sheet:=jsonb_set(v_sheet,'{runtimeFeatures}','{}'::jsonb,true);
  end if;
  v_sheet:=jsonb_set(v_sheet,'{runtimeFeatures,wizardMemorizeSpell}',v_projection,true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  return v_projection;
end;
$$;

create or replace function public.get_character_wizard_memorize_spell_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_context jsonb:=private.wizard_memorize_spell_context_v1(p_character_id);
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_latest_short_rest timestamptz;
  v_acquired_at timestamptz;
  v_can_configure boolean:=false;
  v_options jsonb:='{}'::jsonb;
begin
  if not private.can_manage_character_spell_resources_v1(p_character_id) then
    raise exception 'You do not have permission to review Memorize Spell for this character.' using errcode='42501';
  end if;
  if not coalesce((v_context->>'eligible')::boolean,false) then
    return jsonb_build_object('available',false,'featureName','Memorize Spell','source','XPHB');
  end if;
  begin v_acquired_at:=(v_context->>'acquiredAt')::timestamptz; exception when others then v_acquired_at:=null; end;
  select max(completed_at) into v_latest_short_rest
  from public.character_rest_log
  where character_id=p_character_id and rest_type='short_rest';
  select * into v_runtime from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key='wizard-memorize-spell';
  v_can_configure:=v_latest_short_rest is not null
    and (v_acquired_at is null or v_latest_short_rest>v_acquired_at)
    and (not found or v_latest_short_rest>v_runtime.replacement_anchor_at);
  v_options:=private.wizard_memorize_spell_options_v1(p_character_id);
  return jsonb_build_object(
    'available',true,
    'featureName','Memorize Spell',
    'source','XPHB',
    'cadence','short_rest',
    'context',v_context,
    'latestShortRestAt',v_latest_short_rest,
    'canConfigure',v_can_configure,
    'lastSwap',case when found then v_runtime.state else '{}'::jsonb end,
    'preparedOptions',coalesce(v_options->'prepared','[]'::jsonb),
    'unpreparedOptions',coalesce(v_options->'unprepared','[]'::jsonb),
    'helper','After a qualifying Short Rest, replace one prepared level-1+ Wizard spell with another level-1+ spell from your actual spellbook. Spellbook membership does not change.'
  );
end;
$$;

create or replace function public.configure_character_wizard_memorize_spell_v1(
  p_character_id uuid,
  p_from_spell_id uuid,
  p_to_spell_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_context jsonb:=private.wizard_memorize_spell_context_v1(p_character_id);
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_latest_short_rest timestamptz;
  v_acquired_at timestamptz;
  v_from public.character_spells%rowtype;
  v_to public.character_spells%rowtype;
  v_from_spell public.spells_catalog%rowtype;
  v_to_spell public.spells_catalog%rowtype;
  v_state jsonb;
  v_active_encounter jsonb;
begin
  if not private.can_manage_character_spell_resources_v1(p_character_id) then
    raise exception 'You do not have permission to configure Memorize Spell for this character.' using errcode='42501';
  end if;
  if not coalesce((v_context->>'eligible')::boolean,false) then raise exception 'Memorize Spell is unavailable for this character.'; end if;
  if p_from_spell_id is null or p_to_spell_id is null or p_from_spell_id=p_to_spell_id then raise exception 'Choose two different Wizard spellbook spells.'; end if;
  v_active_encounter:=private.character_active_encounter_v1(p_character_id);
  if v_active_encounter is not null then raise exception 'Memorize Spell cannot be configured while this character is in an active encounter.'; end if;
  begin v_acquired_at:=(v_context->>'acquiredAt')::timestamptz; exception when others then v_acquired_at:=null; end;
  select max(completed_at) into v_latest_short_rest from public.character_rest_log where character_id=p_character_id and rest_type='short_rest';
  if v_latest_short_rest is null or (v_acquired_at is not null and v_latest_short_rest<=v_acquired_at) then raise exception 'Finish a Short Rest after gaining Memorize Spell before using it.'; end if;
  select * into v_runtime from public.character_runtime_feature_choices where character_id=p_character_id and feature_key='wizard-memorize-spell' for update;
  if found and v_latest_short_rest<=v_runtime.replacement_anchor_at then raise exception 'Memorize Spell has already been used for this Short Rest.'; end if;

  select * into v_from from public.character_spells where character_id=p_character_id and spell_id=p_from_spell_id for update;
  select * into v_to from public.character_spells where character_id=p_character_id and spell_id=p_to_spell_id for update;
  if v_from.character_id is null or v_to.character_id is null then raise exception 'Both Memorize Spell choices must already belong to the Wizard spellbook.'; end if;
  if not private.wizard_spellbook_has_spell_v1(p_character_id,p_from_spell_id) or not private.wizard_spellbook_has_spell_v1(p_character_id,p_to_spell_id) then raise exception 'Both Memorize Spell choices must already belong to the Wizard spellbook.'; end if;
  select * into v_from_spell from public.spells_catalog where id=p_from_spell_id;
  select * into v_to_spell from public.spells_catalog where id=p_to_spell_id;
  if coalesce(v_from_spell.level,0)<1 or coalesce(v_to_spell.level,0)<1 then raise exception 'Memorize Spell only replaces level-1+ spells.'; end if;
  if not coalesce(v_from.prepared,false) or coalesce(v_from.always_available,false) then raise exception 'The spell being replaced must be a currently prepared Wizard spell that is not always prepared.'; end if;
  if coalesce(v_to.prepared,false) then raise exception 'The replacement spell must currently be unprepared.'; end if;

  update public.character_spells set prepared=false,updated_at=now() where character_id=p_character_id and spell_id=p_from_spell_id;
  update public.character_spells set prepared=true,updated_at=now() where character_id=p_character_id and spell_id=p_to_spell_id;

  v_state:=jsonb_build_object(
    'configured',true,
    'restAt',v_latest_short_rest,
    'fromSpell',jsonb_build_object('spellId',v_from_spell.id,'name',v_from_spell.name,'source',v_from_spell.source,'level',v_from_spell.level),
    'toSpell',jsonb_build_object('spellId',v_to_spell.id,'name',v_to_spell.name,'source',v_to_spell.source,'level',v_to_spell.level),
    'configuredAt',timezone('utc',now()),
    'configuredBy','short_rest_replacement'
  );
  insert into public.character_runtime_feature_choices(
    character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at
  ) values(
    p_character_id,'wizard-memorize-spell','Memorize Spell','XPHB','short_rest',v_state,v_latest_short_rest,now(),now()
  ) on conflict(character_id,feature_key) do update set
    feature_name=excluded.feature_name,source=excluded.source,cadence=excluded.cadence,state=excluded.state,
    replacement_anchor_at=excluded.replacement_anchor_at,updated_at=now();
  perform private.sync_wizard_memorize_spell_projection_v1(p_character_id);
  return public.get_character_wizard_memorize_spell_v1(p_character_id);
end;
$$;

revoke all on function private.wizard_memorize_spell_feature_level_v1() from public,anon,authenticated;
revoke all on function private.wizard_memorize_spell_context_v1(uuid) from public,anon,authenticated;
revoke all on function private.wizard_memorize_spell_options_v1(uuid) from public,anon,authenticated;
revoke all on function private.sync_wizard_memorize_spell_projection_v1(uuid) from public,anon,authenticated;
grant execute on function private.wizard_memorize_spell_feature_level_v1() to service_role;
grant execute on function private.wizard_memorize_spell_context_v1(uuid) to service_role;
grant execute on function private.wizard_memorize_spell_options_v1(uuid) to service_role;
grant execute on function private.sync_wizard_memorize_spell_projection_v1(uuid) to service_role;

revoke all on function public.get_character_wizard_memorize_spell_v1(uuid) from public,anon;
revoke all on function public.configure_character_wizard_memorize_spell_v1(uuid,uuid,uuid) from public,anon;
grant execute on function public.get_character_wizard_memorize_spell_v1(uuid) to authenticated,service_role;
grant execute on function public.configure_character_wizard_memorize_spell_v1(uuid,uuid,uuid) to authenticated,service_role;
