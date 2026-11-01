-- P2 HELD RESEARCH ONLY / DO NOT MERGE OR APPLY
-- Read-only Supabase source extraction at 2026-11-01.
-- Original public body pg_get_functiondef MD5 e4d6eac7759720b05af0de9dc6c6fc4e.
-- The original body is renamed to PRIVATE for parity; do not patch it
-- without first reconciling new live function fingerprints.
CREATE OR REPLACE FUNCTION private.encounter_spellcasting_profile_full_candidate_v1(p_participant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_role text:=coalesce(auth.role(),'');
  v_participant public.encounter_participants%rowtype;
  v_class_id uuid;
  v_class_level integer;
  v_class_key text;
  v_class_name text;
  v_source text;
  v_ruleset text;
  v_spellcasting_ability text;
  v_caster_progression text;
  v_prepared_formula text;
  v_prof integer;
  v_slot_progression jsonb:='[]'::jsonb;
  v_ability_score integer;
  v_ability_mod integer;
  v_spell_attack_bonus integer;
  v_spell_save_dc integer;
  v_slots jsonb:='[]'::jsonb;
  v_spells jsonb:='[]'::jsonb;
begin
  if p_participant_id is null then raise exception 'Participant is required'; end if;
  select * into v_participant from public.encounter_participants where id=p_participant_id;
  if not found then raise exception 'Participant not found'; end if;
  if v_role<>'service_role' and not public.encounter_can_control_participant_v1(v_participant.id) then
    raise exception 'Not authorized to view this participant spellcasting profile';
  end if;

  select cp.class_id,cp.class_level,c.class_key,c.class_name,c.source,c.ruleset,c.spellcasting_ability,c.caster_progression,c.prepared_spells_formula,
         lp.proficiency_bonus,coalesce(lp.spell_slots,'[]'::jsonb)
  into v_class_id,v_class_level,v_class_key,v_class_name,v_source,v_ruleset,v_spellcasting_ability,v_caster_progression,v_prepared_formula,
       v_prof,v_slot_progression
  from public.character_progression cp
  join public.class_catalog c on c.id=cp.class_id
  left join public.class_level_progression lp on lp.class_id=cp.class_id and lp.class_level=cp.class_level
  where cp.character_id=v_participant.character_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'poolKey',s.pool_key,
    'slotLevel',s.slot_level,
    'max',s.slots_max,
    'remaining',s.slots_remaining,
    'rechargeKey',s.recharge_key,
    'sourceClassKey',s.source_class_key,
    'sourceBook',s.source_book,
    'sourceRuleset',s.source_ruleset,
    'sourceClassLevel',s.source_class_level
  ) order by s.pool_key,s.slot_level),'[]'::jsonb)
  into v_slots
  from public.encounter_spell_slots s
  where s.participant_id=v_participant.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignmentId',a.id,
    'spellId',sp.id,
    'spellKey',sp.spell_key,
    'name',sp.name,
    'source',sp.source,
    'level',sp.level,
    'school',sp.school,
    'castingTime',sp.casting_time,
    'rangeText',sp.range_text,
    'concentration',sp.concentration,
    'attackType',sp.attack_type,
    'savingThrowAbilities',sp.saving_throw_abilities,
    'damageDice',sp.damage_dice,
    'damageTypes',sp.damage_types,
    'healingDice',sp.healing_dice,
    'sourceType',a.source_type,
    'sourceLabel',a.source_label,
    'prepared',a.prepared,
    'alwaysAvailable',a.always_available,
    'usesMax',a.uses_max,
    'usesRemaining',a.uses_remaining,
    'recharge',a.recharge,
    'castingStat',a.casting_stat,
    'saveDcOverride',a.save_dc_override,
    'attackBonusOverride',a.attack_bonus_override
  ) order by sp.level,sp.name,a.created_at),'[]'::jsonb)
  into v_spells
  from public.character_spells a
  join public.spells_catalog sp on sp.id=a.spell_id
  where a.character_id=v_participant.character_id;

  if nullif(btrim(coalesce(v_spellcasting_ability,'')),'') is not null then
    v_ability_score:=private.encounter_ability_score_v1(v_participant.character_id,v_spellcasting_ability);
    v_ability_mod:=floor((coalesce(v_ability_score,10)-10)/2.0)::integer;
    if v_prof is null then
      select case when coalesce(cs.sheet->>'proficiencyBonus','') ~ '^[0-9]+$' then (cs.sheet->>'proficiencyBonus')::integer else 2 end
      into v_prof from public.character_sheets cs where cs.character_id=v_participant.character_id;
      v_prof:=coalesce(v_prof,2);
    end if;
    v_spell_attack_bonus:=v_ability_mod+v_prof;
    v_spell_save_dc:=8+v_ability_mod+v_prof;
  end if;

  return jsonb_build_object(
    'participantId',v_participant.id,
    'characterId',v_participant.character_id,
    'classId',v_class_id,
    'classKey',v_class_key,
    'className',v_class_name,
    'classSource',v_source,
    'ruleset',v_ruleset,
    'classLevel',v_class_level,
    'isClassCaster',nullif(btrim(coalesce(v_spellcasting_ability,'')),'') is not null,
    'castingAbility',v_spellcasting_ability,
    'castingAbilityScore',v_ability_score,
    'castingAbilityModifier',v_ability_mod,
    'proficiencyBonus',v_prof,
    'spellAttackBonus',v_spell_attack_bonus,
    'spellSaveDc',v_spell_save_dc,
    'casterProgression',v_caster_progression,
    'preparedSpellsFormula',v_prepared_formula,
    'canonicalSlotProgression',coalesce(v_slot_progression,'[]'::jsonb),
    'slotSnapshot',coalesce(v_slots,'[]'::jsonb),
    'knownSpells',coalesce(v_spells,'[]'::jsonb)
  );
