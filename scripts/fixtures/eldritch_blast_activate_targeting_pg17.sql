\set ON_ERROR_STOP on
-- LOCAL DISPOSABLE RUNNER ONLY: replace mock roll/LOS after earlier tests.
drop function private.encounter_resolve_attack_roll_v1(uuid,uuid,boolean);
drop function public.encounter_targeting_context_internal_v1(uuid,uuid);
drop function public.encounter_are_hostile_internal_v1(text,text);
\i scripts/fixtures/eldritch_blast_production_targeting_pg17.sql
