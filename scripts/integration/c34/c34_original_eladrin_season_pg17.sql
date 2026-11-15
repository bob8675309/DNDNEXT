-- C34 T13: original MPMM Eladrin season initial materializer, sourced from
-- held I1-I PR #357, source Git blob 323ef20258d8b3a7c7bc96e0b1d279ba755fcce5.
-- ONLY disposable PG17/GoTrue test after T12; never apply to production.
-- The ORIGINAL four private pg_get_functiondef bodies and deferred trigger below are unchanged.
-- Original species-source helper is already present and hash-pinned from T12.
\set ON_ERROR_STOP on
DO $t13_pre$
DECLARE n integer;
BEGIN
 IF current_database()<>'postgres'
  OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  OR to_regclass('auth.users') IS NULL
  OR to_regclass('public.character_runtime_feature_choices') IS NULL
  OR to_regclass('public.character_sheets') IS NULL
  OR to_regclass('public.character_progression') IS NULL
  OR to_regprocedure('private.materialize_player_forge_species_replaceable_cantrip_v1()') IS NULL
  OR md5(pg_get_functiondef('private.materialize_player_forge_species_replaceable_cantrip_v1()'::regprocedure))<>'a09198d8e12df12371647fccd8479489'
  OR md5(pg_get_functiondef('private.character_has_species_source_v1(uuid,text,text)'::regprocedure))<>'d1264573b17e7569ba75371aa7e912eb'
  OR to_regprocedure('private.materialize_player_forge_eladrin_season_v1()') IS NOT NULL
  OR EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgname='character_progression_materialize_eladrin_season_v1')
 THEN RAISE EXCEPTION 'C34 T13 requires source-original T12 and absent Eladrin materializer in disposable PG17'; END IF;
 SELECT count(*) INTO n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O' AND c.relname IN
 ('character_progression','character_sheets','characters','inventory_items');
 IF n<>23 THEN RAISE EXCEPTION 'C34 T13 expected 20/31 original +3 held prior triggers, got %',n; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgname IN
 ('trg_force_depart_on_route_assign','trg_guard_locations_for_resting_and_camping'))
 THEN RAISE EXCEPTION 'C34 T13 protected world-map trigger exclusion breached'; END IF;
END $t13_pre$;

CREATE OR REPLACE FUNCTION private.eladrin_season_options_v1()
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  select jsonb_build_array(
    jsonb_build_object('key','autumn','label','Autumn','effect','After Fey Step at level 3+, nearby creatures can become Charmed.'),
    jsonb_build_object('key','winter','label','Winter','effect','Before Fey Step at level 3+, a nearby creature can become Frightened.'),
    jsonb_build_object('key','spring','label','Spring','effect','At level 3+, Fey Step can teleport a willing nearby creature instead of you.'),
    jsonb_build_object('key','summer','label','Summer','effect','After Fey Step at level 3+, nearby creatures of your choice take Fire damage equal to your Proficiency Bonus.')
  );
$function$;

