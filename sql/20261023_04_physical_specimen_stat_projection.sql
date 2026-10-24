-- Physical Specimen additive sheet-stat projection, not a paper-sheet rewrite.
-- Depends on 20261023_02 and 20261023_03.
--
-- Returns current effective values while leaving persistent base HP, max HP,
-- Speed and skills untouched. Never change a tactical encounter snapshot here.
-- The final caller must reconcile a persisted current HP above the new maximum
-- when a buff expires; that reconciliation is a separate transactional action.

create or replace function public.get_character_physical_specimen_effective_stats_v1(
  p_character_id uuid
) returns jsonb
language plpgsql
stable security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_effects jsonb;
  v_sheet jsonb;
  v_raw text;
  v_base_max_hp integer;
  v_base_current_hp integer;
  v_base_temp_hp integer:=0;
  v_base_speed integer;
  v_hp_bonus integer;
  v_speed_bonus integer;
  v_effective_max_hp integer;
  v_effective_current_hp integer;
  v_effective_speed integer;
  v_needs_hp_reconciliation boolean;
  v_climb boolean;
begin
  -- This getter checks the per-character progression permission before reading
  -- any sheet fields; an arbitrary character UUID is not sufficient.
  v_effects:=public.get_character_physical_specimen_effects_v1(p_character_id);
  if not coalesce((v_effects->>'available')::boolean,false) then
    return jsonb_build_object(
      'available',false,'active',false,
      'effectsIntegrated',false,'baseStats',null,'effectiveStats',null
    );
  end if;
  select cs.sheet into v_sheet from public.character_sheets cs
    where cs.character_id=p_character_id;
  if not found or jsonb_typeof(v_sheet)<>'object' then
    raise exception 'Physical Specimen requires an existing character sheet.'
      using errcode='22023';
  end if;

  v_raw:=v_sheet->>'maxHp';
  if v_raw is not null and v_raw ~ '^[0-9]{1,6}$' then
    v_base_max_hp:=greatest(1,v_raw::integer);
  else
    v_raw:=v_sheet->>'hp';
    if v_raw is not null and v_raw ~ '^[0-9]{1,6}$' then
      v_base_max_hp:=greatest(1,v_raw::integer);
    else
      raise exception 'Cannot project temporary HP without a valid stored max HP or current HP.'
        using errcode='22023';
    end if;
  end if;
  v_raw:=v_sheet->>'hp';
  if v_raw is not null and v_raw ~ '^[0-9]{1,6}$' then
    v_base_current_hp:=v_raw::integer;
  else
    v_base_current_hp:=v_base_max_hp;
  end if;
  v_raw:=v_sheet->>'tempHp';
  if v_raw is not null and v_raw ~ '^[0-9]{1,6}$' then
    v_base_temp_hp:=v_raw::integer;
  end if;

  -- Reuse the existing canonical tactical speed helper rather than inventing
  -- another base-Speed formula (it reads the saved sheet, with a 30ft default).
  v_base_speed:=public.encounter_canonical_speed_ft_v1(p_character_id);
  v_hp_bonus:=greatest(0,coalesce((v_effects->>'hpMaxBonus')::integer,0));
  v_speed_bonus:=greatest(0,coalesce((v_effects->>'speedBonusFt')::integer,0));
  v_effective_max_hp:=v_base_max_hp+v_hp_bonus;
  -- Increasing only maximum HP does NOT heal current HP. Once a benefit
  -- expires, clamp the displayed current HP, but do not overwrite stored HP.
  v_effective_current_hp:=least(v_base_current_hp,v_effective_max_hp);
  v_needs_hp_reconciliation:=v_base_current_hp>v_effective_max_hp;
  v_effective_speed:=v_base_speed+v_speed_bonus;
  v_climb:=coalesce((v_effects->>'climbSpeedEqualsEffectiveSpeed')::boolean,false);

  return jsonb_build_object(
    'available',true,
    'active',coalesce((v_effects->>'active')::boolean,false),
    'effectsIntegrated',false,
    'projectionOnly',true,
    'baseStats',jsonb_build_object(
      'maxHp',v_base_max_hp,'currentHp',v_base_current_hp,
      'tempHp',v_base_temp_hp,'speedFt',v_base_speed
    ),
    'effectiveStats',jsonb_build_object(
      'maxHp',v_effective_max_hp,
      'currentHp',v_effective_current_hp,
      'tempHp',v_base_temp_hp,
      'speedFt',v_effective_speed,
      'climbSpeedFt',case when v_climb then v_effective_speed else null end,
      'jumpDistanceMultiplier',v_effects->'jumpDistanceMultiplier',
      'poisonedSaveAdvantage',v_effects->'poisonedSaveAdvantage',
      'athleticsCheckBonus',v_effects->'athleticsCheckBonus',
      'acrobaticsCheckBonus',v_effects->'acrobaticsCheckBonus'
    ),
    'darkvisionRule',jsonb_build_object(
      'grantedMinFt',v_effects->'darkvisionGrantedMinFt',
      'additionalFtIfAlreadyPresent',v_effects->'darkvisionExtraFt',
      'requiresCanonicalVisionLookup',true
    ),
    'requiresHpReconciliation',v_needs_hp_reconciliation,
    'hpReconciliationNote',case when v_needs_hp_reconciliation
      then 'Stored current HP exceeds the effective maximum after a feature expired. Reconcile via the canonical HP action authority.'
      else null end
  );
end;
$$;

revoke all on function public.get_character_physical_specimen_effective_stats_v1(uuid)
  from public,anon;
grant execute on function public.get_character_physical_specimen_effective_stats_v1(uuid)
  to authenticated,service_role;
