-- Phase 1O: target-turn-start timed tactical effects + reviewed XPHB Shocking Grasp adapter.
-- Additive/versioned: v1-v6 remain available; v7 delegates all prior reviewed spells to v6.

create table if not exists public.encounter_timed_effects (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references public.encounters(id) on delete cascade,
  participant_id uuid not null references public.encounter_participants(id) on delete cascade,
  source_participant_id uuid references public.encounter_participants(id) on delete set null,
  effect_key text not null,
  remaining_target_turn_starts integer not null default 1 check (remaining_target_turn_starts > 0),
  metadata jsonb not null default '{}'::jsonb,
  applied_round integer not null default 0,
  applied_turn_index integer not null default 0,
  created_at timestamptz not null default timezone('utc',now()),
  updated_at timestamptz not null default timezone('utc',now()),
  unique(participant_id,effect_key)
);

create index if not exists encounter_timed_effects_encounter_participant_idx
  on public.encounter_timed_effects(encounter_id,participant_id);
create index if not exists encounter_timed_effects_source_idx
  on public.encounter_timed_effects(source_participant_id)
  where source_participant_id is not null;

alter table public.encounter_timed_effects enable row level security;
revoke all on public.encounter_timed_effects from public, anon, authenticated;
grant select on public.encounter_timed_effects to authenticated;
grant all on public.encounter_timed_effects to service_role;

drop policy if exists encounter_timed_effects_authenticated_read on public.encounter_timed_effects;
create policy encounter_timed_effects_authenticated_read on public.encounter_timed_effects
for select to authenticated using (
  public.is_admin(auth.uid())
  or public.encounter_can_control_participant_v1(participant_id)
  or (source_participant_id is not null and public.encounter_can_control_participant_v1(source_participant_id))
  or exists(
    select 1 from public.encounter_participants p
    where p.id=participant_id and not p.is_hidden
  )
);

alter table public.encounter_timed_effects replica identity full;
do $realtime$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='encounter_timed_effects'
  ) then
    alter publication supabase_realtime add table public.encounter_timed_effects;
  end if;
end
$realtime$;

