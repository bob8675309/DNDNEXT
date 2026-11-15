-- C34 T14 Option A compatibility CANDIDATE, deliberately NOT original helper.
-- ORIGINAL source preserved unchanged: 08_i1j_original_khoravar_skill_pg17.sql
-- Original private.set_species_runtime_projection_v1 MD5 7f6e7d7d99ff79db1372462b4320c21b
-- Original source-incompatible operation (removed from this candidate only):
-- UPDATE public.players SET sheet = v_sheet WHERE user_id IN (linked rights).
-- The original Khoravar materializer, trigger, resolver and catalog remain unchanged.
-- PG17 / GoTrue disposable research only; not a deployable SQL migration.
\set ON_ERROR_STOP on
DO $t14safe_pre$
BEGIN
 IF current_database()<>'postgres'
  OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  OR md5(pg_get_functiondef('private.set_species_runtime_projection_v1(uuid,text,jsonb)'::regprocedure))<>'7f6e7d7d99ff79db1372462b4320c21b'
  OR md5(pg_get_functiondef('private.materialize_player_forge_khoravar_skill_versatility_v1()'::regprocedure))<>'9d5fec42e2aefdd39d8a34adf1548460'
  OR to_regclass('public.character_runtime_feature_choices') IS NULL
  OR to_regclass('public.players') IS NULL
  OR to_regclass('public.character_sheets') IS NULL
 THEN RAISE EXCEPTION 'T14 compatibility requires original I1-J exact-source mirror RED baseline'; END IF;
END $t14safe_pre$;

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
  -- T14 Option A compatibility: do NOT mirror the character-scoped runtime
  -- projection to the legacy account-wide players.sheet snapshot.
end;
$function$;

REVOKE ALL ON FUNCTION private.set_species_runtime_projection_v1(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.set_species_runtime_projection_v1(uuid,text,jsonb) TO service_role;
DO $t14safe_post$
DECLARE v_helper text;
BEGIN
 v_helper:=pg_get_functiondef('private.set_species_runtime_projection_v1(uuid,text,jsonb)'::regprocedure);
 IF position('update public.players' in lower(v_helper))>0
 OR md5(v_helper)='7f6e7d7d99ff79db1372462b4320c21b'
 OR md5(pg_get_functiondef('private.materialize_player_forge_khoravar_skill_versatility_v1()'::regprocedure))<>'9d5fec42e2aefdd39d8a34adf1548460'
 OR has_function_privilege('authenticated','private.set_species_runtime_projection_v1(uuid,text,jsonb)','EXECUTE')
 OR has_function_privilege('anon','private.set_species_runtime_projection_v1(uuid,text,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'T14 character-scoped Option A compatibility contract violated'; END IF;
END $t14safe_post$;
\echo 'PASS C34 T14 candidate helper: original Khoravar materializer retained; only cross-account legacy sheet mirroring removed (NOT original helper)'