end;
$function$
;
revoke all on function private.encounter_spellcasting_profile_full_candidate_v1(uuid)
from public,anon,authenticated;

-- PROPOSED ONLY. Do NOT install into production until owner approves
-- delegated NPC spell-list visibility and all public authorization surfaces.
-- Existing PC/direct-controller/editor/Admin return shape remains unchanged.
create or replace function public.encounter_spellcasting_profile_v1(p_participant_id uuid)
returns jsonb language plpgsql stable security definer
set search_path to 'pg_catalog','public','private','auth'
as $visibility$
declare
  v_uid uuid:=auth.uid();
  v_role text:=coalesce(auth.role(),'');
  v_p public.encounter_participants%rowtype;
  v_full jsonb;
  v_visible jsonb:='[]'::jsonb;
  v_slots jsonb:='[]'::jsonb;
begin
  if p_participant_id is null then
    raise exception 'Participant is required' using errcode='22023';
  end if;
  select * into v_p from public.encounter_participants
  where id=p_participant_id;
  if not found then
    raise exception 'Participant not found' using errcode='P0002';
  end if;
  if v_role<>'service_role' and (
    v_uid is null or not public.encounter_can_control_participant_v1(v_p.id)
  ) then
    raise exception 'Not authorized to view this participant spellcasting profile'
    using errcode='42501';
  end if;
  v_full:=private.encounter_spellcasting_profile_full_candidate_v1(v_p.id);

  -- Preserve all existing authorized caller behaviors. A new delegated grant
  -- must NOT expand source-sheet visibility or downgrade legacy PC control.
  if v_role='service_role'
    or (v_uid is not null and (
      public.is_admin(v_uid)
      or v_p.controller_user_id=v_uid
      or (v_p.character_id is not null and
          private.can_access_character_v1(v_p.character_id,'read'))
    ))
  then return v_full; end if;

  -- Extra fail-closed check: this branch is ONLY for an explicit NPC/merchant
  -- can_control grant, not an arbitrary actor or a fabricated profile token.
  if v_uid is null or v_p.character_id is null
     or not exists (
        select 1 from public.characters ch
        join public.character_permissions cp on cp.character_id=ch.id
        where ch.id=v_p.character_id and ch.kind in ('npc','merchant')
        and cp.user_id=v_uid and coalesce(cp.can_control,false)
     ) then
    raise exception 'No delegated combat-only spellcasting profile access'
      using errcode='42501';
  end if;

  -- The full legacy profile has no "known" predicate. Use source rows as
  -- authoritative eligibility; do not expose unprepared leveled spells.
  -- Keep reviewed unsupported spells visible only if currently prepared so
  -- the existing GM-assisted list remains usable; never auto-cast them.
  select coalesce(jsonb_agg(
       (entry.value || jsonb_build_object('known',true))
       order by entry.ordinality
    ),'[]'::jsonb) into v_visible
  from jsonb_array_elements(coalesce(v_full->'knownSpells','[]'::jsonb))
       with ordinality entry(value,ordinality)
  join public.character_spells a
    on a.id=(entry.value->>'assignmentId')::uuid
   and a.character_id=v_p.character_id
  where a.known is true
    and (
      coalesce((entry.value->>'level')::integer,0)=0
      or coalesce(a.prepared,false)
      or coalesce(a.always_available,false)
    );

  -- Slot counts are legal-action data; omit unrelated origin/mirror metadata.
  select coalesce(jsonb_agg(
      jsonb_build_object(
        'poolKey',slot.value->'poolKey',
        'slotLevel',slot.value->'slotLevel',
        'max',slot.value->'max',
        'remaining',slot.value->'remaining'
      ) order by slot.ordinality
    ),'[]'::jsonb) into v_slots
  from jsonb_array_elements(coalesce(v_full->'slotSnapshot','[]'::jsonb))
       with ordinality slot(value,ordinality);

  return jsonb_build_object(
    'participantId',v_p.id,
    'className',v_full->'className',
    'classLevel',v_full->'classLevel',
    'isClassCaster',v_full->'isClassCaster',
    'castingAbility',v_full->'castingAbility',
    'castingAbilityModifier',v_full->'castingAbilityModifier',
    'proficiencyBonus',v_full->'proficiencyBonus',
    'spellAttackBonus',v_full->'spellAttackBonus',
    'spellSaveDc',v_full->'spellSaveDc',
    'slotSnapshot',v_slots,
    'knownSpells',v_visible,
    'visibilityScope','delegated-combat',
    'spellListFiltered',true
  );
end
$visibility$;
revoke all on function public.encounter_spellcasting_profile_v1(uuid)
from public,anon;
grant execute on function public.encounter_spellcasting_profile_v1(uuid)
to authenticated,service_role;
