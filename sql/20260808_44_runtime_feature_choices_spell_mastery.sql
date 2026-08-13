-- Generic runtime feature-choice state plus XPHB Wizard Spell Mastery as the first
-- Long-Rest-configurable adapter. Runtime choices are intentionally separate from
-- permanent Character Forge / level-up source-choice state.

create table if not exists public.character_runtime_feature_choices (
  character_id uuid not null references public.characters(id) on delete cascade,
  feature_key text not null,
  feature_name text not null,
  source text not null default 'CAMPAIGN',
  cadence text not null,
  state jsonb not null default '{}'::jsonb,
  replacement_anchor_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(character_id,feature_key),
  constraint character_runtime_feature_choices_cadence_chk
    check(cadence in ('long_rest','short_rest','per_use','informational')),
  constraint character_runtime_feature_choices_state_object_chk
    check(jsonb_typeof(state)='object')
);

create index if not exists character_runtime_feature_choices_feature_idx
  on public.character_runtime_feature_choices(feature_key,character_id);

alter table public.character_runtime_feature_choices enable row level security;
revoke all on table public.character_runtime_feature_choices from public,anon,authenticated;

create or replace function private.wizard_spell_mastery_options_v1(p_character_id uuid,p_spell_level integer)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_options jsonb:='[]'::jsonb;
begin
  if p_spell_level not in (1,2) then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignmentId',cs.id,
    'spellId',s.id,
    'spellKey',s.spell_key,
    'name',s.name,
    'source',s.source,
    'level',s.level,
    'school',s.school,
    'castingTime',s.casting_time,
    'prepared',cs.prepared,
    'alwaysAvailable',cs.always_available
  ) order by s.name),'[]'::jsonb)
  into v_options
  from public.character_spells cs
  join public.spells_catalog_preferred s on s.id=cs.spell_id
  where cs.character_id=p_character_id
    and s.level=p_spell_level
    and public.is_preferred_spell_version_v1(s.id)
    and private.normalize_player_choice_name_v1(coalesce(s.casting_time,'')) in ('action','1action')
    and (
      cs.source_type='class'
      or (
        cs.source_type='class-feature'
        and coalesce((cs.raw_payload->>'wizardSpellbook')::boolean,false)
      )
    );
  return coalesce(v_options,'[]'::jsonb);
end;
$$;

