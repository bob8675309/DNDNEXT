-- Per-feat runtime Expertise authority for Echoing Soul (RHW) and Zhentarim Tactics (FRHoF).
-- Echoing Soul permanently grants two skills + one PHB language and immediately grants Expertise
-- in one proficient skill; that Expertise persists until explicitly changed after a newer Long Rest.
-- Zhentarim Tactics grants no Expertise at acquisition; after a Long Rest, choose one proficient skill,
-- and that Expertise expires automatically at the next Long Rest.
-- No combat/action implementation is included for Intrusive Echoes or Retaliate.

update public.character_option_catalog
set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
      'skillProficiencies',jsonb_build_array(jsonb_build_object('any',2)),
      'languageProficiencies',jsonb_build_array(jsonb_build_object('any',1)),
      'expertise',jsonb_build_array(jsonb_build_object('anyProficientSkill',1))
    ),
    raw_payload=jsonb_set(coalesce(raw_payload,'{}'::jsonb),'{skillProficiencies}',jsonb_build_array(jsonb_build_object('any',2)),true),
    updated_at=now()
where option_type='feat'
  and private.normalize_player_choice_name_v1(name)=private.normalize_player_choice_name_v1('Echoing Soul')
  and upper(source)='RHW';

create or replace function private.phb_additional_language_options_v1()
returns jsonb
language sql
immutable
security definer
set search_path=pg_catalog,public,private,auth
as $$
  select jsonb_agg(jsonb_build_object('key',v.key,'name',v.name,'source','XPHB') order by v.ord)
  from (values
    (1,'common-sign-language','Common Sign Language'),
    (2,'draconic','Draconic'),
    (3,'dwarvish','Dwarvish'),
    (4,'elvish','Elvish'),
    (5,'giant','Giant'),
    (6,'gnomish','Gnomish'),
    (7,'goblin','Goblin'),
    (8,'halfling','Halfling'),
    (9,'orc','Orc'),
    (10,'abyssal','Abyssal'),
    (11,'celestial','Celestial'),
    (12,'deep-speech','Deep Speech'),
    (13,'druidic','Druidic'),
    (14,'infernal','Infernal'),
    (15,'primordial','Primordial'),
    (16,'sylvan','Sylvan'),
    (17,'thieves-cant','Thieves'' Cant'),
    (18,'undercommon','Undercommon')
  ) as v(ord,key,name);
$$;

create or replace function private.phb_additional_language_name_v1(p_value text)
returns text
language sql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
  select entry.value->>'name'
  from jsonb_array_elements(private.phb_additional_language_options_v1()) entry(value)
  where private.normalize_player_choice_name_v1(entry.value->>'key')=private.normalize_player_choice_name_v1(p_value)
     or private.normalize_player_choice_name_v1(entry.value->>'name')=private.normalize_player_choice_name_v1(p_value)
  limit 1;
$$;

create or replace function private.feat_runtime_expertise_family_v1(p_option_name text,p_option_source text)
returns text
language sql
immutable
set search_path=pg_catalog
as $$
  select case
    when lower(regexp_replace(coalesce(p_option_name,''),'[^a-zA-Z0-9]+','','g'))='echoingsoul' and upper(coalesce(p_option_source,''))='RHW' then 'echoing-soul'
    when lower(regexp_replace(coalesce(p_option_name,''),'[^a-zA-Z0-9]+','','g'))='zhentarimtactics' and upper(coalesce(p_option_source,''))='FRHOF' then 'zhentarim-tactics'
    else null
  end;
$$;

create or replace function private.feat_runtime_expertise_feature_key_v1(p_family text,p_instance_key text)
returns text
language sql
immutable
set search_path=pg_catalog
as $$
  select case lower(coalesce(p_family,''))
    when 'echoing-soul' then 'echoing-soul-expertise:'||substr(md5(coalesce(p_instance_key,'')),1,16)
    when 'zhentarim-tactics' then 'zhentarim-tactics-expertise:'||substr(md5(coalesce(p_instance_key,'')),1,16)
    else null
  end;
$$;

