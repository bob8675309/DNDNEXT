-- INERT tactical spell EXECUTION PREFLIGHT (not a casting RPC).
-- DO NOT call encounter_cast_spell_v* or spellcasting_profile_v2 from here:
-- real writers consume slots/actions; profile_v2 syncs persistent resources.
-- Must remain service-role-only, read-only, and NOT a gameplay consumer.
create or replace function private.encounter_attuned_spell_execution_preflight_shadow_v1(
 p_participant_id uuid,p_assignment_id uuid
) returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,private,auth
as $shadow$
declare
 v_participant public.encounter_participants%rowtype;
 v_assignment public.character_spells%rowtype;
 v_spell public.spells_catalog%rowtype;
 v_compare jsonb;
 v_abilities jsonb;
 v_baseline jsonb;
 v_candidate jsonb;
 v_casting text;
 v_class text;
 v_base_score integer;
 v_base_mod integer;
 v_next_score integer;
 v_next_mod integer;
 v_prof integer;
 v_attack_baseline integer;
 v_attack_candidate integer;
 v_save_baseline integer;
 v_save_candidate integer;
 v_focus jsonb:='[]'::jsonb;
 v_focus_item jsonb;
 v_scope text;
 v_assigned_class text;
 v_key text;
 v_attack_only boolean;
 v_focus_pending_count integer:=0;
 v_override_flags jsonb:='[]'::jsonb;
 v_unresolved jsonb:='[]'::jsonb;
