-- DISPOSABLE PG16 SCRATCH DATABASE ONLY. Requires existing p1_3 live Admin fixture.
-- These added fields match the source function's required schema shape.
ALTER TABLE public.encounter_participants ADD COLUMN controller_user_id uuid;
ALTER TABLE public.encounter_participants ADD COLUMN is_hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.encounter_participants ADD COLUMN state jsonb NOT NULL DEFAULT '{}'::jsonb;
INSERT INTO public.encounters(id,map_id,status) VALUES
  (public.fixture_uuid(611),public.fixture_uuid(1),'draft'),
  (public.fixture_uuid(612),public.fixture_uuid(1),'draft');
INSERT INTO public.encounter_participants(id,encounter_id,character_id,display_name,initiative)
VALUES
  (public.fixture_uuid(1611),public.fixture_uuid(611),public.fixture_uuid(6),'Synthetic Race Actor A',12),
  (public.fixture_uuid(1612),public.fixture_uuid(612),public.fixture_uuid(7),'Synthetic Race Actor B',12);