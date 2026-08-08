-- Turn on the first class-choice delta families now that their source-legal
-- groups and materializer exist. Dependency-heavy systems remain fail-closed.

create or replace function private.unsupported_level_choice_features_v1(p_features jsonb)
returns jsonb
language plpgsql
immutable
set search_path to 'pg_catalog'
as $function$
declare
  v_result jsonb := '[]'::jsonb;
  v_feature jsonb;
  v_name text;
begin
  if jsonb_typeof(coalesce(p_features,'[]'::jsonb)) <> 'array' then return v_result; end if;
  for v_feature in select value from jsonb_array_elements(p_features) loop
    v_name:=lower(btrim(coalesce(v_feature->>'name','')));
    -- These remain unmodeled permanent/source-access decisions. Runtime/rest
    -- configuration such as Weapon Mastery is deliberately not on this list.
    if v_name in ('divine order','primal order','metamagic','eldritch invocations','eldritch invocation','magical secrets') then
      v_result:=v_result||jsonb_build_array(v_feature->>'name');
    elsif v_name='epic boon' then
      v_result:=v_result||jsonb_build_array(v_feature->>'name');
    end if;
  end loop;
  return v_result;
end;
$function$;

create or replace function private.level_up_persistent_choice_gaps_v1(
  p_class_key text,p_class_source text,p_from_level integer,p_to_level integer
)
returns jsonb
language plpgsql
immutable
set search_path to 'pg_catalog'
as $function$
declare
  v_class text:=lower(btrim(coalesce(p_class_key,'')));
  v_source text:=upper(btrim(coalesce(p_class_source,'')));
  v_from integer:=greatest(1,coalesce(p_from_level,1));
  v_to integer:=greatest(1,coalesce(p_to_level,1));
  v_out jsonb:='[]'::jsonb;
  v_warlock_before integer:=0;
  v_warlock_after integer:=0;
  v_meta_before integer:=0;
  v_meta_after integer:=0;
begin
  if v_source<>'XPHB' or v_to<>v_from+1 then return v_out; end if;
  if v_class='bard' and v_to=10 then
    v_out:=v_out||jsonb_build_array('Magical Secrets spell access');
  elsif v_class='sorcerer' then
    v_meta_before:=case when v_from>=17 then 6 when v_from>=10 then 4 when v_from>=2 then 2 else 0 end;
    v_meta_after:=case when v_to>=17 then 6 when v_to>=10 then 4 when v_to>=2 then 2 else 0 end;
    if v_meta_after>v_meta_before then v_out:=v_out||jsonb_build_array('Metamagic +'||(v_meta_after-v_meta_before)::text); end if;
  elsif v_class='warlock' then
    v_warlock_before:=case when v_from>=18 then 10 when v_from>=15 then 9 when v_from>=12 then 8 when v_from>=9 then 7 when v_from>=7 then 6 when v_from>=5 then 5 when v_from>=2 then 3 else 1 end;
    v_warlock_after:=case when v_to>=18 then 10 when v_to>=15 then 9 when v_to>=12 then 8 when v_to>=9 then 7 when v_to>=7 then 6 when v_to>=5 then 5 when v_to>=2 then 3 else 1 end;
    if v_warlock_after>v_warlock_before then v_out:=v_out||jsonb_build_array('Eldritch Invocations +'||(v_warlock_after-v_warlock_before)::text); end if;
    if v_to in (11,13,15,17) then v_out:=v_out||jsonb_build_array('Mystic Arcanum level '||(case v_to when 11 then 6 when 13 then 7 when 15 then 8 else 9 end)::text); end if;
  end if;
  return v_out;
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
  v_class_groups jsonb:='[]'::jsonb;
  v_class_choice_summary jsonb:='[]'::jsonb;
  v_class_choice_input jsonb:=coalesce(v_input->'class_choice_selections','{}'::jsonb);
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to level this character.' using errcode='42501'; end if;
  if jsonb_typeof(v_input)<>'object' then raise exception 'Level-up selections must be a JSON object.'; end if;
  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if not found then raise exception 'Character progression has not been initialized.' using errcode='P0002'; end if;
  if v_progression.class_level>=20 then raise exception 'This character is already level 20.'; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  select * into v_next from public.class_level_progression where class_id=v_progression.class_id and class_level=v_progression.class_level+1;
  if not found then raise exception 'Next-level progression metadata is unavailable.'; end if;

  if jsonb_array_length(private.level_up_persistent_choice_gaps_v1(v_class.class_key,v_class.source,v_progression.class_level,v_next.class_level))>0 then
    raise exception 'This level still contains a persistent class choice that is not connected to progression v3.';
  end if;

  v_class_groups:=private.simple_level_class_choice_groups_v1(p_character_id,v_next.class_level);
  if jsonb_array_length(v_class_groups)>0 then
    v_class_choice_summary:=private.apply_simple_level_class_choices_v1(p_character_id,v_next.class_level,v_class_choice_input);
  elsif jsonb_typeof(v_input->'class_choice_selections') is not null and (select count(*) from jsonb_object_keys(v_class_choice_input))>0 then
    raise exception 'This level does not accept simple class-choice selections.';
  end if;

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
  end if;

  select coalesce(level_choices->(v_next.class_level::text),'{}'::jsonb) into v_level_choice from public.character_progression where character_id=p_character_id;
  if v_sanitized is not null then v_level_choice:=v_level_choice||jsonb_build_object('advancement_instance',v_sanitized); end if;
  if jsonb_array_length(v_class_choice_summary)>0 then v_level_choice:=v_level_choice||jsonb_build_object('class_choice_delta',v_class_choice_summary); end if;
  update public.character_progression set level_choices=jsonb_set(coalesce(level_choices,'{}'::jsonb),array[v_next.class_level::text],v_level_choice,true),updated_at=now() where character_id=p_character_id;

  select id into v_session_id from public.character_level_up_sessions where character_id=p_character_id and to_level=v_next.class_level and status='completed' order by completed_at desc limit 1;
  if v_session_id is not null then
    update public.character_level_up_sessions
    set selections=coalesce(selections,'{}'::jsonb)
      ||case when v_sanitized is not null then jsonb_build_object('advancement_instance',v_sanitized) else '{}'::jsonb end
      ||case when jsonb_array_length(v_class_choice_summary)>0 then jsonb_build_object('class_choice_delta',v_class_choice_summary) else '{}'::jsonb end,
      updated_at=now()
    where id=v_session_id;
  end if;
  update public.character_level_events
  set details=coalesce(details,'{}'::jsonb)
    ||case when v_sanitized is not null then jsonb_build_object('advancementOptionId',v_option.id,'advancementName',v_option.name,'advancementSource',v_option.source,'advancementInstance',v_sanitized) else '{}'::jsonb end
    ||case when jsonb_array_length(v_class_choice_summary)>0 then jsonb_build_object('classChoiceDelta',v_class_choice_summary) else '{}'::jsonb end
  where id=(select id from public.character_level_events where character_id=p_character_id and event_type='level_up_completed' and to_level=v_next.class_level order by created_at desc limit 1);

  return coalesce(v_result,'{}'::jsonb)||jsonb_build_object(
    'progression',public.get_character_progression_v1(p_character_id),
    'advancement',v_sanitized,
    'classChoices',v_class_choice_summary
  );
end;
$function$;
