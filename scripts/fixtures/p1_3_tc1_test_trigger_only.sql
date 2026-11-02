-- SCRATCH ONLY: illustrates a TC1 gate, NOT a safe universal encounter/character lock order.
-- Runs after other updates may already have locked E/P. Full E/P/L/S/C ordering remains unproven.
CREATE FUNCTION private.tc1_fixture_guard() RETURNS trigger LANGUAGE plpgsql AS $guard$
DECLARE c uuid;
BEGIN
 IF new.status IS DISTINCT FROM 'active' OR old.status='active' THEN RETURN new; END IF;
 FOR c IN SELECT DISTINCT character_id FROM public.encounter_participants
  WHERE encounter_id=new.id AND character_id IS NOT NULL ORDER BY character_id LOOP
  PERFORM 1 FROM public.characters WHERE id=c FOR UPDATE;
  PERFORM pg_sleep(0.20);
 END LOOP;
 IF EXISTS (
  SELECT 1 FROM public.encounter_participants mine
  JOIN public.encounter_participants other_part ON mine.character_id=other_part.character_id
  JOIN public.encounters other_enc ON other_enc.id=other_part.encounter_id
  WHERE mine.encounter_id=new.id AND mine.character_id IS NOT NULL
    AND other_enc.id<>new.id AND other_enc.status='active'
 ) THEN RAISE EXCEPTION 'TC1_CONFLICT' USING ERRCODE='23505'; END IF;
 RETURN new;
END $guard$;
CREATE TRIGGER tc1_fixture_gate BEFORE UPDATE OF status ON public.encounters
FOR EACH ROW EXECUTE FUNCTION private.tc1_fixture_guard();