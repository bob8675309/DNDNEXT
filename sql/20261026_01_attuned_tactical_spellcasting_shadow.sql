-- PRIVATE READ-ONLY diagnostic for the existing tactical spellcasting profile.
-- The public profile, slot snapshots and all casting/damage RPCs remain unchanged.
-- Prerequisites: 20260727_12 tactical profile; 20261025_01/_02/_04/_06/_07.
-- Only service_role can invoke this comparison (no browser RPC).
create or replace function private.encounter_attuned_spellcasting_shadow_v1(
  p_participant_id uuid
) returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog,public,private,auth
as $shadow$
declare
  v_original jsonb;
  v_candidate jsonb;
  v_ability_result jsonb;
  v_gate jsonb;
  v_participant public.encounter_participants%rowtype;
  v_casting text;
  v_caster_mod integer;
  v_eligible_mod integer;
  v_prof integer;
  v_focus jsonb := '[]'::jsonb;
  v_focus_count integer := 0;
  v_assignment_override_count integer := 0;
  v_item record;
  v_payload jsonb;
  v_catalog jsonb;
  v_gate_item jsonb;
  v_attack_raw text;
  v_dc_raw text;
  v_unresolved jsonb := '[]'::jsonb;
begin
  -- This call preserves the existing profile's participant lookup, character
  -- permissions, class/casting ability, slots and known spell selection.
  v_original:=public.encounter_spellcasting_profile_v1(p_participant_id);
  select * into strict v_participant
    from public.encounter_participants where id=p_participant_id;
  if v_original->>'characterId' is distinct from v_participant.character_id::text
     or v_original->>'participantId' is distinct from v_participant.id::text then
    raise exception 'Tactical profile character/participant identity changed'
      using errcode='22023';
  end if;
  v_ability_result:=private.character_attuned_ability_shadow_v1(v_participant.character_id);
  if v_ability_result->>'attunementEnabled' = 'false' then
    return jsonb_build_object(
      'schemaVersion',1,'consumerEnforced',false,'attunementEnabled',false,
      'baseline',v_original,'shadow',v_original,'wouldChange',false,
      'tacticalSpellParityReady',false,'focusBonusApplicabilityVerified',false,
      'knownSpellOverridesVerified',false,'focusSourceAudit','[]'::jsonb,
      'unresolvedSources','[]'::jsonb
    );
  end if;
  if v_ability_result->>'attunementEnabled' is distinct from 'true' then
    raise exception 'Campaign source gate is not authoritative'
      using errcode='22023';
  end if;
  v_gate:=private.character_magic_effect_source_gate_shadow_v1(v_participant.character_id);
  if v_gate->>'attunementEnabled' is distinct from 'true' then
    raise exception 'Character item gate disagrees with campaign state'
      using errcode='22023';
  end if;
  v_candidate:=v_original;
  v_casting:=lower(btrim(coalesce(v_original->>'castingAbility','')));
  v_caster_mod:=case when (v_original->>'castingAbilityModifier') ~ '^-?[0-9]+$'
      then (v_original->>'castingAbilityModifier')::integer else null end;
  v_prof:=case when (v_original->>'proficiencyBonus') ~ '^-?[0-9]+$'
      then (v_original->>'proficiencyBonus')::integer else null end;
  if v_casting in ('str','dex','con','int','wis','cha') and v_prof is not null then
    if (v_ability_result#>>array['shadow','abilities',v_casting,'effectiveMod']) !~ '^-?[0-9]+$' then
      raise exception 'Attunement-selected casting modifier is invalid'
        using errcode='22023';
    end if;
    v_eligible_mod:=(v_ability_result#>>array['shadow','abilities',v_casting,'effectiveMod'])::integer;
    v_candidate:=jsonb_set(v_candidate,'{castingAbilityScore}',
      to_jsonb((v_ability_result#>>array['shadow','abilities',v_casting,'effectiveScore'])::integer),true);
    v_candidate:=jsonb_set(v_candidate,'{castingAbilityModifier}',to_jsonb(v_eligible_mod),true);
    v_candidate:=jsonb_set(v_candidate,'{spellAttackBonus}',to_jsonb(v_prof+v_eligible_mod),true);
    v_candidate:=jsonb_set(v_candidate,'{spellSaveDc}',to_jsonb(8+v_prof+v_eligible_mod),true);
    -- Current tactical profile uses the RAW sheet score. The canonical
    -- character effects resolver may include ability bonuses, so these
    -- baselines can diverge. Do not misrepresent that as full parity.
    if v_caster_mod is distinct from
       (v_ability_result#>>array['baseline','abilities',v_casting,'effectiveMod'])::integer then
      v_unresolved:=v_unresolved||'"tactical_raw_vs_equipment_ability_baseline_diverges"'::jsonb;
    end if;
  elsif coalesce((v_original->>'isClassCaster')::boolean,false) then
    v_unresolved:=v_unresolved||'"unrecognized_tactical_casting_ability_or_proficiency"'::jsonb;
  end if;

  -- Spell assignments can carry numeric/manual attack & save overrides,
  -- but this profile reports them as known-spell metadata and does not use
  -- them to form its aggregate attack/DC. Preserve metadata verbatim.
  select count(*) into v_assignment_override_count
    from jsonb_array_elements(coalesce(v_original->'knownSpells','[]'::jsonb)) spell
    where spell->>'attackBonusOverride' is not null
       or spell->>'saveDcOverride' is not null;
  if v_assignment_override_count>0 then
    v_unresolved:=v_unresolved||'"per_spell_override_origins_unverified"'::jsonb;
  end if;

  -- Report, but NEVER apply, focus spell bonus fields. Class eligibility,
  -- spell restrictions, stacking, instance-source trust and attunement
  -- exceptions have not passed the item-effects normalization gate.
  for v_gate_item in
    select value from jsonb_array_elements(v_gate->'items') order by value->>'inventoryItemId'
  loop
    select i.* into v_item from public.inventory_items i
      where i.id=(v_gate_item->>'inventoryItemId')::uuid and i.is_equipped is true;
    if not found then
      raise exception 'Verified equipped item disappeared from source gate'
        using errcode='22023';
    end if;
    v_catalog:='{}'::jsonb;
    select coalesce(ic.payload,'{}'::jsonb) into v_catalog
      from public.items_catalog ic
      where ic.item_key=coalesce(v_item.card_payload->>'item_key',
                                v_item.card_payload->>'item_id',v_item.item_id)
         or ic.item_key=v_item.item_id
         or lower(ic.item_name)=lower(v_item.item_name)
      order by
        case when ic.item_key=coalesce(v_item.card_payload->>'item_key',
                      v_item.card_payload->>'item_id',v_item.item_id) then 0
             when ic.item_key=v_item.item_id then 1 else 2 end,
        case when coalesce(ic.payload->>'edition','')='one' then 0 else 1 end
      limit 1;
    v_payload:=coalesce(v_catalog,'{}'::jsonb) || coalesce(v_item.card_payload,'{}'::jsonb);
    v_attack_raw:=nullif(btrim(coalesce(v_payload->>'bonusSpellAttack','')),'');
    v_dc_raw:=nullif(btrim(coalesce(v_payload->>'bonusSpellSaveDc','')),'');
    if v_attack_raw is null and v_dc_raw is null then continue; end if;
    v_focus_count:=v_focus_count+1;
    v_focus:=v_focus||jsonb_build_array(jsonb_build_object(
      'inventoryItemId',v_item.id,
      'catalogItemKey',v_item.item_id,
      'bonusSpellAttackRaw',v_attack_raw,
      'bonusSpellSaveDcRaw',v_dc_raw,
      'sourceMagicVerified',v_gate_item->'sourceMagicVerified',
      'selectedForCharacter',v_gate_item->'selectedForCharacter',
      'magicRiderEligible',v_gate_item->'magicRiderEligible',
      'claimedByAnotherCharacter',v_gate_item->'claimedByAnotherCharacter',
      'appliedToShadow',false,
      'unresolvedReason','focus_class_spell_applicability_and_stacking_unverified'
    ));
  end loop;
  if v_focus_count>0 then
    v_unresolved:=v_unresolved||'"focus_bonus_application_unverified"'::jsonb;
  end if;
  return jsonb_build_object(
    'schemaVersion',1,'consumerEnforced',false,'attunementEnabled',true,
    'baseline',v_original,'shadow',v_candidate,
    'wouldChange',v_original is distinct from v_candidate,
    'tacticalSpellParityReady',false,
    'focusBonusApplicabilityVerified',false,
    'knownSpellOverridesVerified',false,
    'fullEffectConsumerParityReady',false,
    'focusSourceAudit',v_focus,
    'unresolvedSources',v_unresolved,
    'baselineCastingModifier',v_caster_mod,
    'eligibleCastingModifier',v_eligible_mod,
    'slotsAndKnownSpellsPreserved',
      v_candidate->'slotSnapshot' is not distinct from v_original->'slotSnapshot'
      and v_candidate->'knownSpells' is not distinct from v_original->'knownSpells',
    'activeEncounterRowsUnchanged',true
  );
end;
$shadow$;
revoke all on function private.encounter_attuned_spellcasting_shadow_v1(uuid)
  from public,anon,authenticated;
grant execute on function private.encounter_attuned_spellcasting_shadow_v1(uuid)
  to service_role;
comment on function private.encounter_attuned_spellcasting_shadow_v1(uuid) is
'Read-only service-only comparison of exact tactical spellcasting profile and selected ability source; magic-focus bonuses and per-spell overrides are audited, not applied.';
