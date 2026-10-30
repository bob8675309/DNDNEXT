\set ON_ERROR_STOP on
-- DISPOSABLE PG16 ONLY: auth.uid() and auth.role() below are MOCKS, not JWT verification.
create schema private; create schema auth;
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create function public.fixture_uuid(n integer) returns uuid language sql immutable
as $f$select ('00000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid$f$;
create function auth.uid() returns uuid language sql stable
as $f$select nullif(current_setting('fixture.uid',true),'')::uuid$f$;
create function auth.role() returns text language sql stable
as $f$select nullif(current_setting('fixture.role',true),'')$f$;
create table public.encounters(id uuid primary key,status text,active_participant_id uuid,round int default 1,turn_index int default 0,version int default 1,updated_at timestamptz);
create table public.encounter_participants(id uuid primary key,encounter_id uuid,character_id uuid,controller_user_id uuid,display_name text,team text,q int default 0,r int default 0,ac int default 14,current_hp int default 1000,is_hidden bool default false,is_defeated bool default false,action_available bool default true,damage_resistances text[] default '{}',damage_immunities text[] default '{}',updated_at timestamptz);
create table public.character_permissions(character_id uuid,user_id uuid,can_edit bool);
create table public.encounter_conditions(participant_id uuid,condition_key text);
create table public.character_spells(id uuid primary key,character_id uuid,spell_id uuid,source_type text,source_label text,known boolean default true);
create table public.spells_catalog(id uuid primary key,spell_key text,source text,level int,
 classes text[] default '{}',damage_types text[] default '{}');
create table public.character_progression(character_id uuid primary key,class_level int);
create table public.character_class_option_grant_instances(character_id uuid,option_catalog_id uuid,option_type text,acquired_level int,choices jsonb);
create table public.class_feature_option_catalog(id uuid primary key,option_key text,source text);
create table public.encounter_command_requests(request_id uuid primary key,encounter_id uuid,participant_id uuid,command_type text,requested_by uuid,result jsonb);
create table public.encounter_combat_log(id bigserial primary key,encounter_id uuid,round int,turn_index int,actor_participant_id uuid,target_participant_id uuid,event_type text,summary text,detail jsonb);
create table public.fixture_rolls(id bigserial primary key,roll int);
create function public.is_admin(uid uuid) returns boolean language sql stable
as $f$select current_setting('fixture.admin',true)='yes'$f$;
create function public.encounter_are_hostile_internal_v1(t1 text,t2 text) returns boolean
language sql immutable as $f$select (t1='enemies' and t2 in ('players','allies')) or (t2='enemies' and t1 in ('players','allies'))$f$;
create function public.encounter_spellcasting_profile_v1(p_id uuid) returns jsonb language sql stable
as $f$select jsonb_build_object('className','Warlock','castingAbility','cha','isClassCaster',true,'spellAttackBonus',7)$f$;
create function private.encounter_ability_score_v1(p_id uuid,ability text) returns int language sql stable
as $f$select 20$f$;
create function public.encounter_targeting_context_internal_v1(p_actor uuid,p_target uuid)
returns jsonb language plpgsql stable as $f$
declare a public.encounter_participants%rowtype; t public.encounter_participants%rowtype;
begin
 select * into a from public.encounter_participants where id=p_actor;
 select * into t from public.encounter_participants where id=p_target;
 return jsonb_build_object('distanceFt',5*greatest(abs(a.q-t.q),abs(a.r-t.r),abs((a.q-t.q)+(a.r-t.r))),
  'hasLineOfSight',coalesce(current_setting('fixture.blocked',true),'no')<>'yes','coverAcBonus',0);
end $f$;
create function private.encounter_resolve_attack_roll_v1(p_actor uuid,p_target uuid,p_base_disadvantage boolean default false)
returns jsonb language plpgsql as $f$
declare n int;
begin
 delete from public.fixture_rolls where id=(select min(id) from public.fixture_rolls) returning roll into n;
 return jsonb_build_object('roll',coalesce(n,15),'baseDisadvantage',p_base_disadvantage);
end $f$;
create function public.encounter_apply_damage_internal_v1(p_target uuid,p_amount int,p_type text)
returns jsonb language plpgsql as $f$
declare t public.encounter_participants%rowtype; dmg int;
begin
 select * into t from public.encounter_participants where id=p_target for update;
 dmg:=case when p_type=any(t.damage_immunities) then 0 when p_type=any(t.damage_resistances)
  then floor(p_amount/2.0)::int else p_amount end;
 update public.encounter_participants set current_hp=greatest(0,current_hp-dmg) where id=p_target;
 return jsonb_build_object('damage',dmg,'targetHp',greatest(0,t.current_hp-dmg));
end $f$;
insert into public.encounters(id,status,active_participant_id)
values(public.fixture_uuid(1),'active',public.fixture_uuid(11));
insert into public.encounter_participants(id,encounter_id,character_id,controller_user_id,display_name,team,q,r)
values
(public.fixture_uuid(11),public.fixture_uuid(1),public.fixture_uuid(31),public.fixture_uuid(41),'Warlock','players',0,0),
(public.fixture_uuid(21),public.fixture_uuid(1),public.fixture_uuid(32),public.fixture_uuid(42),'Target 1','enemies',4,0),
(public.fixture_uuid(22),public.fixture_uuid(1),public.fixture_uuid(33),public.fixture_uuid(42),'Target 2','enemies',5,0),
(public.fixture_uuid(23),public.fixture_uuid(1),public.fixture_uuid(34),public.fixture_uuid(42),'Target 3','enemies',6,0),
(public.fixture_uuid(24),public.fixture_uuid(1),public.fixture_uuid(35),public.fixture_uuid(42),'Target 4','enemies',7,0);
insert into public.character_spells values(public.fixture_uuid(51),public.fixture_uuid(31),public.fixture_uuid(61),'class','warlock');
insert into public.spells_catalog(id,spell_key,source,level,classes,damage_types) values
(public.fixture_uuid(61),'eldritch-blast|XPHB','XPHB',0,array['Warlock'],array['force']),
(public.fixture_uuid(62),'toll-the-dead|XPHB','XPHB',0,array['Warlock'],array['necrotic']),
(public.fixture_uuid(63),'fire-bolt|XPHB','XPHB',0,array['Wizard'],array['fire']),
(public.fixture_uuid(64),'prest igitation|XPHB','XPHB',0,array['Warlock'],'{}'::text[]);
insert into public.character_spells values
(public.fixture_uuid(52),public.fixture_uuid(31),public.fixture_uuid(62),'class','warlock'),
(public.fixture_uuid(53),public.fixture_uuid(31),public.fixture_uuid(63),'class','warlock'),
(public.fixture_uuid(54),public.fixture_uuid(31),public.fixture_uuid(64),'class','warlock');
insert into public.character_progression values(public.fixture_uuid(31),3);
insert into public.class_feature_option_catalog values(public.fixture_uuid(71),'optional-feature:agonizing-blast|XPHB','XPHB');
insert into public.character_class_option_grant_instances values(public.fixture_uuid(31),public.fixture_uuid(71),'eldritch-invocation',2,'{"child":{"metadata":{"spellKey":"eldritch-blast|XPHB"}}}');
\i sql/candidates/20261030_warlock_cantrip_damage_bonus_candidate.sql
\i sql/candidates/20261029_eldritch_blast_atomic_candidate.sql
-- Reusable source-bound invocation primitive, entirely independent
-- of the specific Eldritch Blast casting resolver.
do $invocation_tests$
declare
  c uuid:=public.fixture_uuid(31);
  eb uuid:=public.fixture_uuid(61);
  toll uuid:=public.fixture_uuid(62);
  other uuid:=public.fixture_uuid(63);
  nondmg uuid:=public.fixture_uuid(64);
  r jsonb;
begin
  r:=private.encounter_warlock_agonizing_bonus_candidate_v1(c,eb);
  if coalesce((r->>'damageModifier')::int,0)<>5 then
    raise exception 'Eldritch Blast did not inherit sourced modifier: %',r;
  end if;
  r:=private.encounter_warlock_agonizing_bonus_candidate_v1(c,toll);
  if coalesce((r->>'damageModifier')::int,0)<>0 then
    raise exception 'Unchosen Warlock cantrip inherited modifier';
  end if;
  -- The same repeatable invocation may select *another* Warlock cantrip.
  insert into public.character_class_option_grant_instances values(
    c,public.fixture_uuid(71),'eldritch-invocation',2,
    '{"child":{"metadata":{"spellKey":"toll-the-dead|XPHB"}}}'::jsonb
  );
  r:=private.encounter_warlock_agonizing_bonus_candidate_v1(c,toll);
  if coalesce((r->>'damageModifier')::int,0)<>5 then
    raise exception 'Selected Toll the Dead missing repeatable invocation: %',r;
  end if;
  r:=private.encounter_warlock_agonizing_bonus_candidate_v1(c,eb);
  if coalesce((r->>'damageModifier')::int,0)<>5 then
    raise exception 'Repeatable invocation changed original cantrip';
  end if;
  -- Even malformed duplicate grants on one cantrip must not stack +CHA.
  insert into public.character_class_option_grant_instances values(
    c,public.fixture_uuid(71),'eldritch-invocation',2,
    '{"child":{"metadata":{"spellKey":"eldritch-blast|XPHB"}}}'::jsonb
  );
  r:=private.encounter_warlock_agonizing_bonus_candidate_v1(c,eb);
  if coalesce((r->>'damageModifier')::int,0)<>5 then
    raise exception 'Duplicate invocation overstacked';
  end if;
  -- A class assignment that is no longer known is ineligible even if the
  -- invocation's stored choice still references the cantrip.
  update public.character_spells set known=false
    where character_id=c and spell_id=toll;
  r:=private.encounter_warlock_agonizing_bonus_candidate_v1(c,toll);
  if coalesce((r->>'damageModifier')::int,0)<>0
    or coalesce((r->>'eligibleWarlockCantrip')::boolean,false) then
    raise exception 'Removed/unknown Warlock cantrip retained invocation benefit';
  end if;
  update public.character_spells set known=true
    where character_id=c and spell_id=toll;
  r:=private.encounter_warlock_agonizing_bonus_candidate_v1(c,other);
  if coalesce((r->>'damageModifier')::int,0)<>0
    or coalesce((r->>'eligibleWarlockCantrip')::boolean,false) then
    raise exception 'Non-Warlock catalog cantrip granted bonus';
  end if;
  r:=private.encounter_warlock_agonizing_bonus_candidate_v1(c,nondmg);
  if coalesce((r->>'damageModifier')::int,0)<>0
    or coalesce((r->>'eligibleWarlockCantrip')::boolean,false) then
    raise exception 'Non-damaging cantrip granted bonus';
  end if;
  update public.character_progression set class_level=1 where character_id=c;
  r:=private.encounter_warlock_agonizing_bonus_candidate_v1(c,eb);
  if coalesce((r->>'damageModifier')::int,0)<>0 then
    raise exception 'Level 1 Warlock activated level 2+ invocation';
  end if;
  update public.character_progression set class_level=3 where character_id=c;
  delete from public.character_class_option_grant_instances
    where character_id=c and option_catalog_id=public.fixture_uuid(71);
  r:=private.encounter_warlock_agonizing_bonus_candidate_v1(c,eb);
  if coalesce((r->>'damageModifier')::int,0)<>0 then
    raise exception 'Revoked invocation continued to apply';
  end if;
  insert into public.character_class_option_grant_instances values(
    c,public.fixture_uuid(71),'eldritch-invocation',2,
    '{"child":{"metadata":{"spellKey":"eldritch-blast|XPHB"}}}'::jsonb
  );
  if has_function_privilege('authenticated','private.encounter_warlock_agonizing_bonus_candidate_v1(uuid,uuid)','EXECUTE')
  or has_function_privilege('anon','private.encounter_warlock_agonizing_bonus_candidate_v1(uuid,uuid)','EXECUTE')
  or has_function_privilege('service_role','private.encounter_warlock_agonizing_bonus_candidate_v1(uuid,uuid)','EXECUTE')
  then raise exception 'Invocation helper unexpectedly callable by API roles'; end if;
  raise notice 'Shared Warlock cantrip Agonizing Blast eligibility, repeatable grants, revocation, no stacking PASS';
end $invocation_tests$;
do $test$
declare a uuid:=public.fixture_uuid(11); s uuid:=public.fixture_uuid(51);
 t1 uuid:=public.fixture_uuid(21);t2 uuid:=public.fixture_uuid(22);
 t3 uuid:=public.fixture_uuid(23);t4 uuid:=public.fixture_uuid(24);
 out jsonb; replay jsonb; before_hp int; denied bool;
begin
 if has_function_privilege('authenticated','private.encounter_eldritch_blast_candidate_v1(uuid,uuid,uuid[],uuid)','EXECUTE')
 or has_function_privilege('service_role','private.encounter_eldritch_blast_candidate_v1(uuid,uuid,uuid[],uuid)','EXECUTE')
 or has_function_privilege('anon','private.encounter_eldritch_blast_candidate_v1(uuid,uuid,uuid[],uuid)','EXECUTE')
 then raise exception 'Candidate EXECUTE leaked';end if;
 perform set_config('fixture.uid',public.fixture_uuid(41)::text,true);
 perform set_config('fixture.role','service_role',true);
 denied:=false;
 begin perform private.encounter_eldritch_blast_candidate_v1(a,s,array[t1],public.fixture_uuid(101));
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Spoofed service_role accepted';end if;
 perform set_config('fixture.role','authenticated',true);
 insert into public.fixture_rolls(roll) values(15);
 out:=private.encounter_eldritch_blast_candidate_v1(a,s,array[t1],public.fixture_uuid(101));
 if (out->>'beamCount')::int<>1 or (out#>>'{beams,0,hit}')::boolean is distinct from true
 or (out#>>'{beams,0,agonizingBlastDamageModifier}')::int<>5
 or (out#>>'{beams,0,rawDamage}')::int not between 6 and 15
 then raise exception 'Level 3 Agonizing outcome invalid: %',out;end if;
 select current_hp into before_hp from public.encounter_participants where id=t1;
 if before_hp>=1000 then raise exception 'Damage did not reduce HP';end if;
 update public.encounters set active_participant_id=t2;
 replay:=private.encounter_eldritch_blast_candidate_v1(a,s,array[t1],public.fixture_uuid(101));
 if replay is distinct from out then raise exception 'Replay inconsistent';end if;
 if (select current_hp from public.encounter_participants where id=t1)<>before_hp
 then raise exception 'Replay double damage';end if;
 denied:=false;
 begin perform private.encounter_eldritch_blast_candidate_v1(a,s,array[t2],public.fixture_uuid(101));
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Modified target reused request';end if;
 denied:=false;
 begin perform private.encounter_eldritch_blast_candidate_v1(a,public.fixture_uuid(52),array[t1],public.fixture_uuid(101));
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Modified assignment reused request';end if;
 if (select count(*) from public.encounter_combat_log)<>1 then raise exception 'Duplicate log';end if;
 update public.encounters set active_participant_id=a;
 update public.encounter_participants set action_available=true where id=a;
 update public.character_class_option_grant_instances set choices='{"child":{"metadata":{"spellKey":"fire-bolt|XPHB"}}}';
 insert into public.fixture_rolls(roll) values(15);
 out:=private.encounter_eldritch_blast_candidate_v1(a,s,array[t1],public.fixture_uuid(102));
 if (out#>>'{beams,0,agonizingBlastDamageModifier}')::int<>0
 or (out#>>'{beams,0,rawDamage}')::int not between 1 and 10
 then raise exception 'Unbound invocation applied bonus';end if;
 update public.character_class_option_grant_instances set choices='{"child":{"metadata":{"spellKey":"eldritch-blast|XPHB"}}}';
 update public.character_progression set class_level=5;
 update public.encounter_participants set action_available=true where id=a;
 insert into public.fixture_rolls(roll) values(15),(1);
 out:=private.encounter_eldritch_blast_candidate_v1(a,s,array[t1,t2],public.fixture_uuid(103));
 if (out->>'beamCount')::int<>2 or (out#>>'{beams,0,hit}')::boolean is distinct from true
 or (out#>>'{beams,1,hit}')::boolean is distinct from false
 then raise exception 'Level 5 independent rolls failed: %',out;end if;
 update public.character_progression set class_level=11;
 update public.encounter_participants set action_available=true where id=a;
 out:=private.encounter_eldritch_blast_candidate_v1(a,s,array[t1,t2,t3],public.fixture_uuid(104));
 if (out->>'beamCount')::int<>3 then raise exception 'Level 11 beams failed';end if;
 update public.character_progression set class_level=17;
 update public.encounter_participants set action_available=true where id=a;
 out:=private.encounter_eldritch_blast_candidate_v1(a,s,array[t1,t2,t3,t4],public.fixture_uuid(105));
 if (out->>'beamCount')::int<>4 then raise exception 'Level 17 beams failed';end if;
 update public.character_progression set class_level=3;
 update public.encounter_participants set action_available=true where id=a;
 update public.encounter_participants set damage_immunities=array['force'] where id=t1;
 select current_hp into before_hp from public.encounter_participants where id=t1;
 out:=private.encounter_eldritch_blast_candidate_v1(a,s,array[t1],public.fixture_uuid(106));
 if (out#>>'{beams,0,damage,damage}')::int<>0
 or (select current_hp from public.encounter_participants where id=t1)<>before_hp
 then raise exception 'Force immunity not respected';end if;
 update public.encounter_participants set damage_immunities='{}'::text[],q=40 where id=t1;
 update public.encounter_participants set action_available=true where id=a;
 denied:=false;
 begin perform private.encounter_eldritch_blast_candidate_v1(a,s,array[t1],public.fixture_uuid(107));
 exception when others then denied:=true;end;
 if not denied then raise exception 'Out-of-range accepted';end if;
 if exists(select 1 from public.encounter_command_requests where request_id=public.fixture_uuid(107))
 then raise exception 'Failed cast persisted command';end if;
 update public.encounter_participants set q=4,is_hidden=true where id=t1;
 denied:=false;
 begin perform private.encounter_eldritch_blast_candidate_v1(a,s,array[t1],public.fixture_uuid(108));
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Hidden target permitted';end if;
 update public.encounter_participants set is_hidden=false where id=t1;
 perform set_config('fixture.uid',public.fixture_uuid(99)::text,true);
 denied:=false;
 begin perform private.encounter_eldritch_blast_candidate_v1(a,s,array[t1],public.fixture_uuid(109));
 exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Unauthorized controller permitted';end if;
 raise notice 'PG16 mock-auth candidate behavior PASS (NOT JWT-verified)';
end $test$;
