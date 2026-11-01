\set ON_ERROR_STOP on
-- P2 private integrated resolver. Disposable PG16 only, after earlier
-- original v11 and guarded wrapper fixtures. NO production installation.
\i sql/candidates/20261031_fire_bolt_transaction_integrated_candidate.sql
do $deny$
begin
  if has_function_privilege('authenticated',
    'private.encounter_cast_spell_v11_transaction_candidate_v1(uuid,uuid,uuid,integer,uuid)','EXECUTE')
  or has_function_privilege('anon',
    'private.encounter_cast_spell_v11_transaction_candidate_v1(uuid,uuid,uuid,integer,uuid)','EXECUTE')
  then raise exception 'Research candidate accidentally exposed'; end if;
end $deny$;
-- Explicit temporary grant in isolated fixture only.
grant execute on function private.encounter_cast_spell_v11_transaction_candidate_v1(
 uuid,uuid,uuid,integer,uuid) to authenticated;
insert into public.spells_catalog values
  (public.p2_id(62),'poison-spray|XPHB','Poison Spray','XPHB',0,array['Wizard','Sorcerer','Warlock']);
insert into public.character_spells values
  (public.p2_id(55),public.p2_id(31),public.p2_id(62),
   'class','wizard','wizard',true,false,false,'int',null);

-- Original Fire Bolt class cantrip: known=true, prepared=false.
-- No action/turn revalidation may reject a SAME-USER replay that has
-- already spent an action or defeated a target.
update public.encounter_participants set action_available=true where id=public.p2_id(11);
set role authenticated;
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub',public.p2_id(41)::text,false);
select set_config('fixture.attack_roll','1',false);
do $owner$
declare first_result jsonb; again jsonb;
begin
 first_result:=private.encounter_cast_spell_v11_transaction_candidate_v1(
  public.p2_id(11),public.p2_id(51),public.p2_id(21),null,public.p2_id(109));
 if first_result->>'damageDice'<>'2d10' or first_result->>'spellKey'<>'fire-bolt|XPHB'
   or (first_result->>'hit')::boolean is distinct from false then
  raise exception 'Integrated Fire Bolt changed original miss/level semantics: %',first_result; end if;
 again:=private.encounter_cast_spell_v11_transaction_candidate_v1(
  public.p2_id(11),public.p2_id(51),public.p2_id(21),null,public.p2_id(109));
 if again is distinct from first_result then raise exception 'Integrated exact replay changed result'; end if;
end $owner$;
reset role;
do $audit_once$
begin
 if (select count(*) from public.encounter_combat_log where event_type='spell_cast')<>4
  or (select version from public.encounters where id=public.p2_id(81))<>5
  or (select action_available from public.encounter_participants where id=public.p2_id(11))
 then raise exception 'Integrated Fire Bolt command not exactly once'; end if;
end $audit_once$;

-- Changed target (same id), changed assignment, changed slot request and
-- another signed-in controller must all fail BEFORE cached result disclosure.
set role authenticated;
select set_config('request.jwt.claim.sub',public.p2_id(42)::text,false);
do $other$
declare denied boolean:=false;
begin
 begin
  perform private.encounter_cast_spell_v11_transaction_candidate_v1(
   public.p2_id(11),public.p2_id(51),public.p2_id(21),null,public.p2_id(109));
 exception when sqlstate '42501' then denied:=true; end;
 if not denied then raise exception 'Integrated cross-controller replay permitted'; end if;
end $other$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub',public.p2_id(41)::text,false);
do $intent$
declare denied boolean;
begin
 denied:=false;
 begin
  perform private.encounter_cast_spell_v11_transaction_candidate_v1(
   public.p2_id(11),public.p2_id(51),public.p2_id(22),null,public.p2_id(109));
 exception when sqlstate '42501' then denied:=true; end;
 if not denied then raise exception 'Integrated changed-target replay permitted'; end if;
 denied:=false;
 begin
  perform private.encounter_cast_spell_v11_transaction_candidate_v1(
   public.p2_id(11),public.p2_id(55),public.p2_id(21),null,public.p2_id(109));
 exception when sqlstate '42501' then denied:=true; end;
 if not denied then raise exception 'Integrated changed-assignment replay permitted'; end if;
end $intent$;
reset role;
-- Revocation and hidden target: the underlying transactional function must
-- enforce them BEFORE returning a prior result.
update public.encounter_participants set controller_user_id=public.p2_id(42) where id=public.p2_id(11);
set role authenticated;
do $revoked$
declare denied boolean:=false;
begin
 begin
  perform private.encounter_cast_spell_v11_transaction_candidate_v1(
   public.p2_id(11),public.p2_id(51),public.p2_id(21),null,public.p2_id(109));
 exception when sqlstate '42501' then denied:=true; end;
 if not denied then raise exception 'Integrated revoked user replay permitted'; end if;
