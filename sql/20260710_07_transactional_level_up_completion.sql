-- Transactional 2024 level-up completion for fully modeled choice sets.

create or replace function private.highest_spell_level_from_slots_v1(p_slots jsonb)
returns integer
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_index integer;
  v_highest integer := 0;
begin
  if jsonb_typeof(coalesce(p_slots,'[]'::jsonb)) = 'array' then
    if jsonb_array_length(p_slots) > 0 then
      for v_index in 0..jsonb_array_length(p_slots)-1 loop
        if coalesce((p_slots->>v_index)::integer,0) > 0 then
          v_highest := v_index + 1;
        end if;
      end loop;
    end if;
  elsif jsonb_typeof(p_slots) = 'object' then
    v_highest := greatest(0,coalesce((p_slots->>'pactSlotLevel')::integer,0));
  end if;
  return v_highest;
exception when invalid_text_representation then
  return 0;
end;
$$;

create or replace function private.level_has_feature_v1(p_features jsonb, p_name text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from jsonb_array_elements(coalesce(p_features,'[]'::jsonb)) feature(value)
    where lower(coalesce(value->>'name', value #>> '{}', value::text)) like '%' || lower(coalesce(p_name,'')) || '%'
  );
$$;

create or replace function private.unsupported_level_choice_features_v1(p_features jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(jsonb_agg(label order by label), '[]'::jsonb)
  from (
    select distinct candidate.label
    from jsonb_array_elements(coalesce(p_features,'[]'::jsonb)) feature(value)
    cross join lateral (
      values
        ('Weapon Mastery'),
        ('Fighting Style'),
        ('Expertise'),
        ('Divine Order'),
        ('Primal Order'),
        ('Scholar'),
        ('Primal Knowledge'),
        ('Metamagic'),
        ('Eldritch Invocation'),
        ('Magical Secrets'),
        ('Epic Boon'),
        ('Blessed Strikes'),
        ('Elemental Fury')
    ) candidate(label)
    where lower(coalesce(feature.value->>'name', feature.value #>> '{}', feature.value::text))
      like '%' || lower(candidate.label) || '%'
  ) unresolved;
$$;

create or replace function public.get_character_level_up_review_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_session public.character_level_up_sessions%rowtype;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to view this level-up review.' using errcode = '42501';
  end if;

  select * into v_session
  from public.character_level_up_sessions
  where character_id = p_character_id and status = 'open'
  order by created_at desc
  limit 1;

  if v_session.id is null then return null; end if;
  return jsonb_build_object(
    'session', to_jsonb(v_session),
    'preview', v_session.preview,
    'metadataReady', v_session.metadata_ready,
    'canComplete', v_session.metadata_ready,
    'message', case
      when v_session.metadata_ready then 'All required choices in this level are supported and can be applied transactionally.'
      else coalesce(v_session.preview->>'blockedReason','This level includes choices that are not modeled yet.')
    end
  );
end;
$$;

create or replace function public.begin_character_level_up_v1(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_current public.class_level_progression%rowtype;
  v_next public.class_level_progression%rowtype;
  v_session public.character_level_up_sessions%rowtype;
  v_required jsonb := '[]'::jsonb;
  v_preview jsonb;
  v_metadata_ready boolean;
  v_spell_metadata_ready boolean := true;
  v_created boolean := false;
  v_new_cantrips integer := 0;
  v_new_leveled integer := 0;
  v_highest_spell_level integer := 0;
  v_unsupported jsonb := '[]'::jsonb;
  v_requires_subclass boolean := false;
  v_requires_advancement boolean := false;
  v_blocked_reason text;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to level this character.' using errcode = '42501';
  end if;

  select * into v_progression
  from public.character_progression
  where character_id = p_character_id
  for update;

  if v_progression.character_id is null then
    raise exception 'Character progression has not been initialized.' using errcode = 'P0002';
  end if;
  if v_progression.class_level >= 20 then
    raise exception 'This character is already level 20.';
  end if;
  if not v_progression.pending_level_up then
    raise exception 'The XP threshold for the next level has not been reached.';
  end if;

  select * into v_class from public.class_catalog where id = v_progression.class_id;
  select * into v_current
  from public.class_level_progression
  where class_id = v_progression.class_id and class_level = v_progression.class_level;
  select * into v_next
  from public.class_level_progression
  where class_id = v_progression.class_id and class_level = v_progression.class_level + 1;

  if v_next.class_id is null then
    raise exception 'Next-level progression metadata is unavailable.' using errcode = 'P0002';
  end if;

  v_new_cantrips := greatest(0,coalesce(v_next.cantrips_known,0)-coalesce(v_current.cantrips_known,0));
  if v_class.class_key = 'wizard' then
    v_new_leveled := 2;
  elsif v_class.spellcasting_ability is not null then
    if v_current.spells_known is null or v_next.spells_known is null then
      v_spell_metadata_ready := false;
      v_new_leveled := 0;
    else
      v_new_leveled := greatest(0,v_next.spells_known-v_current.spells_known);
    end if;
  end if;
  v_highest_spell_level := private.highest_spell_level_from_slots_v1(v_next.spell_slots);
  v_requires_subclass := v_next.class_level = 3 and nullif(btrim(coalesce(v_progression.subclass_name,'')),'') is null;
  v_requires_advancement := private.level_has_feature_v1(v_next.features,'Ability Score Improvement');
  v_unsupported := private.unsupported_level_choice_features_v1(v_next.features);

  v_required := v_required || jsonb_build_array(jsonb_build_object(
    'key','hp_method','type','single','label','Hit Point Increase',
    'options',jsonb_build_array('fixed','roll'),'required',true,'hitDie',v_class.hit_die
  ));
  if v_requires_subclass then
    v_required := v_required || jsonb_build_array(jsonb_build_object(
      'key','subclass_name','type','text','label','Subclass','required',true
    ));
  end if;
  if v_requires_advancement then
    v_required := v_required || jsonb_build_array(jsonb_build_object(
      'key','advancement','type','asi_or_feat','label','Ability Score Improvement or Feat','required',true
    ));
  end if;
  if v_new_cantrips > 0 or v_new_leveled > 0 then
    v_required := v_required || jsonb_build_array(jsonb_build_object(
      'key','spell_choices','type','spells','label','New Class Spells','required',true,
      'cantrips',v_new_cantrips,'leveled',v_new_leveled,'highestSpellLevel',v_highest_spell_level
    ));
  end if;

  v_metadata_ready := v_class.source = 'XPHB'
    and coalesce(v_next.raw_payload->>'source','') = '5etools_class_progression'
    and v_spell_metadata_ready
    and jsonb_array_length(v_unsupported) = 0;

  if not v_spell_metadata_ready then
    v_blocked_reason := 'Refresh the reviewed 2024 class metadata so prepared/known spell progression is available.';
  elsif jsonb_array_length(v_unsupported) > 0 then
    v_blocked_reason := 'This level has class-specific choices that are not modeled yet: ' ||
      (select string_agg(value,', ') from jsonb_array_elements_text(v_unsupported));
  elsif not v_metadata_ready then
    v_blocked_reason := 'Reviewed 2024 class metadata is required before this level can be applied.';
  end if;

  v_preview := jsonb_build_object(
    'classKey',v_class.class_key,
    'className',v_class.class_name,
    'source',v_class.source,
    'ruleset',v_class.ruleset,
    'fromLevel',v_progression.class_level,
    'toLevel',v_progression.class_level+1,
    'xp',v_progression.experience_points,
    'requiredXp',v_next.xp_threshold,
    'proficiencyBonus',v_next.proficiency_bonus,
    'cantripsKnown',v_next.cantrips_known,
    'spellsKnown',v_next.spells_known,
    'spellSlots',v_next.spell_slots,
    'highestSpellLevel',v_highest_spell_level,
    'newCantrips',v_new_cantrips,
    'newLeveledSpells',v_new_leveled,
    'features',v_next.features,
    'choices',v_required,
    'unsupportedChoices',v_unsupported,
    'metadataReady',v_metadata_ready,
    'blockedReason',v_blocked_reason
  );

  select * into v_session
  from public.character_level_up_sessions
  where character_id=p_character_id and status='open'
  for update;

  if v_session.id is null then
    insert into public.character_level_up_sessions(
      character_id,from_level,to_level,status,metadata_ready,
      required_choices,selections,preview,created_by
    ) values(
      p_character_id,v_progression.class_level,v_progression.class_level+1,
      'open',v_metadata_ready,v_required,'{}'::jsonb,v_preview,auth.uid()
    ) returning * into v_session;
    v_created := true;
  else
    update public.character_level_up_sessions
    set from_level=v_progression.class_level,
        to_level=v_progression.class_level+1,
        metadata_ready=v_metadata_ready,
        required_choices=v_required,
        preview=v_preview,
        updated_at=now()
    where id=v_session.id
    returning * into v_session;
  end if;

  if v_created then
    insert into public.character_level_events(
      character_id,event_type,from_level,to_level,xp_before,xp_after,details,created_by
    ) values(
      p_character_id,'level_up_review_started',v_progression.class_level,v_progression.class_level+1,
      v_progression.experience_points,v_progression.experience_points,
      jsonb_build_object('sessionId',v_session.id,'source',v_class.source,'metadataReady',v_metadata_ready),auth.uid()
    );
  end if;

  return jsonb_build_object(
    'session',to_jsonb(v_session),
    'preview',v_preview,
    'metadataReady',v_metadata_ready,
    'canComplete',v_metadata_ready,
    'message',case
      when v_metadata_ready then 'All required choices in this level are supported and can be applied transactionally.'
      else v_blocked_reason
    end
  );
end;
$$;

create or replace function public.complete_character_level_up_v1(
  p_character_id uuid,
  p_selections jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_selections jsonb := coalesce(p_selections,'{}'::jsonb);
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_current public.class_level_progression%rowtype;
  v_next public.class_level_progression%rowtype;
  v_session public.character_level_up_sessions%rowtype;
  v_sheet jsonb;
  v_hp_method text;
  v_hit_roll integer;
  v_hp_gain integer;
  v_con_score integer := 10;
  v_con_mod integer := 0;
  v_current_hp integer := 0;
  v_current_max_hp integer := 0;
  v_subclass text;
  v_requires_subclass boolean;
  v_requires_advancement boolean;
  v_advancement_type text;
  v_ability_increases jsonb;
  v_ability_key text;
  v_increment_json jsonb;
  v_increment integer;
  v_total_increase integer := 0;
  v_score integer;
  v_feat_name text;
  v_feats jsonb;
  v_new_cantrips integer := 0;
  v_new_leveled integer := 0;
  v_highest_spell_level integer := 0;
  v_spell_choices jsonb;
  v_choice jsonb;
  v_spell_id uuid;
  v_spell public.spells_catalog%rowtype;
  v_seen uuid[] := '{}'::uuid[];
  v_selected_cantrips integer := 0;
  v_selected_leveled integer := 0;
  v_prepared boolean;
  v_pending_next boolean;
  v_unsupported jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to level this character.' using errcode='42501';
  end if;
  if jsonb_typeof(v_selections) <> 'object' then
    raise exception 'Level-up selections must be a JSON object.';
  end if;

  select * into v_progression
  from public.character_progression
  where character_id=p_character_id
  for update;
  if v_progression.character_id is null then
    raise exception 'Character progression has not been initialized.' using errcode='P0002';
  end if;

  select * into v_session
  from public.character_level_up_sessions
  where character_id=p_character_id and status='open'
  for update;
  if v_session.id is null then raise exception 'Open a level-up review first.' using errcode='P0002'; end if;
  if v_session.from_level <> v_progression.class_level or v_session.to_level <> v_progression.class_level+1 then
    raise exception 'This level-up review is stale. Refresh it before applying.';
  end if;
  if not v_session.metadata_ready then
    raise exception '%',coalesce(v_session.preview->>'blockedReason','This level cannot be applied yet.');
  end if;

  select * into v_class from public.class_catalog where id=v_progression.class_id;
  select * into v_current from public.class_level_progression where class_id=v_progression.class_id and class_level=v_progression.class_level;
  select * into v_next from public.class_level_progression where class_id=v_progression.class_id and class_level=v_progression.class_level+1;
  if v_class.source <> 'XPHB' then raise exception 'Only 2024/XPHB progression can be applied.'; end if;
  if v_progression.experience_points < v_next.xp_threshold then raise exception 'The required XP threshold has not been reached.'; end if;

  v_unsupported := private.unsupported_level_choice_features_v1(v_next.features);
  if jsonb_array_length(v_unsupported) > 0 then
    raise exception 'This level still has unsupported class-specific choices.';
  end if;

  select sheet into v_sheet from public.character_sheets where character_id=p_character_id for update;
  v_sheet := coalesce(v_sheet,'{}'::jsonb);

  v_hp_method := lower(btrim(coalesce(v_selections->>'hp_method','')));
  if v_hp_method not in ('fixed','roll') then raise exception 'Choose fixed or roll for the hit point increase.'; end if;
  begin
    v_con_score := coalesce(nullif(v_sheet->'abilities'->'con'->>'score','')::integer,nullif(v_sheet->'abilities'->>'con','')::integer,10);
  exception when others then
    v_con_score := 10;
  end;
  v_con_mod := floor((v_con_score-10)/2.0)::integer;
  if v_hp_method='roll' then
    v_hit_roll := 1+floor(random()*greatest(1,coalesce(v_class.hit_die,8)))::integer;
  else
    v_hit_roll := floor(coalesce(v_class.hit_die,8)/2.0)::integer+1;
  end if;
  v_hp_gain := greatest(1,v_hit_roll+v_con_mod);
  begin
    v_current_max_hp := coalesce(nullif(v_sheet->>'maxHp','')::integer,nullif(v_sheet->>'hp','')::integer,0);
    v_current_hp := coalesce(nullif(v_sheet->>'hp','')::integer,v_current_max_hp,0);
  exception when others then
    v_current_max_hp := 0;
    v_current_hp := 0;
  end;

  v_requires_subclass := v_next.class_level=3 and nullif(btrim(coalesce(v_progression.subclass_name,'')),'') is null;
  v_subclass := nullif(btrim(coalesce(v_selections->>'subclass_name',v_progression.subclass_name,'')),'');
  if v_requires_subclass and v_subclass is null then raise exception 'Choose a subclass.'; end if;
  if v_subclass is not null and char_length(v_subclass)>100 then raise exception 'Subclass names must be 100 characters or fewer.'; end if;

  v_requires_advancement := private.level_has_feature_v1(v_next.features,'Ability Score Improvement');
  if v_requires_advancement then
    v_advancement_type := lower(btrim(coalesce(v_selections->>'advancement_type','')));
    if v_advancement_type='asi' then
      v_ability_increases := coalesce(v_selections->'ability_increases','{}'::jsonb);
      if jsonb_typeof(v_ability_increases)<>'object' then raise exception 'Ability increases must be an object.'; end if;
      for v_ability_key,v_increment_json in select key,value from jsonb_each(v_ability_increases) loop
        if v_ability_key not in ('str','dex','con','int','wis','cha') then raise exception 'Invalid ability increase: %',v_ability_key; end if;
        begin v_increment := (v_increment_json #>> '{}')::integer; exception when others then raise exception 'Ability increases must be whole numbers.'; end;
        if v_increment not in (1,2) then raise exception 'Each ability increase must be 1 or 2.'; end if;
        v_total_increase := v_total_increase+v_increment;
        begin
          v_score := coalesce(nullif(v_sheet->'abilities'->v_ability_key->>'score','')::integer,nullif(v_sheet->'abilities'->>v_ability_key,'')::integer,10);
        exception when others then
          v_score := 10;
        end;
        if v_score+v_increment>20 then raise exception '% cannot be increased above 20.',upper(v_ability_key); end if;
        if jsonb_typeof(v_sheet->'abilities')<>'object' then v_sheet:=jsonb_set(v_sheet,'{abilities}','{}'::jsonb,true); end if;
        if jsonb_typeof(v_sheet->'abilities'->v_ability_key)<>'object' then
          v_sheet:=jsonb_set(v_sheet,array['abilities',v_ability_key],jsonb_build_object('score',v_score),true);
        end if;
        v_sheet:=jsonb_set(v_sheet,array['abilities',v_ability_key,'score'],to_jsonb(v_score+v_increment),true);
      end loop;
      if v_total_increase<>2 then raise exception 'Ability Score Improvement must grant exactly two total points.'; end if;
    elsif v_advancement_type='feat' then
      v_feat_name := nullif(btrim(v_selections->>'feat_name'),'');
      if v_feat_name is null then raise exception 'Choose a feat.'; end if;
      if not exists (
        select 1 from unnest(array[
          'Ability Score Improvement','Actor','Athlete','Charger','Chef','Crossbow Expert','Crusher',
          'Defensive Duelist','Dual Wielder','Durable','Elemental Adept','Fey-Touched','Grappler',
          'Great Weapon Master','Heavily Armored','Heavy Armor Master','Inspiring Leader','Keen Mind',
          'Lightly Armored','Mage Slayer','Martial Weapon Training','Medium Armor Master','Moderately Armored',
          'Mounted Combatant','Observant','Piercer','Poisoner','Polearm Master','Resilient','Ritual Caster',
          'Sentinel','Shadow-Touched','Sharpshooter','Shield Master','Skill Expert','Skulker','Slasher',
          'Speedy','Spell Sniper','Telekinetic','Telepathic','War Caster','Weapon Master'
        ]::text[]) allowed(name)
        where lower(allowed.name)=lower(v_feat_name)
      ) then raise exception 'That feat is not in the current 2024 general-feat list.'; end if;
      v_feats := coalesce(v_sheet->'feats','[]'::jsonb);
      if jsonb_typeof(v_feats)<>'array' then v_feats:='[]'::jsonb; end if;
      if not exists(select 1 from jsonb_array_elements_text(v_feats) f where lower(f)=lower(v_feat_name)) then
        v_feats:=v_feats||to_jsonb(v_feat_name);
      end if;
      v_sheet:=jsonb_set(v_sheet,'{feats}',v_feats,true);
    else
      raise exception 'Choose Ability Score Improvement or a feat.';
    end if;
  end if;

  v_new_cantrips := greatest(0,coalesce(v_next.cantrips_known,0)-coalesce(v_current.cantrips_known,0));
  if v_class.class_key='wizard' then
    v_new_leveled:=2;
  elsif v_class.spellcasting_ability is not null then
    if v_current.spells_known is null or v_next.spells_known is null then
      raise exception 'Prepared/known spell progression metadata is unavailable.';
    end if;
    v_new_leveled:=greatest(0,v_next.spells_known-v_current.spells_known);
  end if;
  v_highest_spell_level:=private.highest_spell_level_from_slots_v1(v_next.spell_slots);
  v_spell_choices:=coalesce(v_selections->'spell_choices','[]'::jsonb);
  if jsonb_typeof(v_spell_choices)<>'array' then raise exception 'Spell choices must be an array.'; end if;

  for v_choice in select value from jsonb_array_elements(v_spell_choices) loop
    begin v_spell_id:=(v_choice->>'spell_id')::uuid; exception when others then raise exception 'Every spell choice needs a valid spell_id.'; end;
    if v_spell_id=any(v_seen) then raise exception 'Duplicate spell choices are not allowed.'; end if;
    v_seen:=array_append(v_seen,v_spell_id);
    select * into v_spell from public.spells_catalog where id=v_spell_id;
    if v_spell.id is null then raise exception 'A selected spell was not found.'; end if;
    if v_spell.source<>'XPHB' then raise exception '% must use its 2024/XPHB version.',v_spell.name; end if;
    if not exists(select 1 from unnest(coalesce(v_spell.classes,'{}'::text[])) c where lower(c)=lower(v_class.class_name)) then
      raise exception '% is not on the % spell list.',v_spell.name,v_class.class_name;
    end if;
    if exists(select 1 from public.character_spells where character_id=p_character_id and spell_id=v_spell_id) then
      raise exception '% is already in this character spellbook.',v_spell.name;
    end if;
    if v_spell.level=0 then
      v_selected_cantrips:=v_selected_cantrips+1;
    elsif v_spell.level between 1 and v_highest_spell_level then
      v_selected_leveled:=v_selected_leveled+1;
    else
      raise exception '% is not unlocked at level %.',v_spell.name,v_next.class_level;
    end if;
    begin v_prepared:=coalesce((v_choice->>'prepared')::boolean,true); exception when others then v_prepared:=true; end;
    insert into public.character_spells(
      character_id,spell_id,source_type,source_label,prepared,always_available,casting_stat,raw_payload
    ) values(
      p_character_id,v_spell_id,'class',v_class.class_name,
      case when v_spell.level=0 then true else v_prepared end,
      v_spell.level=0,
      v_class.spellcasting_ability,
      jsonb_build_object('grantedAtLevel',v_next.class_level,'rulesetSource','XPHB','creator','level_up_v1')
    );
  end loop;
  if v_selected_cantrips<>v_new_cantrips then raise exception 'Choose exactly % new cantrip(s).',v_new_cantrips; end if;
  if v_selected_leveled<>v_new_leveled then raise exception 'Choose exactly % new leveled spell(s).',v_new_leveled; end if;

  v_sheet:=v_sheet||jsonb_build_object(
    'level',v_next.class_level,
    'proficiencyBonus',v_next.proficiency_bonus,
    'hitDice',v_next.class_level::text||'d'||coalesce(v_class.hit_die,8)::text,
    'hp',v_current_hp+v_hp_gain,
    'maxHp',v_current_max_hp+v_hp_gain,
    'rulesetSource','XPHB',
    'ruleset','2024'
  );
  if v_subclass is not null then v_sheet:=v_sheet||jsonb_build_object('subclass',v_subclass); end if;
  v_sheet:=v_sheet||jsonb_build_object(
    'meta',coalesce(v_sheet->'meta','{}'::jsonb)||jsonb_strip_nulls(jsonb_build_object(
      'classKey',v_class.class_key,'className',v_class.class_name,'level',v_next.class_level,
      'subclass',v_subclass,'rulesetSource','XPHB','ruleset','2024'
    ))
  );

  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now()
  where p.user_id in (select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);

  v_pending_next:=v_next.class_level<20 and v_progression.experience_points>=public.xp_threshold_for_level_v1(v_next.class_level+1);
  update public.character_progression
  set class_level=v_next.class_level,
      subclass_name=coalesce(v_subclass,subclass_name),
      subclass_source=case when v_subclass is not null then 'XPHB' else subclass_source end,
      pending_level_up=v_pending_next,
      level_choices=coalesce(level_choices,'{}'::jsonb)||jsonb_build_object(v_next.class_level::text,v_selections),
      updated_at=now()
  where character_id=p_character_id;

  update public.character_level_up_sessions
  set status='completed',selections=v_selections,completed_at=now(),updated_at=now()
  where id=v_session.id;

  insert into public.character_level_events(
    character_id,event_type,from_level,to_level,xp_before,xp_after,details,created_by
  ) values(
    p_character_id,'level_up_completed',v_progression.class_level,v_next.class_level,
    v_progression.experience_points,v_progression.experience_points,
    jsonb_build_object(
      'sessionId',v_session.id,'hpMethod',v_hp_method,'hitDieResult',v_hit_roll,'hpGain',v_hp_gain,
      'subclass',v_subclass,'advancementType',v_advancement_type,
      'newCantrips',v_new_cantrips,'newLeveledSpells',v_new_leveled
    ),auth.uid()
  );

  return jsonb_build_object(
    'progression',public.get_character_progression_v1(p_character_id),
    'levelUp',jsonb_build_object(
      'fromLevel',v_progression.class_level,'toLevel',v_next.class_level,
      'hpMethod',v_hp_method,'hitDieResult',v_hit_roll,'hpGain',v_hp_gain
    )
  );
end;
$$;

revoke all on function public.complete_character_level_up_v1(uuid,jsonb) from public,anon;
grant execute on function public.complete_character_level_up_v1(uuid,jsonb) to authenticated;
