-- P2 2026-11-01. READ-ONLY command/replay/lock order audit.
-- Do not execute a command RPC, update production rows, or GRANT anything.
-- Direct pg_get_functiondef source locations, not a call-graph proof.
WITH f AS (
 SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,
        pg_get_functiondef(p.oid) source,
        has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute,
        has_function_privilege('anon',p.oid,'EXECUTE') anonymous_execute
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('public','private') AND p.prokind='f'
)
SELECT nspname,proname,args,md5(source) source_md5,
 authenticated_execute,anonymous_execute,
 position('insert into public.encounter_command_requests' in lower(source)) ledger_insert,
 position('for update' in lower(source)) first_explicit_update_lock,
 position('encounter_can_control_participant_v1' in lower(source)) controller_reference,
 position('v_existing.requested_by' in lower(source)) cached_requester_comparison,
 position('if v_w.status<>''pending'' then return' in lower(source)) resolved_window_return,
 CASE
 WHEN position('insert into public.encounter_command_requests' in lower(source))=0 THEN 'no direct insert / wrapper'
 WHEN position('encounter_can_control_participant_v1' in lower(source))>0
   AND position('insert into public.encounter_command_requests' in lower(source))
     <position('encounter_can_control_participant_v1' in lower(source))
 THEN 'ledger-first vs controller (inspect branches)'
 WHEN position('encounter_can_control_participant_v1' in lower(source))>0
 THEN 'controller reference first (inspect branches)'
 ELSE 'no direct controller reference (inspect admin / helper auth)'
 END source_class
FROM f
WHERE nspname='public' AND authenticated_execute AND (
 position('insert into public.encounter_command_requests' in lower(source))>0
 OR (proname LIKE 'encounter_cast_%' AND source LIKE '%p_request_id%')
)
ORDER BY proname,args;

-- Global request_id schema: no stored canonical action input or intent hash.
SELECT c.column_name,c.data_type,c.is_nullable,c.column_default
FROM information_schema.columns c
WHERE c.table_schema='public' AND c.table_name='encounter_command_requests'
ORDER BY c.ordinal_position;

-- Do not infer lock order from existence of a FOR UPDATE: the actual SQL
-- may lock window, actor, target and encounter in different orders.
SELECT p.proname,md5(pg_get_functiondef(p.oid)) md5,
 position('insert into public.encounter_command_requests' in lower(pg_get_functiondef(p.oid))) ledger,
 position('for update' in lower(pg_get_functiondef(p.oid))) first_lock,
 position('encounter_can_control_participant_v1' in lower(pg_get_functiondef(p.oid))) controller
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN (
 'encounter_end_turn_v1','encounter_move_active_participant_v1',
 'encounter_use_core_action_v1','encounter_weapon_attack_v1',
 'encounter_unarmed_strike_v1','encounter_resolve_opportunity_reaction_v1',
 'encounter_roll_save_v1','encounter_cast_spell_v11','encounter_cast_spell_v13'
)
ORDER BY p.proname;
