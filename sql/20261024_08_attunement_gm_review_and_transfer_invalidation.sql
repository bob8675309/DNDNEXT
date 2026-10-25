-- STAGED ONLY: audited DM adjudication of a canonical focused-rest link.
-- NO magic activation, NO attunement bonds, NO player/public RPCs.
-- Depends on drafts #257 -> #260 -> #261 -> #262 -> #263 -> #264.
--
-- 2024 Short Rest interruptions include initiative, non-cantrip spell casting
-- and damage. Existing encounter/world event records do NOT reliably prove
-- continuous item contact or lack of every interruption throughout downtime.
-- These are explicit GM-judgment fields, NOT inferred automated observations.

-- Transferring an item out-and-back must invalidate a focus attempt:
-- a snapshot comparing only current owner misses intermediate custody loss.
alter table private.attunement_focus_sessions_v1
 drop constraint if exists attunement_focus_sessions_v1_status_check;
alter table private.attunement_focus_sessions_v1
 add constraint attunement_focus_sessions_v1_status_check
 check(status in ('active','aborted','rest_logged_unverified','invalidated'));

create or replace function private.invalidate_attunement_focus_on_transfer_v1()
returns trigger
language plpgsql volatile security definer
set search_path=pg_catalog,public,private,auth
as $invalidate$
begin
 if old.owner_type is distinct from new.owner_type
    or old.owner_id is distinct from new.owner_id then
   update private.attunement_focus_sessions_v1
   set status='invalidated'
   where inventory_item_id=new.id
     and status in ('active','rest_logged_unverified');
 end if;
 return new;
end
$invalidate$;
drop trigger if exists invalidate_attunement_focus_on_transfer_v1
 on public.inventory_items;
create trigger invalidate_attunement_focus_on_transfer_v1
 after update of owner_type,owner_id on public.inventory_items
 for each row execute function private.invalidate_attunement_focus_on_transfer_v1();
revoke all on function private.invalidate_attunement_focus_on_transfer_v1()
 from public,anon,authenticated;

create table if not exists private.attunement_focus_gm_reviews_v1 (
 attempt_id uuid primary key references private.attunement_focus_rest_links_v1(attempt_id),
 rest_log_id uuid not null unique references public.character_rest_log(id),
 character_id uuid not null references public.characters(id),
 inventory_item_id uuid not null references public.inventory_items(id),
 reviewed_by uuid not null,
 reviewed_at timestamptz not null default clock_timestamp(),
 reviewed_world_time timestamptz not null,
 decision text not null check(decision in ('approve','reject')),
 contact_confirmed boolean not null,
 uninterrupted_confirmed boolean not null,
 identification_separate_confirmed boolean not null,
 gm_reason text not null check(length(btrim(gm_reason)) between 16 and 1200)
);
revoke all on private.attunement_focus_gm_reviews_v1
 from public,anon,authenticated;
grant select,insert on private.attunement_focus_gm_reviews_v1 to service_role;

-- A review records an accountable GM decision but NEVER asserts automated
-- proof or authorizes an attunement bond. Positive manual confirmation is
-- only an input to a FUTURE guarded capacity/source/lifecycle bond command.
create or replace function private.review_attunement_focused_rest_v1(
 p_character_id uuid,
 p_attempt_id uuid,
 p_decision text,
 p_contact_confirmed boolean,
 p_uninterrupted_confirmed boolean,
 p_identification_separate_confirmed boolean,
 p_reason text
) returns jsonb
language plpgsql volatile security invoker
set search_path=pg_catalog,public,private,auth
as $review$
declare
 v_session private.attunement_focus_sessions_v1%rowtype;
 v_link private.attunement_focus_rest_links_v1%rowtype;
 v_old private.attunement_focus_gm_reviews_v1%rowtype;
 v_item public.inventory_items%rowtype;
 v_source jsonb;
 v_class jsonb;
 v_world timestamptz;
 v_normal_decision text:=lower(btrim(coalesce(p_decision,'')));
 v_reason text:=btrim(coalesce(p_reason,''));
