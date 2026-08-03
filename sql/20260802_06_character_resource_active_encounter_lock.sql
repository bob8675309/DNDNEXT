begin;

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
    where p.character_id=p_character_id and e.status='active'
    order by e.updated_at desc,e.id
    limit 1
  );
$function$;
revoke all on function private.character_active_encounter_v1(uuid) from public, anon, authenticated;
grant execute on function private.character_active_encounter_v1(uuid) to service_role;

create or replace function private.assert_character_resource_not_active_v1(p_character_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_active jsonb;
begin
  if coalesce(current_setting('dndnext.resource_bridge_context',true),'') in ('encounter_spend','maintenance') then
    return;
  end if;
  v_active:=private.character_active_encounter_v1(p_character_id);
  if v_active is not null then
    raise exception 'Spell resources are controlled by the active battle board encounter: %.',
      coalesce(v_active->>'encounterName','Active encounter')
      using errcode='55000',
            hint='Spend spell slots on the battle board, or finish/archive the encounter before changing resources or resting from Sheet & Rolls.';
  end if;
end;
$function$;
revoke all on function private.assert_character_resource_not_active_v1(uuid) from public, anon, authenticated;
grant execute on function private.assert_character_resource_not_active_v1(uuid) to service_role;

create or replace function private.guard_character_spell_slot_update_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  if new.slots_remaining is distinct from old.slots_remaining then
    perform private.assert_character_resource_not_active_v1(new.character_id);
  end if;
  return new;
end;
$function$;
revoke all on function private.guard_character_spell_slot_update_v1() from public, anon, authenticated;
grant execute on function private.guard_character_spell_slot_update_v1() to service_role;

drop trigger if exists character_spell_slots_active_encounter_guard on public.character_spell_slots;
create trigger character_spell_slots_active_encounter_guard
before update of slots_remaining on public.character_spell_slots
for each row execute function private.guard_character_spell_slot_update_v1();

create or replace function private.guard_character_spell_use_update_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  if new.uses_remaining is distinct from old.uses_remaining then
    perform private.assert_character_resource_not_active_v1(new.character_id);
  end if;
  return new;
end;
$function$;
revoke all on function private.guard_character_spell_use_update_v1() from public, anon, authenticated;
grant execute on function private.guard_character_spell_use_update_v1() to service_role;

drop trigger if exists character_spell_uses_active_encounter_guard on public.character_spells;
create trigger character_spell_uses_active_encounter_guard
before update of uses_remaining on public.character_spells
for each row execute function private.guard_character_spell_use_update_v1();

create or replace function private.guard_character_rest_insert_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  perform private.assert_character_resource_not_active_v1(new.character_id);
  return new;
end;
$function$;
revoke all on function private.guard_character_rest_insert_v1() from public, anon, authenticated;
grant execute on function private.guard_character_rest_insert_v1() to service_role;

drop trigger if exists character_rest_active_encounter_guard on public.character_rest_log;
create trigger character_rest_active_encounter_guard
before insert on public.character_rest_log
for each row execute function private.guard_character_rest_insert_v1();

-- Update the core mirror so its persistent decrement is explicitly recognized as battle-board authority.
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

  select p.character_id,e.status into v_character_id,v_encounter_status
  from public.encounter_participants p
  join public.encounters e on e.id=p.encounter_id
  where p.id=new.participant_id;
  if v_character_id is null or v_encounter_status is distinct from 'active' then return new; end if;

  perform private.sync_character_spell_slots_v1(v_character_id);
  v_delta:=old.slots_remaining-new.slots_remaining;
  select slots_remaining into v_character_remaining
  from public.character_spell_slots
  where character_id=v_character_id and pool_key=new.pool_key and slot_level=new.slot_level
  for update;
  if not found then
    raise exception 'Persistent character spell-slot pool is missing for % level %.',new.pool_key,new.slot_level using errcode='P0002';
  end if;
  if v_character_remaining<v_delta then
    raise exception 'Persistent character spell resources have only % slot(s) remaining; this cast requires %.',v_character_remaining,v_delta
      using errcode='22023',hint='Refresh the battle board. Sheet-side resources cannot be changed while this encounter is active.';
  end if;

  perform set_config('dndnext.resource_bridge_context','encounter_spend',true);
  update public.character_spell_slots
  set slots_remaining=slots_remaining-v_delta,updated_at=timezone('utc',now())
  where character_id=v_character_id and pool_key=new.pool_key and slot_level=new.slot_level;
  perform set_config('dndnext.resource_bridge_context','',true);
  return new;
end;
$function$;

create or replace function public.character_sheet_resource_profile_v2(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $function$
declare
  v_profile jsonb;
  v_active jsonb;
begin
  v_profile:=public.character_sheet_resource_profile_v1(p_character_id);
  v_active:=private.character_active_encounter_v1(p_character_id);
  return coalesce(v_profile,'{}'::jsonb)||jsonb_build_object(
    'resourceBridgeVersion',1,
    'encounterLocked',v_active is not null,
    'activeEncounter',v_active
  );
end;
$function$;
revoke all on function public.character_sheet_resource_profile_v2(uuid) from public, anon;
grant execute on function public.character_sheet_resource_profile_v2(uuid) to authenticated, service_role;

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
    where pubname='supabase_realtime' and schemaname='public' and tablename='character_spell_slots'
  ) then
    alter publication supabase_realtime add table public.character_spell_slots;
  end if;
end;
$realtime$;

comment on function public.character_sheet_resource_profile_v2(uuid) is
  'Returns persistent sheet resources plus active battle-board lock metadata.';

do $postconditions$
begin
  if not exists(select 1 from pg_trigger where tgname='character_spell_slots_active_encounter_guard' and not tgisinternal) then
    raise exception 'character spell-slot active encounter guard missing';
  end if;
  if not exists(select 1 from pg_trigger where tgname='character_spell_uses_active_encounter_guard' and not tgisinternal) then
    raise exception 'character limited-use spell active encounter guard missing';
  end if;
  if not exists(select 1 from pg_trigger where tgname='character_rest_active_encounter_guard' and not tgisinternal) then
    raise exception 'character rest active encounter guard missing';
  end if;
  if not has_function_privilege('authenticated','public.character_sheet_resource_profile_v2(uuid)','EXECUTE') then
    raise exception 'character resource profile v2 grant missing';
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
