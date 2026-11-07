-- DNDNext P1.3 recheck. SELECT-only read of function/trigger metadata; no mutating RPC.
select n.nspname||'.'||p.proname as function_name,md5(pg_get_functiondef(p.oid)) as source_md5,
 pg_get_functiondef(p.oid) as source_definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private') and p.proname in (
'encounter_use_core_action_v1','encounter_move_active_participant_v1','encounter_end_turn_v1',
'encounter_weapon_attack_v1','encounter_unarmed_strike_v1','encounter_resolve_opportunity_reaction_v1',
'encounter_roll_save_v1','admin_apply_encounter_effect_v1','admin_start_encounter_v1',
'encounter_cast_spell_v11','encounter_cast_spell_v13','encounter_cast_allocated_spell_v1',
'mirror_encounter_spell_slot_spend_v1','expire_encounter_timed_effects_on_turn_start_v1')
order by 1;

select t.tgrelid::regclass::text as relation,t.tgname,pg_get_triggerdef(t.oid) as definition
from pg_trigger t where not t.tgisinternal and t.tgrelid in (
 'public.encounters'::regclass,'public.encounter_participants'::regclass,
 'public.encounter_spell_slots'::regclass,'public.character_spell_slots'::regclass,
 'public.character_spells'::regclass,'public.character_rest_log'::regclass)
order by 1,2;
