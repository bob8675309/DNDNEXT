begin;

-- Core tactical bridge. Existing active encounter counts are deliberately preserved.
-- New/activated encounters snapshot persistent character resources, and future spends
-- reduce both ledgers atomically.

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

comment on function private.mirror_encounter_spell_slot_spend_v1() is
  'Mirrors active encounter spell-slot decrements into the persistent character spell-slot ledger in the same transaction.';
comment on function private.refresh_encounter_spell_slots_from_characters_v1(uuid) is
  'Refreshes a staged encounter slot snapshot from persistent character resources when the encounter becomes active.';

do $postconditions$
begin
  if not exists(select 1 from pg_trigger where tgname='encounter_spell_slot_character_spend_bridge' and not tgisinternal) then
    raise exception 'encounter spell-slot character spend bridge trigger missing';
  end if;
  if not exists(select 1 from pg_trigger where tgname='encounter_spell_slots_refresh_on_activation' and not tgisinternal) then
    raise exception 'encounter activation resource refresh trigger missing';
  end if;
  if has_function_privilege('authenticated','private.mirror_encounter_spell_slot_spend_v1()','EXECUTE')
     or has_function_privilege('authenticated','private.refresh_encounter_spell_slots_from_characters_v1(uuid)','EXECUTE') then
    raise exception 'tactical character resource bridge helpers must remain private';
  end if;
end;
$postconditions$;

commit;
