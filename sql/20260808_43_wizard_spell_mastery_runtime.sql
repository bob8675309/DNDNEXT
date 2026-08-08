-- Model XPHB Wizard Spell Mastery as Long-Rest-reconfigurable runtime state.
-- The selected spells remain existing Wizard spellbook assignments. Spell Mastery
-- overlays preparation/at-will metadata and never creates duplicate spell rows.

create table if not exists private.character_spell_mastery (
  character_id uuid primary key references public.characters(id) on delete cascade,
  level1_spell_id uuid not null references public.spells_catalog(id),
  level2_spell_id uuid not null references public.spells_catalog(id),
  configured_at timestamptz not null default now(),
  last_replacement_rest_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create or replace function private.wizard_spell_mastery_candidate_v1(
  p_character_id uuid,
  p_spell_id uuid,
  p_expected_level integer
)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
  select exists(
    select 1
    from public.spells_catalog s
    where s.id=p_spell_id
      and s.level=p_expected_level
      and lower(regexp_replace(btrim(coalesce(s.casting_time,'')),'\s+',' ','g')) in ('action','1 action')
      and exists(select 1 from unnest(coalesce(s.classes,'{}'::text[])) c where lower(c)='wizard')
      and private.wizard_spellbook_has_spell_v1(p_character_id,s.id)
  );
$$;

create or replace function private.apply_wizard_spell_mastery_overlay_v1(
  p_character_id uuid,
  p_spell_id uuid,
  p_spell_level integer
)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_count integer:=0;
begin
  update public.character_spells cs
  set prepared=true,
      always_available=true,
      raw_payload=coalesce(cs.raw_payload,'{}'::jsonb)||jsonb_build_object(
        'spellMastery',true,
        'spellMasteryLevel',p_spell_level,
        'spellMasteryFeature','Spell Mastery',
        'spellMasteryPriorPrepared',cs.prepared,
        'spellMasteryPriorAlwaysAvailable',cs.always_available
      ),
      updated_at=now()
  where cs.character_id=p_character_id
    and cs.spell_id=p_spell_id
    and (
      cs.source_type='class'
      or (cs.source_type='class-feature' and coalesce((cs.raw_payload->>'wizardSpellbook')::boolean,false))
    );
  get diagnostics v_count=row_count;
  if v_count<>1 then
    raise exception 'Spell Mastery could not resolve exactly one Wizard spellbook assignment for the selected spell.';
  end if;
end;
$$;

create or replace function private.clear_wizard_spell_mastery_overlay_v1(
  p_character_id uuid,
  p_spell_id uuid
)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
begin
  update public.character_spells cs
  set prepared=coalesce((cs.raw_payload->>'spellMasteryPriorPrepared')::boolean,false),
      always_available=coalesce((cs.raw_payload->>'spellMasteryPriorAlwaysAvailable')::boolean,false),
      raw_payload=coalesce(cs.raw_payload,'{}'::jsonb)
        -'spellMastery'
        -'spellMasteryLevel'
        -'spellMasteryFeature'
        -'spellMasteryPriorPrepared'
        -'spellMasteryPriorAlwaysAvailable',
      updated_at=now()
  where cs.character_id=p_character_id
    and cs.spell_id=p_spell_id
    and coalesce((cs.raw_payload->>'spellMastery')::boolean,false);
end;
$$;

create or replace function private.character_spell_mastery_profile_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_mastery private.character_spell_mastery%rowtype;
  v_level1 jsonb;
  v_level2 jsonb;
  v_level1_options jsonb:='[]'::jsonb;
  v_level2_options jsonb:='[]'::jsonb;
  v_latest_long_rest timestamptz;
  v_unlock_after timestamptz;
  v_replacement_available boolean:=false;
begin
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found then return jsonb_build_object('eligible',false,'reason','Character progression is unavailable.'); end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found or lower(coalesce(v_class.class_key,''))<>'wizard' or upper(coalesce(v_class.source,''))<>'XPHB' or v_progression.class_level<18 then
    return jsonb_build_object('eligible',false,'reason','Spell Mastery requires an XPHB Wizard of level 18 or higher.');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,
    'name',s.name,
    'source',s.source,
    'level',s.level,
    'school',s.school,
    'castingTime',s.casting_time,
    'description',coalesce(s.description,'')
  ) order by s.name),'[]'::jsonb)
  into v_level1_options
  from public.spells_catalog s
  where private.wizard_spell_mastery_candidate_v1(p_character_id,s.id,1);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,
    'name',s.name,
    'source',s.source,
    'level',s.level,
    'school',s.school,
    'castingTime',s.casting_time,
    'description',coalesce(s.description,'')
  ) order by s.name),'[]'::jsonb)
  into v_level2_options
  from public.spells_catalog s
  where private.wizard_spell_mastery_candidate_v1(p_character_id,s.id,2);

  select * into v_mastery from private.character_spell_mastery where character_id=p_character_id;
  select max(completed_at) into v_latest_long_rest from public.character_rest_log where character_id=p_character_id and rest_type='long_rest';

  if found then
    select jsonb_build_object('id',s.id,'name',s.name,'source',s.source,'level',s.level,'school',s.school,'castingTime',s.casting_time)
    into v_level1 from public.spells_catalog s where s.id=v_mastery.level1_spell_id;
    select jsonb_build_object('id',s.id,'name',s.name,'source',s.source,'level',s.level,'school',s.school,'castingTime',s.casting_time)
    into v_level2 from public.spells_catalog s where s.id=v_mastery.level2_spell_id;
    v_unlock_after:=greatest(v_mastery.configured_at,coalesce(v_mastery.last_replacement_rest_at,'epoch'::timestamptz));
    v_replacement_available:=v_latest_long_rest is not null and v_latest_long_rest>v_unlock_after;
    return jsonb_build_object(
      'eligible',true,
      'configured',true,
      'level1Spell',v_level1,
      'level2Spell',v_level2,
      'level1Options',v_level1_options,
      'level2Options',v_level2_options,
      'configuredAt',v_mastery.configured_at,
      'lastReplacementRestAt',v_mastery.last_replacement_rest_at,
      'latestLongRest',v_latest_long_rest,
      'replacementAvailable',v_replacement_available,
      'replacementRule','After each Long Rest, replace at most one mastered spell with an eligible spell of the same level.',
      'atWill',true
    );
  end if;

  return jsonb_build_object(
    'eligible',true,
    'configured',false,
    'level1Spell',null,
    'level2Spell',null,
    'level1Options',v_level1_options,
    'level2Options',v_level2_options,
    'latestLongRest',v_latest_long_rest,
    'replacementAvailable',false,
    'replacementRule','Choose one eligible level-1 spell and one eligible level-2 spell from the Wizard spellbook. Later, each Long Rest permits replacing at most one with an eligible spell of the same level.',
    'atWill',true
  );
