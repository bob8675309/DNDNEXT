-- MPMM Eladrin runtime authority.
-- Season is an initial Player Forge state that persists until explicitly changed
-- after a newer Long Rest. Trance training is selected after a completed Long
-- Rest, grants two distinct PHB weapon/tool proficiencies, and expires when the
-- next Long Rest completes.

create or replace function private.eladrin_season_options_v1()
returns jsonb
language sql
immutable
security definer
set search_path=pg_catalog,public,private
as $$
  select jsonb_build_array(
    jsonb_build_object('key','autumn','label','Autumn','effect','After Fey Step at level 3+, nearby creatures can become Charmed.'),
    jsonb_build_object('key','winter','label','Winter','effect','Before Fey Step at level 3+, a nearby creature can become Frightened.'),
    jsonb_build_object('key','spring','label','Spring','effect','At level 3+, Fey Step can teleport a willing nearby creature instead of you.'),
    jsonb_build_object('key','summer','label','Summer','effect','After Fey Step at level 3+, nearby creatures of your choice take Fire damage equal to your Proficiency Bonus.')
  );
$$;

create or replace function private.resolve_eladrin_season_v1(p_key text)
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $$
  select value
  from jsonb_array_elements(private.eladrin_season_options_v1())
  where value->>'key'=lower(coalesce(p_key,''))
  limit 1;
$$;

create or replace function private.set_eladrin_season_projection_v1(p_character_id uuid,p_state jsonb)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_sheet jsonb:='{}'::jsonb;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets
  where character_id=p_character_id
  for update;
  if not found then return; end if;
  if coalesce(jsonb_typeof(v_sheet->'runtimeFeatures'),'')<>'object' then
    v_sheet:=jsonb_set(v_sheet,'{runtimeFeatures}','{}'::jsonb,true);
  end if;
  if p_state is null then
    v_sheet:=v_sheet #- array['runtimeFeatures','eladrinSeason'];
  else
    v_sheet:=jsonb_set(v_sheet,'{runtimeFeatures,eladrinSeason}',p_state,true);
  end if;
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
end;
$$;

