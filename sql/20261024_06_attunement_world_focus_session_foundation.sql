-- STAGED SERVER-ONLY WORLD-CLOCK ATTUNEMENT FOCUS FOUNDATION.
-- 2024 attunement requires a focused uninterrupted Short Rest in item contact.
-- This records a time/character/item attempt only. It DOES NOT create a
-- character_rest_log receipt, finish any rest, create a bond, or grant magic.
-- DNDNext public.world_state(id=1).world_time is the authoritative game clock.
create table if not exists private.attunement_focus_sessions_v1 (
  attempt_id uuid primary key,
  character_id uuid not null references public.characters(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  started_world_time timestamptz not null,
  owner_type_at_start text not null,
  owner_id_at_start text not null,
  started_by uuid,
  status text not null default 'active' check (status in ('active','aborted')),
  created_at timestamptz not null default clock_timestamp(),
  aborted_at timestamptz
);
create unique index if not exists attunement_focus_only_one_active_per_character_v1
  on private.attunement_focus_sessions_v1(character_id) where status='active';
revoke all on private.attunement_focus_sessions_v1 from public,anon,authenticated;
grant select,insert,update,delete on private.attunement_focus_sessions_v1 to service_role;

create or replace function private.begin_attunement_world_focus_v1(
 p_character_id uuid, p_item_id uuid, p_attempt_id uuid
) returns jsonb language plpgsql volatile security invoker
set search_path=pg_catalog,public,private,auth
as $start$
declare
 v_item public.inventory_items%rowtype;
 v_source jsonb;
 v_class jsonb;
 v_world timestamptz;
 v_old private.attunement_focus_sessions_v1%rowtype;
begin
 if p_character_id is null or p_item_id is null or p_attempt_id is null
 then raise exception 'Character, item and request ID are required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_character_id::text,0));
 select * into v_old from private.attunement_focus_sessions_v1
 where attempt_id=p_attempt_id;
 if found then
   if v_old.character_id=p_character_id and v_old.inventory_item_id=p_item_id
     and v_old.status='active' then
     return jsonb_build_object('attemptId',p_attempt_id,'status','focus_started_unverified',
       'startedWorldTime',v_old.started_world_time,'requiredWorldTime',
       v_old.started_world_time+interval '1 hour','replayed',true,
       'canCreateBond',false);
   end if;
   raise exception 'Attempt ID was already used' using errcode='23505';
 end if;
 if exists(select 1 from private.attunement_focus_sessions_v1
           where character_id=p_character_id and status='active') then
   raise exception 'This character already has an active attunement focus'
       using errcode='23514';
 end if;
 -- Reuse the canonical active-encounter resource guard. This only checks
 -- that focus may BEGIN; later interruptions are NOT automatically detected.
 perform private.assert_character_resource_not_active_v1(p_character_id);
 select * into v_item from public.inventory_items where id=p_item_id for update;
 if not found then raise exception 'Item not found' using errcode='P0002'; end if;
 v_source:=private.passive_equipment_source_gate_v1(p_character_id,p_item_id);
 if v_source->>'ownedByCharacter'<>'true'
   or v_source->>'playerOwnerAmbiguous'='true'
   or v_source->>'catalogueMatched'<>'true'
   or v_source->>'attunementSource'<>'required' then
   raise exception 'Item ownership or verified attunement source is not eligible'
    using errcode='23514';
 end if;
 -- Source-gate's equipment slot is intentionally not checked: attunement
 -- requires CONTACT, not wearing/equipping the item.
 v_class:=private.attunement_rest_class_evidence_v1(p_character_id,p_item_id);
 if v_class->>'classPrerequisiteVerified'<>'true' then
   raise exception 'Item class prerequisite is unverified or unmet'
     using errcode='23514';
 end if;
 if exists(select 1 from public.character_item_attunements
           where character_id=p_character_id and inventory_item_id=p_item_id) then
   raise exception 'Already attuned to this item' using errcode='23514';
 end if;
 select world_time into v_world from public.world_state where id=1;
 if v_world is null then raise exception 'Authoritative game clock unavailable' using errcode='55000'; end if;
 insert into private.attunement_focus_sessions_v1(
   attempt_id,character_id,inventory_item_id,started_world_time,
   owner_type_at_start,owner_id_at_start,started_by
 ) values(p_attempt_id,p_character_id,p_item_id,v_world,
   v_item.owner_type,v_item.owner_id,auth.uid());
 return jsonb_build_object('attemptId',p_attempt_id,
   'status','focus_started_unverified',
   'startedWorldTime',v_world,'requiredWorldTime',v_world+interval '1 hour',
   'replayed',false,'canCreateBond',false);
end $start$;
revoke all on function private.begin_attunement_world_focus_v1(uuid,uuid,uuid)
from public,anon,authenticated;
grant execute on function private.begin_attunement_world_focus_v1(uuid,uuid,uuid)
to service_role;

create or replace function private.inspect_attunement_world_focus_v1(
 p_character_id uuid, p_attempt_id uuid
) returns jsonb language plpgsql stable security invoker
set search_path=pg_catalog,public,private,auth
as $inspect$
declare
 v_session private.attunement_focus_sessions_v1%rowtype;
 v_item public.inventory_items%rowtype;
 v_now timestamptz;
 v_source jsonb;
 v_class jsonb;
 v_status text;
begin
 if p_character_id is null or p_attempt_id is null then
   raise exception 'Character and request ID required' using errcode='22023';
 end if;
 select * into v_session from private.attunement_focus_sessions_v1
 where attempt_id=p_attempt_id and character_id=p_character_id;
 if not found then
  return jsonb_build_object('status','no_matching_attempt',
    'canCreateBond',false,'attunementQualified',false);
 end if;
 select world_time into v_now from public.world_state where id=1;
 select * into v_item from public.inventory_items where id=v_session.inventory_item_id;
 v_source:=private.passive_equipment_source_gate_v1(p_character_id,v_session.inventory_item_id);
 v_class:=private.attunement_rest_class_evidence_v1(p_character_id,v_session.inventory_item_id);
 v_status:=case
   when v_session.status<>'active' then 'aborted'
   when v_now is null then 'world_clock_unavailable'
   when v_now<v_session.started_world_time then 'world_clock_regressed'
   when not found or v_item.owner_id is distinct from v_session.owner_id_at_start
       or v_item.owner_type is distinct from v_session.owner_type_at_start
       or v_source->>'ownedByCharacter'<>'true'
       or v_source->>'playerOwnerAmbiguous'='true'
       or v_source->>'attunementSource'<>'required'
       or v_class->>'classPrerequisiteVerified'<>'true'
     then 'source_owner_or_class_invalid'
   when v_now<v_session.started_world_time+interval '1 hour'
     then 'world_hour_not_elapsed'
   else 'world_hour_elapsed_unverified_contact_and_interruptions'
 end;
 return jsonb_build_object(
   'attemptId',p_attempt_id,'itemId',v_session.inventory_item_id,
   'status',v_status,'startedWorldTime',v_session.started_world_time,
   'observedWorldTime',v_now,
   'requiredWorldTime',v_session.started_world_time+interval '1 hour',
   'needsTrustedContactInterruptionAndIdentificationEvidence',true,
   'needsCanonicalRestCommit',true,'attunementQualified',false,
   'canCreateBond',false);
end $inspect$;
revoke all on function private.inspect_attunement_world_focus_v1(uuid,uuid)
from public,anon,authenticated;
grant execute on function private.inspect_attunement_world_focus_v1(uuid,uuid)
to service_role;

create or replace function private.abort_attunement_world_focus_v1(
 p_character_id uuid, p_attempt_id uuid
) returns boolean language plpgsql volatile security invoker
set search_path=pg_catalog,public,private,auth
as $abort$
declare v_changed integer;
begin
 if p_character_id is null or p_attempt_id is null then
   raise exception 'Character and attempt required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_character_id::text,0));
 update private.attunement_focus_sessions_v1
 set status='aborted',aborted_at=clock_timestamp()
 where character_id=p_character_id and attempt_id=p_attempt_id and status='active';
 get diagnostics v_changed=row_count;
 return v_changed=1;
end $abort$;
revoke all on function private.abort_attunement_world_focus_v1(uuid,uuid)
from public,anon,authenticated;
grant execute on function private.abort_attunement_world_focus_v1(uuid,uuid)
to service_role;

comment on table private.attunement_focus_sessions_v1 is
'Staged game-clock focus attempt, not a rest, attunement bond, or magic eligibility.';
