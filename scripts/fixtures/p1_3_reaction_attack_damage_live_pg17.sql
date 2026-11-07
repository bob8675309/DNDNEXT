-- SELECT-only source snapshots of original DnDWeb internals (2026-11-03).
-- Execute ONLY inside disposable local PG17 CI with synthetic dependencies;
-- no live mutation or new direct public permissions are authorized.

-- private.encounter_has_timed_effect_v1 live pg_get_functiondef MD5 017c626c4147737161742daedceaa694
CREATE OR REPLACE FUNCTION private.encounter_has_timed_effect_v1(p_participant_id uuid, p_effect_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  select exists(
    select 1
    from public.encounter_timed_effects e
    where e.participant_id=p_participant_id
      and e.effect_key=lower(btrim(coalesce(p_effect_key,'')))
      and e.remaining_target_turn_starts>0
  );
$function$;


-- public.encounter_apply_damage_internal_v1 live pg_get_functiondef MD5 53afa5d760a7b6c1a4cc3f837bc7e067
CREATE OR REPLACE FUNCTION public.encounter_apply_damage_internal_v1(p_target_id uuid, p_amount integer, p_damage_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
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


-- public.encounter_opportunity_attack_internal_v1 live pg_get_functiondef MD5 276e5fd1c210b3e6f532b0819b87a62b
CREATE OR REPLACE FUNCTION public.encounter_opportunity_attack_internal_v1(p_reactor_id uuid, p_mover_id uuid, p_inventory_item_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_r public.encounter_participants%rowtype; v_m public.encounter_participants%rowtype; v_profile jsonb; v_context jsonb; v_snapshot jsonb; v_attack_roll jsonb; v_dist_ft integer; v_reach integer:=5; v_attack_bonus integer:=0; v_ability_mod integer:=0; v_magic_bonus integer:=0; v_dice_count integer:=1; v_die_size integer:=1; v_damage_type text:='bludgeoning'; v_weapon text:='Unarmed Strike'; v_roll integer; v_roll2 integer; v_total integer; v_hit boolean; v_crit boolean; v_base_disadvantage boolean:=false; v_disadvantage boolean:=false; v_advantage boolean:=false; v_i integer; v_damage_roll integer:=0; v_raw_damage integer:=0; v_damage jsonb; v_target_ac integer; v_result jsonb;
begin
  select * into v_r from public.encounter_participants where id=p_reactor_id for update; if not found then raise exception 'Reaction attacker not found'; end if; select * into v_m from public.encounter_participants where id=p_mover_id and encounter_id=v_r.encounter_id for update; if not found then raise exception 'Reaction target not found'; end if; if v_r.is_defeated then raise exception 'Defeated participant cannot react'; end if; if v_m.is_defeated then raise exception 'Target is already defeated'; end if; if not v_r.reaction_available then raise exception 'Reaction already spent'; end if; if private.encounter_has_timed_effect_v1(v_r.id,'opportunity_attack_suppressed') then raise exception 'Opportunity attacks are suppressed until this participant''s next turn starts'; end if; if not public.encounter_are_hostile_internal_v1(v_r.team,v_m.team) then raise exception 'Opportunity attack requires hostile participants'; end if;
  v_context:=public.encounter_targeting_context_internal_v1(v_r.id,v_m.id); if not coalesce((v_context->>'hasLineOfSight')::boolean,false) then raise exception 'Opportunity attack requires line of sight'; end if; v_dist_ft:=coalesce((v_context->>'distanceFt')::integer,9999);
  if p_inventory_item_id is not null then v_profile:=public.encounter_weapon_profile_internal_v1(v_r.id,p_inventory_item_id); if v_profile is null then raise exception 'Selected opportunity weapon is not equipped or unsupported'; end if; if coalesce((v_profile->>'isRanged')::boolean,false) then raise exception 'Opportunity attacks require a melee weapon or Unarmed Strike'; end if; v_reach:=coalesce((v_profile->>'reachFt')::integer,5); if v_dist_ft>v_reach then raise exception 'Target is beyond the selected weapon reach'; end if; v_weapon:=coalesce(v_profile->>'name','Weapon'); v_attack_bonus:=coalesce((v_profile->>'attackBonus')::integer,0); v_ability_mod:=coalesce((v_profile->>'abilityMod')::integer,0); v_magic_bonus:=coalesce((v_profile->>'magicBonus')::integer,0); v_damage_type:=coalesce(v_profile->>'damageType','untyped'); v_dice_count:=split_part(v_profile->>'damageDice','d',1)::integer; v_die_size:=split_part(v_profile->>'damageDice','d',2)::integer; else if v_dist_ft>5 then raise exception 'Unarmed Strike opportunity attack requires 5-foot reach'; end if; v_snapshot:=public.encounter_canonical_combat_snapshot_v1(v_r.character_id); v_ability_mod:=floor((coalesce((v_snapshot->>'str')::integer,10)-10)/2.0)::integer; v_attack_bonus:=v_ability_mod+coalesce((v_snapshot->>'prof')::integer,2); end if;
  v_target_ac:=coalesce(v_m.armor_class,10)+coalesce((v_context->>'coverAcBonus')::integer,0); v_base_disadvantage:=coalesce(v_m.dodging,false); v_attack_roll:=private.encounter_resolve_attack_roll_v1(v_r.id,v_m.id,v_base_disadvantage); v_roll:=coalesce((v_attack_roll->>'roll')::integer,1); v_roll2:=nullif(v_attack_roll->>'secondRoll','')::integer; v_advantage:=coalesce((v_attack_roll->>'advantage')::boolean,false); v_disadvantage:=coalesce((v_attack_roll->>'disadvantage')::boolean,false); v_total:=v_roll+v_attack_bonus; v_crit:=v_roll=20; v_hit:=case when v_roll=1 then false when v_crit then true else v_total>=v_target_ac end;
  if v_hit then if p_inventory_item_id is null then v_raw_damage:=greatest(0,1+v_ability_mod); else if v_crit then v_dice_count:=v_dice_count*2; end if; for v_i in 1..v_dice_count loop v_damage_roll:=v_damage_roll+floor(random()*v_die_size)::integer+1; end loop; v_raw_damage:=greatest(0,v_damage_roll+v_ability_mod+v_magic_bonus); end if; end if;
  v_damage:=public.encounter_apply_damage_internal_v1(v_m.id,v_raw_damage,v_damage_type); update public.encounter_participants set reaction_available=false,updated_at=timezone('utc',now()) where id=v_r.id; v_result:=jsonb_build_object('reactorId',v_r.id,'moverId',v_m.id,'weapon',v_weapon,'inventoryItemId',p_inventory_item_id,'distanceFt',v_dist_ft,'roll',v_roll,'secondRoll',v_roll2,'advantage',v_advantage,'disadvantage',v_disadvantage,'guidingBoltAdvantage',coalesce((v_attack_roll->>'guidingBoltAdvantage')::boolean,false),'guidingBoltEffectConsumed',coalesce((v_attack_roll->>'guidingBoltEffectConsumed')::boolean,false),'advantageCanceledByDisadvantage',coalesce((v_attack_roll->>'advantageCanceledByDisadvantage')::boolean,false),'attackBonus',v_attack_bonus,'total',v_total,'targetAc',v_target_ac,'hit',v_hit,'critical',v_crit,'rawDamage',v_raw_damage,'damageType',v_damage_type,'damage',v_damage,'attackRoll',v_attack_roll); return v_result;
end;$function$;
