-- Behavioral tests for the staged tactical Bonus Action command.
\set ON_ERROR_STOP on
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',false);

insert into public.character_progression values (
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  '11111111-1111-1111-1111-111111111111',
  'The Parasite Patron','GrimHollowPG24',3
);
insert into public.character_sheets values(
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  '{"abilities":{"cha":{"score":20}},"hp":20,"maxHp":24,"speed":30}'::jsonb
);
insert into public.character_permissions values(
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',true
);
insert into public.encounters(id,status,active_participant_id,round,turn_index)
values('12121212-1212-1212-1212-121212121212','active',
  '34343434-3434-3434-3434-343434343434',2,4);
insert into public.encounter_participants(
  id,encounter_id,character_id,display_name,controller_user_id,
  current_hp,max_hp,speed_ft
) values(
  '34343434-3434-3434-3434-343434343434',
  '12121212-1212-1212-1212-121212121212',
  'ffffffff-ffff-ffff-ffff-ffffffffffff',
  'Fixture Warlock',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  20,24,30
);
set role authenticated;
do $tactical$
declare
  v jsonb;
  v_repeat jsonb;
  v_req uuid:='56565656-5656-5656-5656-565656565656';
  v_options text[]:=array['enhanced-vitality','increased-speed',
    'enhanced-vision','poison-resistance-training','physical-aptitude'];
  v_participant public.encounter_participants%rowtype;
  v_failed boolean;
begin
  v:=public.encounter_activate_physical_specimen_v1(
    '34343434-3434-3434-3434-343434343434',v_options,v_req);
  if v->>'actionType'<>'bonus_action'
    or v->>'bonusActionAvailable'<>'false'
    or v->>'maxHp'<>'27' or v->>'speedFt'<>'35'
    or v->>'currentHp'<>'20'
    or v->>'effectsFullyIntegrated'<>'false' then
    raise exception 'Tactical snapshot incorrect: %',v;
  end if;
  select * into v_participant from public.encounter_participants
    where id='34343434-3434-3434-3434-343434343434';
  if v_participant.bonus_action_available or v_participant.max_hp<>27
    or v_participant.speed_ft<>35
    or v_participant.current_hp<>20
    or v_participant.state #>> '{physicalSpecimen,poisonedSaveAdvantage}'<>'true'
    or v_participant.state #>> '{physicalSpecimen,physicalAptitudeBonus}'<>'5' then
    raise exception 'Tactical participant update failed or did not record pending benefits';
  end if;
  v_repeat:=public.encounter_activate_physical_specimen_v1(
    '34343434-3434-3434-3434-343434343434',v_options,v_req);
  if v_repeat is distinct from v then
    raise exception 'Duplicate request did not return exactly the original result';
  end if;
  if (select count(*) from public.encounter_combat_log
    where encounter_id='12121212-1212-1212-1212-121212121212')<>1 then
    raise exception 'Idempotent request wrote more than one log';
  end if;
  if (select version from public.encounters
    where id='12121212-1212-1212-1212-121212121212')<>2 then
    raise exception 'Encounter version changed more than once';
  end if;
  v_failed:=false;
  begin
    perform public.encounter_activate_physical_specimen_v1(
      '34343434-3434-3434-3434-343434343434',
      array['enhanced-vitality'],v_req);
  exception when sqlstate '22023' then v_failed:=true;
  end;
  if not v_failed then
    raise exception 'Changed benefit payload reused the same request ID';
  end if;
  v_failed:=false;
  begin
    perform public.encounter_activate_physical_specimen_v1(
      '34343434-3434-3434-3434-343434343434',v_options,
      '78787878-7878-7878-7878-787878787878');
  exception when sqlstate '55000' then v_failed:=true;
  end;
  if not v_failed then raise exception 'Already spent Bonus Action was reused'; end if;
  if (select sheet->>'maxHp' from public.character_sheets
      where character_id='ffffffff-ffff-ffff-ffff-ffffffffffff')<>'24' then
    raise exception 'Tactical activation rewrote persistent maximum HP';
  end if;
end
$tactical$;
reset role;

-- Controller authorization and request-id uniqueness remain necessary
-- even if someone guesses the first activation's request UUID.
select set_config('request.jwt.claim.sub','cccccccc-cccc-cccc-cccc-cccccccccccc',false);
set role authenticated;
do $tactical$
declare v_failed boolean:=false;
begin
  begin
    perform public.encounter_activate_physical_specimen_v1(
      '34343434-3434-3434-3434-343434343434',
      array['enhanced-vitality','increased-speed','enhanced-vision',
        'poison-resistance-training','physical-aptitude'],
      '56565656-5656-5656-5656-565656565656');
  exception when sqlstate '42501' then v_failed:=true;
  end;
  if not v_failed then
    raise exception 'Another authenticated user could read idempotent request';
  end if;
