-- EXACT live DnDWeb private.encounter_resolve_attack_roll_v1
-- Read-only source snapshot (2026-11-03), MD5 25af82e66a082a36e8105bad0187b271
-- PG17 disposable fixture only, NOT production migration.
CREATE OR REPLACE FUNCTION private.encounter_resolve_attack_roll_v1(p_attacker_id uuid, p_target_id uuid, p_base_disadvantage boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
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
$function$;
