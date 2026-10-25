-- Shadow-only boundary between authoritative equipment custody and common effects.
-- Caller MUST build candidate records using verified DB inventory/catalogue state.
-- NEVER accept browser-provided candidates as authoritative; this function
-- deliberately performs no character queries and changes no gameplay consumer.
create or replace function private.filter_rest_magic_effect_candidates_v1(
  p_candidates jsonb,
  p_rule_enabled boolean,
  p_selected_item_ids uuid[]
) returns jsonb
language plpgsql immutable security invoker
set search_path=pg_catalog,private
as $body$
declare
  c jsonb;
  v_id uuid;
  v_effect jsonb;
  v_active jsonb:='[]'::jsonb;
  v_suppressed jsonb:='[]'::jsonb;
  v_reason text;
begin
  if jsonb_typeof(p_candidates) is distinct from 'array'
    or jsonb_array_length(p_candidates)>128
    or p_rule_enabled is null
    or p_selected_item_ids is null
    or array_position(p_selected_item_ids,null) is not null
    or cardinality(p_selected_item_ids)>3
    or (select count(distinct id) from unnest(p_selected_item_ids) as u(id))
       <>cardinality(p_selected_item_ids)
  then
    raise exception 'Invalid trusted equipment eligibility inputs' using errcode='22023';
  end if;
  for c in select value from jsonb_array_elements(p_candidates) loop
    if jsonb_typeof(c) is distinct from 'object'
      or exists(select 1 from jsonb_object_keys(c) as k
        where k not in ('inventoryItemId','equipped','magic','effect'))
      or jsonb_typeof(c->'equipped') is distinct from 'boolean'
      or jsonb_typeof(c->'magic') is distinct from 'boolean'
      or jsonb_typeof(c->'effect') is distinct from 'object'
      or not (c ? 'inventoryItemId')
    then
      raise exception 'Candidate requires verified identity, state, and effect'
        using errcode='22023';
    end if;
    begin
      v_id:=(c->>'inventoryItemId')::uuid;
    exception when invalid_text_representation then
      raise exception 'Invalid candidate item identity' using errcode='22023';
    end;
    if v_id is null then
      raise exception 'Missing candidate item identity' using errcode='22023';
    end if;
    v_effect:=c->'effect';
    if c->>'equipped'='false' then v_reason:='not_equipped';
    elsif p_rule_enabled and c->>'magic'='true'
       and not (v_id=any(p_selected_item_ids)) then
      v_reason:='not_selected';
    else v_reason:=null;
    end if;
    if v_reason is null then
      v_active:=v_active||jsonb_build_array(v_effect);
    else
      v_suppressed:=v_suppressed||jsonb_build_array(
        jsonb_build_object('inventoryItemId',v_id,'reason',v_reason));
    end if;
  end loop;
  return jsonb_build_object('schemaVersion',1,'effects',v_active,
    'suppressed',v_suppressed,'ruleEnabled',p_rule_enabled,
    'consumerEnforced',false);
end;
$body$;
revoke all on function private.filter_rest_magic_effect_candidates_v1(jsonb,boolean,uuid[])
  from public,anon,authenticated;
grant execute on function private.filter_rest_magic_effect_candidates_v1(jsonb,boolean,uuid[])
  to service_role;
