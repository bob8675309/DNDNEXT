-- Disposable PG16 source-fixture extension; not a live Supabase migration.
-- Requires prior Admin, staged update, turn expiry, slot bridge, permission, refresh,
-- and public Healing Word research fixtures installed in the same scratch CI service.
-- Only these five public combat RPC definitions are deployed-source exact.
-- Geometry, equipment, reach and targeting dependencies below are intentionally mock data.
ALTER TABLE public.encounter_participants ADD COLUMN facing text DEFAULT 'east';
ALTER TABLE public.encounter_hex_overrides ADD COLUMN movement_multiplier numeric NOT NULL DEFAULT 1;
ALTER TABLE public.encounter_conditions ADD COLUMN remaining_target_turn_ends integer;
ALTER TABLE public.encounter_conditions ADD COLUMN updated_at timestamptz DEFAULT now();
CREATE TABLE public.encounter_reaction_windows(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 encounter_id uuid NOT NULL,
 mover_participant_id uuid NOT NULL,
 reactor_participant_id uuid NOT NULL,
 trigger_type text NOT NULL DEFAULT 'opportunity_attack',
 round integer NOT NULL,
 turn_index integer NOT NULL,
 from_q integer NOT NULL,
 from_r integer NOT NULL,
 to_q integer NOT NULL,
 to_r integer NOT NULL,
 status text NOT NULL DEFAULT 'pending',
 choice text,
 weapon_inventory_item_id uuid,
 result jsonb DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 resolved_at timestamptz
);
-- The deployed helper is not copied; these stubs isolate movement/reaction orchestration.
CREATE FUNCTION public.encounter_threat_reach_ft_internal_v1(p_reactor_id uuid)
RETURNS integer LANGUAGE sql STABLE AS $fn$ SELECT 5 $fn$;
CREATE FUNCTION public.encounter_targeting_context_internal_v1(p_reactor_id uuid,p_mover_id uuid)
RETURNS jsonb LANGUAGE sql STABLE AS $fn$
SELECT '{"hasLineOfSight":true,"coverLevel":"none","distanceFt":5}'::jsonb $fn$;
INSERT INTO public.characters(id,name)
SELECT public.fixture_uuid(i),'Turn-flow source case actor '||i
FROM generate_series(17,24) i;
INSERT INTO public.encounters(id,map_id,status,phase,round,turn_index,active_participant_id)
VALUES
(public.fixture_uuid(930),public.fixture_uuid(1),'active','turns',1,0,public.fixture_uuid(5930)),
(public.fixture_uuid(931),public.fixture_uuid(1),'active','turns',1,0,public.fixture_uuid(5932)),
(public.fixture_uuid(932),public.fixture_uuid(1),'active','turns',1,0,public.fixture_uuid(5934)),
(public.fixture_uuid(933),public.fixture_uuid(1),'active','turns',1,0,public.fixture_uuid(5936));
INSERT INTO public.encounter_participants(
 id,encounter_id,character_id,display_name,team,initiative,q,r,
 reaction_available,action_available,controller_user_id,speed_ft,bonus_action_available)
VALUES
(public.fixture_uuid(5930),public.fixture_uuid(930),public.fixture_uuid(17),'Mover A','players',20,0,0,false,true,public.fixture_uuid(900),30,true),
(public.fixture_uuid(5931),public.fixture_uuid(930),public.fixture_uuid(18),'Ally A','players',10,3,0,false,true,public.fixture_uuid(900),30,true),
(public.fixture_uuid(5932),public.fixture_uuid(931),public.fixture_uuid(19),'Dodge A','players',20,0,0,false,true,public.fixture_uuid(900),30,true),
(public.fixture_uuid(5933),public.fixture_uuid(931),public.fixture_uuid(20),'Ally B','players',10,3,0,false,true,public.fixture_uuid(900),30,true),
(public.fixture_uuid(5934),public.fixture_uuid(932),public.fixture_uuid(21),'Mover C','players',20,0,0,false,true,public.fixture_uuid(900),30,true),
(public.fixture_uuid(5935),public.fixture_uuid(932),public.fixture_uuid(22),'Reactor C','enemies',10,1,0,true,true,public.fixture_uuid(900),30,true),
(public.fixture_uuid(5936),public.fixture_uuid(933),public.fixture_uuid(23),'Mover D','players',20,0,0,false,true,public.fixture_uuid(900),30,true),
(public.fixture_uuid(5937),public.fixture_uuid(933),public.fixture_uuid(24),'Reactor D','enemies',10,1,0,true,true,public.fixture_uuid(900),30,true);
