-- P1.3 isolated PG16, executed AFTER preceding 41 established fixtures
-- and after installing exact live public v9->v1 + pre_1v bodies.
-- All users, grants, geometry, healing and visibility are mock dependencies.
-- Case 42: GM-assisted fallback; 43: source identity; 44: invalid assignment;
-- 45: valid v9->v1 Cure Wounds; 46: alternate typed intent cached replay;
-- 47: revoked controller with fresh request denied, prior cached request disclosed.
\set ON_ERROR_STOP on
INSERT INTO public.characters(id,name)
SELECT public.fixture_uuid(i),'Legacy downstream fixture character '||i FROM generate_series(60,63) i;
INSERT INTO public.spells_catalog(id,spell_key,name,source,level,classes)
VALUES(public.fixture_uuid(997),'cure-wounds|xphb','Cure Wounds','XPHB',1,ARRAY['cleric']::text[]),
      (public.fixture_uuid(998),'unsupported-spell|xphb','Unsupported','XPHB',0,ARRAY['cleric']::text[]),
      (public.fixture_uuid(999),'cure-wounds|phb','Cure Wounds legacy','PHB',1,ARRAY['cleric']::text[]);
INSERT INTO public.character_progression(character_id,class_id,class_level)
VALUES(public.fixture_uuid(60),public.fixture_uuid(991),1);
INSERT INTO public.character_spell_slots(character_id,pool_key,slot_level,slots_max,slots_remaining,recharge_key)
VALUES(public.fixture_uuid(60),'spellcasting',1,1,1,'long_rest');
INSERT INTO public.encounters(id,map_id,status,phase,round,turn_index,active_participant_id)
VALUES(public.fixture_uuid(946),public.fixture_uuid(1),'active','turns',1,0,public.fixture_uuid(5990)),
      (public.fixture_uuid(947),public.fixture_uuid(1),'active','turns',1,0,public.fixture_uuid(5993));
INSERT INTO public.encounter_participants(
 id,encounter_id,character_id,display_name,team,initiative,q,r,
 action_available,controller_user_id,speed_ft,current_hp,max_hp,armor_class,bonus_action_available)
VALUES
(public.fixture_uuid(5990),public.fixture_uuid(946),public.fixture_uuid(60),'Legacy cleric','players',20,0,0,true,public.fixture_uuid(900),30,30,30,10,true),
(public.fixture_uuid(5991),public.fixture_uuid(946),public.fixture_uuid(61),'Ally needing healing','players',10,1,0,true,public.fixture_uuid(900),30,1,30,10,true),
(public.fixture_uuid(5992),public.fixture_uuid(946),public.fixture_uuid(62),'Other ally','players',5,0,1,true,public.fixture_uuid(900),30,2,30,10,true),
(public.fixture_uuid(5993),public.fixture_uuid(947),public.fixture_uuid(63),'Unsupported spellcaster','players',20,0,0,true,public.fixture_uuid(900),30,10,10,10,true);
INSERT INTO public.character_spells(id,character_id,spell_id,source_type,source_label,prepared,always_available,casting_stat)
VALUES(public.fixture_uuid(6990),public.fixture_uuid(60),public.fixture_uuid(997),'class','cleric',true,false,'wis'),
      (public.fixture_uuid(6991),public.fixture_uuid(60),public.fixture_uuid(997),'class','cleric',true,false,'wis'),
      (public.fixture_uuid(6993),public.fixture_uuid(63),public.fixture_uuid(998),'class','cleric',true,false,'wis'),
      (public.fixture_uuid(6994),public.fixture_uuid(63),public.fixture_uuid(999),'class','cleric',true,false,'wis');
INSERT INTO public.encounter_spell_slots(id,participant_id,pool_key,slot_level,slots_max,slots_remaining)
VALUES(public.fixture_uuid(4990),public.fixture_uuid(5990),'spellcasting',1,1,1);
DO $case42$
DECLARE err text;
BEGIN
 RAISE NOTICE 'CASE 42: unsupported XPHB direct v9 fallback is GM-assisted';
 BEGIN
  PERFORM public.encounter_cast_spell_v9(public.fixture_uuid(5993),public.fixture_uuid(6993),public.fixture_uuid(5993),NULL,public.fixture_uuid(8993));
  RAISE EXCEPTION 'CASE 42 failed: unsupported spell was automated';
 EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
   IF err NOT LIKE '%GM-assisted%' THEN RAISE EXCEPTION 'CASE 42 unexpected error: %',err; END IF;
 END;
 IF EXISTS(SELECT 1 FROM public.encounter_command_requests WHERE request_id=public.fixture_uuid(8993))
    OR (SELECT action_available IS DISTINCT FROM true FROM public.encounter_participants WHERE id=public.fixture_uuid(5993))
 THEN RAISE EXCEPTION 'CASE 42 mutated action/request'; END IF;
 RAISE NOTICE 'PASS CASE 42: unsupported spell rejected with no ledger/action change';
END $case42$;
DO $case43$
DECLARE err text;
BEGIN
 RAISE NOTICE 'CASE 43: PHB source spelling does not become an XPHB cast';
 BEGIN
  PERFORM public.encounter_cast_spell_v9(public.fixture_uuid(5993),public.fixture_uuid(6994),public.fixture_uuid(5993),1,public.fixture_uuid(8994));
  RAISE EXCEPTION 'CASE 43 failed: PHB spell was automated';
 EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
   IF err NOT LIKE '%GM-assisted%' THEN RAISE EXCEPTION 'CASE 43 unexpected error: %',err; END IF;
 END;
 IF EXISTS(SELECT 1 FROM public.encounter_command_requests WHERE request_id=public.fixture_uuid(8994))
 THEN RAISE EXCEPTION 'CASE 43 inserted request'; END IF;
 RAISE NOTICE 'PASS CASE 43: source edition preserved; no mutation';
