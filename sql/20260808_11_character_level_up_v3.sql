-- Earned progression v3: XP unlocks one next-level transaction.  The same
-- canonical advancement instance model used by higher-level Forge replay is
-- validated and materialized here after the base class-level transition.

create or replace function private.sync_player_forge_class_spell_summary_v1(p_character_id uuid)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $function$
declare v_sheet jsonb; v_names jsonb;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  select coalesce(jsonb_agg(s.name order by s.level,s.name),'[]'::jsonb) into v_names
  from public.character_spells cs join public.spells_catalog s on s.id=cs.spell_id
  where cs.character_id=p_character_id and cs.source_type='class';
  v_sheet:=jsonb_set(v_sheet,'{spells}',coalesce(v_names,'[]'::jsonb),true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now()
  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);
end;
$function$;

create or replace function private.complete_epic_level_up_base_v1(p_character_id uuid,p_selections jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth'
as $function$
declare
  v_selections jsonb:=coalesce(p_selections,'{}'::jsonb);
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_current public.class_level_progression%rowtype;
  v_next public.class_level_progression%rowtype;
  v_session public.character_level_up_sessions%rowtype;
  v_sheet jsonb;
  v_hp_method text;
  v_hit_roll integer;
  v_hp_gain integer;
  v_con_score integer:=10;
  v_con_mod integer:=0;
  v_current_hp integer:=0;
  v_current_max_hp integer:=0;
  v_new_cantrips integer:=0;
  v_new_leveled integer:=0;
  v_highest_spell_level integer:=0;
  v_spell_choices jsonb;
  v_choice jsonb;
  v_spell_id uuid;
  v_spell public.spells_catalog%rowtype;
  v_seen uuid[]:='{}'::uuid[];
  v_selected_cantrips integer:=0;
  v_selected_leveled integer:=0;
  v_prepared boolean;
  v_pending_next boolean;
  v_class_spells jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to level this character.' using errcode='42501'; end if;
  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if not found then raise exception 'Character progression has not been initialized.' using errcode='P0002'; end if;
  select * into v_session from public.character_level_up_sessions where character_id=p_character_id and status='open' for update;
  if not found then raise exception 'Open a level-up review first.' using errcode='P0002'; end if;
  if v_session.from_level<>v_progression.class_level or v_session.to_level<>v_progression.class_level+1 then raise exception 'This level-up review is stale. Refresh it before applying.'; end if;
  if not v_session.metadata_ready then raise exception '%',coalesce(v_session.preview->>'blockedReason','This level cannot be applied yet.'); end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  select * into v_current from public.class_level_progression where class_id=v_progression.class_id and class_level=v_progression.class_level;
  select * into v_next from public.class_level_progression where class_id=v_progression.class_id and class_level=v_progression.class_level+1;
  if v_class.source<>'XPHB' or not private.level_has_feature_v1(v_next.features,'Epic Boon') then raise exception 'The dedicated Epic Boon transition is only valid for a 2024 Epic Boon level.'; end if;
  if jsonb_array_length(private.unsupported_level_choice_features_v1(v_next.features))<>1 or lower(private.unsupported_level_choice_features_v1(v_next.features)->>0)<>'epic boon' then raise exception 'This level contains another class-specific choice that must be modeled before completion.'; end if;
  if v_progression.experience_points<v_next.xp_threshold then raise exception 'The required XP threshold has not been reached.'; end if;

  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  v_hp_method:=lower(btrim(coalesce(v_selections->>'hp_method','')));
  if v_hp_method not in ('fixed','roll') then raise exception 'Choose fixed or roll for the hit point increase.'; end if;
  begin v_con_score:=coalesce(nullif(v_sheet #>> '{abilities,con,score}','')::integer,nullif(v_sheet #>> '{abilities,con}','')::integer,10); exception when others then v_con_score:=10; end;
  v_con_mod:=floor((v_con_score-10)/2.0)::integer;
  if v_hp_method='roll' then v_hit_roll:=1+floor(random()*greatest(1,coalesce(v_class.hit_die,8)))::integer; else v_hit_roll:=floor(coalesce(v_class.hit_die,8)/2.0)::integer+1; end if;
  v_hp_gain:=greatest(1,v_hit_roll+v_con_mod);
  begin v_current_max_hp:=coalesce(nullif(v_sheet->>'maxHp','')::integer,nullif(v_sheet->>'hp','')::integer,0); v_current_hp:=coalesce(nullif(v_sheet->>'hp','')::integer,v_current_max_hp,0); exception when others then v_current_max_hp:=0; v_current_hp:=0; end;

  v_new_cantrips:=greatest(0,coalesce(v_next.cantrips_known,0)-coalesce(v_current.cantrips_known,0));
  if v_class.class_key='wizard' then v_new_leveled:=2;
  elsif v_class.spellcasting_ability is not null then
    if v_current.spells_known is null or v_next.spells_known is null then raise exception 'Prepared/known spell progression metadata is unavailable.'; end if;
    v_new_leveled:=greatest(0,v_next.spells_known-v_current.spells_known);
  end if;
  v_highest_spell_level:=private.highest_spell_level_from_slots_v1(v_next.spell_slots);
  v_spell_choices:=coalesce(v_selections->'spell_choices','[]'::jsonb);
  if jsonb_typeof(v_spell_choices)<>'array' then raise exception 'Spell choices must be an array.'; end if;
  for v_choice in select value from jsonb_array_elements(v_spell_choices) loop
    begin v_spell_id:=(v_choice->>'spell_id')::uuid; exception when others then raise exception 'Every spell choice needs a valid spell_id.'; end;
    if v_spell_id=any(v_seen) then raise exception 'Duplicate spell choices are not allowed.'; end if; v_seen:=array_append(v_seen,v_spell_id);
    select * into v_spell from public.spells_catalog where id=v_spell_id;
    if not found then raise exception 'A selected spell was not found.'; end if;
    if not public.is_preferred_spell_version_v1(v_spell.id) then raise exception '% must use its preferred spell version.',v_spell.name; end if;
    if not exists(select 1 from unnest(coalesce(v_spell.classes,'{}'::text[])) c where lower(c)=lower(v_class.class_name)) then raise exception '% is not on the % spell list.',v_spell.name,v_class.class_name; end if;
    if exists(select 1 from public.character_spells where character_id=p_character_id and spell_id=v_spell_id and source_type='class') then raise exception '% is already in this character class spell list.',v_spell.name; end if;
    if v_spell.level=0 then v_selected_cantrips:=v_selected_cantrips+1;
    elsif v_spell.level between 1 and v_highest_spell_level then v_selected_leveled:=v_selected_leveled+1;
    else raise exception '% is not unlocked at level %.',v_spell.name,v_next.class_level; end if;
    begin v_prepared:=coalesce((v_choice->>'prepared')::boolean,true); exception when others then v_prepared:=true; end;
    insert into public.character_spells(character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,casting_stat,raw_payload)
    values(p_character_id,v_spell_id,'class',v_class.class_key,v_class.class_name,true,case when v_spell.level=0 then true else v_prepared end,v_spell.level=0,v_class.spellcasting_ability,jsonb_build_object('grantedAtLevel',v_next.class_level,'rulesetSource','XPHB','creator','level_up_v3'));
  end loop;
  if v_selected_cantrips<>v_new_cantrips then raise exception 'Choose exactly % new cantrip(s).',v_new_cantrips; end if;
  if v_selected_leveled<>v_new_leveled then raise exception 'Choose exactly % new leveled spell(s).',v_new_leveled; end if;

  select coalesce(jsonb_agg(s.name order by s.level,s.name),'[]'::jsonb) into v_class_spells from public.character_spells cs join public.spells_catalog s on s.id=cs.spell_id where cs.character_id=p_character_id and cs.source_type='class';
  v_sheet:=v_sheet||jsonb_build_object('level',v_next.class_level,'proficiencyBonus',v_next.proficiency_bonus,'hitDice',v_next.class_level::text||'d'||coalesce(v_class.hit_die,8)::text,'hp',v_current_hp+v_hp_gain,'maxHp',v_current_max_hp+v_hp_gain,'rulesetSource','XPHB','ruleset','2024','spellSlots',v_next.spell_slots,'spells',coalesce(v_class_spells,'[]'::jsonb));
  v_sheet:=v_sheet||jsonb_build_object('meta',coalesce(v_sheet->'meta','{}'::jsonb)||jsonb_build_object('classKey',v_class.class_key,'className',v_class.class_name,'level',v_next.class_level,'rulesetSource','XPHB','ruleset','2024'));
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now() where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);
  v_pending_next:=v_next.class_level<20 and v_progression.experience_points>=public.xp_threshold_for_level_v1(v_next.class_level+1);
  update public.character_progression set class_level=v_next.class_level,pending_level_up=v_pending_next,level_choices=coalesce(level_choices,'{}'::jsonb)||jsonb_build_object(v_next.class_level::text,v_selections),updated_at=now() where character_id=p_character_id;
  update public.character_level_up_sessions set status='completed',selections=v_selections,completed_at=now(),updated_at=now() where id=v_session.id;
  insert into public.character_level_events(character_id,event_type,from_level,to_level,xp_before,xp_after,details,created_by)
  values(p_character_id,'level_up_completed',v_progression.class_level,v_next.class_level,v_progression.experience_points,v_progression.experience_points,jsonb_build_object('sessionId',v_session.id,'hpMethod',v_hp_method,'hitDieResult',v_hit_roll,'hpGain',v_hp_gain,'advancementType','epic-boon','newCantrips',v_new_cantrips,'newLeveledSpells',v_new_leveled),auth.uid());
  return jsonb_build_object('progression',public.get_character_progression_v1(p_character_id),'levelUp',jsonb_build_object('fromLevel',v_progression.class_level,'toLevel',v_next.class_level,'hpMethod',v_hp_method,'hitDieResult',v_hit_roll,'hpGain',v_hp_gain));
end;
$function$;

create or replace function public.complete_character_level_up_v3(p_character_id uuid,p_selections jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth'
as $function$
declare
  v_input jsonb:=coalesce(p_selections,'{}'::jsonb);
  v_progression public.character_progression%rowtype;
  v_next public.class_level_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_instance jsonb:=coalesce(v_input->'advancement_instance','{}'::jsonb);
  v_requires_asi boolean:=false;
  v_requires_epic boolean:=false;
  v_option_id uuid;
  v_option public.character_option_catalog%rowtype;
  v_base jsonb;
  v_result jsonb;
  v_sanitized jsonb;
  v_level_choice jsonb;
  v_session_id uuid;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to level this character.' using errcode='42501'; end if;
  if jsonb_typeof(v_input)<>'object' then raise exception 'Level-up selections must be a JSON object.'; end if;
  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if not found then raise exception 'Character progression has not been initialized.' using errcode='P0002'; end if;
  if v_progression.class_level>=20 then raise exception 'This character is already level 20.'; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  select * into v_next from public.class_level_progression where class_id=v_progression.class_id and class_level=v_progression.class_level+1;
  if not found then raise exception 'Next-level progression metadata is unavailable.'; end if;
  v_requires_asi:=private.level_has_feature_v1(v_next.features,'Ability Score Improvement');
  v_requires_epic:=private.level_has_feature_v1(v_next.features,'Epic Boon');
  if v_requires_asi or v_requires_epic then
    v_option_id:=private.level_up_advancement_option_id_v1(p_character_id,v_next.class_level,v_instance,v_requires_epic);
    select * into v_option from public.character_option_catalog where id=v_option_id;
  elsif jsonb_typeof(v_input->'advancement_instance') is not null then
    raise exception 'This level does not grant a feat or Epic Boon advancement.';
  end if;

  v_base:=jsonb_strip_nulls(jsonb_build_object(
    'hp_method',v_input->>'hp_method',
    'subclass_name',nullif(v_input->>'subclass_name',''),
    'subclass_source',nullif(v_input->>'subclass_source',''),
    'spell_choices',coalesce(v_input->'spell_choices','[]'::jsonb)
  ));
  if v_requires_asi then
    -- Treat every General option, including the ASI option itself, as a canonical
    -- feat in the legacy base transaction.  v3 applies the actual source effects.
    v_base:=v_base||jsonb_build_object('advancement_type','feat','feat_name',v_option.name);
    v_result:=public.complete_character_level_up_v2(p_character_id,v_base);
  elsif v_requires_epic then
    v_result:=private.complete_epic_level_up_base_v1(p_character_id,v_base);
  else
    v_result:=public.complete_character_level_up_v2(p_character_id,v_base);
  end if;

  perform private.sync_player_forge_class_spell_summary_v1(p_character_id);
  if v_option_id is not null then
    v_sanitized:=private.apply_character_level_advancement_v1(p_character_id,v_next.class_level,v_option_id,v_instance);
    select coalesce(level_choices->(v_next.class_level::text),'{}'::jsonb) into v_level_choice from public.character_progression where character_id=p_character_id;
    v_level_choice:=v_level_choice||jsonb_build_object('advancement_instance',v_sanitized);
    update public.character_progression set level_choices=jsonb_set(coalesce(level_choices,'{}'::jsonb),array[v_next.class_level::text],v_level_choice,true),updated_at=now() where character_id=p_character_id;
    select id into v_session_id from public.character_level_up_sessions where character_id=p_character_id and to_level=v_next.class_level and status='completed' order by completed_at desc limit 1;
    if v_session_id is not null then update public.character_level_up_sessions set selections=coalesce(selections,'{}'::jsonb)||jsonb_build_object('advancement_instance',v_sanitized),updated_at=now() where id=v_session_id; end if;
    update public.character_level_events set details=coalesce(details,'{}'::jsonb)||jsonb_build_object('advancementOptionId',v_option.id,'advancementName',v_option.name,'advancementSource',v_option.source,'advancementInstance',v_sanitized)
    where id=(select id from public.character_level_events where character_id=p_character_id and event_type='level_up_completed' and to_level=v_next.class_level order by created_at desc limit 1);
  end if;
  return coalesce(v_result,'{}'::jsonb)||jsonb_build_object('progression',public.get_character_progression_v1(p_character_id),'advancement',v_sanitized);
end;
$function$;

revoke all on function public.complete_character_level_up_v3(uuid,jsonb) from public,anon;
grant execute on function public.complete_character_level_up_v3(uuid,jsonb) to authenticated;
