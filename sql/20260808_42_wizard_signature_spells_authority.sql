-- Connect XPHB Wizard Signature Spells to both earned level-20 progression and
-- higher-level Player Forge creation. Signature Spells are overlays on existing
-- Wizard spellbook membership: they do not create duplicate spell assignments.
-- Each selected level-3 spell is always prepared and receives one free level-3
-- cast that refreshes on a Short or Long Rest through the existing spell-use
-- resource columns and complete_character_rest_v1.

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
      'wizardSpellbookRequired',true,
      'signatureSpell',true
    )
  ) order by s.name),'[]'::jsonb)
  into v_options
  from public.spells_catalog_preferred s
  where s.level=3
    and exists(select 1 from unnest(coalesce(s.classes,'{}'::text[])) c where lower(c)='wizard');

  return jsonb_build_array(jsonb_build_object(
    'id','wizard-signature-spells',
    'ownerType','class',
    'ownerKey','wizard',
    'label','Signature Spells',
    'source','XPHB',
    'placement','spells',
    'level',20,
    'helper','Choose two level-3 Wizard spells that are in the character''s final spellbook. The client limits this list to current spellbook entries plus level-3 Wizard spells being learned during this same level gain, and the server validates the final transactional spellbook before applying the feature.',
    'metadata',jsonb_build_object('family','wizard-signature-spells','wizardSpellbookRequired',true,'spellLevel',3,'freeCastUses',1,'recharge','short_rest'),
    'fields',jsonb_build_array(jsonb_build_object(
      'id','spells',
      'label','Signature Spells',
      'kind','spell',
      'count',2,
      'required',true,
      'cadence','level-up',
      'options',v_options,
      'metadata',jsonb_build_object('spellLevel',3,'spellClasses',jsonb_build_array('Wizard'),'wizardSpellbookRequired',true)
    ))
  ));
end;
$$;