end
$tactical$;
reset role;
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',false);

-- Each independent fixture character starts with a fresh, unspent use.
insert into public.character_progression values(
  '99999999-9999-9999-9999-999999999999',
  '11111111-1111-1111-1111-111111111111',
  'The Parasite Patron','GrimHollowPG24',3
);
insert into public.character_sheets values(
  '99999999-9999-9999-9999-999999999999',
  '{"abilities":{"cha":{"score":12}},"hp":9,"maxHp":12,"speed":30}'::jsonb
);
insert into public.character_permissions values(
  '99999999-9999-9999-9999-999999999999',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',true
);
insert into public.encounter_participants(
  id,encounter_id,character_id,display_name,controller_user_id,current_hp,max_hp
) values(
  '88888888-8888-8888-8888-888888888888',
  '12121212-1212-1212-1212-121212121212',
  '99999999-9999-9999-9999-999999999999',
  'Second Warlock','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',9,12
);
set role authenticated;
do $guard$
declare v_failed boolean; v jsonb;
begin
  v_failed:=false;
  begin
    perform public.encounter_activate_physical_specimen_v1(
      '88888888-8888-8888-8888-888888888888',
      array['enhanced-vitality'],
      '11111111-0000-0000-0000-000000000001');
  exception when sqlstate '55000' then v_failed:=true;
  end;
  if not v_failed then raise exception 'Out-of-turn Bonus Action accepted'; end if;
  -- Temporarily select the second character, test the Charisma limit,
  -- then test the Incapacitated condition and successful activation.
end
$guard$;
reset role;

update public.encounters set active_participant_id=
  '88888888-8888-8888-8888-888888888888'
where id='12121212-1212-1212-1212-121212121212';
set role authenticated;
do $guard$
declare v_failed boolean:=false; v jsonb;
begin
  begin
    perform public.encounter_activate_physical_specimen_v1(
      '88888888-8888-8888-8888-888888888888',
      array['enhanced-vitality','enhanced-vision'],
      '11111111-0000-0000-0000-000000000002');
  exception when sqlstate '22023' then v_failed:=true;
  end;
  if not v_failed then raise exception 'Charisma +1 allowed two benefit picks'; end if;
end
$guard$;
reset role;
insert into public.encounter_conditions values(
  '88888888-8888-8888-8888-888888888888','incapacitated'
);
set role authenticated;
do $guard$
declare v_failed boolean:=false; v jsonb;
begin
  begin
    perform public.encounter_activate_physical_specimen_v1(
      '88888888-8888-8888-8888-888888888888',
      array['enhanced-vitality'],
      '11111111-0000-0000-0000-000000000003');
  exception when sqlstate '55000' then v_failed:=true;
  end;
  if not v_failed then raise exception 'Incapacitated character spent Bonus Action'; end if;
end
$guard$;
reset role;
delete from public.encounter_conditions where participant_id=
  '88888888-8888-8888-8888-888888888888';
insert into public.encounter_conditions values(
  '88888888-8888-8888-8888-888888888888','petrified'
);
set role authenticated;
do $petrified$
declare v_failed boolean:=false;
begin
  begin
    perform public.encounter_activate_physical_specimen_v1(
      '88888888-8888-8888-8888-888888888888',
      array['enhanced-vitality'],
      '11111111-0000-0000-0000-000000000005');
  exception when sqlstate '55000' then v_failed:=true;
  end;
  if not v_failed then
    raise exception 'Petrified character spent a Bonus Action';
  end if;
end
$petrified$;
reset role;
delete from public.encounter_conditions where participant_id=
  '88888888-8888-8888-8888-888888888888';
set role authenticated;
do $guard$
declare v jsonb;
begin
  v:=public.encounter_activate_physical_specimen_v1(
    '88888888-8888-8888-8888-888888888888',
    array['enhanced-vitality'],
    '11111111-0000-0000-0000-000000000004');
  if v->>'maxHp'<>'15' or v->>'speedFt'<>'30' then
    raise exception 'Low-Charisma encounter activation did not add correct HP: %',v;
  end if;
end
$guard$;
reset role;

-- Ensure outside-combat activation is never an alternate path in encounters.
set role authenticated;
do $guard$
declare v_failed boolean:=false;
begin
  begin
    perform public.activate_character_physical_specimen_v1(
      '99999999-9999-9999-9999-999999999999',
      array['enhanced-vitality']);
  exception when sqlstate '55000' then v_failed:=true;
  end;
  if not v_failed then raise exception 'Outside-encounter RPC bypassed tactical economy'; end if;
