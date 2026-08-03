begin;

-- Bridge the tactical encounter spell-slot snapshot to the persistent character ledger.
-- Existing active encounter counts are deliberately preserved. New/activated encounters
-- snapshot the current character ledger, and future encounter spends reduce both atomically.

create or replace function private.character_active_encounter_v1(p_character_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
  select (
    select jsonb_build_object(
      'encounterId',e.id,
      'encounterName',e.name,
      'participantId',p.id,
      'status',e.status,
      'version',e.version
    )
    from public.encounter_participants p
    join public.encounters e on e.id=p.encounter_id
    where p.character_id=p_character_id
      and e.status='active'
    order by e.updated_at desc,e.id
    limit 1
  );
$function$;

revoke all on function private.character_active_encounter_v1(uuid) from public, anon, authenticated;
grant execute on function private.character_active_encounter_v1(uuid) to service_role;

create or replace function private.assert_character_resource_sheet_unlocked_v1(p_character_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_active jsonb;
begin
  v_active:=private.character_active_encounter_v1(p_character_id);
  if v_active is not null then
    raise exception 'Spell resources are controlled by the active battle board encounter: %.',
      coalesce(v_active->>'encounterName','Active encounter')
      using errcode='55000',
            hint='Spend spell slots on the battle board, or finish/archive the encounter before using sheet-side resource and rest controls.';
  end if;
end;
$function$;

revoke all on function private.assert_character_resource_sheet_unlocked_v1(uuid) from public, anon, authenticated;
grant execute on function private.assert_character_resource_sheet_unlocked_v1(uuid) to service_role;

create or replace function private.append_character_resource_bridge_state_v1(
  p_character_id uuid,
  p_profile jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_active jsonb;
begin
  v_active:=private.character_active_encounter_v1(p_character_id);
  return coalesce(p_profile,'{}'::jsonb)||jsonb_build_object(
    'resourceBridgeVersion',1,
    'encounterLocked',v_active is not null,
    'activeEncounter',v_active
  );
end;
$function$;

revoke all on function private.append_character_resource_bridge_state_v1(uuid,jsonb) from public, anon, authenticated;
grant execute on function private.append_character_resource_bridge_state_v1(uuid,jsonb) to service_role;

-- New encounter participants now receive the current persistent slot totals instead of a fresh maximum.
create or replace function private.initialize_encounter_spell_slots_v1(p_participant_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_participant public.encounter_participants%rowtype;
  v_slot public.character_spell_slots%rowtype;
  v_inserted integer:=0;
  v_rows integer:=0;
begin
  if p_participant_id is null then return 0; end if;

  select * into v_participant
  from public.encounter_participants
  where id=p_participant_id;
  if not found or v_participant.character_id is null then return 0; end if;

  perform private.sync_character_spell_slots_v1(v_participant.character_id);

  for v_slot in
    select *
    from public.character_spell_slots
    where character_id=v_participant.character_id
    order by pool_key,slot_level
  loop
    insert into public.encounter_spell_slots(
      participant_id,pool_key,slot_level,slots_max,slots_remaining,recharge_key,
      source_class_id,source_class_key,source_book,source_ruleset,source_class_level
    ) values(
      v_participant.id,v_slot.pool_key,v_slot.slot_level,v_slot.slots_max,v_slot.slots_remaining,v_slot.recharge_key,
      v_slot.source_class_id,v_slot.source_class_key,v_slot.source_book,v_slot.source_ruleset,v_slot.source_class_level
    )
    on conflict(participant_id,pool_key,slot_level) do nothing;
    get diagnostics v_inserted=row_count;
    v_rows:=v_rows+v_inserted;
  end loop;

  return v_rows;
end;
$function$;

revoke all on function private.initialize_encounter_spell_slots_v1(uuid) from public, anon, authenticated;
grant execute on function private.initialize_encounter_spell_slots_v1(uuid) to service_role;

create or replace function private.refresh_encounter_spell_slots_from_characters_v1(p_encounter_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_participant record;
  v_changed integer:=0;
  v_total integer:=0;
begin
  if p_encounter_id is null then return 0; end if;
  perform set_config('dndnext.resource_bridge_sync','on',true);

  for v_participant in
    select id,character_id
    from public.encounter_participants
    where encounter_id=p_encounter_id and character_id is not null
    order by id
  loop
    perform private.sync_character_spell_slots_v1(v_participant.character_id);

    delete from public.encounter_spell_slots s
    where s.participant_id=v_participant.id
      and not exists (
        select 1
        from public.character_spell_slots cs
        where cs.character_id=v_participant.character_id
          and cs.pool_key=s.pool_key
          and cs.slot_level=s.slot_level
      );
    get diagnostics v_changed=row_count;
    v_total:=v_total+v_changed;

    insert into public.encounter_spell_slots(
      participant_id,pool_key,slot_level,slots_max,slots_remaining,recharge_key,
      source_class_id,source_class_key,source_book,source_ruleset,source_class_level
    )
    select
      v_participant.id,cs.pool_key,cs.slot_level,cs.slots_max,cs.slots_remaining,cs.recharge_key,
      cs.source_class_id,cs.source_class_key,cs.source_book,cs.source_ruleset,cs.source_class_level
    from public.character_spell_slots cs
    where cs.character_id=v_participant.character_id
    on conflict(participant_id,pool_key,slot_level) do update
    set slots_max=excluded.slots_max,
        slots_remaining=excluded.slots_remaining,
        recharge_key=excluded.recharge_key,
        source_class_id=excluded.source_class_id,
        source_class_key=excluded.source_class_key,
        source_book=excluded.source_book,
        source_ruleset=excluded.source_ruleset,
        source_class_level=excluded.source_class_level,
        updated_at=timezone('utc',now());
    get diagnostics v_changed=row_count;
    v_total:=v_total+v_changed;
  end loop;

  perform set_config('dndnext.resource_bridge_sync','off',true);
  return v_total;
end;
$function$;

revoke all on function private.refresh_encounter_spell_slots_from_characters_v1(uuid) from public, anon, authenticated;
grant execute on function private.refresh_encounter_spell_slots_from_characters_v1(uuid) to service_role;

create or replace function private.refresh_encounter_spell_slots_on_activation_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  perform private.refresh_encounter_spell_slots_from_characters_v1(new.id);
  return new;
end;
$function$;

revoke all on function private.refresh_encounter_spell_slots_on_activation_v1() from public, anon, authenticated;
grant execute on function private.refresh_encounter_spell_slots_on_activation_v1() to service_role;

drop trigger if exists encounter_spell_slots_refresh_after_active_insert on public.encounters;
create trigger encounter_spell_slots_refresh_after_active_insert
after insert on public.encounters
for each row
when (new.status='active')
execute function private.refresh_encounter_spell_slots_on_activation_v1();

drop trigger if exists encounter_spell_slots_refresh_on_activation on public.encounters;
create trigger encounter_spell_slots_refresh_on_activation
after update of status on public.encounters
for each row
when (new.status='active' and old.status is distinct from new.status)
execute function private.refresh_encounter_spell_slots_on_activation_v1();

-- All tactical spell adapters eventually decrement encounter_spell_slots. This trigger
-- mirrors that delta to the persistent character ledger inside the same transaction.
create or replace function private.mirror_encounter_spell_slot_spend_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_character_id uuid;
  v_encounter_status text;
  v_delta integer;
  v_character_remaining integer;
begin
  if new.slots_remaining>=old.slots_remaining then return new; end if;
  if coalesce(current_setting('dndnext.resource_bridge_sync',true),'off')='on' then return new; end if;

  select p.character_id,e.status
  into v_character_id,v_encounter_status
  from public.encounter_participants p
  join public.encounters e on e.id=p.encounter_id
  where p.id=new.participant_id;

  if v_character_id is null or v_encounter_status is distinct from 'active' then return new; end if;

  perform private.sync_character_spell_slots_v1(v_character_id);
  v_delta:=old.slots_remaining-new.slots_remaining;

  select slots_remaining
  into v_character_remaining
  from public.character_spell_slots
  where character_id=v_character_id
    and pool_key=new.pool_key
    and slot_level=new.slot_level
  for update;

  if not found then
    raise exception 'Persistent character spell-slot pool is missing for % level %.',new.pool_key,new.slot_level
      using errcode='P0002';
  end if;
  if v_character_remaining<v_delta then
    raise exception 'Persistent character spell resources have only % slot(s) remaining; this cast requires %.',v_character_remaining,v_delta
      using errcode='22023',
            hint='Refresh the battle board. Sheet-side resources cannot be changed while this encounter is active.';
  end if;

  update public.character_spell_slots
  set slots_remaining=slots_remaining-v_delta,
      updated_at=timezone('utc',now())
  where character_id=v_character_id
    and pool_key=new.pool_key
    and slot_level=new.slot_level;

  return new;
end;
$function$;

revoke all on function private.mirror_encounter_spell_slot_spend_v1() from public, anon, authenticated;
grant execute on function private.mirror_encounter_spell_slot_spend_v1() to service_role;

drop trigger if exists encounter_spell_slot_character_spend_bridge on public.encounter_spell_slots;
create trigger encounter_spell_slot_character_spend_bridge
after update of slots_remaining on public.encounter_spell_slots
for each row
when (new.slots_remaining<old.slots_remaining)
execute function private.mirror_encounter_spell_slot_spend_v1();

-- Preserve the current guarded encounter profile and enrich it with persistent-ledger state.
do $rename_encounter_profile$
begin
  if to_regprocedure('public.encounter_spellcasting_profile_v1_pre_character_resource_bridge(uuid)') is null then
    alter function public.encounter_spellcasting_profile_v1(uuid)
      rename to encounter_spellcasting_profile_v1_pre_character_resource_bridge;
  end if;
end;
$rename_encounter_profile$;

revoke all on function public.encounter_spellcasting_profile_v1_pre_character_resource_bridge(uuid) from public, anon, authenticated;
grant execute on function public.encounter_spellcasting_profile_v1_pre_character_resource_bridge(uuid) to service_role;

create or replace function public.encounter_spellcasting_profile_v1(p_participant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_profile jsonb;
  v_character_id uuid;
  v_persistent jsonb:='[]'::jsonb;
  v_mismatch boolean:=false;
begin
  v_profile:=public.encounter_spellcasting_profile_v1_pre_character_resource_bridge(p_participant_id);

  select character_id into v_character_id
  from public.encounter_participants
  where id=p_participant_id;

  if v_character_id is not null then
    perform private.sync_character_spell_slots_v1(v_character_id);

    select coalesce(jsonb_agg(jsonb_build_object(
      'poolKey',cs.pool_key,
      'slotLevel',cs.slot_level,
      'max',cs.slots_max,
      'remaining',cs.slots_remaining,
      'rechargeKey',cs.recharge_key
    ) order by cs.pool_key,cs.slot_level),'[]'::jsonb)
    into v_persistent
    from public.character_spell_slots cs
    where cs.character_id=v_character_id;

    v_mismatch:=exists(
      select 1
      from public.encounter_spell_slots es
      left join public.character_spell_slots cs
        on cs.character_id=v_character_id
       and cs.pool_key=es.pool_key
       and cs.slot_level=es.slot_level
      where es.participant_id=p_participant_id
        and (
          cs.character_id is null
          or es.slots_max<>cs.slots_max
          or es.slots_remaining<>cs.slots_remaining
        )
    ) or exists(
      select 1
      from public.character_spell_slots cs
      left join public.encounter_spell_slots es
        on es.participant_id=p_participant_id
       and es.pool_key=cs.pool_key
       and es.slot_level=cs.slot_level
      where cs.character_id=v_character_id
        and es.id is null
    );
  end if;

  return coalesce(v_profile,'{}'::jsonb)||jsonb_build_object(
    'resourceBridgeVersion',1,
    'persistentResourcesLinked',v_character_id is not null,
    'persistentSlotState',coalesce(v_persistent,'[]'::jsonb),
    'persistentSlotMismatch',v_mismatch
  );
end;
$function$;

revoke all on function public.encounter_spellcasting_profile_v1(uuid) from public, anon;
grant execute on function public.encounter_spellcasting_profile_v1(uuid) to authenticated, service_role;

-- Wrap sheet resource functions so the battle board owns resources during active encounters.
do $rename_sheet_functions$
begin
  if to_regprocedure('public.character_sheet_resource_profile_v1_pre_character_resource_bridge(uuid)') is null then
    alter function public.character_sheet_resource_profile_v1(uuid)
      rename to character_sheet_resource_profile_v1_pre_character_resource_bridge;
  end if;
  if to_regprocedure('public.update_character_spell_slot_v1_pre_character_resource_bridge(uuid,text,integer,text)') is null then
    alter function public.update_character_spell_slot_v1(uuid,text,integer,text)
      rename to update_character_spell_slot_v1_pre_character_resource_bridge;
  end if;
  if to_regprocedure('public.update_character_spell_use_v1_pre_character_resource_bridge(uuid,uuid,text)') is null then
    alter function public.update_character_spell_use_v1(uuid,uuid,text)
      rename to update_character_spell_use_v1_pre_character_resource_bridge;
  end if;
  if to_regprocedure('public.complete_character_rest_v1_pre_character_resource_bridge(uuid,text)') is null then
    alter function public.complete_character_rest_v1(uuid,text)
      rename to complete_character_rest_v1_pre_character_resource_bridge;
  end if;
end;
$rename_sheet_functions$;

revoke all on function public.character_sheet_resource_profile_v1_pre_character_resource_bridge(uuid) from public, anon, authenticated;
revoke all on function public.update_character_spell_slot_v1_pre_character_resource_bridge(uuid,text,integer,text) from public, anon, authenticated;
revoke all on function public.update_character_spell_use_v1_pre_character_resource_bridge(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.complete_character_rest_v1_pre_character_resource_bridge(uuid,text) from public, anon, authenticated;
grant execute on function public.character_sheet_resource_profile_v1_pre_character_resource_bridge(uuid) to service_role;
grant execute on function public.update_character_spell_slot_v1_pre_character_resource_bridge(uuid,text,integer,text) to service_role;
grant execute on function public.update_character_spell_use_v1_pre_character_resource_bridge(uuid,uuid,text) to service_role;
grant execute on function public.complete_character_rest_v1_pre_character_resource_bridge(uuid,text) to service_role;

create or replace function public.character_sheet_resource_profile_v1(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_profile jsonb;
begin
  v_profile:=public.character_sheet_resource_profile_v1_pre_character_resource_bridge(p_character_id);
  return private.append_character_resource_bridge_state_v1(p_character_id,v_profile);
end;
$function$;

create or replace function public.update_character_spell_slot_v1(
  p_character_id uuid,
  p_pool_key text,
  p_slot_level integer,
  p_operation text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_profile jsonb;
begin
  perform private.assert_character_resource_sheet_unlocked_v1(p_character_id);
  v_profile:=public.update_character_spell_slot_v1_pre_character_resource_bridge(
    p_character_id,p_pool_key,p_slot_level,p_operation
  );
  return private.append_character_resource_bridge_state_v1(p_character_id,v_profile);
end;
$function$;

create or replace function public.update_character_spell_use_v1(
  p_character_id uuid,
  p_assignment_id uuid,
  p_operation text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_profile jsonb;
begin
  perform private.assert_character_resource_sheet_unlocked_v1(p_character_id);
  v_profile:=public.update_character_spell_use_v1_pre_character_resource_bridge(
    p_character_id,p_assignment_id,p_operation
  );
  return private.append_character_resource_bridge_state_v1(p_character_id,v_profile);
end;
$function$;

create or replace function public.complete_character_rest_v1(
  p_character_id uuid,
  p_rest_type text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_profile jsonb;
begin
  perform private.assert_character_resource_sheet_unlocked_v1(p_character_id);
  v_profile:=public.complete_character_rest_v1_pre_character_resource_bridge(p_character_id,p_rest_type);
  return private.append_character_resource_bridge_state_v1(p_character_id,v_profile);
end;
$function$;

revoke all on function public.character_sheet_resource_profile_v1(uuid) from public, anon;
revoke all on function public.update_character_spell_slot_v1(uuid,text,integer,text) from public, anon;
revoke all on function public.update_character_spell_use_v1(uuid,uuid,text) from public, anon;
revoke all on function public.complete_character_rest_v1(uuid,text) from public, anon;
grant execute on function public.character_sheet_resource_profile_v1(uuid) to authenticated, service_role;
grant execute on function public.update_character_spell_slot_v1(uuid,text,integer,text) to authenticated, service_role;
grant execute on function public.update_character_spell_use_v1(uuid,uuid,text) to authenticated, service_role;
grant execute on function public.complete_character_rest_v1(uuid,text) to authenticated, service_role;

-- Read-only realtime access lets an open Sheet & Rolls tab refresh after a battle-board cast.
alter table public.character_spell_slots replica identity full;
grant select on public.character_spell_slots to authenticated;
drop policy if exists character_spell_slots_authenticated_read on public.character_spell_slots;
create policy character_spell_slots_authenticated_read on public.character_spell_slots
for select to authenticated
using (public.can_manage_character_progression_v1(character_id));

do $realtime$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='character_spell_slots'
  ) then
    alter publication supabase_realtime add table public.character_spell_slots;
  end if;
end;
$realtime$;

comment on function private.mirror_encounter_spell_slot_spend_v1() is
  'Mirrors active encounter spell-slot decrements into the persistent character spell-slot ledger in the same transaction.';
comment on function private.refresh_encounter_spell_slots_from_characters_v1(uuid) is
  'Refreshes a staged encounter slot snapshot from persistent character resources when the encounter becomes active.';
comment on function public.encounter_spellcasting_profile_v1(uuid) is
  'Returns the guarded tactical spellcasting profile plus persistent character slot state and mismatch metadata.';

-- No reconciliation update is performed here. Existing active encounter snapshots remain unchanged.

do $postconditions$
begin
  if not exists(select 1 from pg_trigger where tgname='encounter_spell_slot_character_spend_bridge' and not tgisinternal) then
    raise exception 'encounter spell-slot character spend bridge trigger missing';
  end if;
  if not exists(select 1 from pg_trigger where tgname='encounter_spell_slots_refresh_on_activation' and not tgisinternal) then
    raise exception 'encounter activation resource refresh trigger missing';
  end if;
  if not has_function_privilege('authenticated','public.encounter_spellcasting_profile_v1(uuid)','EXECUTE') then
    raise exception 'authenticated tactical spell profile access missing';
  end if;
  if not has_function_privilege('authenticated','public.character_sheet_resource_profile_v1(uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.update_character_spell_slot_v1(uuid,text,integer,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.update_character_spell_use_v1(uuid,uuid,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.complete_character_rest_v1(uuid,text)','EXECUTE') then
    raise exception 'guarded character resource wrapper grant missing';
  end if;
  if has_function_privilege('authenticated','public.encounter_spellcasting_profile_v1_pre_character_resource_bridge(uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.update_character_spell_slot_v1_pre_character_resource_bridge(uuid,text,integer,text)','EXECUTE')
     or has_function_privilege('authenticated','public.update_character_spell_use_v1_pre_character_resource_bridge(uuid,uuid,text)','EXECUTE')
     or has_function_privilege('authenticated','public.complete_character_rest_v1_pre_character_resource_bridge(uuid,text)','EXECUTE') then
    raise exception 'pre-bridge functions must not remain directly executable by authenticated users';
  end if;
  if not has_table_privilege('authenticated','public.character_spell_slots','SELECT')
     or has_table_privilege('authenticated','public.character_spell_slots','UPDATE')
     or has_table_privilege('authenticated','public.character_spell_slots','INSERT')
     or has_table_privilege('authenticated','public.character_spell_slots','DELETE') then
    raise exception 'character spell-slot privileges must remain read-only for authenticated users';
  end if;
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='character_spell_slots'
  ) then
    raise exception 'character spell slots realtime publication missing';
  end if;
end;
$postconditions$;

commit;
