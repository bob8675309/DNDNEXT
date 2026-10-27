-- DRAFT SHADOW ONLY. Preflights a proposed SOURCE-BOUND weapon attack
-- against the exact currently equipped item, canonical read-only profile,
-- canonical read-only LOS/cover context, and attack-session ordinal.
-- NEVER calls attack roll helper (consumes Guiding Bolt advantage), damage,
-- combat log or canonical weapon/unarmed writers. Does not reserve event slot.
create or replace function private.encounter_weapon_event_resolver_preflight_shadow_v1(
 p_participant_id uuid,p_action_request_id uuid,p_target_id uuid,
 p_inventory_item_id uuid,p_expected_ordinal integer
) returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,private,auth
as $audit$
declare
 v_p public.encounter_participants%rowtype;
 v_t public.encounter_participants%rowtype;
 v_e public.encounters%rowtype;
 v_s public.encounter_attack_action_sessions_shadow_v1%rowtype;
 v_item public.inventory_items%rowtype;
 v_payload jsonb;
 v_exact_key text;
 v_catalog jsonb;
 v_profile jsonb;
 v_targeting jsonb;
 v_dist integer;
 v_reach integer;
 v_normal integer;
 v_long integer;
 v_is_ranged boolean;
 v_is_thrown boolean;
 v_far_disadvantage boolean:=false;
 v_base_disadvantage boolean:=false;