end
$guard$;
reset role;
select 'Tactical Physical Specimen guarded Bonus Action fixture passed' as result;


-- A rest-active feature used BEFORE an encounter must be reflected in
-- staging, canonical Speed refresh and initial max-HP trigger.
insert into public.character_progression values(
  '76767676-7676-7676-7676-767676767676',
  '11111111-1111-1111-1111-111111111111',
  'The Parasite Patron','GrimHollowPG24',3
);
insert into public.character_sheets values(
  '76767676-7676-7676-7676-767676767676',
  '{"abilities":{"cha":{"score":20}},"hp":14,"maxHp":20,"speed":25}'::jsonb
);
insert into public.character_permissions values(
  '76767676-7676-7676-7676-767676767676',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',true
);
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',false);
set role authenticated;
do $before$
declare v jsonb;
begin
  v:=public.activate_character_physical_specimen_v1(
    '76767676-7676-7676-7676-767676767676',
    array['enhanced-vitality','increased-speed']);
  if v->>'saved'<>'true' then raise exception 'Out-of-combat activation missing'; end if;
  v:=public.get_character_physical_specimen_effective_stats_v1(
    '76767676-7676-7676-7676-767676767676');
  if v #>> '{baseStats,speedFt}' <> '25'
    or v #>> '{effectiveStats,speedFt}' <> '30'
    or v #>> '{effectiveStats,maxHp}' <> '23' then
    raise exception 'Paper-sheet projection double-counted Speed: %',v;
  end if;
end
$before$;
reset role;
insert into public.encounters(id,status,active_participant_id) values(
  '25252525-2525-2525-2525-252525252525','draft',null
);
insert into public.encounter_participants(
  id,encounter_id,character_id,display_name,controller_user_id,
  current_hp,max_hp,speed_ft
) values(
  '26262626-2626-2626-2626-262626262626',
  '25252525-2525-2525-2525-252525252525',
  '76767676-7676-7676-7676-767676767676',
  'Pre-Activated Warlock','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  14,null,public.encounter_canonical_speed_ft_v1(
    '76767676-7676-7676-7676-767676767676')
);
do $before$
declare v record; delta jsonb;
begin
  select * into v from public.encounter_participants
    where id='26262626-2626-2626-2626-262626262626';
  delta:=private.physical_specimen_active_bonuses_v1(
    '76767676-7676-7676-7676-767676767676');
  if v.max_hp<>23 or v.current_hp<>14 or v.speed_ft<>30
    or delta->>'active'<>'true' then
    raise exception 'Pre-activated Physical Specimen was lost at staging: %, %',v,delta;
  end if;
end
$before$;
-- Idempotent canonical refreshes: +5 should be retained, never multiplied.
update public.encounter_participants
set speed_ft=public.encounter_canonical_speed_ft_v1(character_id)
where id='26262626-2626-2626-2626-262626262626';
update public.encounter_participants
set speed_ft=public.encounter_canonical_speed_ft_v1(character_id)
where id='26262626-2626-2626-2626-262626262626';
do $before$
declare v record;
begin
  select max_hp,speed_ft into v from public.encounter_participants
    where id='26262626-2626-2626-2626-262626262626';
  if v.max_hp<>23 or v.speed_ft<>30 then
    raise exception 'Repeated tactical Speed refresh removed or stacked bonus: %',v;
  end if;
end
$before$;

-- A later Long Rest expires the feature. A NEW encounter must start from the
-- unmodified base sheet even if a previous draft staging row still exists.
insert into public.character_rest_log values(
  '27272727-2727-2727-2727-272727272727',
  '76767676-7676-7676-7676-767676767676','long_rest',clock_timestamp()
);
insert into public.encounters(id,status,active_participant_id) values(
  '28282828-2828-2828-2828-282828282828','draft',null
);
insert into public.encounter_participants(
  id,encounter_id,character_id,display_name,controller_user_id,
  current_hp,max_hp,speed_ft
) values(
  '29292929-2929-2929-2929-292929292929',
  '28282828-2828-2828-2828-282828282828',
  '76767676-7676-7676-7676-767676767676',
  'Expired Feature Warlock','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  14,null,public.encounter_canonical_speed_ft_v1(
    '76767676-7676-7676-7676-767676767676')
);
do $after$
declare v record; delta jsonb;
begin
  select max_hp,speed_ft into v from public.encounter_participants
    where id='29292929-2929-2929-2929-292929292929';
  delta:=private.physical_specimen_active_bonuses_v1(
    '76767676-7676-7676-7676-767676767676');
  if v.max_hp<>20 or v.speed_ft<>25 or delta->>'active'<>'false' then
    raise exception 'Long-Rest expired feature leaked into new encounter: %, %',v,delta;
  end if;
