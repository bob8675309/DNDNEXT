-- PRIVATE diagnostic of held/worn SLOT SIGNALS and spell origin only.
-- An equip_slot is NOT proof an item is actively held/worn during a cast.
-- Do not use this for effect eligibility or spell attack/save DC calculations.
-- Prior: 20261026_02_attuned_spell_execution_preflight_shadow.sql.
create or replace function private.encounter_attuned_focus_provenance_shadow_v1(
  p_participant_id uuid,p_assignment_id uuid
) returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,private,auth
as $shadow$
declare
  v_preflight jsonb;
  v_gate jsonb;
  v_focus_item jsonb;
  v_gate_item jsonb;
  v_item public.inventory_items%rowtype;
  v_assignment public.character_spells%rowtype;
  v_class text;
  v_source_label text;
  v_spell_origin text;
  v_class_count integer;
  v_match_count integer;
  v_slot text;
  v_requirement text;
  v_slot_signal text;
  v_signal_compatible boolean;
  v_scope text;
  v_eligible_selected boolean;
  v_potential_count integer:=0;
  v_selected_count integer:=0;
  v_items jsonb:='[]'::jsonb;
  v_warnings jsonb:='[]'::jsonb;
begin
  v_preflight:=private.encounter_attuned_spell_execution_preflight_shadow_v1(
    p_participant_id,p_assignment_id
  );
  if v_preflight->>'attunementEnabled'='false' then
    return jsonb_build_object(
      'schemaVersion',1,'consumerEnforced',false,'attunementEnabled',false,
      'baselinePreflight',v_preflight,'focusSignals','[]'::jsonb,
      'sourceProofReady',false,'heldOrWornVerified',false,
      'stackingVerified',false,'spellSourceVerified',false,
      'focusBonusApplied',false,'unresolved','[]'::jsonb
    );
  end if;
  if v_preflight->>'attunementEnabled' is distinct from 'true' then
    raise exception 'Campaign attunement state is not trustworthy' using errcode='22023';
  end if;
  select * into strict v_assignment from public.character_spells
    where id=p_assignment_id and character_id=(v_preflight->>'characterId')::uuid;
  v_class:=lower(btrim(coalesce(v_preflight->'baselineProfile'->>'classKey','')));
  v_source_label:=lower(btrim(coalesce(v_assignment.source_label,'')));

  -- A class label matching progression is still not a verified spell-list
  -- membership proof: item-granted, multiclass and copied assignments exist.
  select count(*),count(*) filter(where lower(btrim(coalesce(cc.class_key,'')))=v_class)
    into v_class_count,v_match_count
    from public.character_progression cp
    join public.class_catalog cc on cc.id=cp.class_id
    where cp.character_id=(v_preflight->>'characterId')::uuid;
  v_spell_origin:=case
    when lower(btrim(coalesce(v_assignment.source_type,'')))<>'class'
      then 'nonclass_assignment_requires_provenance'
    when v_class_count<>1 then 'multiclass_or_progression_ambiguous'
    when v_match_count<>1 then 'progression_class_mismatch'
    when v_source_label<>v_class then 'assignment_class_label_mismatch'
    else 'class_label_matches_progression_but_spell_list_unverified'
  end;

  v_gate:=private.character_magic_effect_source_gate_shadow_v1(
    (v_preflight->>'characterId')::uuid);
  for v_focus_item in
    select value from jsonb_array_elements(coalesce(v_preflight->'focusSourceCandidates','[]'::jsonb))
  loop
    select * into strict v_item from public.inventory_items i
    where i.id=(v_focus_item->>'inventoryItemId')::uuid and i.is_equipped is true;
    select value into v_gate_item from jsonb_array_elements(v_gate->'items')
      where value->>'inventoryItemId'=v_item.id::text limit 1;
    if v_gate_item is null then
      raise exception 'Focus is absent from trusted character inventory source gate'
        using errcode='22023';
    end if;
    v_slot:=lower(btrim(coalesce(v_item.equip_slot,'')));
    v_scope:=coalesce(v_focus_item->>'scopeStatus','focus_effect_scope_unclassified');
    v_requirement:=case
      when lower(coalesce(v_focus_item->>'catalogItemKey','')) like '%amulet of the devout%'
        then 'worn'
      when lower(coalesce(v_focus_item->>'catalogItemKey','')) like '%rod of the pact keeper%'
        or lower(coalesce(v_focus_item->>'catalogItemKey','')) like '%wand of the war mage%'
        or lower(coalesce(v_focus_item->>'catalogItemKey','')) like '%arcane grimoire%'
        then 'held'
      else 'unknown'
    end;
    v_slot_signal:=case
      when v_requirement='held' and v_slot in ('main_hand','off_hand')
        then 'hand_slot_candidate_not_active_hold_proof'
      when v_requirement='held' and v_slot ~ '^weapon_[0-9]+$'
        then 'weapon_slot_does_not_prove_active_hold'
      when v_requirement='worn' and v_slot in ('neck','amulet','holy_symbol','accessory','trinket')
        then 'wear_slot_candidate_not_worn_proof'
      when v_requirement='unknown'
        then 'item_condition_unknown'
      else 'slot_not_sufficient_for_required_condition'
    end;
    v_signal_compatible:=v_slot_signal in (
      'hand_slot_candidate_not_active_hold_proof',
      'weapon_slot_does_not_prove_active_hold',
      'wear_slot_candidate_not_worn_proof');
    v_eligible_selected:=coalesce((v_gate_item->>'magicRiderEligible')::boolean,false)
      and coalesce((v_gate_item->>'selectedForCharacter')::boolean,false);
    if v_eligible_selected then v_selected_count:=v_selected_count+1; end if;
    if v_eligible_selected and v_signal_compatible
       and v_scope not in (
         'class_mismatch','spell_has_no_attack_roll',
         'spell_class_attribution_unverified',
         'focus_effect_scope_unclassified')
       and v_spell_origin='class_label_matches_progression_but_spell_list_unverified'
       and coalesce((v_gate_item->>'accountScopeAmbiguous')::boolean,false)=false
    then
      v_potential_count:=v_potential_count+1;
    end if;
    v_items:=v_items||jsonb_build_array(jsonb_build_object(
      'inventoryItemId',v_item.id,
      'equipSlot',v_item.equip_slot,
      'requirement',v_requirement,
      'slotSignal',v_slot_signal,
      'slotCouldBeCompatible',v_signal_compatible,
      'isEquipped',true,
      'sourceMagicVerified',v_gate_item->'sourceMagicVerified',
      'selectedForCharacter',v_gate_item->'selectedForCharacter',
      'magicRiderEligible',v_gate_item->'magicRiderEligible',
      'accountScopeAmbiguous',v_gate_item->'accountScopeAmbiguous',
      'claimedByAnotherCharacter',v_gate_item->'claimedByAnotherCharacter',
      'spellScopeStatus',v_scope,
      'spellOriginSignal',v_spell_origin,
      'activeHoldVerified',false,
      'wornConditionVerified',false,
      'sourceSpellListMembershipVerified',false,
      'stackingVerified',false,
      'bonusApplied',false
    ));
  end loop;
  if v_selected_count>1 then
    v_warnings:=v_warnings||'"multiple_selected_focus_sources_no_stacking_rule"'::jsonb;
  end if;
  if v_potential_count>1 then
    v_warnings:=v_warnings||'"multiple_plausible_focus_sources_unresolved"'::jsonb;
  end if;
  if v_spell_origin<>'class_label_matches_progression_but_spell_list_unverified' then
    v_warnings:=v_warnings||'"spell_origin_unverified"'::jsonb;
  end if;
  return jsonb_build_object(
    'schemaVersion',1,'consumerEnforced',false,'attunementEnabled',true,
    'participantId',p_participant_id,'spellAssignmentId',p_assignment_id,
    'baselinePreflight',v_preflight,'focusSignals',v_items,
    'selectedFocusCount',v_selected_count,
    'plausibleFocusCount',v_potential_count,
    'spellOriginSignal',v_spell_origin,
    'sourceProofReady',false,'heldOrWornVerified',false,
    'stackingVerified',false,'spellSourceVerified',false,
    'focusBonusApplied',false,'unresolved',v_warnings
  );
end;
$shadow$;
revoke all on function private.encounter_attuned_focus_provenance_shadow_v1(uuid,uuid)
 from public,anon,authenticated;
grant execute on function private.encounter_attuned_focus_provenance_shadow_v1(uuid,uuid)
 to service_role;
comment on function private.encounter_attuned_focus_provenance_shadow_v1(uuid,uuid)
 is 'Diagnostic equip-slot and class-provenance signals only; never claim held/worn state, bonus stacking or live casting eligibility.';