create or replace function public.get_wizard_spell_mastery_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_latest_long_rest timestamptz;
  v_available boolean:=false;
  v_configured boolean:=false;
  v_can_replace boolean:=false;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to review Spell Mastery for this character.' using errcode='42501';
  end if;

  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found then return jsonb_build_object('available',false,'reason','Character progression is unavailable.'); end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  v_available:=found
    and lower(coalesce(v_class.class_key,''))='wizard'
    and upper(coalesce(v_class.source,''))='XPHB'
    and v_progression.class_level>=18;
  if not v_available then
    return jsonb_build_object(
      'available',false,
      'reason','Spell Mastery becomes configurable for an XPHB Wizard at level 18.',
      'classLevel',v_progression.class_level
    );
  end if;

  select * into v_runtime
  from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key='wizard-spell-mastery';
  v_configured:=found
    and coalesce(v_runtime.state#>>'{level1,spellId}','')<>''
    and coalesce(v_runtime.state#>>'{level2,spellId}','')<>'';

  select max(completed_at) into v_latest_long_rest
  from public.character_rest_log
  where character_id=p_character_id and rest_type='long_rest';
  v_can_replace:=v_configured
    and v_latest_long_rest is not null
    and v_latest_long_rest>v_runtime.replacement_anchor_at;

  return jsonb_build_object(
    'available',true,
    'featureKey','wizard-spell-mastery',
    'featureName','Spell Mastery',
    'source','XPHB',
    'cadence','long_rest',
    'classLevel',v_progression.class_level,
    'configured',v_configured,
    'canReplaceOne',v_can_replace,
    'replacementAnchorAt',case when v_configured then v_runtime.replacement_anchor_at else null end,
    'latestLongRestAt',v_latest_long_rest,
    'state',case when v_configured then v_runtime.state else '{}'::jsonb end,
    'level1Options',private.wizard_spell_mastery_options_v1(p_character_id,1),
    'level2Options',private.wizard_spell_mastery_options_v1(p_character_id,2),
    'tacticalFreeCastAutomated',false,
    'helper','Choose one level-1 and one level-2 Wizard spell in the spellbook that has an Action casting time. They are always prepared and can be cast at their lowest level without a slot. After a Long Rest, exactly one mastered spell can be changed.'
  );
end;
$$;

create or replace function public.configure_wizard_spell_mastery_v1(
  p_character_id uuid,
  p_level_1_spell_id uuid,
  p_level_2_spell_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_existing boolean:=false;
  v_latest_long_rest timestamptz;
  v_anchor timestamptz;
  v_old_1 uuid;
  v_old_2 uuid;
  v_old_assignment_1 uuid;
  v_old_assignment_2 uuid;
  v_changed integer:=0;
  v_assignment_1 public.character_spells%rowtype;
  v_assignment_2 public.character_spells%rowtype;
  v_spell_1 public.spells_catalog%rowtype;
  v_spell_2 public.spells_catalog%rowtype;
  v_prior_always_1 boolean:=false;
  v_prior_always_2 boolean:=false;
  v_state jsonb;
  v_result jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to configure Spell Mastery for this character.' using errcode='42501';
  end if;
  if p_level_1_spell_id is null or p_level_2_spell_id is null then
    raise exception 'Spell Mastery requires one level-1 spell and one level-2 spell.';
  end if;

  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if not found then raise exception 'Character progression is unavailable.'; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found or lower(coalesce(v_class.class_key,''))<>'wizard' or upper(coalesce(v_class.source,''))<>'XPHB' or v_progression.class_level<18 then
    raise exception 'Spell Mastery requires an XPHB Wizard of level 18 or higher.';
  end if;

  select cs.* into v_assignment_1
  from public.character_spells cs
  join public.spells_catalog_preferred s on s.id=cs.spell_id
  where cs.character_id=p_character_id and cs.spell_id=p_level_1_spell_id
    and s.level=1
    and public.is_preferred_spell_version_v1(s.id)
    and private.normalize_player_choice_name_v1(coalesce(s.casting_time,'')) in ('action','1action')
    and (cs.source_type='class' or (cs.source_type='class-feature' and coalesce((cs.raw_payload->>'wizardSpellbook')::boolean,false)))
  order by cs.created_at,cs.id
  limit 1 for update of cs;
  if not found then raise exception 'The level-1 Spell Mastery choice must be an Action spell in this Wizard''s spellbook.'; end if;
  select * into v_spell_1 from public.spells_catalog_preferred where id=v_assignment_1.spell_id;

  select cs.* into v_assignment_2
  from public.character_spells cs
  join public.spells_catalog_preferred s on s.id=cs.spell_id
  where cs.character_id=p_character_id and cs.spell_id=p_level_2_spell_id
    and s.level=2
    and public.is_preferred_spell_version_v1(s.id)
    and private.normalize_player_choice_name_v1(coalesce(s.casting_time,'')) in ('action','1action')
    and (cs.source_type='class' or (cs.source_type='class-feature' and coalesce((cs.raw_payload->>'wizardSpellbook')::boolean,false)))
  order by cs.created_at,cs.id
  limit 1 for update of cs;
  if not found then raise exception 'The level-2 Spell Mastery choice must be an Action spell in this Wizard''s spellbook.'; end if;
  select * into v_spell_2 from public.spells_catalog_preferred where id=v_assignment_2.spell_id;

  select * into v_runtime
  from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key='wizard-spell-mastery'
  for update;
  v_existing:=found;

  if v_existing then
    begin v_old_1:=nullif(v_runtime.state#>>'{level1,spellId}','')::uuid; exception when others then v_old_1:=null; end;
    begin v_old_2:=nullif(v_runtime.state#>>'{level2,spellId}','')::uuid; exception when others then v_old_2:=null; end;
    begin v_old_assignment_1:=nullif(v_runtime.state#>>'{level1,assignmentId}','')::uuid; exception when others then v_old_assignment_1:=null; end;
    begin v_old_assignment_2:=nullif(v_runtime.state#>>'{level2,assignmentId}','')::uuid; exception when others then v_old_assignment_2:=null; end;
    v_changed:=(case when v_old_1 is distinct from p_level_1_spell_id then 1 else 0 end)
      +(case when v_old_2 is distinct from p_level_2_spell_id then 1 else 0 end);

    if v_changed=0 then return public.get_wizard_spell_mastery_v1(p_character_id); end if;
    if v_changed>1 then raise exception 'After a Long Rest, Spell Mastery can change only one of the two mastered spells.'; end if;

    select max(completed_at) into v_latest_long_rest
    from public.character_rest_log
    where character_id=p_character_id and rest_type='long_rest';
    if v_latest_long_rest is null or v_latest_long_rest<=v_runtime.replacement_anchor_at then
      raise exception 'Finish a new Long Rest before changing a mastered spell.';
    end if;
    v_anchor:=v_latest_long_rest;

    if v_old_1 is distinct from p_level_1_spell_id and v_old_assignment_1 is not null then
      update public.character_spells
      set always_available=coalesce((raw_payload->>'spellMasteryPriorAlwaysAvailable')::boolean,false),
          raw_payload=coalesce(raw_payload,'{}'::jsonb)-array[
            'spellMastery','spellMasteryFeature','spellMasterySlot','spellMasteryFreeCastLevel',
            'spellMasteryPriorAlwaysAvailable','spellMasteryConfiguredAt'
          ],
          updated_at=now()
      where id=v_old_assignment_1 and character_id=p_character_id and coalesce((raw_payload->>'spellMastery')::boolean,false);
    end if;
    if v_old_2 is distinct from p_level_2_spell_id and v_old_assignment_2 is not null then
      update public.character_spells
      set always_available=coalesce((raw_payload->>'spellMasteryPriorAlwaysAvailable')::boolean,false),
          raw_payload=coalesce(raw_payload,'{}'::jsonb)-array[
            'spellMastery','spellMasteryFeature','spellMasterySlot','spellMasteryFreeCastLevel',
            'spellMasteryPriorAlwaysAvailable','spellMasteryConfiguredAt'
          ],
          updated_at=now()
      where id=v_old_assignment_2 and character_id=p_character_id and coalesce((raw_payload->>'spellMastery')::boolean,false);
    end if;
  else
    v_anchor:=now();
  end if;

  if not v_existing or v_old_1 is distinct from p_level_1_spell_id then
    v_prior_always_1:=coalesce(v_assignment_1.always_available,false);
    update public.character_spells
    set always_available=true,
        raw_payload=coalesce(raw_payload,'{}'::jsonb)||jsonb_build_object(
          'spellMastery',true,
          'spellMasteryFeature','Spell Mastery',
          'spellMasterySlot','level1',
          'spellMasteryFreeCastLevel',1,
          'spellMasteryPriorAlwaysAvailable',v_prior_always_1,
          'spellMasteryConfiguredAt',now()
        ),
        updated_at=now()
    where id=v_assignment_1.id;
  else
    v_prior_always_1:=coalesce((v_runtime.state#>>'{level1,priorAlwaysAvailable}')::boolean,false);
  end if;

  if not v_existing or v_old_2 is distinct from p_level_2_spell_id then
    v_prior_always_2:=coalesce(v_assignment_2.always_available,false);
    update public.character_spells
    set always_available=true,
        raw_payload=coalesce(raw_payload,'{}'::jsonb)||jsonb_build_object(
          'spellMastery',true,
          'spellMasteryFeature','Spell Mastery',
          'spellMasterySlot','level2',
          'spellMasteryFreeCastLevel',2,
          'spellMasteryPriorAlwaysAvailable',v_prior_always_2,
          'spellMasteryConfiguredAt',now()
        ),
        updated_at=now()
    where id=v_assignment_2.id;
  else
    v_prior_always_2:=coalesce((v_runtime.state#>>'{level2,priorAlwaysAvailable}')::boolean,false);
  end if;

  v_state:=jsonb_build_object(
    'level1',jsonb_build_object(
      'assignmentId',v_assignment_1.id,'spellId',v_spell_1.id,'spellKey',v_spell_1.spell_key,
      'name',v_spell_1.name,'source',v_spell_1.source,'level',1,'castingTime',v_spell_1.casting_time,
      'priorAlwaysAvailable',v_prior_always_1
    ),
    'level2',jsonb_build_object(
      'assignmentId',v_assignment_2.id,'spellId',v_spell_2.id,'spellKey',v_spell_2.spell_key,
      'name',v_spell_2.name,'source',v_spell_2.source,'level',2,'castingTime',v_spell_2.casting_time,
      'priorAlwaysAvailable',v_prior_always_2
    ),
    'freeCast','lowest-level-without-slot',
    'alwaysPrepared',true,
    'lastChangeCount',case when v_existing then v_changed else 2 end
  );

  insert into public.character_runtime_feature_choices(
    character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at
  ) values(
    p_character_id,'wizard-spell-mastery','Spell Mastery','XPHB','long_rest',v_state,v_anchor,now(),now()
  ) on conflict(character_id,feature_key) do update
    set feature_name=excluded.feature_name,
        source=excluded.source,
        cadence=excluded.cadence,
        state=excluded.state,
        replacement_anchor_at=excluded.replacement_anchor_at,
        updated_at=now();

  v_result:=public.get_wizard_spell_mastery_v1(p_character_id);
  return v_result||jsonb_build_object('changedSpells',case when v_existing then v_changed else 2 end);
end;
$$;

revoke all on function private.wizard_spell_mastery_options_v1(uuid,integer) from public,anon,authenticated;
revoke all on function public.get_wizard_spell_mastery_v1(uuid) from public,anon;
revoke all on function public.configure_wizard_spell_mastery_v1(uuid,uuid,uuid) from public,anon;
grant execute on function private.wizard_spell_mastery_options_v1(uuid,integer) to service_role;
grant execute on function public.get_wizard_spell_mastery_v1(uuid) to authenticated,service_role;
grant execute on function public.configure_wizard_spell_mastery_v1(uuid,uuid,uuid) to authenticated,service_role;
