-- PRIVATE READ-ONLY rules-source diagnostic layered on draft #288.
-- Does not change 2024 Attack action costs, hand transitions, spell casting,
-- shield donning, resource flags, active grip, or attunement focus consumers.
-- Trusted server inventory/catalogue IDs; no caller supplied item properties.
create or replace function private.encounter_hand_rules_constraints_shadow_v1(
 p_participant_id uuid, p_spell_assignment_id uuid default null
) returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,private,auth
as $audit$
declare
 v_snapshot jsonb;
 v_character uuid;
 v_hand jsonb;
 v_item public.inventory_items%rowtype;
 v_catalog jsonb;
 v_payload jsonb;
 v_key text;
 v_kind text;
 v_props jsonb;
 v_two_handed boolean;
 v_versatile boolean;
 v_shield boolean;
 v_weapon boolean;
 v_focus_like boolean;
 v_occupied integer:=0;
 v_open integer:=0;
 v_item_audits jsonb:='[]'::jsonb;
 v_uncertainty jsonb:='[]'::jsonb;
 v_main uuid;
 v_off uuid;
 v_spell public.spells_catalog%rowtype;
 v_assignment public.character_spells%rowtype;
 v_components jsonb:='null'::jsonb;
 v_uses_s boolean;
 v_uses_m boolean;
 v_material text;
 v_spell_result jsonb:='null'::jsonb;
