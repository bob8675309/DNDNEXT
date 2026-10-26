-- INERT, service-only spell catalogue membership and hand-slot evidence.
-- No equipped slot proves what was ACTIVELY HELD when a cast was resolved.
-- Catalogue class membership proves a listed class, NOT a class spell grant.
-- Requires 20261026_03 and prior tactical preflight shadows. NO DML.
create or replace function private.encounter_attuned_spell_list_hand_evidence_v1(
 p_participant_id uuid,p_assignment_id uuid
) returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,private,auth
as $shadow$
declare
 v_prior jsonb;
 v_character_id uuid;
 v_assignment public.character_spells%rowtype;
 v_spell public.spells_catalog%rowtype;
 v_profile_class text;
 v_assigned_class text;
 v_class_count integer;
 v_matching_progression integer;
 v_membership boolean:=false;
 v_catalog_present boolean:=false;
 v_status text;
 v_hand jsonb:='[]'::jsonb;
 v_hand_record record;
 v_gate jsonb;
 v_gate_id jsonb;
 v_item public.inventory_items%rowtype;
 v_occupants jsonb;
 v_count integer;
 v_conflicts integer:=0;
 v_ambiguities jsonb:='[]'::jsonb;
 v_total_hand_candidates integer:=0;
 v_weapon_slot_count integer:=0;