end
$after$;

-- Unknown benefit IDs must never be projected into canonical stat helpers.
update public.character_runtime_feature_choices
set state=jsonb_set(
  jsonb_set(state,'{benefitKeys}',
    '["bogus","increased-speed","enhanced-vitality"]'::jsonb),
  '{activatedAt}',to_jsonb(clock_timestamp())
)
where character_id='76767676-7676-7676-7676-767676767676'
  and feature_key='warlock-parasite-physical-specimen';
do $after$
declare delta jsonb;
begin
  delta:=private.physical_specimen_active_bonuses_v1(
    '76767676-7676-7676-7676-767676767676');
  if delta->>'active'<>'false' or delta->>'speedBonusFt'<>'0'
    or delta->>'hpMaxBonus'<>'0' then
    raise exception 'Malformed source choices generated live combat bonuses: %',delta;
  end if;
end
$after$;
select 'Pre-combat Physical Specimen HP/Speed carryover passed' as result;


-- Encounter-start HP reconciliation:
-- A: stage, then activate;
-- B: activate, then stage (do not double-count);
-- C: activate, stage, then Long Rest before encounter start;
-- D: GM overrides staged maximum HP, then activates (preserve override).
-- All mutations below are in the isolated PostgreSQL test fixture only.
insert into public.character_progression values
 ('60606060-6060-6060-6060-606060606060',
  '11111111-1111-1111-1111-111111111111','The Parasite Patron','GrimHollowPG24',3),
 ('61616161-6161-6161-6161-616161616161',
  '11111111-1111-1111-1111-111111111111','The Parasite Patron','GrimHollowPG24',3),
 ('62626262-6262-6262-6262-626262626262',
  '11111111-1111-1111-1111-111111111111','The Parasite Patron','GrimHollowPG24',3),
 ('63636363-6363-6363-6363-636363636363',
  '11111111-1111-1111-1111-111111111111','The Parasite Patron','GrimHollowPG24',3);
insert into public.character_sheets values
 ('60606060-6060-6060-6060-606060606060',
  '{"abilities":{"cha":{"score":20}},"hp":16,"maxHp":20,"speed":25}'::jsonb),
 ('61616161-6161-6161-6161-616161616161',
  '{"abilities":{"cha":{"score":20}},"hp":18,"maxHp":22,"speed":30}'::jsonb),
 ('62626262-6262-6262-6262-626262626262',
  '{"abilities":{"cha":{"score":20}},"hp":24,"maxHp":24,"speed":35}'::jsonb),
 ('63636363-6363-6363-6363-636363636363',
  '{"abilities":{"cha":{"score":20}},"hp":22,"maxHp":24,"speed":30}'::jsonb);
insert into public.character_permissions values
 ('60606060-6060-6060-6060-606060606060','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',true),
 ('61616161-6161-6161-6161-616161616161','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',true),
 ('62626262-6262-6262-6262-626262626262','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',true),
 ('63636363-6363-6363-6363-636363636363','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',true);
insert into public.encounters(id,status,active_participant_id) values
 ('70707070-7070-7070-7070-707070707070','draft',null);
