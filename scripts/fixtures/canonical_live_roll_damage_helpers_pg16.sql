-- ISOLATED PG16 TEST ONLY. Exact function bodies extracted from DNDNext's
-- ACTIVE SOURCE MIGRATIONS, not rewritten deterministic approximations.
-- Roll: sql/20260730_02_tactical_vicious_mockery.sql
-- Mitigation: sql/20261016_07_equipped_item_damage_mitigation.sql
-- Damage: sql/20261016_08_resistance_before_flat_reduction.sql
-- Cross-checked with read-only pg_get_functiondef() from production on
-- 2026-10-27. No migration is applied to the production database.
\set ON_ERROR_STOP on

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

CREATE OR REPLACE FUNCTION public.encounter_apply_damage_internal_v1(
  p_target_id uuid,
  p_amount integer,
  p_damage_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $function$
DECLARE
  v_t public.encounter_participants%rowtype;
  v_type text := lower(btrim(coalesce(p_damage_type,'untyped')));
  v_adjusted integer := greatest(0,coalesce(p_amount,0));
  v_after_resistance integer := greatest(0,coalesce(p_amount,0));
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
BEGIN
  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'Damage amount must be non-negative';
  END IF;

  SELECT *
  INTO v_t
  FROM public.encounter_participants
  WHERE id=p_target_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Damage target not found';
  END IF;

  IF v_t.character_id IS NOT NULL THEN
    v_equipment := private.encounter_equipped_damage_mitigation_v1(v_t.character_id,v_type);
    v_equipment_res := coalesce((v_equipment->>'resistant')::boolean,false);
    v_flat_reduction := greatest(0,coalesce((v_equipment->>'flatReduction')::integer,0));
  END IF;

  v_res := v_type=any(coalesce(v_t.damage_resistances,'{}'::text[]))
           OR v_equipment_res;
  v_imm := v_type=any(coalesce(v_t.damage_immunities,'{}'::text[]));
  v_vul := v_type=any(coalesce(v_t.damage_vulnerabilities,'{}'::text[]));

  IF v_imm THEN
    v_adjusted := 0;
    v_after_resistance := 0;
    v_after_flat := 0;
  ELSE
    -- DNDNext campaign order: Resistance first, then flat typed reduction.
    IF v_res THEN
      v_adjusted := floor(v_adjusted/2.0)::integer;
    END IF;
    v_after_resistance := v_adjusted;

    v_flat_applied := least(v_adjusted,v_flat_reduction);
    v_adjusted := greatest(0,v_adjusted-v_flat_reduction);
    v_after_flat := v_adjusted;

    IF v_vul THEN
      v_adjusted := v_adjusted*2;
    END IF;
  END IF;

  v_temp := coalesce(v_t.temp_hp,0);
  v_hp := coalesce(v_t.current_hp,1);

  IF v_adjusted > 0 THEN
    IF v_temp >= v_adjusted THEN
      v_temp := v_temp-v_adjusted;
    ELSE
      v_hp := greatest(0,v_hp-(v_adjusted-v_temp));
      v_temp := 0;
    END IF;
  END IF;

  UPDATE public.encounter_participants
  SET
    current_hp=v_hp,
    temp_hp=v_temp,
    is_defeated=(v_hp<=0),
    updated_at=timezone('utc',now())
  WHERE id=v_t.id;

  RETURN jsonb_build_object(
    'targetId',v_t.id,
    'damageType',v_type,
    'rawDamage',p_amount,
    'equipmentResistance',v_equipment_res,
    'damageAfterResistance',v_after_resistance,
    'flatReductionAvailable',v_flat_reduction,
    'flatReductionApplied',v_flat_applied,
    'damageAfterFlatReduction',v_after_flat,
    'mitigationSources',coalesce(v_equipment->'sources','[]'::jsonb),
    'resistant',v_res,
    'immune',v_imm,
    'vulnerable',v_vul,
    'damage',v_adjusted,
    'targetHp',v_hp,
    'targetTempHp',v_temp,
    'defeated',v_hp<=0
  );
END;
$function$;

create or replace function private.encounter_resolve_attack_roll_v1(
  p_attacker_id uuid,
  p_target_id uuid,
  p_base_disadvantage boolean default false
) returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $$
declare
  v_a public.encounter_participants%rowtype;
  v_t public.encounter_participants%rowtype;
  v_e public.encounters%rowtype;
  v_adv_fx public.encounter_timed_effects%rowtype;
  v_dis_fx public.encounter_timed_effects%rowtype;
  v_advantage boolean:=false;
  v_vicious_disadvantage boolean:=false;
  v_base_disadvantage boolean:=coalesce(p_base_disadvantage,false);
  v_any_disadvantage boolean:=false;
  v_effective_advantage boolean:=false;
  v_effective_disadvantage boolean:=false;
  v_canceled boolean:=false;
  v_roll1 integer;
  v_roll2 integer:=null;
  v_roll integer;
  v_adv_effect_id uuid:=null;
  v_adv_effect_source uuid:=null;
  v_dis_effect_id uuid:=null;
  v_dis_effect_source uuid:=null;
begin
  if p_attacker_id is null or p_target_id is null then raise exception 'Attack-roll attacker and target are required'; end if;
  select * into v_a from public.encounter_participants where id=p_attacker_id;
  if not found then raise exception 'Attack-roll attacker not found'; end if;
  select * into v_t from public.encounter_participants where id=p_target_id and encounter_id=v_a.encounter_id;
  if not found then raise exception 'Attack-roll target not found in this encounter'; end if;

  select * into v_adv_fx
  from public.encounter_timed_effects fx
  where fx.participant_id=v_t.id
    and fx.effect_key='guiding_bolt_next_attack_advantage'
    and fx.remaining_target_turn_starts>0
  order by fx.created_at,fx.id
  limit 1 for update;
  if found then
    v_advantage:=true;
    v_adv_effect_id:=v_adv_fx.id;
    v_adv_effect_source:=v_adv_fx.source_participant_id;
    delete from public.encounter_timed_effects where id=v_adv_fx.id;
  end if;

  select * into v_dis_fx
  from public.encounter_timed_effects fx
  where fx.participant_id=v_a.id
    and fx.effect_key='vicious_mockery_next_attack_disadvantage'
    and fx.remaining_target_turn_starts>0
  order by fx.created_at,fx.id
  limit 1 for update;
  if found then
    v_vicious_disadvantage:=true;
    v_dis_effect_id:=v_dis_fx.id;
    v_dis_effect_source:=v_dis_fx.source_participant_id;
    delete from public.encounter_timed_effects where id=v_dis_fx.id;
  end if;

  select * into v_e from public.encounters where id=v_t.encounter_id;
  if found and v_adv_effect_id is not null then
    insert into public.encounter_combat_log(
      encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail
    ) values(
      v_e.id,v_e.round,v_e.turn_index,v_adv_effect_source,v_t.id,'effect_consumed',
      'Guiding Bolt granted Advantage on the next attack roll against '||v_t.display_name||'.',
      jsonb_build_object(
        'effectId',v_adv_effect_id,'effectKey','guiding_bolt_next_attack_advantage',
        'sourceParticipantId',v_adv_effect_source,'attackerParticipantId',v_a.id,
        'targetParticipantId',v_t.id,'advantage',true,'consumed',true
      )
    );
  end if;
  if found and v_dis_effect_id is not null then
    insert into public.encounter_combat_log(
      encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail
    ) values(
      v_e.id,v_e.round,v_e.turn_index,v_dis_effect_source,v_a.id,'effect_consumed',
      'Vicious Mockery imposed Disadvantage on '||v_a.display_name||'''s next attack roll.',
      jsonb_build_object(
        'effectId',v_dis_effect_id,'effectKey','vicious_mockery_next_attack_disadvantage',
        'sourceParticipantId',v_dis_effect_source,'attackerParticipantId',v_a.id,
        'targetParticipantId',v_t.id,'disadvantage',true,'consumed',true
      )
    );
  end if;

  v_any_disadvantage:=v_base_disadvantage or v_vicious_disadvantage;
  v_canceled:=v_advantage and v_any_disadvantage;
  v_effective_advantage:=v_advantage and not v_any_disadvantage;
  v_effective_disadvantage:=v_any_disadvantage and not v_advantage;

  v_roll1:=floor(random()*20)::integer+1;
  if v_effective_advantage or v_effective_disadvantage then v_roll2:=floor(random()*20)::integer+1; end if;
  v_roll:=case
    when v_effective_advantage then greatest(v_roll1,v_roll2)
    when v_effective_disadvantage then least(v_roll1,v_roll2)
    else v_roll1
  end;

  return jsonb_build_object(
    'attackerId',v_a.id,'targetId',v_t.id,'roll',v_roll,'firstRoll',v_roll1,'secondRoll',v_roll2,
    'guidingBoltAdvantage',v_advantage,'viciousMockeryDisadvantage',v_vicious_disadvantage,
    'baseDisadvantage',v_base_disadvantage,'advantage',v_effective_advantage,
    'disadvantage',v_effective_disadvantage,'advantageCanceledByDisadvantage',v_canceled,
    'guidingBoltEffectConsumed',v_adv_effect_id is not null,'guidingBoltEffectId',v_adv_effect_id,
    'guidingBoltSourceId',v_adv_effect_source,'viciousMockeryEffectConsumed',v_dis_effect_id is not null,
    'viciousMockeryEffectId',v_dis_effect_id,'viciousMockerySourceId',v_dis_effect_source
  );
end;
$$;

revoke all on function private.encounter_equipped_damage_mitigation_v1(uuid,text) from public,anon,authenticated;
grant execute on function private.encounter_equipped_damage_mitigation_v1(uuid,text) to service_role;
revoke all on function public.encounter_apply_damage_internal_v1(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.encounter_apply_damage_internal_v1(uuid,integer,text) to service_role;
revoke all on function private.encounter_resolve_attack_roll_v1(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function private.encounter_resolve_attack_roll_v1(uuid,uuid,boolean) to service_role;
