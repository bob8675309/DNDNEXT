-- Research-only, disposable PostgreSQL 16, after the Weapon and Turn-Flow fixtures.
-- Original Move, Resolve Reaction, Weapon and damage command functions are already loaded.
-- Original opportunity-attack internal and timed-effect helper loaded separately.
-- Targeting, equip/weapon profile, roll and damage helpers are deterministic scratch mocks.
INSERT INTO public.characters(id,name)
SELECT public.fixture_uuid(i),'OA Source Case Character '||i
FROM generate_series(31,34) i;
INSERT INTO public.encounters(id,map_id,status,phase,round,turn_index,active_participant_id)
VALUES (public.fixture_uuid(937),public.fixture_uuid(1),'active','turns',1,0,public.fixture_uuid(5950)),
       (public.fixture_uuid(938),public.fixture_uuid(1),'active','turns',1,0,public.fixture_uuid(5952));
INSERT INTO public.encounter_participants(
 id,encounter_id,character_id,display_name,team,initiative,q,r,
 reaction_available,action_available,controller_user_id,speed_ft,current_hp,max_hp,armor_class)
VALUES
(public.fixture_uuid(5950),public.fixture_uuid(937),public.fixture_uuid(31),'Mover Source A','players',20,0,0,false,true,public.fixture_uuid(900),30,10,10,10),
(public.fixture_uuid(5951),public.fixture_uuid(937),public.fixture_uuid(32),'Reactor Source A','enemies',10,1,0,true,true,public.fixture_uuid(900),30,10,10,10),
(public.fixture_uuid(5952),public.fixture_uuid(938),public.fixture_uuid(33),'Mover Source B','players',20,0,0,false,true,public.fixture_uuid(900),30,10,10,10),
(public.fixture_uuid(5953),public.fixture_uuid(938),public.fixture_uuid(34),'Reactor Source B','enemies',10,1,0,true,true,public.fixture_uuid(900),30,10,10,10);
