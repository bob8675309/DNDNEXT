-- INERT shadow counterpart to existing structured equipped mitigation.
-- NO active encounter damage function is replaced; source and damage order stay
-- in legacy production code until explicit consumer-parity approval.
-- Prerequisites: 20261025_01, _02, _04 and legacy 20261016_07 helper.
-- OFF compares exactly to the legacy helper; ON gates structured mitigation
-- only via trusted character-scoped database inventory and selections.
-- Typed mitigation is provisionally classified as magical; reclassify true
-- physical / mundane structured mitigation before real consumer integration.
create or replace function private.encounter_attuned_damage_mitigation_shadow_v1(
  p_character_id uuid,
  p_damage_type text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_type text := lower(btrim(coalesce(p_damage_type, '')));
  v_inv record;
  v_catalog jsonb;
  v_payload jsonb;
  v_resistant boolean := false;
  v_flat_reduction integer := 0;
  v_reduction integer := 0;
  v_raw text;
  v_item_matches boolean;
  v_sources text[] := '{}'::text[];
  v_gate jsonb;
  v_baseline jsonb;
  v_shadow jsonb;
begin
  -- Exact current mitigation helper is unchanged. OFF is bit-for-bit parity.
  v_baseline := private.encounter_equipped_damage_mitigation_v1(p_character_id,p_damage_type);
  if p_character_id is null or v_type = '' then
    return jsonb_build_object('schemaVersion',1,'consumerEnforced',false,
      'attunementEnabled',false,'baseline',v_baseline,'shadow',v_baseline,'wouldChange',false);
  end if;
  -- Only trusted server state supplies character ownership and magic eligibility.
  v_gate := private.character_magic_effect_source_gate_shadow_v1(p_character_id);
  if v_gate->>'attunementEnabled'='false' then
    return jsonb_build_object('schemaVersion',1,'consumerEnforced',false,
      'attunementEnabled',false,'baseline',v_baseline,'shadow',v_baseline,'wouldChange',false);
  end if;
  if v_gate->>'attunementEnabled' is distinct from 'true' then
    raise exception 'Authoritative attunement state is unavailable' using errcode='22023';
  end if;

  for v_inv in
    select ii.*
    from public.inventory_items ii
    where ii.is_equipped is true
      and (
        (
          lower(coalesce(ii.owner_type, '')) in ('npc','merchant','character')
          and ii.owner_id = p_character_id::text
        )
        or (
          lower(coalesce(ii.owner_type, '')) = 'player'
          and exists (
            select 1
            from public.character_permissions cp
            where cp.character_id = p_character_id
              and cp.user_id::text = ii.owner_id
              and coalesce(cp.can_edit, false)
          )
        )
      )
      and exists (
        select 1
        from jsonb_array_elements(v_gate->'items') gate_item
        where gate_item->>'inventoryItemId'=ii.id::text
          and gate_item->>'magicRiderEligible'='true'
      )
  loop
    v_catalog := '{}'::jsonb;
    select ic.payload
    into v_catalog
    from public.items_catalog ic
    where ic.item_key = coalesce(
            v_inv.card_payload->>'item_key',
            v_inv.card_payload->>'item_id',
            v_inv.item_id
          )
       or ic.item_key = v_inv.item_id
       or lower(ic.item_name) = lower(v_inv.item_name)
    order by
      case
        when ic.item_key = coalesce(
          v_inv.card_payload->>'item_key',
          v_inv.card_payload->>'item_id',
          v_inv.item_id
        ) then 0
        when ic.item_key = v_inv.item_id then 1
        else 2
      end,
      case when coalesce(ic.payload->>'edition','') = 'one' then 0 else 1 end
    limit 1;

    v_item_matches := false;

    for v_payload in
      select value
      from jsonb_array_elements(
        jsonb_build_array(
          coalesce(v_catalog, '{}'::jsonb),
          coalesce(v_inv.card_payload, '{}'::jsonb)
        )
      )
    loop
      if jsonb_typeof(v_payload->'resist') = 'array'
         and exists (
           select 1
           from jsonb_array_elements_text(v_payload->'resist') r(value)
           where lower(btrim(r.value)) = v_type
         )
      then
        v_resistant := true;
        v_item_matches := true;
      elsif jsonb_typeof(v_payload->'resist') = 'string'
            and lower(btrim(v_payload->>'resist')) = v_type
      then
        v_resistant := true;
        v_item_matches := true;
      end if;

      v_raw := coalesce(
        v_payload->'damageReductionByType'->>v_type,
        v_payload->'damage_reduction_by_type'->>v_type
      );
      if coalesce(v_raw, '') ~ '^[0-9]+$' then
        v_reduction := greatest(0, v_raw::integer);
        if v_reduction > 0 then
          v_flat_reduction := greatest(v_flat_reduction, v_reduction);
          v_item_matches := true;
        end if;
      end if;
    end loop;

    if v_item_matches
       and nullif(btrim(coalesce(v_inv.item_name,'')), '') is not null
       and not (v_inv.item_name = any(v_sources))
    then
      v_sources := array_append(v_sources, v_inv.item_name);
    end if;
  end loop;

  v_shadow := jsonb_build_object(
    'resistant',v_resistant,
    'flatReduction',v_flat_reduction,
    'sources',to_jsonb(v_sources)
  );
  return jsonb_build_object(
    'schemaVersion',1,
    'consumerEnforced',false,
    'attunementEnabled',true,
    'baseline',v_baseline,
    'shadow',v_shadow,
    'wouldChange',v_baseline is distinct from v_shadow,
    'sourceGate',v_gate
  );
end;
$function$;

revoke all on function private.encounter_attuned_damage_mitigation_shadow_v1(uuid,text)
  from public, anon, authenticated;
grant execute on function private.encounter_attuned_damage_mitigation_shadow_v1(uuid,text)
  to service_role;
