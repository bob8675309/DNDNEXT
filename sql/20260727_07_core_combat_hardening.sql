begin;

create or replace function public.encounter_unarmed_strike_v1(p_attacker_id uuid,p_target_id uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, private, auth
as $function$
declare v_uid uuid:=auth.uid(); v_role text:=coalesce(auth.role(),''); v_a public.encounter_participants%rowtype; v_t public.encounter_participants%rowtype; v_e public.encounters%rowtype; v_existing public.encounter_command_requests%rowtype; v_inserted integer:=0; v_snap jsonb; v_str integer; v_prof integer; v_mod integer; v_roll1 integer; v_roll2 integer; v_roll integer; v_total integer; v_hit boolean; v_crit boolean; v_damage integer:=0; v_temp integer; v_hp integer; v_result jsonb; v_dist integer;
begin
  if p_attacker_id is null or p_target_id is null or p_request_id is null then raise exception 'Attacker, target and request id are required'; end if;
  if p_attacker_id=p_target_id then raise exception 'Attacker and target must differ'; end if;
  insert into public.encounter_command_requests(request_id,encounter_id,participant_id,command_type,requested_by)
  select p_request_id,p.encounter_id,p.id,'attack',v_uid from public.encounter_participants p where p.id=p_attacker_id on conflict(request_id) do nothing;
  get diagnostics v_inserted=row_count;
  if v_inserted=0 then select * into v_existing from public.encounter_command_requests where request_id=p_request_id; if not found or v_existing.command_type<>'attack' or v_existing.participant_id<>p_attacker_id then raise exception 'Request id is already used for another command'; end if; return coalesce(v_existing.result,jsonb_build_object('duplicate',true,'pending',true)); end if;
  select * into v_a from public.encounter_participants where id=p_attacker_id for update; if not found then raise exception 'Attacker not found'; end if;
  select * into v_t from public.encounter_participants where id=p_target_id and encounter_id=v_a.encounter_id for update; if not found then raise exception 'Target not found in this encounter'; end if;
  select * into v_e from public.encounters where id=v_a.encounter_id for update; if not found then raise exception 'Encounter not found'; end if;
  if v_e.status<>'active' or v_e.active_participant_id is distinct from v_a.id then raise exception 'It is not this participant''s active turn'; end if;
  if v_role<>'service_role' and not public.encounter_can_control_participant_v1(v_a.id) then raise exception 'Not authorized to control this participant'; end if;
  if v_a.is_defeated then raise exception 'Defeated participants cannot attack'; end if;
  if v_t.is_defeated then raise exception 'Target is already defeated'; end if;
  if not v_a.action_available then raise exception 'Action already spent'; end if;
  v_dist:=greatest(abs(v_t.q-v_a.q),abs(v_t.r-v_a.r),abs((v_t.q-v_a.q)+(v_t.r-v_a.r)));
  if v_dist>1 then raise exception 'Unarmed Strike target must be within 5 feet'; end if;
  v_snap:=public.encounter_canonical_combat_snapshot_v1(v_a.character_id); v_str:=(v_snap->>'str')::integer; v_prof:=(v_snap->>'prof')::integer; v_mod:=floor((v_str-10)/2.0)::integer;
  v_roll1:=floor(random()*20)::integer+1; v_roll2:=floor(random()*20)::integer+1; v_roll:=case when v_t.dodging then least(v_roll1,v_roll2) else v_roll1 end; v_total:=v_roll+v_mod+v_prof; v_crit:=v_roll=20; v_hit:=case when v_roll=1 then false when v_crit then true else v_total>=coalesce(v_t.armor_class,10) end;
  if v_hit then v_damage:=greatest(0,1+v_mod); end if;
  v_temp:=coalesce(v_t.temp_hp,0); v_hp:=coalesce(v_t.current_hp,1);
  if v_damage>0 then if v_temp>=v_damage then v_temp:=v_temp-v_damage; else v_hp:=greatest(0,v_hp-(v_damage-v_temp)); v_temp:=0; end if; end if;
  update public.encounter_participants set current_hp=v_hp,temp_hp=v_temp,is_defeated=(v_hp<=0),updated_at=timezone('utc',now()) where id=v_t.id;
  update public.encounter_participants set action_available=false,updated_at=timezone('utc',now()) where id=v_a.id;
  v_result:=jsonb_build_object('requestId',p_request_id,'attackerId',v_a.id,'targetId',v_t.id,'roll',v_roll,'secondRoll',case when v_t.dodging then v_roll2 else null end,'attackBonus',v_mod+v_prof,'total',v_total,'targetAc',coalesce(v_t.armor_class,10),'dodging',v_t.dodging,'hit',v_hit,'critical',v_crit,'damage',v_damage,'targetHp',v_hp,'targetTempHp',v_temp,'defeated',v_hp<=0);
  insert into public.encounter_combat_log(encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail)
  values(v_e.id,v_e.round,v_e.turn_index,v_a.id,v_t.id,'unarmed_strike',v_a.display_name||case when v_hit then ' hit ' else ' missed ' end||v_t.display_name||' with an Unarmed Strike.',v_result);
  update public.encounters set version=version+1,updated_at=timezone('utc',now()) where id=v_e.id;
  update public.encounter_command_requests set result=v_result where request_id=p_request_id;
  return v_result;
end;$function$;

drop policy if exists encounter_combat_log_authenticated_read on public.encounter_combat_log;
create policy encounter_combat_log_authenticated_read on public.encounter_combat_log
for select to authenticated using (
  public.is_admin(auth.uid())
  or (
    exists(select 1 from public.encounters e where e.id=encounter_id and e.status<>'archived')
    and not exists(select 1 from public.encounter_participants p where p.id=actor_participant_id and p.is_hidden and p.controller_user_id is distinct from auth.uid())
    and not exists(select 1 from public.encounter_participants p where p.id=target_participant_id and p.is_hidden and p.controller_user_id is distinct from auth.uid())
  )
);

do $realtime$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='encounter_combat_log') then
    alter publication supabase_realtime add table public.encounter_combat_log;
  end if;
end $realtime$;
alter table public.encounter_combat_log replica identity full;

commit;