create or replace function private.encounter_has_timed_effect_v1(
  p_participant_id uuid,
  p_effect_key text
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
  select exists(
    select 1
    from public.encounter_timed_effects e
    where e.participant_id=p_participant_id
      and e.effect_key=lower(btrim(coalesce(p_effect_key,'')))
      and e.remaining_target_turn_starts>0
  );
$function$;

revoke all on function private.encounter_has_timed_effect_v1(uuid,text) from public, anon, authenticated;
grant execute on function private.encounter_has_timed_effect_v1(uuid,text) to service_role;

create or replace function private.encounter_apply_target_turn_start_effect_v1(
  p_target_id uuid,
  p_source_id uuid,
  p_effect_key text,
  p_target_turn_starts integer default 1,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_t public.encounter_participants%rowtype;
  v_s public.encounter_participants%rowtype;
  v_e public.encounters%rowtype;
  v_key text:=lower(btrim(coalesce(p_effect_key,'')));
  v_id uuid;
begin
  if p_target_id is null or v_key='' then raise exception 'Timed effect target and key are required'; end if;
  if p_target_turn_starts is null or p_target_turn_starts<1 then raise exception 'Timed effect duration must be at least one target turn start'; end if;
  select * into v_t from public.encounter_participants where id=p_target_id;
  if not found then raise exception 'Timed effect target not found'; end if;
  if p_source_id is not null then
    select * into v_s from public.encounter_participants where id=p_source_id and encounter_id=v_t.encounter_id;
    if not found then raise exception 'Timed effect source is not in this encounter'; end if;
  end if;
  select * into v_e from public.encounters where id=v_t.encounter_id;
  if not found then raise exception 'Timed effect encounter not found'; end if;

  insert into public.encounter_timed_effects(
    encounter_id,participant_id,source_participant_id,effect_key,remaining_target_turn_starts,
    metadata,applied_round,applied_turn_index,updated_at
  ) values (
    v_t.encounter_id,v_t.id,p_source_id,v_key,p_target_turn_starts,
    coalesce(p_metadata,'{}'::jsonb),coalesce(v_e.round,0),coalesce(v_e.turn_index,0),timezone('utc',now())
  )
  on conflict(participant_id,effect_key) do update set
    source_participant_id=excluded.source_participant_id,
    remaining_target_turn_starts=excluded.remaining_target_turn_starts,
    metadata=excluded.metadata,
    applied_round=excluded.applied_round,
    applied_turn_index=excluded.applied_turn_index,
    updated_at=timezone('utc',now())
  returning id into v_id;

  return jsonb_build_object(
    'effectId',v_id,
    'targetId',v_t.id,
    'sourceId',p_source_id,
    'effectKey',v_key,
    'remainingTargetTurnStarts',p_target_turn_starts
  );
end;
$function$;

revoke all on function private.encounter_apply_target_turn_start_effect_v1(uuid,uuid,text,integer,jsonb) from public, anon, authenticated;
grant execute on function private.encounter_apply_target_turn_start_effect_v1(uuid,uuid,text,integer,jsonb) to service_role;

create or replace function private.expire_encounter_timed_effects_on_turn_start_v1()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
  v_fx public.encounter_timed_effects%rowtype;
  v_name text;
begin
  if new.active_participant_id is null
     or new.active_participant_id is not distinct from old.active_participant_id then
    return new;
  end if;

  select display_name into v_name
  from public.encounter_participants
  where id=new.active_participant_id;

  for v_fx in
    select * from public.encounter_timed_effects
    where encounter_id=new.id
      and participant_id=new.active_participant_id
      and remaining_target_turn_starts=1
    for update
  loop
    insert into public.encounter_combat_log(
      encounter_id,round,turn_index,target_participant_id,event_type,summary,detail
    ) values (
      new.id,new.round,new.turn_index,new.active_participant_id,'effect_expired',
      initcap(replace(v_fx.effect_key,'_',' '))||' expired on '||coalesce(v_name,'participant')||' at turn start.',
      jsonb_build_object('effectId',v_fx.id,'effectKey',v_fx.effect_key,'expiry','target_turn_start')
    );
    delete from public.encounter_timed_effects where id=v_fx.id;
  end loop;

  update public.encounter_timed_effects
  set remaining_target_turn_starts=remaining_target_turn_starts-1,
      updated_at=timezone('utc',now())
  where encounter_id=new.id
    and participant_id=new.active_participant_id
    and remaining_target_turn_starts>1;

  return new;
end;
$function$;

revoke all on function private.expire_encounter_timed_effects_on_turn_start_v1() from public, anon, authenticated;

drop trigger if exists encounter_timed_effects_turn_start_expiry on public.encounters;
create trigger encounter_timed_effects_turn_start_expiry
after update of active_participant_id on public.encounters
for each row
when (old.active_participant_id is distinct from new.active_participant_id)
execute function private.expire_encounter_timed_effects_on_turn_start_v1();

create or replace function public.encounter_threat_reach_ft_internal_v1(p_participant_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_p public.encounter_participants%rowtype;
  v_row record;
  v_profile jsonb;
  v_reach integer:=5;
begin
  select * into v_p from public.encounter_participants where id=p_participant_id;
  if not found or v_p.is_defeated then return 0; end if;
  if private.encounter_has_timed_effect_v1(v_p.id,'opportunity_attack_suppressed') then return 0; end if;
  for v_row in
    select distinct i.id
    from public.inventory_items i
    where i.is_equipped and (
      (i.owner_id=v_p.character_id::text and lower(coalesce(i.owner_type,'')) in ('npc','merchant','character'))
      or (lower(coalesce(i.owner_type,''))='player' and exists(
        select 1 from public.character_permissions cp
        where cp.character_id=v_p.character_id and cp.can_edit and i.owner_id=cp.user_id::text
      ))
    )
  loop
    v_profile:=public.encounter_weapon_profile_internal_v1(v_p.id,v_row.id);
    if v_profile is not null and not coalesce((v_profile->>'isRanged')::boolean,false) then
      v_reach:=greatest(v_reach,coalesce((v_profile->>'reachFt')::integer,5));
    end if;
  end loop;
  return v_reach;
end;
$function$;
revoke all on function public.encounter_threat_reach_ft_internal_v1(uuid) from public, anon, authenticated;
grant execute on function public.encounter_threat_reach_ft_internal_v1(uuid) to service_role;

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
  v_dist_ft integer;
  v_reach integer:=5;
  v_attack_bonus integer:=0;
  v_ability_mod integer:=0;
  v_magic_bonus integer:=0;
  v_dice_count integer:=1;
  v_die_size integer:=1;
  v_damage_type text:='bludgeoning';
  v_weapon text:='Unarmed Strike';
  v_roll1 integer; v_roll2 integer; v_roll integer; v_total integer;
  v_hit boolean; v_crit boolean; v_disadvantage boolean:=false;
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
  v_disadvantage:=coalesce(v_m.dodging,false);
  v_roll1:=floor(random()*20)::integer+1;
  v_roll2:=floor(random()*20)::integer+1;
  v_roll:=case when v_disadvantage then least(v_roll1,v_roll2) else v_roll1 end;
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
    'distanceFt',v_dist_ft,'roll',v_roll,'secondRoll',case when v_disadvantage then v_roll2 else null end,
    'disadvantage',v_disadvantage,'attackBonus',v_attack_bonus,'total',v_total,'targetAc',v_target_ac,
    'hit',v_hit,'critical',v_crit,'rawDamage',v_raw_damage,'damageType',v_damage_type,'damage',v_damage
  );
  return v_result;
end;
$function$;
revoke all on function public.encounter_opportunity_attack_internal_v1(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.encounter_opportunity_attack_internal_v1(uuid,uuid,uuid) to service_role;

create or replace function public.encounter_cast_spell_v7(
  p_caster_id uuid,
  p_assignment_id uuid,
  p_target_id uuid,
  p_slot_level integer,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private', 'auth'
as $function$
declare
  v_uid uuid:=auth.uid();
  v_role text:=coalesce(auth.role(),'');
  v_c public.encounter_participants%rowtype;
  v_t public.encounter_participants%rowtype;
  v_e public.encounters%rowtype;
  v_assignment public.character_spells%rowtype;
  v_spell public.spells_catalog%rowtype;
  v_existing public.encounter_command_requests%rowtype;
  v_profile jsonb;
  v_targeting jsonb;
  v_damage jsonb:=null;
  v_effect jsonb:=null;
  v_inserted integer:=0;
  v_key text;
  v_dist_ft integer:=0;
  v_casting_ability text;
  v_casting_score integer;
  v_cast_mod integer;
  v_prof integer;
  v_attack_bonus integer;
  v_roll1 integer;
  v_roll2 integer;
  v_roll integer;
  v_total integer;
  v_target_ac integer;
  v_disadvantage boolean:=false;
  v_hit boolean:=false;
  v_crit boolean:=false;
  v_dice_count integer:=0;
  v_die_size integer:=8;
  v_damage_roll integer:=0;
  v_raw_damage integer:=0;
  v_i integer;
  v_result jsonb;
begin
  if p_caster_id is null or p_assignment_id is null or p_target_id is null or p_request_id is null then
    raise exception 'Caster, spell assignment, target, and request id are required';
  end if;

  select * into v_c from public.encounter_participants where id=p_caster_id;
  if not found then raise exception 'Caster not found'; end if;
  select * into v_assignment from public.character_spells where id=p_assignment_id and character_id=v_c.character_id;
  if not found then raise exception 'Spell assignment is not in this character''s spellbook'; end if;
  select * into v_spell from public.spells_catalog where id=v_assignment.spell_id;
  if not found then raise exception 'Assigned spell definition not found'; end if;

  v_key:=lower(v_spell.spell_key);
  if v_key in (
    'fire-bolt|xphb','cure-wounds|xphb','sacred-flame|xphb','toll-the-dead|xphb',
    'poison-spray|xphb','false-life|xphb','inflict-wounds|xphb'
  ) then
    return public.encounter_cast_spell_v6(p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id);
  end if;

  if v_key<>'shocking-grasp|xphb' then
    raise exception 'This spell remains GM-assisted; no automated tactical adapter is approved yet';
  end if;
  if lower(coalesce(v_assignment.source_type,''))<>'class' then raise exception 'Only class spell assignments are automated in this casting slice'; end if;
  if v_spell.source<>'XPHB' then raise exception 'Only reviewed XPHB spell versions are automated in this casting slice'; end if;
  if v_spell.level<>0 then raise exception 'Shocking Grasp must resolve from its reviewed cantrip definition'; end if;
  if p_slot_level is not null and p_slot_level<>0 then raise exception 'Cantrips do not use spell slots'; end if;
  if p_target_id=v_c.id then raise exception 'Shocking Grasp requires another creature target'; end if;

  insert into public.encounter_command_requests(request_id,encounter_id,participant_id,command_type,requested_by)
  values(p_request_id,v_c.encounter_id,v_c.id,'spell_cast',v_uid)
  on conflict(request_id) do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then
    select * into v_existing from public.encounter_command_requests where request_id=p_request_id;
    if not found or v_existing.command_type<>'spell_cast' or v_existing.participant_id<>v_c.id then raise exception 'Request id is already used for another command'; end if;
    return coalesce(v_existing.result,jsonb_build_object('duplicate',true,'pending',true));
  end if;

  select * into v_c from public.encounter_participants where id=p_caster_id for update;
  select * into v_e from public.encounters where id=v_c.encounter_id for update;
  if not found then raise exception 'Encounter not found'; end if;
  select * into v_t from public.encounter_participants where id=p_target_id and encounter_id=v_c.encounter_id for update;
  if not found then raise exception 'Target not found in this encounter'; end if;

  if v_e.status<>'active' or v_e.active_participant_id is distinct from v_c.id then raise exception 'It is not this participant''s active turn'; end if;
  if v_role<>'service_role' and not public.encounter_can_control_participant_v1(v_c.id) then raise exception 'Not authorized to control this participant'; end if;
  if v_t.is_hidden and v_role<>'service_role' and v_t.controller_user_id is distinct from v_uid and (v_uid is null or not public.is_admin(v_uid)) then raise exception 'Target is hidden from this controller'; end if;
  if v_c.is_defeated then raise exception 'Defeated participants cannot cast spells'; end if;
  if v_t.is_defeated then raise exception 'Target is already defeated'; end if;
  if not v_c.action_available then raise exception 'Action already spent'; end if;
  if exists(
    select 1 from public.encounter_conditions c
    where c.participant_id=v_c.id and c.condition_key in ('incapacitated','paralyzed','stunned','unconscious')
  ) then raise exception 'Current conditions prevent this participant from taking the Cast action'; end if;

  v_profile:=public.encounter_spellcasting_profile_v1(v_c.id);
  if not coalesce((v_profile->>'isClassCaster')::boolean,false) then raise exception 'This participant has no canonical class spellcasting profile'; end if;
  v_casting_ability:=lower(coalesce(nullif(btrim(v_assignment.casting_stat),''),v_profile->>'castingAbility',''));
  if v_casting_ability not in ('str','dex','con','int','wis','cha') then raise exception 'Casting ability is unavailable'; end if;
  v_casting_score:=private.encounter_ability_score_v1(v_c.character_id,v_casting_ability);
  v_cast_mod:=floor((coalesce(v_casting_score,10)-10)/2.0)::integer;
  v_prof:=coalesce((v_profile->>'proficiencyBonus')::integer,2);
  v_attack_bonus:=coalesce(v_assignment.attack_bonus_override,v_cast_mod+v_prof);

  v_targeting:=public.encounter_targeting_context_internal_v1(v_c.id,v_t.id);
  if not coalesce((v_targeting->>'hasLineOfSight')::boolean,false) then raise exception 'Target is blocked by total cover or line-of-sight obstruction'; end if;
  v_dist_ft:=coalesce((v_targeting->>'distanceFt')::integer,0);
  if v_dist_ft>5 then raise exception 'Target is beyond Shocking Grasp reach'; end if;

  if exists(select 1 from public.encounter_conditions c where c.participant_id in (v_c.id,v_t.id)) then
    raise exception 'Spell attacks with active conditions on caster or target remain GM-assisted in this slice';
  end if;

  v_dice_count:=case
    when coalesce((v_profile->>'classLevel')::integer,1)>=17 then 4
    when coalesce((v_profile->>'classLevel')::integer,1)>=11 then 3
    when coalesce((v_profile->>'classLevel')::integer,1)>=5 then 2
    else 1
  end;
  v_disadvantage:=coalesce(v_t.dodging,false);
  v_roll1:=floor(random()*20)::integer+1;
  v_roll2:=floor(random()*20)::integer+1;
  v_roll:=case when v_disadvantage then least(v_roll1,v_roll2) else v_roll1 end;
  v_total:=v_roll+v_attack_bonus;
  v_target_ac:=coalesce(v_t.armor_class,10)+coalesce((v_targeting->>'coverAcBonus')::integer,0);
  v_crit:=v_roll=20;
  v_hit:=case when v_roll=1 then false when v_crit then true else v_total>=v_target_ac end;
  if v_crit then v_dice_count:=v_dice_count*2; end if;

  if v_hit then
    for v_i in 1..v_dice_count loop v_damage_roll:=v_damage_roll+floor(random()*v_die_size)::integer+1; end loop;
    v_raw_damage:=v_damage_roll;
    v_damage:=public.encounter_apply_damage_internal_v1(v_t.id,v_raw_damage,'lightning');
    v_effect:=private.encounter_apply_target_turn_start_effect_v1(
      v_t.id,v_c.id,'opportunity_attack_suppressed',1,
      jsonb_build_object('spellKey',v_spell.spell_key,'spell',v_spell.name,'reason','Shocking Grasp')
    );
  else
    v_damage:=jsonb_build_object(
      'targetId',v_t.id,'damageType','lightning','rawDamage',0,
      'resistant',false,'immune',false,'vulnerable',false,'damage',0,
      'targetHp',v_t.current_hp,'targetTempHp',v_t.temp_hp,'defeated',v_t.is_defeated
    );
  end if;

  v_result:=jsonb_build_object(
    'requestId',p_request_id,'casterId',v_c.id,'targetId',v_t.id,'assignmentId',v_assignment.id,
    'spellId',v_spell.id,'spellKey',v_spell.spell_key,'spell',v_spell.name,'actionType','action','slotLevel',null,
    'distanceFt',v_dist_ft,'castingAbility',v_casting_ability,'castingAbilityModifier',v_cast_mod,'proficiencyBonus',v_prof,
    'attackBonus',v_attack_bonus,'roll',v_roll,'secondRoll',case when v_disadvantage then v_roll2 else null end,
    'disadvantage',v_disadvantage,'baseTargetAc',coalesce(v_t.armor_class,10),'coverAcBonus',coalesce((v_targeting->>'coverAcBonus')::integer,0),
    'targetAc',v_target_ac,'hit',v_hit,'critical',v_crit,'damageDice',v_dice_count::text||'d8',
    'damageRoll',v_damage_roll,'damageType','lightning','rawDamage',v_raw_damage,'damage',v_damage,
    'opportunityAttackSuppressed',v_hit,'timedEffect',v_effect,'targeting',v_targeting
  );

  update public.encounter_participants set action_available=false,updated_at=timezone('utc',now()) where id=v_c.id;
  insert into public.encounter_combat_log(encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail)
  values(
    v_e.id,v_e.round,v_e.turn_index,v_c.id,v_t.id,'spell_cast',
    v_c.display_name||' cast Shocking Grasp on '||v_t.display_name||case when v_hit then ' and suppressed Opportunity Attacks until the target''s next turn starts.' else ' and missed.' end,
    v_result
  );
  update public.encounters set version=version+1,updated_at=timezone('utc',now()) where id=v_e.id;
  update public.encounter_command_requests set result=v_result where request_id=p_request_id;
  return v_result;
end;
$function$;

revoke all on function public.encounter_cast_spell_v7(uuid,uuid,uuid,integer,uuid) from public, anon;
grant execute on function public.encounter_cast_spell_v7(uuid,uuid,uuid,integer,uuid) to authenticated, service_role;

do $postconditions$
begin
  if not has_function_privilege('authenticated','public.encounter_cast_spell_v7(uuid,uuid,uuid,integer,uuid)','EXECUTE') then raise exception 'guarded Shocking Grasp cast RPC missing'; end if;
  if has_function_privilege('anon','public.encounter_cast_spell_v7(uuid,uuid,uuid,integer,uuid)','EXECUTE') then raise exception 'anon must not cast Shocking Grasp'; end if;
  if to_regprocedure('public.encounter_cast_spell_v6(uuid,uuid,uuid,integer,uuid)') is null then raise exception 'Phase 1N cast RPC must remain available'; end if;
  if has_table_privilege('authenticated','public.encounter_timed_effects','INSERT') or has_table_privilege('authenticated','public.encounter_timed_effects','UPDATE') or has_table_privilege('authenticated','public.encounter_timed_effects','DELETE') then raise exception 'authenticated clients must not directly mutate timed tactical effects'; end if;
  if has_function_privilege('authenticated','private.encounter_apply_target_turn_start_effect_v1(uuid,uuid,text,integer,jsonb)','EXECUTE') then raise exception 'timed effect helper must remain internal'; end if;
end
$postconditions$;