begin
 v_snapshot:=public.get_encounter_hand_snapshot_shadow_v1(p_participant_id);
 if v_snapshot->>'initialized' is distinct from 'true'
 or v_snapshot->>'snapshotInvalidated' is distinct from 'false'
 or exists (
   select 1 from jsonb_array_elements(coalesce(v_snapshot->'hands','[]'::jsonb)) h
   where h->>'stillValid' is distinct from 'true'
 ) then
   raise exception 'Cannot audit absent, invalidated, or stale participant hands'
     using errcode='55000';
 end if;
 v_character:=(v_snapshot->>'characterId')::uuid;
 if v_character is null then
   raise exception 'Encounter participant character not established'
     using errcode='22023';
 end if;
 select inventory_item_id into v_main
 from public.encounter_hand_snapshot_items_shadow_v1
 where participant_id=p_participant_id and hand='main';
 select inventory_item_id into v_off
 from public.encounter_hand_snapshot_items_shadow_v1
 where participant_id=p_participant_id and hand='off';
 v_occupied := (case when v_main is null then 0 else 1 end)
              + (case when v_off is null then 0 else 1 end);
 v_open:=2-v_occupied;

 for v_hand in
   select value from jsonb_array_elements(coalesce(v_snapshot->'hands','[]'::jsonb))
 loop
   select * into strict v_item from public.inventory_items
   where id=(v_hand->>'inventoryItemId')::uuid;
   if not private.character_staged_hand_item_valid_v1(v_character,v_item.id) then
     raise exception 'A captured item lost exact equipped character custody'
       using errcode='55000';
   end if;

   -- Only exact source IDs, never fuzzy name matching. Source identity must
   -- not be fabricated from a possibly homemade or imported display name.
   v_key:=coalesce(nullif(btrim(v_item.card_payload->>'item_key'),''),
                   nullif(btrim(v_item.card_payload->>'item_id'),''),
                   nullif(btrim(v_item.item_id),''));
   v_catalog:=null;
   select ic.payload into v_catalog from public.items_catalog ic
   where ic.item_key=v_key order by ic.item_key limit 1;
   v_payload:=coalesce(v_catalog,'{}'::jsonb)
           ||coalesce(v_item.card_payload,'{}'::jsonb);
   v_props:=v_payload->'property';
   if jsonb_typeof(v_props) is distinct from 'array' then
     v_props:='[]'::jsonb;
   end if;
   select exists(
     select 1 from jsonb_array_elements_text(v_props) x
     where upper(split_part(btrim(x),'|',1))='2H'
   ) into v_two_handed;
   select exists(
     select 1 from jsonb_array_elements_text(v_props) x
     where upper(split_part(btrim(x),'|',1))='V'
   ) into v_versatile;
   v_kind:=lower(btrim(coalesce(v_item.item_type,
       v_payload->>'item_type',v_payload->>'uiType','')));
   v_shield:=v_kind like '%shield%'
     or upper(split_part(coalesce(v_payload->>'type',''),'|',1))='S';
   v_weapon:=v_kind like '%weapon%'
     or upper(split_part(coalesce(v_payload->>'type',''),'|',1)) in ('M','R');
   v_focus_like:=v_kind like '%rod%' or v_kind like '%wand%'
     or lower(coalesce(v_payload->>'type','')) like 'rd|%'
     or lower(coalesce(v_payload->>'type','')) like 'wd|%';
   v_item_audits:=v_item_audits||jsonb_build_array(jsonb_build_object(
     'inventoryItemId',v_item.id,
     'hand',v_hand->>'hand','sourceKey',v_key,
     'catalogExactMatch',v_catalog is not null,
     'rawPropertyCodes',v_props,
     'twoHandedPropertyObserved',v_two_handed,
     'versatilePropertyObserved',v_versatile,
     'shieldTypeCandidate',v_shield,
     'weaponTypeCandidate',v_weapon,
     'focusTypeCandidate',v_focus_like,
     'shieldDonDoffUtilizeContext',v_shield,
     'attackActionWeaponInteractionContext',v_weapon,
     'twoHandedAttackGripConflictCandidate',v_two_handed
        and v_occupied=2,
     'twoHandedAttackGripVerified',false,
     'animatedShieldExceptionVerified',false,
     'shieldDonDoffPaid',false,
     'attackEquipInteractionPaid',false,
     'activeHeldVerified',false
   ));
   if v_catalog is null then
     v_uncertainty:=v_uncertainty||
       jsonb_build_array('missing_exact_catalogue_property_source');
   end if;
   if v_two_handed and v_occupied=2 then
     v_uncertainty:=v_uncertainty||
       jsonb_build_array('two_handed_attack_grip_conflicts_with_other_hand');
   end if;
   if v_shield then
     v_uncertainty:=v_uncertainty||
       jsonb_build_array('shield_don_doff_and_special_exceptions_not_integrated');
   end if;
 end loop;

 if p_spell_assignment_id is not null then
   select * into v_assignment from public.character_spells
    where id=p_spell_assignment_id and character_id=v_character;
   if not found then
     raise exception 'Spell assignment does not belong to participant character'
       using errcode='22023';
   end if;
   select * into v_spell from public.spells_catalog
   where id=v_assignment.spell_id;
   if not found then
     raise exception 'Exact spell source missing' using errcode='P0002';
   end if;
   v_uses_s:=coalesce(v_spell.components_s,false);
   v_uses_m:=coalesce(v_spell.components_m,false);
   v_material:=v_spell.material_text;
   v_components:=jsonb_build_object(
     'verbal',v_spell.components_v,
     'somatic',v_spell.components_s,
     'material',v_spell.components_m,
     'materialText',v_material,
     'exactSpellId',v_spell.id,'spellKey',v_spell.spell_key
   );
   v_spell_result:=jsonb_build_object(
     'spellAssignmentId',p_spell_assignment_id,
     'componentSource',v_components,
     'unoccupiedHandSlots',v_open,
     'somaticHandSignal',case
       when not v_uses_s then 'no_somatic_component'
       when v_open>0 then 'free_hand_slot_candidate_not_grip_proof'
       else 'requires_verified_somatic_exception_or_free_hand'
     end,
     'materialAccessSignal',case
       when not v_uses_m then 'no_material_component'
       when v_open>0 then 'free_hand_slot_candidate_not_material_proof'
       else 'focus_or_component_access_unverified'
     end,
     'warCasterExceptionVerified',false,
     'materialCostConsumptionVerified',false,
     'spellFocusSubstitutionVerified',false,
     'spellCastEligibilityVerified',false
   );
 end if;
 return jsonb_build_object(
   'schemaVersion',1,'participantId',p_participant_id,
   'characterId',v_character,
   'snapshotVersion',v_snapshot->'snapshotVersion',
   'capturedHands',v_item_audits,'occupiedHands',v_occupied,
   'unoccupiedHands',v_open,
   'spellComponents',v_spell_result,
   'unresolvedRuleSignals',v_uncertainty,
   'attackActionWeaponEquipContextOnly',true,
   'shieldUtilizeActionContextOnly',true,
   'attackActionInteractionPaid',false,
   'shieldUtilizeActionPaid',false,
   'twoHandedAndShieldRulesVerified',false,
   'somaticMaterialRulesVerified',false,
   'activeHandsVerified',false,
   'focusBonusApplied',false,
   'combatConsumerEnforced',false
 );
end;
$audit$;
revoke all on function private.encounter_hand_rules_constraints_shadow_v1(uuid,uuid)
 from public,anon,authenticated;
grant execute on function private.encounter_hand_rules_constraints_shadow_v1(uuid,uuid)
 to service_role;
comment on function private.encounter_hand_rules_constraints_shadow_v1(uuid,uuid)
 is 'Private read-only exact catalogue weapon property and spell component evidence; not action cost, held-grip, shield or focus authority.';