begin
 v_prior:=private.encounter_attuned_focus_provenance_shadow_v1(
   p_participant_id,p_assignment_id);
 if v_prior->>'attunementEnabled'='false' then
   return jsonb_build_object(
     'schemaVersion',1,'attunementEnabled',false,'consumerEnforced',false,
     'baselineProvenance',v_prior,
     'spellListMembershipObserved',false,
     'classGrantVerified',false,'activeHandsVerified',false,
     'focusBonusApplied',false,'handSlotEvidence','[]'::jsonb,
     'classSpellListStatus','attunement_off_not_evaluated',
     'sourceUnresolved','[]'::jsonb
   );
 end if;
 if v_prior->>'attunementEnabled' is distinct from 'true' then
   raise exception 'Missing trusted campaign attunement state'
     using errcode='22023';
 end if;
 v_character_id:=(v_prior->'baselinePreflight'->>'characterId')::uuid;
 select * into strict v_assignment from public.character_spells
   where id=p_assignment_id and character_id=v_character_id;
 select * into strict v_spell from public.spells_catalog
   where id=v_assignment.spell_id;
 v_profile_class:=lower(btrim(coalesce(
   v_prior->'baselinePreflight'->'baselineProfile'->>'classKey','')));
 v_assigned_class:=lower(btrim(coalesce(v_assignment.source_label,'')));
 select count(*),
        count(*) filter(where lower(btrim(coalesce(cc.class_key,'')))=v_profile_class)
 into v_class_count,v_matching_progression
 from public.character_progression cp
 join public.class_catalog cc on cc.id=cp.class_id
 where cp.character_id=v_character_id;

 -- Exact referenced spell identity, not name similarity, a broad ruleset
 -- fallback, or assignment prose. Class list can be incomplete/homebrew.
 select exists(select 1 from unnest(coalesce(v_spell.classes,array[]::text[])) c
   where lower(btrim(c))=v_profile_class) into v_membership;
 v_catalog_present:=coalesce(cardinality(v_spell.classes),0)>0;
 v_status:=case
   when lower(btrim(coalesce(v_assignment.source_type,'')))<>'class'
     then 'not_class_granted_assignment'
   when v_class_count<>1 or v_matching_progression<>1
     then 'class_progression_ambiguous'
   when v_assigned_class<>v_profile_class
     then 'assignment_class_label_mismatch'
   when not v_catalog_present
     then 'catalog_class_list_missing'
   when v_membership
     then 'catalog_lists_class_but_grant_unverified'
   else 'exact_catalog_does_not_list_class'
 end;

 v_gate:=private.character_magic_effect_source_gate_shadow_v1(v_character_id);
 if v_gate->>'attunementEnabled' is distinct from 'true' then
   raise exception 'Item ownership gate disagrees with campaign'
     using errcode='22023';
 end if;

 -- Read the WHOLE equipped inventory for each explicit hand, not just focus
 -- sources: a weapon/shield occupying that slot also conflicts with a rod.
 -- Shared-account physical custody may project to multiple characters;
 -- record ambiguity rather than deciding who holds the item.
 for v_hand_record in
   select unnest(array['main_hand','off_hand']) as slot
 loop
   v_count:=0; v_occupants:='[]'::jsonb;
   for v_gate_id in select value from jsonb_array_elements(v_gate->'items')
   loop
     select * into strict v_item from public.inventory_items
       where id=(v_gate_id->>'inventoryItemId')::uuid
         and is_equipped is true;
     if lower(btrim(coalesce(v_item.equip_slot,'')))<>v_hand_record.slot then
       continue;
     end if;
     v_count:=v_count+1;
     v_occupants:=v_occupants||jsonb_build_array(jsonb_build_object(
       'inventoryItemId',v_item.id,
       'sourceMagicVerified',v_gate_id->'sourceMagicVerified',
       'selectedForCharacter',v_gate_id->'selectedForCharacter',
       'accountScopeAmbiguous',v_gate_id->'accountScopeAmbiguous',
       'activeHoldVerified',false
     ));
     if coalesce((v_gate_id->>'accountScopeAmbiguous')::boolean,false) then
       v_ambiguities:=v_ambiguities||'"shared_account_hand_custody_unverified"'::jsonb;
     end if;
   end loop;
   v_total_hand_candidates:=v_total_hand_candidates+v_count;
   if v_count>1 then
     v_conflicts:=v_conflicts+1;
     v_ambiguities:=v_ambiguities||'"multiple_equipped_items_same_hand_slot"'::jsonb;
   end if;
   v_hand:=v_hand||jsonb_build_array(jsonb_build_object(
     'equipSlot',v_hand_record.slot,'equippedCount',v_count,
     'occupants',v_occupants,'conflicted',v_count>1,
     'activeHoldVerified',false
   ));
 end loop;
 select count(*) into v_weapon_slot_count
 from jsonb_array_elements(v_prior->'focusSignals') f
 where (f->>'equipSlot') ~ '^weapon_[0-9]+$'
   and f->>'requirement'='held';
 if v_weapon_slot_count>0 then
   v_ambiguities:=v_ambiguities||'"weapon_slot_focus_not_active_hand_proof"'::jsonb;
 end if;
 return jsonb_build_object(
   'schemaVersion',1,'attunementEnabled',true,'consumerEnforced',false,
   'participantId',p_participant_id,'spellAssignmentId',p_assignment_id,
   'baselineProvenance',v_prior,
   'spellCatalogId',v_spell.id,'spellKey',v_spell.spell_key,
   'catalogClasses',to_jsonb(v_spell.classes),
   'profileClass',v_profile_class,'assignedClassLabel',v_assigned_class,
   'catalogSpellListMembership',v_membership,
   'spellListMembershipObserved',v_status='catalog_lists_class_but_grant_unverified',
   'classSpellListStatus',v_status,
   'classGrantVerified',false,'multiclassSourceVerified',false,
   'handSlotEvidence',v_hand,
   'explicitHandSlotsWithConflicts',v_conflicts,
   'explicitHandOccupants',v_total_hand_candidates,
   'ambiguousWeaponFocusSlots',v_weapon_slot_count,
   'activeHandsVerified',false,'wearConditionVerified',false,
   'focusStackingVerified',false,'focusBonusApplied',false,
   'fullEffectConsumerParityReady',false,
   'sourceUnresolved',v_ambiguities
 );
end;
$shadow$;
revoke all on function private.encounter_attuned_spell_list_hand_evidence_v1(uuid,uuid)
 from public,anon,authenticated;
grant execute on function private.encounter_attuned_spell_list_hand_evidence_v1(uuid,uuid)
 to service_role;
comment on function private.encounter_attuned_spell_list_hand_evidence_v1(uuid,uuid)
 is 'Read-only exact spell-catalog class membership and hand slot collision signals. Neither a class grant nor active held/focus effect authority.';
