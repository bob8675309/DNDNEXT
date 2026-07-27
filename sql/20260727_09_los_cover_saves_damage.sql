begin;

alter table public.encounter_command_requests
  drop constraint if exists encounter_command_requests_command_type_check;
alter table public.encounter_command_requests
  add constraint encounter_command_requests_command_type_check
  check (command_type in ('move','end_turn','core_action','attack','weapon_attack','save'));

alter table public.encounter_participants
  add column if not exists damage_resistances text[] not null default '{}'::text[],
  add column if not exists damage_immunities text[] not null default '{}'::text[],
  add column if not exists damage_vulnerabilities text[] not null default '{}'::text[];

create or replace function public.encounter_hex_line_internal_v1(
  p_q1 integer,p_r1 integer,p_q2 integer,p_r2 integer
)
returns jsonb
language plpgsql
immutable
security definer
set search_path = pg_catalog, public, private, auth
as $function$
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
revoke all on function public.encounter_hex_line_internal_v1(integer,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.encounter_hex_line_internal_v1(integer,integer,integer,integer) to service_role;

create or replace function public.encounter_targeting_context_internal_v1(p_attacker_id uuid,p_target_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $function$
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
revoke all on function public.encounter_targeting_context_internal_v1(uuid,uuid) from public, anon, authenticated;
grant execute on function public.encounter_targeting_context_internal_v1(uuid,uuid) to service_role;

create or replace function public.encounter_targeting_context_v1(p_attacker_id uuid,p_target_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare v_role text:=coalesce(auth.role(),''); v_a public.encounter_participants%rowtype;
begin
  select * into v_a from public.encounter_participants where id=p_attacker_id;
  if not found then raise exception 'Attacker not found'; end if;
  if v_role<>'service_role' and not public.encounter_can_control_participant_v1(v_a.id) then raise exception 'Not authorized to inspect targeting from this participant'; end if;
  return public.encounter_targeting_context_internal_v1(p_attacker_id,p_target_id);
end;
$function$;
revoke all on function public.encounter_targeting_context_v1(uuid,uuid) from public, anon;
grant execute on function public.encounter_targeting_context_v1(uuid,uuid) to authenticated, service_role;

create or replace function public.encounter_saving_throw_profile_internal_v1(p_participant_id uuid,p_ability text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_p public.encounter_participants%rowtype;
  v_sheet jsonb := '{}'::jsonb;
  v_ability text := lower(coalesce(p_ability,''));
  v_score integer := 10;
  v_prof integer := 2;
  v_class_key text := '';
  v_saves text[] := '{}'::text[];
  v_proficient boolean := false;
  v_mod integer := 0;
begin
  if v_ability not in ('str','dex','con','int','wis','cha') then raise exception 'Invalid saving throw ability'; end if;
  select * into v_p from public.encounter_participants where id=p_participant_id;
  if not found then raise exception 'Participant not found'; end if;
  select cs.sheet into v_sheet from public.character_sheets cs where cs.character_id=v_p.character_id;
  v_sheet:=coalesce(v_sheet,'{}'::jsonb);
  begin v_score:=coalesce(nullif(v_sheet->'abilities'->v_ability->>'score','')::integer,10); exception when others then v_score:=10; end;
  begin v_prof:=coalesce(nullif(v_sheet->>'proficiencyBonus','')::integer,2); exception when others then v_prof:=2; end;
  v_class_key:=lower(coalesce(v_sheet#>>'{meta,classKey}',v_sheet->>'classKey',''));
  select coalesce(c.saving_throws,'{}'::text[]) into v_saves from public.class_catalog_preferred c where lower(c.class_key)=v_class_key limit 1;
  v_saves:=coalesce(v_saves,'{}'::text[]);
  v_proficient:=v_ability=any(v_saves);
  v_mod:=floor((v_score-10)/2.0)::integer + case when v_proficient then v_prof else 0 end;
  return jsonb_build_object('participantId',v_p.id,'ability',v_ability,'score',v_score,'abilityMod',floor((v_score-10)/2.0)::integer,'proficient',v_proficient,'proficiencyBonus',case when v_proficient then v_prof else 0 end,'saveBonus',v_mod);
end;
$function$;
revoke all on function public.encounter_saving_throw_profile_internal_v1(uuid,text) from public, anon, authenticated;
grant execute on function public.encounter_saving_throw_profile_internal_v1(uuid,text) to service_role;

create or replace function public.encounter_roll_save_v1(
  p_participant_id uuid,p_ability text,p_dc integer,p_request_id uuid,p_source_participant_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_uid uuid:=auth.uid(); v_role text:=coalesce(auth.role(),'');
  v_p public.encounter_participants%rowtype; v_e public.encounters%rowtype;
  v_existing public.encounter_command_requests%rowtype; v_inserted integer:=0;
  v_profile jsonb; v_context jsonb:=null; v_cover integer:=0;
  v_roll integer; v_total integer; v_result jsonb;
begin
  if p_participant_id is null or p_request_id is null then raise exception 'Participant and request id are required'; end if;
  if p_dc<1 or p_dc>40 then raise exception 'Save DC must be between 1 and 40'; end if;
  select * into v_p from public.encounter_participants where id=p_participant_id;
  if not found then raise exception 'Participant not found'; end if;
  select * into v_e from public.encounters where id=v_p.encounter_id;
  if not found or v_e.status not in ('active','paused') then raise exception 'Encounter is not available for saving throws'; end if;
  if v_role<>'service_role' and not public.encounter_can_control_participant_v1(v_p.id) then raise exception 'Not authorized to roll this participant''s save'; end if;

  insert into public.encounter_command_requests(request_id,encounter_id,participant_id,command_type,requested_by)
  values(p_request_id,v_p.encounter_id,v_p.id,'save',v_uid) on conflict(request_id) do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then
    select * into v_existing from public.encounter_command_requests where request_id=p_request_id;
    if not found or v_existing.command_type<>'save' or v_existing.participant_id<>v_p.id then raise exception 'Request id is already used for another command'; end if;
    return coalesce(v_existing.result,jsonb_build_object('duplicate',true,'pending',true));
  end if;

  v_profile:=public.encounter_saving_throw_profile_internal_v1(v_p.id,p_ability);
  if p_source_participant_id is not null then
    if not exists(select 1 from public.encounter_participants s where s.id=p_source_participant_id and s.encounter_id=v_p.encounter_id) then raise exception 'Save source is not in this encounter'; end if;
    v_context:=public.encounter_targeting_context_internal_v1(p_source_participant_id,v_p.id);
    if lower(p_ability)='dex' and coalesce((v_context->>'hasLineOfSight')::boolean,false) then v_cover:=coalesce((v_context->>'dexSaveCoverBonus')::integer,0); end if;
  end if;
  v_roll:=floor(random()*20)::integer+1;
  v_total:=v_roll+coalesce((v_profile->>'saveBonus')::integer,0)+v_cover;
  v_result:=jsonb_build_object('requestId',p_request_id,'participantId',v_p.id,'ability',lower(p_ability),'dc',p_dc,'roll',v_roll,'saveBonus',(v_profile->>'saveBonus')::integer,'coverBonus',v_cover,'total',v_total,'success',v_total>=p_dc,'profile',v_profile,'sourceParticipantId',p_source_participant_id,'targeting',v_context);
  insert into public.encounter_combat_log(encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail)
  values(v_e.id,v_e.round,v_e.turn_index,p_source_participant_id,v_p.id,'saving_throw',v_p.display_name||' rolled a '||upper(lower(p_ability))||' save: '||v_total||' vs DC '||p_dc||'.',v_result);
  update public.encounter_command_requests set result=v_result where request_id=p_request_id;
  return v_result;
end;
$function$;
revoke all on function public.encounter_roll_save_v1(uuid,text,integer,uuid,uuid) from public, anon;
grant execute on function public.encounter_roll_save_v1(uuid,text,integer,uuid,uuid) to authenticated, service_role;

create or replace function public.admin_set_encounter_damage_affinities_v1(
  p_participant_id uuid,p_resistances text[] default '{}'::text[],p_immunities text[] default '{}'::text[],p_vulnerabilities text[] default '{}'::text[]
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_uid uuid:=auth.uid();
  v_allowed text[]:=array['acid','bludgeoning','cold','fire','force','lightning','necrotic','piercing','poison','psychic','radiant','slashing','thunder'];
  v_res text[]; v_imm text[]; v_vul text[];
begin
  if coalesce(auth.role(),'')<>'service_role' and (v_uid is null or not public.is_admin(v_uid)) then raise exception 'Admin required'; end if;
  if not exists(select 1 from public.encounter_participants where id=p_participant_id) then raise exception 'Participant not found'; end if;
  select coalesce(array_agg(distinct lower(btrim(x))) filter(where nullif(btrim(x),'') is not null),'{}'::text[]) into v_res from unnest(coalesce(p_resistances,'{}'::text[])) x;
  select coalesce(array_agg(distinct lower(btrim(x))) filter(where nullif(btrim(x),'') is not null),'{}'::text[]) into v_imm from unnest(coalesce(p_immunities,'{}'::text[])) x;
  select coalesce(array_agg(distinct lower(btrim(x))) filter(where nullif(btrim(x),'') is not null),'{}'::text[]) into v_vul from unnest(coalesce(p_vulnerabilities,'{}'::text[])) x;
  if exists(select 1 from unnest(v_res||v_imm||v_vul) x where not (x=any(v_allowed))) then raise exception 'Unsupported damage type in affinity list'; end if;
  update public.encounter_participants set damage_resistances=v_res,damage_immunities=v_imm,damage_vulnerabilities=v_vul,updated_at=timezone('utc',now()) where id=p_participant_id;
end;
$function$;
revoke all on function public.admin_set_encounter_damage_affinities_v1(uuid,text[],text[],text[]) from public, anon;
grant execute on function public.admin_set_encounter_damage_affinities_v1(uuid,text[],text[],text[]) to authenticated, service_role;

create or replace function public.encounter_apply_damage_internal_v1(p_target_id uuid,p_amount integer,p_damage_type text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_t public.encounter_participants%rowtype;
  v_type text:=lower(btrim(coalesce(p_damage_type,'untyped')));
  v_adjusted integer:=greatest(0,coalesce(p_amount,0));
  v_temp integer; v_hp integer;
  v_res boolean:=false; v_imm boolean:=false; v_vul boolean:=false;
begin
  if p_amount is null or p_amount<0 then raise exception 'Damage amount must be non-negative'; end if;
  select * into v_t from public.encounter_participants where id=p_target_id for update;
  if not found then raise exception 'Damage target not found'; end if;
  v_res:=v_type=any(coalesce(v_t.damage_resistances,'{}'::text[]));
  v_imm:=v_type=any(coalesce(v_t.damage_immunities,'{}'::text[]));
  v_vul:=v_type=any(coalesce(v_t.damage_vulnerabilities,'{}'::text[]));
  if v_imm then v_adjusted:=0;
  else
    if v_res then v_adjusted:=floor(v_adjusted/2.0)::integer; end if;
    if v_vul then v_adjusted:=v_adjusted*2; end if;
  end if;
  v_temp:=coalesce(v_t.temp_hp,0); v_hp:=coalesce(v_t.current_hp,1);
  if v_adjusted>0 then
    if v_temp>=v_adjusted then v_temp:=v_temp-v_adjusted;
    else v_hp:=greatest(0,v_hp-(v_adjusted-v_temp)); v_temp:=0; end if;
  end if;
  update public.encounter_participants set current_hp=v_hp,temp_hp=v_temp,is_defeated=(v_hp<=0),updated_at=timezone('utc',now()) where id=v_t.id;
  return jsonb_build_object('targetId',v_t.id,'damageType',v_type,'rawDamage',p_amount,'resistant',v_res,'immune',v_imm,'vulnerable',v_vul,'damage',v_adjusted,'targetHp',v_hp,'targetTempHp',v_temp,'defeated',v_hp<=0);
end;
$function$;
revoke all on function public.encounter_apply_damage_internal_v1(uuid,integer,text) from public, anon, authenticated;
grant execute on function public.encounter_apply_damage_internal_v1(uuid,integer,text) to service_role;

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
  v_existing public.encounter_command_requests%rowtype; v_profile jsonb; v_targeting jsonb; v_damage_result jsonb;
  v_inserted integer:=0; v_dist_ft integer; v_reach integer; v_normal integer; v_long integer;
  v_is_ranged boolean; v_is_thrown boolean; v_long_disadvantage boolean:=false; v_disadvantage boolean:=false;
  v_roll1 integer; v_roll2 integer; v_roll integer; v_total integer; v_target_ac integer; v_hit boolean; v_crit boolean;
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
  v_disadvantage:=v_t.dodging or v_long_disadvantage;
  v_roll1:=floor(random()*20)::integer+1; v_roll2:=floor(random()*20)::integer+1; v_roll:=case when v_disadvantage then least(v_roll1,v_roll2) else v_roll1 end;
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
  v_result:=jsonb_build_object('requestId',p_request_id,'attackerId',v_a.id,'targetId',v_t.id,'inventoryItemId',p_inventory_item_id,'weapon',v_profile->>'name','distanceFt',v_dist_ft,'roll',v_roll,'secondRoll',case when v_disadvantage then v_roll2 else null end,'disadvantage',v_disadvantage,'longRangeDisadvantage',v_long_disadvantage,'dodging',v_t.dodging,'attackBonus',(v_profile->>'attackBonus')::integer,'total',v_total,'baseTargetAc',coalesce(v_t.armor_class,10),'coverAcBonus',(v_targeting->>'coverAcBonus')::integer,'targetAc',v_target_ac,'coverLevel',v_targeting->>'coverLevel','hit',v_hit,'critical',v_crit,'damageDice',v_profile->>'damageDice','damageRoll',v_damage_roll,'damageType',v_profile->>'damageType','rawDamage',v_raw_damage,'damage',(v_damage_result->>'damage')::integer,'resistant',(v_damage_result->>'resistant')::boolean,'immune',(v_damage_result->>'immune')::boolean,'vulnerable',(v_damage_result->>'vulnerable')::boolean,'targetHp',(v_damage_result->>'targetHp')::integer,'targetTempHp',(v_damage_result->>'targetTempHp')::integer,'defeated',(v_damage_result->>'defeated')::boolean,'targeting',v_targeting,'profile',v_profile);
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
  v_existing public.encounter_command_requests%rowtype; v_inserted integer:=0; v_snap jsonb; v_targeting jsonb; v_damage_result jsonb;
  v_str integer; v_prof integer; v_mod integer; v_roll1 integer; v_roll2 integer; v_roll integer; v_total integer; v_target_ac integer; v_hit boolean; v_crit boolean; v_raw_damage integer:=0; v_result jsonb;
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
  v_roll1:=floor(random()*20)::integer+1; v_roll2:=floor(random()*20)::integer+1; v_roll:=case when v_t.dodging then least(v_roll1,v_roll2) else v_roll1 end; v_total:=v_roll+v_mod+v_prof;
  v_target_ac:=coalesce(v_t.armor_class,10)+coalesce((v_targeting->>'coverAcBonus')::integer,0); v_crit:=v_roll=20; v_hit:=case when v_roll=1 then false when v_crit then true else v_total>=v_target_ac end;
  if v_hit then v_raw_damage:=greatest(0,1+v_mod); v_damage_result:=public.encounter_apply_damage_internal_v1(v_t.id,v_raw_damage,'bludgeoning');
  else v_damage_result:=jsonb_build_object('targetId',v_t.id,'damageType','bludgeoning','rawDamage',0,'resistant',false,'immune',false,'vulnerable',false,'damage',0,'targetHp',v_t.current_hp,'targetTempHp',v_t.temp_hp,'defeated',v_t.is_defeated); end if;
  update public.encounter_participants set action_available=false,updated_at=timezone('utc',now()) where id=v_a.id;
  v_result:=jsonb_build_object('requestId',p_request_id,'attackerId',v_a.id,'targetId',v_t.id,'roll',v_roll,'secondRoll',case when v_t.dodging then v_roll2 else null end,'attackBonus',v_mod+v_prof,'total',v_total,'baseTargetAc',coalesce(v_t.armor_class,10),'coverAcBonus',(v_targeting->>'coverAcBonus')::integer,'targetAc',v_target_ac,'coverLevel',v_targeting->>'coverLevel','dodging',v_t.dodging,'hit',v_hit,'critical',v_crit,'damageType','bludgeoning','rawDamage',v_raw_damage,'damage',(v_damage_result->>'damage')::integer,'resistant',(v_damage_result->>'resistant')::boolean,'immune',(v_damage_result->>'immune')::boolean,'vulnerable',(v_damage_result->>'vulnerable')::boolean,'targetHp',(v_damage_result->>'targetHp')::integer,'targetTempHp',(v_damage_result->>'targetTempHp')::integer,'defeated',(v_damage_result->>'defeated')::boolean,'targeting',v_targeting);
  insert into public.encounter_combat_log(encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail)
  values(v_e.id,v_e.round,v_e.turn_index,v_a.id,v_t.id,'unarmed_strike',v_a.display_name||case when v_hit then ' hit ' else ' missed ' end||v_t.display_name||' with an Unarmed Strike.',v_result);
  update public.encounters set version=version+1,updated_at=timezone('utc',now()) where id=v_e.id;
  update public.encounter_command_requests set result=v_result where request_id=p_request_id;
  return v_result;
end;
$function$;

revoke all on function public.encounter_weapon_attack_v1(uuid,uuid,uuid,uuid) from public, anon;
grant execute on function public.encounter_weapon_attack_v1(uuid,uuid,uuid,uuid) to authenticated, service_role;
revoke all on function public.encounter_unarmed_strike_v1(uuid,uuid,uuid) from public, anon;
grant execute on function public.encounter_unarmed_strike_v1(uuid,uuid,uuid) to authenticated, service_role;

do $postconditions$
begin
  if not has_function_privilege('authenticated','public.encounter_targeting_context_v1(uuid,uuid)','EXECUTE') then raise exception 'targeting context RPC missing'; end if;
  if not has_function_privilege('authenticated','public.encounter_roll_save_v1(uuid,text,integer,uuid,uuid)','EXECUTE') then raise exception 'saving throw RPC missing'; end if;
  if has_function_privilege('anon','public.encounter_roll_save_v1(uuid,text,integer,uuid,uuid)','EXECUTE') then raise exception 'anon must not roll saves'; end if;
  if has_function_privilege('authenticated','public.encounter_apply_damage_internal_v1(uuid,integer,text)','EXECUTE') then raise exception 'generic damage helper must remain private'; end if;
  if has_function_privilege('authenticated','public.encounter_targeting_context_internal_v1(uuid,uuid)','EXECUTE') then raise exception 'internal targeting helper must remain private'; end if;
end;
$postconditions$;

commit;