END $case43$;
DO $case44$
DECLARE err text;
BEGIN
 RAISE NOTICE 'CASE 44: spell assignment cannot be borrowed from another character';
 BEGIN
  PERFORM public.encounter_cast_spell_v9(public.fixture_uuid(5990),public.fixture_uuid(6994),public.fixture_uuid(5991),1,public.fixture_uuid(8995));
  RAISE EXCEPTION 'CASE 44 failed: foreign assignment was accepted';
 EXCEPTION WHEN OTHERS THEN
   GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
   IF err NOT LIKE '%spellbook%' AND err NOT LIKE '%assignment%' THEN RAISE EXCEPTION 'CASE 44 unexpected error: %',err; END IF;
 END;
 IF EXISTS(SELECT 1 FROM public.encounter_command_requests WHERE request_id=public.fixture_uuid(8995))
 THEN RAISE EXCEPTION 'CASE 44 inserted request'; END IF;
 RAISE NOTICE 'PASS CASE 44: foreign assignment rejected';
END $case44$;
DO $case45$
DECLARE result jsonb;
BEGIN
 RAISE NOTICE 'CASE 45: valid class Cure Wounds through exact original v9->v1 processor';
 result:=public.encounter_cast_spell_v9(public.fixture_uuid(5990),public.fixture_uuid(6990),public.fixture_uuid(5991),1,public.fixture_uuid(8990));
 IF result->>'spellKey'<>'cure-wounds|xphb'
    OR result->>'targetId'<>public.fixture_uuid(5991)::text
    OR (SELECT current_hp<=1 FROM public.encounter_participants WHERE id=public.fixture_uuid(5991))
    OR (SELECT action_available IS DISTINCT FROM false FROM public.encounter_participants WHERE id=public.fixture_uuid(5990))
    OR (SELECT slots_remaining<>0 FROM public.encounter_spell_slots WHERE id=public.fixture_uuid(4990))
    OR (SELECT count(*)<>1 FROM public.encounter_command_requests WHERE request_id=public.fixture_uuid(8990) AND result IS NOT NULL)
 THEN RAISE EXCEPTION 'CASE 45 Cure Wounds result/resource failure: %',result; END IF;
 RAISE NOTICE 'PASS CASE 45: original v1 processed healing/action/slot/ledger once';
END $case45$;
DO $case46$
DECLARE result jsonb;
BEGIN
 RAISE NOTICE 'CASE 46: same UUID changed target, assignment, slot returns cached v1 result';
 result:=public.encounter_cast_spell_v9(public.fixture_uuid(5990),public.fixture_uuid(6991),public.fixture_uuid(5992),2,public.fixture_uuid(8990));
 IF result->>'targetId'<>public.fixture_uuid(5991)::text
    OR (SELECT current_hp<>2 FROM public.encounter_participants WHERE id=public.fixture_uuid(5992))
    OR (SELECT count(*)<>1 FROM public.encounter_command_requests WHERE request_id=public.fixture_uuid(8990))
    OR (SELECT count(*)<>1 FROM public.encounter_combat_log WHERE encounter_id=public.fixture_uuid(946) AND event_type='spell_cast')
 THEN RAISE EXCEPTION 'CASE 46 unexpected replay behavior %',result; END IF;
 RAISE NOTICE 'PASS CASE 46: v1 returned stale cached result for changed target/assignment/slot (known weakness)';
END $case46$;
-- Deliberately replace MOCK control helper, not live permissions.
-- Simulates revocation after case 45; real JWT/GoTrue and per-NPC grants are NOT tested.
CREATE OR REPLACE FUNCTION public.encounter_can_control_participant_v1(p_participant_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $mock$ SELECT p_participant_id<>public.fixture_uuid(5990) $mock$;
DO $case47$
DECLARE result jsonb; err text;
BEGIN
 RAISE NOTICE 'CASE 47: simulated revoked control blocks fresh v1 request but NOT cached replay';
 BEGIN
  PERFORM public.encounter_cast_spell_v9(public.fixture_uuid(5990),public.fixture_uuid(6990),public.fixture_uuid(5991),1,public.fixture_uuid(8996));
  RAISE EXCEPTION 'CASE 47 failed: fresh request accepted under mocked revocation';
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS err=MESSAGE_TEXT;
  IF err NOT LIKE '%Not authorized%' THEN RAISE EXCEPTION 'CASE 47 unexpected fresh error: %',err; END IF;
 END;
 result:=public.encounter_cast_spell_v9(public.fixture_uuid(5990),public.fixture_uuid(6991),public.fixture_uuid(5992),2,public.fixture_uuid(8990));
 IF result->>'targetId'<>public.fixture_uuid(5991)::text THEN RAISE EXCEPTION 'CASE 47 cached replay not reproduced: %',result; END IF;
 IF EXISTS(SELECT 1 FROM public.encounter_command_requests WHERE request_id=public.fixture_uuid(8996))
 THEN RAISE EXCEPTION 'CASE 47 denied request left ledger'; END IF;
 RAISE NOTICE 'PASS CASE 47: mock revocation denied fresh request but not cached replay; NO genuine-user exploit proof';
END $case47$;
