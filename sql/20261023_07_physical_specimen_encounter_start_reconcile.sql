-- Physical Specimen HP reconciliation for staged encounters entering active play.
-- Depends on _02 through _06. Does not replace admin_start_encounter_v1,
-- rewrite character_sheets, or alter map, town, movement or turn rules.
--
-- Snapshot provenance is recorded only when an active HP benefit is staged.
-- At encounter start we reconcile the delta (not the whole maximum HP) so
-- GM-provided and unrelated max-HP adjustments are preserved.

create or replace function private.guard_encounter_participant_max_hp_v1()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public,private
as $hp_guard$
declare
  v_sheet jsonb;
  v_max integer;
  v_bonus jsonb;
  v_hp_delta integer:=0;
begin
  if new.max_hp is null then
    select cs.sheet into v_sheet from public.character_sheets cs
      where cs.character_id=new.character_id;
    begin
      v_max:=coalesce(
        nullif(v_sheet->>'maxHp','')::integer,
        nullif(v_sheet->>'hp','')::integer,
        new.current_hp,1
      );
    exception when others then
      v_max:=coalesce(new.current_hp,1);
    end;
    v_bonus:=private.physical_specimen_active_bonuses_v1(new.character_id);
    v_hp_delta:=greatest(0,coalesce((v_bonus->>'hpMaxBonus')::integer,0));
    new.max_hp:=greatest(0,coalesce(v_max,1)+v_hp_delta);
    if v_hp_delta>0 then
      new.state:=coalesce(new.state,'{}'::jsonb) ||
        jsonb_build_object('physicalSpecimenSnapshot',
          jsonb_build_object(
            'maxHpDeltaApplied',v_hp_delta,'source','staging'
          )
        );
    end if;
  end if;
  if new.current_hp is not null and new.max_hp is not null
    and new.current_hp>new.max_hp then
    new.current_hp:=new.max_hp;
  end if;
  return new;
end;
$hp_guard$;

create or replace function private.reconcile_physical_specimen_at_encounter_start_v1(
  p_participant_id uuid
) returns jsonb
language plpgsql security definer
set search_path=pg_catalog,public,private
as $reconcile$
declare
  v_p public.encounter_participants%rowtype;
  v_bonus jsonb;
  v_desired integer:=0;
  v_applied integer:=0;
  v_saved_delta jsonb;
  v_sheet jsonb;
  v_base_max integer;
  v_new_max integer;
  v_next_state jsonb;
  v_progression_locked boolean;
begin
  select * into v_p from public.encounter_participants
    where id=p_participant_id for update;
  if not found or v_p.character_id is null or v_p.is_defeated then
    return jsonb_build_object('changed',false,'reason','not_eligible_participant');
  end if;
  -- Outside-encounter activation locks progression before writing its
  -- runtime row. Wait on that lock so start cannot miss an in-flight use.
  select true into v_progression_locked
    from public.character_progression
    where character_id=v_p.character_id for update;
  if not coalesce(v_progression_locked,false) then
    return jsonb_build_object('changed',false,'reason','no_progression');
  end if;
  v_bonus:=private.physical_specimen_active_bonuses_v1(v_p.character_id);
  v_desired:=greatest(0,coalesce((v_bonus->>'hpMaxBonus')::integer,0));
  v_saved_delta:=v_p.state #> '{physicalSpecimenSnapshot,maxHpDeltaApplied}';
  if v_saved_delta is not null then
    if jsonb_typeof(v_saved_delta)<>'number'
      or v_saved_delta::text !~ '^[0-9]{1,6}$' then
      raise exception 'Invalid Physical Specimen HP snapshot provenance.'
        using errcode='22023';
    end if;
    v_applied:=v_saved_delta::text::integer;
  elsif v_desired>0 then
    -- Backward compatibility for already-staged rows without provenance:
    -- a value matching base+delta has already absorbed the bonus.
    select sheet into v_sheet from public.character_sheets
      where character_id=v_p.character_id;
    begin
      v_base_max:=coalesce(
        nullif(v_sheet->>'maxHp','')::integer,
        nullif(v_sheet->>'hp','')::integer,null
      );
    exception when others then
      v_base_max:=null;
    end;
    if v_base_max is not null and v_p.max_hp=v_base_max+v_desired then
      v_applied:=v_desired;
    end if;
  end if;
  if v_applied>0 and v_p.max_hp is null then
    raise exception 'Missing encounter maximum HP with previously applied Physical Specimen.'
      using errcode='22023';
  end if;
  if v_applied=0 and v_desired=0 then
    return jsonb_build_object('changed',false,'reason','no_hp_bonus');
  end if;
  v_new_max:=coalesce(v_p.max_hp,0)-v_applied+v_desired;
  if v_new_max<0 then
    raise exception 'Physical Specimen reconciliation would create negative maximum HP.'
      using errcode='22023';
  end if;
  v_next_state:=coalesce(v_p.state,'{}'::jsonb)
    || jsonb_build_object('physicalSpecimenSnapshot',
       jsonb_build_object(
         'maxHpDeltaApplied',v_desired,
         'source','encounter_start'
       ));
  if v_new_max is distinct from v_p.max_hp
    or v_next_state is distinct from v_p.state then
    update public.encounter_participants set
      max_hp=v_new_max,
      current_hp=case
        when current_hp is null then null
        else least(current_hp,v_new_max)
      end,
      state=v_next_state,
      updated_at=timezone('utc',now())
    where id=p_participant_id;
  end if;
  return jsonb_build_object('changed',v_new_max is distinct from v_p.max_hp,
    'previousMaxHp',v_p.max_hp,'effectiveMaxHp',v_new_max,
    'previousDelta',v_applied,'activeDelta',v_desired);
end;
$reconcile$;

-- The original start procedure updates turn availability and canonical Speed,
-- then changes the encounter's status to active. A BEFORE status transition
-- reconciles HP in that same transaction, after canonical Speed has refreshed.
create or replace function private.reconcile_physical_specimen_start_trigger_v1()
returns trigger
language plpgsql security definer
set search_path=pg_catalog,public,private
as $reconcile_trigger$
declare
  v_p record;
begin
  if new.status='active'
    and old.status in ('draft','ready','initiative')
    and old.status is distinct from new.status then
    for v_p in
      select p.id from public.encounter_participants p
      where p.encounter_id=new.id and p.character_id is not null
        and not p.is_defeated
      order by p.id
    loop
      perform private.reconcile_physical_specimen_at_encounter_start_v1(v_p.id);
    end loop;
  end if;
  return new;
end;
$reconcile_trigger$;

drop trigger if exists physical_specimen_encounter_start_reconcile
  on public.encounters;
create trigger physical_specimen_encounter_start_reconcile
before update of status on public.encounters
for each row
execute function private.reconcile_physical_specimen_start_trigger_v1();

revoke all on function private.reconcile_physical_specimen_at_encounter_start_v1(uuid)
  from public,anon,authenticated;
revoke all on function private.reconcile_physical_specimen_start_trigger_v1()
  from public,anon,authenticated;
grant execute on function private.reconcile_physical_specimen_at_encounter_start_v1(uuid)
  to service_role;
