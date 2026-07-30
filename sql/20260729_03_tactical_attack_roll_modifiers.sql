-- Phase 1T foundation: shared one-shot attack-roll modifier resolution.
-- This slice is behavior-neutral until a guiding_bolt_next_attack_advantage effect exists.

create or replace function private.encounter_resolve_attack_roll_v1(
  p_attacker_id uuid,
  p_target_id uuid,
  p_base_disadvantage boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_a public.encounter_participants%rowtype;
  v_t public.encounter_participants%rowtype;
  v_e public.encounters%rowtype;
  v_fx public.encounter_timed_effects%rowtype;
  v_advantage boolean:=false;
  v_base_disadvantage boolean:=coalesce(p_base_disadvantage,false);
  v_effective_advantage boolean:=false;
  v_effective_disadvantage boolean:=false;
  v_canceled boolean:=false;
  v_roll1 integer;
  v_roll2 integer:=null;
  v_roll integer;
  v_effect_id uuid:=null;
  v_effect_source uuid:=null;
begin
  if p_attacker_id is null or p_target_id is null then
    raise exception 'Attack-roll attacker and target are required';
  end if;

  select * into v_a
  from public.encounter_participants
  where id=p_attacker_id;
  if not found then raise exception 'Attack-roll attacker not found'; end if;

  select * into v_t
  from public.encounter_participants
  where id=p_target_id and encounter_id=v_a.encounter_id;
  if not found then raise exception 'Attack-roll target not found in this encounter'; end if;

  select * into v_fx
  from public.encounter_timed_effects fx
  where fx.participant_id=v_t.id
    and fx.effect_key='guiding_bolt_next_attack_advantage'
    and fx.remaining_target_turn_starts>0
  order by fx.created_at,fx.id
  limit 1
  for update;

  if found then
    v_advantage:=true;
    v_effect_id:=v_fx.id;
    v_effect_source:=v_fx.source_participant_id;

    delete from public.encounter_timed_effects
    where id=v_fx.id;

    select * into v_e
    from public.encounters
    where id=v_t.encounter_id;

    if found then
      insert into public.encounter_combat_log(
        encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail
      ) values (
        v_e.id,v_e.round,v_e.turn_index,v_effect_source,v_t.id,'effect_consumed',
        'Guiding Bolt granted Advantage on the next attack roll against '||v_t.display_name||'.',
        jsonb_build_object(
          'effectId',v_effect_id,
          'effectKey','guiding_bolt_next_attack_advantage',
          'sourceParticipantId',v_effect_source,
          'attackerParticipantId',v_a.id,
          'targetParticipantId',v_t.id,
          'advantage',true,
          'baseDisadvantage',v_base_disadvantage,
          'consumed',true
        )
      );
    end if;
  end if;

  v_canceled:=v_advantage and v_base_disadvantage;
  v_effective_advantage:=v_advantage and not v_base_disadvantage;
  v_effective_disadvantage:=v_base_disadvantage and not v_advantage;

  v_roll1:=floor(random()*20)::integer+1;
  if v_effective_advantage or v_effective_disadvantage then
    v_roll2:=floor(random()*20)::integer+1;
  end if;

  v_roll:=case
    when v_effective_advantage then greatest(v_roll1,v_roll2)
    when v_effective_disadvantage then least(v_roll1,v_roll2)
    else v_roll1
  end;

  return jsonb_build_object(
    'attackerId',v_a.id,
    'targetId',v_t.id,
    'roll',v_roll,
    'firstRoll',v_roll1,
    'secondRoll',v_roll2,
    'guidingBoltAdvantage',v_advantage,
    'baseDisadvantage',v_base_disadvantage,
    'advantage',v_effective_advantage,
    'disadvantage',v_effective_disadvantage,
    'advantageCanceledByDisadvantage',v_canceled,
    'guidingBoltEffectConsumed',v_effect_id is not null,
    'guidingBoltEffectId',v_effect_id,
    'guidingBoltSourceId',v_effect_source
  );
end;
$function$;

revoke all on function private.encounter_resolve_attack_roll_v1(uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function private.encounter_resolve_attack_roll_v1(uuid,uuid,boolean) to service_role;

create or replace function public.encounter_weapon_attack_v1(
  p_attacker_id uuid,p_target_id uuid,p_inventory_item_id uuid,p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_uid uuid:=auth.uid(); v_role text:=coalesce(auth.role(),'');
  v_a public.encounter_participants%rowtype; v_t public.encounter_participants%rowtype; v_e public.encounters%rowtype;
  v_existing public.encounter_command_requests%rowtype; v_profile jsonb; v_targeting jsonb; v_damage_result jsonb; v_attack_roll jsonb;
  v_inserted integer:=0; v_dist_ft integer; v_reach integer; v_normal integer; v_long integer;
  v_is_ranged boolean; v_is_thrown boolean; v_long_disadvantage boolean:=false; v_base_disadvantage boolean:=false; v_disadvantage boolean:=false; v_advantage boolean:=false;
  v_roll integer; v_roll2 integer; v_total integer; v_target_ac integer; v_hit boolean; v_crit boolean;
  v_dice_count integer; v_die_size integer; v_i integer; v_damage_roll integer:=0; v_raw_damage integer:=0; v_ability_mod integer; v_magic_bonus integer;
  v_result jsonb;
begin
  if p_attacker_id is null or p_target_id is null or p_inventory_item_id is null or p_request_id is null then raise exception 'Attacker, target, equipped weapon and request id are required'; end if;
  if p_attacker_id=p_target_id then raise exception 'Attacker and target must differ'; end if;
  insert into public.encounter_command_requests(request_id,encounter_id,participant_id,command_type,requested_by)
  select p_request_id,p.encounter_id,p.id,'weapon_attack',v_uid from public.encounter_participants p where p.id=p_attacker_id on conflict(request_id) do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then select * into v_existing from public.encounter_command_requests where request_id=p_request_id; if not found or v_existing.command_type<>'weapon_attack' or v_existing.participant_id<>p_attacker_id then raise exception 'Request id is already used for another command'; end if; return coalesce(v_existing.result,jsonb_build_object('duplicate',true,'pending',true)); end if;
  select * into v_a from public.encounter_participants where id=p_attacker_id for update; if not found then raise exception 'Attacker not found'; end if;
  select * into v_t from public.encounter_participants where id=p_target_id and encounter_id=v_a.encounter_id for update; if not found then raise exception 'Target not found in this encounter'; end if;
  select * into v_e from public.encounters where id=v_a.encounter_id for update; if not found then raise exception 'Encounter not found'; end if;
  if v_e.status<>'active' or v_e.active_participant_id is distinct from v_a.id then raise exception 'It is not this participant''s active turn'; end if;
  if v_role<>'service_role' and not public.encounter_can_control_participant_v1(v_a.id) then raise exception 'Not authorized to control this participant'; end if;
  if v_a.is_defeated then raise exception 'Defeated participants cannot attack'; end if;
  if v_t.is_defeated then raise exception 'Target is already defeated'; end if;
  if not v_a.action_available then raise exception 'Action already spent'; end if;
  v_profile:=public.encounter_weapon_profile_internal_v1(v_a.id,p_inventory_item_id);
  if v_profile is null then raise exception 'Selected weapon is not currently equipped or has no supported canonical attack profile'; end if;
  v_targeting:=public.encounter_targeting_context_internal_v1(v_a.id,v_t.id);
  if not coalesce((v_targeting->>'hasLineOfSight')::boolean,false) then raise exception 'Target is blocked by total cover or line-of-sight obstruction'; end if;
  v_dist_ft:=coalesce((v_targeting->>'distanceFt')::integer,0);
  v_reach:=coalesce((v_profile->>'reachFt')::integer,5); v_normal:=coalesce((v_profile->>'normalRangeFt')::integer,v_reach); v_long:=coalesce((v_profile->>'longRangeFt')::integer,v_normal);
  v_is_ranged:=coalesce((v_profile->>'isRanged')::boolean,false); v_is_thrown:=coalesce((v_profile->>'isThrown')::boolean,false);
  if v_is_ranged then if v_dist_ft>v_long then raise exception 'Target is beyond the weapon''s long range'; end if; v_long_disadvantage:=v_dist_ft>v_normal;
  elsif v_dist_ft<=v_reach then v_long_disadvantage:=false;
  elsif v_is_thrown then if v_dist_ft>v_long then raise exception 'Target is beyond the thrown weapon''s long range'; end if; v_long_disadvantage:=v_dist_ft>v_normal;
  else raise exception 'Target is beyond this weapon''s reach'; end if;

  v_base_disadvantage:=coalesce(v_t.dodging,false) or v_long_disadvantage;
  v_attack_roll:=private.encounter_resolve_attack_roll_v1(v_a.id,v_t.id,v_base_disadvantage);
  v_roll:=coalesce((v_attack_roll->>'roll')::integer,1);
  v_roll2:=nullif(v_attack_roll->>'secondRoll','')::integer;
  v_advantage:=coalesce((v_attack_roll->>'advantage')::boolean,false);
  v_disadvantage:=coalesce((v_attack_roll->>'disadvantage')::boolean,false);

  v_total:=v_roll+coalesce((v_profile->>'attackBonus')::integer,0);
  v_target_ac:=coalesce(v_t.armor_class,10)+coalesce((v_targeting->>'coverAcBonus')::integer,0);
  v_crit:=v_roll=20; v_hit:=case when v_roll=1 then false when v_crit then true else v_total>=v_target_ac end;
  v_dice_count:=split_part(v_profile->>'damageDice','d',1)::integer; v_die_size:=split_part(v_profile->>'damageDice','d',2)::integer;
  if v_crit then v_dice_count:=v_dice_count*2; end if;
  if v_hit then
    for v_i in 1..v_dice_count loop v_damage_roll:=v_damage_roll+floor(random()*v_die_size)::integer+1; end loop;
    v_ability_mod:=coalesce((v_profile->>'abilityMod')::integer,0); v_magic_bonus:=coalesce((v_profile->>'magicBonus')::integer,0);
    v_raw_damage:=greatest(0,v_damage_roll+v_ability_mod+v_magic_bonus);
    v_damage_result:=public.encounter_apply_damage_internal_v1(v_t.id,v_raw_damage,v_profile->>'damageType');
  else
    v_damage_result:=jsonb_build_object('targetId',v_t.id,'damageType',v_profile->>'damageType','rawDamage',0,'resistant',false,'immune',false,'vulnerable',false,'damage',0,'targetHp',v_t.current_hp,'targetTempHp',v_t.temp_hp,'defeated',v_t.is_defeated);
  end if;
  update public.encounter_participants set action_available=false,updated_at=timezone('utc',now()) where id=v_a.id;
  v_result:=jsonb_build_object(
    'requestId',p_request_id,'attackerId',v_a.id,'targetId',v_t.id,'inventoryItemId',p_inventory_item_id,'weapon',v_profile->>'name','distanceFt',v_dist_ft,
    'roll',v_roll,'secondRoll',v_roll2,'advantage',v_advantage,'disadvantage',v_disadvantage,
    'guidingBoltAdvantage',coalesce((v_attack_roll->>'guidingBoltAdvantage')::boolean,false),
    'guidingBoltEffectConsumed',coalesce((v_attack_roll->>'guidingBoltEffectConsumed')::boolean,false),
    'advantageCanceledByDisadvantage',coalesce((v_attack_roll->>'advantageCanceledByDisadvantage')::boolean,false),
    'longRangeDisadvantage',v_long_disadvantage,'dodging',v_t.dodging,'attackBonus',(v_profile->>'attackBonus')::integer,'total',v_total,
    'baseTargetAc',coalesce(v_t.armor_class,10),'coverAcBonus',(v_targeting->>'coverAcBonus')::integer,'targetAc',v_target_ac,'coverLevel',v_targeting->>'coverLevel',
    'hit',v_hit,'critical',v_crit,'damageDice',v_profile->>'damageDice','damageRoll',v_damage_roll,'damageType',v_profile->>'damageType','rawDamage',v_raw_damage,
    'damage',(v_damage_result->>'damage')::integer,'resistant',(v_damage_result->>'resistant')::boolean,'immune',(v_damage_result->>'immune')::boolean,
    'vulnerable',(v_damage_result->>'vulnerable')::boolean,'targetHp',(v_damage_result->>'targetHp')::integer,'targetTempHp',(v_damage_result->>'targetTempHp')::integer,
    'defeated',(v_damage_result->>'defeated')::boolean,'targeting',v_targeting,'profile',v_profile,'attackRoll',v_attack_roll
  );
  insert into public.encounter_combat_log(encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail)
  values(v_e.id,v_e.round,v_e.turn_index,v_a.id,v_t.id,'weapon_attack',v_a.display_name||case when v_hit then ' hit ' else ' missed ' end||v_t.display_name||' with '||(v_profile->>'name')||'.',v_result);
  update public.encounters set version=version+1,updated_at=timezone('utc',now()) where id=v_e.id;
  update public.encounter_command_requests set result=v_result where request_id=p_request_id;
  return v_result;
end;
$function$;

create or replace function public.encounter_unarmed_strike_v1(p_attacker_id uuid,p_target_id uuid,p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_uid uuid:=auth.uid(); v_role text:=coalesce(auth.role(),''); v_a public.encounter_participants%rowtype; v_t public.encounter_participants%rowtype; v_e public.encounters%rowtype;
  v_existing public.encounter_command_requests%rowtype; v_inserted integer:=0; v_snap jsonb; v_targeting jsonb; v_damage_result jsonb; v_attack_roll jsonb;
  v_str integer; v_prof integer; v_mod integer; v_roll integer; v_roll2 integer; v_total integer; v_target_ac integer; v_hit boolean; v_crit boolean; v_raw_damage integer:=0; v_result jsonb;
  v_advantage boolean:=false; v_disadvantage boolean:=false; v_base_disadvantage boolean:=false;
begin
  if p_attacker_id is null or p_target_id is null or p_request_id is null then raise exception 'Attacker, target and request id are required'; end if;
  if p_attacker_id=p_target_id then raise exception 'Attacker and target must differ'; end if;
  insert into public.encounter_command_requests(request_id,encounter_id,participant_id,command_type,requested_by)
  select p_request_id,p.encounter_id,p.id,'attack',v_uid from public.encounter_participants p where p.id=p_attacker_id on conflict(request_id) do nothing; get diagnostics v_inserted=row_count;
  if v_inserted=0 then select * into v_existing from public.encounter_command_requests where request_id=p_request_id; if not found or v_existing.command_type<>'attack' or v_existing.participant_id<>p_attacker_id then raise exception 'Request id is already used for another command'; end if; return coalesce(v_existing.result,jsonb_build_object('duplicate',true,'pending',true)); end if;
  select * into v_a from public.encounter_participants where id=p_attacker_id for update; if not found then raise exception 'Attacker not found'; end if;
  select * into v_t from public.encounter_participants where id=p_target_id and encounter_id=v_a.encounter_id for update; if not found then raise exception 'Target not found in this encounter'; end if;
  select * into v_e from public.encounters where id=v_a.encounter_id for update; if not found then raise exception 'Encounter not found'; end if;
  if v_e.status<>'active' or v_e.active_participant_id is distinct from v_a.id then raise exception 'It is not this participant''s active turn'; end if;
  if v_role<>'service_role' and not public.encounter_can_control_participant_v1(v_a.id) then raise exception 'Not authorized to control this participant'; end if;
  if v_a.is_defeated or v_t.is_defeated then raise exception 'Defeated participants cannot attack or be attacked'; end if;
  if not v_a.action_available then raise exception 'Action already spent'; end if;
  v_targeting:=public.encounter_targeting_context_internal_v1(v_a.id,v_t.id);
  if not coalesce((v_targeting->>'hasLineOfSight')::boolean,false) then raise exception 'Target is blocked by total cover or line-of-sight obstruction'; end if;
  if coalesce((v_targeting->>'distanceFt')::integer,0)>5 then raise exception 'Unarmed Strike target must be within 5 feet'; end if;
  v_snap:=public.encounter_canonical_combat_snapshot_v1(v_a.character_id); v_str:=(v_snap->>'str')::integer; v_prof:=(v_snap->>'prof')::integer; v_mod:=floor((v_str-10)/2.0)::integer;

  v_base_disadvantage:=coalesce(v_t.dodging,false);
  v_attack_roll:=private.encounter_resolve_attack_roll_v1(v_a.id,v_t.id,v_base_disadvantage);
  v_roll:=coalesce((v_attack_roll->>'roll')::integer,1);
  v_roll2:=nullif(v_attack_roll->>'secondRoll','')::integer;
  v_advantage:=coalesce((v_attack_roll->>'advantage')::boolean,false);
  v_disadvantage:=coalesce((v_attack_roll->>'disadvantage')::boolean,false);
  v_total:=v_roll+v_mod+v_prof;

  v_target_ac:=coalesce(v_t.armor_class,10)+coalesce((v_targeting->>'coverAcBonus')::integer,0); v_crit:=v_roll=20; v_hit:=case when v_roll=1 then false when v_crit then true else v_total>=v_target_ac end;
  if v_hit then v_raw_damage:=greatest(0,1+v_mod); v_damage_result:=public.encounter_apply_damage_internal_v1(v_t.id,v_raw_damage,'bludgeoning');
  else v_damage_result:=jsonb_build_object('targetId',v_t.id,'damageType','bludgeoning','rawDamage',0,'resistant',false,'immune',false,'vulnerable',false,'damage',0,'targetHp',v_t.current_hp,'targetTempHp',v_t.temp_hp,'defeated',v_t.is_defeated); end if;
  update public.encounter_participants set action_available=false,updated_at=timezone('utc',now()) where id=v_a.id;
  v_result:=jsonb_build_object(
    'requestId',p_request_id,'attackerId',v_a.id,'targetId',v_t.id,'roll',v_roll,'secondRoll',v_roll2,
    'advantage',v_advantage,'disadvantage',v_disadvantage,'guidingBoltAdvantage',coalesce((v_attack_roll->>'guidingBoltAdvantage')::boolean,false),
    'guidingBoltEffectConsumed',coalesce((v_attack_roll->>'guidingBoltEffectConsumed')::boolean,false),
    'advantageCanceledByDisadvantage',coalesce((v_attack_roll->>'advantageCanceledByDisadvantage')::boolean,false),
    'attackBonus',v_mod+v_prof,'total',v_total,'baseTargetAc',coalesce(v_t.armor_class,10),'coverAcBonus',(v_targeting->>'coverAcBonus')::integer,
    'targetAc',v_target_ac,'coverLevel',v_targeting->>'coverLevel','dodging',v_t.dodging,'hit',v_hit,'critical',v_crit,'damageType','bludgeoning','rawDamage',v_raw_damage,
    'damage',(v_damage_result->>'damage')::integer,'resistant',(v_damage_result->>'resistant')::boolean,'immune',(v_damage_result->>'immune')::boolean,
    'vulnerable',(v_damage_result->>'vulnerable')::boolean,'targetHp',(v_damage_result->>'targetHp')::integer,'targetTempHp',(v_damage_result->>'targetTempHp')::integer,
    'defeated',(v_damage_result->>'defeated')::boolean,'targeting',v_targeting,'attackRoll',v_attack_roll
  );
  insert into public.encounter_combat_log(encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail)
  values(v_e.id,v_e.round,v_e.turn_index,v_a.id,v_t.id,'unarmed_strike',v_a.display_name||case when v_hit then ' hit ' else ' missed ' end||v_t.display_name||' with an Unarmed Strike.',v_result);
  update public.encounters set version=version+1,updated_at=timezone('utc',now()) where id=v_e.id;
  update public.encounter_command_requests set result=v_result where request_id=p_request_id;
  return v_result;
end;
$function$;

create or replace function public.encounter_opportunity_attack_internal_v1(
  p_reactor_id uuid,p_mover_id uuid,p_inventory_item_id uuid default null
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_r public.encounter_participants%rowtype;
  v_m public.encounter_participants%rowtype;
  v_profile jsonb;
  v_context jsonb;
  v_snapshot jsonb;
  v_attack_roll jsonb;
  v_dist_ft integer;
  v_reach integer:=5;
  v_attack_bonus integer:=0;
  v_ability_mod integer:=0;
  v_magic_bonus integer:=0;
  v_dice_count integer:=1;
  v_die_size integer:=1;
  v_damage_type text:='bludgeoning';
  v_weapon text:='Unarmed Strike';
  v_roll integer; v_roll2 integer; v_total integer;
  v_hit boolean; v_crit boolean; v_base_disadvantage boolean:=false; v_disadvantage boolean:=false; v_advantage boolean:=false;
  v_i integer; v_damage_roll integer:=0; v_raw_damage integer:=0;
  v_damage jsonb; v_target_ac integer; v_result jsonb;
begin
  select * into v_r from public.encounter_participants where id=p_reactor_id for update;
  if not found then raise exception 'Reaction attacker not found'; end if;
  select * into v_m from public.encounter_participants where id=p_mover_id and encounter_id=v_r.encounter_id for update;
  if not found then raise exception 'Reaction target not found'; end if;
  if v_r.is_defeated then raise exception 'Defeated participant cannot react'; end if;
  if v_m.is_defeated then raise exception 'Target is already defeated'; end if;
  if not v_r.reaction_available then raise exception 'Reaction already spent'; end if;
  if private.encounter_has_timed_effect_v1(v_r.id,'opportunity_attack_suppressed') then
    raise exception 'Opportunity attacks are suppressed until this participant''s next turn starts';
  end if;
  if not public.encounter_are_hostile_internal_v1(v_r.team,v_m.team) then raise exception 'Opportunity attack requires hostile participants'; end if;

  v_context:=public.encounter_targeting_context_internal_v1(v_r.id,v_m.id);
  if not coalesce((v_context->>'hasLineOfSight')::boolean,false) then raise exception 'Opportunity attack requires line of sight'; end if;
  v_dist_ft:=coalesce((v_context->>'distanceFt')::integer,9999);

  if p_inventory_item_id is not null then
    v_profile:=public.encounter_weapon_profile_internal_v1(v_r.id,p_inventory_item_id);
    if v_profile is null then raise exception 'Selected opportunity weapon is not equipped or unsupported'; end if;
    if coalesce((v_profile->>'isRanged')::boolean,false) then raise exception 'Opportunity attacks require a melee weapon or Unarmed Strike'; end if;
    v_reach:=coalesce((v_profile->>'reachFt')::integer,5);
    if v_dist_ft>v_reach then raise exception 'Target is beyond the selected weapon reach'; end if;
    v_weapon:=coalesce(v_profile->>'name','Weapon');
    v_attack_bonus:=coalesce((v_profile->>'attackBonus')::integer,0);
    v_ability_mod:=coalesce((v_profile->>'abilityMod')::integer,0);
    v_magic_bonus:=coalesce((v_profile->>'magicBonus')::integer,0);
    v_damage_type:=coalesce(v_profile->>'damageType','untyped');
    v_dice_count:=split_part(v_profile->>'damageDice','d',1)::integer;
    v_die_size:=split_part(v_profile->>'damageDice','d',2)::integer;
  else
    if v_dist_ft>5 then raise exception 'Unarmed Strike opportunity attack requires 5-foot reach'; end if;
    v_snapshot:=public.encounter_canonical_combat_snapshot_v1(v_r.character_id);
    v_ability_mod:=floor((coalesce((v_snapshot->>'str')::integer,10)-10)/2.0)::integer;
    v_attack_bonus:=v_ability_mod+coalesce((v_snapshot->>'prof')::integer,2);
  end if;

  v_target_ac:=coalesce(v_m.armor_class,10)+coalesce((v_context->>'coverAcBonus')::integer,0);
  v_base_disadvantage:=coalesce(v_m.dodging,false);
  v_attack_roll:=private.encounter_resolve_attack_roll_v1(v_r.id,v_m.id,v_base_disadvantage);
  v_roll:=coalesce((v_attack_roll->>'roll')::integer,1);
  v_roll2:=nullif(v_attack_roll->>'secondRoll','')::integer;
  v_advantage:=coalesce((v_attack_roll->>'advantage')::boolean,false);
  v_disadvantage:=coalesce((v_attack_roll->>'disadvantage')::boolean,false);
  v_total:=v_roll+v_attack_bonus;
  v_crit:=v_roll=20;
  v_hit:=case when v_roll=1 then false when v_crit then true else v_total>=v_target_ac end;
  if v_hit then
    if p_inventory_item_id is null then
      v_raw_damage:=greatest(0,1+v_ability_mod);
    else
      if v_crit then v_dice_count:=v_dice_count*2; end if;
      for v_i in 1..v_dice_count loop v_damage_roll:=v_damage_roll+floor(random()*v_die_size)::integer+1; end loop;
      v_raw_damage:=greatest(0,v_damage_roll+v_ability_mod+v_magic_bonus);
    end if;
  end if;
  v_damage:=public.encounter_apply_damage_internal_v1(v_m.id,v_raw_damage,v_damage_type);
  update public.encounter_participants set reaction_available=false,updated_at=timezone('utc',now()) where id=v_r.id;
  v_result:=jsonb_build_object(
    'reactorId',v_r.id,'moverId',v_m.id,'weapon',v_weapon,'inventoryItemId',p_inventory_item_id,
    'distanceFt',v_dist_ft,'roll',v_roll,'secondRoll',v_roll2,'advantage',v_advantage,'disadvantage',v_disadvantage,
    'guidingBoltAdvantage',coalesce((v_attack_roll->>'guidingBoltAdvantage')::boolean,false),
    'guidingBoltEffectConsumed',coalesce((v_attack_roll->>'guidingBoltEffectConsumed')::boolean,false),
    'advantageCanceledByDisadvantage',coalesce((v_attack_roll->>'advantageCanceledByDisadvantage')::boolean,false),
    'attackBonus',v_attack_bonus,'total',v_total,'targetAc',v_target_ac,'hit',v_hit,'critical',v_crit,
    'rawDamage',v_raw_damage,'damageType',v_damage_type,'damage',v_damage,'attackRoll',v_attack_roll
  );
  return v_result;
end;
$function$;

revoke all on function public.encounter_weapon_attack_v1(uuid,uuid,uuid,uuid) from public, anon;
grant execute on function public.encounter_weapon_attack_v1(uuid,uuid,uuid,uuid) to authenticated, service_role;
revoke all on function public.encounter_unarmed_strike_v1(uuid,uuid,uuid) from public, anon;
grant execute on function public.encounter_unarmed_strike_v1(uuid,uuid,uuid) to authenticated, service_role;
revoke all on function public.encounter_opportunity_attack_internal_v1(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.encounter_opportunity_attack_internal_v1(uuid,uuid,uuid) to service_role;

do $postconditions$
begin
  if has_function_privilege('authenticated','private.encounter_resolve_attack_roll_v1(uuid,uuid,boolean)','EXECUTE') then raise exception 'shared attack-roll helper must remain private'; end if;
  if has_function_privilege('anon','public.encounter_weapon_attack_v1(uuid,uuid,uuid,uuid)','EXECUTE') then raise exception 'anon must not make weapon attacks'; end if;
  if has_function_privilege('anon','public.encounter_unarmed_strike_v1(uuid,uuid,uuid)','EXECUTE') then raise exception 'anon must not make unarmed attacks'; end if;
  if has_function_privilege('authenticated','public.encounter_opportunity_attack_internal_v1(uuid,uuid,uuid)','EXECUTE') then raise exception 'opportunity attack helper must remain internal'; end if;
end;
$postconditions$;
