-- PRIVATE READ-ONLY existing Attack-action execution gap audit.
-- NOT a second attack resolver or an authorization to ignore action_available.
-- No changes to weapon/unarmed writers, Extra Attack, shields or spell slots.
create or replace function private.encounter_attack_action_sequence_audit_shadow_v1(
 p_participant_id uuid
) returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,private,auth
as $audit$
declare
 v_p public.encounter_participants%rowtype;
 v_e public.encounters%rowtype;
 v_weapon integer:=0;
 v_unarmed integer:=0;
 v_request_matches integer:=0;
 v_unlinked integer:=0;
 v_events jsonb:='[]'::jsonb;
begin
 if p_participant_id is null then
   raise exception 'Encounter participant required' using errcode='22023';
 end if;
 select * into v_p from public.encounter_participants
   where id=p_participant_id;
 if not found then
   raise exception 'Encounter participant not found' using errcode='P0002';
 end if;
 select * into v_e from public.encounters
   where id=v_p.encounter_id;
 if not found then
   raise exception 'Encounter not found' using errcode='P0002';
 end if;

 -- Scope ONLY to this participant's current encounter round and turn.
 -- These are canonical logs, not the experimental shadow hand ledger.
 select
   count(*) filter (where l.event_type='weapon_attack')::integer,
   count(*) filter (where l.event_type='unarmed_strike')::integer,
   count(*) filter (
     where l.detail->>'requestId' is not null
     and c.request_id is not null
   )::integer,
   count(*) filter (
     where l.detail->>'requestId' is null
     or c.request_id is null
   )::integer,
   coalesce(jsonb_agg(jsonb_build_object(
     'eventType',l.event_type,'requestId',l.detail->>'requestId',
     'commandLinked',c.request_id is not null,
     'commandType',c.command_type
   ) order by l.id),'[]'::jsonb)
 into v_weapon,v_unarmed,v_request_matches,v_unlinked,v_events
 from public.encounter_combat_log l
 left join public.encounter_command_requests c
   on c.request_id::text=l.detail->>'requestId'
   and c.encounter_id=l.encounter_id
   and c.participant_id=p_participant_id
   and (
      (l.event_type='weapon_attack' and c.command_type='weapon_attack')
      or (l.event_type='unarmed_strike' and c.command_type='attack')
   )
 where l.encounter_id=v_e.id
   and l.actor_participant_id=p_participant_id
   and l.round=v_e.round
   and l.turn_index=v_e.turn_index
   and l.event_type in ('weapon_attack','unarmed_strike');

 return jsonb_build_object(
   'schemaVersion',1,
   'participantId',p_participant_id,'characterId',v_p.character_id,
   'encounterId',v_e.id,'encounterStatus',v_e.status,
   'round',v_e.round,'turnIndex',v_e.turn_index,
   'isActiveParticipant',v_e.active_participant_id is not distinct from v_p.id,
   'canonicalActionAvailable',v_p.action_available,
   'currentTurnWeaponAttackLogCount',coalesce(v_weapon,0),
   'currentTurnUnarmedStrikeLogCount',coalesce(v_unarmed,0),
   'currentTurnAttackEventCount',coalesce(v_weapon,0)+coalesce(v_unarmed,0),
   'requestLinkedAttackEventCount',coalesce(v_request_matches,0),
   'unlinkedAttackEventCount',coalesce(v_unlinked,0),
   'attackEvents',v_events,
   'canonicalWeaponWriterConsumesActionPerAttack',true,
   'canonicalUnarmedWriterConsumesActionPerAttack',true,
   'usesBooleanActionBudget',true,
   'canonicalPerAttackSequenceStatePresent',false,
   'extraAttackFeatureGrantVerified',false,
   'extraAttackCountVerified',false,
   'extraAttackExecutionSupported',false,
   'attackActionWeaponInteractionCounterPresent',false,
   'attackEquipBeforeAfterAttackIntegrated',false,
   'shieldUtilizeActionImplemented',false,
   'shadowHandActionsReplaceAttackWriter',false,
   'spellAndReactionWritersReconciled',false,
   'combatConsumerEnforced',false,
   'auditOnly',true,
   'readinessBlockers',jsonb_build_array(
     'single_weapon_or_unarmed_attack_consumes_full_action',
     'no_per_attack_action_sequence_or_extra_attack_budget',
     'no_weapon_draw_stow_interaction_hook_per_attack',
     'no_authoritative_shield_utilize_action',
     'no_cast_time_hand_and_focus_verification'
   )
 );
end;
$audit$;
revoke all on function private.encounter_attack_action_sequence_audit_shadow_v1(uuid)
  from public,anon,authenticated;
grant execute on function private.encounter_attack_action_sequence_audit_shadow_v1(uuid)
  to service_role;
comment on function private.encounter_attack_action_sequence_audit_shadow_v1(uuid)
 is 'Read-only canonical attack log and participant Action budget diagnostics. Reports missing per-attack Extra Attack and equipment event sequence; not an Attack or effect consumer.';
