-- Disposable composition checks only: no nested materializer or signed acquisition.
\set ON_ERROR_STOP on
BEGIN;
DO $test$
DECLARE
 a uuid:=gen_random_uuid(); o uuid:=gen_random_uuid(); s uuid:=gen_random_uuid();
 entry record; role_name text; tab_name text;
BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR NOT EXISTS(SELECT 1 FROM private.p13_levelup_case_guard WHERE scope='disposable')
 THEN RAISE EXCEPTION 'Wrong bridge fixture'; END IF;
 FOR entry IN SELECT * FROM (VALUES
 ('public.complete_character_level_up_v5(uuid,jsonb)','02d74b973a763c53c595be20e35e512f'),
 ('public.complete_character_level_up_v4(uuid,jsonb)','f8338ef170c6e27b972e777eeae406b8'),
 ('public.complete_character_level_up_v3(uuid,jsonb)','4467e166234c67fc12dd73da0e46b379'),
 ('private.complete_character_level_up_base_v3(uuid,jsonb)','e33639d549ef557976a3970ea51f5238'),
 ('private.sync_character_progression_from_sheet_v1()','bb1a3a2d1600ce33cd4fcadac5e0f3a9'),
 ('private.sync_player_forge_class_spell_summary_v1(uuid)','5b1b275a268a57591a2e35a05ce7480d'),
 ('private.can_manage_character_progression_v1(uuid)','ac70e4ec033d86c4e0a254d50d429a45')
 ) AS pins(identity,hash)
 LOOP
  IF md5(pg_get_functiondef(entry.identity::regprocedure)) IS DISTINCT FROM entry.hash THEN RAISE EXCEPTION 'Original level-up fixture drift'; END IF;
 END LOOP;
 RAISE NOTICE 'PASS OF-BRIDGE-01 seven original installed level-up function fingerprints retained';
 IF to_regclass('auth.users') IS NULL OR to_regclass('public.character_sheets') IS NULL
 OR to_regclass('public.character_spells_unique_source_idx') IS NULL
 OR to_regclass('public.character_spells_source_identity_uidx') IS NULL
 THEN RAISE EXCEPTION 'Co-residence or indexes missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='public.character_option_grant_instances'::regclass AND polname='character_option_grant_instances_rpc_only')
 THEN RAISE EXCEPTION 'Original instance policy missing'; END IF;
 FOREACH tab_name IN ARRAY ARRAY['public.character_option_grants','public.character_option_grant_instances'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=tab_name::regclass) THEN RAISE EXCEPTION 'RLS missing'; END IF;
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF has_table_privilege(role_name,tab_name,'SELECT,INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'Unexpected scratch grant privilege'; END IF;
  END LOOP;
 END LOOP;
 RAISE NOTICE 'PASS OF-BRIDGE-02 co-resident Auth and original source indexes, scratch grant ACL/RLS metadata';
 INSERT INTO public.characters(id,name) VALUES(a,'I2J synthetic bridge');
 INSERT INTO public.character_option_catalog(id,name,source,option_type,metadata,option_key,category,raw_payload)
 VALUES(o,'Synthetic Origin','XPHB','feat','{}','synthetic:bridge','O','{}');
 INSERT INTO public.character_option_grants(character_id,option_id) VALUES(a,o);
 INSERT INTO public.character_option_grant_instances(character_id,option_id,option_name,instance_key,acquisition_level,acquisition_owner_type,acquisition_owner_key)
 VALUES(a,o,'Synthetic Origin','bridge-instance',2,'class-option','bridge-slot');
 IF NOT EXISTS(SELECT 1 FROM public.character_option_grant_instances i JOIN public.character_option_grants g USING(character_id,option_id) WHERE i.character_id=a AND i.instance_key='bridge-instance') THEN RAISE EXCEPTION 'Grant co-residence'; END IF;
 INSERT INTO public.spells_catalog(id,name,level,spell_key,slug,source) VALUES(s,'Synthetic Bridge Spell',1,'synthetic:bridge','synthetic-bridge','XPHB');
 INSERT INTO public.character_spells(character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,uses_max,uses_remaining,recharge)
 VALUES(a,s,'feat','bridge-instance','Synthetic Origin',true,true,true,1,1,'long-rest');
 IF NOT EXISTS(SELECT 1 FROM public.character_spells WHERE character_id=a AND source_key='bridge-instance' AND uses_remaining=1)
 THEN RAISE EXCEPTION 'Spell bridge missing'; END IF;
 RAISE NOTICE 'PASS OF-BRIDGE-03 synthetic normalized and presence grants plus spell resource co-resident with P1.3';
END $test$;
ROLLBACK;
DO $clean$
BEGIN
 IF EXISTS(SELECT 1 FROM public.characters) OR EXISTS(SELECT 1 FROM public.character_option_grants) OR EXISTS(SELECT 1 FROM public.character_option_grant_instances) OR EXISTS(SELECT 1 FROM public.character_spells)
 THEN RAISE EXCEPTION 'Synthetic data rollback failed'; END IF;
 IF to_regprocedure('private.apply_source_owned_origin_feat_v1(uuid,integer,uuid,jsonb,text,text,text)') IS NOT NULL THEN RAISE EXCEPTION 'Unexpected materializer in bridge-only test'; END IF;
 RAISE NOTICE 'PASS OF-BRIDGE-04 rollback and explicit absent materializer boundary';
END $clean$;
