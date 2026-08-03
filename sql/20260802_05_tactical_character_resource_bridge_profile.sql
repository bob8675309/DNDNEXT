begin;

-- Versioned tactical profile enrichment. Existing v1 remains unchanged for all spell adapters.
create or replace function public.encounter_spellcasting_profile_v2(p_participant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_profile jsonb;
  v_character_id uuid;
  v_persistent jsonb:='[]'::jsonb;
  v_mismatch boolean:=false;
begin
  v_profile:=public.encounter_spellcasting_profile_v1(p_participant_id);

  select character_id into v_character_id
  from public.encounter_participants
  where id=p_participant_id;

  if v_character_id is not null then
    perform private.sync_character_spell_slots_v1(v_character_id);

    select coalesce(jsonb_agg(jsonb_build_object(
      'poolKey',cs.pool_key,
      'slotLevel',cs.slot_level,
      'max',cs.slots_max,
      'remaining',cs.slots_remaining,
      'rechargeKey',cs.recharge_key
    ) order by cs.pool_key,cs.slot_level),'[]'::jsonb)
    into v_persistent
    from public.character_spell_slots cs
    where cs.character_id=v_character_id;

    v_mismatch:=exists(
      select 1
      from public.encounter_spell_slots es
      left join public.character_spell_slots cs
        on cs.character_id=v_character_id
       and cs.pool_key=es.pool_key
       and cs.slot_level=es.slot_level
      where es.participant_id=p_participant_id
        and (
          cs.character_id is null
          or es.slots_max<>cs.slots_max
          or es.slots_remaining<>cs.slots_remaining
        )
    ) or exists(
      select 1
      from public.character_spell_slots cs
      left join public.encounter_spell_slots es
        on es.participant_id=p_participant_id
       and es.pool_key=cs.pool_key
       and es.slot_level=cs.slot_level
      where cs.character_id=v_character_id
        and es.id is null
    );
  end if;

  return coalesce(v_profile,'{}'::jsonb)||jsonb_build_object(
    'resourceBridgeVersion',1,
    'persistentResourcesLinked',v_character_id is not null,
    'persistentSlotState',coalesce(v_persistent,'[]'::jsonb),
    'persistentSlotMismatch',v_mismatch
  );
end;
$function$;

revoke all on function public.encounter_spellcasting_profile_v2(uuid) from public, anon;
grant execute on function public.encounter_spellcasting_profile_v2(uuid) to authenticated, service_role;

comment on function public.encounter_spellcasting_profile_v2(uuid) is
  'Returns the guarded tactical spellcasting profile plus persistent character slot state and mismatch metadata.';

do $postconditions$
begin
  if not has_function_privilege('authenticated','public.encounter_spellcasting_profile_v2(uuid)','EXECUTE') then
    raise exception 'authenticated tactical resource profile v2 access missing';
  end if;
  if has_function_privilege('anon','public.encounter_spellcasting_profile_v2(uuid)','EXECUTE') then
    raise exception 'anon must not read tactical resource profile v2';
  end if;
end;
$postconditions$;

commit;
