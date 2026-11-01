\set ON_ERROR_STOP on
-- Runs ONLY after fire_bolt_p2_disposable_pg16.sql in disposable PG16.
-- set role + GUC is MOCK identity, NOT a signed JWT. Tests current behavior,
-- including negative findings that must BLOCK promotion (not "passed security").
set role authenticated;
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub',public.p2_id(42)::text,false);
do $foreign$
declare rejected boolean:=false;
begin
  begin
    perform public.encounter_cast_spell_v11(
      public.p2_id(11),public.p2_id(51),public.p2_id(21),null,public.p2_id(101)
    );
  exception when others then
    if sqlerrm like '%Not authorized to control this participant%' then
      rejected:=true;
    else raise; end if;
  end;
  if not rejected then raise exception 'Fresh foreign-controller cast was allowed'; end if;
end $foreign$;
reset role;
do $clean$
begin
  if exists(select 1 from public.encounter_command_requests where request_id=public.p2_id(101))
  then raise exception 'Rejected foreign cast left a command'; end if;
end $clean$;

set role authenticated;
select set_config('request.jwt.claim.sub',public.p2_id(41)::text,false);
select set_config('fixture.attack_roll','20',false);
do $legit$
declare result jsonb; replay jsonb;
begin
  result:=public.encounter_cast_spell_v11(
    public.p2_id(11),public.p2_id(51),public.p2_id(21),null,public.p2_id(101)
  );
  if result->>'spellKey'<>'fire-bolt|XPHB'
    or (result->>'hit')::boolean is distinct from true
    or (result->>'critical')::boolean is distinct from true
    or result->>'damageDice'<>'4d10'
    or (result->>'rawDamage')::integer not between 4 and 40
  then raise exception 'Actual v11 Fire Bolt current-tier critical output mismatch: %',result; end if;
  replay:=public.encounter_cast_spell_v11(
    public.p2_id(11),public.p2_id(51),public.p2_id(21),null,public.p2_id(101)
  );
  if result is distinct from replay then raise exception 'Same request did not replay cached result'; end if;
end $legit$;
reset role;
do $committed$
begin
  if (select count(*) from public.encounter_combat_log where event_type='spell_cast')<>1
     or (select version from public.encounters where id=public.p2_id(81))<>2
     or (select action_available from public.encounter_participants where id=public.p2_id(11))
  then raise exception 'Successful cast did not commit exactly once'; end if;
end $committed$;

-- KNOWN GAP PROBE 1: replay occurs in current source before controller auth.
-- Record as a finding, not a successful authorization test.
set role authenticated;
select set_config('request.jwt.claim.sub',public.p2_id(42)::text,false);
do $replay_gap$
declare x jsonb;
begin
  -- The command-request ledger is intentionally *not readable* by an
  -- authenticated caller. Compare returned public RPC fields instead.
  x:=public.encounter_cast_spell_v11(
    public.p2_id(11),public.p2_id(51),public.p2_id(21),null,public.p2_id(101));
  if x->>'spellKey'<>'fire-bolt|XPHB'
     or x->>'requestId'<>public.p2_id(101)::text
  then raise exception 'Unexpected changed replay behavior: inspect before editing golden tests'; end if;
  raise notice 'KNOWN BLOCKER: foreign identity can read a cached cast by reusing caster+request ID in this isolated v11 function';
end $replay_gap$;
reset role;

-- The source-type=feat grant must fail even if it is otherwise in the spellbook.
update public.encounter_participants set action_available=true where id=public.p2_id(11);
set role authenticated;
select set_config('request.jwt.claim.sub',public.p2_id(41)::text,false);
do $feat$
declare rejected boolean:=false;
begin
  begin
    perform public.encounter_cast_spell_v11(
      public.p2_id(11),public.p2_id(52),public.p2_id(21),null,public.p2_id(102));
  exception when others then
    if sqlerrm like '%Only class spell assignments%' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'Feat grant slipped through class-only Fire Bolt adapter'; end if;
end $feat$;
reset role;

-- KNOWN GAP PROBE 2: an intentionally inconsistent, *already stored* class
-- grant (unknown; source_label cleric) is not checked in this current v11 SQL.
-- This does not prove any ordinary player can create such a row. Direct table
-- writes have other RLS and trigger guards in live Supabase.
set role authenticated;
select set_config('fixture.attack_roll','1',false);
do $grant_gap$
declare x jsonb; hp_before integer;
begin
  select current_hp into hp_before from public.encounter_participants where id=public.p2_id(21);
  x:=public.encounter_cast_spell_v11(
    public.p2_id(11),public.p2_id(53),public.p2_id(21),null,public.p2_id(103));
  if x->>'damageDice'<>'2d10' or (x->>'hit')::boolean is distinct from false
    or (x->>'rawDamage')::integer<>0
    or (select current_hp from public.encounter_participants
         where id=public.p2_id(21))<>hp_before
  then raise exception 'Current Fire Bolt source-grant or natural 1 behavior drift: %',x; end if;
  raise notice 'KNOWN BLOCKER: current v11 accepted deliberately mismatched/known=false class assignment in disposable fixture';
end $grant_gap$;
reset role;

do $final$
begin
  if (select count(*) from public.encounter_combat_log where event_type='spell_cast')<>2
    or (select count(*) from public.encounter_command_requests where result is not null)<>2
    or (select version from public.encounters where id=public.p2_id(81))<>3
  then raise exception 'Disposable Fire Bolt effect ledger drift'; end if;
  raise notice 'P2 PG16 actual-v11 source smoke: pass with TWO DOCUMENTED AUTH/GRANT BLOCKERS (mock identity, NOT signed JWT)';
end $final$;
