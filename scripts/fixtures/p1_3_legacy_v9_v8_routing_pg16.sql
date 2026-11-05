-- P1.3 v9/v8 direct authenticated legacy entry routing.
-- Standalone disposable PG16 only. Original live v9/v8 bodies, verified 2026-11-02.
-- MD5: v9 82f14736b1761ff3a2f9316157d84a4a; v8 02d205bd666d56c89f67040859917615.
-- Downstream v7/v11 are TEST DOUBLES: no JWT, permission, ledger or effects proof.
\set ON_ERROR_STOP on
CREATE SCHEMA IF NOT EXISTS private;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE public.encounter_participants(id uuid PRIMARY KEY, character_id uuid NOT NULL);
CREATE TABLE public.spells_catalog(id uuid PRIMARY KEY, spell_key text NOT NULL);
CREATE TABLE public.character_spells(id uuid PRIMARY KEY, character_id uuid NOT NULL, spell_id uuid NOT NULL REFERENCES public.spells_catalog(id));
CREATE TABLE public.fixture_routes (route text NOT NULL, caster uuid, assignment uuid, target uuid, slot integer, request uuid);
CREATE OR REPLACE FUNCTION public.encounter_cast_spell_v11(p_caster_id uuid,p_assignment_id uuid,p_target_id uuid,p_slot_level integer,p_request_id uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO public.fixture_routes VALUES ('v11',p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id);
 RETURN jsonb_build_object('route','v11','request',p_request_id);
END; $$;
CREATE OR REPLACE FUNCTION public.encounter_cast_spell_v7(p_caster_id uuid,p_assignment_id uuid,p_target_id uuid,p_slot_level integer,p_request_id uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO public.fixture_routes VALUES ('v7',p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id);
 RETURN jsonb_build_object('route','v7','request',p_request_id);
END; $$;
-- Exact source body of deployed v8, no internal Authorization/RLS checks.
CREATE OR REPLACE FUNCTION public.encounter_cast_spell_v8(p_caster_id uuid, p_assignment_id uuid, p_target_id uuid, p_slot_level integer, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare v_key text;
begin
  select lower(s.spell_key) into v_key from public.encounter_participants p join public.character_spells cs on cs.character_id=p.character_id and cs.id=p_assignment_id join public.spells_catalog s on s.id=cs.spell_id where p.id=p_caster_id;
  if v_key='ray-of-frost|xphb' then return public.encounter_cast_spell_v11(p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id); end if;
  return public.encounter_cast_spell_v7(p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id);
end;$function$;
-- Exact source body of deployed v9.
CREATE OR REPLACE FUNCTION public.encounter_cast_spell_v9(p_caster_id uuid, p_assignment_id uuid, p_target_id uuid, p_slot_level integer, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare v_key text;
begin
  select lower(s.spell_key) into v_key from public.encounter_participants p join public.character_spells cs on cs.character_id=p.character_id and cs.id=p_assignment_id join public.spells_catalog s on s.id=cs.spell_id where p.id=p_caster_id;
  if v_key='chill-touch|xphb' then return public.encounter_cast_spell_v11(p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id); end if;
  return public.encounter_cast_spell_v8(p_caster_id,p_assignment_id,p_target_id,p_slot_level,p_request_id);
end;$function$;
INSERT INTO public.encounter_participants VALUES('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010');
INSERT INTO public.spells_catalog VALUES
('00000000-0000-0000-0000-000000000101','chill-touch|xphb'),
('00000000-0000-0000-0000-000000000102','ray-of-frost|xphb'),
('00000000-0000-0000-0000-000000000103','unknown|xphb'),
('00000000-0000-0000-0000-000000000104','chill-touch|phb');
INSERT INTO public.character_spells VALUES
('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000101'),
('00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000102'),
('00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000103'),
('00000000-0000-0000-0000-000000000204','00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000104');
-- Direct-call routing checks, preserving all operands including slot and request.
SELECT public.encounter_cast_spell_v9('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000099',0,'00000000-0000-0000-0000-000000000301');
SELECT public.encounter_cast_spell_v9('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000098',1,'00000000-0000-0000-0000-000000000302');
SELECT public.encounter_cast_spell_v8('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000098',2,'00000000-0000-0000-0000-000000000303');
SELECT public.encounter_cast_spell_v9('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000097',NULL,'00000000-0000-0000-0000-000000000304');
SELECT public.encounter_cast_spell_v9('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000204','00000000-0000-0000-0000-000000000096',NULL,'00000000-0000-0000-0000-000000000305');
-- Missing assignment also reaches v7; no authentication/assignment denial occurs in v9/v8 themselves.
SELECT public.encounter_cast_spell_v9('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000299','00000000-0000-0000-0000-000000000095',NULL,'00000000-0000-0000-0000-000000000306');
DO $checks$
BEGIN
 IF (SELECT count(*) FROM public.fixture_routes) <> 6 THEN RAISE EXCEPTION 'route count'; END IF;
 IF (SELECT string_agg(route,',' ORDER BY request) FROM public.fixture_routes) <> 'v11,v11,v11,v7,v7,v7' THEN RAISE EXCEPTION 'wrong delegation route'; END IF;
 IF EXISTS(SELECT 1 FROM public.fixture_routes WHERE request IS NULL OR caster <> '00000000-0000-0000-0000-000000000001'::uuid) THEN RAISE EXCEPTION 'operand altered'; END IF;
 IF (SELECT slot FROM public.fixture_routes WHERE request='00000000-0000-0000-0000-000000000303') <> 2 THEN RAISE EXCEPTION 'slot not forwarded'; END IF;
 RAISE NOTICE 'PASS: 6 direct v8/v9 routing checks; downstream security NOT tested';
END $checks$;
