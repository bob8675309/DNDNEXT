-- Correct audit provenance for Boon of Energy Resistance configuration.
-- Migration 69 is applied immediately before this migration; no source behavior
-- changes here. Preserve whether runtime state existed before aggregate queries
-- overwrite PL/pgSQL's implicit FOUND flag.

create or replace function public.configure_character_boon_energy_resistance_v1(
  p_character_id uuid,
  p_instance_key text,
  p_damage_types text[]
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_grant public.character_option_grant_instances%rowtype;
  v_runtime public.character_runtime_feature_choices%rowtype;
  v_pair text[];
  v_feature_key text;
  v_latest_long_rest timestamptz;
  v_anchor timestamptz;
  v_names jsonb;
  v_state jsonb;
  v_existing text[]:='{}'::text[];
  v_active_encounter jsonb;
  v_had_runtime boolean:=false;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to configure Boon of Energy Resistance for this character.' using errcode='42501';
  end if;
  if nullif(btrim(coalesce(p_instance_key,'')),'') is null then
    raise exception 'Boon of Energy Resistance requires a feat instance.';
  end if;

  select * into v_grant from public.character_option_grant_instances gi
  where gi.character_id=p_character_id and gi.instance_key=p_instance_key
    and private.normalize_player_choice_name_v1(gi.option_name)=private.normalize_player_choice_name_v1('Boon of Energy Resistance')
    and upper(coalesce(gi.option_source,''))='XPHB'
  for update;
  if not found then raise exception 'The requested XPHB Boon of Energy Resistance instance is unavailable.'; end if;

  v_active_encounter:=private.character_active_encounter_v1(p_character_id);
  if v_active_encounter is not null then
    raise exception 'Boon of Energy Resistance cannot be changed while this character is in an active encounter.';
  end if;

  v_pair:=private.validate_boon_energy_resistance_pair_v1(p_damage_types);
  v_feature_key:=private.boon_energy_resistance_feature_key_v1(v_grant.instance_key);
  select * into v_runtime from public.character_runtime_feature_choices
  where character_id=p_character_id and feature_key=v_feature_key for update;
  v_had_runtime:=found and jsonb_typeof(v_runtime.state->'resistances')='array';

  if v_had_runtime then
    select coalesce(array_agg(value order by value),'{}'::text[]) into v_existing
    from jsonb_array_elements_text(v_runtime.state->'resistances') value;
    if v_existing=(select array_agg(x order by x) from unnest(v_pair) x) then
      return public.get_character_boon_energy_resistance_v1(p_character_id);
    end if;
    select max(completed_at) into v_latest_long_rest
    from public.character_rest_log
    where character_id=p_character_id and rest_type='long_rest';
    if v_latest_long_rest is null or v_latest_long_rest<=v_runtime.replacement_anchor_at then
      raise exception 'Finish a newer Long Rest before changing Boon of Energy Resistance.';
    end if;
    v_anchor:=v_latest_long_rest;
  else
    v_anchor:=now();
  end if;

  select jsonb_agg(entry.value->>'name' order by array_position(v_pair,entry.value->>'key')) into v_names
  from jsonb_array_elements(private.boon_energy_resistance_options_v1()) entry(value)
  where entry.value->>'key'=any(v_pair);

  v_state:=jsonb_build_object(
    'configured',true,
    'instanceKey',v_grant.instance_key,
    'optionId',v_grant.option_id,
    'resistances',to_jsonb(v_pair),
    'resistanceNames',coalesce(v_names,'[]'::jsonb),
    'configuredAt',timezone('utc',now()),
    'configuredBy',case when v_had_runtime then 'long_rest_replacement' else 'legacy_initial_configuration' end,
    'previousResistances',case when v_had_runtime then coalesce(v_runtime.state->'resistances','[]'::jsonb) else '[]'::jsonb end
  );

  insert into public.character_runtime_feature_choices(
    character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at
  ) values(
    p_character_id,v_feature_key,'Boon of Energy Resistance','XPHB','long_rest',v_state,v_anchor,now(),now()
  ) on conflict(character_id,feature_key) do update set
    feature_name=excluded.feature_name,
    source=excluded.source,
    cadence=excluded.cadence,
    state=excluded.state,
    replacement_anchor_at=excluded.replacement_anchor_at,
    updated_at=now();

  perform private.sync_boon_energy_resistance_projection_v1(p_character_id);
  return public.get_character_boon_energy_resistance_v1(p_character_id);
end;
$$;

revoke all on function public.configure_character_boon_energy_resistance_v1(uuid,text,text[]) from public,anon;
grant execute on function public.configure_character_boon_energy_resistance_v1(uuid,text,text[]) to authenticated,service_role;
