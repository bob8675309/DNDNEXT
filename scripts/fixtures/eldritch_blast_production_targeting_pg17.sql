-- Read-only snapshot of LIVE DNDNext targeting/attack-roll function definitions (2026-10-30).
-- TEST FIXTURE ONLY: never apply to production. All underlying tables are synthetic.
CREATE OR REPLACE FUNCTION public.encounter_are_hostile_internal_v1(p_left_team text, p_right_team text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  select case
    when lower(coalesce(p_left_team,''))='enemies' and lower(coalesce(p_right_team,'')) in ('players','allies') then true
    when lower(coalesce(p_right_team,''))='enemies' and lower(coalesce(p_left_team,'')) in ('players','allies') then true
    else false
  end;
$function$;

CREATE OR REPLACE FUNCTION public.encounter_hex_line_internal_v1(p_q1 integer, p_r1 integer, p_q2 integer, p_r2 integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_n integer := greatest(abs(p_q2-p_q1),abs(p_r2-p_r1),abs((p_q2-p_q1)+(p_r2-p_r1)));
  v_i integer;
  v_t double precision;
  v_x double precision; v_y double precision; v_z double precision;
  v_rx integer; v_ry integer; v_rz integer;
  v_dx double precision; v_dy double precision; v_dz double precision;
  v_result jsonb := '[]'::jsonb;
  v_last_q integer := null; v_last_r integer := null;
begin
  if v_n=0 then return jsonb_build_array(jsonb_build_object('q',p_q1,'r',p_r1)); end if;
  for v_i in 0..v_n loop
    v_t := v_i::double precision / v_n::double precision;
    v_x := p_q1 + (p_q2-p_q1)*v_t;
    v_z := p_r1 + (p_r2-p_r1)*v_t;
    v_y := -v_x-v_z;
    v_rx := round(v_x)::integer; v_ry := round(v_y)::integer; v_rz := round(v_z)::integer;
    v_dx := abs(v_rx-v_x); v_dy := abs(v_ry-v_y); v_dz := abs(v_rz-v_z);
    if v_dx>=v_dy and v_dx>=v_dz then v_rx := -v_ry-v_rz;
    elsif v_dy>=v_dz then v_ry := -v_rx-v_rz;
    else v_rz := -v_rx-v_ry; end if;
    if v_last_q is distinct from v_rx or v_last_r is distinct from v_rz then
      v_result := v_result || jsonb_build_array(jsonb_build_object('q',v_rx,'r',v_rz));
      v_last_q := v_rx; v_last_r := v_rz;
    end if;
  end loop;
  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION public.encounter_targeting_context_internal_v1(p_attacker_id uuid, p_target_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_a public.encounter_participants%rowtype;
  v_t public.encounter_participants%rowtype;
  v_e public.encounters%rowtype;
  v_line jsonb;
  v_cell jsonb;
  v_index integer := 0;
  v_q integer; v_r integer;
  v_cover_rank integer := 0;
  v_cover text := 'none';
  v_blocked boolean := false;
  v_block_object uuid := null;
  v_block_q integer := null; v_block_r integer := null;
  v_obj record;
  v_dist_hex integer;
begin
  select * into v_a from public.encounter_participants where id=p_attacker_id;
  if not found then raise exception 'Attacker not found'; end if;
  select * into v_t from public.encounter_participants where id=p_target_id and encounter_id=v_a.encounter_id;
  if not found then raise exception 'Target not found in this encounter'; end if;
  select * into v_e from public.encounters where id=v_a.encounter_id;
  if not found then raise exception 'Encounter not found'; end if;

  v_dist_hex := greatest(abs(v_t.q-v_a.q),abs(v_t.r-v_a.r),abs((v_t.q-v_a.q)+(v_t.r-v_a.r)));
  v_line := public.encounter_hex_line_internal_v1(v_a.q,v_a.r,v_t.q,v_t.r);

  for v_cell in select value from jsonb_array_elements(v_line) loop
    v_index := v_index+1;
    if v_index=1 then continue; end if;
    v_q := (v_cell->>'q')::integer; v_r := (v_cell->>'r')::integer;
    for v_obj in
      select id,blocks_los,cover_level from public.encounter_map_objects
      where map_id=v_e.map_id and q=v_q and r=v_r
      order by case cover_level when 'total' then 3 when 'three_quarters' then 2 when 'half' then 1 else 0 end desc, blocks_los desc, id
    loop
      if v_obj.blocks_los or v_obj.cover_level='total' then
        v_blocked:=true; v_block_object:=v_obj.id; v_block_q:=v_q; v_block_r:=v_r; exit;
      end if;
      if v_obj.cover_level='three_quarters' then v_cover_rank:=greatest(v_cover_rank,2);
      elsif v_obj.cover_level='half' then v_cover_rank:=greatest(v_cover_rank,1); end if;
    end loop;
    exit when v_blocked;
  end loop;

  if v_cover_rank=2 then v_cover:='three_quarters';
  elsif v_cover_rank=1 then v_cover:='half'; end if;

  return jsonb_build_object(
    'attackerId',v_a.id,'targetId',v_t.id,
    'distanceHex',v_dist_hex,'distanceFt',v_dist_hex*5,
    'line',v_line,'hasLineOfSight',not v_blocked,
    'coverLevel',case when v_blocked then 'total' else v_cover end,
    'coverAcBonus',case when v_blocked then 0 when v_cover='three_quarters' then 5 when v_cover='half' then 2 else 0 end,
    'dexSaveCoverBonus',case when v_blocked then 0 when v_cover='three_quarters' then 5 when v_cover='half' then 2 else 0 end,
    'blockingObjectId',v_block_object,
    'blockingHex',case when v_blocked then jsonb_build_object('q',v_block_q,'r',v_block_r) else null end
  );
end;
$function$;

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
