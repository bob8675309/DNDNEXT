-- Physical Specimen: carry Long-Rest active HP/Speed into tactical snapshots.
-- Depends on 20261023_02, _03, _04, _05. Gameplay-only; no UI or
-- world/town-map behavior. Preserve other canonical encounter calculations.
--
-- Read-only internal feature deltas. Eligibility, source provenance,
-- selection count/uniqueness, and rest expiry fail closed.
create or replace function private.physical_specimen_active_bonuses_v1(
  p_character_id uuid
) returns jsonb
language plpgsql stable security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_empty jsonb:=jsonb_build_object(
    'active',false,'hpMaxBonus',0,'speedBonusFt',0
  );
  v_context jsonb;
  v_options jsonb;
  v_saved jsonb;
  v_keys jsonb;
  v_key_array text[];
  v_activated_at timestamptz;
  v_latest_long_rest timestamptz;
begin
  if p_character_id is null then return v_empty; end if;
  v_context:=private.physical_specimen_context_v1(p_character_id);
  if not coalesce((v_context->>'eligible')::boolean,false) then
    return v_empty;
  end if;
  select r.state into v_saved
  from public.character_runtime_feature_choices r
  where r.character_id=p_character_id
    and r.feature_key='warlock-parasite-physical-specimen';
  if not found
     or jsonb_typeof(v_saved) is distinct from 'object'
     or coalesce(v_saved->>'activated','')<>'true'
     or jsonb_typeof(v_saved->'benefitKeys') is distinct from 'array' then
    return v_empty;
  end if;
  begin
    v_activated_at:=(v_saved->>'activatedAt')::timestamptz;
  exception when others then
    return v_empty;
  end;
  if v_activated_at is null then return v_empty; end if;
  select max(completed_at) into v_latest_long_rest
    from public.character_rest_log
    where character_id=p_character_id and rest_type='long_rest';
  if v_latest_long_rest is not null and v_latest_long_rest>v_activated_at then
    return v_empty;
  end if;
  if exists (
    select 1 from jsonb_array_elements(v_saved->'benefitKeys') k(value)
    where jsonb_typeof(k.value)<>'string'
  ) then return v_empty; end if;
  select array_agg(k.value order by k.ordinality) into v_key_array
    from jsonb_array_elements_text(v_saved->'benefitKeys')
      with ordinality k(value,ordinality);
  v_options:=private.physical_specimen_options_v1();
  if jsonb_array_length(v_options)<>6
    or not coalesce(private.physical_specimen_valid_benefit_keys_v1(
      v_key_array,v_options,(v_context->>'maxBenefits')::integer
    ),false) then
    return v_empty;
  end if;
  return jsonb_build_object(
    'active',true,
    'hpMaxBonus',case when 'enhanced-vitality'=any(v_key_array)
      then (v_context->>'classLevel')::integer else 0 end,
    'speedBonusFt',case when 'increased-speed'=any(v_key_array)
      then 5 else 0 end
  );
end;
$$;

-- The canonical encounter Speed helper is used when staging participants,
-- starting encounters, advancing turns, and recalculating several spell
-- effects. Applying the active runtime delta once here prevents speed
-- changes from disappearing at the next canonical refresh.
create or replace function public.encounter_canonical_speed_ft_v1(
  p_character_id uuid
) returns integer
language plpgsql stable security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_raw text;
  v_base_speed integer:=30;
  v_bonus jsonb;
begin
  if p_character_id is null then return 30; end if;
  select cs.sheet->>'speed' into v_raw
    from public.character_sheets cs where cs.character_id=p_character_id;
  if coalesce(v_raw,'') ~ '^[0-9]+$' then
    if v_raw::integer>0 then v_base_speed:=v_raw::integer; end if;
  end if;
  v_bonus:=private.physical_specimen_active_bonuses_v1(p_character_id);
  return v_base_speed+coalesce((v_bonus->>'speedBonusFt')::integer,0);
end;
$$;

-- The existing before-INSERT/UPDATE max-HP guard populates max_hp from the
-- persistent sheet only when a snapshot has no max_hp. Extend *that* initial
-- projection with the active feature delta; never add a second bonus to an
-- existing snapshot or rewrite permanent character sheet fields.
create or replace function private.guard_encounter_participant_max_hp_v1()
returns trigger
language plpgsql security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_sheet jsonb;
  v_max integer;
  v_bonus jsonb;
begin
  if new.max_hp is null then
    select cs.sheet into v_sheet
      from public.character_sheets cs
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
    new.max_hp:=greatest(0,
      coalesce(v_max,1)+coalesce((v_bonus->>'hpMaxBonus')::integer,0)
    );
  end if;
  if new.current_hp is not null
     and new.max_hp is not null
     and new.current_hp>new.max_hp then
    new.current_hp:=new.max_hp;
  end if;
  return new;
end;
$$;

revoke all on function private.physical_specimen_active_bonuses_v1(uuid)
  from public,anon,authenticated;
grant execute on function private.physical_specimen_active_bonuses_v1(uuid)
  to service_role;
-- Preserve the hardened canonical tactical Speed helper grants.
revoke all on function public.encounter_canonical_speed_ft_v1(uuid)
  from public,anon,authenticated;
grant execute on function public.encounter_canonical_speed_ft_v1(uuid)
  to service_role;
