-- The test harness uses the anonymous/authenticated role, no privileged app keys.
\set ON_ERROR_STOP on
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',false);
set role authenticated;
do $test$
declare
  v jsonb;
  v_effects jsonb;
  v_failed boolean;
begin
  v:=public.get_character_physical_specimen_v1('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  if v->>'available'<>'true' or v #>> '{context,maxBenefits}' <> '5'
    or jsonb_array_length(v->'options')<>6 then
    raise exception 'Canonical Physical Specimen availability/Charisma cap failed: %',v;
  end if;
  v:=public.get_character_physical_specimen_v1('dddddddd-dddd-dddd-dddd-dddddddddddd');
  if v->>'available'<>'false' then raise exception 'Wrong-subclass character was eligible'; end if;
  v:=public.get_character_physical_specimen_v1('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
  if v #>> '{context,maxBenefits}' <> '1'
    or v->>'canActivateOutsideEncounter'<>'false' then
    raise exception 'Low-Charisma or encounter gating incorrect: %',v;
  end if;
  v_failed:=false;
  begin
    perform public.activate_character_physical_specimen_v1(
      'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',array['enhanced-vitality']);
  exception when sqlstate '55000' then v_failed:=true;
  end;
  if not v_failed then raise exception 'Encounter Bonus Action guard failed'; end if;
  v_failed:=false;
  begin
    perform public.activate_character_physical_specimen_v1(
      'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      array['enhanced-vitality','enhanced-vision']);
  exception when sqlstate '55000' then v_failed:=true;
  end;
  if not v_failed then raise exception 'Encounter gate must apply even before option validation'; end if;
  v_failed:=false;
  begin
    perform public.activate_character_physical_specimen_v1(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      array['enhanced-vitality','enhanced-vitality']);
  exception when sqlstate '22023' then v_failed:=true;
  end;
  if not v_failed then raise exception 'Duplicate benefits were accepted'; end if;
  v_failed:=false;
  begin
    perform public.activate_character_physical_specimen_v1(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      array['enhanced-vitality','not-source-backed']);
  exception when sqlstate '22023' then v_failed:=true;
  end;
  if not v_failed then raise exception 'Unknown benefit was accepted'; end if;
  v_failed:=false;
  begin
    perform public.activate_character_physical_specimen_v1(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',null);
  exception when sqlstate '22023' then v_failed:=true;
  end;
  if not v_failed then raise exception 'Null selection accepted'; end if;
  v_failed:=false;
  begin
    perform public.activate_character_physical_specimen_v1(
      'dddddddd-dddd-dddd-dddd-dddddddddddd',
      array['enhanced-vitality']);
  exception when sqlstate '22023' then v_failed:=true;
  end;
  if not v_failed then raise exception 'Wrong subclass activation accepted'; end if;
  v:=public.activate_character_physical_specimen_v1(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    array['enhanced-vitality','enhanced-vision','increased-speed',
          'poison-resistance-training','enhanced-mobility']);
  if v->>'saved'<>'true' then raise exception 'Activation did not persist'; end if;
  v:=public.get_character_physical_specimen_v1('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  if v->>'active'<>'true' or v->>'activationSpentThisRest'<>'true'
    or v->>'canActivateOutsideEncounter'<>'false' then
    raise exception 'Activation not reflected in getter: %',v;
  end if;
  v_effects:=public.get_character_physical_specimen_effects_v1(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  if v_effects->>'hpMaxBonus'<>'3'
    or v_effects->>'speedBonusFt'<>'5'
    or v_effects->>'poisonedSaveAdvantage'<>'true'
    or v_effects->>'effectsIntegrated'<>'false' then
    raise exception 'Incorrect non-destructive stat projection: %',v_effects;
  end if;
  v_failed:=false;
  begin
    perform public.activate_character_physical_specimen_v1(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',array['physical-aptitude']);
  exception when sqlstate '22023' then v_failed:=true;
  end;
  if not v_failed then raise exception 'Duplicate activation was accepted'; end if;
  v_failed:=false;
  begin
    perform public.swap_character_physical_specimen_benefit_v1(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'enhanced-vitality','physical-aptitude');
  exception when sqlstate '22023' then v_failed:=true;
  end;
  if not v_failed then raise exception 'Swap before Short Rest was accepted'; end if;
end
$test$;
reset role;

insert into public.character_rest_log values
  ('33333333-3333-3333-3333-333333333333',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','short_rest',clock_timestamp());
set role authenticated;
do $test$
declare v jsonb; v_failed boolean:=false;
begin
  v:=public.swap_character_physical_specimen_benefit_v1(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','enhanced-vitality','physical-aptitude');
  if v->>'saved'<>'true' then raise exception 'Short Rest swap failed'; end if;
  v:=public.get_character_physical_specimen_effects_v1(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  if v->>'hpMaxBonus'<>'0' or v->>'athleticsCheckBonus'<>'5'
    or v->>'acrobaticsCheckBonus'<>'5' then
    raise exception 'Swap did not recalculate runtime deltas: %',v;
  end if;
  begin
    perform public.swap_character_physical_specimen_benefit_v1(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'enhanced-vision','enhanced-vitality');
  exception when sqlstate '22023' then v_failed:=true;
  end;
  if not v_failed then raise exception 'Repeated swap after one Short Rest accepted'; end if;
end
$test$;
reset role;

insert into public.character_rest_log values
  ('44444444-4444-4444-4444-444444444444',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','short_rest',clock_timestamp());
set role authenticated;
do $test$
declare v jsonb;
begin
  v:=public.swap_character_physical_specimen_benefit_v1(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'enhanced-vision','enhanced-vitality');
  if v->>'saved'<>'true' then raise exception 'New Short Rest did not allow one new swap'; end if;
end
$test$;
reset role;

insert into public.character_rest_log values
  ('55555555-5555-5555-5555-555555555555',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','long_rest',clock_timestamp());
set role authenticated;
do $test$
declare v jsonb; eff jsonb; v_failed boolean:=false;
begin
  v:=public.get_character_physical_specimen_v1('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  if v->>'active'<>'false' or v->>'canActivateOutsideEncounter'<>'true'
    then raise exception 'Long Rest did not expire/recharge the feature: %',v;
  end if;
  eff:=public.get_character_physical_specimen_effects_v1('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  if eff->>'hpMaxBonus'<>'0' or eff->>'speedBonusFt'<>'0'
    then raise exception 'Expired feature retains stat bonuses'; end if;
  begin
    perform public.swap_character_physical_specimen_benefit_v1(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'enhanced-vitality','enhanced-vision');
  exception when sqlstate '22023' then v_failed:=true;
  end;
  if not v_failed then raise exception 'Swap after Long Rest expiration accepted'; end if;
  v:=public.activate_character_physical_specimen_v1(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    array['physical-aptitude']);
  if v->>'saved'<>'true' or jsonb_array_length(v->'benefitKeys')<>1
    then raise exception 'Reactivation after Long Rest failed'; end if;
end
$test$;
reset role;

-- Clear the test encounter; its character may now activate once with only one
-- benefit because the canonical Charisma modifier is +1.
delete from public.test_active_encounters
where character_id='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
set role authenticated;
do $test$
declare v jsonb; v_failed boolean:=false;
begin
  begin
    perform public.activate_character_physical_specimen_v1(
      'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      array['enhanced-vitality','enhanced-vision']);
  exception when sqlstate '22023' then v_failed:=true;
  end;
  if not v_failed then raise exception 'Charisma +1 character could select two benefits'; end if;
  v:=public.activate_character_physical_specimen_v1(
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',array['enhanced-vitality']);
  if v->>'saved'<>'true' then raise exception 'Low-Charisma character activation failed'; end if;
end
$test$;
reset role;

-- Even an administrator-provided broken saved choice list must not grant free uses.
update public.character_runtime_feature_choices
set state=jsonb_set(state,'{benefitKeys}','["bogus"]'::jsonb)
where character_id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
and feature_key='warlock-parasite-physical-specimen';
set role authenticated;
do $test$
declare v jsonb; v_failed boolean:=false;
begin
  v:=public.get_character_physical_specimen_v1('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  if v->>'stateIntegrityOk'<>'false'
    or v->>'canActivateOutsideEncounter'<>'false' then
    raise exception 'Malformed previously spent activation offered a free use: %',v;
  end if;
  begin
    perform public.activate_character_physical_specimen_v1(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      array['physical-aptitude']);
  exception when sqlstate '22023' then v_failed:=true;
  end;
  if not v_failed then raise exception 'Malformed activation row allowed reactivation'; end if;
end
$test$;
reset role;

-- A separate authenticated identity cannot access even a known character UUID.
select set_config('request.jwt.claim.sub','cccccccc-cccc-cccc-cccc-cccccccccccc',false);
set role authenticated;
do $test$
declare v_failed boolean:=false;
begin
  begin
    perform public.get_character_physical_specimen_v1(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  exception when sqlstate '42501' then v_failed:=true;
  end;
  if not v_failed then raise exception 'Non-owner was allowed to read Physical Specimen'; end if;
  v_failed:=false;
  begin
    perform public.activate_character_physical_specimen_v1(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      array['enhanced-vitality']);
  exception when sqlstate '42501' then v_failed:=true;
  end;
  if not v_failed then raise exception 'Non-owner was allowed to activate'; end if;
  v_failed:=false;
  begin
    perform public.swap_character_physical_specimen_benefit_v1(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'physical-aptitude','enhanced-vitality');
  exception when sqlstate '42501' then v_failed:=true;
  end;
  if not v_failed then raise exception 'Non-owner was allowed to swap'; end if;
end
$test$;
reset role;
select 'Physical Specimen isolated PostgreSQL behavioral tests passed' as result;
