-- XPHB Wizard Signature Spells.
--
-- Persistent authority: choose two level-3 spells that are actually in the Wizard's
-- normalized spellbook. Runtime authority: each selected assignment carries one free
-- level-3 cast, recharging on a Short Rest (and therefore also on a Long Rest through
-- complete_character_rest_v1). The original spell assignment/provenance is preserved.

create or replace function private.level_up_wizard_signature_group_v1(p_character_id uuid,p_to_level integer)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_options jsonb:='[]'::jsonb;
begin
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found or p_to_level<>v_progression.class_level+1 or p_to_level<>20 then return '[]'::jsonb; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found or lower(coalesce(v_class.class_key,''))<>'wizard' or upper(coalesce(v_class.source,''))<>'XPHB' then return '[]'::jsonb; end if;

  -- Return every source-legal level-3 Wizard spell so the client can include a spell
  -- selected as one of the two ordinary level-20 spellbook additions. The completion
  -- helper validates the submitted pair against the final spellbook after v4 commits
  -- those ordinary additions inside the same transaction.
  select coalesce(jsonb_agg(jsonb_build_object(
    'key',s.id::text,
    'value',s.id::text,
    'label',s.name,
    'source',s.source,
    'kind','spell',
    'description',coalesce(s.description,''),
    'metadata',jsonb_build_object(
      'spellId',s.id,
      'spellKey',s.spell_key,
      'level',s.level,
      'school',s.school,
      'requiresWizardSpellbook',true
    )
  ) order by s.name),'[]'::jsonb)
  into v_options
  from public.spells_catalog_preferred s
  where s.level=3
    and exists(select 1 from unnest(coalesce(s.classes,'{}'::text[])) c where lower(c)='wizard');

  return jsonb_build_array(jsonb_build_object(
    'id','wizard-signature-spells',
    'ownerType','class',
    'ownerKey','wizard-signature-spells',
    'label','Signature Spells',
    'source','XPHB',
    'placement','spells',
    'level',20,
    'helper','Choose two level-3 Wizard spells in this character''s spellbook. The final server check runs after the two ordinary level-20 Wizard spell additions are committed, so a spell learned on this level can qualify.',
    'metadata',jsonb_build_object(
      'family','wizard-signature-spells',
      'sourceFeature','Signature Spells',
      'requiresWizardSpellbook',true,
      'applyAfterBaseTransition',true,
      'freeCastLevel',3,
      'usesPerRest',1,
      'recharge','short_rest_or_long_rest'
    ),
    'fields',jsonb_build_array(jsonb_build_object(
      'id','spells',
      'label','Signature Spells',
      'kind','spell',
      'count',2,
      'required',true,
      'cadence','level-up',
      'options',v_options,
      'metadata',jsonb_build_object(
        'spellLevel',3,
        'spellClasses',jsonb_build_array('Wizard'),
        'requiresWizardSpellbook',true
      )
    ))
  ));
end;
$$;