begin
 if p_participant_id is null or p_assignment_id is null then
   raise exception 'Encounter participant and spell assignment are required'
     using errcode='22023';
 end if;
 select * into v_participant from public.encounter_participants
   where id=p_participant_id;
 if not found or v_participant.character_id is null then
   raise exception 'Unknown encounter participant' using errcode='P0002';
 end if;
 select * into v_assignment from public.character_spells
   where id=p_assignment_id and character_id=v_participant.character_id;
 if not found then
   raise exception 'Spell assignment is not owned by the encounter character'
     using errcode='22023';
 end if;
 select * into v_spell from public.spells_catalog where id=v_assignment.spell_id;
 if not found then
   raise exception 'Spell catalog identity missing' using errcode='P0002';
 end if;

 -- Reuse the previous read-only exact-profile+item-source shadow. It calls
 -- spellcasting_profile_v1 (read-only), NEVER profile_v2 (resource sync).
 v_compare:=private.encounter_attuned_spellcasting_shadow_v1(p_participant_id);
 v_baseline:=v_compare->'baseline';
 v_candidate:=v_compare->'shadow';
 v_class:=lower(btrim(coalesce(v_baseline->>'classKey','')));
 v_casting:=lower(btrim(coalesce(nullif(btrim(v_assignment.casting_stat),''),
                              v_baseline->>'castingAbility','')));
 v_prof:=case when (v_baseline->>'proficiencyBonus') ~ '^[0-9]+$'
               then (v_baseline->>'proficiencyBonus')::integer else null end;

 if v_compare->>'attunementEnabled'='false' then
   return jsonb_build_object(
     'schemaVersion',1,'consumerEnforced',false,'attunementEnabled',false,
     'participantId',p_participant_id,'characterId',v_participant.character_id,
     'spellAssignmentId',p_assignment_id,
     'baselineProfile',v_baseline,'shadowProfile',v_baseline,
     'slotSnapshot',v_baseline->'slotSnapshot',
     'knownSpells',v_baseline->'knownSpells',
     'focusApplied',false,'writerExecuted',false,
     'executionParityReady',false,'overrideProvenanceReady',false,
     'focusEligibilityVerified',false,'unresolvedSources','[]'::jsonb
   );
 end if;
 if v_compare->>'attunementEnabled' is distinct from 'true' then
   raise exception 'Missing trusted spell comparison state' using errcode='22023';
 end if;
 if v_casting not in ('str','dex','con','int','wis','cha') or v_prof is null then
   raise exception 'Spell casting ability or proficiency is not verified'
     using errcode='22023';
 end if;
 v_abilities:=private.character_attuned_ability_shadow_v1(v_participant.character_id);
 v_base_score:=private.encounter_ability_score_v1(v_participant.character_id,v_casting);
 v_base_mod:=floor((coalesce(v_base_score,10)-10)/2.0)::integer;
 if (v_abilities#>>array['shadow','abilities',v_casting,'effectiveMod']) !~ '^-?[0-9]+$'
 or (v_abilities#>>array['shadow','abilities',v_casting,'effectiveScore']) !~ '^[0-9]+$' then
   raise exception 'Selected casting ability data is invalid' using errcode='22023';
 end if;
 v_next_mod:=(v_abilities#>>array['shadow','abilities',v_casting,'effectiveMod'])::integer;
 v_next_score:=(v_abilities#>>array['shadow','abilities',v_casting,'effectiveScore'])::integer;

 -- Mirrors the reviewed spell-specific writers' pattern. The actual routing,
 -- action economy, saves and dice remain in their original v1..v13 RPCs.
 -- Assignment overrides are preserved even if their source is unverified.
 v_attack_baseline:=coalesce(v_assignment.attack_bonus_override,v_base_mod+v_prof);
 v_attack_candidate:=coalesce(v_assignment.attack_bonus_override,v_next_mod+v_prof);
 v_save_baseline:=coalesce(v_assignment.save_dc_override,8+v_base_mod+v_prof);
 v_save_candidate:=coalesce(v_assignment.save_dc_override,8+v_next_mod+v_prof);
 if v_assignment.attack_bonus_override is not null then
   v_override_flags:=v_override_flags||'"attack_bonus_override_origin_unverified"'::jsonb;
 end if;
 if v_assignment.save_dc_override is not null then
   v_override_flags:=v_override_flags||'"save_dc_override_origin_unverified"'::jsonb;
 end if;
 if v_casting is distinct from lower(btrim(coalesce(v_baseline->>'castingAbility',''))) then
   v_unresolved:=v_unresolved||'"spell_assignment_casting_stat_differs_from_class_profile"'::jsonb;
 end if;
 if v_base_mod is distinct from
      (v_abilities#>>array['baseline','abilities',v_casting,'effectiveMod'])::integer then
   v_unresolved:=v_unresolved||'"raw_tactical_cast_mod_differs_from_equipment_baseline"'::jsonb;
 end if;

 v_assigned_class:=lower(btrim(coalesce(v_assignment.source_label,'')));
 -- Use catalogue identities/descriptions for scoped diagnostics only;
 -- holding/wearing, subclass/class spell attribution and stacking must be
 -- independently proven. No focus bonus is added to the candidate.
 for v_focus_item in
   select value from jsonb_array_elements(coalesce(v_compare->'focusSourceAudit','[]'::jsonb))
 loop
   v_key:=lower(btrim(coalesce(v_focus_item->>'catalogItemKey','')));
   v_attack_only:=v_focus_item->>'bonusSpellSaveDcRaw' is null;
   v_scope:=case
     when v_key like '%rod of the pact keeper%' and v_class<>'warlock' then
       'class_mismatch'
     when v_key like '%rod of the pact keeper%'
        and (lower(coalesce(v_assignment.source_type,''))<>'class'
             or v_assigned_class not like '%warlock%') then
       'spell_class_attribution_unverified'
     when v_key like '%rod of the pact keeper%' then
       'warlock_spell_candidate_requires_held_proof'
     when v_key like '%arcane grimoire%' and v_class<>'wizard' then
       'class_mismatch'
     when v_key like '%arcane grimoire%' then
       'wizard_spell_candidate_requires_held_proof'
     when v_key like '%wand of the war mage%' and
          lower(coalesce(v_spell.attack_type,'')) not in ('ranged','melee') then
       'spell_has_no_attack_roll'
     when v_key like '%wand of the war mage%' then
       'spell_attack_candidate_requires_held_proof'
     when v_key like '%amulet of the devout%' then
       'spell_candidate_requires_worn_proof'
     else
       'focus_effect_scope_unclassified'
   end;
   v_focus:=v_focus||jsonb_build_array(v_focus_item||
     jsonb_build_object(
       'spellAssignmentId',v_assignment.id,'spellKey',v_spell.spell_key,
       'spellAttackType',v_spell.attack_type,
       'scopeStatus',v_scope,
       'bonusOnlySpellAttack',v_attack_only,
       'appliedToPreflight',false,
       'heldOrWornConfirmed',false,
       'sourceSpellClassVerified',false,
       'stackingVerified',false));
   if coalesce((v_focus_item->>'magicRiderEligible')::boolean,false) then
     v_focus_pending_count:=v_focus_pending_count+1;
   end if;
 end loop;
 if v_focus_pending_count>0 then
   v_unresolved:=v_unresolved||'"selected_focus_requires_condition_and_stacking_proof"'::jsonb;
 end if;
 return jsonb_build_object(
   'schemaVersion',1,'consumerEnforced',false,'attunementEnabled',true,
   'participantId',p_participant_id,'characterId',v_participant.character_id,
   'spellAssignmentId',p_assignment_id,'spellId',v_spell.id,
   'spellKey',v_spell.spell_key,'spellAttackType',v_spell.attack_type,
   'spellSaveAbilities',v_spell.saving_throw_abilities,
   'assignmentSourceType',v_assignment.source_type,
   'assignmentSourceLabel',v_assignment.source_label,
   'castingAbility',v_casting,'proficiencyBonus',v_prof,
   'baselineCastingScore',v_base_score,'baselineCastingModifier',v_base_mod,
   'selectedCastingScore',v_next_score,'selectedCastingModifier',v_next_mod,
   'baselineAttackBonus',v_attack_baseline,'shadowAttackBonus',v_attack_candidate,
   'baselineSaveDc',v_save_baseline,'shadowSaveDc',v_save_candidate,
   'attackBonusOverride',v_assignment.attack_bonus_override,
   'saveDcOverride',v_assignment.save_dc_override,
   'overrideProvenanceReady',false,'overrideSourceWarnings',v_override_flags,
   'focusSourceCandidates',v_focus,'focusApplied',false,
   'focusEligibilityVerified',false,
   'spellWriterRouteVerified',false,'executionParityReady',false,
   'baselineProfile',v_baseline,'shadowProfile',v_candidate,
   'slotSnapshot',v_baseline->'slotSnapshot',
   'knownSpells',v_baseline->'knownSpells',
   'unresolvedSources',v_unresolved,
   'writerExecuted',false,
   'activeEncounterRowsUnchanged',true
 );
end;
$shadow$;
revoke all on function private.encounter_attuned_spell_execution_preflight_shadow_v1(uuid,uuid)
 from public,anon,authenticated;
grant execute on function private.encounter_attuned_spell_execution_preflight_shadow_v1(uuid,uuid)
 to service_role;
comment on function private.encounter_attuned_spell_execution_preflight_shadow_v1(uuid,uuid)
 is 'Private read-only specific spell attack/DC and focus-scope preflight. No casting, slot synchronization, reaction, damage, spell log or live gameplay effects.';
