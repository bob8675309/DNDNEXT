-- Server-side helpers shared by earned level-up and higher-level replay.

create or replace function private.player_sheet_skill_key_v1(p_value text)
returns text
language sql
immutable
set search_path to 'pg_catalog'
as $function$
  select case lower(regexp_replace(btrim(coalesce(p_value,'')), '[^a-zA-Z0-9]+', ' ', 'g'))
    when 'animal handling' then 'animalHandling'
    when 'sleight of hand' then 'sleightOfHand'
    when 'acrobatics' then 'acrobatics'
    when 'arcana' then 'arcana'
    when 'athletics' then 'athletics'
    when 'deception' then 'deception'
    when 'history' then 'history'
    when 'insight' then 'insight'
    when 'intimidation' then 'intimidation'
    when 'investigation' then 'investigation'
    when 'medicine' then 'medicine'
    when 'nature' then 'nature'
    when 'perception' then 'perception'
    when 'performance' then 'performance'
    when 'persuasion' then 'persuasion'
    when 'religion' then 'religion'
    when 'stealth' then 'stealth'
    when 'survival' then 'survival'
    else null
  end;
$function$;

create or replace function private.level_up_advancement_option_id_v1(
  p_character_id uuid,
  p_to_level integer,
  p_instance jsonb,
  p_epic boolean default false
)
returns uuid
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_option_id uuid;
  v_option public.character_option_catalog%rowtype;
  v_repeatable boolean := false;
begin
  if jsonb_typeof(coalesce(p_instance,'{}'::jsonb)) <> 'object' then
    raise exception 'Advancement instance must be a JSON object.';
  end if;
  begin
    v_option_id := nullif(btrim(p_instance ->> 'optionId'),'')::uuid;
  exception when invalid_text_representation then
    raise exception 'Advancement optionId must be a valid UUID.';
  end;
  if v_option_id is null then raise exception 'Choose a canonical advancement option.'; end if;

  select o.* into v_option
  from public.character_option_catalog o
  where o.id=v_option_id
    and exists(select 1 from public.character_option_catalog_preferred preferred where preferred.id=o.id);
  if not found then raise exception 'The selected advancement option is not in the preferred catalogue.'; end if;

  if p_epic then
    if not ((v_option.option_type='boon' and v_option.category='EB') or (v_option.option_type='feat' and v_option.category='G')) then
      raise exception 'Level % requires an Epic Boon or eligible General feat.',p_to_level;
    end if;
  elsif not (v_option.option_type='feat' and v_option.category='G') then
    raise exception 'This advancement requires a 2024 General feat.';
  end if;

  if nullif(btrim(p_instance ->> 'name'),'') is not null
     and private.normalize_player_choice_name_v1(p_instance ->> 'name') <> private.normalize_player_choice_name_v1(v_option.name) then
    raise exception 'Advancement instance name does not match its canonical option.';
  end if;
  if nullif(btrim(p_instance ->> 'source'),'') is not null and upper(btrim(p_instance ->> 'source')) <> upper(v_option.source) then
    raise exception 'Advancement instance source does not match its canonical option.';
  end if;
  if nullif(btrim(p_instance ->> 'optionType'),'') is not null and lower(btrim(p_instance ->> 'optionType')) <> lower(v_option.option_type) then
    raise exception 'Advancement instance type does not match its canonical option.';
  end if;
  if coalesce(nullif(p_instance ->> 'acquisitionLevel','')::integer,p_to_level) <> p_to_level then
    raise exception 'Advancement acquisition level must equal the level being gained.';
  end if;
  if jsonb_typeof(coalesce(p_instance -> 'choices','{}'::jsonb)) <> 'object' then
    raise exception 'Advancement choices must be a JSON object.';
  end if;
  if not private.character_option_prerequisites_met_v1(p_character_id,v_option.id,p_to_level) then
    raise exception 'The character does not meet the prerequisites for % at level %.',v_option.name,p_to_level;
  end if;

  v_repeatable := coalesce((v_option.metadata ->> 'repeatable')::boolean,false);
  if not v_repeatable and exists(
    select 1 from public.character_option_grant_instances gi
    where gi.character_id=p_character_id and gi.option_id=v_option.id
  ) then raise exception '% is not repeatable and is already known.',v_option.name; end if;

  return v_option.id;
end;
$function$;

