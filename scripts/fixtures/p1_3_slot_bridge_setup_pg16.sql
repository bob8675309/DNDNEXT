-- RESEARCH: disposable PG16 schema only, after the exact-source Admin + expiry fixture.
-- This is NOT a Supabase migration. No actual DnDNext Auth, RLS or full trigger graph.
CREATE TABLE public.class_catalog(
 id uuid PRIMARY KEY,class_key text,source text,ruleset text,
 caster_progression text,spellcasting_ability text
);
CREATE TABLE public.class_level_progression(
 class_id uuid,class_level integer,spell_slots jsonb,PRIMARY KEY(class_id,class_level)
);
CREATE TABLE public.character_progression(
 character_id uuid PRIMARY KEY,class_id uuid,class_level integer
);
CREATE TABLE public.character_spell_slots(
 character_id uuid NOT NULL,pool_key text NOT NULL,slot_level integer NOT NULL,
 slots_max integer NOT NULL,slots_remaining integer NOT NULL,recharge_key text NOT NULL,
 source_class_id uuid,source_class_key text,source_book text,source_ruleset text,
 source_class_level integer,updated_at timestamptz DEFAULT now(),
 PRIMARY KEY(character_id,pool_key,slot_level)
);
CREATE TABLE public.encounter_spell_slots(
 id uuid PRIMARY KEY,participant_id uuid NOT NULL,pool_key text NOT NULL,
 slot_level integer NOT NULL,slots_max integer NOT NULL,
 slots_remaining integer NOT NULL,updated_at timestamptz DEFAULT now()
);
INSERT INTO public.characters(id,name)
SELECT public.fixture_uuid(i),'Spell Source Character '||i FROM generate_series(8,10) i;
INSERT INTO public.class_catalog
VALUES (public.fixture_uuid(990),'wizard','XPHB','2024','full','int');
INSERT INTO public.class_level_progression
VALUES (public.fixture_uuid(990),1,'[1]'::jsonb),
       (public.fixture_uuid(990),2,'[2]'::jsonb);
INSERT INTO public.character_progression VALUES
(public.fixture_uuid(8),public.fixture_uuid(990),1),
(public.fixture_uuid(9),public.fixture_uuid(990),2),
(public.fixture_uuid(10),public.fixture_uuid(990),1);
INSERT INTO public.character_spell_slots(
 character_id,pool_key,slot_level,slots_max,slots_remaining,recharge_key)
VALUES
(public.fixture_uuid(8),'spellcasting',1,1,1,'long_rest'),
(public.fixture_uuid(9),'spellcasting',1,2,2,'long_rest'),
(public.fixture_uuid(10),'spellcasting',1,1,1,'long_rest');
-- Deliberately reproduce historical overlap for the sandbox cases only.
-- Owner TC1 Option A still FORBIDS two active encounters with a shared character.
INSERT INTO public.encounters(id,map_id,status) VALUES
(public.fixture_uuid(701),public.fixture_uuid(1),'active'),
(public.fixture_uuid(702),public.fixture_uuid(1),'active'),
(public.fixture_uuid(801),public.fixture_uuid(1),'active'),
(public.fixture_uuid(802),public.fixture_uuid(1),'active'),
(public.fixture_uuid(803),public.fixture_uuid(1),'active');
INSERT INTO public.encounter_participants(
 id,encounter_id,character_id,display_name,speed_ft)
VALUES
(public.fixture_uuid(4701),public.fixture_uuid(701),public.fixture_uuid(8),'Shared Slot A',30),
(public.fixture_uuid(4702),public.fixture_uuid(702),public.fixture_uuid(8),'Shared Slot B',30),
(public.fixture_uuid(4801),public.fixture_uuid(801),public.fixture_uuid(9),'Two Slot A',30),
(public.fixture_uuid(4802),public.fixture_uuid(802),public.fixture_uuid(9),'Two Slot B',30),
(public.fixture_uuid(4803),public.fixture_uuid(803),public.fixture_uuid(10),'Reverse Lock',30);
INSERT INTO public.encounter_spell_slots(id,participant_id,pool_key,slot_level,slots_max,slots_remaining)
VALUES
(public.fixture_uuid(3701),public.fixture_uuid(4701),'spellcasting',1,1,1),
(public.fixture_uuid(3702),public.fixture_uuid(4702),'spellcasting',1,1,1),
(public.fixture_uuid(3801),public.fixture_uuid(4801),'spellcasting',1,1,1),
(public.fixture_uuid(3802),public.fixture_uuid(4802),'spellcasting',1,1,1),
(public.fixture_uuid(3803),public.fixture_uuid(4803),'spellcasting',1,1,1);