create or replace function private.materialize_player_forge_eladrin_season_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_sheet jsonb:='{}'::jsonb;
  v_selection jsonb;
  v_key text;
  v_option jsonb;
  v_state jsonb;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets where character_id=new.character_id;
  if coalesce(v_sheet #>> '{meta,creator}','')<>'shared_character_forge_player_v2' then return new; end if;
  if not private.character_has_species_source_v1(new.character_id,'Eladrin','MPMM') then return new; end if;

  v_selection:=v_sheet #> '{sourceChoices,species-runtime-eladrin-season,fields,season,selections}';
  if jsonb_typeof(v_selection)<>'array' or jsonb_array_length(v_selection)<>1 then
    raise exception 'Eladrin requires exactly one current season during Player Forge creation.';
  end if;
  v_key:=lower(coalesce(v_selection->0->>'key',v_selection->0->>'value',''));
  v_option:=private.resolve_eladrin_season_v1(v_key);
  if v_option is null then raise exception 'Eladrin Player Forge references an invalid season.'; end if;

  v_state:=jsonb_build_object(
    'configured',true,
    'season',v_option,
    'configuredAt',timezone('utc',now()),
    'configuredRestAt',null,
    'initial',true
  );

  insert into public.character_runtime_feature_choices(
    character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at
  ) values(
    new.character_id,'eladrin-season','Eladrin Season','MPMM','long_rest',v_state,timezone('utc',now()),now(),now()
  ) on conflict(character_id,feature_key) do update set
    feature_name=excluded.feature_name,
    source=excluded.source,
    cadence=excluded.cadence,
    state=excluded.state,
    replacement_anchor_at=excluded.replacement_anchor_at,
    updated_at=now();

  perform private.set_eladrin_season_projection_v1(new.character_id,v_state);
  return new;
end;
$$;

drop trigger if exists character_progression_materialize_eladrin_season_v1 on public.character_progression;
create constraint trigger character_progression_materialize_eladrin_season_v1
after insert on public.character_progression
deferrable initially deferred
for each row execute function private.materialize_player_forge_eladrin_season_v1();

create or replace function public.get_character_eladrin_season_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_row public.character_runtime_feature_choices%rowtype;
  v_latest timestamptz;
  v_available boolean;
  v_can_replace boolean:=false;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to review Eladrin Season.' using errcode='42501';
  end if;
  v_available:=private.character_has_species_source_v1(p_character_id,'Eladrin','MPMM');
  if not v_available then return jsonb_build_object('available',false); end if;

  select * into v_row
  from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key='eladrin-season';
  v_latest:=private.species_runtime_latest_long_rest_v1(p_character_id);
  if found and v_latest is not null then
    v_can_replace:=v_latest>coalesce(v_row.replacement_anchor_at,'epoch'::timestamptz);
  end if;

  return jsonb_build_object(
    'available',true,
    'configured',found,
    'canConfigure',not found,
    'canReplace',found and v_can_replace,
    'latestLongRestAt',v_latest,
    'state',case when found then v_row.state else null end,
    'options',private.eladrin_season_options_v1(),
    'helper','Choose the Eladrin current season. It persists until you choose another season after a newer Long Rest; at character level 3+, it determines the extra Fey Step effect.'
  );
end;
$$;

create or replace function public.configure_character_eladrin_season_v1(p_character_id uuid,p_season_key text)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_existing public.character_runtime_feature_choices%rowtype;
  v_latest timestamptz;
  v_option jsonb;
  v_anchor timestamptz;
  v_state jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to configure Eladrin Season.' using errcode='42501';
  end if;
  if not private.character_has_species_source_v1(p_character_id,'Eladrin','MPMM') then
    raise exception 'Eladrin Season is unavailable for this character.';
  end if;
  if private.species_runtime_active_encounter_v1(p_character_id) then
    raise exception 'Eladrin Season cannot be changed during an active encounter.';
  end if;

  v_option:=private.resolve_eladrin_season_v1(p_season_key);
  if v_option is null then raise exception 'The selected Eladrin season is invalid.'; end if;

  select * into v_existing
  from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key='eladrin-season'
  for update;
  v_latest:=private.species_runtime_latest_long_rest_v1(p_character_id);

  if found then
    if v_existing.state #>> '{season,key}'=v_option->>'key' then
      raise exception 'Choose a different Eladrin season from the current season.';
    end if;
    if v_latest is null or v_latest<=coalesce(v_existing.replacement_anchor_at,'epoch'::timestamptz) then
      raise exception 'Finish a newer Long Rest before changing Eladrin Season.';
    end if;
    v_anchor:=v_latest;
  else
    v_anchor:=timezone('utc',now());
  end if;

  v_state:=jsonb_build_object(
    'configured',true,
    'season',v_option,
    'configuredAt',timezone('utc',now()),
    'configuredRestAt',case when found then v_latest else null end,
    'initial',not found
  );

  insert into public.character_runtime_feature_choices(
    character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at
  ) values(
    p_character_id,'eladrin-season','Eladrin Season','MPMM','long_rest',v_state,v_anchor,now(),now()
  ) on conflict(character_id,feature_key) do update set
    state=excluded.state,
    replacement_anchor_at=excluded.replacement_anchor_at,
    updated_at=now();

  perform private.set_eladrin_season_projection_v1(p_character_id,v_state);
  return public.get_character_eladrin_season_v1(p_character_id);
end;
$$;

create or replace function private.set_eladrin_trance_projection_v1(p_character_id uuid,p_state jsonb)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_sheet jsonb:='{}'::jsonb;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets
  where character_id=p_character_id
  for update;
  if not found then return; end if;
  if coalesce(jsonb_typeof(v_sheet->'runtimeProficiencies'),'')<>'object' then
    v_sheet:=jsonb_set(v_sheet,'{runtimeProficiencies}','{}'::jsonb,true);
  end if;
  if p_state is null then
    v_sheet:=v_sheet #- array['runtimeProficiencies','eladrinTrance'];
  else
    v_sheet:=jsonb_set(v_sheet,'{runtimeProficiencies,eladrinTrance}',p_state,true);
  end if;
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
end;
$$;

create or replace function public.get_character_eladrin_trance_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_row public.character_runtime_feature_choices%rowtype;
  v_latest timestamptz;
  v_available boolean;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to review Eladrin Trance training.' using errcode='42501';
  end if;
  v_available:=private.character_has_species_source_v1(p_character_id,'Eladrin','MPMM');
  if not v_available then return jsonb_build_object('available',false); end if;

  select * into v_row
  from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key='eladrin-trance-training';
  v_latest:=private.species_runtime_latest_long_rest_v1(p_character_id);

  return jsonb_build_object(
    'available',true,
    'configured',found,
    'canConfigure',not found and v_latest is not null,
    'latestLongRestAt',v_latest,
    'state',case when found then v_row.state else null end,
    'trainingOptions',private.astral_trance_training_options_v1(),
    'helper','After completing the Eladrin Trance/Long Rest, choose two different Player''s Handbook weapon or tool proficiencies. Both last until the next Long Rest.'
  );
end;
$$;

create or replace function public.configure_character_eladrin_trance_v1(
  p_character_id uuid,
  p_first_item_id uuid,
  p_second_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_existing public.character_runtime_feature_choices%rowtype;
  v_latest timestamptz;
  v_first jsonb;
  v_second jsonb;
  v_state jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to configure Eladrin Trance training.' using errcode='42501';
  end if;
  if not private.character_has_species_source_v1(p_character_id,'Eladrin','MPMM') then
    raise exception 'Eladrin Trance training is unavailable for this character.';
  end if;
  if private.species_runtime_active_encounter_v1(p_character_id) then
    raise exception 'Eladrin Trance training cannot be configured during an active encounter.';
  end if;
  if p_first_item_id=p_second_item_id then
    raise exception 'Choose two different Eladrin Trance proficiencies.';
  end if;

  select * into v_existing
  from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key='eladrin-trance-training'
  for update;
  if found then raise exception 'Eladrin Trance proficiencies are already configured for the current Long Rest.'; end if;

  v_latest:=private.species_runtime_latest_long_rest_v1(p_character_id);
  if v_latest is null then raise exception 'Finish a Long Rest before configuring Eladrin Trance proficiencies.'; end if;

  select value into v_first
  from jsonb_array_elements(private.astral_trance_training_options_v1())
  where value->>'itemId'=p_first_item_id::text limit 1;
  select value into v_second
  from jsonb_array_elements(private.astral_trance_training_options_v1())
  where value->>'itemId'=p_second_item_id::text limit 1;
  if v_first is null or v_second is null then
    raise exception 'One or more selected Eladrin Trance proficiencies are invalid.';
  end if;

  v_state:=jsonb_build_object(
    'configured',true,
    'trainings',jsonb_build_array(v_first,v_second),
    'configuredRestAt',v_latest,
    'configuredAt',timezone('utc',now())
  );

  insert into public.character_runtime_feature_choices(
    character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at
  ) values(
    p_character_id,'eladrin-trance-training','Eladrin Trance Training','MPMM','long_rest',v_state,v_latest,now(),now()
  );

  perform private.set_eladrin_trance_projection_v1(p_character_id,v_state);
  return public.get_character_eladrin_trance_v1(p_character_id);
end;
$$;

create or replace function private.expire_eladrin_trance_after_long_rest_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
begin
  if new.rest_type<>'long_rest' then return new; end if;
  delete from public.character_runtime_feature_choices
  where character_id=new.character_id and feature_key='eladrin-trance-training';
  perform private.set_eladrin_trance_projection_v1(new.character_id,null);
  return new;
end;
$$;

drop trigger if exists character_rest_log_expire_eladrin_trance_v1 on public.character_rest_log;
create trigger character_rest_log_expire_eladrin_trance_v1
after insert on public.character_rest_log
for each row execute function private.expire_eladrin_trance_after_long_rest_v1();

revoke all on function private.eladrin_season_options_v1() from public,anon,authenticated;
revoke all on function private.resolve_eladrin_season_v1(text) from public,anon,authenticated;
revoke all on function private.set_eladrin_season_projection_v1(uuid,jsonb) from public,anon,authenticated;
revoke all on function private.materialize_player_forge_eladrin_season_v1() from public,anon,authenticated;
revoke all on function private.set_eladrin_trance_projection_v1(uuid,jsonb) from public,anon,authenticated;
revoke all on function private.expire_eladrin_trance_after_long_rest_v1() from public,anon,authenticated;
grant execute on function private.eladrin_season_options_v1() to service_role;
grant execute on function private.resolve_eladrin_season_v1(text) to service_role;
grant execute on function private.set_eladrin_season_projection_v1(uuid,jsonb) to service_role;
grant execute on function private.materialize_player_forge_eladrin_season_v1() to service_role;
grant execute on function private.set_eladrin_trance_projection_v1(uuid,jsonb) to service_role;
grant execute on function private.expire_eladrin_trance_after_long_rest_v1() to service_role;

revoke all on function public.get_character_eladrin_season_v1(uuid) from public,anon;
revoke all on function public.configure_character_eladrin_season_v1(uuid,text) from public,anon;
revoke all on function public.get_character_eladrin_trance_v1(uuid) from public,anon;
revoke all on function public.configure_character_eladrin_trance_v1(uuid,uuid,uuid) from public,anon;
grant execute on function public.get_character_eladrin_season_v1(uuid) to authenticated,service_role;
grant execute on function public.configure_character_eladrin_season_v1(uuid,text) to authenticated,service_role;
grant execute on function public.get_character_eladrin_trance_v1(uuid) to authenticated,service_role;
grant execute on function public.configure_character_eladrin_trance_v1(uuid,uuid,uuid) to authenticated,service_role;
