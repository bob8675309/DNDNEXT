-- Disposable schema contract only: no materializer, signed Auth, private source or gameplay.
\set ON_ERROR_STOP on
BEGIN;
DO $guard$
BEGIN
 IF current_database()<>'i2j_origin_feat_fixture'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('public.character_option_grant_instances') IS NULL
 THEN RAISE EXCEPTION 'Wrong I2J schema fixture'; END IF;
END $guard$;
DO $test$
DECLARE
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); u uuid:=gen_random_uuid();
 o uuid:=gen_random_uuid(); s uuid:=gen_random_uuid();
BEGIN
 INSERT INTO auth.users(id) VALUES(u);
 INSERT INTO public.characters(id) VALUES(a),(b);
 INSERT INTO public.character_option_catalog(id,option_key,option_type,name,source,category,metadata)
 VALUES(o,'synthetic:repeatable-origin','feat','Synthetic Origin','XPHB','O','{"repeatable":true}');
 INSERT INTO public.spells_catalog(id,spell_key,slug,name,source,level)
 VALUES(s,'synthetic:spell','synthetic-spell','Synthetic Spell','XPHB',1);

 INSERT INTO public.character_option_grants(character_id,option_id,granted_by) VALUES(a,o,u);
 INSERT INTO public.character_option_grants(character_id,option_id,granted_by) VALUES(b,o,u);
 BEGIN
  INSERT INTO public.character_option_grants(character_id,option_id) VALUES(a,o);
  RAISE EXCEPTION 'Expected legacy presence uniqueness';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 IF (SELECT count(*) FROM public.character_option_grants)<>2 THEN RAISE EXCEPTION 'Presence grant count'; END IF;
 RAISE NOTICE 'PASS OF-SCHEMA-01 legacy presence unique per character and option';

 INSERT INTO public.character_option_grant_instances(character_id,option_id,option_key,option_type,option_name,option_source,instance_key,acquisition_level,acquisition_owner_type,acquisition_owner_key,choices,repeatable,granted_by)
 VALUES(a,o,'synthetic:repeatable-origin','feat','Synthetic Origin','XPHB','instance-a',2,'class-option','slot-2','{}',true,u),
       (a,o,'synthetic:repeatable-origin','feat','Synthetic Origin','XPHB','instance-b',2,'class-option','slot-3','{}',true,u),
       (b,o,'synthetic:repeatable-origin','feat','Synthetic Origin','XPHB','instance-a',2,'class-option','slot-2','{}',true,u);
 IF (SELECT count(*) FROM public.character_option_grant_instances WHERE character_id=a)<>2
 OR (SELECT count(*) FROM public.character_option_grant_instances WHERE character_id=b)<>1
 THEN RAISE EXCEPTION 'Instance isolation'; END IF;
 RAISE NOTICE 'PASS OF-SCHEMA-02 repeated feat instances and independent character identity';

 BEGIN
  INSERT INTO public.character_option_grant_instances(character_id,option_id,option_name,instance_key) VALUES(a,o,'Synthetic Origin','instance-a');
  RAISE EXCEPTION 'Expected duplicate instance rejection';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 BEGIN
  INSERT INTO public.character_option_grant_instances(character_id,option_id,option_name,instance_key,choices) VALUES(a,o,'Synthetic Origin','bad-choices','[]');
  RAISE EXCEPTION 'Expected choices object rejection';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 BEGIN
  INSERT INTO public.character_option_grant_instances(character_id,option_id,option_name,instance_key,acquisition_level) VALUES(a,o,'Synthetic Origin','bad-level',0);
  RAISE EXCEPTION 'Expected level range rejection';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 RAISE NOTICE 'PASS OF-SCHEMA-03 duplicate identity, choice shape, level range';

 INSERT INTO public.character_spells(character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,uses_max,uses_remaining,recharge,casting_stat)
 VALUES(a,s,'class','warlock','Warlock',true,true,false,NULL,NULL,NULL,'cha'),
       (a,s,'feat','instance-a','Synthetic Origin',true,true,true,1,1,'long-rest','wis'),
       (b,s,'feat','instance-a','Synthetic Origin',true,true,true,1,1,'long-rest','wis');
 IF (SELECT count(*) FROM public.character_spells WHERE character_id=a AND source_type='feat' AND source_key='instance-a' AND uses_remaining=1 AND uses_max=1 AND recharge='long-rest')<>1
 OR (SELECT count(*) FROM public.character_spells WHERE character_id=a AND source_type='class')<>1
 THEN RAISE EXCEPTION 'Spell resource or source identity mismatch'; END IF;
 RAISE NOTICE 'PASS OF-SCHEMA-04 distinct class and feat spell sources and resource metadata';

 BEGIN
  INSERT INTO public.character_spells(character_id,spell_id,source_type,source_key,source_label)
  VALUES(a,s,'feat','instance-a','Different Label');
  RAISE EXCEPTION 'Expected duplicate canonical spell source rejection';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 -- Preserve both original indexes, and explicitly characterize their overlap.
 -- The historical label index constrains two distinct instance keys with the same label.
 BEGIN
  INSERT INTO public.character_spells(character_id,spell_id,source_type,source_key,source_label)
  VALUES(a,s,'feat','instance-b','Synthetic Origin');
  RAISE EXCEPTION 'Expected existing source-label uniqueness';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 IF (SELECT count(*) FROM public.character_spells)<>3 THEN RAISE EXCEPTION 'Unexpected spell mutation'; END IF;
 RAISE NOTICE 'PASS OF-SCHEMA-05 both existing source-key and source-label uniqueness; overlap remains HOLD';

 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.character_option_grants'::regclass)
 OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.character_option_grant_instances'::regclass)
 THEN RAISE EXCEPTION 'RLS staging flag missing'; END IF;
 BEGIN
  DELETE FROM public.character_option_catalog WHERE id=o;
  RAISE EXCEPTION 'Expected instance FK restrict';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 IF (SELECT count(*) FROM public.character_option_grants)<>2
 OR (SELECT count(*) FROM public.character_option_grant_instances)<>3 THEN RAISE EXCEPTION 'FK rollback mismatch'; END IF;
 RAISE NOTICE 'PASS OF-SCHEMA-06 FK rollback and staged RLS flags only';
END $test$;
ROLLBACK;
DO $clean$
BEGIN
 IF EXISTS(SELECT 1 FROM public.characters)
 OR EXISTS(SELECT 1 FROM public.character_option_grants)
 OR EXISTS(SELECT 1 FROM public.character_option_grant_instances)
 OR EXISTS(SELECT 1 FROM public.character_spells)
 THEN RAISE EXCEPTION 'Synthetic transaction did not roll back'; END IF;
 RAISE NOTICE 'PASS OF-SCHEMA-07 scratch synthetic rows rolled back';
END $clean$;
