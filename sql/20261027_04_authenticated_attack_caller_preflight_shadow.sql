-- DRAFT. Authenticated-JWT scoped, read-only Attack caller attestation.
-- NO live combat consumer. Does NOT call private atomic attack candidate.
-- The Data API MUST validate the JWT signature/expiry before setting
-- auth.uid()/auth.role(); SQL cannot authenticate untrusted raw JWT text.
begin;
create or replace function public.encounter_attack_caller_preflight_shadow_v1(
 p_participant_id uuid,
 p_expected_encounter_id uuid,
 p_expected_round integer,
 p_expected_turn_index integer
) returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,private,auth
as $preflight$
declare
 v_uid uuid:=auth.uid();
 v_role text:=coalesce(auth.role(),'');
 v_p public.encounter_participants%rowtype;
 v_e public.encounters%rowtype;
 v_budget jsonb;
begin
 if p_participant_id is null or p_expected_encounter_id is null
 or p_expected_round is null or p_expected_round<1
 or p_expected_turn_index is null or p_expected_turn_index<0 then
   raise exception 'Exact participant/encounter/round/turn required'
     using errcode='22023';
 end if;
 -- Fail closed even for service_role calls with a manually injected UID.
 -- The previous generic control helper intentionally bypasses role service;
 -- this diagnostic MUST NEVER use that bypass as player attestation.
 if v_role is distinct from 'authenticated' or v_uid is null then
   raise exception 'Verified authenticated end-user context required'
     using errcode='42501';
 end if;
 -- Verify true participant permission BEFORE returning *any* encounter,
 -- character, class or combat details to the caller. Never accept a
 -- caller-supplied user ID or a web-facing isAdmin/role flag.
 if not coalesce(public.encounter_can_control_participant_v1(p_participant_id),false) then
   raise exception 'Caller cannot control requested combat participant'
     using errcode='42501';
 end if;
 select * into v_p from public.encounter_participants
 where id=p_participant_id and encounter_id=p_expected_encounter_id;
 if not found or v_p.character_id is null then
   raise exception 'Controlled character participant/encounter does not match'
     using errcode='55000';
 end if;
 select * into v_e from public.encounters
 where id=v_p.encounter_id;
 if not found or v_e.status<>'active'
 or v_e.active_participant_id is distinct from v_p.id
 or v_e.round is distinct from p_expected_round
 or v_e.turn_index is distinct from p_expected_turn_index
 or coalesce(v_p.is_defeated,false) or not coalesce(v_p.action_available,false)
 then
   raise exception 'Requested Attack is not the current available participant turn'
     using errcode='55000';
 end if;
 v_budget:=private.encounter_attack_capacity_source_shadow_v1(v_p.character_id);
 if v_budget->>'sourceReady' is distinct from 'true' then
   raise exception 'Attack budget source is unresolved for this character'
     using errcode='55000';
 end if;
 return jsonb_build_object(
   'schemaVersion',1,
   'callerAuthMode','authenticated_jwt_context',
   'callerUserId',v_uid,
   'participantId',v_p.id,
   'encounterId',v_e.id,
   'characterId',v_p.character_id,
   'round',v_e.round,
   'turnIndex',v_e.turn_index,
   'attacksAllowed',(v_budget->>'attacksAllowed')::integer,
   'attackBudgetSourceStatus',v_budget->'sourceStatus',
   'controllerChecked',true,
   'roleBypassUsed',false,
   'characterSourceVerified',true,
   'serverServiceRoleRequired',false,
   'trustedEndpointIdentityHandoffReady',false,
   'jwtSignatureVerifiedByDatabase',false,
   'attackActionSpent',false,
   'diceRolled',false,
   'damageApplied',false,
   'attackEventReserved',false,
   'atomicCandidateCalled',false,
   'combatConsumerEnabled',false
 );
end;
$preflight$;
revoke all on function public.encounter_attack_caller_preflight_shadow_v1(
 uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.encounter_attack_caller_preflight_shadow_v1(
 uuid,uuid,integer,integer) to authenticated;
comment on function public.encounter_attack_caller_preflight_shadow_v1(
 uuid,uuid,integer,integer) is
'Authenticated-JWT scoped read-only Attack caller/active-turn/class-source preflight. No service role bypass; no combat writer, rolls, damage or event reservation. DRAFT.';
commit;
