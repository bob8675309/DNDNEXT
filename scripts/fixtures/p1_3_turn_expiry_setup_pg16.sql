-- Disposable scratch PG16 only. Assumes the existing admin PG16 mocked fixture was initialized.
ALTER TABLE public.encounter_combat_log ADD COLUMN target_participant_id uuid;
CREATE TABLE public.encounter_timed_effects(
 id uuid PRIMARY KEY, encounter_id uuid, participant_id uuid,
 source_participant_id uuid,expiry_trigger text,effect_key text,
 metadata jsonb DEFAULT '{}'::jsonb,remaining_target_turn_starts integer,
 updated_at timestamptz DEFAULT now()
);
-- 601/602 are isolated turn-start trigger test encounters, not TC1 activation requests.
INSERT INTO public.encounters(id,map_id,status,round,turn_index)
VALUES (public.fixture_uuid(601),public.fixture_uuid(1),'active',2,2),
       (public.fixture_uuid(602),public.fixture_uuid(1),'active',2,2);
INSERT INTO public.encounter_participants(id,encounter_id,character_id,display_name,team,speed_ft)
VALUES
 (public.fixture_uuid(1601),public.fixture_uuid(601),public.fixture_uuid(1),'Source A','players',30),
 (public.fixture_uuid(1602),public.fixture_uuid(601),public.fixture_uuid(2),'Target A','enemies',20),
 (public.fixture_uuid(1701),public.fixture_uuid(602),public.fixture_uuid(3),'Source B','players',30),
 (public.fixture_uuid(1702),public.fixture_uuid(602),public.fixture_uuid(4),'Target B','enemies',20);
INSERT INTO public.encounter_timed_effects(
 id,encounter_id,participant_id,source_participant_id,expiry_trigger,effect_key,metadata,remaining_target_turn_starts
) VALUES
 (public.fixture_uuid(2601),public.fixture_uuid(601),public.fixture_uuid(1602),public.fixture_uuid(1601),'source_turn_start','slow','{"speedPenaltyFt":10}'::jsonb,1),
 (public.fixture_uuid(2701),public.fixture_uuid(602),public.fixture_uuid(1702),public.fixture_uuid(1701),'source_turn_start','slow','{"speedPenaltyFt":10}'::jsonb,1);