create or replace function private.character_effective_proficient_skill_options_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_sheet jsonb:='{}'::jsonb;
  v_options jsonb:='[]'::jsonb;
  v_row record;
  v_key text;
  v_runtime boolean;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id;
  if not found then return '[]'::jsonb; end if;

  for v_row in
    select name,source from public.character_option_catalog_preferred where option_type='skill' order by name
  loop
    v_key:=private.player_sheet_skill_key_v1(v_row.name);
    if v_key is null then continue; end if;
    v_runtime:=false;
    if v_sheet#>>'{runtimeProficiencies,astralTrance,skill,key}'=v_key then v_runtime:=true; end if;
    if v_sheet#>>'{runtimeProficiencies,githyankiAstralKnowledge,skill,key}'=v_key then v_runtime:=true; end if;
    if lower(coalesce(v_sheet#>>'{runtimeProficiencies,khoravarSkillVersatility,proficiency,kind}',v_sheet#>>'{runtimeProficiencies,khoravarSkillVersatility,proficiency,metadata,kind}',''))='skill'
       and coalesce(v_sheet#>>'{runtimeProficiencies,khoravarSkillVersatility,proficiency,metadata,skillKey}',v_sheet#>>'{runtimeProficiencies,khoravarSkillVersatility,proficiency,key}','')=v_key then
      v_runtime:=true;
    end if;
    if coalesce((v_sheet#>>array['proficiencies','skills',v_key,'proficient'])::boolean,false) or v_runtime then
      v_options:=v_options||jsonb_build_array(jsonb_build_object('key',v_key,'name',v_row.name,'source',coalesce(v_row.source,'XPHB')));
    end if;
  end loop;
  return v_options;
exception when invalid_text_representation then
  return v_options;
end;
$$;

create or replace function private.sync_feat_runtime_expertise_projection_v1(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_sheet jsonb:='{}'::jsonb;
  v_projection jsonb:='{}'::jsonb;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  if not found then return '{}'::jsonb; end if;

  select coalesce(jsonb_object_agg(feature_key,state),'{}'::jsonb) into v_projection
  from public.character_runtime_feature_choices
  where character_id=p_character_id
    and (feature_key like 'echoing-soul-expertise:%' or feature_key like 'zhentarim-tactics-expertise:%')
    and coalesce((state->>'configured')::boolean,false);

  if coalesce(jsonb_typeof(v_sheet->'runtimeProficiencies'),'')<>'object' then
    v_sheet:=jsonb_set(v_sheet,'{runtimeProficiencies}','{}'::jsonb,true);
  end if;
  v_sheet:=jsonb_set(v_sheet,'{runtimeProficiencies,featExpertise}',v_projection,true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  return v_projection;
end;
$$;

create or replace function private.materialize_feat_runtime_expertise_instance_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_family text;
  v_sheet jsonb:='{}'::jsonb;
  v_skills text[]:='{}'::text[];
  v_choice jsonb;
  v_skill_key text;
  v_expertise_key text;
  v_expertise_name text;
  v_language text;
  v_languages jsonb:='[]'::jsonb;
  v_feature_key text;
  v_state jsonb;
  v_skill_names jsonb:='[]'::jsonb;
begin
  v_family:=private.feat_runtime_expertise_family_v1(new.option_name,new.option_source);
  if v_family is null then return new; end if;

  if v_family='zhentarim-tactics' then
    if exists(
      select 1 from jsonb_each(coalesce(new.choices,'{}'::jsonb)) field
      cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice
      where choice->>'kind'='runtime-expertise'
    ) then
      raise exception 'Zhentarim Tactics does not grant Expertise until a Long Rest is completed.';
    end if;
    return new;
  end if;

  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=new.character_id for update;
  if not found then raise exception 'Echoing Soul could not resolve the character sheet.'; end if;

  for v_choice in
    select choice from jsonb_each(coalesce(new.choices,'{}'::jsonb)) field
    cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice
    where choice->>'kind'='skill'
  loop
    v_skill_key:=private.player_sheet_skill_key_v1(coalesce(nullif(v_choice->>'value',''),v_choice->>'label',''));
    if v_skill_key is null or not exists(
      select 1 from public.character_option_catalog_preferred s
      where s.option_type='skill' and private.player_sheet_skill_key_v1(s.name)=v_skill_key
    ) then raise exception 'Echoing Soul contains an invalid skill proficiency choice.'; end if;
    if v_skill_key=any(v_skills) then raise exception 'Echoing Soul skill proficiency choices must be distinct.'; end if;
    v_skills:=array_append(v_skills,v_skill_key);
  end loop;
  if cardinality(v_skills)<>2 then raise exception 'Echoing Soul requires exactly two skill proficiency choices.'; end if;

  if coalesce(jsonb_typeof(v_sheet#>'{proficiencies,skills}'),'')<>'object' then
    if coalesce(jsonb_typeof(v_sheet->'proficiencies'),'')<>'object' then v_sheet:=jsonb_set(v_sheet,'{proficiencies}','{}'::jsonb,true); end if;
    v_sheet:=jsonb_set(v_sheet,'{proficiencies,skills}','{}'::jsonb,true);
  end if;
  foreach v_skill_key in array v_skills loop
    v_sheet:=jsonb_set(v_sheet,array['proficiencies','skills',v_skill_key],coalesce(v_sheet#>array['proficiencies','skills',v_skill_key],'{}'::jsonb)||jsonb_build_object('proficient',true),true);
  end loop;

  select private.phb_additional_language_name_v1(coalesce(nullif(choice->>'value',''),choice->>'label','')) into v_language
  from jsonb_each(coalesce(new.choices,'{}'::jsonb)) field
  cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice
  where choice->>'kind'='language'
  limit 1;
  if v_language is null then raise exception 'Echoing Soul requires one additional Player''s Handbook language.'; end if;
  if (
    select count(*) from jsonb_each(coalesce(new.choices,'{}'::jsonb)) field
    cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice
    where choice->>'kind'='language'
  )<>1 then raise exception 'Echoing Soul requires exactly one additional language.'; end if;
  v_languages:=case when jsonb_typeof(v_sheet->'languages')='array' then v_sheet->'languages' else '[]'::jsonb end;
  if exists(select 1 from jsonb_array_elements_text(v_languages) known where private.normalize_player_choice_name_v1(known)=private.normalize_player_choice_name_v1(v_language)) then
    raise exception 'Echoing Soul must grant a language the character does not already know.';
  end if;
  v_sheet:=jsonb_set(v_sheet,'{languages}',v_languages||to_jsonb(v_language),true);

  select private.player_sheet_skill_key_v1(coalesce(nullif(choice->>'value',''),choice->>'label','')) into v_expertise_key
  from jsonb_each(coalesce(new.choices,'{}'::jsonb)) field
  cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice
  where choice->>'kind'='runtime-expertise'
  limit 1;
  if v_expertise_key is null then raise exception 'Echoing Soul requires one initial Expertise choice.'; end if;
  if (
    select count(*) from jsonb_each(coalesce(new.choices,'{}'::jsonb)) field
    cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice
    where choice->>'kind'='runtime-expertise'
  )<>1 then raise exception 'Echoing Soul requires exactly one initial Expertise choice.'; end if;
  if not coalesce((v_sheet#>>array['proficiencies','skills',v_expertise_key,'proficient'])::boolean,false) then
    raise exception 'Echoing Soul Expertise must use a skill the character is proficient in.';
  end if;
  select name into v_expertise_name from public.character_option_catalog_preferred
  where option_type='skill' and private.player_sheet_skill_key_v1(name)=v_expertise_key limit 1;
  if v_expertise_name is null then raise exception 'Echoing Soul Expertise skill is unavailable.'; end if;

  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=new.character_id;

  v_feature_key:=private.feat_runtime_expertise_feature_key_v1(v_family,new.instance_key);
  v_state:=jsonb_build_object(
    'configured',true,'family',v_family,'instanceKey',new.instance_key,'optionId',new.option_id,
    'skill',jsonb_build_object('key',v_expertise_key,'name',v_expertise_name),
    'configuredAt',timezone('utc',now()),'configuredBy','acquisition'
  );
  insert into public.character_runtime_feature_choices(
    character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at
  ) values(
    new.character_id,v_feature_key,'Echoing Soul Expertise','RHW','long_rest',v_state,now(),now(),now()
  ) on conflict(character_id,feature_key) do nothing;
  perform private.sync_feat_runtime_expertise_projection_v1(new.character_id);
  return new;
end;
$$;

drop trigger if exists character_option_grant_instance_feat_runtime_expertise_v1 on public.character_option_grant_instances;
create trigger character_option_grant_instance_feat_runtime_expertise_v1
after insert on public.character_option_grant_instances
for each row execute function private.materialize_feat_runtime_expertise_instance_v1();

create or replace function private.expire_zhentarim_tactics_expertise_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
begin
  if new.rest_type<>'long_rest' then return new; end if;
  delete from public.character_runtime_feature_choices
  where character_id=new.character_id and feature_key like 'zhentarim-tactics-expertise:%';
  if found then perform private.sync_feat_runtime_expertise_projection_v1(new.character_id); end if;
  return new;
end;
$$;

drop trigger if exists character_rest_log_expire_zhentarim_tactics_expertise_v1 on public.character_rest_log;
create trigger character_rest_log_expire_zhentarim_tactics_expertise_v1
after insert on public.character_rest_log
for each row execute function private.expire_zhentarim_tactics_expertise_v1();

create or replace function public.get_character_feat_runtime_expertise_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_instances jsonb:='[]'::jsonb;
  v_grant public.character_option_grant_instances%rowtype;
  v_family text;
  v_feature_key text;
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_latest_long_rest timestamptz;
  v_configured boolean;
  v_can_configure boolean;
  v_can_replace boolean;
  v_options jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to review runtime Expertise for this character.' using errcode='42501';
  end if;
  select max(completed_at) into v_latest_long_rest from public.character_rest_log where character_id=p_character_id and rest_type='long_rest';
  v_options:=private.character_effective_proficient_skill_options_v1(p_character_id);

  for v_grant in
    select gi.* from public.character_option_grant_instances gi
    where gi.character_id=p_character_id and private.feat_runtime_expertise_family_v1(gi.option_name,gi.option_source) is not null
    order by gi.acquisition_level nulls first,gi.instance_key
  loop
    v_family:=private.feat_runtime_expertise_family_v1(v_grant.option_name,v_grant.option_source);
    v_feature_key:=private.feat_runtime_expertise_feature_key_v1(v_family,v_grant.instance_key);
    select * into v_runtime from public.character_runtime_feature_choices where character_id=p_character_id and feature_key=v_feature_key;
    v_configured:=found and coalesce((v_runtime.state->>'configured')::boolean,false) and nullif(v_runtime.state#>>'{skill,key}','') is not null;
    if v_family='echoing-soul' then
      v_can_configure:=not v_configured;
      v_can_replace:=v_configured and v_latest_long_rest is not null and v_latest_long_rest>v_runtime.replacement_anchor_at;
    else
      v_can_configure:=not v_configured and v_latest_long_rest is not null and v_latest_long_rest>v_grant.created_at;
      v_can_replace:=false;
    end if;
    v_instances:=v_instances||jsonb_build_array(jsonb_build_object(
      'instanceKey',v_grant.instance_key,'featureKey',v_feature_key,'family',v_family,
      'name',v_grant.option_name,'source',v_grant.option_source,'acquisitionLevel',v_grant.acquisition_level,
      'configured',v_configured,'canConfigure',v_can_configure,'canReplace',v_can_replace,
      'latestLongRestAt',v_latest_long_rest,'replacementAnchorAt',case when v_configured then v_runtime.replacement_anchor_at else null end,
      'state',case when v_configured then v_runtime.state else '{}'::jsonb end
    ));
  end loop;

  return jsonb_build_object(
    'available',jsonb_array_length(v_instances)>0,
    'instances',v_instances,
    'skillOptions',v_options,
    'helper','Echoing Soul Expertise persists until changed after a newer Long Rest. Zhentarim Tactics Expertise is chosen after a Long Rest and expires at the next Long Rest.'
  );
end;
$$;

create or replace function public.configure_character_feat_runtime_expertise_v1(
  p_character_id uuid,
  p_instance_key text,
  p_skill_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_grant public.character_option_grant_instances%rowtype;
  v_family text;
  v_feature_key text;
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_latest_long_rest timestamptz;
  v_options jsonb;
  v_skill_key text;
  v_skill_name text;
  v_state jsonb;
  v_anchor timestamptz;
  v_active_encounter jsonb;
  v_had_runtime boolean:=false;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to configure runtime Expertise for this character.' using errcode='42501';
  end if;
  select * into v_grant from public.character_option_grant_instances
  where character_id=p_character_id and instance_key=p_instance_key for update;
  if not found then raise exception 'The requested feat instance is unavailable.'; end if;
  v_family:=private.feat_runtime_expertise_family_v1(v_grant.option_name,v_grant.option_source);
  if v_family is null then raise exception 'The requested feat does not own runtime Expertise.'; end if;

  v_active_encounter:=private.character_active_encounter_v1(p_character_id);
  if v_active_encounter is not null then raise exception 'Runtime Expertise cannot be changed while this character is in an active encounter.'; end if;

  v_skill_key:=private.player_sheet_skill_key_v1(p_skill_key);
  if v_skill_key is null then v_skill_key:=p_skill_key; end if;
  v_options:=private.character_effective_proficient_skill_options_v1(p_character_id);
  select entry.value->>'name' into v_skill_name from jsonb_array_elements(v_options) entry(value)
  where entry.value->>'key'=v_skill_key limit 1;
  if v_skill_name is null then raise exception 'Runtime Expertise must use a skill the character is currently proficient in.'; end if;

  v_feature_key:=private.feat_runtime_expertise_feature_key_v1(v_family,v_grant.instance_key);
  select * into v_runtime from public.character_runtime_feature_choices where character_id=p_character_id and feature_key=v_feature_key for update;
  v_had_runtime:=found and nullif(v_runtime.state#>>'{skill,key}','') is not null;
  select max(completed_at) into v_latest_long_rest from public.character_rest_log where character_id=p_character_id and rest_type='long_rest';

  if v_family='echoing-soul' then
    if v_had_runtime and v_runtime.state#>>'{skill,key}'=v_skill_key then return public.get_character_feat_runtime_expertise_v1(p_character_id); end if;
    if v_had_runtime then
      if v_latest_long_rest is null or v_latest_long_rest<=v_runtime.replacement_anchor_at then raise exception 'Finish a newer Long Rest before changing Echoing Soul Expertise.'; end if;
      v_anchor:=v_latest_long_rest;
    else
      v_anchor:=now();
    end if;
  else
    if v_had_runtime then
      if v_runtime.state#>>'{skill,key}'=v_skill_key then return public.get_character_feat_runtime_expertise_v1(p_character_id); end if;
      raise exception 'Zhentarim Tactics Expertise lasts until the next Long Rest; finish that rest before choosing again.';
    end if;
    if v_latest_long_rest is null or v_latest_long_rest<=v_grant.created_at then raise exception 'Finish a Long Rest after gaining Zhentarim Tactics before choosing Expertise.'; end if;
    v_anchor:=v_latest_long_rest;
  end if;

  v_state:=jsonb_build_object(
    'configured',true,'family',v_family,'instanceKey',v_grant.instance_key,'optionId',v_grant.option_id,
    'skill',jsonb_build_object('key',v_skill_key,'name',v_skill_name),
    'configuredAt',timezone('utc',now()),
    'configuredBy',case when v_family='echoing-soul' and v_had_runtime then 'long_rest_replacement' when v_family='echoing-soul' then 'legacy_initial_configuration' else 'long_rest_configuration' end,
    'previousSkill',case when v_had_runtime then coalesce(v_runtime.state->'skill','{}'::jsonb) else '{}'::jsonb end
  );
  insert into public.character_runtime_feature_choices(
    character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at
  ) values(
    p_character_id,v_feature_key,
    case when v_family='echoing-soul' then 'Echoing Soul Expertise' else 'Zhentarim Tactics Expertise' end,
    v_grant.option_source,'long_rest',v_state,v_anchor,now(),now()
  ) on conflict(character_id,feature_key) do update set
    feature_name=excluded.feature_name,source=excluded.source,cadence=excluded.cadence,state=excluded.state,
    replacement_anchor_at=excluded.replacement_anchor_at,updated_at=now();
  perform private.sync_feat_runtime_expertise_projection_v1(p_character_id);
  return public.get_character_feat_runtime_expertise_v1(p_character_id);
end;
$$;

revoke all on function private.phb_additional_language_options_v1() from public,anon,authenticated;
revoke all on function private.phb_additional_language_name_v1(text) from public,anon,authenticated;
revoke all on function private.feat_runtime_expertise_family_v1(text,text) from public,anon,authenticated;
revoke all on function private.feat_runtime_expertise_feature_key_v1(text,text) from public,anon,authenticated;
revoke all on function private.character_effective_proficient_skill_options_v1(uuid) from public,anon,authenticated;
revoke all on function private.sync_feat_runtime_expertise_projection_v1(uuid) from public,anon,authenticated;
revoke all on function private.materialize_feat_runtime_expertise_instance_v1() from public,anon,authenticated;
revoke all on function private.expire_zhentarim_tactics_expertise_v1() from public,anon,authenticated;
grant execute on function private.phb_additional_language_options_v1() to service_role;
grant execute on function private.phb_additional_language_name_v1(text) to service_role;
grant execute on function private.feat_runtime_expertise_family_v1(text,text) to service_role;
grant execute on function private.feat_runtime_expertise_feature_key_v1(text,text) to service_role;
grant execute on function private.character_effective_proficient_skill_options_v1(uuid) to service_role;
grant execute on function private.sync_feat_runtime_expertise_projection_v1(uuid) to service_role;
grant execute on function private.materialize_feat_runtime_expertise_instance_v1() to service_role;
grant execute on function private.expire_zhentarim_tactics_expertise_v1() to service_role;

revoke all on function public.get_character_feat_runtime_expertise_v1(uuid) from public,anon;
revoke all on function public.configure_character_feat_runtime_expertise_v1(uuid,text,text) from public,anon;
grant execute on function public.get_character_feat_runtime_expertise_v1(uuid) to authenticated,service_role;
grant execute on function public.configure_character_feat_runtime_expertise_v1(uuid,text,text) to authenticated,service_role;
