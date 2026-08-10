-- Model TCE Phantom Whispers of the Dead as a persistent runtime proficiency overlay.
-- First selection requires a post-acquisition Short/Long Rest. Later qualifying rests
-- authorize one optional replacement; the borrowed proficiency persists until replaced.
-- Permanent Training proficiency arrays are never rewritten by this migration.

create or replace function private.character_has_effective_training_proficiency_v1(
  p_character_id uuid,
  p_kind text,
  p_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_kind text:=lower(btrim(coalesce(p_kind,'')));
  v_norm text:=private.normalize_player_choice_name_v1(p_name);
  v_sheet jsonb:='{}'::jsonb;
  v_latest_long_rest timestamptz;
  v_latest_any_rest timestamptz;
  v_has boolean:=false;
begin
  if p_character_id is null or v_norm='' or v_kind not in ('skill','tool') then return false; end if;
  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id;
  if v_kind='skill' then
    select exists(select 1 from (
      select value#>>'{}' name from jsonb_array_elements(case when jsonb_typeof(v_sheet->'skillProficiencies')='array' then v_sheet->'skillProficiencies' else '[]'::jsonb end)
      union all select value#>>'{}' from jsonb_array_elements(case when jsonb_typeof(v_sheet->'proficiencies'->'skills')='array' then v_sheet->'proficiencies'->'skills' else '[]'::jsonb end)
      union all select value#>>'{}' from jsonb_array_elements(case when jsonb_typeof(v_sheet->'training'->'skills')='array' then v_sheet->'training'->'skills' else '[]'::jsonb end)
      union all select value#>>'{}' from jsonb_array_elements(case when jsonb_typeof(v_sheet->'skills')='array' then v_sheet->'skills' else '[]'::jsonb end)
    ) q where private.normalize_player_choice_name_v1(q.name)=v_norm) into v_has;
    if not v_has and jsonb_typeof(v_sheet->'skills')='object' then
      select exists(select 1 from jsonb_each(v_sheet->'skills') e(key,value)
        where private.normalize_player_choice_name_v1(e.key)=v_norm and (
          e.value='true'::jsonb or (jsonb_typeof(e.value)='number' and coalesce((e.value#>>'{}')::numeric,0)>0)
          or lower(coalesce(e.value#>>'{}','')) in ('true','proficient','expertise','expert')
          or lower(coalesce(e.value->>'proficient','false'))='true' or lower(coalesce(e.value->>'isProficient','false'))='true'
          or lower(coalesce(e.value->>'proficiency','')) not in ('','none','false','0') or lower(coalesce(e.value->>'proficiencyLevel','')) not in ('','none','false','0')
        )) into v_has;
    end if;
  else
    select exists(select 1 from (
      select value#>>'{}' name from jsonb_array_elements(case when jsonb_typeof(v_sheet->'toolProficiencies')='array' then v_sheet->'toolProficiencies' else '[]'::jsonb end)
      union all select value#>>'{}' from jsonb_array_elements(case when jsonb_typeof(v_sheet->'proficiencies'->'tools')='array' then v_sheet->'proficiencies'->'tools' else '[]'::jsonb end)
      union all select value#>>'{}' from jsonb_array_elements(case when jsonb_typeof(v_sheet->'training'->'tools')='array' then v_sheet->'training'->'tools' else '[]'::jsonb end)
      union all select value#>>'{}' from jsonb_array_elements(case when jsonb_typeof(v_sheet->'tools')='array' then v_sheet->'tools' else '[]'::jsonb end)
    ) q where private.normalize_player_choice_name_v1(q.name)=v_norm) into v_has;
    if not v_has and jsonb_typeof(v_sheet->'tools')='object' then
      select exists(select 1 from jsonb_each(v_sheet->'tools') e(key,value)
        where private.normalize_player_choice_name_v1(e.key)=v_norm and (
          e.value='true'::jsonb or lower(coalesce(e.value#>>'{}','')) in ('true','proficient')
          or lower(coalesce(e.value->>'proficient','false'))='true' or lower(coalesce(e.value->>'isProficient','false'))='true'
        )) into v_has;
    end if;
  end if;
  if v_has then return true; end if;
  select max(completed_at) into v_latest_long_rest from public.character_rest_log where character_id=p_character_id and rest_type='long_rest';
  select max(completed_at) into v_latest_any_rest from public.character_rest_log where character_id=p_character_id and rest_type in ('short_rest','long_rest');
  with recursive roots as (
    select r.feature_key,r.replacement_anchor_at,r.state from public.character_runtime_feature_choices r
    where r.character_id=p_character_id
      and not (lower(coalesce(r.state->>'expiresAtNextLongRest','false'))='true' and v_latest_long_rest is not null and r.replacement_anchor_at is not null and v_latest_long_rest>r.replacement_anchor_at)
      and not (lower(coalesce(r.state->>'expiresAtNextQualifyingRest','false'))='true' and v_latest_any_rest is not null and r.replacement_anchor_at is not null and v_latest_any_rest>r.replacement_anchor_at)
  ), walk(feature_key,path,value) as (
    select r.feature_key,array[e.key]::text[],e.value from roots r cross join lateral jsonb_each(case when jsonb_typeof(r.state)='object' then r.state else '{}'::jsonb end) e
    union all
    select w.feature_key,w.path||c.key,c.value from walk w cross join lateral (
      select e.key,e.value from jsonb_each(case when jsonb_typeof(w.value)='object' then w.value else '{}'::jsonb end) e
      union all select a.ordinality::text,a.value from jsonb_array_elements(case when jsonb_typeof(w.value)='array' then w.value else '[]'::jsonb end) with ordinality a(value,ordinality)
    ) c
  )
  select exists(select 1 from walk w
    where jsonb_typeof(w.value)='string'
      and private.normalize_player_choice_name_v1(w.value#>>'{}')=v_norm
      and not exists(select 1 from unnest(w.path) p where lower(p) like 'previous%')
      and ((v_kind='skill' and exists(select 1 from unnest(w.path) p where lower(p) like '%skill%' or lower(p) like '%profic%'))
        or (v_kind='tool' and exists(select 1 from unnest(w.path) p where lower(p) like '%tool%' or lower(p) like '%profic%')))
  ) into v_has;
  return coalesce(v_has,false);
end;
$$;

create or replace function private.whispers_of_the_dead_catalog_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare v_skills jsonb:='[]'::jsonb; v_tools jsonb:='[]'::jsonb;
begin
  if to_regclass('public.skills_catalog') is not null then
    execute $sql$with raw as (select coalesce(to_jsonb(s)->>'name',to_jsonb(s)->>'skill_name',to_jsonb(s)->>'skill') name from public.skills_catalog s), clean as (select distinct btrim(name) name from raw where btrim(coalesce(name,''))<>'') select coalesce(jsonb_agg(jsonb_build_object('key','skill:'||private.normalize_player_choice_name_v1(name),'kind','skill','name',name) order by name),'[]'::jsonb) from clean where not private.character_has_effective_training_proficiency_v1($1,'skill',name)$sql$ into v_skills using p_character_id;
  end if;
  if jsonb_array_length(v_skills)=0 then
    with clean(name) as (values ('Acrobatics'),('Animal Handling'),('Arcana'),('Athletics'),('Deception'),('History'),('Insight'),('Intimidation'),('Investigation'),('Medicine'),('Nature'),('Perception'),('Performance'),('Persuasion'),('Religion'),('Sleight of Hand'),('Stealth'),('Survival'))
    select coalesce(jsonb_agg(jsonb_build_object('key','skill:'||private.normalize_player_choice_name_v1(name),'kind','skill','name',name) order by name),'[]'::jsonb) into v_skills from clean where not private.character_has_effective_training_proficiency_v1(p_character_id,'skill',name);
  end if;
  with raw as (
    select distinct btrim(i.item_name) name from public.items_catalog i
    where btrim(coalesce(i.item_name,''))<>'' and (
      lower(coalesce(i.item_type,'')) like '%tool%' or lower(coalesce(i.item_type,'')) like '%instrument%' or lower(coalesce(i.item_type,'')) like '%gaming%'
      or lower(coalesce(i.payload->>'category','')) like '%tool%' or lower(coalesce(i.payload->>'equipmentCategory','')) like '%tool%' or lower(coalesce(i.payload->>'toolCategory',''))<>''
    )
  )
  select coalesce(jsonb_agg(jsonb_build_object('key','tool:'||private.normalize_player_choice_name_v1(name),'kind','tool','name',name) order by name),'[]'::jsonb) into v_tools from raw where not private.character_has_effective_training_proficiency_v1(p_character_id,'tool',name);
  return jsonb_build_object('skills',v_skills,'tools',v_tools,'all',coalesce(v_skills,'[]'::jsonb)||coalesce(v_tools,'[]'::jsonb));
end;
$$;

create or replace function private.whispers_of_the_dead_context_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare v_progression public.character_progression%rowtype; v_class public.class_catalog%rowtype; v_feature_level integer; v_acquired_at timestamptz;
begin
  if p_character_id is null then return jsonb_build_object('eligible',false,'featureName','Whispers of the Dead'); end if;
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found then return jsonb_build_object('eligible',false,'featureName','Whispers of the Dead'); end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found or lower(coalesce(v_class.class_key,''))<>'rogue' or upper(coalesce(v_class.source,''))<>'PHB'
     or private.normalize_player_choice_name_v1(v_progression.subclass_name)<>'phantom' or upper(coalesce(v_progression.subclass_source,''))<>'TCE' then
    return jsonb_build_object('eligible',false,'featureName','Whispers of the Dead','classSource',coalesce(v_class.source,''),'subclassName',coalesce(v_progression.subclass_name,''),'subclassSource',coalesce(v_progression.subclass_source,''));
  end if;
  select min(f.level)::integer into v_feature_level from public.class_feature_catalog f
  where lower(f.class_key)='rogue' and upper(coalesce(f.class_source,''))='PHB' and lower(coalesce(f.subclass_name,''))='phantom' and upper(coalesce(f.source,''))='TCE' and lower(f.name)='whispers of the dead';
  if v_feature_level is null or v_progression.class_level<v_feature_level then return jsonb_build_object('eligible',false,'featureName','Whispers of the Dead','source','TCE','classLevel',v_progression.class_level,'featureLevel',v_feature_level); end if;
  v_acquired_at:=private.character_class_feature_acquired_at_v1(p_character_id,'rogue','PHB',v_feature_level);
  return jsonb_build_object('eligible',true,'featureName','Whispers of the Dead','source','TCE','className','Rogue','classSource','PHB','subclassName','Phantom','subclassSource','TCE','classLevel',v_progression.class_level,'featureLevel',v_feature_level,'acquiredAt',v_acquired_at);
end;
$$;

create or replace function private.sync_whispers_of_the_dead_projection_v1(p_character_id uuid,p_state jsonb)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare v_sheet jsonb:='{}'::jsonb;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  if not found then return; end if;
  if coalesce(jsonb_typeof(v_sheet->'runtimeFeatures'),'')<>'object' then v_sheet:=jsonb_set(v_sheet,'{runtimeFeatures}','{}'::jsonb,true); end if;
  if p_state is null then v_sheet:=v_sheet #- array['runtimeFeatures','whispersOfTheDead']; else v_sheet:=jsonb_set(v_sheet,'{runtimeFeatures,whispersOfTheDead}',p_state,true); end if;
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
end;
$$;

create or replace function public.get_character_whispers_of_the_dead_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare v_context jsonb:=private.whispers_of_the_dead_context_v1(p_character_id); v_catalog jsonb:='{}'::jsonb; v_runtime public.character_runtime_feature_choices%rowtype; v_had_runtime boolean:=false; v_latest_rest timestamptz; v_acquired_at timestamptz; v_can_configure boolean:=false;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to review Whispers of the Dead for this character.' using errcode='42501'; end if;
  if not coalesce((v_context->>'eligible')::boolean,false) then return jsonb_build_object('available',false,'featureName','Whispers of the Dead','context',v_context); end if;
  begin v_acquired_at:=(v_context->>'acquiredAt')::timestamptz; exception when others then v_acquired_at:=null; end;
  select max(completed_at) into v_latest_rest from public.character_rest_log where character_id=p_character_id and rest_type in ('short_rest','long_rest');
  select * into v_runtime from public.character_runtime_feature_choices where character_id=p_character_id and feature_key='rogue-phantom-whispers-of-the-dead'; v_had_runtime:=found;
  v_can_configure:=v_latest_rest is not null and v_acquired_at is not null and v_latest_rest>v_acquired_at and (not v_had_runtime or v_runtime.replacement_anchor_at is null or v_latest_rest>v_runtime.replacement_anchor_at);
  v_catalog:=private.whispers_of_the_dead_catalog_v1(p_character_id);
  return jsonb_build_object('available',true,'featureKey','rogue-phantom-whispers-of-the-dead','featureName','Whispers of the Dead','source','TCE','cadence','short_or_long_rest','context',v_context,'configured',v_had_runtime and coalesce((v_runtime.state->>'configured')::boolean,false),'active',v_had_runtime and coalesce((v_runtime.state->>'configured')::boolean,false),'canConfigure',v_can_configure,'latestQualifyingRestAt',v_latest_rest,'replacementAnchorAt',case when v_had_runtime then v_runtime.replacement_anchor_at else null end,'state',case when v_had_runtime then v_runtime.state else jsonb_build_object('configured',false) end,'skillOptions',coalesce(v_catalog->'skills','[]'::jsonb),'toolOptions',coalesce(v_catalog->'tools','[]'::jsonb),'options',coalesce(v_catalog->'all','[]'::jsonb),'helper','After a qualifying Short Rest or Long Rest, choose one skill or tool proficiency you currently lack. The borrowed proficiency persists until you use Whispers of the Dead again after a later qualifying rest; replacing it removes only the prior borrowed proficiency, not permanent Training choices.');
end;
$$;

create or replace function public.configure_character_whispers_of_the_dead_v1(p_character_id uuid,p_kind text,p_name text)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare v_context jsonb:=private.whispers_of_the_dead_context_v1(p_character_id); v_kind text:=lower(btrim(coalesce(p_kind,''))); v_name text:=btrim(coalesce(p_name,'')); v_catalog jsonb:='{}'::jsonb; v_selected jsonb; v_runtime public.character_runtime_feature_choices%rowtype; v_had_runtime boolean:=false; v_latest_rest timestamptz; v_acquired_at timestamptz; v_state jsonb; v_active_encounter jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to configure Whispers of the Dead for this character.' using errcode='42501'; end if;
  if not coalesce((v_context->>'eligible')::boolean,false) then raise exception 'Whispers of the Dead requires a PHB Rogue 3+ with the TCE Phantom subclass.'; end if;
  if v_kind not in ('skill','tool') or v_name='' then raise exception 'Choose one skill or tool proficiency.'; end if;
  v_active_encounter:=private.character_active_encounter_v1(p_character_id); if v_active_encounter is not null then raise exception 'Whispers of the Dead cannot be configured while this character is in an active encounter.'; end if;
  begin v_acquired_at:=(v_context->>'acquiredAt')::timestamptz; exception when others then v_acquired_at:=null; end;
  select max(completed_at) into v_latest_rest from public.character_rest_log where character_id=p_character_id and rest_type in ('short_rest','long_rest');
  if v_acquired_at is null or v_latest_rest is null or v_latest_rest<=v_acquired_at then raise exception 'Finish a Short Rest or Long Rest after acquiring Whispers of the Dead before choosing a proficiency.'; end if;
  select * into v_runtime from public.character_runtime_feature_choices where character_id=p_character_id and feature_key='rogue-phantom-whispers-of-the-dead' for update; v_had_runtime:=found;
  if v_had_runtime and v_runtime.replacement_anchor_at is not null and v_latest_rest<=v_runtime.replacement_anchor_at then raise exception 'Whispers of the Dead has already been configured for this Short Rest or Long Rest.'; end if;
  v_catalog:=private.whispers_of_the_dead_catalog_v1(p_character_id);
  select o.value into v_selected from jsonb_array_elements(coalesce(v_catalog->'all','[]'::jsonb)) o(value) where o.value->>'kind'=v_kind and private.normalize_player_choice_name_v1(o.value->>'name')=private.normalize_player_choice_name_v1(v_name) limit 1;
  if v_selected is null then raise exception 'Choose a skill or tool proficiency this character currently lacks.'; end if;
  v_state:=jsonb_build_object('configured',true,'active',true,'featureKey','rogue-phantom-whispers-of-the-dead','featureName','Whispers of the Dead','source','TCE','classSource','PHB','subclassName','Phantom','subclassSource','TCE','proficiencyKind',v_kind,'proficiencyName',v_selected->>'name','configuredAt',timezone('utc',now()),'configuredRestAt',v_latest_rest,'configuredBy','rest_selection','qualifyingRests',jsonb_build_array('short_rest','long_rest'),'previousBorrowedProficiency',case when v_had_runtime then jsonb_build_object('proficiencyKind',v_runtime.state->>'proficiencyKind','proficiencyName',v_runtime.state->>'proficiencyName') else null end);
  insert into public.character_runtime_feature_choices(character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at)
  values(p_character_id,'rogue-phantom-whispers-of-the-dead','Whispers of the Dead','TCE','short_or_long_rest',v_state,v_latest_rest,now(),now())
  on conflict(character_id,feature_key) do update set feature_name=excluded.feature_name,source=excluded.source,cadence=excluded.cadence,state=excluded.state,replacement_anchor_at=excluded.replacement_anchor_at,updated_at=now();
  perform private.sync_whispers_of_the_dead_projection_v1(p_character_id,v_state);
  return public.get_character_whispers_of_the_dead_v1(p_character_id);
end;
$$;

revoke all on function private.character_has_effective_training_proficiency_v1(uuid,text,text) from public,anon,authenticated;
revoke all on function private.whispers_of_the_dead_catalog_v1(uuid) from public,anon,authenticated;
revoke all on function private.whispers_of_the_dead_context_v1(uuid) from public,anon,authenticated;
revoke all on function private.sync_whispers_of_the_dead_projection_v1(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.character_has_effective_training_proficiency_v1(uuid,text,text) to service_role;
grant execute on function private.whispers_of_the_dead_catalog_v1(uuid) to service_role;
grant execute on function private.whispers_of_the_dead_context_v1(uuid) to service_role;
grant execute on function private.sync_whispers_of_the_dead_projection_v1(uuid,jsonb) to service_role;
revoke all on function public.get_character_whispers_of_the_dead_v1(uuid) from public,anon;
revoke all on function public.configure_character_whispers_of_the_dead_v1(uuid,text,text) from public,anon;
grant execute on function public.get_character_whispers_of_the_dead_v1(uuid) to authenticated,service_role;
grant execute on function public.configure_character_whispers_of_the_dead_v1(uuid,text,text) to authenticated,service_role;
