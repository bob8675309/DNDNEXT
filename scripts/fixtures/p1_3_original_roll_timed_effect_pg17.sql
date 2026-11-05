-- P1.3 original randomized attack-roll and X timed-effect contention.
-- Disposable GitHub localhost PG17 only. Never run against DnDWeb production.
\set ON_ERROR_STOP on
DO $g$ BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::int<170000
 THEN RAISE EXCEPTION 'P13 PG17 localhost fixture required'; END IF;
END $g$;
-- Prior synthetic table intentionally omitted created_at; real source requires it.
ALTER TABLE public.encounter_timed_effects
 ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
\i scripts/fixtures/p1_3_original_attack_roll_live_pg17.sql
-- Preserve internal-only grants on the original source replacement.
REVOKE ALL ON FUNCTION private.encounter_resolve_attack_roll_v1(uuid,uuid,boolean)
 FROM PUBLIC,anon,authenticated;
DO $grants$ BEGIN
 IF has_function_privilege('authenticated',
    'private.encounter_resolve_attack_roll_v1(uuid,uuid,boolean)','EXECUTE')
 THEN RAISE EXCEPTION 'real attack-roll source exposed to player'; END IF;
END $grants$;
-- Synthetic E920..926, target P1200..1260 and reactor P1201..1261.
INSERT INTO public.characters(id,name,kind)
SELECT public.p13_auth_uuid(820+10*(n-20)),'Roll-test target '||n,'npc'
FROM generate_series(20,26) n
UNION ALL
SELECT public.p13_auth_uuid(821+10*(n-20)),'Roll-test attacker '||n,'npc'
FROM generate_series(20,26) n;
INSERT INTO public.encounters(id,status,round,turn_index,active_participant_id,map_id)
SELECT public.p13_auth_uuid(900+n),'active',1,0,
 public.p13_auth_uuid(1000+10*n),public.p13_auth_uuid(333)
FROM generate_series(20,26) n;
INSERT INTO public.encounter_participants(
 id,encounter_id,character_id,display_name,current_hp,max_hp,
 is_hidden,controller_user_id,initiative,q,r,team,action_available,reaction_available)
SELECT public.p13_auth_uuid(1000+10*n),public.p13_auth_uuid(900+n),
 public.p13_auth_uuid(820+10*(n-20)),'Roll-test target '||n,20,20,
 false,NULL::uuid,20,0,0,'players',true,true
FROM generate_series(20,26) n
UNION ALL
SELECT public.p13_auth_uuid(1001+10*n),public.p13_auth_uuid(900+n),
 public.p13_auth_uuid(821+10*(n-20)),'Roll-test attacker '||n,20,20,
 false,NULL::uuid,10,1,0,'enemy',true,true
FROM generate_series(20,26) n;
INSERT INTO public.encounter_reaction_windows(
 id,encounter_id,mover_participant_id,reactor_participant_id,
 round,turn_index,from_q,from_r,to_q,to_r)
SELECT public.p13_auth_uuid(5000+10*n),public.p13_auth_uuid(900+n),
 public.p13_auth_uuid(1000+10*n),public.p13_auth_uuid(1001+10*n),
 1,0,0,0,-1,0
FROM generate_series(20,26) n;
-- Original Guiding Bolt advantage against target P1200; original Vicious
-- Mockery disadvantage on attacker P1211; E922 both cancel; E923 duplicate
-- same-UUID contention; E925 suppressed reaction (no effect consumption);
-- E926 competing fresh UUIDs consume effects at most once.
INSERT INTO public.encounter_timed_effects(
 encounter_id,participant_id,source_participant_id,effect_key,
 remaining_target_turn_starts,expiry_trigger,created_at)
VALUES
(public.p13_auth_uuid(920),public.p13_auth_uuid(1200),public.p13_auth_uuid(1201),
 'guiding_bolt_next_attack_advantage',1,'target_turn_start',now()-interval '3 seconds'),
(public.p13_auth_uuid(921),public.p13_auth_uuid(1211),public.p13_auth_uuid(1210),
 'vicious_mockery_next_attack_disadvantage',1,'target_turn_start',now()-interval '3 seconds'),
(public.p13_auth_uuid(922),public.p13_auth_uuid(1220),public.p13_auth_uuid(1221),
 'guiding_bolt_next_attack_advantage',1,'target_turn_start',now()-interval '3 seconds'),
(public.p13_auth_uuid(922),public.p13_auth_uuid(1221),public.p13_auth_uuid(1220),
 'vicious_mockery_next_attack_disadvantage',1,'target_turn_start',now()-interval '2 seconds'),
(public.p13_auth_uuid(923),public.p13_auth_uuid(1230),public.p13_auth_uuid(1231),
 'guiding_bolt_next_attack_advantage',1,'target_turn_start',now()-interval '3 seconds'),
(public.p13_auth_uuid(925),public.p13_auth_uuid(1250),public.p13_auth_uuid(1251),
 'guiding_bolt_next_attack_advantage',1,'target_turn_start',now()-interval '3 seconds'),
(public.p13_auth_uuid(925),public.p13_auth_uuid(1251),public.p13_auth_uuid(1250),
 'opportunity_attack_suppressed',1,'target_turn_start',now()-interval '3 seconds'),
(public.p13_auth_uuid(926),public.p13_auth_uuid(1260),public.p13_auth_uuid(1261),
 'guiding_bolt_next_attack_advantage',1,'target_turn_start',now()-interval '3 seconds');
NOTIFY pgrst,'reload schema';
