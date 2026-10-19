-- DNDNext structured equipped-item damage mitigation.
-- 2026-10-16
--
-- This intentionally reads structured inventory/catalog fields only. It does
-- not scrape item prose. Equipped items can contribute:
--   payload.resist = ["fire", ...]
--   payload.damageReductionByType = { "fire": 10, ... }
--
-- Damage order remains server authoritative:
-- immunity -> flat reduction -> resistance -> vulnerability -> temp HP -> HP.

create or replace function private.encounter_equipped_damage_mitigation_v1(
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
begin
  if p_character_id is null or v_type = '' then
    return jsonb_build_object(
      'resistant', false,
      'flatReduction', 0,
      'sources', '[]'::jsonb
    );
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

  return jsonb_build_object(
    'resistant', v_resistant,
    'flatReduction', v_flat_reduction,
    'sources', to_jsonb(v_sources)
  );
end;
$function$;

revoke all on function private.encounter_equipped_damage_mitigation_v1(uuid,text)
  from public, anon, authenticated;
grant execute on function private.encounter_equipped_damage_mitigation_v1(uuid,text)
  to service_role;

create or replace function public.encounter_apply_damage_internal_v1(
  p_target_id uuid,
  p_amount integer,
  p_damage_type text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_t public.encounter_participants%rowtype;
  v_type text := lower(btrim(coalesce(p_damage_type,'untyped')));
  v_adjusted integer := greatest(0,coalesce(p_amount,0));
  v_after_flat integer := greatest(0,coalesce(p_amount,0));
  v_temp integer;
  v_hp integer;
  v_res boolean := false;
  v_imm boolean := false;
  v_vul boolean := false;
  v_equipment jsonb := '{}'::jsonb;
  v_equipment_res boolean := false;
  v_flat_reduction integer := 0;
  v_flat_applied integer := 0;
begin
  if p_amount is null or p_amount < 0 then
    raise exception 'Damage amount must be non-negative';
  end if;

  select *
  into v_t
  from public.encounter_participants
  where id = p_target_id
  for update;

  if not found then
    raise exception 'Damage target not found';
  end if;

  if v_t.character_id is not null then
    v_equipment := private.encounter_equipped_damage_mitigation_v1(v_t.character_id, v_type);
    v_equipment_res := coalesce((v_equipment->>'resistant')::boolean, false);
    v_flat_reduction := greatest(0, coalesce((v_equipment->>'flatReduction')::integer, 0));
  end if;

  v_res := v_type = any(coalesce(v_t.damage_resistances,'{}'::text[]))
           or v_equipment_res;
  v_imm := v_type = any(coalesce(v_t.damage_immunities,'{}'::text[]));
  v_vul := v_type = any(coalesce(v_t.damage_vulnerabilities,'{}'::text[]));

  if v_imm then
    v_adjusted := 0;
    v_after_flat := 0;
  else
    v_flat_applied := least(v_adjusted, v_flat_reduction);
    v_adjusted := greatest(0, v_adjusted - v_flat_reduction);
    v_after_flat := v_adjusted;

    if v_res then
      v_adjusted := floor(v_adjusted / 2.0)::integer;
    end if;
    if v_vul then
      v_adjusted := v_adjusted * 2;
    end if;
  end if;

  v_temp := coalesce(v_t.temp_hp,0);
  v_hp := coalesce(v_t.current_hp,1);

  if v_adjusted > 0 then
    if v_temp >= v_adjusted then
      v_temp := v_temp - v_adjusted;
    else
      v_hp := greatest(0, v_hp - (v_adjusted - v_temp));
      v_temp := 0;
    end if;
  end if;

  update public.encounter_participants
  set
    current_hp = v_hp,
    temp_hp = v_temp,
    is_defeated = (v_hp <= 0),
    updated_at = timezone('utc',now())
  where id = v_t.id;

  return jsonb_build_object(
    'targetId', v_t.id,
    'damageType', v_type,
    'rawDamage', p_amount,
    'flatReductionAvailable', v_flat_reduction,
    'flatReductionApplied', v_flat_applied,
    'damageAfterFlatReduction', v_after_flat,
    'equipmentResistance', v_equipment_res,
    'mitigationSources', coalesce(v_equipment->'sources','[]'::jsonb),
    'resistant', v_res,
    'immune', v_imm,
    'vulnerable', v_vul,
    'damage', v_adjusted,
    'targetHp', v_hp,
    'targetTempHp', v_temp,
    'defeated', v_hp <= 0
  );
end;
$function$;

revoke all on function public.encounter_apply_damage_internal_v1(uuid,integer,text)
  from public, anon, authenticated;
grant execute on function public.encounter_apply_damage_internal_v1(uuid,integer,text)
  to service_role;
