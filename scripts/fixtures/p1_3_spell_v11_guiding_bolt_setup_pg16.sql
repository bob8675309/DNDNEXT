-- Disposable research PostgreSQL16, after all P1.3 fixtures from cases 1-35.
-- Real v11, v11_pre and source-end effect helper bodies are snapshotted separately.
-- Real auth, spellcasting profile, targeting, attack-roll and damage remain scratch mocks.
ALTER TABLE public.character_spells ADD COLUMN attack_bonus_override integer;
CREATE OR REPLACE FUNCTION public.encounter_spellcasting_profile_v1(p_participant uuid)
 RETURNS jsonb LANGUAGE sql STABLE AS $body$
 SELECT CASE WHEN p_participant IN (public.fixture_uuid(5970),public.fixture_uuid(5973))
 THEN '{"isClassCaster":true,"className":"cleric","castingAbility":"wis","proficiencyBonus":2,"classLevel":1}'::jsonb
 ELSE '{"isClassCaster":true,"className":"bard","castingAbility":"cha","proficiencyBonus":2,"classLevel":1}'::jsonb END
 $body$;
INSERT INTO public.spells_catalog(id,spell_key,name,source,level,classes)
 VALUES(public.fixture_uuid(995),'guiding-bolt|xphb','Guiding Bolt','XPHB',1,ARRAY['cleric']::text[]);
INSERT INTO public.characters(id,name) SELECT public.fixture_uuid(i),'Guiding Bolt Source Character '||i
 FROM generate_series(40,45) i;
INSERT INTO public.character_progression(character_id,class_id,class_level)
 VALUES(public.fixture_uuid(40),public.fixture_uuid(991),1),
       (public.fixture_uuid(43),public.fixture_uuid(991),1);
INSERT INTO public.character_spell_slots(character_id,pool_key,slot_level,slots_max,slots_remaining,recharge_key)
 VALUES(public.fixture_uuid(40),'spellcasting',1,1,1,'long_rest'),
       (public.fixture_uuid(43),'spellcasting',1,1,1,'long_rest');
INSERT INTO public.encounters(id,map_id,status,phase,round,turn_index,active_participant_id)
 VALUES(public.fixture_uuid(942),public.fixture_uuid(1),'active','turns',1,0,public.fixture_uuid(5970)),
       (public.fixture_uuid(943),public.fixture_uuid(1),'active','turns',1,0,public.fixture_uuid(5973));
INSERT INTO public.encounter_participants(
 id,encounter_id,character_id,display_name,team,initiative,q,r,
 reaction_available,action_available,controller_user_id,speed_ft,
 current_hp,max_hp,armor_class,bonus_action_available)
 VALUES
(public.fixture_uuid(5970),public.fixture_uuid(942),public.fixture_uuid(40),'Cleric One','players',20,0,0,false,true,public.fixture_uuid(900),30,40,40,10,true),
(public.fixture_uuid(5971),public.fixture_uuid(942),public.fixture_uuid(41),'Target One','enemies',10,3,0,false,true,public.fixture_uuid(900),30,60,60,10,true),
(public.fixture_uuid(5972),public.fixture_uuid(942),public.fixture_uuid(42),'Other Target','enemies',5,4,0,false,true,public.fixture_uuid(900),30,60,60,10,true),
(public.fixture_uuid(5973),public.fixture_uuid(943),public.fixture_uuid(43),'Cleric Two','players',20,0,0,false,true,public.fixture_uuid(900),30,40,40,10,true),
(public.fixture_uuid(5974),public.fixture_uuid(943),public.fixture_uuid(44),'Target Two','enemies',10,3,0,false,true,public.fixture_uuid(900),30,60,60,10,true),
(public.fixture_uuid(5975),public.fixture_uuid(943),public.fixture_uuid(45),'Target Three','enemies',5,4,0,false,true,public.fixture_uuid(900),30,60,60,10,true);
INSERT INTO public.character_spells(id,character_id,spell_id,source_type,source_label,prepared,always_available,casting_stat)
 VALUES(public.fixture_uuid(6970),public.fixture_uuid(40),public.fixture_uuid(995),'class','cleric',true,false,'wis'),
       (public.fixture_uuid(6973),public.fixture_uuid(43),public.fixture_uuid(995),'class','cleric',true,false,'wis');
INSERT INTO public.encounter_spell_slots(id,participant_id,pool_key,slot_level,slots_max,slots_remaining)
 VALUES(public.fixture_uuid(4970),public.fixture_uuid(5970),'spellcasting',1,1,1),
       (public.fixture_uuid(4973),public.fixture_uuid(5973),'spellcasting',1,1,1);