create or replace function private.apply_wizard_signature_spell_ids_v1(
  p_character_id uuid,
  p_selected jsonb,
  p_cadence text,
  p_creator text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_selected jsonb:=coalesce(p_selected,'[]'::jsonb);
  v_key text;
  v_spell_id uuid;
  v_spell public.spells_catalog%rowtype;
  v_source_type text;
  v_source_key text;
  v_summary jsonb:='[]'::jsonb;
  v_serialized jsonb:='[]'::jsonb;
  v_sheet jsonb:='{}'::jsonb;
  v_choices jsonb:='{}'::jsonb;
  v_existing_summary jsonb:='[]'::jsonb;
  v_choice_summary jsonb:='[]'::jsonb;
begin
  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if not found then raise exception 'Character progression has not been initialized.'; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found or lower(coalesce(v_class.class_key,''))<>'wizard' or upper(coalesce(v_class.source,''))<>'XPHB' then
    if jsonb_typeof(v_selected)='array' and jsonb_array_length(v_selected)>0 then raise exception 'Signature Spells are only valid for an XPHB Wizard.'; end if;
    return '[]'::jsonb;
  end if;
  if v_progression.class_level<>20 then
    if jsonb_typeof(v_selected)='array' and jsonb_array_length(v_selected)>0 then raise exception 'Signature Spells require Wizard level 20.'; end if;
    return '[]'::jsonb;
  end if;
  if jsonb_typeof(v_selected)<>'array' or jsonb_array_length(v_selected)<>2 then
    raise exception 'Signature Spells require exactly two level-3 spells from this Wizard''s spellbook.';
  end if;
  if (select count(distinct value) from jsonb_array_elements_text(v_selected))<>2 then
    raise exception 'Signature Spell selections must be distinct.';
  end if;

  for v_key in select value from jsonb_array_elements_text(v_selected) loop
    begin
      v_spell_id:=v_key::uuid;
    exception when others then
      raise exception 'Signature Spells require canonical spell ids.';
    end;
    select * into v_spell from public.spells_catalog_preferred where id=v_spell_id;
    if not found
       or v_spell.level<>3
       or not exists(select 1 from unnest(coalesce(v_spell.classes,'{}'::text[])) c where lower(c)='wizard') then
      raise exception '% is not a level-3 Wizard spell eligible for Signature Spells.',coalesce(v_spell.name,'The selected spell');
    end if;
    if not private.wizard_spellbook_has_spell_v1(p_character_id,v_spell.id) then
      raise exception '% is not in this Wizard''s spellbook and cannot be a Signature Spell.',v_spell.name;
    end if;

    update public.character_spells cs
    set prepared=true,
        always_available=true,
        uses_max=1,
        uses_remaining=1,
        recharge='short_rest',
        raw_payload=coalesce(cs.raw_payload,'{}'::jsonb)||jsonb_build_object(
          'signatureSpell',true,
          'signatureSpellFeature','Signature Spells',
          'signatureSpellLevel',3,
          'signatureSpellGrantedAtLevel',20,
          'signatureSpellFreeCastLevel',3,
          'signatureSpellCreator',coalesce(nullif(btrim(p_creator),''),'character_progression_v5')
        ),
        updated_at=now()
    where cs.character_id=p_character_id
      and cs.spell_id=v_spell.id
      and (
        cs.source_type='class'
        or (cs.source_type='class-feature' and coalesce((cs.raw_payload->>'wizardSpellbook')::boolean,false))
      )
    returning source_type,source_key into v_source_type,v_source_key;
    if not found then raise exception '% could not be resolved to one authoritative Wizard spellbook assignment.',v_spell.name; end if;

    v_summary:=v_summary||jsonb_build_array(jsonb_build_object(
      'family','wizard-signature-spells',
      'type','signature-spell',
      'groupId','wizard-signature-spells',
      'feature','Signature Spells',
      'spellId',v_spell.id,
      'spellKey',v_spell.spell_key,
      'name',v_spell.name,
      'source',v_spell.source,
      'school',v_spell.school,
      'level',20,
      'spellLevel',3,
      'membershipSourceType',v_source_type,
      'membershipSourceKey',v_source_key,
      'usesMax',1,
      'recharge','short_rest'
    ));
    v_serialized:=v_serialized||jsonb_build_array(jsonb_build_object(
      'key',v_spell.id::text,
      'name',v_spell.name,
      'source',v_spell.source,
      'kind','spell',
      'spell',jsonb_build_object('id',v_spell.id,'spellKey',v_spell.spell_key,'level',3,'school',v_spell.school)
    ));
  end loop;

  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  v_sheet:=jsonb_set(v_sheet,'{meta}',case when jsonb_typeof(v_sheet->'meta')='object' then v_sheet->'meta' else '{}'::jsonb end,true);
  v_choices:=case when jsonb_typeof(v_sheet->'classFeatureChoices')='object' then v_sheet->'classFeatureChoices' else '{}'::jsonb end;
  v_choices:=jsonb_set(v_choices,array['wizard-signature-spells'],jsonb_build_object(
    'label','Signature Spells',
    'kind','spell',
    'sourceFeature','Signature Spells',
    'source','XPHB',
    'level',20,
    'count',2,
    'placement','spells',
    'cadence',coalesce(nullif(btrim(p_cadence),''),'level-up'),
    'replacementCadence',null,
    'constraints',jsonb_build_object('spellLevel',3,'spellClasses',jsonb_build_array('Wizard'),'wizardSpellbookRequired',true,'freeCastUses',1,'recharge','short_rest'),
    'selections',v_serialized
  ),true);

  v_existing_summary:=case when jsonb_typeof(v_sheet->'classFeatureChoiceSummary')='array' then v_sheet->'classFeatureChoiceSummary' else '[]'::jsonb end;
  select coalesce(jsonb_agg(e.item),'[]'::jsonb) into v_choice_summary
  from jsonb_array_elements(v_existing_summary) as e(item)
  where coalesce(e.item->>'groupId','')<>'wizard-signature-spells';
  v_choice_summary:=v_choice_summary||(
    select coalesce(jsonb_agg(jsonb_build_object(
      'groupId','wizard-signature-spells',
      'groupLabel','Signature Spells',
      'groupKind','spell',
      'level',20,
      'placement','spells',
      'cadence',coalesce(nullif(btrim(p_cadence),''),'level-up'),
      'key',e.entry->>'key',
      'name',e.entry->>'name',
      'source',e.entry->>'source',
      'kind','spell'
    )),'[]'::jsonb)
    from jsonb_array_elements(v_serialized) as e(entry)
  );

  v_sheet:=jsonb_set(v_sheet,'{classFeatureChoices}',v_choices,true);
  v_sheet:=jsonb_set(v_sheet,'{meta,classFeatureChoices}',v_choices,true);
  v_sheet:=jsonb_set(v_sheet,'{classFeatureChoiceSummary}',v_choice_summary,true);
  v_sheet:=jsonb_set(v_sheet,'{meta,classFeatureChoiceSummary}',v_choice_summary,true);
  v_sheet:=jsonb_set(v_sheet,'{signatureSpells}',v_serialized,true);
  v_sheet:=jsonb_set(v_sheet,'{meta,signatureSpells}',v_serialized,true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now()
  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);

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
begin
  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if not found then raise exception 'Character progression has not been initialized.'; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found or lower(coalesce(v_class.class_key,''))<>'wizard' or upper(coalesce(v_class.source,''))<>'XPHB' then
    if jsonb_typeof(v_selected)='array' and jsonb_array_length(v_selected)>0 then raise exception 'Signature Spells are only valid for an XPHB Wizard.'; end if;
    return '[]'::jsonb;
  end if;
  if p_to_level<>20 then
    if jsonb_typeof(v_selected)='array' and jsonb_array_length(v_selected)>0 then raise exception 'This Wizard level does not grant Signature Spells.'; end if;
    return '[]'::jsonb;
  end if;
  if v_progression.class_level<>20 then raise exception 'Signature Spells must be applied after the Wizard level-20 spellbook transition.'; end if;
  return private.apply_wizard_signature_spell_ids_v1(p_character_id,v_selected,'level-up','character_progression_v5');
end;
$$;

create or replace function private.materialize_player_forge_wizard_signature_for_character_v1(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_sheet jsonb:='{}'::jsonb;
  v_choices jsonb:='{}'::jsonb;
  v_group jsonb;
  v_selected jsonb:='[]'::jsonb;
  v_selection jsonb;
  v_spell_id uuid;
  v_spell public.spells_catalog%rowtype;
begin
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found or v_progression.class_level<>20 then return '[]'::jsonb; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found or lower(coalesce(v_class.class_key,''))<>'wizard' or upper(coalesce(v_class.source,''))<>'XPHB' then return '[]'::jsonb; end if;

  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  if coalesce(v_sheet#>>'{meta,creator}','')<>'shared_character_forge_player_v2' then return '[]'::jsonb; end if;
  v_choices:=case when jsonb_typeof(v_sheet->'classFeatureChoices')='object' then v_sheet->'classFeatureChoices' else '{}'::jsonb end;
  v_group:=v_choices->'wizard-signature-spells';
  if v_group is null then
    select entry.value into v_group
    from jsonb_each(v_choices) as entry
    where private.normalize_player_choice_name_v1(coalesce(entry.value->>'sourceFeature',''))='signaturespells'
    order by entry.key
    limit 1;
  end if;
  if v_group is null then raise exception 'A level-20 Wizard created in Player Forge requires a Signature Spells choice group.'; end if;
  if coalesce((v_group->>'level')::integer,0)<>20 or coalesce((v_group->>'count')::integer,0)<>2 or coalesce(v_group->>'placement','')<>'spells' then
    raise exception 'The Player Forge Signature Spells choice group has an invalid level, count, or placement.';
  end if;
  if coalesce(jsonb_typeof(v_group->'selections'),'')<>'array' or jsonb_array_length(v_group->'selections')<>2 then
    raise exception 'A level-20 Wizard created in Player Forge must choose exactly two Signature Spells.';
  end if;

  for v_selection in select value from jsonb_array_elements(v_group->'selections') loop
    begin
      v_spell_id:=nullif(v_selection#>>'{spell,id}','')::uuid;
    exception when others then
      v_spell_id:=null;
    end;
    if v_spell_id is null then
      select s.id into v_spell_id
      from public.spells_catalog_preferred s
      where private.normalize_player_choice_name_v1(s.name)=private.normalize_player_choice_name_v1(v_selection->>'name')
        and (coalesce(v_selection->>'source','')='' or s.source=v_selection->>'source')
      order by case when s.source='XPHB' then 0 when s.source='PHB' then 1 else 2 end,s.name
      limit 1;
    end if;
    select * into v_spell from public.spells_catalog_preferred where id=v_spell_id;
    if not found then raise exception 'Player Forge Signature Spells contain an unavailable spell selection.'; end if;
    v_selected:=v_selected||jsonb_build_array(v_spell.id::text);
  end loop;

  return private.apply_wizard_signature_spell_ids_v1(p_character_id,v_selected,'creation','shared_character_forge_player_v2');
end;
$$;

create or replace function private.materialize_player_forge_wizard_final_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
begin
  perform private.materialize_player_forge_wizard_savant_for_character_v1(new.character_id);
  perform private.materialize_player_forge_wizard_signature_for_character_v1(new.character_id);
  return new;
end;
$$;

drop trigger if exists character_progression_materialize_player_forge_wizard_savant_v1 on public.character_progression;
drop trigger if exists character_progression_materialize_player_forge_wizard_final_v1 on public.character_progression;
create constraint trigger character_progression_materialize_player_forge_wizard_final_v1
after insert on public.character_progression
deferrable initially deferred
for each row execute function private.materialize_player_forge_wizard_final_v1();

create or replace function public.get_character_level_class_choice_options_v2(p_character_id uuid)
returns jsonb
language plpgsql
stable security definer
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

  v_invocation_summary:=private.apply_level_up_warlock_invocation_replacement_v2(p_character_id,v_to,v_invocation_replacement,v_all_class,v_feat_instances);
  v_battle_summary:=private.apply_level_up_battle_master_maneuvers_v1(p_character_id,v_to,v_battle_master,v_input->>'subclass_name');
  v_wizard_summary:=private.apply_level_up_wizard_savant_v1(p_character_id,v_to,v_wizard_savant,v_input->>'subclass_name');
  v_standard_summary:=private.apply_level_up_replacements_v1(p_character_id,v_to,v_replacements);
  v_replacement_summary:=coalesce(v_invocation_summary,'[]'::jsonb)||coalesce(v_battle_summary,'[]'::jsonb)||coalesce(v_standard_summary,'[]'::jsonb);

  v_forward_input:=jsonb_set(v_input,'{class_choice_selections}',v_forward_class,true);
  v_result:=public.complete_character_level_up_v4(p_character_id,v_forward_input-'replacement_selections');
  v_signature_summary:=private.apply_level_up_wizard_signature_spells_v1(p_character_id,v_to,v_wizard_signature);
  perform private.sync_character_eldritch_invocations_v1(p_character_id);

  select coalesce(level_choices->v_to::text,'{}'::jsonb) into v_level_choice from public.character_progression where character_id=p_character_id;
  if jsonb_array_length(v_replacement_summary)>0 then v_level_choice:=v_level_choice||jsonb_build_object('replacements',v_replacement_summary); end if;
  if jsonb_array_length(v_wizard_summary)>0 then v_level_choice:=v_level_choice||jsonb_build_object('wizard_savant_delta',v_wizard_summary); end if;
  if jsonb_array_length(v_signature_summary)>0 then v_level_choice:=v_level_choice||jsonb_build_object('wizard_signature_delta',v_signature_summary); end if;
  if jsonb_array_length(v_replacement_summary)>0 or jsonb_array_length(v_wizard_summary)>0 or jsonb_array_length(v_signature_summary)>0 then
    update public.character_progression set level_choices=jsonb_set(coalesce(level_choices,'{}'::jsonb),array[v_to::text],v_level_choice,true),updated_at=now() where character_id=p_character_id;
    select id into v_session_id from public.character_level_up_sessions where character_id=p_character_id and to_level=v_to and status='completed' order by completed_at desc limit 1;
    if v_session_id is not null then
      update public.character_level_up_sessions set selections=coalesce(selections,'{}'::jsonb)
        ||case when jsonb_array_length(v_replacement_summary)>0 then jsonb_build_object('replacement_selections',v_replacements,'invocation_replacement_selection',v_invocation_replacement,'battle_master_maneuvers',v_battle_master,'replacements',v_replacement_summary) else '{}'::jsonb end
        ||case when jsonb_array_length(v_wizard_summary)>0 then jsonb_build_object('wizard_savant_selection',v_wizard_savant,'wizard_savant_delta',v_wizard_summary) else '{}'::jsonb end
        ||case when jsonb_array_length(v_signature_summary)>0 then jsonb_build_object('wizard_signature_selection',v_wizard_signature,'wizard_signature_delta',v_signature_summary) else '{}'::jsonb end,
        updated_at=now() where id=v_session_id;
    end if;
    update public.character_level_events set details=coalesce(details,'{}'::jsonb)
      ||case when jsonb_array_length(v_replacement_summary)>0 then jsonb_build_object('replacements',v_replacement_summary) else '{}'::jsonb end
      ||case when jsonb_array_length(v_wizard_summary)>0 then jsonb_build_object('wizardSavantDelta',v_wizard_summary) else '{}'::jsonb end
      ||case when jsonb_array_length(v_signature_summary)>0 then jsonb_build_object('wizardSignatureDelta',v_signature_summary) else '{}'::jsonb end
    where id=(select id from public.character_level_events where character_id=p_character_id and event_type='level_up_completed' and to_level=v_to order by created_at desc limit 1);
  end if;

  return coalesce(v_result,'{}'::jsonb)||jsonb_build_object('replacements',v_replacement_summary,'wizardSavant',v_wizard_summary,'wizardSignature',v_signature_summary,'progression',public.get_character_progression_v1(p_character_id));
end;
$$;

revoke all on function private.level_up_wizard_signature_group_v1(uuid,integer) from public,anon,authenticated;
revoke all on function private.apply_wizard_signature_spell_ids_v1(uuid,jsonb,text,text) from public,anon,authenticated;
revoke all on function private.apply_level_up_wizard_signature_spells_v1(uuid,integer,jsonb) from public,anon,authenticated;
revoke all on function private.materialize_player_forge_wizard_signature_for_character_v1(uuid) from public,anon,authenticated;
revoke all on function private.materialize_player_forge_wizard_final_v1() from public,anon,authenticated;
grant execute on function private.level_up_wizard_signature_group_v1(uuid,integer) to service_role;
grant execute on function private.apply_wizard_signature_spell_ids_v1(uuid,jsonb,text,text) to service_role;
grant execute on function private.apply_level_up_wizard_signature_spells_v1(uuid,integer,jsonb) to service_role;
grant execute on function private.materialize_player_forge_wizard_signature_for_character_v1(uuid) to service_role;
grant execute on function private.materialize_player_forge_wizard_final_v1() to service_role;
