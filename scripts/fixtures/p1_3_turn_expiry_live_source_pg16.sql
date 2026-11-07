-- 2026-11-01 read-only live source encounter_timed_speed_penalty_ft_v1 md5 3f400bb98f340bde58f13f39d05273a8
CREATE OR REPLACE FUNCTION private.encounter_timed_speed_penalty_ft_v1(p_participant_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  select greatest(0,coalesce(max(case when coalesce(e.metadata->>'speedPenaltyFt','') ~ '^[0-9]+$' then (e.metadata->>'speedPenaltyFt')::integer else 0 end),0))::integer
  from public.encounter_timed_effects e where e.participant_id=p_participant_id and e.remaining_target_turn_starts>0;
$function$;

-- 2026-11-01 read-only live source expire_encounter_timed_effects_on_turn_start_v1 md5 e8e898f3a427897863f31c64b2e1a4ea
CREATE OR REPLACE FUNCTION private.expire_encounter_timed_effects_on_turn_start_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_fx public.encounter_timed_effects%rowtype; v_name text; v_speed integer;
begin
  if new.active_participant_id is null or new.active_participant_id is not distinct from old.active_participant_id then return new; end if;
  select display_name into v_name from public.encounter_participants where id=new.active_participant_id;
  for v_fx in select * from public.encounter_timed_effects where encounter_id=new.id and expiry_trigger='target_turn_start' and participant_id=new.active_participant_id and remaining_target_turn_starts=1 for update loop
    insert into public.encounter_combat_log(encounter_id,round,turn_index,target_participant_id,event_type,summary,detail)
    values(new.id,new.round,new.turn_index,new.active_participant_id,'effect_expired',initcap(replace(v_fx.effect_key,'_',' '))||' expired on '||coalesce(v_name,'participant')||' at target turn start.',jsonb_build_object('effectId',v_fx.id,'effectKey',v_fx.effect_key,'expiry','target_turn_start'));
    delete from public.encounter_timed_effects where id=v_fx.id;
  end loop;
  update public.encounter_timed_effects set remaining_target_turn_starts=remaining_target_turn_starts-1,updated_at=timezone('utc',now()) where encounter_id=new.id and expiry_trigger='target_turn_start' and participant_id=new.active_participant_id and remaining_target_turn_starts>1;
  for v_fx in select * from public.encounter_timed_effects where encounter_id=new.id and expiry_trigger='source_turn_start' and source_participant_id=new.active_participant_id and remaining_target_turn_starts=1 for update loop
    delete from public.encounter_timed_effects where id=v_fx.id;
    select greatest(0,public.encounter_canonical_speed_ft_v1(p.character_id)-private.encounter_timed_speed_penalty_ft_v1(p.id)) into v_speed from public.encounter_participants p where p.id=v_fx.participant_id;
    update public.encounter_participants set speed_ft=v_speed,updated_at=timezone('utc',now()) where id=v_fx.participant_id;
    insert into public.encounter_combat_log(encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail)
    values(new.id,new.round,new.turn_index,new.active_participant_id,v_fx.participant_id,'effect_expired',initcap(replace(v_fx.effect_key,'_',' '))||' expired at the source participant''s turn start.',jsonb_build_object('effectId',v_fx.id,'effectKey',v_fx.effect_key,'expiry','source_turn_start','sourceParticipantId',new.active_participant_id));
  end loop;
  update public.encounter_timed_effects set remaining_target_turn_starts=remaining_target_turn_starts-1,updated_at=timezone('utc',now()) where encounter_id=new.id and expiry_trigger='source_turn_start' and source_participant_id=new.active_participant_id and remaining_target_turn_starts>1;
  return new;
end;$function$;

-- Exact live trigger definition
CREATE TRIGGER encounter_timed_effects_turn_start_expiry AFTER UPDATE OF active_participant_id ON public.encounters FOR EACH ROW WHEN ((old.active_participant_id IS DISTINCT FROM new.active_participant_id)) EXECUTE FUNCTION private.expire_encounter_timed_effects_on_turn_start_v1();