create or replace function private.level_up_ability_increases_v1(
  p_option_id uuid,
  p_instance jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_option public.character_option_catalog%rowtype;
  v_result jsonb := '{}'::jsonb;
  v_entry jsonb;
  v_choose jsonb;
  v_ability text;
  v_amount integer;
  v_current integer;
  v_choice jsonb;
  v_ability_choices jsonb := '[]'::jsonb;
  v_choice_count integer := 0;
  v_choose_count integer := 0;
  v_plus_two jsonb;
  v_plus_ones jsonb;
  v_mode text;
begin
  select * into v_option from public.character_option_catalog where id=p_option_id and option_type in ('feat','boon');
  if not found then raise exception 'Advancement option was not found.'; end if;

  if lower(v_option.name)='ability score improvement' then
    v_plus_two := coalesce(p_instance #> '{choices,asi-plus-two}','[]'::jsonb);
    v_plus_ones := coalesce(p_instance #> '{choices,asi-plus-ones}','[]'::jsonb);
    v_mode := coalesce(p_instance #>> '{choices,asi-mode,0,value}','');
    if jsonb_typeof(v_plus_two)<>'array' or jsonb_typeof(v_plus_ones)<>'array' then raise exception 'Ability Score Improvement choices are malformed.'; end if;
    if v_mode='plus-two' and jsonb_array_length(v_plus_two)=1 and jsonb_array_length(v_plus_ones)=0 then
      v_ability := lower(v_plus_two #>> '{0,value}');
      if v_ability not in ('str','dex','con','int','wis','cha') then raise exception 'Choose a valid ability for Ability Score Improvement.'; end if;
      return jsonb_build_object(v_ability,2);
    elsif v_mode='split' and jsonb_array_length(v_plus_two)=0 and jsonb_array_length(v_plus_ones)=2 then
      if lower(v_plus_ones #>> '{0,value}')=lower(v_plus_ones #>> '{1,value}') then raise exception 'Split Ability Score Improvement must use two different abilities.'; end if;
      for v_choice in select value from jsonb_array_elements(v_plus_ones) loop
        v_ability:=lower(coalesce(v_choice->>'value',''));
        if v_ability not in ('str','dex','con','int','wis','cha') then raise exception 'Choose valid abilities for Ability Score Improvement.'; end if;
        v_result:=jsonb_set(v_result,array[v_ability],to_jsonb(1),true);
      end loop;
      return v_result;
    end if;
    raise exception 'Ability Score Improvement must be either +2 to one ability or +1 to two different abilities.';
  end if;

  select coalesce(jsonb_agg(choice),'[]'::jsonb),count(*)
  into v_ability_choices,v_choice_count
  from jsonb_each(coalesce(p_instance->'choices','{}'::jsonb)) field
  cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice
  where choice->>'kind'='ability';

  for v_entry in select value from jsonb_array_elements(coalesce(v_option.metadata->'ability','[]'::jsonb)) loop
    if jsonb_typeof(v_entry)<>'object' then continue; end if;
    v_choose:=v_entry->'choose';
    if jsonb_typeof(v_choose)='object' then
      v_choose_count:=v_choose_count+1;
      if v_choice_count < v_choose_count then raise exception '% requires an ability choice.',v_option.name; end if;
      v_choice:=v_ability_choices->(v_choose_count-1);
      v_ability:=lower(coalesce(v_choice->>'value',''));
      if not exists(select 1 from jsonb_array_elements_text(coalesce(v_choose->'from','[]'::jsonb)) allowed where lower(allowed)=v_ability) then
        raise exception '% does not allow % as its ability choice.',v_option.name,upper(v_ability);
      end if;
      v_amount:=coalesce(nullif(v_choose->>'amount','')::integer,nullif(v_entry->>'amount','')::integer,1);
      v_current:=coalesce(nullif(v_result->>v_ability,'')::integer,0);
      v_result:=jsonb_set(v_result,array[v_ability],to_jsonb(v_current+v_amount),true);
    else
      for v_ability,v_choice in select key,value from jsonb_each(v_entry) loop
        if v_ability not in ('str','dex','con','int','wis','cha') then continue; end if;
        begin v_amount:=(v_choice #>> '{}')::integer; exception when others then v_amount:=0; end;
        if v_amount<>0 then
          v_current:=coalesce(nullif(v_result->>v_ability,'')::integer,0);
          v_result:=jsonb_set(v_result,array[v_ability],to_jsonb(v_current+v_amount),true);
        end if;
      end loop;
    end if;
  end loop;
  if v_choice_count<>v_choose_count then raise exception '% has unexpected ability selections.',v_option.name; end if;
  return v_result;
end;
$function$;

-- Level 19 is source-modeled now.  Keep the legacy v1 review blocked, but let
-- the v2 review opt in only when Epic Boon is the sole legacy blocker.
create or replace function public.begin_character_level_up_v2(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth'
as $function$
declare
  v_result jsonb;
  v_session jsonb;
  v_preview jsonb;
  v_unsupported jsonb;
  v_required jsonb;
  v_only_epic boolean := false;
begin
  v_result:=public.begin_character_level_up_v1(p_character_id);
  v_preview:=coalesce(v_result->'preview','{}'::jsonb);
  v_unsupported:=coalesce(v_preview->'unsupportedChoices','[]'::jsonb);
  v_only_epic:=jsonb_typeof(v_unsupported)='array' and jsonb_array_length(v_unsupported)=1 and lower(v_unsupported->>0)='epic boon';
  if not v_only_epic then return v_result; end if;

  v_required:=coalesce(v_preview->'choices','[]'::jsonb)||jsonb_build_array(jsonb_build_object(
    'key','advancement','type','epic_boon_or_feat','label','Epic Boon or General Feat','required',true
  ));
  v_preview:=v_preview||jsonb_build_object('choices',v_required,'unsupportedChoices','[]'::jsonb,'metadataReady',true,'blockedReason',null);
  update public.character_level_up_sessions
  set metadata_ready=true,required_choices=v_required,preview=v_preview,updated_at=now()
  where character_id=p_character_id and status='open'
  returning to_jsonb(character_level_up_sessions.*) into v_session;
  return jsonb_build_object('session',v_session,'preview',v_preview,'metadataReady',true,'canComplete',true,'message','All required choices for this level are source-modeled and can be applied transactionally.');
end;
$function$;

revoke all on function public.begin_character_level_up_v2(uuid) from public;
grant execute on function public.begin_character_level_up_v2(uuid) to authenticated;
