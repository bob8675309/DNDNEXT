-- Exact original function bodies, fetched READ-ONLY from live DnDWeb PG17.4 on 2026-11-05.
-- Never apply outside disposable Supabase GoTrue/PostgREST scratch CI. No helper substitutions here.
-- md5(pg_get_functiondef) private.can_manage_character_progression_v1(p_character_id uuid) = ac70e4ec033d86c4e0a254d50d429a45
CREATE OR REPLACE FUNCTION private.can_manage_character_progression_v1(p_character_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
  select private.current_user_is_admin()
    or exists (
      select 1 from public.character_permissions cp
      where cp.character_id = p_character_id
        and cp.user_id = auth.uid()
        and cp.can_edit
    );
$function$;

-- md5(pg_get_functiondef) private.complete_character_level_up_base_v3(p_character_id uuid, p_selections jsonb) = e33639d549ef557976a3970ea51f5238
CREATE OR REPLACE FUNCTION private.complete_character_level_up_base_v3(p_character_id uuid, p_selections jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_selections jsonb := coalesce(p_selections, '{}'::jsonb);
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
  v_requires_subclass boolean := false;
  v_subclass_name text;
  v_subclass_source text;
  v_subclass record;
  v_new_cantrips integer := 0;
  v_new_leveled integer := 0;
  v_highest_spell_level integer := 0;
  v_spell_choices jsonb;
  v_choice jsonb;
  v_spell_id uuid;
  v_spell public.spells_catalog%rowtype;
  v_spell_access text;
  v_seen uuid[] := '{}'::uuid[];
  v_selected_cantrips integer := 0;
  v_selected_leveled integer := 0;
  v_prepared boolean;
  v_pending_next boolean;
  v_class_spells jsonb := '[]'::jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to level this character.' using errcode = '42501';
  end if;
  if jsonb_typeof(v_selections) <> 'object' then
    raise exception 'Level-up selections must be a JSON object.';
  end if;

  select * into v_progression
  from public.character_progression
  where character_id = p_character_id
  for update;
  if not found then
    raise exception 'Character progression has not been initialized.' using errcode = 'P0002';
  end if;
  if v_progression.class_level >= 20 then raise exception 'This character is already level 20.'; end if;

  select * into v_session
  from public.character_level_up_sessions
  where character_id = p_character_id and status = 'open'
  for update;
  if not found then raise exception 'Open a level-up review first.' using errcode = 'P0002'; end if;
  if v_session.from_level <> v_progression.class_level
     or v_session.to_level <> v_progression.class_level + 1 then
    raise exception 'This level-up review is stale. Refresh it before applying.';
  end if;
  if not v_session.metadata_ready then
    raise exception '%', coalesce(v_session.preview ->> 'blockedReason', 'This level cannot be applied yet.');
  end if;

  select * into v_class from public.class_catalog where id = v_progression.class_id;
  select * into v_current from public.class_level_progression
  where class_id = v_progression.class_id and class_level = v_progression.class_level;
  select * into v_next from public.class_level_progression
  where class_id = v_progression.class_id and class_level = v_progression.class_level + 1;
  if not found then raise exception 'Next-level progression metadata is unavailable.'; end if;
  if not public.is_preferred_class_version_v1(v_class.id) then
    raise exception 'Only the preferred class version can be applied.';
  end if;
  if v_progression.experience_points < v_next.xp_threshold then
    raise exception 'The required XP threshold has not been reached.';
  end if;

  select coalesce(sheet, '{}'::jsonb) into v_sheet
  from public.character_sheets
  where character_id = p_character_id
  for update;

  v_hp_method := lower(btrim(coalesce(v_selections ->> 'hp_method', '')));
  if v_hp_method not in ('fixed', 'roll') then
    raise exception 'Choose fixed or roll for the hit point increase.';
  end if;
  begin
    v_con_score := coalesce(
      nullif(v_sheet #>> '{abilities,con,score}', '')::integer,
      nullif(v_sheet #>> '{abilities,con}', '')::integer,
      10
    );
  exception when others then
    v_con_score := 10;
  end;
  v_con_mod := floor((v_con_score - 10) / 2.0)::integer;
  if v_hp_method = 'roll' then
    v_hit_roll := 1 + floor(random() * greatest(1, coalesce(v_class.hit_die, 8)))::integer;
  else
    v_hit_roll := floor(coalesce(v_class.hit_die, 8) / 2.0)::integer + 1;
  end if;
  v_hp_gain := greatest(1, v_hit_roll + v_con_mod);
  begin
    v_current_max_hp := coalesce(nullif(v_sheet ->> 'maxHp', '')::integer, nullif(v_sheet ->> 'hp', '')::integer, 0);
    v_current_hp := coalesce(nullif(v_sheet ->> 'hp', '')::integer, v_current_max_hp, 0);
  exception when others then
    v_current_max_hp := 0;
    v_current_hp := 0;
  end;

  v_requires_subclass := v_next.class_level = 3
    and nullif(btrim(coalesce(v_progression.subclass_name, '')), '') is null;
  v_subclass_name := nullif(btrim(coalesce(v_selections ->> 'subclass_name', v_progression.subclass_name, '')), '');
  v_subclass_source := nullif(btrim(coalesce(v_selections ->> 'subclass_source', v_progression.subclass_source, '')), '');
  if v_requires_subclass and (v_subclass_name is null or v_subclass_source is null) then
    raise exception 'Choose a source-backed subclass.';
  end if;
  if v_subclass_name is not null then
    select * into v_subclass
    from private.resolve_subclass_choice_v1(v_class.class_key, v_class.source, v_subclass_name, v_subclass_source);
    if v_subclass.subclass_name is null then
      raise exception 'Subclass % from source % is not available for %.', v_subclass_name, v_subclass_source, v_class.class_name;
    end if;
    v_subclass_name := v_subclass.subclass_name;
    v_subclass_source := v_subclass.subclass_source;
  end if;

  v_new_cantrips := greatest(0, coalesce(v_next.cantrips_known, 0) - coalesce(v_current.cantrips_known, 0));
  if lower(v_class.class_key) = 'wizard' then
    v_new_leveled := 2;
  elsif v_class.spellcasting_ability is not null then
    if v_current.spells_known is null or v_next.spells_known is null then
      raise exception 'Prepared/known spell progression metadata is unavailable.';
    end if;
    v_new_leveled := greatest(0, v_next.spells_known - v_current.spells_known);
  end if;
  v_highest_spell_level := private.highest_spell_level_from_slots_v1(v_next.spell_slots);
  v_spell_choices := coalesce(v_selections -> 'spell_choices', '[]'::jsonb);
  if jsonb_typeof(v_spell_choices) <> 'array' then raise exception 'Spell choices must be an array.'; end if;

  for v_choice in select value from jsonb_array_elements(v_spell_choices)
  loop
    begin
      v_spell_id := (v_choice ->> 'spell_id')::uuid;
    exception when others then
      raise exception 'Every spell choice needs a valid spell_id.';
    end;
    if v_spell_id = any(v_seen) then raise exception 'Duplicate spell choices are not allowed.'; end if;
    v_seen := array_append(v_seen, v_spell_id);

    select * into v_spell from public.spells_catalog where id = v_spell_id;
    if not found or not public.is_preferred_spell_version_v1(v_spell.id) then
      raise exception 'A selected spell is unavailable or not the preferred version.';
    end if;
    v_spell_access := private.level_up_spell_access_v1(p_character_id, v_next.class_level, v_spell.id);
    if v_spell_access is null then
      raise exception '% is not on a spell list available to this character at level %.', v_spell.name, v_next.class_level;
    end if;
    if exists (
      select 1 from public.character_spells cs
      where cs.character_id = p_character_id
        and cs.spell_id = v_spell.id
        and cs.source_type = 'class'
    ) then
      raise exception '% is already in this character class spell list.', v_spell.name;
    end if;

    if v_spell.level = 0 then
      v_selected_cantrips := v_selected_cantrips + 1;
    elsif v_spell.level between 1 and v_highest_spell_level then
      v_selected_leveled := v_selected_leveled + 1;
    else
      raise exception '% is not unlocked at level %.', v_spell.name, v_next.class_level;
    end if;
    begin
      v_prepared := coalesce((v_choice ->> 'prepared')::boolean, true);
    exception when others then
      v_prepared := true;
    end;

    insert into public.character_spells(
      character_id, spell_id, source_type, source_key, source_label,
      known, prepared, always_available, casting_stat, raw_payload
    ) values (
      p_character_id, v_spell.id, 'class', v_class.class_key, v_class.class_name,
      true, case when v_spell.level = 0 then true else v_prepared end,
      v_spell.level = 0, v_class.spellcasting_ability,
      jsonb_build_object(
        'grantedAtLevel', v_next.class_level,
        'rulesetSource', v_class.source,
        'creator', 'level_up_v3',
        'accessType', v_spell_access
      )
    );
  end loop;

  if v_selected_cantrips <> v_new_cantrips then
    raise exception 'Choose exactly % new cantrip(s).', v_new_cantrips;
  end if;
  if v_selected_leveled <> v_new_leveled then
    raise exception 'Choose exactly % new leveled spell(s).', v_new_leveled;
  end if;

  select coalesce(jsonb_agg(s.name order by s.level, s.name), '[]'::jsonb)
  into v_class_spells
  from public.character_spells cs
  join public.spells_catalog s on s.id = cs.spell_id
  where cs.character_id = p_character_id and cs.source_type = 'class';

  v_sheet := v_sheet || jsonb_build_object(
    'level', v_next.class_level,
    'proficiencyBonus', v_next.proficiency_bonus,
    'hitDice', v_next.class_level::text || 'd' || coalesce(v_class.hit_die, 8)::text,
    'hp', v_current_hp + v_hp_gain,
    'maxHp', v_current_max_hp + v_hp_gain,
    'rulesetSource', v_class.source,
    'ruleset', v_class.ruleset,
    'spellSlots', v_next.spell_slots,
    'spells', coalesce(v_class_spells, '[]'::jsonb)
  );
  if v_subclass_name is not null then
    v_sheet := v_sheet || jsonb_build_object(
      'subclass', v_subclass_name,
      'subclassName', v_subclass_name,
      'subclassSource', v_subclass_source
    );
  end if;
  v_sheet := v_sheet || jsonb_build_object(
    'meta', coalesce(v_sheet -> 'meta', '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'classKey', v_class.class_key,
      'className', v_class.class_name,
      'level', v_next.class_level,
      'subclass', v_subclass_name,
      'subclassName', v_subclass_name,
      'subclassSource', v_subclass_source,
      'rulesetSource', v_class.source,
      'ruleset', v_class.ruleset
    ))
  );

  update public.character_sheets set sheet = v_sheet, updated_at = now()
  where character_id = p_character_id;
  update public.players p set sheet = v_sheet, updated_at = now()
  where p.user_id in (
    select cp.user_id from public.character_permissions cp where cp.character_id = p_character_id
  );

  v_pending_next := v_next.class_level < 20
    and v_progression.experience_points >= public.xp_threshold_for_level_v1(v_next.class_level + 1);
  update public.character_progression
  set class_level = v_next.class_level,
      subclass_name = coalesce(v_subclass_name, subclass_name),
      subclass_source = coalesce(v_subclass_source, subclass_source),
      pending_level_up = v_pending_next,
      level_choices = coalesce(level_choices, '{}'::jsonb) || jsonb_build_object(v_next.class_level::text, v_selections),
      updated_at = now()
  where character_id = p_character_id;

  update public.character_level_up_sessions
  set status = 'completed', selections = v_selections, completed_at = now(), updated_at = now()
  where id = v_session.id;

  insert into public.character_level_events(
    character_id, event_type, from_level, to_level, xp_before, xp_after, details, created_by
  ) values (
    p_character_id, 'level_up_completed', v_progression.class_level, v_next.class_level,
    v_progression.experience_points, v_progression.experience_points,
    jsonb_build_object(
      'sessionId', v_session.id,
      'hpMethod', v_hp_method,
      'hitDieResult', v_hit_roll,
      'hpGain', v_hp_gain,
      'subclass', v_subclass_name,
      'subclassSource', v_subclass_source,
      'newCantrips', v_new_cantrips,
      'newLeveledSpells', v_new_leveled
    ), auth.uid()
  );

  return jsonb_build_object(
    'progression', public.get_character_progression_v1(p_character_id),
    'levelUp', jsonb_build_object(
      'fromLevel', v_progression.class_level,
      'toLevel', v_next.class_level,
      'hpMethod', v_hp_method,
      'hitDieResult', v_hit_roll,
      'hpGain', v_hp_gain
    )
  );
end;
$function$;

-- md5(pg_get_functiondef) private.sync_character_progression_from_sheet_v1() = bb1a3a2d1600ce33cd4fcadac5e0f3a9
CREATE OR REPLACE FUNCTION private.sync_character_progression_from_sheet_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_key text;
  v_source text;
  v_level integer;
  v_class_id uuid;
  v_xp bigint;
begin
  if coalesce(new.sheet->'meta'->>'creator','') = 'player_character_creator_v1' then
    return new;
  end if;

  v_key := lower(btrim(coalesce(new.sheet->>'classKey',new.sheet->'meta'->>'classKey','')));
  if v_key = '' or v_key = 'civilian' then return new; end if;
  v_source := upper(btrim(coalesce(new.sheet->>'rulesetSource',new.sheet->'meta'->>'rulesetSource','XPHB')));
  v_level := greatest(1,least(20,coalesce(nullif(new.sheet->>'level','')::integer,nullif(new.sheet->'meta'->>'level','')::integer,1)));

  select id into v_class_id from public.class_catalog where class_key=v_key and source=v_source limit 1;
  if v_class_id is null then
    select id into v_class_id from public.class_catalog
    where class_key=v_key
    order by case source when 'XPHB' then 0 when 'PHB' then 1 else 2 end
    limit 1;
  end if;
  if v_class_id is null then return new; end if;

  select experience_points into v_xp from public.character_progression where character_id=new.character_id;
  v_xp := coalesce(v_xp,public.xp_threshold_for_level_v1(v_level));
  insert into public.character_progression(character_id,class_id,class_level,experience_points,pending_level_up,updated_at)
  values(new.character_id,v_class_id,v_level,v_xp,v_level<20 and v_xp>=public.xp_threshold_for_level_v1(v_level+1),now())
  on conflict(character_id) do update set
    class_id=excluded.class_id,
    class_level=excluded.class_level,
    pending_level_up=excluded.pending_level_up,
    updated_at=now();
  return new;
exception when invalid_text_representation then
  return new;
end;
$function$;

-- md5(pg_get_functiondef) private.sync_player_forge_class_spell_summary_v1(p_character_id uuid) = 5b1b275a268a57591a2e35a05ce7480d
CREATE OR REPLACE FUNCTION private.sync_player_forge_class_spell_summary_v1(p_character_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
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

-- md5(pg_get_functiondef) public.complete_character_level_up_v3(p_character_id uuid, p_selections jsonb) = 4467e166234c67fc12dd73da0e46b379
CREATE OR REPLACE FUNCTION public.complete_character_level_up_v3(p_character_id uuid, p_selections jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_input jsonb := coalesce(p_selections, '{}'::jsonb);
  v_progression public.character_progression%rowtype;
  v_next public.class_level_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_instance jsonb := coalesce(v_input -> 'advancement_instance', '{}'::jsonb);
  v_requires_asi boolean := false;
  v_requires_epic boolean := false;
  v_option_id uuid;
  v_option public.character_option_catalog%rowtype;
  v_base jsonb;
  v_result jsonb;
  v_sanitized jsonb;
  v_level_choice jsonb;
  v_session_id uuid;
  v_simple_groups jsonb := '[]'::jsonb;
  v_additional_groups jsonb := '[]'::jsonb;
  v_simple_input jsonb := '{}'::jsonb;
  v_additional_input jsonb := '{}'::jsonb;
  v_all_input jsonb := coalesce(v_input -> 'class_choice_selections', '{}'::jsonb);
  v_key text;
  v_class_choice_summary jsonb := '[]'::jsonb;
  v_part jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to level this character.' using errcode = '42501';
  end if;
  if jsonb_typeof(v_input) <> 'object' or jsonb_typeof(v_all_input) <> 'object' then
    raise exception 'Level-up selections must be JSON objects.';
  end if;

  select * into v_progression from public.character_progression
  where character_id = p_character_id for update;
  if not found then raise exception 'Character progression has not been initialized.' using errcode = 'P0002'; end if;
  if v_progression.class_level >= 20 then raise exception 'This character is already level 20.'; end if;
  select * into v_class from public.class_catalog where id = v_progression.class_id;
  select * into v_next from public.class_level_progression
  where class_id = v_progression.class_id and class_level = v_progression.class_level + 1;
  if not found then raise exception 'Next-level progression metadata is unavailable.'; end if;

  if jsonb_array_length(private.level_up_persistent_choice_gaps_v1(
    v_class.class_key, v_class.source, v_progression.class_level, v_next.class_level
  )) > 0 then
    raise exception 'This level still contains a persistent class choice that is not connected to progression v3.';
  end if;

  v_simple_groups := private.simple_level_class_choice_groups_v1(p_character_id, v_next.class_level);
  v_additional_groups := private.additional_level_class_choice_groups_v1(p_character_id, v_next.class_level);
  for v_key in select key from jsonb_each(v_all_input)
  loop
    if exists(select 1 from jsonb_array_elements(v_simple_groups) g where g ->> 'id' = v_key) then
      v_simple_input := jsonb_set(v_simple_input, array[v_key], v_all_input -> v_key, true);
    elsif exists(select 1 from jsonb_array_elements(v_additional_groups) g where g ->> 'id' = v_key) then
      v_additional_input := jsonb_set(v_additional_input, array[v_key], v_all_input -> v_key, true);
    else
      raise exception 'Class choice payload contains an unexpected group: %.', v_key;
    end if;
  end loop;
  if jsonb_array_length(v_simple_groups) > 0 then
    v_part := private.apply_simple_level_class_choices_v1(p_character_id, v_next.class_level, v_simple_input);
    v_class_choice_summary := v_class_choice_summary || coalesce(v_part, '[]'::jsonb);
  end if;
  if jsonb_array_length(v_additional_groups) > 0 then
    v_part := private.apply_additional_level_class_choices_v1(p_character_id, v_next.class_level, v_additional_input);
    v_class_choice_summary := v_class_choice_summary || coalesce(v_part, '[]'::jsonb);
  end if;
  if jsonb_array_length(v_simple_groups) = 0
     and jsonb_array_length(v_additional_groups) = 0
     and exists(select 1 from jsonb_object_keys(v_all_input)) then
    raise exception 'This level does not accept class-choice selections.';
  end if;

  v_requires_asi := private.level_has_feature_v1(v_next.features, 'Ability Score Improvement');
  v_requires_epic := private.level_has_feature_v1(v_next.features, 'Epic Boon');
  if v_requires_asi or v_requires_epic then
    v_option_id := private.level_up_advancement_option_id_v1(
      p_character_id, v_next.class_level, v_instance, v_requires_epic
    );
    select * into v_option from public.character_option_catalog where id = v_option_id;
  elsif jsonb_typeof(v_input -> 'advancement_instance') is not null then
    raise exception 'This level does not grant a feat or Epic Boon advancement.';
  end if;

  v_base := jsonb_strip_nulls(jsonb_build_object(
    'hp_method', v_input ->> 'hp_method',
    'subclass_name', nullif(v_input ->> 'subclass_name', ''),
    'subclass_source', nullif(v_input ->> 'subclass_source', ''),
    'spell_choices', coalesce(v_input -> 'spell_choices', '[]'::jsonb)
  ));
  v_result := private.complete_character_level_up_base_v3(p_character_id, v_base);
  perform private.sync_player_forge_class_spell_summary_v1(p_character_id);

  if v_option_id is not null then
    v_sanitized := private.apply_character_level_advancement_v1(
      p_character_id, v_next.class_level, v_option_id, v_instance
    );
  end if;

  select coalesce(level_choices -> (v_next.class_level::text), '{}'::jsonb)
  into v_level_choice
  from public.character_progression
  where character_id = p_character_id;
  if v_sanitized is not null then
    v_level_choice := v_level_choice || jsonb_build_object('advancement_instance', v_sanitized);
  end if;
  if jsonb_array_length(v_class_choice_summary) > 0 then
    v_level_choice := v_level_choice || jsonb_build_object('class_choice_delta', v_class_choice_summary);
  end if;
  update public.character_progression
  set level_choices = jsonb_set(
        coalesce(level_choices, '{}'::jsonb),
        array[v_next.class_level::text], v_level_choice, true
      ),
      updated_at = now()
  where character_id = p_character_id;

  select id into v_session_id
  from public.character_level_up_sessions
  where character_id = p_character_id
    and to_level = v_next.class_level
    and status = 'completed'
  order by completed_at desc
  limit 1;
  if v_session_id is not null then
    update public.character_level_up_sessions
    set selections = coalesce(selections, '{}'::jsonb)
      || case when v_sanitized is not null then jsonb_build_object('advancement_instance', v_sanitized) else '{}'::jsonb end
      || case when jsonb_array_length(v_class_choice_summary) > 0 then jsonb_build_object('class_choice_delta', v_class_choice_summary) else '{}'::jsonb end,
      updated_at = now()
    where id = v_session_id;
  end if;

  update public.character_level_events
  set details = coalesce(details, '{}'::jsonb)
    || case when v_sanitized is not null then jsonb_build_object(
         'advancementOptionId', v_option.id,
         'advancementName', v_option.name,
         'advancementSource', v_option.source,
         'advancementInstance', v_sanitized
       ) else '{}'::jsonb end
    || case when jsonb_array_length(v_class_choice_summary) > 0 then jsonb_build_object(
         'classChoiceDelta', v_class_choice_summary
       ) else '{}'::jsonb end
  where id = (
    select id from public.character_level_events
    where character_id = p_character_id
      and event_type = 'level_up_completed'
      and to_level = v_next.class_level
    order by created_at desc
    limit 1
  );

  return coalesce(v_result, '{}'::jsonb) || jsonb_build_object(
    'progression', public.get_character_progression_v1(p_character_id),
    'advancement', v_sanitized,
    'classChoices', v_class_choice_summary
  );
end;
$function$;

-- md5(pg_get_functiondef) public.complete_character_level_up_v4(p_character_id uuid, p_selections jsonb) = f8338ef170c6e27b972e777eeae406b8
CREATE OR REPLACE FUNCTION public.complete_character_level_up_v4(p_character_id uuid, p_selections jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
 v_input jsonb:=coalesce(p_selections,'{}'::jsonb); v_progression public.character_progression%rowtype; v_to integer;
 v_all_class jsonb:=coalesce(v_input->'class_choice_selections','{}'::jsonb); v_invocation jsonb:='{}'::jsonb; v_subclass jsonb:='{}'::jsonb; v_other jsonb:='{}'::jsonb; v_key text;
 v_feat_instances jsonb:=coalesce(v_input->'class_option_feat_instances','[]'::jsonb); v_invocation_summary jsonb:='[]'::jsonb; v_subclass_summary jsonb:='[]'::jsonb; v_v3_input jsonb; v_result jsonb; v_tough_bonus integer:=0;
begin
 if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to level this character.' using errcode='42501'; end if;
 if jsonb_typeof(v_input)<>'object' or jsonb_typeof(v_all_class)<>'object' or jsonb_typeof(v_feat_instances)<>'array' then raise exception 'Level-up source selections have an invalid shape.'; end if;
 select * into v_progression from public.character_progression where character_id=p_character_id for update; if not found or v_progression.class_level>=20 then raise exception 'Character progression is unavailable for another level.'; end if; v_to:=v_progression.class_level+1;
 for v_key in select key from jsonb_each(v_all_class) loop if v_key like 'warlock-invocation-slot-%' then v_invocation:=jsonb_set(v_invocation,array[v_key],v_all_class->v_key,true); elsif v_key in ('bard-lore-magical-discoveries','sorcerer-draconic-affinity','fighter-champion-additional-fighting-style') then v_subclass:=jsonb_set(v_subclass,array[v_key],v_all_class->v_key,true); else v_other:=jsonb_set(v_other,array[v_key],v_all_class->v_key,true); end if; end loop;
 v_invocation_summary:=private.apply_level_up_warlock_invocations_v1(p_character_id,v_to,v_invocation,v_feat_instances); v_subclass_summary:=private.apply_level_up_subclass_choices_v1(p_character_id,v_to,v_subclass);
 v_v3_input:=(v_input-'class_option_feat_instances')||jsonb_build_object('class_choice_selections',v_other); perform set_config('dndnext.resolved_invocation_gap','on',true); v_result:=public.complete_character_level_up_v3(p_character_id,v_v3_input); v_tough_bonus:=private.apply_tough_progression_bonus_v1(p_character_id,v_to);
 return coalesce(v_result,'{}'::jsonb)||jsonb_build_object('invocations',v_invocation_summary,'subclassChoices',v_subclass_summary,'toughProgressionBonus',v_tough_bonus,'progression',public.get_character_progression_v1(p_character_id));
end; $function$;

-- md5(pg_get_functiondef) public.complete_character_level_up_v5(p_character_id uuid, p_selections jsonb) = 02d74b973a763c53c595be20e35e512f
CREATE OR REPLACE FUNCTION public.complete_character_level_up_v5(p_character_id uuid, p_selections jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
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
  v_artificer jsonb:='{}'::jsonb;
  v_forward_class jsonb:=v_all_class-'warlock-invocation-replacement'-'fighter-battle-master-maneuvers'-'wizard-savant-spellbook-addition'-'wizard-signature-spells';
  v_feat_instances jsonb:=coalesce(v_input->'class_option_feat_instances','[]'::jsonb);
  v_invocation_summary jsonb:='[]'::jsonb;
  v_battle_summary jsonb:='[]'::jsonb;
  v_wizard_summary jsonb:='[]'::jsonb;
  v_signature_summary jsonb:='[]'::jsonb;
  v_artificer_summary jsonb:=jsonb_build_object('added','[]'::jsonb,'replacements','[]'::jsonb);
  v_standard_summary jsonb:='[]'::jsonb;
  v_replacement_summary jsonb:='[]'::jsonb;
  v_result jsonb;
  v_forward_input jsonb;
  v_level_choice jsonb:='{}'::jsonb;
  v_session_id uuid;
  v_key text;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to level this character.' using errcode='42501'; end if;
  if jsonb_typeof(v_input)<>'object' or jsonb_typeof(v_replacements)<>'object' or jsonb_typeof(v_all_class)<>'object' or jsonb_typeof(v_feat_instances)<>'array' then raise exception 'Level-up source selections have an invalid shape.'; end if;
  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if not found or v_progression.class_level>=20 then raise exception 'Character progression is unavailable for another level.'; end if;
  v_to:=v_progression.class_level+1;

  for v_key in select key from jsonb_each(v_all_class) loop
    if v_key like 'artificer-plan-slot-%' or v_key='artificer-plan-replacement' then
      v_artificer:=jsonb_set(v_artificer,array[v_key],v_all_class->v_key,true);
      v_forward_class:=v_forward_class-v_key;
    end if;
  end loop;

  v_invocation_summary:=private.apply_level_up_warlock_invocation_replacement_v2(p_character_id,v_to,v_invocation_replacement,v_all_class,v_feat_instances);
  v_battle_summary:=private.apply_level_up_battle_master_maneuvers_v1(p_character_id,v_to,v_battle_master,v_input->>'subclass_name');
  v_wizard_summary:=private.apply_level_up_wizard_savant_v1(p_character_id,v_to,v_wizard_savant,v_input->>'subclass_name');
  v_artificer_summary:=private.apply_level_up_artificer_plans_v1(p_character_id,v_to,v_artificer);
  v_standard_summary:=private.apply_level_up_replacements_v1(p_character_id,v_to,v_replacements);
  v_replacement_summary:=coalesce(v_invocation_summary,'[]'::jsonb)||coalesce(v_battle_summary,'[]'::jsonb)||coalesce(v_standard_summary,'[]'::jsonb)||coalesce(v_artificer_summary->'replacements','[]'::jsonb);

  v_forward_input:=jsonb_set(v_input,'{class_choice_selections}',v_forward_class,true);
  v_result:=public.complete_character_level_up_v4(p_character_id,v_forward_input-'replacement_selections');
  v_signature_summary:=private.apply_level_up_wizard_signature_spells_v1(p_character_id,v_to,v_wizard_signature);
  perform private.sync_character_eldritch_invocations_v1(p_character_id);

  select coalesce(level_choices->v_to::text,'{}'::jsonb) into v_level_choice from public.character_progression where character_id=p_character_id;
  if jsonb_array_length(v_replacement_summary)>0 then v_level_choice:=v_level_choice||jsonb_build_object('replacements',v_replacement_summary); end if;
  if jsonb_array_length(v_wizard_summary)>0 then v_level_choice:=v_level_choice||jsonb_build_object('wizard_savant_delta',v_wizard_summary); end if;
  if jsonb_array_length(v_signature_summary)>0 then v_level_choice:=v_level_choice||jsonb_build_object('wizard_signature_delta',v_signature_summary); end if;
  if jsonb_array_length(coalesce(v_artificer_summary->'added','[]'::jsonb))>0 or jsonb_array_length(coalesce(v_artificer_summary->'replacements','[]'::jsonb))>0 then
    v_level_choice:=v_level_choice||jsonb_build_object('artificer_plan_delta',v_artificer_summary);
  end if;
  if jsonb_array_length(v_replacement_summary)>0 or jsonb_array_length(v_wizard_summary)>0 or jsonb_array_length(v_signature_summary)>0 or jsonb_array_length(coalesce(v_artificer_summary->'added','[]'::jsonb))>0 then
    update public.character_progression set level_choices=jsonb_set(coalesce(level_choices,'{}'::jsonb),array[v_to::text],v_level_choice,true),updated_at=now() where character_id=p_character_id;
    select id into v_session_id from public.character_level_up_sessions where character_id=p_character_id and to_level=v_to and status='completed' order by completed_at desc limit 1;
    if v_session_id is not null then
      update public.character_level_up_sessions set selections=coalesce(selections,'{}'::jsonb)
        ||case when jsonb_array_length(v_replacement_summary)>0 then jsonb_build_object('replacement_selections',v_replacements,'invocation_replacement_selection',v_invocation_replacement,'battle_master_maneuvers',v_battle_master,'replacements',v_replacement_summary) else '{}'::jsonb end
        ||case when jsonb_array_length(v_wizard_summary)>0 then jsonb_build_object('wizard_savant_selection',v_wizard_savant,'wizard_savant_delta',v_wizard_summary) else '{}'::jsonb end
        ||case when jsonb_array_length(v_signature_summary)>0 then jsonb_build_object('wizard_signature_selection',v_wizard_signature,'wizard_signature_delta',v_signature_summary) else '{}'::jsonb end
        ||case when jsonb_array_length(coalesce(v_artificer_summary->'added','[]'::jsonb))>0 or jsonb_array_length(coalesce(v_artificer_summary->'replacements','[]'::jsonb))>0 then jsonb_build_object('artificer_plan_selections',v_artificer,'artificer_plan_delta',v_artificer_summary) else '{}'::jsonb end,
        updated_at=now() where id=v_session_id;
    end if;
    update public.character_level_events set details=coalesce(details,'{}'::jsonb)
      ||case when jsonb_array_length(v_replacement_summary)>0 then jsonb_build_object('replacements',v_replacement_summary) else '{}'::jsonb end
      ||case when jsonb_array_length(v_wizard_summary)>0 then jsonb_build_object('wizardSavantDelta',v_wizard_summary) else '{}'::jsonb end
      ||case when jsonb_array_length(v_signature_summary)>0 then jsonb_build_object('wizardSignatureDelta',v_signature_summary) else '{}'::jsonb end
      ||case when jsonb_array_length(coalesce(v_artificer_summary->'added','[]'::jsonb))>0 or jsonb_array_length(coalesce(v_artificer_summary->'replacements','[]'::jsonb))>0 then jsonb_build_object('artificerPlanDelta',v_artificer_summary) else '{}'::jsonb end
    where id=(select id from public.character_level_events where character_id=p_character_id and event_type='level_up_completed' and to_level=v_to order by created_at desc limit 1);
  end if;

  return coalesce(v_result,'{}'::jsonb)||jsonb_build_object('replacements',v_replacement_summary,'wizardSavant',v_wizard_summary,'wizardSignature',v_signature_summary,'artificerPlans',v_artificer_summary,'progression',public.get_character_progression_v1(p_character_id));
end;
$function$;