end;
$$;

create or replace function public.configure_character_spell_mastery_v1(
  p_character_id uuid,
  p_level1_spell_id uuid,
  p_level2_spell_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_user uuid:=auth.uid();
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_current private.character_spell_mastery%rowtype;
  v_latest_long_rest timestamptz;
  v_unlock_after timestamptz;
  v_change_count integer:=0;
begin
  if not private.can_manage_character_spell_resources_v1(p_character_id) then
    raise exception 'You do not have permission to configure Spell Mastery for this character.' using errcode='42501';
  end if;
  if private.character_active_encounter_v1(p_character_id) is not null then
    raise exception 'Spell Mastery cannot be reconfigured while the character is in an active encounter.' using errcode='55000';
  end if;

  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if not found then raise exception 'Character progression is unavailable.'; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found or lower(coalesce(v_class.class_key,''))<>'wizard' or upper(coalesce(v_class.source,''))<>'XPHB' or v_progression.class_level<18 then
    raise exception 'Spell Mastery requires an XPHB Wizard of level 18 or higher.';
  end if;
  if not private.wizard_spell_mastery_candidate_v1(p_character_id,p_level1_spell_id,1) then
    raise exception 'The level-1 Spell Mastery selection must be a level-1 Wizard spell in this spellbook with a casting time of an Action.';
  end if;
  if not private.wizard_spell_mastery_candidate_v1(p_character_id,p_level2_spell_id,2) then
    raise exception 'The level-2 Spell Mastery selection must be a level-2 Wizard spell in this spellbook with a casting time of an Action.';
  end if;

  select * into v_current from private.character_spell_mastery where character_id=p_character_id for update;
  if not found then
    perform private.apply_wizard_spell_mastery_overlay_v1(p_character_id,p_level1_spell_id,1);
    perform private.apply_wizard_spell_mastery_overlay_v1(p_character_id,p_level2_spell_id,2);
    select max(completed_at) into v_latest_long_rest from public.character_rest_log where character_id=p_character_id and rest_type='long_rest';
    insert into private.character_spell_mastery(character_id,level1_spell_id,level2_spell_id,configured_at,last_replacement_rest_at,updated_at,updated_by)
    values(p_character_id,p_level1_spell_id,p_level2_spell_id,now(),v_latest_long_rest,now(),v_user);
    return public.character_sheet_resource_profile_v2(p_character_id);
  end if;

  if v_current.level1_spell_id<>p_level1_spell_id then v_change_count:=v_change_count+1; end if;
  if v_current.level2_spell_id<>p_level2_spell_id then v_change_count:=v_change_count+1; end if;
  if v_change_count=0 then return public.character_sheet_resource_profile_v2(p_character_id); end if;
  if v_change_count>1 then
    raise exception 'After a Long Rest, Spell Mastery can replace only one mastered spell at a time.';
  end if;

  select max(completed_at) into v_latest_long_rest from public.character_rest_log where character_id=p_character_id and rest_type='long_rest';
  v_unlock_after:=greatest(v_current.configured_at,coalesce(v_current.last_replacement_rest_at,'epoch'::timestamptz));
  if v_latest_long_rest is null or v_latest_long_rest<=v_unlock_after then
    raise exception 'Finish a new Long Rest before replacing a Spell Mastery selection.';
  end if;

  if v_current.level1_spell_id<>p_level1_spell_id then
    perform private.clear_wizard_spell_mastery_overlay_v1(p_character_id,v_current.level1_spell_id);
    perform private.apply_wizard_spell_mastery_overlay_v1(p_character_id,p_level1_spell_id,1);
  else
    perform private.clear_wizard_spell_mastery_overlay_v1(p_character_id,v_current.level2_spell_id);
    perform private.apply_wizard_spell_mastery_overlay_v1(p_character_id,p_level2_spell_id,2);
  end if;

  update private.character_spell_mastery
  set level1_spell_id=p_level1_spell_id,
      level2_spell_id=p_level2_spell_id,
      last_replacement_rest_at=v_latest_long_rest,
      updated_at=now(),
      updated_by=v_user
  where character_id=p_character_id;

  return public.character_sheet_resource_profile_v2(p_character_id);
end;
$$;

create or replace function public.character_sheet_resource_profile_v2(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_profile jsonb;
  v_active jsonb;
  v_mastery jsonb;
begin
  v_profile:=public.character_sheet_resource_profile_v1(p_character_id);
  v_active:=private.character_active_encounter_v1(p_character_id);
  v_mastery:=private.character_spell_mastery_profile_v1(p_character_id);
  return coalesce(v_profile,'{}'::jsonb)||jsonb_build_object(
    'resourceBridgeVersion',1,
    'encounterLocked',v_active is not null,
    'activeEncounter',v_active,
    'spellMastery',v_mastery
  );
end;
$$;

revoke all on table private.character_spell_mastery from public,anon,authenticated;
grant select,insert,update,delete on table private.character_spell_mastery to service_role;
revoke all on function private.wizard_spell_mastery_candidate_v1(uuid,uuid,integer) from public,anon,authenticated;
revoke all on function private.apply_wizard_spell_mastery_overlay_v1(uuid,uuid,integer) from public,anon,authenticated;
revoke all on function private.clear_wizard_spell_mastery_overlay_v1(uuid,uuid) from public,anon,authenticated;
revoke all on function private.character_spell_mastery_profile_v1(uuid) from public,anon,authenticated;
grant execute on function private.wizard_spell_mastery_candidate_v1(uuid,uuid,integer) to service_role;
grant execute on function private.apply_wizard_spell_mastery_overlay_v1(uuid,uuid,integer) to service_role;
grant execute on function private.clear_wizard_spell_mastery_overlay_v1(uuid,uuid) to service_role;
grant execute on function private.character_spell_mastery_profile_v1(uuid) to service_role;
revoke all on function public.configure_character_spell_mastery_v1(uuid,uuid,uuid) from public,anon;
grant execute on function public.configure_character_spell_mastery_v1(uuid,uuid,uuid) to authenticated,service_role;
