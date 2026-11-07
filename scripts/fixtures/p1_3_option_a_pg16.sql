-- DISPOSABLE PG16 MODEL ONLY. Not a production schema or RPC.
CREATE SCHEMA p13_sandbox;
CREATE TABLE p13_sandbox.characters(id int PRIMARY KEY);
CREATE TABLE p13_sandbox.encounters(id int PRIMARY KEY,status text NOT NULL CHECK(status IN ('draft','active','resolved')),revision int NOT NULL DEFAULT 0);
CREATE TABLE p13_sandbox.participants(encounter_id int REFERENCES p13_sandbox.encounters(id),character_id int REFERENCES p13_sandbox.characters(id),PRIMARY KEY(encounter_id,character_id));
CREATE TABLE p13_sandbox.lock_e(id int PRIMARY KEY,revision int NOT NULL DEFAULT 0);
CREATE TABLE p13_sandbox.lock_l(id int PRIMARY KEY,revision int NOT NULL DEFAULT 0);
INSERT INTO p13_sandbox.lock_e VALUES (1,0);
INSERT INTO p13_sandbox.lock_l VALUES (1,0);
INSERT INTO p13_sandbox.characters SELECT generate_series(1,7);
INSERT INTO p13_sandbox.encounters(id,status) VALUES
(101,'draft'),(102,'draft'),(201,'draft'),(202,'draft'),(301,'draft'),(302,'draft'),(401,'active'),(402,'active'),(403,'draft'),(501,'draft');
INSERT INTO p13_sandbox.participants VALUES
(101,1),(102,1),(201,2),(202,3),(301,4),(301,5),(302,5),(302,4),(401,6),(402,6),(403,6),(501,7);
-- A narrow admission MODEL. Character locks first here; not a selected E/P/L/C global order.
CREATE FUNCTION p13_sandbox.activate(p_encounter int,p_delay_ms int DEFAULT 0,p_force_abort boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql AS $func$
DECLARE c int; current_status text;
BEGIN
 IF p_delay_ms<0 OR p_delay_ms>1200 THEN RAISE EXCEPTION 'invalid delay'; END IF;
 FOR c IN SELECT character_id FROM p13_sandbox.participants
   WHERE encounter_id=p_encounter ORDER BY character_id LOOP
  PERFORM 1 FROM p13_sandbox.characters WHERE id=c FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'missing canonical character'; END IF;
 END LOOP;
 IF p_delay_ms>0 THEN PERFORM pg_sleep(p_delay_ms::numeric/1000); END IF;
 SELECT status INTO current_status FROM p13_sandbox.encounters
   WHERE id=p_encounter FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'unknown encounter'; END IF;
 IF current_status='active' THEN RETURN 'ALREADY_ACTIVE'; END IF;
 IF current_status<>'draft' THEN RAISE EXCEPTION 'BAD_LIFECYCLE'; END IF;
 IF EXISTS (
   SELECT 1 FROM p13_sandbox.participants a
   JOIN p13_sandbox.participants b ON a.character_id=b.character_id
   JOIN p13_sandbox.encounters e ON e.id=b.encounter_id
   WHERE a.encounter_id=p_encounter AND b.encounter_id<>p_encounter AND e.status='active'
 ) THEN RAISE EXCEPTION 'TC1_CONFLICT' USING ERRCODE='23505'; END IF;
 UPDATE p13_sandbox.encounters SET status='active',revision=revision+1 WHERE id=p_encounter;
 IF p_force_abort THEN RAISE EXCEPTION 'FIXTURE_ROLLBACK'; END IF;
 RETURN 'ACTIVATED';
END $func$;
