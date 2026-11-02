-- Disposable source-derived permission-race model. Not a real authenticated session or RPC action.
ALTER TABLE public.encounter_participants ADD COLUMN IF NOT EXISTS controller_user_id uuid;
CREATE TABLE public.character_permissions(character_id uuid NOT NULL,user_id uuid NOT NULL,can_edit boolean NOT NULL,PRIMARY KEY(character_id,user_id));
CREATE TABLE public.p13_auth_race_events(label text PRIMARY KEY,occurred_at timestamptz NOT NULL);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $authuid$
 SELECT coalesce(nullif(current_setting('dndnext.fixture_user_id',true),'')::uuid,public.fixture_uuid(900))
$authuid$;
INSERT INTO public.characters(id,name) VALUES (public.fixture_uuid(11),'Permission Race Synthetic NPC');
INSERT INTO public.encounters(id,map_id,status) VALUES (public.fixture_uuid(901),public.fixture_uuid(1),'active');
INSERT INTO public.encounter_participants(id,encounter_id,character_id,display_name,action_available,speed_ft)
 VALUES(public.fixture_uuid(5801),public.fixture_uuid(901),public.fixture_uuid(11),'Synthetic NPC',true,30);
INSERT INTO public.character_permissions(character_id,user_id,can_edit)
 VALUES(public.fixture_uuid(11),public.fixture_uuid(901),true);
