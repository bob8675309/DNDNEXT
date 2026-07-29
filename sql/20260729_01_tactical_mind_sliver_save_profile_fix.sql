-- Phase 1R corrective migration: preserve the proven pre-1R saving-throw calculation
-- while retaining Mind Sliver's one-shot save penalty consumption.
-- The first Phase 1R migration incorrectly attempted to source all abilities and
-- save proficiencies from encounter_canonical_combat_snapshot_v1, whose contract
-- only exposes STR, DEX, proficiency bonus, AC, and HP.

create or replace function public.encounter_saving_throw_profile_internal_v1(
  p_participant_id uuid,
  p_ability text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private', 'auth'
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
  v_ability_mod integer := 0;
  v_base_bonus integer := 0;
  v_penalty integer := 0;
  v_fx public.encounter_timed_effects%rowtype;
  v_e public.encounters%rowtype;
  v_effect_id uuid := null;
  v_effect_source uuid := null;
begin
  if v_ability not in ('str','dex','con','int','wis','cha') then
    raise exception 'Invalid saving throw ability';
  end if;

  select * into v_p
  from public.encounter_participants
  where id = p_participant_id;
  if not found then raise exception 'Participant not found'; end if;

  select cs.sheet into v_sheet
  from public.character_sheets cs
  where cs.character_id = v_p.character_id;
  v_sheet := coalesce(v_sheet,'{}'::jsonb);

  begin
    v_score := coalesce(nullif(v_sheet->'abilities'->v_ability->>'score','')::integer,10);
  exception when others then
    v_score := 10;
  end;

  begin
    v_prof := coalesce(nullif(v_sheet->>'proficiencyBonus','')::integer,2);
  exception when others then
    v_prof := 2;
  end;

  v_class_key := lower(coalesce(v_sheet#>>'{meta,classKey}',v_sheet->>'classKey',''));
  select coalesce(c.saving_throws,'{}'::text[])
  into v_saves
  from public.class_catalog_preferred c
  where lower(c.class_key) = v_class_key
  limit 1;
  v_saves := coalesce(v_saves,'{}'::text[]);

  v_proficient := v_ability = any(v_saves);
  v_ability_mod := floor((v_score-10)/2.0)::integer;
  v_base_bonus := v_ability_mod + case when v_proficient then v_prof else 0 end;

  select * into v_fx
  from public.encounter_timed_effects e
  where e.participant_id = v_p.id
    and e.effect_key = 'mind_sliver_save_penalty'
    and e.remaining_target_turn_starts > 0
  order by e.created_at,e.id
  limit 1
  for update;

  if found then
    v_penalty := floor(random()*4)::integer+1;
    v_effect_id := v_fx.id;
    v_effect_source := v_fx.source_participant_id;

    delete from public.encounter_timed_effects
    where id = v_fx.id;

    select * into v_e
    from public.encounters
    where id = v_p.encounter_id;

    if found then
      insert into public.encounter_combat_log(
        encounter_id,round,turn_index,actor_participant_id,target_participant_id,event_type,summary,detail
      ) values (
        v_e.id,v_e.round,v_e.turn_index,v_effect_source,v_p.id,'effect_consumed',
        'Mind Sliver reduced '||v_p.display_name||'''s '||upper(v_ability)||' save by '||v_penalty||'.',
        jsonb_build_object(
          'effectId',v_effect_id,
          'effectKey','mind_sliver_save_penalty',
          'sourceParticipantId',v_effect_source,
          'targetParticipantId',v_p.id,
          'ability',v_ability,
          'savePenalty',v_penalty,
          'consumed',true
        )
      );
    end if;
  end if;

  return jsonb_build_object(
    'participantId',v_p.id,
    'ability',v_ability,
    'score',v_score,
    'abilityMod',v_ability_mod,
    'proficient',v_proficient,
    'proficiencyBonus',case when v_proficient then v_prof else 0 end,
    'baseSaveBonus',v_base_bonus,
    'savePenalty',v_penalty,
    'savePenaltyEffectId',v_effect_id,
    'savePenaltySourceId',v_effect_source,
    'saveBonus',v_base_bonus-v_penalty
  );
end;
$function$;

revoke all on function public.encounter_saving_throw_profile_internal_v1(uuid,text)
from public, anon, authenticated;
grant execute on function public.encounter_saving_throw_profile_internal_v1(uuid,text)
to service_role;

do $postconditions$
begin
  if has_function_privilege('authenticated','public.encounter_saving_throw_profile_internal_v1(uuid,text)','EXECUTE') then
    raise exception 'saving throw profile must remain private';
  end if;
  if has_function_privilege('anon','public.encounter_saving_throw_profile_internal_v1(uuid,text)','EXECUTE') then
    raise exception 'anon must not execute saving throw profile';
  end if;
  if not has_function_privilege('service_role','public.encounter_saving_throw_profile_internal_v1(uuid,text)','EXECUTE') then
    raise exception 'saving throw profile service-role access missing';
  end if;
end
$postconditions$;
