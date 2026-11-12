-- I2-F exact source-original private sourceChoices and species runtime
-- projection helpers from live pg_get_functiondef (SELECT ONLY).
-- AUTHORIZES NO HOSTED SQL WRITE. This file is for isolated PostgreSQL17
-- GoTrue/PostgREST CI only, AFTER inherited I1-B..O + I2C/D/E signed tests.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
  IF current_database()<>'postgres'
     OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
     OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
     OR to_regclass('private.test_admins') IS NULL
     OR md5(pg_get_functiondef('private.create_player_character_v2_source_20261105(jsonb,jsonb)'::regprocedure))<>'00b2167041b9c2e4e1a98d3873839f37'
     OR position('I2E_OPTION_A_NO_LEGACY_SHEET_WRITE' IN pg_get_functiondef('public.update_character_sheet_action_state_v1(uuid,text,text)'::regprocedure))=0
     OR md5(pg_get_functiondef('public.create_player_character_v3(jsonb,jsonb,jsonb)'::regprocedure))<>'ab48d46376075a79b3f5a5de21fdada6'
  THEN RAISE EXCEPTION 'I2-F only in original signed Forge + I2C/D/E disposable PG17'; END IF;
END $guard$;

-- SOURCE-ORIGINAL private.ensure_character_source_choices_v1(p_character_id uuid), MD5 69bedf66148d2ce3dab97baa5de606cc
CREATE OR REPLACE FUNCTION private.ensure_character_source_choices_v1(p_character_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_sheet jsonb:='{}'::jsonb;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets
  where character_id=p_character_id
  for update;
  if not found then raise exception 'Character sheet is unavailable.'; end if;

  if jsonb_typeof(v_sheet->'sourceChoices') is distinct from 'object' then
    v_sheet:=jsonb_set(v_sheet,'{sourceChoices}','{}'::jsonb,true);
    update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
    update public.players p set sheet=v_sheet,updated_at=now()
    where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);
  end if;
end;
$function$
;

-- SOURCE-ORIGINAL private.set_species_runtime_projection_v1(p_character_id uuid, p_projection_key text, p_state jsonb), MD5 7f6e7d7d99ff79db1372462b4320c21b
CREATE OR REPLACE FUNCTION private.set_species_runtime_projection_v1(p_character_id uuid, p_projection_key text, p_state jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_sheet jsonb;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets
  where character_id=p_character_id
  for update;
  if v_sheet is null then return; end if;

  if coalesce(jsonb_typeof(v_sheet->'runtimeProficiencies'),'')<>'object' then
    v_sheet:=jsonb_set(v_sheet,'{runtimeProficiencies}','{}'::jsonb,true);
  end if;

  if p_state is null then
    v_sheet:=v_sheet #- array['runtimeProficiencies',p_projection_key];
  else
    v_sheet:=jsonb_set(v_sheet,array['runtimeProficiencies',p_projection_key],p_state,true);
  end if;

  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now()
  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);
end;
$function$
;

DO $verify$
BEGIN
 IF md5(pg_get_functiondef('private.ensure_character_source_choices_v1(uuid)'::regprocedure))<>'69bedf66148d2ce3dab97baa5de606cc'
 THEN RAISE EXCEPTION 'I2-F original source fingerprint drift: private.ensure_character_source_choices_v1'; END IF;
 IF md5(pg_get_functiondef('private.set_species_runtime_projection_v1(uuid,text,jsonb)'::regprocedure))<>'7f6e7d7d99ff79db1372462b4320c21b'
 THEN RAISE EXCEPTION 'I2-F original source fingerprint drift: private.set_species_runtime_projection_v1'; END IF;
END $verify$;

-- Preserve production-like private helper authority: client authenticated
-- cannot execute these functions directly, even though private USAGE may
-- be available. Invoked only via guarded privileged local fixture tests.
REVOKE ALL ON FUNCTION private.ensure_character_source_choices_v1(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.set_species_runtime_projection_v1(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
DO $acl$
BEGIN
 IF has_function_privilege('authenticated','private.ensure_character_source_choices_v1(uuid)','EXECUTE')
 OR has_function_privilege('authenticated','private.set_species_runtime_projection_v1(uuid,text,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'I2-F private helper direct-client EXECUTE privilege drift'; END IF;
END $acl$;
\echo 'PASS I2F-ORIGINAL: exact two private source and species projection live function MD5s staged in disposable Forge; authenticated EXECUTE denied'
