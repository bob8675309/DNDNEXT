-- Shadow adapter for selected numeric bonuses returned by the existing
-- authoritative character_equipment_effects_v1 result.
-- Does NOT query character data, alter existing equipment logic or write stats.
-- The caller MUST obtain p_equipment from its trusted DB equipment resolver and
-- supply server-derived event/skill/ability context; never raw client claims.
create or replace function private.normalize_equipment_bonus_effects_v1(
  p_equipment jsonb,
  p_context jsonb default '{}'::jsonb
) returns jsonb
language plpgsql immutable security invoker
set search_path=pg_catalog,private
as $adapter$
declare
  v_effects jsonb:='[]'::jsonb;
  v_num numeric;
  v_raw jsonb;
  v_kind text;
  v_ability text;
  v_skill text;
  v_target text;
  v_bonuses jsonb;
begin
  if jsonb_typeof(p_equipment) is distinct from 'object'
     or jsonb_typeof(p_context) is distinct from 'object'
     or p_equipment->>'schemaVersion' is distinct from '1' then
    raise exception 'Equipment numeric adapter needs a canonical schemaVersion 1 result.'
      using errcode='22023';
  end if;
  if exists (select 1 from jsonb_object_keys(p_context) k
       where k not in ('event','ability','skill')) then
    raise exception 'Unexpected equipment adapter event key.' using errcode='22023';
  end if;
  v_kind:=p_context->>'event';
  v_ability:=p_context->>'ability';
  v_skill:=p_context->>'skill';
  if v_kind not in ('saving_throw','ability_check','initiative') and v_kind is not null
     or v_ability is not null and v_ability not in ('str','dex','con','int','wis','cha')
     or v_skill is not null and v_skill not in ('athletics','acrobatics') then
    raise exception 'Unsupported equipment adapter event, skill or save ability.'
      using errcode='22023';
  end if;

  -- Original equipment resolver exposes numeric initiative bonus directly.
  -- Initiative does not use source class feature or tactical state here.
  if v_kind='initiative' then
    v_raw:=p_equipment->'initiative';
    if v_raw is not null and jsonb_typeof(v_raw) is distinct from 'number' then
      raise exception 'Equipment initiative bonus must be numeric.'
        using errcode='22023';
    end if;
    v_num:=coalesce((v_raw #>> '{}')::numeric,0);
    if v_num<>0 then
      v_effects:=v_effects||jsonb_build_array(jsonb_build_object(
        'id','equipment:initiative','source','equipment:authoritative',
        'stackKey','equipment:initiative:total',
        'target','initiative','op','add','value',v_num
      ));
    end if;
  end if;
  if v_kind='saving_throw' then
    if v_ability is null then
      raise exception 'A supported saving throw ability is required.' using errcode='22023';
    end if;
    if jsonb_typeof(p_equipment->'saves') is not null
       and jsonb_typeof(p_equipment->'saves') is distinct from 'object' then
      raise exception 'Equipment save-map must be a JSON object.' using errcode='22023';
    end if;
    for v_bonuses,v_target in
      select p_equipment,'all'
      union all
      select coalesce(p_equipment->'saves','{}'::jsonb),v_ability
    loop
      v_raw:=case when v_target='all' then v_bonuses->'savesAll'
                   else v_bonuses->v_target end;
      if v_raw is not null and jsonb_typeof(v_raw) is distinct from 'number' then
        raise exception 'Equipment save bonus must be numeric.'
          using errcode='22023';
      end if;
      v_num:=coalesce((v_raw #>> '{}')::numeric,0);
      if v_num<>0 then
        v_effects:=v_effects||jsonb_build_array(jsonb_build_object(
          'id','equipment:save:'||v_target,'source','equipment:authoritative',
          'stackKey','equipment:save:'||v_target,
          'target','saving_throw_bonus','op','add','value',v_num
        ));
      end if;
    end loop;
  end if;
  if v_kind='ability_check' then
    if v_skill is null then
      raise exception 'Athletics or Acrobatics is required for the first adapter.'
        using errcode='22023';
    end if;
    if jsonb_typeof(p_equipment->'skills') is not null
       and jsonb_typeof(p_equipment->'skills') is distinct from 'object' then
      raise exception 'Equipment skill-map must be a JSON object.' using errcode='22023';
    end if;
    v_target:=v_skill||'_check';
    for v_bonuses,v_ability in
      select p_equipment,'all'
      union all
      select coalesce(p_equipment->'skills','{}'::jsonb),v_skill
    loop
      v_raw:=case when v_ability='all' then v_bonuses->'skillsAll'
                   else v_bonuses->v_ability end;
      if v_raw is not null and jsonb_typeof(v_raw) is distinct from 'number' then
        raise exception 'Equipment skill bonus must be numeric.'
          using errcode='22023';
      end if;
      v_num:=coalesce((v_raw #>> '{}')::numeric,0);
      if v_num<>0 then
        v_effects:=v_effects||jsonb_build_array(jsonb_build_object(
          'id','equipment:skill:'||v_ability,'source','equipment:authoritative',
          'stackKey','equipment:skill:'||v_ability,
          'target',v_target,'op','add','value',v_num
        ));
      end if;
    end loop;
  end if;
  return v_effects;
end;
$adapter$;
revoke all on function private.normalize_equipment_bonus_effects_v1(jsonb,jsonb)
  from public,anon,authenticated;
grant execute on function private.normalize_equipment_bonus_effects_v1(jsonb,jsonb)
  to service_role;
