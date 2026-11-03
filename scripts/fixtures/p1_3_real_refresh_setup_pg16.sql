-- Disposable local PostgreSQL 16 only, after the existing Admin/Slot/Permission source tests.
ALTER TABLE public.encounter_spell_slots ADD COLUMN recharge_key text NOT NULL DEFAULT 'long_rest';
ALTER TABLE public.encounter_spell_slots ADD COLUMN source_class_id uuid;
ALTER TABLE public.encounter_spell_slots ADD COLUMN source_class_key text;
ALTER TABLE public.encounter_spell_slots ADD COLUMN source_book text;
ALTER TABLE public.encounter_spell_slots ADD COLUMN source_ruleset text;
ALTER TABLE public.encounter_spell_slots ADD COLUMN source_class_level integer;
ALTER TABLE public.encounter_spell_slots ADD CONSTRAINT p13_encounter_slot_unique UNIQUE(participant_id,pool_key,slot_level);
INSERT INTO public.characters(id,name) VALUES
 (public.fixture_uuid(12),'Refresh/Spend Character'),
 (public.fixture_uuid(13),'Ordered Refresh/Spend Character');
INSERT INTO public.character_progression(character_id,class_id,class_level) VALUES
 (public.fixture_uuid(12),public.fixture_uuid(990),1),
 (public.fixture_uuid(13),public.fixture_uuid(990),1);
INSERT INTO public.character_spell_slots(character_id,pool_key,slot_level,slots_max,slots_remaining,recharge_key) VALUES
 (public.fixture_uuid(12),'spellcasting',1,1,1,'long_rest'),
 (public.fixture_uuid(13),'spellcasting',1,1,1,'long_rest');
INSERT INTO public.encounters(id,map_id,status) VALUES
 (public.fixture_uuid(912),public.fixture_uuid(1),'active'),
 (public.fixture_uuid(913),public.fixture_uuid(1),'active');
INSERT INTO public.encounter_participants(id,encounter_id,character_id,display_name,speed_ft) VALUES
 (public.fixture_uuid(5912),public.fixture_uuid(912),public.fixture_uuid(12),'Refresh/Spend',30),
 (public.fixture_uuid(5913),public.fixture_uuid(913),public.fixture_uuid(13),'Ordered Refresh/Spend',30);
INSERT INTO public.encounter_spell_slots(id,participant_id,pool_key,slot_level,slots_max,slots_remaining) VALUES
 (public.fixture_uuid(4912),public.fixture_uuid(5912),'spellcasting',1,1,1),
 (public.fixture_uuid(4913),public.fixture_uuid(5913),'spellcasting',1,1,1);
