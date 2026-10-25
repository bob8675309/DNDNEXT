-- STAGED ONLY. Existing canonical rest logic preserved except additive restLogId
-- in restResult. Verified against sql/20260810_90 and read-only live DB.
-- DO NOT DEPLOY before privilege, schema and signed-in admin review.
create or replace function public.complete_character_rest_v1(p_character_id uuid, p_rest_type text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private','auth'
as $$
declare
  v_rest_type text := lower(replace(replace(btrim(coalesce(p_rest_type,'')),' ','_'),'-','_'));
  v_slots_restored integer := 0;
  v_uses_restored integer := 0;
  v_class_uses_restored integer := 0;
  v_profile jsonb;
  v_rest_log_id uuid;
  v_action_result jsonb := '{}'::jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then
    raise exception 'You do not have permission to complete rests for this character.' using errcode='42501';
  end if;
  if v_rest_type not in ('short_rest','long_rest') then
    raise exception 'Rest type must be short_rest or long_rest.' using errcode='22023';
  end if;

  perform private.sync_character_spell_slots_v1(p_character_id);

  select coalesce(sum(slots_max-slots_remaining),0)::integer
  into v_slots_restored
  from public.character_spell_slots
  where character_id=p_character_id
    and slots_remaining<slots_max
    and (v_rest_type='long_rest' or recharge_key='short_rest');

  update public.character_spell_slots
  set slots_remaining=slots_max,updated_at=timezone('utc',now())
  where character_id=p_character_id
    and slots_remaining<slots_max
    and (v_rest_type='long_rest' or recharge_key='short_rest');

  select coalesce(sum(uses_max-coalesce(uses_remaining,uses_max)),0)::integer
  into v_uses_restored
  from public.character_spells
  where character_id=p_character_id
    and uses_max is not null and uses_max>0
    and coalesce(uses_remaining,uses_max)<uses_max
    and case
      when v_rest_type='long_rest' then lower(replace(replace(coalesce(recharge,''),' ','_'),'-','_')) in ('short_rest','long_rest')
      else lower(replace(replace(coalesce(recharge,''),' ','_'),'-','_'))='short_rest'
    end;

  update public.character_spells
  set uses_remaining=uses_max,updated_at=timezone('utc',now())
  where character_id=p_character_id
    and uses_max is not null and uses_max>0
    and coalesce(uses_remaining,uses_max)<uses_max
    and case
      when v_rest_type='long_rest' then lower(replace(replace(coalesce(recharge,''),' ','_'),'-','_')) in ('short_rest','long_rest')
      else lower(replace(replace(coalesce(recharge,''),' ','_'),'-','_'))='short_rest'
    end;

  v_action_result := private.restore_character_rest_action_state_v1(p_character_id,v_rest_type);
  v_class_uses_restored := coalesce((v_action_result->>'restoredClassFeatureUses')::integer,0);

  insert into public.character_rest_log(
    character_id,rest_type,completed_by,restored_spell_slots,restored_spell_uses,details
  ) values(
    p_character_id,v_rest_type,auth.uid(),v_slots_restored,v_uses_restored,
    jsonb_build_object(
      'scope','standalone_character_sheet',
      'encounterStateChanged',false,
      'restoredClassFeatureUses',v_class_uses_restored,
      'classFeatures',coalesce(v_action_result->'features','[]'::jsonb),
      'restores',case when v_rest_type='short_rest'
        then jsonb_build_array('short-rest spell slots','short-rest limited spell uses','source-backed short-rest class feature uses')
        else jsonb_build_array('all spell slots','short-rest limited spell uses','long-rest limited spell uses','source-backed long-rest class feature uses')
      end
    )
  ) returning id into v_rest_log_id;

  -- The rest-log insert above still passes through the existing active-encounter guard.
  -- If that guard rejects the rest, this entire transaction (including sheet action state)
  -- rolls back atomically.
  v_profile:=private.character_sheet_resource_profile_json_v1(p_character_id);
  return v_profile || jsonb_build_object(
    'sheet',v_action_result->'sheet',
    'restResult',jsonb_build_object(
      'restType',v_rest_type,
      'restLogId',v_rest_log_id,
      'restoredSpellSlots',v_slots_restored,
      'restoredSpellUses',v_uses_restored,
      'restoredClassFeatureUses',v_class_uses_restored,
      'classFeatures',coalesce(v_action_result->'features','[]'::jsonb)
    )
  );
end;
$$;
revoke all on function public.complete_character_rest_v1(uuid,text) from public,anon;
grant execute on function public.complete_character_rest_v1(uuid,text) to authenticated,service_role;


-- A canonical rest must be correlated by its RETURNED id, never guessed from
-- timestamps or latest rest-log row (which can race another transaction).
-- No migration or RPC calls are applied to production by this draft file.
alter table private.attunement_focus_sessions_v1
  drop constraint if exists attunement_focus_sessions_v1_status_check;
alter table private.attunement_focus_sessions_v1
  add constraint attunement_focus_sessions_v1_status_check
  check(status in ('active','aborted','rest_logged_unverified'));

create table if not exists private.attunement_focus_rest_links_v1 (
  attempt_id uuid primary key references private.attunement_focus_sessions_v1(attempt_id),
  character_id uuid not null references public.characters(id),
  inventory_item_id uuid not null references public.inventory_items(id),
  rest_log_id uuid not null unique references public.character_rest_log(id),
  completed_world_time timestamptz not null,
  linked_at timestamptz not null default clock_timestamp()
);
revoke all on private.attunement_focus_rest_links_v1 from public,anon,authenticated;
grant select,insert on private.attunement_focus_rest_links_v1 to service_role;

-- Only trusted server sessions WITH an authenticated administrator principal
-- may call this bridge. It delegates the resource restoration and active-
-- encounter guard to public.complete_character_rest_v1 and never creates a
-- magic bond. Service key alone (no auth.uid()) deliberately fails closed.
create or replace function private.record_attunement_focused_short_rest_v1(
 p_character_id uuid, p_attempt_id uuid
) returns jsonb
language plpgsql volatile security invoker
set search_path=pg_catalog,public,private,auth
as $bridge$
declare
 v_session private.attunement_focus_sessions_v1%rowtype;
 v_link private.attunement_focus_rest_links_v1%rowtype;
 v_item public.inventory_items%rowtype;
 v_inspect jsonb;
 v_rest jsonb;
 v_rest_id uuid;
 v_time timestamptz;
begin
 if p_character_id is null or p_attempt_id is null then
   raise exception 'Character and focus attempt required' using errcode='22023';
 end if;
 if auth.uid() is null or not coalesce(private.current_user_is_admin(),false)
    or not coalesce(private.can_manage_character_progression_v1(p_character_id),false)
 then
   raise exception 'An authenticated admin must approve an item-focused rest'
     using errcode='42501';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_character_id::text,0));
 select * into v_session from private.attunement_focus_sessions_v1
 where attempt_id=p_attempt_id and character_id=p_character_id for update;
 if not found then raise exception 'Focus attempt not found' using errcode='P0002'; end if;
 select * into v_link from private.attunement_focus_rest_links_v1
 where attempt_id=p_attempt_id;
 if found then
   -- Exact replay cannot create another rest or bond. Admin authorization
   -- still executes before returning an existing correlation.
   return jsonb_build_object('status','rest_logged_unverified',
     'attemptId',p_attempt_id,'restLogId',v_link.rest_log_id,
     'replayed',true,'attunementQualified',false,'canCreateBond',false);
 end if;
 if v_session.status<>'active' then
   raise exception 'Focus attempt is no longer active' using errcode='23514';
 end if;
 -- Lock the inventory item to serialize ownership transfer with completion.
 select * into v_item from public.inventory_items
 where id=v_session.inventory_item_id for update;
 if not found or v_item.owner_id is distinct from v_session.owner_id_at_start
    or v_item.owner_type is distinct from v_session.owner_type_at_start then
   raise exception 'Item changed ownership during focus' using errcode='23514';
 end if;
 v_inspect:=private.inspect_attunement_world_focus_v1(p_character_id,p_attempt_id);
 if v_inspect->>'status'<>'world_hour_elapsed_unverified_contact_and_interruptions' then
   raise exception 'World-time and eligibility preflight did not pass: %',
     v_inspect->>'status' using errcode='23514';
 end if;
 -- Both calls share the current PostgreSQL transaction. Any canonical rest
 -- guard/recovery error rolls back our focus correlation and all rest resources.
 v_rest:=public.complete_character_rest_v1(p_character_id,'short_rest');
 v_rest_id:=nullif(v_rest#>>'{restResult,restLogId}','')::uuid;
 if v_rest_id is null then
   raise exception 'Canonical rest result lacks authoritative restLogId'
    using errcode='55000';
 end if;
 if not exists(select 1 from public.character_rest_log r
    where r.id=v_rest_id and r.character_id=p_character_id and r.rest_type='short_rest')
 then raise exception 'Canonical rest receipt identity mismatch' using errcode='23514'; end if;
 select world_time into v_time from public.world_state where id=1;
 if v_time is null or v_time<v_session.started_world_time+interval '1 hour' then
   raise exception 'World time became invalid during rest' using errcode='23514';
 end if;
 insert into private.attunement_focus_rest_links_v1
 (attempt_id,character_id,inventory_item_id,rest_log_id,completed_world_time)
 values (p_attempt_id,p_character_id,v_session.inventory_item_id,v_rest_id,v_time);
 update private.attunement_focus_sessions_v1
 set status='rest_logged_unverified'
 where attempt_id=p_attempt_id and status='active';
 if not found then raise exception 'Focus state changed concurrently' using errcode='40001'; end if;
 -- No evidence for continuous physical contact, no-interruption, or separate
 -- identification is inferred from a timer + log row; admin confirmation is a
 -- FUTURE explicit audited step, never a free-form client JSON assertion.
 return jsonb_build_object('status','rest_logged_unverified',
    'attemptId',p_attempt_id,'restLogId',v_rest_id,
    'completedWorldTime',v_time,
    'replayed',false,'attunementQualified',false,'canCreateBond',false);
end
$bridge$;
revoke all on function private.record_attunement_focused_short_rest_v1(uuid,uuid)
from public,anon,authenticated;
grant execute on function private.record_attunement_focused_short_rest_v1(uuid,uuid)
to service_role;

comment on function private.record_attunement_focused_short_rest_v1(uuid,uuid) is
'Calls canonical Short Rest and links one world-time focus attempt atomically. Does NOT verify continuous contact/interruptions or grant attunement.';

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
   when v_session.status='rest_logged_unverified' then 'rest_logged_unverified'
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