begin
 if p_character_id is null or p_attempt_id is null
   or v_normal_decision not in ('approve','reject')
   or p_contact_confirmed is null or p_uninterrupted_confirmed is null
   or p_identification_separate_confirmed is null
   or length(v_reason) not between 16 and 1200 then
   raise exception 'Complete GM review fields required'
     using errcode='22023';
 end if;
 if auth.uid() is null
   or not coalesce(private.current_user_is_admin(),false)
   or not coalesce(private.can_manage_character_progression_v1(p_character_id),false) then
   raise exception 'Only an authenticated authorized GM may review attunement'
     using errcode='42501';
 end if;
 if v_normal_decision='approve' and
   (not p_contact_confirmed or not p_uninterrupted_confirmed
     or not p_identification_separate_confirmed) then
   raise exception 'Cannot approve without all three explicit GM confirmations'
     using errcode='23514';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_character_id::text,0));
 select * into v_session from private.attunement_focus_sessions_v1
 where attempt_id=p_attempt_id and character_id=p_character_id for update;
 if not found then
   raise exception 'Matching character focus attempt not found' using errcode='P0002';
 end if;
 select * into v_old from private.attunement_focus_gm_reviews_v1
 where attempt_id=p_attempt_id;
 if found then
   if v_old.decision<>v_normal_decision
      or v_old.contact_confirmed is distinct from p_contact_confirmed
      or v_old.uninterrupted_confirmed is distinct from p_uninterrupted_confirmed
      or v_old.identification_separate_confirmed
         is distinct from p_identification_separate_confirmed
      or v_old.gm_reason<>v_reason then
      raise exception 'Review is immutable; use a new focused rest attempt'
        using errcode='23514';
   end if;
   return jsonb_build_object('attemptId',p_attempt_id,
      'reviewId',v_old.attempt_id,'restLogId',v_old.rest_log_id,
      'reviewState','gm_decision_recorded',
      'decision',v_old.decision,'replayed',true,
      'currentFocusStatus',v_session.status,
      'attunementReady',false,'canCreateBond',false);
 end if;
 if v_session.status<>'rest_logged_unverified' then
   raise exception 'Only a completed and still valid canonical rest can be reviewed'
     using errcode='23514';
 end if;
 select * into v_link from private.attunement_focus_rest_links_v1
 where attempt_id=p_attempt_id and character_id=p_character_id
   and inventory_item_id=v_session.inventory_item_id;
 if not found or not exists(
    select 1 from public.character_rest_log r
    where r.id=v_link.rest_log_id
      and r.character_id=p_character_id and r.rest_type='short_rest'
 ) then
   raise exception 'Exact canonical Short Rest link invalid'
     using errcode='23514';
 end if;
 select * into v_item from public.inventory_items
 where id=v_session.inventory_item_id for update;
 if not found or v_item.owner_type is distinct from v_session.owner_type_at_start
    or v_item.owner_id is distinct from v_session.owner_id_at_start then
   raise exception 'Original item custody no longer valid' using errcode='23514';
 end if;
 v_source:=private.passive_equipment_source_gate_v1(
   p_character_id,v_session.inventory_item_id);
 v_class:=private.attunement_rest_class_evidence_v1(
   p_character_id,v_session.inventory_item_id);
 if v_source->>'ownedByCharacter'<>'true'
    or v_source->>'playerOwnerAmbiguous'='true'
    or v_source->>'catalogueMatched'<>'true'
    or v_source->>'attunementSource'<>'required'
    or v_class->>'classPrerequisiteVerified'<>'true' then
   raise exception 'Source, owner or canonical class prerequisite changed'
     using errcode='23514';
 end if;
 -- Existing active encounter guard still runs. It cannot prove historical
 -- lack of Initiative, spells or damage during the prior world hour.
 perform private.assert_character_resource_not_active_v1(p_character_id);
 select world_time into v_world from public.world_state where id=1;
 if v_world is null or v_world<v_link.completed_world_time
    or v_link.completed_world_time<v_session.started_world_time+interval '1 hour' then
   raise exception 'World-time review ordering failed' using errcode='23514';
 end if;
 insert into private.attunement_focus_gm_reviews_v1
 (attempt_id,rest_log_id,character_id,inventory_item_id,reviewed_by,
  reviewed_world_time,decision,contact_confirmed,uninterrupted_confirmed,
  identification_separate_confirmed,gm_reason)
 values(p_attempt_id,v_link.rest_log_id,p_character_id,v_session.inventory_item_id,
  auth.uid(),v_world,v_normal_decision,p_contact_confirmed,
  p_uninterrupted_confirmed,p_identification_separate_confirmed,v_reason);
 return jsonb_build_object('attemptId',p_attempt_id,
    'reviewId',p_attempt_id,'restLogId',v_link.rest_log_id,
    'reviewState','gm_decision_recorded','decision',v_normal_decision,
    'replayed',false,'attunementReady',false,'canCreateBond',false);
end
$review$;
revoke all on function private.review_attunement_focused_rest_v1(
 uuid,uuid,text,boolean,boolean,boolean,text)
from public,anon,authenticated;
grant execute on function private.review_attunement_focused_rest_v1(
 uuid,uuid,text,boolean,boolean,boolean,text) to service_role;

comment on table private.attunement_focus_gm_reviews_v1 is
'Immutable, auditable GM judgment tied to exactly one canonical rest. Not automatically observed continuity, not an active item attunement.';