create or replace function private.apply_wizard_signature_spell_assignments_v1(
  p_character_id uuid,
  p_spell_ids jsonb,
  p_acquisition text default 'level-up'
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_selected jsonb:=coalesce(p_spell_ids,'[]'::jsonb);
  v_key text;
  v_spell_id uuid;
  v_assignment public.character_spells%rowtype;
  v_spell public.spells_catalog%rowtype;
  v_summary jsonb:='[]'::jsonb;
begin
  if jsonb_typeof(v_selected)<>'array' or jsonb_array_length(v_selected)<>2 then
    raise exception 'Signature Spells requires exactly two level-3 spells in the Wizard spellbook.';
  end if;
  if (select count(distinct value) from jsonb_array_elements_text(v_selected))<>2 then
    raise exception 'Signature Spells selections must be distinct.';
  end if;

  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if not found or v_progression.class_level<>20 then raise exception 'Signature Spells requires Wizard level 20.'; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found or lower(coalesce(v_class.class_key,''))<>'wizard' or upper(coalesce(v_class.source,''))<>'XPHB' then
    raise exception 'Signature Spells authority is available only to an XPHB Wizard.';
  end if;

  for v_key in select value from jsonb_array_elements_text(v_selected) loop
    begin v_spell_id:=v_key::uuid; exception when others then raise exception 'Signature Spells requires canonical spell ids.'; end;

    select cs.* into v_assignment
    from public.character_spells cs
    join public.spells_catalog s on s.id=cs.spell_id
    where cs.character_id=p_character_id
      and cs.spell_id=v_spell_id
      and s.level=3
      and (
        cs.source_type='class'
        or (
          cs.source_type='class-feature'
          and coalesce((cs.raw_payload->>'wizardSpellbook')::boolean,false)
        )
      )
    order by cs.created_at,cs.id
    limit 1
    for update of cs;
    if not found then raise exception 'Each Signature Spell must already be a level-3 spell in this Wizard''s spellbook.'; end if;

    select * into v_spell from public.spells_catalog where id=v_assignment.spell_id;
    if not found or v_spell.level<>3 or not public.is_preferred_spell_version_v1(v_spell.id)
       or not exists(select 1 from unnest(coalesce(v_spell.classes,'{}'::text[])) c where lower(c)='wizard') then
      raise exception '% is not a source-legal level-3 Wizard Signature Spell.',coalesce(v_spell.name,'The selected spell');
    end if;

    if coalesce(v_assignment.uses_max,0)>0 and not coalesce((v_assignment.raw_payload->>'signatureSpell')::boolean,false) then
      raise exception '% already uses this spell assignment''s limited-use resource fields for another feature.',v_spell.name;
    end if;

    update public.character_spells
    set prepared=true,
        uses_max=1,
        uses_remaining=1,
        recharge='short_rest',
        raw_payload=coalesce(raw_payload,'{}'::jsonb)||jsonb_build_object(
          'signatureSpell',true,
          'signatureFeature','Signature Spells',
          'signatureGrantedAtLevel',20,
          'signatureFreeCastLevel',3,
          'signatureRecharge','short_rest_or_long_rest',
          'resourceLabel','Signature Spell',
          'resourceFeature','Signature Spells',
          'signatureAcquisition',coalesce(nullif(p_acquisition,''),'level-up')
        ),
        updated_at=now()
    where id=v_assignment.id;

    v_summary:=v_summary||jsonb_build_array(jsonb_build_object(
      'family','wizard-signature-spells',
      'assignmentId',v_assignment.id,
      'spellId',v_spell.id,
      'name',v_spell.name,
      'source',v_spell.source,
      'sourceType',v_assignment.source_type,
      'sourceKey',v_assignment.source_key,
      'prepared',true,
      'freeCastLevel',3,
      'usesMax',1,
      'usesRemaining',1,
      'recharge','short_rest_or_long_rest',
      'acquisition',coalesce(nullif(p_acquisition,''),'level-up')
    ));
  end loop;

  return v_summary;
end;
$$;

create or replace function private.apply_level_up_wizard_signature_spells_v1(
  p_character_id uuid,
  p_to_level integer,
  p_group jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_selected jsonb:=coalesce(p_group->'spells','[]'::jsonb);
  v_summary jsonb:='[]'::jsonb;
  v_sheet jsonb:='{}'::jsonb;
  v_choices jsonb:='{}'::jsonb;
  v_existing_summary jsonb:='[]'::jsonb;
  v_serialized jsonb:='[]'::jsonb;
  v_entry jsonb;
  v_spell public.spells_catalog%rowtype;
  v_spell_id uuid;
begin
  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if not found then raise exception 'Character progression has not been initialized.'; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;

  if lower(coalesce(v_class.class_key,''))<>'wizard' or upper(coalesce(v_class.source,''))<>'XPHB' or p_to_level<>20 then
    if jsonb_typeof(v_selected)='array' and jsonb_array_length(v_selected)>0 then raise exception 'Signature Spells selections are only valid when an XPHB Wizard gains level 20.'; end if;
    return '[]'::jsonb;
  end if;

  v_summary:=private.apply_wizard_signature_spell_assignments_v1(p_character_id,v_selected,'level-up');

  for v_entry in select value from jsonb_array_elements(v_summary) loop
    begin v_spell_id:=(v_entry->>'spellId')::uuid; exception when others then raise exception 'Signature Spells produced an invalid canonical spell id.'; end;
    select * into v_spell from public.spells_catalog where id=v_spell_id;
    v_serialized:=v_serialized||jsonb_build_array(jsonb_build_object(
      'key',v_spell.id::text,
      'name',v_spell.name,
      'source',v_spell.source,
      'kind','spell',
      'spell',jsonb_build_object('id',v_spell.id,'spellKey',v_spell.spell_key,'level',v_spell.level,'school',v_spell.school)
    ));
  end loop;

  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  v_choices:=case when jsonb_typeof(v_sheet->'classFeatureChoices')='object' then v_sheet->'classFeatureChoices' else '{}'::jsonb end;
  v_choices:=jsonb_set(v_choices,'{wizard-signature-spells}',jsonb_build_object(
    'label','Signature Spells',
    'kind','spell',
    'sourceFeature','Signature Spells',
    'source','XPHB',
    'level',20,
    'count',2,
    'placement','spells',
    'subclassName',null,
    'cadence','creation',
    'replacementCadence',null,
    'allowRepeatAcrossGroups',true,
    'constraints',jsonb_build_object('spellLevel',3,'spellClasses',jsonb_build_array('Wizard'),'requiresWizardSpellbook',true),
    'selections',v_serialized
  ),true);
  v_existing_summary:=case when jsonb_typeof(v_sheet->'classFeatureChoiceSummary')='array' then v_sheet->'classFeatureChoiceSummary' else '[]'::jsonb end;
  select coalesce(jsonb_agg(e.value order by e.ord),'[]'::jsonb)
  into v_existing_summary
  from jsonb_array_elements(v_existing_summary) with ordinality e(value,ord)
  where e.value->>'groupId'<>'wizard-signature-spells';
  v_existing_summary:=v_existing_summary||(
    select coalesce(jsonb_agg(jsonb_build_object(
      'groupId','wizard-signature-spells',
      'groupLabel','Signature Spells',
      'groupKind','spell',
      'level',20,
      'key',e.value->>'key',
      'name',e.value->>'name',
      'source',e.value->>'source',
      'kind','spell'
    )),'[]'::jsonb)
    from jsonb_array_elements(v_serialized) e(value)
  );
  v_sheet:=jsonb_set(v_sheet,'{classFeatureChoices}',v_choices,true);
  v_sheet:=jsonb_set(v_sheet,'{classFeatureChoiceSummary}',v_existing_summary,true);
  v_sheet:=jsonb_set(v_sheet,'{meta,classFeatureChoices}',v_choices,true);
  v_sheet:=jsonb_set(v_sheet,'{meta,classFeatureChoiceSummary}',v_existing_summary,true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now() where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);
  return v_summary;
end;
$$;

create or replace function private.materialize_player_forge_wizard_signature_spells_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_class public.class_catalog%rowtype;
  v_sheet jsonb:='{}'::jsonb;
  v_group jsonb:='{}'::jsonb;
  v_selected jsonb:='[]'::jsonb;
  v_selection jsonb;
  v_spell_ids jsonb:='[]'::jsonb;
  v_spell_id uuid;
begin
  select * into v_class from public.class_catalog where id=new.class_id;
  if not found or lower(coalesce(v_class.class_key,''))<>'wizard' or upper(coalesce(v_class.source,''))<>'XPHB' or new.class_level<>20 then return new; end if;

  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=new.character_id;
  if coalesce(v_sheet#>>'{meta,creator}','')<>'shared_character_forge_player_v2' then return new; end if;
  v_group:=coalesce(v_sheet#>'{classFeatureChoices,wizard-signature-spells}','{}'::jsonb);
  v_selected:=case when jsonb_typeof(v_group->'selections')='array' then v_group->'selections' else '[]'::jsonb end;
  if coalesce((v_group->>'count')::integer,0)<>2 or jsonb_array_length(v_selected)<>2 then
    raise exception 'A level-20 XPHB Wizard created through the Player Forge requires exactly two Signature Spells.';
  end if;

  for v_selection in select value from jsonb_array_elements(v_selected) loop
    begin
      v_spell_id:=coalesce(nullif(v_selection#>>'{spell,id}',''),nullif(v_selection->>'key',''))::uuid;
    exception when others then
      v_spell_id:=null;
    end;
    if v_spell_id is null then
      select s.id into v_spell_id
      from public.spells_catalog s
      where private.normalize_player_choice_name_v1(s.name)=private.normalize_player_choice_name_v1(v_selection->>'name')
        and (coalesce(v_selection->>'source','')='' or s.source=v_selection->>'source')
        and s.level=3
      order by case when s.source='XPHB' then 0 when s.source='PHB' then 1 else 2 end,s.name
      limit 1;
    end if;
    if v_spell_id is null then raise exception 'A Signature Spell selection could not be resolved to a canonical spell.'; end if;
    v_spell_ids:=v_spell_ids||to_jsonb(v_spell_id::text);
  end loop;

  perform private.apply_wizard_signature_spell_assignments_v1(new.character_id,v_spell_ids,'player-forge');
  return new;
end;
$$;

drop trigger if exists character_progression_materialize_player_forge_wizard_signature_spells_v1 on public.character_progression;
create constraint trigger character_progression_materialize_player_forge_wizard_signature_spells_v1
after insert on public.character_progression
deferrable initially deferred
for each row execute function private.materialize_player_forge_wizard_signature_spells_v1();

create or replace function public.get_character_level_class_choice_options_v2(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_base jsonb;
  v_progression public.character_progression%rowtype;
  v_extra jsonb:='[]'::jsonb;
  v_replacement jsonb:='[]'::jsonb;
  v_battle_master jsonb:='[]'::jsonb;
  v_wizard_savant jsonb:='[]'::jsonb;
  v_wizard_signature jsonb:='[]'::jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to review these class choices.' using errcode='42501'; end if;
  v_base:=public.get_character_level_class_choice_options_v1(p_character_id);
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found or v_progression.class_level>=20 then return v_base; end if;
  v_extra:=private.level_up_warlock_invocation_groups_v1(p_character_id,v_progression.class_level+1);
  v_replacement:=private.level_up_warlock_invocation_replacement_group_v1(p_character_id,v_progression.class_level+1);
  v_battle_master:=private.level_up_battle_master_maneuver_group_v1(p_character_id,v_progression.class_level+1);
  v_wizard_savant:=private.level_up_wizard_savant_group_v1(p_character_id,v_progression.class_level+1);
  v_wizard_signature:=private.level_up_wizard_signature_group_v1(p_character_id,v_progression.class_level+1);
  return jsonb_set(coalesce(v_base,'{}'::jsonb),'{groups}',coalesce(v_base->'groups','[]'::jsonb)||coalesce(v_extra,'[]'::jsonb)||coalesce(v_replacement,'[]'::jsonb)||coalesce(v_battle_master,'[]'::jsonb)||coalesce(v_wizard_savant,'[]'::jsonb)||coalesce(v_wizard_signature,'[]'::jsonb),true);
end;
$$;

create or replace function public.complete_character_level_up_v5(p_character_id uuid,p_selections jsonb)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_input jsonb:=coalesce(p_selections,'{}'::jsonb);
  v_progression public.character_progression%rowtype;
  v_to integer;
  v_replacements jsonb:=coalesce(v_input->'replacement_selections','{}'::jsonb);
  v_all_class jsonb:=coalesce(v_input->'class_choice_selections','{}'::jsonb);
  v_invocation_replacement jsonb:=coalesce(v_all_class->'warlock-invocation-replacement','{}'::jsonb);
  v_battle_master jsonb:=coalesce(v_all_class->'fighter-battle-master-maneuvers','{}'::jsonb);
  v_wizard_savant jsonb:=coalesce(v_all_class->'wizard-savant-spellbook-addition','{}'::jsonb);
  v_wizard_signature jsonb:=coalesce(v_all_class->'wizard-signature-spells','{}'::jsonb);
  v_forward_class jsonb:=v_all_class-'warlock-invocation-replacement'-'fighter-battle-master-maneuvers'-'wizard-savant-spellbook-addition'-'wizard-signature-spells';
  v_feat_instances jsonb:=coalesce(v_input->'class_option_feat_instances','[]'::jsonb);
  v_invocation_summary jsonb:='[]'::jsonb;
  v_battle_summary jsonb:='[]'::jsonb;
  v_wizard_summary jsonb:='[]'::jsonb;
  v_signature_summary jsonb:='[]'::jsonb;
  v_standard_summary jsonb:='[]'::jsonb;
  v_replacement_summary jsonb:='[]'::jsonb;
  v_result jsonb;
  v_forward_input jsonb;
  v_level_choice jsonb:='{}'::jsonb;
  v_session_id uuid;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to level this character.' using errcode='42501'; end if;
  if jsonb_typeof(v_input)<>'object' or jsonb_typeof(v_replacements)<>'object' or jsonb_typeof(v_all_class)<>'object' or jsonb_typeof(v_feat_instances)<>'array' then raise exception 'Level-up source selections have an invalid shape.'; end if;
  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if not found or v_progression.class_level>=20 then raise exception 'Character progression is unavailable for another level.'; end if;
  v_to:=v_progression.class_level+1;

  -- Families whose legality depends only on pre-transition state are applied before v4.
  v_invocation_summary:=private.apply_level_up_warlock_invocation_replacement_v2(p_character_id,v_to,v_invocation_replacement,v_all_class,v_feat_instances);
  v_battle_summary:=private.apply_level_up_battle_master_maneuvers_v1(p_character_id,v_to,v_battle_master,v_input->>'subclass_name');
  v_wizard_summary:=private.apply_level_up_wizard_savant_v1(p_character_id,v_to,v_wizard_savant,v_input->>'subclass_name');
  v_standard_summary:=private.apply_level_up_replacements_v1(p_character_id,v_to,v_replacements);
  v_replacement_summary:=coalesce(v_invocation_summary,'[]'::jsonb)||coalesce(v_battle_summary,'[]'::jsonb)||coalesce(v_standard_summary,'[]'::jsonb);

  v_forward_input:=jsonb_set(v_input,'{class_choice_selections}',v_forward_class,true);
  v_result:=public.complete_character_level_up_v4(p_character_id,v_forward_input-'replacement_selections');

  -- Signature Spells is deliberately post-v4: a level-3 spell selected as one of the
  -- two ordinary level-20 Wizard additions is now in the final spellbook and may qualify.
  v_signature_summary:=private.apply_level_up_wizard_signature_spells_v1(p_character_id,v_to,v_wizard_signature);
  perform private.sync_character_eldritch_invocations_v1(p_character_id);

  select coalesce(level_choices->v_to::text,'{}'::jsonb) into v_level_choice from public.character_progression where character_id=p_character_id;
  if jsonb_array_length(v_replacement_summary)>0 then v_level_choice:=v_level_choice||jsonb_build_object('replacements',v_replacement_summary); end if;
  if jsonb_array_length(v_wizard_summary)>0 then v_level_choice:=v_level_choice||jsonb_build_object('wizard_savant_delta',v_wizard_summary); end if;
  if jsonb_array_length(v_signature_summary)>0 then v_level_choice:=v_level_choice||jsonb_build_object('wizard_signature_spells',v_signature_summary); end if;
  if jsonb_array_length(v_replacement_summary)>0 or jsonb_array_length(v_wizard_summary)>0 or jsonb_array_length(v_signature_summary)>0 then
    update public.character_progression set level_choices=jsonb_set(coalesce(level_choices,'{}'::jsonb),array[v_to::text],v_level_choice,true),updated_at=now() where character_id=p_character_id;
    select id into v_session_id from public.character_level_up_sessions where character_id=p_character_id and to_level=v_to and status='completed' order by completed_at desc limit 1;
    if v_session_id is not null then
      update public.character_level_up_sessions set selections=coalesce(selections,'{}'::jsonb)
        ||case when jsonb_array_length(v_replacement_summary)>0 then jsonb_build_object('replacement_selections',v_replacements,'invocation_replacement_selection',v_invocation_replacement,'battle_master_maneuvers',v_battle_master,'replacements',v_replacement_summary) else '{}'::jsonb end
        ||case when jsonb_array_length(v_wizard_summary)>0 then jsonb_build_object('wizard_savant_selection',v_wizard_savant,'wizard_savant_delta',v_wizard_summary) else '{}'::jsonb end
        ||case when jsonb_array_length(v_signature_summary)>0 then jsonb_build_object('wizard_signature_selection',v_wizard_signature,'wizard_signature_spells',v_signature_summary) else '{}'::jsonb end,
        updated_at=now() where id=v_session_id;
    end if;
    update public.character_level_events set details=coalesce(details,'{}'::jsonb)
      ||case when jsonb_array_length(v_replacement_summary)>0 then jsonb_build_object('replacements',v_replacement_summary) else '{}'::jsonb end
      ||case when jsonb_array_length(v_wizard_summary)>0 then jsonb_build_object('wizardSavantDelta',v_wizard_summary) else '{}'::jsonb end
      ||case when jsonb_array_length(v_signature_summary)>0 then jsonb_build_object('wizardSignatureSpells',v_signature_summary) else '{}'::jsonb end
    where id=(select id from public.character_level_events where character_id=p_character_id and event_type='level_up_completed' and to_level=v_to order by created_at desc limit 1);
  end if;

  return coalesce(v_result,'{}'::jsonb)||jsonb_build_object(
    'replacements',v_replacement_summary,
    'wizardSavant',v_wizard_summary,
    'wizardSignature',v_signature_summary,
    'progression',public.get_character_progression_v1(p_character_id)
  );
end;
$$;

-- Preserve the existing resource profile contract while giving feature-owned limited
-- uses an optional player-facing label. Existing rows continue to fall back to spell name.
create or replace function private.character_sheet_resource_profile_json_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_class_key text;
  v_class_name text;
  v_class_level integer;
  v_slots jsonb:='[]'::jsonb;
  v_spell_uses jsonb:='[]'::jsonb;
  v_last_short timestamptz;
  v_last_long timestamptz;
begin
  select c.class_key,c.class_name,cp.class_level
  into v_class_key,v_class_name,v_class_level
  from public.character_progression cp
  join public.class_catalog c on c.id=cp.class_id
  where cp.character_id=p_character_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'poolKey',s.pool_key,'slotLevel',s.slot_level,'max',s.slots_max,'remaining',s.slots_remaining,
    'rechargeKey',s.recharge_key,'sourceClassKey',s.source_class_key,'sourceBook',s.source_book,
    'sourceRuleset',s.source_ruleset,'sourceClassLevel',s.source_class_level
  ) order by s.pool_key,s.slot_level),'[]'::jsonb)
  into v_slots
  from public.character_spell_slots s
  where s.character_id=p_character_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignmentId',cs.id,
    'spellId',sp.id,
    'name',sp.name,
    'resourceLabel',coalesce(nullif(cs.raw_payload->>'resourceLabel',''),sp.name),
    'resourceFeature',nullif(cs.raw_payload->>'resourceFeature',''),
    'level',sp.level,
    'max',cs.uses_max,
    'remaining',coalesce(cs.uses_remaining,cs.uses_max),
    'recharge',cs.recharge,
    'sourceType',cs.source_type,
    'sourceLabel',cs.source_label
  ) order by sp.level,sp.name,cs.created_at),'[]'::jsonb)
  into v_spell_uses
  from public.character_spells cs
  join public.spells_catalog sp on sp.id=cs.spell_id
  where cs.character_id=p_character_id and cs.uses_max is not null and cs.uses_max>0;

  select max(completed_at) filter(where rest_type='short_rest'),
         max(completed_at) filter(where rest_type='long_rest')
  into v_last_short,v_last_long
  from public.character_rest_log
  where character_id=p_character_id;

  return jsonb_build_object(
    'schemaVersion',1,
    'characterId',p_character_id,
    'classKey',v_class_key,
    'className',v_class_name,
    'classLevel',v_class_level,
    'canManage',true,
    'slots',coalesce(v_slots,'[]'::jsonb),
    'limitedSpellUses',coalesce(v_spell_uses,'[]'::jsonb),
    'lastShortRest',v_last_short,
    'lastLongRest',v_last_long
  );
end;
$$;

revoke all on function private.level_up_wizard_signature_group_v1(uuid,integer) from public,anon,authenticated;
revoke all on function private.apply_wizard_signature_spell_assignments_v1(uuid,jsonb,text) from public,anon,authenticated;
revoke all on function private.apply_level_up_wizard_signature_spells_v1(uuid,integer,jsonb) from public,anon,authenticated;
revoke all on function private.materialize_player_forge_wizard_signature_spells_v1() from public,anon,authenticated;
revoke all on function public.complete_character_level_up_v5(uuid,jsonb) from public,anon;
grant execute on function private.level_up_wizard_signature_group_v1(uuid,integer) to service_role;
grant execute on function private.apply_wizard_signature_spell_assignments_v1(uuid,jsonb,text) to service_role;
grant execute on function private.apply_level_up_wizard_signature_spells_v1(uuid,integer,jsonb) to service_role;
grant execute on function private.materialize_player_forge_wizard_signature_spells_v1() to service_role;
grant execute on function public.complete_character_level_up_v5(uuid,jsonb) to authenticated,service_role;
