-- Disposable local source-compatible v2 resource shape.
-- The real v2 body is imported unchanged; its sync helper is a REDUCED
-- local contract that fails if a delegation-only user reaches it.
-- This is not complete persistent slot synchronization acceptance.
create table public.character_spell_slots(
  character_id uuid not null, pool_key text not null,slot_level integer not null,
  slots_max integer not null,slots_remaining integer not null,
  recharge_key text,primary key(character_id,pool_key,slot_level)
);
insert into public.character_spell_slots(character_id,pool_key,slot_level,slots_max,slots_remaining,recharge_key)
values(public.p2_id(32),'wizard',1,3,2,'long_rest');
create function private.sync_character_spell_slots_v1(p_character_id uuid)
returns void language plpgsql security definer
set search_path to 'pg_catalog','public','private','auth'
as $test_only$
begin
 if p_character_id=public.p2_id(32) and
    not private.current_user_is_admin()
 then raise exception 'DELEGATED_NPC_V2_REACHED_PERSISTENT_SYNC';
 end if;
end $test_only$;
\i sql/candidates/20261101_npc_spell_profile_v2_visibility_candidate.sql
do $acl$
begin
 if has_function_privilege('anon','public.encounter_spellcasting_profile_v2(uuid)','EXECUTE')
 or has_function_privilege('authenticated','private.encounter_spellcasting_profile_v2_full_candidate_v1(uuid)','EXECUTE')
 then raise exception 'v2 profile visibility bypass via EXECUTE privilege'; end if;
end $acl$;
notify pgrst,'reload schema';
