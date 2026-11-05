-- Disposable local PostgreSQL 16: exact public v13 -> v12 Vicious Mockery branch.
-- AFTER all earlier research fixtures. Mock actual Auth, save bonuses, spellcasting
-- profile, targeting, ability score, roll/damage behavior. v13/v12 and effect
-- function bodies are exact deployed definitions (source separately installed).
ALTER TABLE public.character_spells ADD COLUMN save_dc_override integer;
ALTER TABLE public.encounter_timed_effects ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.encounter_timed_effects ADD COLUMN applied_round integer DEFAULT 0;
ALTER TABLE public.encounter_timed_effects ADD COLUMN applied_turn_index integer DEFAULT 0;
ALTER TABLE public.encounter_timed_effects ADD CONSTRAINT p13_one_effect_per_target UNIQUE(participant_id,effect_key);
CREATE OR REPLACE FUNCTION public.encounter_spellcasting_profile_v1(p_participant uuid)
RETURNS jsonb LANGUAGE sql STABLE AS $fn$
 SELECT '{"isClassCaster":true,"className":"bard","castingAbility":"cha","proficiencyBonus":2,"classLevel":1}'::jsonb $fn$;
CREATE FUNCTION public.encounter_saving_throw_profile_internal_v1(p_participant uuid,p_stat text)
RETURNS jsonb LANGUAGE sql STABLE AS $fn$
 SELECT '{"saveBonus":-100,"ability":"wis"}'::jsonb $fn$;
INSERT INTO public.spells_catalog(id,spell_key,name,source,level,classes)
VALUES(public.fixture_uuid(994),'vicious-mockery|xphb','Vicious Mockery','XPHB',0,ARRAY['bard']::text[]);
INSERT INTO public.characters(id,name)
SELECT public.fixture_uuid(i),'Delegated Vicious Mockery Actor '||i FROM generate_series(35,39) i;
INSERT INTO public.encounters(id,map_id,status,phase,round,turn_index,active_participant_id)
VALUES(public.fixture_uuid(940),public.fixture_uuid(1),'active','turns',1,0,public.fixture_uuid(5960)),
      (public.fixture_uuid(941),public.fixture_uuid(1),'active','turns',1,0,public.fixture_uuid(5962));
INSERT INTO public.encounter_participants(
 id,encounter_id,character_id,display_name,team,initiative,q,r,
 reaction_available,action_available,controller_user_id,speed_ft,
 current_hp,max_hp,armor_class)
VALUES
 (public.fixture_uuid(5960),public.fixture_uuid(940),public.fixture_uuid(35),'Bard V12 A','players',20,0,0,false,true,public.fixture_uuid(900),30,10,10,10),
 (public.fixture_uuid(5961),public.fixture_uuid(940),public.fixture_uuid(36),'Target A','enemies',10,1,0,false,true,public.fixture_uuid(900),30,10,10,10),
 (public.fixture_uuid(5964),public.fixture_uuid(940),public.fixture_uuid(39),'Different Target','enemies',5,2,0,false,true,public.fixture_uuid(900),30,10,10,10),
 (public.fixture_uuid(5962),public.fixture_uuid(941),public.fixture_uuid(37),'Bard V12 B','players',20,0,0,false,true,public.fixture_uuid(900),30,10,10,10),
 (public.fixture_uuid(5963),public.fixture_uuid(941),public.fixture_uuid(38),'Target B','enemies',10,1,0,false,true,public.fixture_uuid(900),30,10,10,10);
INSERT INTO public.character_spells(id,character_id,spell_id,source_type,source_label,prepared,always_available,casting_stat)
VALUES
(public.fixture_uuid(6960),public.fixture_uuid(35),public.fixture_uuid(994),'class','bard',true,false,'cha'),
(public.fixture_uuid(6962),public.fixture_uuid(37),public.fixture_uuid(994),'class','bard',true,false,'cha');
