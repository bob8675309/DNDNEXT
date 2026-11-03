-- P1.3 FIRST-EXECUTION hidden information characterization.
-- Disposable local Supabase PG17/GoTrue ONLY, never production.
-- Load after the existing original and guarded fixtures, cases 48-81.
\set ON_ERROR_STOP on
DO $g$ BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::int<170000
 THEN RAISE EXCEPTION 'P1.3 privacy model requires disposable local PG17'; END IF;
END $g$;
-- All encounters use the fixture-only map; no actual world/town map data.
INSERT INTO public.characters(id,name,kind)
SELECT public.p13_auth_uuid(x),'P13 privacy synthetic character '||x,'npc'
FROM unnest(ARRAY[660,661,670,671,680,681,690,691,700,701,710,711]) AS x;
-- Each encounter has only two actors, allowing visible vs hidden comparisons.
INSERT INTO public.encounters(id,status,round,turn_index,active_participant_id,map_id)
SELECT public.p13_auth_uuid(900+x),'active',1,0,
       public.p13_auth_uuid(1000+10*x),public.p13_auth_uuid(333)
FROM generate_series(6,11) x;
-- Encounters 906/908/910: player or GM End Turn with hidden next participant.
-- Encounters 907/909/911: player or GM Move near hidden hostile reactor.
INSERT INTO public.encounter_participants(
 id,encounter_id,character_id,display_name,current_hp,max_hp,is_hidden,
 controller_user_id,initiative,q,r,team,action_available)
VALUES
(public.p13_auth_uuid(1060),public.p13_auth_uuid(906),public.p13_auth_uuid(660),'End Baseline Mover',20,20,false,NULL,20,0,0,'players',true),
(public.p13_auth_uuid(1061),public.p13_auth_uuid(906),public.p13_auth_uuid(661),'End Baseline Hidden',20,20,true,NULL,10,2,0,'enemy',true),
(public.p13_auth_uuid(1070),public.p13_auth_uuid(907),public.p13_auth_uuid(670),'Move Baseline Mover',20,20,false,NULL,20,0,0,'players',true),
(public.p13_auth_uuid(1071),public.p13_auth_uuid(907),public.p13_auth_uuid(671),'Move Baseline Hidden',20,20,true,NULL,10,1,0,'enemy',true),
(public.p13_auth_uuid(1080),public.p13_auth_uuid(908),public.p13_auth_uuid(680),'End Player Mover',20,20,false,NULL,20,0,0,'players',true),
(public.p13_auth_uuid(1081),public.p13_auth_uuid(908),public.p13_auth_uuid(681),'End Player Hidden',20,20,true,NULL,10,2,0,'enemy',true),
(public.p13_auth_uuid(1090),public.p13_auth_uuid(909),public.p13_auth_uuid(690),'Move Player Mover',20,20,false,NULL,20,0,0,'players',true),
(public.p13_auth_uuid(1091),public.p13_auth_uuid(909),public.p13_auth_uuid(691),'Move Player Hidden',20,20,true,NULL,10,1,0,'enemy',true),
(public.p13_auth_uuid(1100),public.p13_auth_uuid(910),public.p13_auth_uuid(700),'End GM Mover',20,20,false,NULL,20,0,0,'players',true),
(public.p13_auth_uuid(1101),public.p13_auth_uuid(910),public.p13_auth_uuid(701),'End GM Hidden',20,20,true,NULL,10,2,0,'enemy',true),
(public.p13_auth_uuid(1110),public.p13_auth_uuid(911),public.p13_auth_uuid(710),'Move GM Mover',20,20,false,NULL,20,0,0,'players',true),
(public.p13_auth_uuid(1111),public.p13_auth_uuid(911),public.p13_auth_uuid(711),'Move GM Hidden',20,20,true,NULL,10,1,0,'enemy',true);
NOTIFY pgrst,'reload schema';
