-- Correct rest-configurable Species proficiency choices that must not be frozen in Forge.
-- Githyanki Astral Knowledge: after Long Rest choose one skill + one PHB weapon/tool;
-- both expire at the next Long Rest.
-- Khoravar Skill Versatility: initial one skill OR tool; persists until explicitly
-- replaced after a newer Long Rest.

create or replace function private.character_has_species_source_v1(
  p_character_id uuid,
  p_species_name text,
  p_species_source text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select exists(
    select 1
    from public.character_sheets cs
    where cs.character_id=p_character_id
      and lower(regexp_replace(coalesce(cs.sheet->>'species',cs.sheet->>'race',cs.sheet #>> '{meta,species}',''),'[^a-zA-Z0-9]+','','g'))
          =lower(regexp_replace(coalesce(p_species_name,''),'[^a-zA-Z0-9]+','','g'))
      and upper(coalesce(cs.sheet #>> '{meta,speciesSource}',cs.sheet->>'speciesSource',''))=upper(coalesce(p_species_source,''))
  );
$$;

create or replace function private.species_runtime_latest_long_rest_v1(p_character_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select max(completed_at)
  from public.character_rest_log
  where character_id=p_character_id and rest_type='long';
$$;

create or replace function private.species_runtime_active_encounter_v1(p_character_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select exists(
    select 1
    from public.encounter_participants ep
    join public.encounters e on e.id=ep.encounter_id
    where ep.character_id=p_character_id
      and lower(coalesce(e.status,'')) in ('active','paused')
      and coalesce(ep.defeated,false)=false
  );
$$;

create or replace function private.githyanki_astral_knowledge_options_v1()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select jsonb_build_object(
    'skills',private.astral_trance_skill_options_v1(),
    'training',private.astral_trance_training_options_v1()
  );
$$;

create or replace function private.khoravar_skill_versatility_options_v1()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
with skill_options as (
  select jsonb_build_object(
    'key','skill:'||(s->>'key'),
    'value','skill:'||(s->>'key'),
    'label',s->>'name',
    'name',s->>'name',
    'kind','skill',
    'source','D&D',
    'metadata',jsonb_build_object('kind','skill','skillKey',s->>'key','name',s->>'name')
  ) as option
  from jsonb_array_elements(private.astral_trance_skill_options_v1()) s
), tool_rows as (
  select distinct on (lower(regexp_replace(i.item_name,'[^a-zA-Z0-9]+','','g')))
    i.*
  from public.items_catalog i
  where lower(coalesce(i.item_rarity,''))='mundane'
    and (
      upper(coalesce(i.payload->>'type','')) in ('AT','GS','INS','T')
      or lower(coalesce(i.item_type,'')) like '%tool%'
      or lower(coalesce(i.item_type,'')) like '%instrument%'
      or lower(coalesce(i.item_type,'')) like '%gaming%'
    )
  order by lower(regexp_replace(i.item_name,'[^a-zA-Z0-9]+','','g')),
           case upper(coalesce(i.payload->>'source','')) when 'XPHB' then 0 when 'PHB' then 1 else 2 end,
           i.item_name
), tool_options as (
  select jsonb_build_object(
    'key','tool:'||id::text,
    'value','tool:'||id::text,
    'label',item_name,
    'name',item_name,
    'kind','tool',
    'source',coalesce(payload->>'source','Campaign'),
    'metadata',jsonb_build_object('kind','tool','itemId',id,'itemKey',item_key,'name',item_name,'source',coalesce(payload->>'source','Campaign'))
  ) as option
  from tool_rows
)
select coalesce(jsonb_agg(option order by option->>'label',option->>'kind'),'[]'::jsonb)
from (
  select option from skill_options
  union all
  select option from tool_options
) q;
$$;

create or replace function private.set_species_runtime_projection_v1(
  p_character_id uuid,
  p_projection_key text,
  p_state jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_sheet jsonb;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets
  where character_id=p_character_id
  for update;
  if v_sheet is null then return; end if;
  if jsonb_typeof(v_sheet->'runtimeProficiencies')<>'object' then
    v_sheet:=jsonb_set(v_sheet,'{runtimeProficiencies}','{}'::jsonb,true);
  end if;
  if p_state is null then
    v_sheet:=v_sheet #- array['runtimeProficiencies',p_projection_key];
  else
    v_sheet:=jsonb_set(v_sheet,array['runtimeProficiencies',p_projection_key],p_state,true);
  end if;
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now()
  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);
end;
$$;

create or replace function public.get_character_githyanki_astral_knowledge_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_row public.character_runtime_feature_choices%rowtype;
  v_latest timestamptz;
  v_available boolean;
  v_options jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to review Astral Knowledge.' using errcode='42501';
  end if;
  v_available:=private.character_has_species_source_v1(p_character_id,'Githyanki','MPMM');
  if not v_available then return jsonb_build_object('available',false); end if;
  select * into v_row from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key='githyanki-astral-knowledge';
  v_latest:=private.species_runtime_latest_long_rest_v1(p_character_id);
  v_options:=private.githyanki_astral_knowledge_options_v1();
  return jsonb_build_object(
    'available',true,
    'configured',found,
    'canConfigure',not found and v_latest is not null,
    'latestLongRestAt',v_latest,
    'state',case when found then v_row.state else null end,
    'skillOptions',v_options->'skills',
    'trainingOptions',v_options->'training'
  );
end;
$$;

create or replace function public.configure_character_githyanki_astral_knowledge_v1(
  p_character_id uuid,
  p_skill_key text,
  p_training_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_existing public.character_runtime_feature_choices%rowtype;
  v_latest timestamptz;
  v_skill jsonb;
  v_training jsonb;
  v_state jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to configure Astral Knowledge.' using errcode='42501'; end if;
  if not private.character_has_species_source_v1(p_character_id,'Githyanki','MPMM') then raise exception 'Astral Knowledge is unavailable for this character.'; end if;
  if private.species_runtime_active_encounter_v1(p_character_id) then raise exception 'Astral Knowledge cannot be configured during an active encounter.'; end if;
  select * into v_existing from public.character_runtime_feature_choices where character_id=p_character_id and feature_key='githyanki-astral-knowledge' for update;
  if found then raise exception 'Astral Knowledge is already configured for the current Long Rest.'; end if;
  v_latest:=private.species_runtime_latest_long_rest_v1(p_character_id);
  if v_latest is null then raise exception 'Finish a Long Rest before configuring Astral Knowledge.'; end if;
  select value into v_skill from jsonb_array_elements(private.astral_trance_skill_options_v1()) where value->>'key'=p_skill_key limit 1;
  if v_skill is null then raise exception 'The selected Astral Knowledge skill is invalid.'; end if;
  select value into v_training from jsonb_array_elements(private.astral_trance_training_options_v1()) where value->>'itemId'=p_training_item_id::text limit 1;
  if v_training is null then raise exception 'The selected Astral Knowledge weapon or tool is invalid.'; end if;
  v_state:=jsonb_build_object('skill',v_skill,'training',v_training,'configuredRestAt',v_latest);
  insert into public.character_runtime_feature_choices(character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,updated_at)
  values(p_character_id,'githyanki-astral-knowledge','Astral Knowledge','MPMM','long_rest',v_state,v_latest,now())
  on conflict(character_id,feature_key) do update set state=excluded.state,replacement_anchor_at=excluded.replacement_anchor_at,updated_at=now();
  perform private.set_species_runtime_projection_v1(p_character_id,'githyankiAstralKnowledge',v_state);
  return public.get_character_githyanki_astral_knowledge_v1(p_character_id);
end;
$$;

create or replace function private.expire_githyanki_astral_knowledge_after_long_rest_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.rest_type<>'long' then return new; end if;
  delete from public.character_runtime_feature_choices
  where character_id=new.character_id and feature_key='githyanki-astral-knowledge';
  perform private.set_species_runtime_projection_v1(new.character_id,'githyankiAstralKnowledge',null);
  return new;
end;
$$;

drop trigger if exists character_rest_log_expire_githyanki_astral_knowledge_v1 on public.character_rest_log;
create trigger character_rest_log_expire_githyanki_astral_knowledge_v1
after insert on public.character_rest_log
for each row execute function private.expire_githyanki_astral_knowledge_after_long_rest_v1();

create or replace function private.resolve_khoravar_skill_versatility_v1(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select value
  from jsonb_array_elements(private.khoravar_skill_versatility_options_v1())
  where value->>'key'=p_key
  limit 1;
$$;

create or replace function public.get_character_khoravar_skill_versatility_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_row public.character_runtime_feature_choices%rowtype;
  v_latest timestamptz;
  v_available boolean;
  v_can_replace boolean:=false;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to review Skill Versatility.' using errcode='42501'; end if;
  v_available:=private.character_has_species_source_v1(p_character_id,'Khoravar','MPMM');
  if not v_available then return jsonb_build_object('available',false); end if;
  select * into v_row from public.character_runtime_feature_choices where character_id=p_character_id and feature_key='khoravar-skill-versatility';
  v_latest:=private.species_runtime_latest_long_rest_v1(p_character_id);
  if found and v_latest is not null then v_can_replace:=v_latest>coalesce(v_row.replacement_anchor_at,'epoch'::timestamptz); end if;
  return jsonb_build_object(
    'available',true,
    'configured',found,
    'canConfigure',not found,
    'canReplace',found and v_can_replace,
    'latestLongRestAt',v_latest,
    'state',case when found then v_row.state else null end,
    'options',private.khoravar_skill_versatility_options_v1()
  );
end;
$$;

create or replace function public.configure_character_khoravar_skill_versatility_v1(
  p_character_id uuid,
  p_option_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_existing public.character_runtime_feature_choices%rowtype;
  v_latest timestamptz;
  v_option jsonb;
  v_anchor timestamptz;
  v_state jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to configure Skill Versatility.' using errcode='42501'; end if;
  if not private.character_has_species_source_v1(p_character_id,'Khoravar','MPMM') then raise exception 'Skill Versatility is unavailable for this character.'; end if;
  if private.species_runtime_active_encounter_v1(p_character_id) then raise exception 'Skill Versatility cannot be changed during an active encounter.'; end if;
  v_option:=private.resolve_khoravar_skill_versatility_v1(p_option_key);
  if v_option is null then raise exception 'The selected Skill Versatility proficiency is invalid.'; end if;
  select * into v_existing from public.character_runtime_feature_choices where character_id=p_character_id and feature_key='khoravar-skill-versatility' for update;
  v_latest:=private.species_runtime_latest_long_rest_v1(p_character_id);
  if found then
    if v_latest is null or v_latest<=coalesce(v_existing.replacement_anchor_at,'epoch'::timestamptz) then raise exception 'Finish a newer Long Rest before replacing Skill Versatility.'; end if;
    v_anchor:=v_latest;
  else
    v_anchor:=now();
  end if;
  v_state:=jsonb_build_object('proficiency',v_option,'configuredAt',now(),'configuredRestAt',case when found then v_latest else null end);
  insert into public.character_runtime_feature_choices(character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,updated_at)
  values(p_character_id,'khoravar-skill-versatility','Skill Versatility','MPMM','long_rest',v_state,v_anchor,now())
  on conflict(character_id,feature_key) do update set state=excluded.state,replacement_anchor_at=excluded.replacement_anchor_at,updated_at=now();
  perform private.set_species_runtime_projection_v1(p_character_id,'khoravarSkillVersatility',v_state);
  return public.get_character_khoravar_skill_versatility_v1(p_character_id);
end;
$$;

create or replace function private.materialize_player_forge_khoravar_skill_versatility_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_sheet jsonb;
  v_selection jsonb;
  v_key text;
  v_option jsonb;
  v_state jsonb;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=new.character_id;
  if coalesce(v_sheet #>> '{meta,creator}','')<>'shared_character_forge_player_v2' then return new; end if;
  if not private.character_has_species_source_v1(new.character_id,'Khoravar','MPMM') then return new; end if;
  v_selection:=v_sheet #> '{sourceChoices,species-runtime-khoravar-skill-versatility,fields,proficiency,selections}';
  if jsonb_typeof(v_selection)<>'array' or jsonb_array_length(v_selection)<>1 then raise exception 'Khoravar Skill Versatility requires exactly one skill or tool proficiency.'; end if;
  v_key:=v_selection->0->>'key';
  v_option:=private.resolve_khoravar_skill_versatility_v1(v_key);
  if v_option is null then raise exception 'Khoravar Skill Versatility references an invalid skill or tool.'; end if;
  v_state:=jsonb_build_object('proficiency',v_option,'configuredAt',now(),'configuredRestAt',null);
  insert into public.character_runtime_feature_choices(character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,updated_at)
  values(new.character_id,'khoravar-skill-versatility','Skill Versatility','MPMM','long_rest',v_state,now(),now())
  on conflict(character_id,feature_key) do update set state=excluded.state,replacement_anchor_at=excluded.replacement_anchor_at,updated_at=now();
  perform private.set_species_runtime_projection_v1(new.character_id,'khoravarSkillVersatility',v_state);
  return new;
end;
$$;

drop trigger if exists character_progression_materialize_player_forge_khoravar_skill_versatility_v1 on public.character_progression;
create constraint trigger character_progression_materialize_player_forge_khoravar_skill_versatility_v1
after insert on public.character_progression
deferrable initially deferred
for each row execute function private.materialize_player_forge_khoravar_skill_versatility_v1();

revoke all on function private.character_has_species_source_v1(uuid,text,text) from public;
revoke all on function private.species_runtime_latest_long_rest_v1(uuid) from public;
revoke all on function private.species_runtime_active_encounter_v1(uuid) from public;
revoke all on function private.githyanki_astral_knowledge_options_v1() from public;
revoke all on function private.khoravar_skill_versatility_options_v1() from public;
revoke all on function private.set_species_runtime_projection_v1(uuid,text,jsonb) from public;
revoke all on function private.expire_githyanki_astral_knowledge_after_long_rest_v1() from public;
revoke all on function private.resolve_khoravar_skill_versatility_v1(text) from public;
revoke all on function private.materialize_player_forge_khoravar_skill_versatility_v1() from public;

grant execute on function private.character_has_species_source_v1(uuid,text,text) to service_role;
grant execute on function private.species_runtime_latest_long_rest_v1(uuid) to service_role;
grant execute on function private.species_runtime_active_encounter_v1(uuid) to service_role;
grant execute on function private.githyanki_astral_knowledge_options_v1() to service_role;
grant execute on function private.khoravar_skill_versatility_options_v1() to service_role;
grant execute on function private.set_species_runtime_projection_v1(uuid,text,jsonb) to service_role;
grant execute on function private.expire_githyanki_astral_knowledge_after_long_rest_v1() to service_role;
grant execute on function private.resolve_khoravar_skill_versatility_v1(text) to service_role;
grant execute on function private.materialize_player_forge_khoravar_skill_versatility_v1() to service_role;

revoke all on function public.get_character_githyanki_astral_knowledge_v1(uuid) from public;
revoke all on function public.configure_character_githyanki_astral_knowledge_v1(uuid,text,uuid) from public;
revoke all on function public.get_character_khoravar_skill_versatility_v1(uuid) from public;
revoke all on function public.configure_character_khoravar_skill_versatility_v1(uuid,text) from public;
grant execute on function public.get_character_githyanki_astral_knowledge_v1(uuid) to authenticated,service_role;
grant execute on function public.configure_character_githyanki_astral_knowledge_v1(uuid,text,uuid) to authenticated,service_role;
grant execute on function public.get_character_khoravar_skill_versatility_v1(uuid) to authenticated,service_role;
grant execute on function public.configure_character_khoravar_skill_versatility_v1(uuid,text) to authenticated,service_role;