end $revoked$;
reset role;
update public.encounter_participants
set controller_user_id=public.p2_id(41) where id=public.p2_id(11);
update public.encounter_participants set is_hidden=true where id=public.p2_id(21);
set role authenticated;
do $hidden$
declare denied boolean:=false;
begin
 begin
  perform private.encounter_cast_spell_v11_transaction_candidate_v1(
   public.p2_id(11),public.p2_id(51),public.p2_id(21),null,public.p2_id(109));
 exception when sqlstate '42501' then denied:=true; end;
 if not denied then raise exception 'Integrated hidden target replay permitted'; end if;
end $hidden$;
reset role;
update public.encounter_participants set is_hidden=false where id=public.p2_id(21);

-- Even an already-stored inconsistent class grant cannot cast through the
-- integrated authoritative SQL. No direct writes to live user grant tables.
update public.encounter_participants set action_available=true where id=public.p2_id(11);
set role authenticated;
do $grants$
declare denied boolean;
begin
 denied:=false;
 begin
  perform private.encounter_cast_spell_v11_transaction_candidate_v1(
   public.p2_id(11),public.p2_id(53),public.p2_id(21),null,public.p2_id(110));
 exception when sqlstate '42501' then denied:=true; end;
 if not denied then raise exception 'Integrated known=false grant allowed'; end if;
 denied:=false;
 begin
  perform private.encounter_cast_spell_v11_transaction_candidate_v1(
   public.p2_id(11),public.p2_id(54),public.p2_id(21),null,public.p2_id(111));
 exception when sqlstate '42501' then denied:=true; end;
 if not denied then raise exception 'Integrated mismatched class source allowed'; end if;
end $grants$;
reset role;

-- Regression family A: another reviewed cantrip continues to use existing
-- attack path and no extra slots, not blanket-granted by Fire Bolt logic.
set role authenticated;
do $poison$
declare x jsonb;
begin
 x:=private.encounter_cast_spell_v11_transaction_candidate_v1(
  public.p2_id(11),public.p2_id(55),public.p2_id(21),null,public.p2_id(112));
 if x->>'spellKey'<>'poison-spray|XPHB' or x->>'damageDice'<>'2d12'
    or (x->>'hit')::boolean is distinct from false then
  raise exception 'Integrated non-Fire-Bolt cantrip regressed: %',x; end if;
end $poison$;
reset role;

-- Regression family B: Guiding Bolt uses one canonical Cleric class grant,
-- one slot per successful new cast and no second slot on exact replay.
insert into public.class_catalog values(public.p2_id(72),'Cleric','cleric','wis','XPHB');
insert into public.spells_catalog values(
 public.p2_id(63),'guiding-bolt|XPHB','Guiding Bolt','XPHB',1,array['Cleric']);
insert into public.character_spells values(
 public.p2_id(56),public.p2_id(31),public.p2_id(63),
 'class','cleric','cleric',true,true,false,'wis',null);
insert into public.encounter_spell_slots(id,participant_id,pool_key,slot_level,slots_max,slots_remaining,recharge_key)
 values(public.p2_id(91),public.p2_id(11),'spellcasting',1,3,3,'long-rest');
update public.character_progression set class_id=public.p2_id(72) where character_id=public.p2_id(31);
update public.encounter_participants set action_available=true where id=public.p2_id(11);
set role authenticated;
do $guiding$
declare x jsonb; again jsonb; denied boolean:=false;
begin
 x:=private.encounter_cast_spell_v11_transaction_candidate_v1(
  public.p2_id(11),public.p2_id(56),public.p2_id(21),1,public.p2_id(113));
 if x->>'spellKey'<>'guiding-bolt|XPHB' or x->>'damageDice'<>'4d6'
    or x->>'slotRemaining'<>'2' or (x->>'hit')::boolean is distinct from false
 then raise exception 'Guiding Bolt slot/attack behavior changed: %',x; end if;
 again:=private.encounter_cast_spell_v11_transaction_candidate_v1(
  public.p2_id(11),public.p2_id(56),public.p2_id(21),1,public.p2_id(113));
 if again is distinct from x then raise exception 'Guiding Bolt exact slot replay changed'; end if;
 begin
  perform private.encounter_cast_spell_v11_transaction_candidate_v1(
   public.p2_id(11),public.p2_id(56),public.p2_id(21),2,public.p2_id(113));
 exception when others then denied:=true; end;
 if not denied then raise exception 'Guiding Bolt same-id changed-slot request accepted'; end if;
end $guiding$;
reset role;
do $audit$
begin
 if (select count(*) from public.encounter_combat_log where event_type='spell_cast')<>6
  or (select version from public.encounters where id=public.p2_id(81))<>7
  or (select slots_remaining from public.encounter_spell_slots where id=public.p2_id(91))<>2
 then raise exception 'Integrated candidate extra log/version/slot use'; end if;
 raise notice 'PASS disposable transaction-integrated v11 candidate: Fire Bolt, Poison Spray, Guiding Bolt, replay/intent/visibility/grant/slot; NOT real Auth';
end $audit$;