begin
 if p_participant_id is null or p_action_request_id is null
 or p_target_id is null or p_inventory_item_id is null
 or p_expected_ordinal is null or p_expected_ordinal<1 then
   raise exception 'Participant, action, target, weapon, and ordinal required'
   using errcode='22023';
 end if;
 if p_participant_id=p_target_id then
   raise exception 'Attacker cannot target itself' using errcode='22023';
 end if;
 select * into v_p from public.encounter_participants
 where id=p_participant_id;
 if not found or v_p.character_id is null then
   raise exception 'Character-bound participant required' using errcode='55000';
 end if;
 select * into v_e from public.encounters where id=v_p.encounter_id;
 if not found or v_e.status<>'active'
 or v_e.active_participant_id is distinct from v_p.id
 or coalesce(v_p.is_defeated,false)
 or not v_p.action_available then
   raise exception 'Active undefeated participant with available Action required'
   using errcode='55000';
 end if;
 select * into v_s from public.encounter_attack_action_sessions_shadow_v1
 where action_request_id=p_action_request_id
 and participant_id=p_participant_id;
 if not found or v_s.encounter_id<>v_e.id or v_s.character_id<>v_p.character_id
 or v_s.round<>v_e.round or v_s.turn_index<>v_e.turn_index
 or p_expected_ordinal<>v_s.attacks_recorded+1
 or p_expected_ordinal>v_s.attacks_allowed then
   raise exception 'Attack action slot is absent, stale, skipped or exhausted'
   using errcode='55000';
 end if;
 -- A real canonical attack consumes Action on a single attack. A shadow
 -- preflight MUST NOT suggest it is safe to bypass that writer afterward.
 if exists(select 1 from public.encounter_combat_log l
 where l.encounter_id=v_e.id and l.actor_participant_id=v_p.id
 and l.round=v_e.round and l.turn_index=v_e.turn_index
 and l.event_type in ('weapon_attack','unarmed_strike')) then
   raise exception 'Canonical attack already recorded for this turn'
   using errcode='55000';
 end if;
 select * into v_t from public.encounter_participants
 where id=p_target_id and encounter_id=v_e.id;
 if not found or coalesce(v_t.is_defeated,false) then
   raise exception 'Live target from same encounter required'
   using errcode='55000';
 end if;

 -- Character/exact-item custody: stricter than legacy account-shared view.
 if not private.character_staged_hand_item_valid_v1(
 v_p.character_id,p_inventory_item_id) then
   raise exception 'Equipped weapon custody/slot unverified' using errcode='55000';
 end if;
 select * into v_item from public.inventory_items
 where id=p_inventory_item_id and is_equipped is true;
 if not found then
   raise exception 'Selected weapon not currently equipped'
   using errcode='55000';
 end if;
 v_exact_key:=coalesce(
 nullif(btrim(v_item.card_payload->>'item_key'),''),
 nullif(btrim(v_item.card_payload->>'item_id'),''),
 nullif(btrim(v_item.item_id),''));
 select c.payload into v_catalog from public.items_catalog c
 where c.item_key=v_exact_key;
 if not found then
   raise exception 'Missing exact catalogue weapon source'
   using errcode='55000';
 end if;
 v_profile:=public.encounter_weapon_profile_internal_v1(
 p_participant_id,p_inventory_item_id);
 if v_profile is null
 or v_profile->>'inventoryItemId' is distinct from p_inventory_item_id::text
 or coalesce(v_profile->>'damageDice','') !~ '^[1-9][0-9]*d[1-9][0-9]*$' then
   raise exception 'Canonical equipped-weapon profile unavailable'
   using errcode='55000';
 end if;
 -- Data parity with canonical weapon writer before any irreversible effects.
 v_targeting:=public.encounter_targeting_context_internal_v1(
 p_participant_id,p_target_id);
 if not coalesce((v_targeting->>'hasLineOfSight')::boolean,false) then
   raise exception 'Target is blocked by total cover or line-of-sight obstruction'
   using errcode='55000';
 end if;
 v_dist:=coalesce((v_targeting->>'distanceFt')::integer,0);
 v_reach:=coalesce((v_profile->>'reachFt')::integer,5);
 v_normal:=coalesce((v_profile->>'normalRangeFt')::integer,v_reach);
 v_long:=coalesce((v_profile->>'longRangeFt')::integer,v_normal);
 v_is_ranged:=coalesce((v_profile->>'isRanged')::boolean,false);
 v_is_thrown:=coalesce((v_profile->>'isThrown')::boolean,false);
 if v_is_ranged then
   if v_dist>v_long then
     raise exception 'Target beyond weapon long range' using errcode='55000';
   end if;
   v_far_disadvantage:=v_dist>v_normal;
 elsif v_dist<=v_reach then
   v_far_disadvantage:=false;
 elsif v_is_thrown then
   if v_dist>v_long then
     raise exception 'Target beyond thrown weapon range' using errcode='55000';
   end if;
   v_far_disadvantage:=v_dist>v_normal;
 else
   raise exception 'Target beyond melee weapon reach' using errcode='55000';
 end if;
 v_base_disadvantage:=coalesce(v_t.dodging,false) or v_far_disadvantage;
 return jsonb_build_object(
   'schemaVersion',1,'participantId',p_participant_id,
   'actionRequestId',p_action_request_id,'encounterId',v_e.id,
   'round',v_e.round,'turnIndex',v_e.turn_index,
   'attackOrdinal',p_expected_ordinal,
   'attacksAllowed',v_s.attacks_allowed,'attacksRecorded',v_s.attacks_recorded,
   'targetId',p_target_id,'weaponInventoryItemId',p_inventory_item_id,
   'exactCatalogSourceKey',v_exact_key,'exactCatalogMatch',true,
   'canonicalWeaponProfile',v_profile,'canonicalTargeting',v_targeting,
   'distanceFt',v_dist,'longRangeDisadvantage',v_far_disadvantage,
   'targetDodging',coalesce(v_t.dodging,false),
   'baseDisadvantage',v_base_disadvantage,
   'projectedTargetAc',coalesce(v_t.armor_class,10)
       +coalesce((v_targeting->>'coverAcBonus')::integer,0),
   'targetSnapshotNotReserved',true,
   'attackSlotNotReserved',true,
   'attackRollMade',false,'guidingBoltEffectConsumed',false,
   'damageApplied',false,'canonicalActionSpent',false,
   'canonicalCombatLogWritten',false,'itemTransferred',false,
   'actualHandGripVerified',false,'attunementFocusEnforced',false,
   'combatConsumerEnforced',false
 );
end;
$audit$;
revoke all on function private.encounter_weapon_event_resolver_preflight_shadow_v1(
 uuid,uuid,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function private.encounter_weapon_event_resolver_preflight_shadow_v1(
 uuid,uuid,uuid,uuid,integer) to service_role;
comment on function private.encounter_weapon_event_resolver_preflight_shadow_v1(
 uuid,uuid,uuid,uuid,integer) is
'Read-only canonical weapon profile and LOS/range preview for a source-derived shadow Attack slot. Does NOT roll, consume Guiding Bolt, log, spend an Action or apply damage.';
