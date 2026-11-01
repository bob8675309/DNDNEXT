-- P2 HOLD ONLY: cross-RPC NPC spell visibility, not a migration.
-- Original public v2 pg_get_functiondef MD5 d2a41429785f5c55f6c5b941d6ed6d88
-- Original v2 copies full profile plus persistentSlots and can sync DB.
-- Renamed private snapshot cannot be called by ordinary API users.
CREATE OR REPLACE FUNCTION private.encounter_spellcasting_profile_v2_full_candidate_v1(p_participant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
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
      'poolKey',cs.pool_key,'slotLevel',cs.slot_level,'max',cs.slots_max,
      'remaining',cs.slots_remaining,'rechargeKey',cs.recharge_key
    ) order by cs.pool_key,cs.slot_level),'[]'::jsonb)
    into v_persistent
    from public.character_spell_slots cs
    where cs.character_id=v_character_id;

    v_mismatch:=exists(
      select 1
      from public.encounter_spell_slots es
      left join public.character_spell_slots cs
        on cs.character_id=v_character_id and cs.pool_key=es.pool_key and cs.slot_level=es.slot_level
      where es.participant_id=p_participant_id
        and (cs.character_id is null or es.slots_max<>cs.slots_max or es.slots_remaining<>cs.slots_remaining)
    ) or exists(
      select 1
      from public.character_spell_slots cs
      left join public.encounter_spell_slots es
        on es.participant_id=p_participant_id and es.pool_key=cs.pool_key and es.slot_level=cs.slot_level
      where cs.character_id=v_character_id and es.id is null
    );
  end if;

  return coalesce(v_profile,'{}'::jsonb)||jsonb_build_object(
    'resourceBridgeVersion',1,
    'persistentResourcesLinked',v_character_id is not null,
    'persistentSlotState',coalesce(v_persistent,'[]'::jsonb),
    'persistentSlotMismatch',v_mismatch
  );
end;
$function$

revoke all on function private.encounter_spellcasting_profile_v2_full_candidate_v1(uuid) from public,anon,authenticated;

-- Public compatibility wrapper, held for research ONLY.
-- Early exit for delegation-only access prevents both persistent slot
-- disclosure AND the legacy v2 synchronization side effect.
create or replace function public.encounter_spellcasting_profile_v2(p_participant_id uuid)
returns jsonb language plpgsql security definer
set search_path to 'pg_catalog','public','private','auth'
as $scope$
declare
  v_profile jsonb;
begin
  v_profile:=public.encounter_spellcasting_profile_v1(p_participant_id);
  if v_profile->>'visibilityScope'='delegated-combat' then
    return v_profile;
  end if;
  -- Only pre-existing full-source/explicit-direct/Admin/service callers
  -- reach the complete original v2 code; this calls the new v1 wrapper,
  -- whose legacy branch preserves the exact original full profile.
  return private.encounter_spellcasting_profile_v2_full_candidate_v1(p_participant_id);
end $scope$;
revoke all on function public.encounter_spellcasting_profile_v2(uuid) from public,anon;
grant execute on function public.encounter_spellcasting_profile_v2(uuid)
 to authenticated,service_role;
