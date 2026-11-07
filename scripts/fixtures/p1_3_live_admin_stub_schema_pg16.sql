-- DISPOSABLE PostgreSQL16 only. Mock dependencies, not a production migration.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS private;
CREATE FUNCTION public.fixture_uuid(p_n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
 SELECT ('00000000-0000-0000-0000-' || lpad(p_n::text,12,'0'))::uuid
$$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT public.fixture_uuid(900) $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'authenticated'::text $$;
CREATE FUNCTION public.is_admin(p_uid uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT p_uid=public.fixture_uuid(900) $$;
CREATE TABLE public.characters(id uuid PRIMARY KEY, name text);
CREATE TABLE public.encounter_maps(id uuid PRIMARY KEY, radius integer,is_active boolean);
CREATE TABLE public.encounters(
 id uuid PRIMARY KEY,map_id uuid NOT NULL,status text NOT NULL,phase text DEFAULT 'staging',
 round integer DEFAULT 0,turn_index integer DEFAULT 0,active_participant_id uuid,
 started_at timestamptz,resolved_at timestamptz,version integer DEFAULT 0,updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.encounter_participants(
 id uuid PRIMARY KEY,encounter_id uuid NOT NULL REFERENCES public.encounters(id),
 character_id uuid,display_name text,team text DEFAULT 'players',initiative numeric DEFAULT 10,
 initiative_tiebreaker numeric DEFAULT 0,created_at timestamptz DEFAULT now(),
 is_defeated boolean NOT NULL DEFAULT false,q integer DEFAULT 0,r integer DEFAULT 0,
 movement_spent_ft integer DEFAULT 0,movement_bonus_ft integer DEFAULT 0,action_available boolean DEFAULT false,
 bonus_action_available boolean DEFAULT false,reaction_available boolean DEFAULT false,
 disengaged boolean DEFAULT false,dodging boolean DEFAULT false,speed_ft integer DEFAULT 0,
 turn_started_at timestamptz,updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.encounter_hex_overrides(map_id uuid,q integer,r integer,terrain_type text);
CREATE TABLE public.encounter_map_objects(map_id uuid,q integer,r integer,blocks_movement boolean);
CREATE TABLE public.encounter_combat_log(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,encounter_id uuid,
 round integer,turn_index integer,actor_participant_id uuid,event_type text,summary text,detail jsonb
);
CREATE FUNCTION public.encounter_canonical_speed_ft_v1(p_character uuid)
RETURNS integer LANGUAGE sql STABLE AS $$ SELECT 30 $$;
INSERT INTO public.encounter_maps VALUES(public.fixture_uuid(1),6,true);
INSERT INTO public.characters(id,name) SELECT public.fixture_uuid(i),'Synthetic Character '||i FROM generate_series(1,7) i;
INSERT INTO public.encounters(id,map_id,status) VALUES
(public.fixture_uuid(101),public.fixture_uuid(1),'draft'),
(public.fixture_uuid(102),public.fixture_uuid(1),'draft'),
(public.fixture_uuid(103),public.fixture_uuid(1),'paused'),
(public.fixture_uuid(201),public.fixture_uuid(1),'draft'),
(public.fixture_uuid(202),public.fixture_uuid(1),'draft'),
(public.fixture_uuid(203),public.fixture_uuid(1),'paused'),
(public.fixture_uuid(204),public.fixture_uuid(1),'draft'),
(public.fixture_uuid(211),public.fixture_uuid(1),'draft'),
(public.fixture_uuid(212),public.fixture_uuid(1),'draft'),
(public.fixture_uuid(231),public.fixture_uuid(1),'draft');
INSERT INTO public.encounter_participants(id,encounter_id,character_id,display_name,initiative)
SELECT public.fixture_uuid(n+1000),public.fixture_uuid(n),public.fixture_uuid(c),'Synthetic Actor '||c,10
FROM (VALUES (101,1),(102,1),(103,1),(201,2),(202,2),(203,2),(204,2),
(211,3),(212,4),(231,5)) AS choices(n,c);