-- Stage A and D before activating. D has a manual GM maximum of 40.
insert into public.encounter_participants(
  id,encounter_id,character_id,display_name,controller_user_id,
  current_hp,max_hp,speed_ft
) values
 ('71717171-7171-7171-7171-717171717171',
  '70707070-7070-7070-7070-707070707070',
  '60606060-6060-6060-6060-606060606060','Warlock A',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',16,null,25),
 ('74747474-7474-7474-7474-747474747474',
  '70707070-7070-7070-7070-707070707070',
  '63636363-6363-6363-6363-636363636363','Warlock D (GM override)',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',22,40,30);
-- Activate B/C before staging and A/D afterward.
select set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',false);
set role authenticated;
do $prepare$
declare v jsonb; id uuid;
begin
  foreach id in array array[
    '60606060-6060-6060-6060-606060606060'::uuid,
    '61616161-6161-6161-6161-616161616161'::uuid,
    '62626262-6262-6262-6262-626262626262'::uuid,
    '63636363-6363-6363-6363-636363636363'::uuid
  ] loop
    v:=public.activate_character_physical_specimen_v1(
      id,array['enhanced-vitality','increased-speed']);
    if v->>'saved'<>'true' then
      raise exception 'Fixture Physical Specimen activation failed: %',id;
    end if;
  end loop;
end
$prepare$;
reset role;
-- Stage the already-activated B/C.
insert into public.encounter_participants(
  id,encounter_id,character_id,display_name,controller_user_id,
  current_hp,max_hp,speed_ft
) values
 ('72727272-7272-7272-7272-727272727272',
  '70707070-7070-7070-7070-707070707070',
  '61616161-6161-6161-6161-616161616161','Warlock B',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',18,null,35),
 ('73737373-7373-7373-7373-737373737373',
  '70707070-7070-7070-7070-707070707070',
  '62626262-6262-6262-6262-626262626262','Warlock C',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',24,null,40);
do $stage_check$
declare a record; b record; c record; d record;
begin
  select * into a from public.encounter_participants
    where id='71717171-7171-7171-7171-717171717171';
  select * into b from public.encounter_participants
    where id='72727272-7272-7272-7272-727272727272';
  select * into c from public.encounter_participants
    where id='73737373-7373-7373-7373-737373737373';
  select * into d from public.encounter_participants
    where id='74747474-7474-7474-7474-747474747474';
  if a.max_hp<>20 or b.max_hp<>25 or c.max_hp<>27 or d.max_hp<>40
    or b.state #>> '{physicalSpecimenSnapshot,maxHpDeltaApplied}' <> '3'
    or c.state #>> '{physicalSpecimenSnapshot,maxHpDeltaApplied}' <> '3' then
    raise exception 'Pre-start HP staging values or provenance incorrect';
  end if;
end
$stage_check$;
-- Long Rest on C removes active benefits before combat starts.
insert into public.character_rest_log values(
 '75757575-7575-7575-7575-757575757575',
 '62626262-6262-6262-6262-626262626262',
 'long_rest',clock_timestamp()
);
-- Simulate only admin_start's canonical speed update followed by status
-- transition, which fires the new HP start hook in the same transaction.
update public.encounter_participants p set
  speed_ft=public.encounter_canonical_speed_ft_v1(p.character_id)
where p.encounter_id='70707070-7070-7070-7070-707070707070';
update public.encounters set status='active',
  active_participant_id='71717171-7171-7171-7171-717171717171'
where id='70707070-7070-7070-7070-707070707070';
do $verify$
declare a record; b record; c record; d record; old_v bigint; result jsonb;
begin
  select * into a from public.encounter_participants
    where id='71717171-7171-7171-7171-717171717171';
  select * into b from public.encounter_participants
    where id='72727272-7272-7272-7272-727272727272';
  select * into c from public.encounter_participants
    where id='73737373-7373-7373-7373-737373737373';
  select * into d from public.encounter_participants
    where id='74747474-7474-7474-7474-747474747474';
  if a.max_hp<>23 or a.current_hp<>16 or a.speed_ft<>30 then
    raise exception 'Stage then activate: encounter-start HP/Speed wrong: %',a;
  end if;
  if b.max_hp<>25 or b.current_hp<>18 or b.speed_ft<>35 then
    raise exception 'Activate then stage: HP bonus was duplicated: %',b;
  end if;
  if c.max_hp<>24 or c.current_hp<>24 or c.speed_ft<>35 then
    raise exception 'Expired staged benefit was not removed at encounter start: %',c;
  end if;
  if d.max_hp<>43 or d.current_hp<>22 or d.speed_ft<>35 then
    raise exception 'GM max-HP override was overwritten instead of adjusted: %',d;
  end if;
  -- Calling the internal reconciliation again must be idempotent.
  result:=private.reconcile_physical_specimen_at_encounter_start_v1(a.id);
  if result->>'changed'<>'false' then
    raise exception 'Second start reconciliation double-added HP: %',result;
  end if;
  select max_hp into old_v from public.encounter_participants where id=a.id;
  if old_v<>23 then
    raise exception 'Repeated reconciliation changed maximum HP: %',old_v;
  end if;
end
$verify$;
-- Character source sheets must never be rewritten by encounter reconciliation.
do $source_check$
begin
  if (select sheet->>'maxHp' from public.character_sheets
      where character_id='60606060-6060-6060-6060-606060606060')<>'20'
    or (select sheet->>'maxHp' from public.character_sheets
      where character_id='63636363-6363-6363-6363-636363636363')<>'24' then
    raise exception 'Start reconciliation modified permanent source HP';
  end if;
end
$source_check$;
select 'Physical Specimen staged-before-activation/start reconciliation passed' as result;
