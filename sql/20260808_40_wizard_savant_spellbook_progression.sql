-- Connect XPHB Wizard Savant spellbook additions to earned progression without
-- inflating the base Wizard source_type='class' spell count used by Forge validation.
-- Savant spells are source-owned class-feature spellbook entries.

create or replace function private.wizard_savant_school_v1(p_subclass_name text)
returns text
language sql
immutable
set search_path=pg_catalog
as $$
  select case private.normalize_player_choice_name_v1(coalesce(p_subclass_name,''))
    when 'abjurer' then 'Abjuration'
    when 'diviner' then 'Divination'
    when 'evoker' then 'Evocation'
    when 'illusionist' then 'Illusion'
    else null end;
$$;

create or replace function private.wizard_spellbook_has_spell_v1(p_character_id uuid,p_spell_id uuid)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $$
  select exists(
    select 1
    from public.character_progression cp
    join public.class_catalog c on c.id=cp.class_id
    join public.character_spells cs on cs.character_id=cp.character_id and cs.spell_id=p_spell_id
    where cp.character_id=p_character_id
      and lower(coalesce(c.class_key,''))='wizard'
      and (
        cs.source_type='class'
        or (
          cs.source_type='class-feature'
          and coalesce((cs.raw_payload->>'wizardSpellbook')::boolean,false)
        )
      )
  );
$$;

create or replace function private.validate_wizard_spellbook_uniqueness_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_class_key text;
  v_count integer:=0;
begin
  select lower(coalesce(c.class_key,'')) into v_class_key
  from public.character_progression cp
  join public.class_catalog c on c.id=cp.class_id
  where cp.character_id=new.character_id;
  if coalesce(v_class_key,'')<>'wizard' then return new; end if;

  if not (
    new.source_type='class'
    or (new.source_type='class-feature' and coalesce((new.raw_payload->>'wizardSpellbook')::boolean,false))
  ) then return new; end if;

  select count(*) into v_count
  from public.character_spells cs
  where cs.character_id=new.character_id
    and cs.spell_id=new.spell_id
    and (
      cs.source_type='class'
      or (cs.source_type='class-feature' and coalesce((cs.raw_payload->>'wizardSpellbook')::boolean,false))
    );
  if v_count>1 then
    raise exception 'A Wizard spell can appear only once in the character spellbook, regardless of whether it came from normal Wizard progression or a Savant feature.';
  end if;
  return new;
end;
$$;

drop trigger if exists character_spells_validate_wizard_spellbook_uniqueness_v1 on public.character_spells;
create constraint trigger character_spells_validate_wizard_spellbook_uniqueness_v1
after insert or update of spell_id,source_type,source_key,raw_payload on public.character_spells
deferrable initially deferred
for each row execute function private.validate_wizard_spellbook_uniqueness_v1();

create or replace function private.level_up_wizard_savant_group_v1(p_character_id uuid,p_to_level integer)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_school text;
  v_entry_candidate boolean:=false;
  v_current public.class_level_progression%rowtype;
  v_next public.class_level_progression%rowtype;
  v_current_max integer:=0;
  v_next_max integer:=0;
  v_count integer:=0;
  v_options jsonb:='[]'::jsonb;
  v_required boolean:=true;
  v_label text;