CREATE OR REPLACE FUNCTION private.resolve_eladrin_season_v1(p_key text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  select value
  from jsonb_array_elements(private.eladrin_season_options_v1())
  where value->>'key'=lower(coalesce(p_key,''))
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION private.set_eladrin_season_projection_v1(p_character_id uuid, p_state jsonb)
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
  if not found then return; end if;
  if coalesce(jsonb_typeof(v_sheet->'runtimeFeatures'),'')<>'object' then
    v_sheet:=jsonb_set(v_sheet,'{runtimeFeatures}','{}'::jsonb,true);
  end if;
  if p_state is null then
    v_sheet:=v_sheet #- array['runtimeFeatures','eladrinSeason'];
  else
    v_sheet:=jsonb_set(v_sheet,'{runtimeFeatures,eladrinSeason}',p_state,true);
  end if;
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.materialize_player_forge_eladrin_season_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_sheet jsonb:='{}'::jsonb;
  v_selection jsonb;
  v_key text;
  v_option jsonb;
  v_state jsonb;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets where character_id=new.character_id;
  if coalesce(v_sheet #>> '{meta,creator}','')<>'shared_character_forge_player_v2' then return new; end if;
  if not private.character_has_species_source_v1(new.character_id,'Eladrin','MPMM') then return new; end if;

  v_selection:=v_sheet #> '{sourceChoices,species-runtime-eladrin-season,fields,season,selections}';
  if jsonb_typeof(v_selection)<>'array' or jsonb_array_length(v_selection)<>1 then
    raise exception 'Eladrin requires exactly one current season during Player Forge creation.';
  end if;
  v_key:=lower(coalesce(v_selection->0->>'key',v_selection->0->>'value',''));
  v_option:=private.resolve_eladrin_season_v1(v_key);
  if v_option is null then raise exception 'Eladrin Player Forge references an invalid season.'; end if;

  v_state:=jsonb_build_object(
    'configured',true,
    'season',v_option,
    'configuredAt',timezone('utc',now()),
    'configuredRestAt',null,
    'initial',true
  );

  insert into public.character_runtime_feature_choices(
    character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at
  ) values(
    new.character_id,'eladrin-season','Eladrin Season','MPMM','long_rest',v_state,timezone('utc',now()),now(),now()
  ) on conflict(character_id,feature_key) do update set
    feature_name=excluded.feature_name,
    source=excluded.source,
    cadence=excluded.cadence,
    state=excluded.state,
    replacement_anchor_at=excluded.replacement_anchor_at,
    updated_at=now();

  perform private.set_eladrin_season_projection_v1(new.character_id,v_state);
  return new;
end;
$function$;

CREATE CONSTRAINT TRIGGER character_progression_materialize_eladrin_season_v1
 AFTER INSERT ON public.character_progression
 DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION private.materialize_player_forge_eladrin_season_v1();
REVOKE ALL ON FUNCTION
 private.character_has_species_source_v1(uuid,text,text),
 private.eladrin_season_options_v1(),
 private.resolve_eladrin_season_v1(text),
 private.set_eladrin_season_projection_v1(uuid,jsonb),
 private.materialize_player_forge_eladrin_season_v1()
 FROM PUBLIC, anon, authenticated;
DO $i1i_guard$
DECLARE v_sql text;
BEGIN
 IF md5(pg_get_functiondef('private.character_has_species_source_v1(uuid,text,text)'::regprocedure)) <> 'd1264573b17e7569ba75371aa7e912eb'
 THEN RAISE EXCEPTION 'I1-I source function drift: private.character_has_species_source_v1(uuid,text,text)'; END IF;
 IF md5(pg_get_functiondef('private.eladrin_season_options_v1()'::regprocedure)) <> 'a142c557fa028eb1b7a087c7802a7afb'
 THEN RAISE EXCEPTION 'I1-I source function drift: private.eladrin_season_options_v1()'; END IF;
 IF md5(pg_get_functiondef('private.resolve_eladrin_season_v1(text)'::regprocedure)) <> '5f351b120410855845d72586dc66c62b'
 THEN RAISE EXCEPTION 'I1-I source function drift: private.resolve_eladrin_season_v1(text)'; END IF;
 IF md5(pg_get_functiondef('private.set_eladrin_season_projection_v1(uuid,jsonb)'::regprocedure)) <> 'eb1da99fed6f0785266eb061ce8bad39'
 THEN RAISE EXCEPTION 'I1-I source function drift: private.set_eladrin_season_projection_v1(uuid,jsonb)'; END IF;
 IF md5(pg_get_functiondef('private.materialize_player_forge_eladrin_season_v1()'::regprocedure)) <> 'b866a8dff88bbfe6fb2c4f6d4c102fee'
 THEN RAISE EXCEPTION 'I1-I source function drift: private.materialize_player_forge_eladrin_season_v1()'; END IF;
 SELECT pg_get_triggerdef(oid,true) INTO v_sql FROM pg_trigger
 WHERE tgrelid='public.character_progression'::regclass
 AND tgname='character_progression_materialize_eladrin_season_v1'
 AND NOT tgisinternal AND tgenabled='O' AND tgdeferrable AND tginitdeferred;
 IF v_sql IS NULL OR v_sql NOT LIKE '%AFTER INSERT ON%'
 OR v_sql NOT LIKE '%DEFERRABLE INITIALLY DEFERRED%'
 OR v_sql NOT LIKE '%private.materialize_player_forge_eladrin_season_v1()%'
 OR jsonb_array_length(private.eladrin_season_options_v1())<>4
 OR (SELECT count(*) FROM pg_constraint WHERE conrelid='public.character_runtime_feature_choices'::regclass AND contype='c' AND convalidated AND conname IN ('character_runtime_feature_choices_cadence_chk','character_runtime_feature_choices_state_object_chk'))<>2
 THEN RAISE EXCEPTION 'I1-I original source trigger/options drift'; END IF;
END $i1i_guard$;
NOTIFY pgrst,'reload schema';

DO $t13_after$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O' AND c.relname IN
 ('character_progression','character_sheets','characters','inventory_items');
 IF n<>24 THEN RAISE EXCEPTION 'C34 T13 expected 21/31 original +3 held, got %',n; END IF;
 IF to_regprocedure('public.configure_character_eladrin_season_v1(uuid,text)') IS NOT NULL
 THEN RAISE EXCEPTION 'C34 T13 must not import held after-Long-Rest replacement RPC'; END IF;
END $t13_after$;
\echo 'PASS C34 T13 source-identical MPMM Eladrin first-season helper and 21/31 original deferred DDL (disposable only)'
