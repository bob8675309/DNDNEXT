begin;

alter table public.encounter_command_requests
  drop constraint if exists encounter_command_requests_command_type_check;
alter table public.encounter_command_requests
  add constraint encounter_command_requests_command_type_check
  check (command_type in ('move','end_turn','core_action','attack','weapon_attack'));

create or replace function public.encounter_weapon_profile_internal_v1(
  p_participant_id uuid,
  p_inventory_item_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_p public.encounter_participants%rowtype;
  v_inv public.inventory_items%rowtype;
  v_catalog jsonb := '{}'::jsonb;
  v_payload jsonb := '{}'::jsonb;
  v_sheet jsonb := '{}'::jsonb;
  v_snapshot jsonb := '{}'::jsonb;
  v_starting jsonb := '{}'::jsonb;
  v_weapon_profs jsonb := '[]'::jsonb;
  v_name text;
  v_item_type text;
  v_item_key text;
  v_damage_dice text;
  v_damage_type text;
  v_range text;
  v_category text;
  v_class_key text;
  v_bonus_raw text;
  v_magic_bonus integer := 0;
  v_str integer := 10;
  v_dex integer := 10;
  v_prof_bonus integer := 2;
  v_ability text := 'str';
  v_ability_mod integer := 0;
  v_attack_bonus integer := 0;
  v_reach integer := 5;
  v_normal_range integer := 5;
  v_long_range integer := 5;
  v_is_ranged boolean := false;
  v_is_thrown boolean := false;
  v_is_finesse boolean := false;
  v_proficient boolean := false;
  v_owner_ok boolean := false;
  v_is_weapon boolean := false;
begin
  select * into v_p from public.encounter_participants where id=p_participant_id;
  if not found then return null; end if;

  select * into v_inv from public.inventory_items where id=p_inventory_item_id and is_equipped;
  if not found then return null; end if;

  v_owner_ok := (
    v_inv.owner_id = v_p.character_id::text
    and lower(coalesce(v_inv.owner_type,'')) in ('npc','merchant','character')
  ) or exists (
    select 1
    from public.character_permissions cp
    where cp.character_id=v_p.character_id
      and coalesce(cp.can_edit,false)
      and lower(coalesce(v_inv.owner_type,''))='player'
      and v_inv.owner_id=cp.user_id::text
  );
  if not v_owner_ok then return null; end if;

  select ic.payload into v_catalog
  from public.items_catalog ic
  where ic.item_key = coalesce(v_inv.card_payload->>'item_key', v_inv.card_payload->>'item_id', v_inv.item_id)
     or ic.item_key = v_inv.item_id
     or lower(ic.item_name)=lower(v_inv.item_name)
  order by
    case
      when ic.item_key = coalesce(v_inv.card_payload->>'item_key', v_inv.card_payload->>'item_id', v_inv.item_id) then 0
      when ic.item_key = v_inv.item_id then 1
      else 2
    end,
    case when coalesce(ic.payload->>'edition','')='one' then 0 else 1 end
  limit 1;

  v_payload := coalesce(v_catalog,'{}'::jsonb) || coalesce(v_inv.card_payload,'{}'::jsonb);
  v_name := coalesce(nullif(v_payload->>'item_name',''),nullif(v_payload->>'name',''),v_inv.item_name,'Weapon');
  v_item_type := coalesce(nullif(v_payload->>'item_type',''),nullif(v_payload->>'uiType',''),v_inv.item_type,'');
  v_item_key := coalesce(nullif(v_payload->>'item_key',''),nullif(v_payload->>'item_id',''),v_inv.item_id,v_inv.id::text);
  v_damage_dice := coalesce(v_payload->>'dmg1','');
  v_damage_type := upper(coalesce(v_payload->>'dmgType',''));
  v_range := coalesce(v_payload->>'range','');
  v_category := lower(coalesce(v_payload->>'weaponCategory',''));

  v_is_weapon := coalesce(v_payload->>'weapon','false')='true'
    or lower(v_item_type) like '%weapon%'
    or split_part(coalesce(v_payload->>'type',''),'|',1) in ('M','R');
  if not v_is_weapon or v_damage_dice !~ '^[1-9][0-9]*d[1-9][0-9]*$' then return null; end if;

  v_is_ranged := lower(v_item_type) like '%ranged weapon%'
    or split_part(coalesce(v_payload->>'type',''),'|',1)='R';
  v_is_thrown := exists (
    select 1 from jsonb_array_elements_text(
      case when jsonb_typeof(v_payload->'property')='array' then v_payload->'property' else '[]'::jsonb end
    ) p(value) where split_part(value,'|',1)='T'
  );
  v_is_finesse := exists (
    select 1 from jsonb_array_elements_text(
      case when jsonb_typeof(v_payload->'property')='array' then v_payload->'property' else '[]'::jsonb end
    ) p(value) where split_part(value,'|',1)='F'
  );
  if exists (
    select 1 from jsonb_array_elements_text(
      case when jsonb_typeof(v_payload->'property')='array' then v_payload->'property' else '[]'::jsonb end
    ) p(value) where split_part(value,'|',1)='R'
  ) then v_reach := 10; end if;

  if v_range ~ '^[0-9]+/[0-9]+$' then
    v_normal_range := split_part(v_range,'/',1)::integer;
    v_long_range := split_part(v_range,'/',2)::integer;
  elsif v_is_ranged then
    v_normal_range := 5;
    v_long_range := 5;
  else
    v_normal_range := v_reach;
    v_long_range := v_reach;
  end if;

  if not v_is_ranged and not v_is_thrown then
    v_normal_range := v_reach;
    v_long_range := v_reach;
  end if;

  v_bonus_raw := coalesce(v_payload->>'bonusWeapon',v_payload->>'bonus_weapon',v_payload->>'enhancement_bonus',v_payload->>'smith_tier','0');
  if v_bonus_raw ~ '[-+]?[0-9]+' then
    begin v_magic_bonus := replace(substring(v_bonus_raw from '[-+]?[0-9]+'),'+','')::integer; exception when others then v_magic_bonus := 0; end;
  end if;

  select cs.sheet into v_sheet from public.character_sheets cs where cs.character_id=v_p.character_id;
  v_snapshot := public.encounter_canonical_combat_snapshot_v1(v_p.character_id);
  v_str := coalesce((v_snapshot->>'str')::integer,10);
  v_dex := coalesce((v_snapshot->>'dex')::integer,10);
  v_prof_bonus := coalesce((v_snapshot->>'prof')::integer,2);
  v_class_key := lower(coalesce(v_sheet#>>'{meta,classKey}',v_sheet->>'classKey',''));

  select c.raw_payload->'starting_proficiencies' into v_starting
  from public.class_catalog_preferred c
  where lower(c.class_key)=v_class_key
  limit 1;
  v_weapon_profs := case
    when jsonb_typeof(v_starting->'weapons')='array' then v_starting->'weapons'
    else '[]'::jsonb
  end;

  v_proficient := exists (
    select 1 from jsonb_array_elements_text(v_weapon_profs) w(value)
    where lower(value)=v_category
       or lower(value)=lower(v_name)
       or lower(value) like '%'||lower(v_name)||'%'
  );

  if v_is_ranged then
    v_ability := 'dex';
    v_ability_mod := floor((v_dex-10)/2.0)::integer;
  elsif v_is_finesse and v_dex > v_str then
    v_ability := 'dex';
    v_ability_mod := floor((v_dex-10)/2.0)::integer;
  else
    v_ability := 'str';
    v_ability_mod := floor((v_str-10)/2.0)::integer;
  end if;
  v_attack_bonus := v_ability_mod + case when v_proficient then v_prof_bonus else 0 end + v_magic_bonus;

  v_damage_type := case v_damage_type
    when 'B' then 'bludgeoning'
    when 'P' then 'piercing'
    when 'S' then 'slashing'
    else lower(coalesce(nullif(v_damage_type,''),'untyped'))
  end;

  return jsonb_build_object(
    'inventoryItemId',v_inv.id,
    'itemKey',v_item_key,
    'name',v_name,
    'damageDice',v_damage_dice,
    'damageType',v_damage_type,
    'ability',v_ability,
    'abilityMod',v_ability_mod,
    'proficient',v_proficient,
    'proficiencyBonus',case when v_proficient then v_prof_bonus else 0 end,
    'magicBonus',v_magic_bonus,
    'attackBonus',v_attack_bonus,
    'reachFt',v_reach,
    'normalRangeFt',v_normal_range,
    'longRangeFt',v_long_range,
    'isRanged',v_is_ranged,
    'isThrown',v_is_thrown,
    'isFinesse',v_is_finesse,
    'equipSlot',v_inv.equip_slot
  );
end;
$function$;

revoke all on function public.encounter_weapon_profile_internal_v1(uuid,uuid) from public, anon, authenticated;
grant execute on function public.encounter_weapon_profile_internal_v1(uuid,uuid) to service_role;

create or replace function public.encounter_equipped_weapon_profiles_v1(p_participant_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_p public.encounter_participants%rowtype;
  v_row record;
  v_profile jsonb;
  v_result jsonb := '[]'::jsonb;
  v_role text := coalesce(auth.role(),'');
begin
  select * into v_p from public.encounter_participants where id=p_participant_id;
  if not found then raise exception 'Participant not found'; end if;
  if v_role<>'service_role' and not public.encounter_can_control_participant_v1(v_p.id) then
    raise exception 'Not authorized to view equipped combat weapons';
  end if;

  for v_row in
    select distinct i.id
    from public.inventory_items i
    where i.is_equipped
      and (
        (i.owner_id=v_p.character_id::text and lower(coalesce(i.owner_type,'')) in ('npc','merchant','character'))
        or (
          lower(coalesce(i.owner_type,''))='player'
          and exists (
            select 1 from public.character_permissions cp
            where cp.character_id=v_p.character_id and coalesce(cp.can_edit,false) and i.owner_id=cp.user_id::text
          )
        )
      )
    order by i.id
  loop
    v_profile := public.encounter_weapon_profile_internal_v1(v_p.id,v_row.id);
    if v_profile is not null then v_result := v_result || jsonb_build_array(v_profile); end if;
  end loop;
  return v_result;
end;
$function$;

revoke all on function public.encounter_equipped_weapon_profiles_v1(uuid) from public, anon;
grant execute on function public.encounter_equipped_weapon_profiles_v1(uuid) to authenticated, service_role;

create or replace function public.encounter_weapon_attack_v1(
  p_attacker_id uuid,
  p_target_id uuid,
  p_inventory_item_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_uid uuid := auth.uid();
  v_role text := coalesce(auth.role(),'');
  v_a public.encounter_participants%rowtype;
  v_t public.encounter_participants%rowtype;
  v_e public.encounters%rowtype;
  v_existing public.encounter_command_requests%rowtype;
  v_profile jsonb;
  v_inserted integer := 0;
  v_dist_hex integer;
  v_dist_ft integer;
  v_reach integer;
  v_normal integer;
  v_long integer;
  v_is_ranged boolean;
  v_is_thrown boolean;
  v_long_disadvantage boolean := false;
  v_disadvantage boolean := false;
  v_roll1 integer;
  v_roll2 integer;
  v_roll integer;
  v_total integer;
  v_hit boolean;
  v_crit boolean;
  v_dice_count integer;
  v_die_size integer;
  v_i integer;
  v_damage integer := 0;
  v_damage_roll integer := 0;
  v_ability_mod integer;
  v_magic_bonus integer;
  v_temp integer;
  v_hp integer;
  v_result jsonb;
begin
  if p_attacker_id is null or p_target_id is null or p_inventory_item_id is null or p_request_id is null then
    raise exception 'Attacker, target, equipped weapon and request id are required';
  end if;
  if p_attacker_id=p_target_id then raise exception 'Attacker and target must differ'; end if;

  insert into public.encounter_command_requests(request_id,encounter_id,participant_id,command_type,requested_by)
  select p_request_id,p.encounter_id,p.id,'weapon_attack',v_uid
  from public.encounter_participants p where p.id=p_attacker_id
  on conflict(request_id) do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then
    select * into v_existing from public.encounter_command_requests where request_id=p_request_id;
    if not found or v_existing.command_type<>'weapon_attack' or v_existing.participant_id<>p_attacker_id then
      raise exception 'Request id is already used for another command';
    end if;
    return coalesce(v_existing.result,jsonb_build_object('duplicate',true,'pending',true));
  end if;

  select * into v_a from public.encounter_participants where id=p_attacker_id for update;
  if not found then raise exception 'Attacker not found'; end if;
  select * into v_t from public.encounter_participants where id=p_target_id and encounter_id=v_a.encounter_id for update;
  if not found then raise exception 'Target not found in this encounter'; end if;
  select * into v_e from public.encounters where id=v_a.encounter_id for update;
  if not found then raise exception 'Encounter not found'; end if;

  if v_e.status<>'active' or v_e.active_participant_id is distinct from v_a.id then raise exception 'It is not this participant''s active turn'; end if;
  if v_role<>'service_role' and not public.encounter_can_control_participant_v1(v_a.id) then raise exception 'Not authorized to control this participant'; end if;
  if v_a.is_defeated then raise exception 'Defeated participants cannot attack'; end if;
  if v_t.is_defeated then raise exception 'Target is already defeated'; end if;
  if not v_a.action_available then raise exception 'Action already spent'; end if;

  v_profile := public.encounter_weapon_profile_internal_v1(v_a.id,p_inventory_item_id);
  if v_profile is null then raise exception 'Selected weapon is not currently equipped or has no supported canonical attack profile'; end if;

  v_dist_hex := greatest(abs(v_t.q-v_a.q),abs(v_t.r-v_a.r),abs((v_t.q-v_a.q)+(v_t.r-v_a.r)));
  v_dist_ft := v_dist_hex*5;
  v_reach := coalesce((v_profile->>'reachFt')::integer,5);
  v_normal := coalesce((v_profile->>'normalRangeFt')::integer,v_reach);
  v_long := coalesce((v_profile->>'longRangeFt')::integer,v_normal);
  v_is_ranged := coalesce((v_profile->>'isRanged')::boolean,false);
  v_is_thrown := coalesce((v_profile->>'isThrown')::boolean,false);

  if v_is_ranged then
    if v_dist_ft>v_long then raise exception 'Target is beyond the weapon''s long range'; end if;
    v_long_disadvantage := v_dist_ft>v_normal;
  elsif v_dist_ft<=v_reach then
    v_long_disadvantage := false;
  elsif v_is_thrown then
    if v_dist_ft>v_long then raise exception 'Target is beyond the thrown weapon''s long range'; end if;
    v_long_disadvantage := v_dist_ft>v_normal;
  else
    raise exception 'Target is beyond this weapon''s reach';
  end if;

  v_disadvantage := v_t.dodging or v_long_disadvantage;
  v_roll1 := floor(random()*20)::integer+1;
  v_roll2 := floor(random()*20)::integer+1;
  v_roll := case when v_disadvantage then least(v_roll1,v_roll2) else v_roll1 end;
  v_total := v_roll + coalesce((v_profile->>'attackBonus')::integer,0);
  v_crit := v_roll=20;
  v_hit := case when v_roll=1 then false when v_crit then true else v_total>=coalesce(v_t.armor_class,10) end;

  v_dice_count := split_part(v_profile->>'damageDice','d',1)::integer;
  v_die_size := split_part(v_profile->>'damageDice','d',2)::integer;
  if v_crit then v_dice_count := v_dice_count*2; end if;
  if v_hit then
    for v_i in 1..v_dice_count loop
      v_damage_roll := v_damage_roll + floor(random()*v_die_size)::integer+1;
    end loop;
    v_ability_mod := coalesce((v_profile->>'abilityMod')::integer,0);
    v_magic_bonus := coalesce((v_profile->>'magicBonus')::integer,0);
    v_damage := greatest(0,v_damage_roll+v_ability_mod+v_magic_bonus);
  end if;

  v_temp := coalesce(v_t.temp_hp,0);
  v_hp := coalesce(v_t.current_hp,1);
  if v_damage>0 then
    if v_temp>=v_damage then
      v_temp:=v_temp-v_damage;
    else
      v_hp:=greatest(0,v_hp-(v_damage-v_temp));
      v_temp:=0;
    end if;
  end if;

  update public.encounter_participants
  set current_hp=v_hp,temp_hp=v_temp,is_defeated=(v_hp<=0),updated_at=timezone('utc',now())
  where id=v_t.id;
  update public.encounter_participants set action_available=false,updated_at=timezone('utc',now()) where id=v_a.id;

  v_result := jsonb_build_object(
    'requestId',p_request_id,
    'attackerId',v_a.id,
    'targetId',v_t.id,
    'inventoryItemId',p_inventory_item_id,
    'weapon',v_profile->>'name',
    'distanceFt',v_dist_ft,
    'roll',v_roll,
    'secondRoll',case when v_disadvantage then v_roll2 else null end,
    'disadvantage',v_disadvantage,
    'longRangeDisadvantage',v_long_disadvantage,
    'dodging',v_t.dodging,
    'attackBonus',(v_profile->>'attackBonus')::integer,
    'total',v_total,
    'targetAc',coalesce(v_t.armor_class,10),
    'hit',v_hit,
    'critical',v_crit,
    'damageDice',v_profile->>'damageDice',
    'damageRoll',v_damage_roll,
    'damageType',v_profile->>'damageType',
    'damage',v_damage,
    'targetHp',v_hp,
    'targetTempHp',v_temp,
    'defeated',v_hp<=0,
    'profile',v_profile
  );

  insert into public.encounter_combat_log(
    encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail
  ) values (
    v_e.id,v_e.round,v_e.turn_index,v_a.id,v_t.id,'weapon_attack',
    v_a.display_name||case when v_hit then ' hit ' else ' missed ' end||v_t.display_name||' with '||(v_profile->>'name')||'.',
    v_result
  );
  update public.encounters set version=version+1,updated_at=timezone('utc',now()) where id=v_e.id;
  update public.encounter_command_requests set result=v_result where request_id=p_request_id;
  return v_result;
end;
$function$;

revoke all on function public.encounter_weapon_attack_v1(uuid,uuid,uuid,uuid) from public, anon;
grant execute on function public.encounter_weapon_attack_v1(uuid,uuid,uuid,uuid) to authenticated, service_role;

do $postconditions$
begin
  if not has_function_privilege('authenticated','public.encounter_equipped_weapon_profiles_v1(uuid)','EXECUTE') then raise exception 'equipped weapon profile RPC missing'; end if;
  if not has_function_privilege('authenticated','public.encounter_weapon_attack_v1(uuid,uuid,uuid,uuid)','EXECUTE') then raise exception 'weapon attack RPC missing'; end if;
  if has_function_privilege('anon','public.encounter_weapon_attack_v1(uuid,uuid,uuid,uuid)','EXECUTE') then raise exception 'anon must not attack'; end if;
  if has_function_privilege('authenticated','public.encounter_weapon_profile_internal_v1(uuid,uuid)','EXECUTE') then raise exception 'internal weapon profile helper must remain private'; end if;
end;
$postconditions$;

commit;