begin
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found or p_to_level<>v_progression.class_level+1 then return '[]'::jsonb; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found or lower(coalesce(v_class.class_key,''))<>'wizard' or upper(coalesce(v_class.source,''))<>'XPHB' then return '[]'::jsonb; end if;

  v_school:=private.wizard_savant_school_v1(v_progression.subclass_name);
  v_entry_candidate:=p_to_level=3 and coalesce(btrim(v_progression.subclass_name),'')='';
  if v_school is null and not v_entry_candidate then return '[]'::jsonb; end if;

  select * into v_current from public.class_level_progression where class_id=v_progression.class_id and class_level=v_progression.class_level;
  select * into v_next from public.class_level_progression where class_id=v_progression.class_id and class_level=p_to_level;
  if not found then return '[]'::jsonb; end if;
  v_current_max:=private.highest_spell_level_from_slots_v1(coalesce(v_current.spell_slots,'[]'::jsonb));
  v_next_max:=private.highest_spell_level_from_slots_v1(coalesce(v_next.spell_slots,'[]'::jsonb));

  if v_entry_candidate then
    v_count:=2;
    v_required:=false;
    v_label:='Savant spellbook additions — applies to Abjurer, Diviner, Evoker, or Illusionist';
    select coalesce(jsonb_agg(jsonb_build_object(
      'key',s.id::text,'value',s.id::text,'label',s.name,'source',s.source,'kind','spell','description',coalesce(s.description,''),
      'metadata',jsonb_build_object('spellId',s.id,'spellKey',s.spell_key,'level',s.level,'school',s.school,'wizardSpellbook',true)
    ) order by s.school,s.level,s.name),'[]'::jsonb)
    into v_options
    from public.spells_catalog_preferred s
    where s.level between 0 and 2
      and s.school in ('Abjuration','Divination','Evocation','Illusion')
      and exists(select 1 from unnest(coalesce(s.classes,'{}'::text[])) c where lower(c)='wizard')
      and not private.wizard_spellbook_has_spell_v1(p_character_id,s.id);
  else
    if v_school is null or p_to_level<=3 or v_next_max<=v_current_max then return '[]'::jsonb; end if;
    v_count:=1;
    v_label:=v_school||' Savant: free spellbook addition';
    select coalesce(jsonb_agg(jsonb_build_object(
      'key',s.id::text,'value',s.id::text,'label',s.name,'source',s.source,'kind','spell','description',coalesce(s.description,''),
      'metadata',jsonb_build_object('spellId',s.id,'spellKey',s.spell_key,'level',s.level,'school',s.school,'wizardSpellbook',true)
    ) order by s.level,s.name),'[]'::jsonb)
    into v_options
    from public.spells_catalog_preferred s
    where s.level between 1 and v_next_max
      and s.school=v_school
      and exists(select 1 from unnest(coalesce(s.classes,'{}'::text[])) c where lower(c)='wizard')
      and not private.wizard_spellbook_has_spell_v1(p_character_id,s.id);
  end if;

  return jsonb_build_array(jsonb_build_object(
    'id','wizard-savant-spellbook-addition',
    'ownerType','subclass',
    'ownerKey',coalesce(v_progression.subclass_name,'pending-wizard-subclass'),
    'label',v_label,
    'source','XPHB',
    'placement','class',
    'level',p_to_level,
    'helper',case when v_entry_candidate
      then 'Fill this only if the selected level-3 Wizard subclass is Abjurer, Diviner, Evoker, or Illusionist. Both spells must match that subclass school.'
      else 'Savant adds one Wizard spell from your subclass school for free whenever this Wizard gains access to a new spell-slot level.' end,
    'metadata',jsonb_build_object(
      'family','wizard-savant',
      'school',v_school,
      'conditionalSubclasses',case when v_entry_candidate then jsonb_build_array('Abjurer','Diviner','Evoker','Illusionist') else null end,
      'wizardSpellbook',true,
      'slotLevelBefore',v_current_max,
      'slotLevelAfter',v_next_max
    ),
    'fields',jsonb_build_array(jsonb_build_object(
      'id','spells','label',v_label,'kind','spell','count',v_count,'required',v_required,'cadence','level-up','options',v_options,
      'metadata',jsonb_build_object('wizardSpellbook',true,'school',v_school,'maxSpellLevel',case when v_entry_candidate then 2 else v_next_max end)
    ))
  ));
end;
$$;

create or replace function private.apply_level_up_wizard_savant_v1(
  p_character_id uuid,
  p_to_level integer,
  p_group jsonb,
  p_selected_subclass text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_current public.class_level_progression%rowtype;
  v_next public.class_level_progression%rowtype;
  v_effective_subclass text;
  v_school text;
  v_current_max integer:=0;
  v_next_max integer:=0;
  v_expected integer:=0;
  v_selected jsonb:=coalesce(p_group->'spells','[]'::jsonb);
  v_key text;
  v_spell public.spells_catalog%rowtype;
  v_group_key text;
  v_feature_name text;
  v_serialized jsonb:='[]'::jsonb;
  v_sheet jsonb:='{}'::jsonb;
  v_choices jsonb:='{}'::jsonb;
  v_summary jsonb:='[]'::jsonb;
begin
  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if not found then raise exception 'Character progression has not been initialized.'; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found or lower(coalesce(v_class.class_key,''))<>'wizard' or upper(coalesce(v_class.source,''))<>'XPHB' then
    if jsonb_typeof(v_selected)='array' and jsonb_array_length(v_selected)>0 then raise exception 'Savant spellbook choices are only valid for an XPHB Wizard.'; end if;
    return '[]'::jsonb;
  end if;

  v_effective_subclass:=coalesce(nullif(btrim(p_selected_subclass),''),v_progression.subclass_name,'');
  v_school:=private.wizard_savant_school_v1(v_effective_subclass);
  if v_school is null then
    if jsonb_typeof(v_selected)='array' and jsonb_array_length(v_selected)>0 then raise exception 'Savant spellbook choices were supplied, but the selected Wizard subclass has no XPHB Savant feature.'; end if;
    return '[]'::jsonb;
  end if;

  select * into v_current from public.class_level_progression where class_id=v_progression.class_id and class_level=v_progression.class_level;
  select * into v_next from public.class_level_progression where class_id=v_progression.class_id and class_level=p_to_level;
  if not found then raise exception 'Wizard progression metadata is unavailable for this level.'; end if;
  v_current_max:=private.highest_spell_level_from_slots_v1(coalesce(v_current.spell_slots,'[]'::jsonb));
  v_next_max:=private.highest_spell_level_from_slots_v1(coalesce(v_next.spell_slots,'[]'::jsonb));

  if p_to_level=3 and coalesce(btrim(v_progression.subclass_name),'')='' then
    v_expected:=2;
  elsif p_to_level>3 and v_next_max>v_current_max then
    v_expected:=1;
  else
    v_expected:=0;
  end if;

  if v_expected=0 then
    if jsonb_typeof(v_selected)='array' and jsonb_array_length(v_selected)>0 then raise exception 'This Wizard level does not grant a Savant spellbook addition.'; end if;
    return '[]'::jsonb;
  end if;
  if jsonb_typeof(v_selected)<>'array' or jsonb_array_length(v_selected)<>v_expected then
    raise exception '% Savant requires exactly % free spellbook selection(s) at Wizard level %.',v_school,v_expected,p_to_level;
  end if;
  if (select count(distinct value) from jsonb_array_elements_text(v_selected))<>v_expected then raise exception 'Savant spellbook selections must be distinct.'; end if;

  v_feature_name:=v_school||' Savant';
  v_group_key:=case when p_to_level=3 then 'wizard-'||lower(v_school)||'-savant' else 'wizard-'||lower(v_school)||'-savant-level-'||p_to_level::text end;

  for v_key in select value from jsonb_array_elements_text(v_selected) loop
    begin select * into v_spell from public.spells_catalog_preferred where id=v_key::uuid; exception when others then raise exception 'Savant requires canonical spell ids.'; end;
    if not found
       or v_spell.school<>v_school
       or not exists(select 1 from unnest(coalesce(v_spell.classes,'{}'::text[])) c where lower(c)='wizard')
       or (p_to_level=3 and not(v_spell.level between 0 and 2))
       or (p_to_level>3 and not(v_spell.level between 1 and v_next_max)) then
      raise exception '% is not a source-legal % Savant spellbook addition at Wizard level %.',coalesce(v_spell.name,'The selected spell'),v_school,p_to_level;
    end if;
    if private.wizard_spellbook_has_spell_v1(p_character_id,v_spell.id) then raise exception '% is already in this Wizard spellbook.',v_spell.name; end if;

    insert into public.character_spells(
      character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,casting_stat,raw_payload
    ) values(
      p_character_id,v_spell.id,'class-feature',v_group_key,v_feature_name,true,false,false,'int',
      jsonb_build_object('creator','character_progression_v5','wizardSpellbook',true,'feature',v_feature_name,'school',v_school,'grantedAtLevel',p_to_level,'subclass',v_effective_subclass)
    );
    v_serialized:=v_serialized||jsonb_build_array(jsonb_build_object(
      'key',v_spell.id::text,'name',v_spell.name,'source',v_spell.source,'kind','spell','spell',jsonb_build_object('id',v_spell.id,'spellKey',v_spell.spell_key,'level',v_spell.level,'school',v_spell.school)
    ));
    v_summary:=v_summary||jsonb_build_array(jsonb_build_object(
      'family','wizard-savant','type','spellbook-addition','groupId',v_group_key,'feature',v_feature_name,'school',v_school,'spellId',v_spell.id,'name',v_spell.name,'level',p_to_level,'source','XPHB'
    ));
  end loop;

  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  v_choices:=case when jsonb_typeof(v_sheet->'classFeatureChoices')='object' then v_sheet->'classFeatureChoices' else '{}'::jsonb end;
  v_choices:=jsonb_set(v_choices,array[v_group_key],jsonb_build_object(
    'label',v_feature_name||case when p_to_level=3 then ' spellbook additions' else ' free spellbook addition' end,
    'kind','spell','sourceFeature',v_feature_name,'source','XPHB','level',p_to_level,'count',v_expected,'placement','class',
    'subclassName',v_effective_subclass,'cadence','creation','replacementCadence',null,
    'constraints',jsonb_build_object('spellClasses',jsonb_build_array('Wizard'),'schools',jsonb_build_array(v_school),'maxSpellLevel',case when p_to_level=3 then 2 else v_next_max end,'wizardSpellbook',true),
    'selections',v_serialized
  ),true);
  v_sheet:=jsonb_set(v_sheet,'{classFeatureChoices}',v_choices,true);
  v_sheet:=jsonb_set(v_sheet,'{meta,classFeatureChoices}',v_choices,true);
  v_sheet:=jsonb_set(v_sheet,'{classFeatureChoiceSummary}',
    (case when jsonb_typeof(v_sheet->'classFeatureChoiceSummary')='array' then v_sheet->'classFeatureChoiceSummary' else '[]'::jsonb end)||
    (select coalesce(jsonb_agg(jsonb_build_object('groupId',v_group_key,'groupLabel',v_feature_name,'groupKind','spell','level',p_to_level,'key',e.value->>'key','name',e.value->>'name','source',e.value->>'source','kind','spell')),'[]'::jsonb) from jsonb_array_elements(v_serialized) e(value)),true);
  v_sheet:=jsonb_set(v_sheet,'{meta,classFeatureChoiceSummary}',v_sheet->'classFeatureChoiceSummary',true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now() where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);
  return v_summary;
end;
$$;

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
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to review these class choices.' using errcode='42501'; end if;
  v_base:=public.get_character_level_class_choice_options_v1(p_character_id);
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found or v_progression.class_level>=20 then return v_base; end if;
  v_extra:=private.level_up_warlock_invocation_groups_v1(p_character_id,v_progression.class_level+1);
  v_replacement:=private.level_up_warlock_invocation_replacement_group_v1(p_character_id,v_progression.class_level+1);
  v_battle_master:=private.level_up_battle_master_maneuver_group_v1(p_character_id,v_progression.class_level+1);
  v_wizard_savant:=private.level_up_wizard_savant_group_v1(p_character_id,v_progression.class_level+1);
  return jsonb_set(coalesce(v_base,'{}'::jsonb),'{groups}',coalesce(v_base->'groups','[]'::jsonb)||coalesce(v_extra,'[]'::jsonb)||coalesce(v_replacement,'[]'::jsonb)||coalesce(v_battle_master,'[]'::jsonb)||coalesce(v_wizard_savant,'[]'::jsonb),true);
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
  v_forward_class jsonb:=v_all_class-'warlock-invocation-replacement'-'fighter-battle-master-maneuvers'-'wizard-savant-spellbook-addition';
  v_feat_instances jsonb:=coalesce(v_input->'class_option_feat_instances','[]'::jsonb);
  v_invocation_summary jsonb:='[]'::jsonb;
  v_battle_summary jsonb:='[]'::jsonb;
  v_wizard_summary jsonb:='[]'::jsonb;
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
  perform private.sync_character_eldritch_invocations_v1(p_character_id);

  select coalesce(level_choices->v_to::text,'{}'::jsonb) into v_level_choice from public.character_progression where character_id=p_character_id;
  if jsonb_array_length(v_replacement_summary)>0 then v_level_choice:=v_level_choice||jsonb_build_object('replacements',v_replacement_summary); end if;
  if jsonb_array_length(v_wizard_summary)>0 then v_level_choice:=v_level_choice||jsonb_build_object('wizard_savant_delta',v_wizard_summary); end if;
  if jsonb_array_length(v_replacement_summary)>0 or jsonb_array_length(v_wizard_summary)>0 then
    update public.character_progression set level_choices=jsonb_set(coalesce(level_choices,'{}'::jsonb),array[v_to::text],v_level_choice,true),updated_at=now() where character_id=p_character_id;
    select id into v_session_id from public.character_level_up_sessions where character_id=p_character_id and to_level=v_to and status='completed' order by completed_at desc limit 1;
    if v_session_id is not null then
      update public.character_level_up_sessions set selections=coalesce(selections,'{}'::jsonb)
        ||case when jsonb_array_length(v_replacement_summary)>0 then jsonb_build_object('replacement_selections',v_replacements,'invocation_replacement_selection',v_invocation_replacement,'battle_master_maneuvers',v_battle_master,'replacements',v_replacement_summary) else '{}'::jsonb end
        ||case when jsonb_array_length(v_wizard_summary)>0 then jsonb_build_object('wizard_savant_selection',v_wizard_savant,'wizard_savant_delta',v_wizard_summary) else '{}'::jsonb end,
        updated_at=now() where id=v_session_id;
    end if;
    update public.character_level_events set details=coalesce(details,'{}'::jsonb)
      ||case when jsonb_array_length(v_replacement_summary)>0 then jsonb_build_object('replacements',v_replacement_summary) else '{}'::jsonb end
      ||case when jsonb_array_length(v_wizard_summary)>0 then jsonb_build_object('wizardSavantDelta',v_wizard_summary) else '{}'::jsonb end
    where id=(select id from public.character_level_events where character_id=p_character_id and event_type='level_up_completed' and to_level=v_to order by created_at desc limit 1);
  end if;

  return coalesce(v_result,'{}'::jsonb)||jsonb_build_object('replacements',v_replacement_summary,'wizardSavant',v_wizard_summary,'progression',public.get_character_progression_v1(p_character_id));
end;
$$;

revoke all on function private.wizard_savant_school_v1(text) from public,anon,authenticated;
revoke all on function private.wizard_spellbook_has_spell_v1(uuid,uuid) from public,anon,authenticated;
revoke all on function private.validate_wizard_spellbook_uniqueness_v1() from public,anon,authenticated;
revoke all on function private.level_up_wizard_savant_group_v1(uuid,integer) from public,anon,authenticated;
revoke all on function private.apply_level_up_wizard_savant_v1(uuid,integer,jsonb,text) from public,anon,authenticated;
revoke all on function public.complete_character_level_up_v5(uuid,jsonb) from public,anon;
grant execute on function private.wizard_savant_school_v1(text) to service_role;
grant execute on function private.wizard_spellbook_has_spell_v1(uuid,uuid) to service_role;
grant execute on function private.validate_wizard_spellbook_uniqueness_v1() to service_role;
grant execute on function private.level_up_wizard_savant_group_v1(uuid,integer) to service_role;
grant execute on function private.apply_level_up_wizard_savant_v1(uuid,integer,jsonb,text) to service_role;
grant execute on function public.complete_character_level_up_v5(uuid,jsonb) to authenticated,service_role;
