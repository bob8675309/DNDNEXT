-- C34 T14: ORIGINAL held #358 Khoravar private function bodies and deferred trigger.
-- Source Git blob d84d149b5bc4ef0e62f69a048ab77620f472a94a pinned unchanged.
-- Deliberately first installs the ORIGINAL legacy account-sheet mirroring helper
-- to measure the defect with genuine signed JWT. Follow-up Option A-compatible
-- candidate is a separate explicitly non-original replacement file.
-- DISPOSABLE PostgreSQL 17 / GoTrue / PostgREST ONLY. NOT a production migration.
\set ON_ERROR_STOP on
DO $t14_pre$
DECLARE n integer;
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('public.items_catalog') IS NULL
 OR to_regclass('public.character_option_catalog_preferred') IS NULL
 OR to_regclass('public.character_runtime_feature_choices') IS NULL
 OR md5(pg_get_functiondef('private.normalize_player_choice_name_v1(text)'::regprocedure))<>'dd8cdd5b47efe99b1cfff9c2bf7635dd'
 OR md5(pg_get_functiondef('private.character_has_species_source_v1(uuid,text,text)'::regprocedure))<>'d1264573b17e7569ba75371aa7e912eb'
 OR md5(pg_get_functiondef('private.materialize_player_forge_eladrin_season_v1()'::regprocedure))<>'b866a8dff88bbfe6fb2c4f6d4c102fee'
 OR md5(pg_get_functiondef('private.materialize_player_forge_species_replaceable_cantrip_v1()'::regprocedure))<>'a09198d8e12df12371647fccd8479489'
 OR to_regprocedure('private.set_species_runtime_projection_v1(uuid,text,jsonb)') IS NOT NULL
 OR to_regprocedure('private.materialize_player_forge_khoravar_skill_versatility_v1()') IS NOT NULL
 THEN RAISE EXCEPTION 'C34 T14 requires complete T13 source-original disposable baseline and no prior Khoravar helper'; END IF;
 SELECT count(*) INTO n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O' AND c.relname IN
 ('character_progression','character_sheets','characters','inventory_items');
 IF n<>24 THEN RAISE EXCEPTION 'C34 T14 expected 21 original +3 held triggers, got %',n; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgname IN
 ('trg_force_depart_on_route_assign','trg_guard_locations_for_resting_and_camping'))
 THEN RAISE EXCEPTION 'C34 T14 cannot install protected world-map triggers'; END IF;
END $t14_pre$;

CREATE OR REPLACE FUNCTION private.astral_trance_skill_key_v1(p_name text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
  select case private.normalize_player_choice_name_v1(p_name)
    when 'animalhandling' then 'animalHandling'
    when 'sleightofhand' then 'sleightOfHand'
    when 'acrobatics' then 'acrobatics'
    when 'arcana' then 'arcana'
    when 'athletics' then 'athletics'
    when 'deception' then 'deception'
    when 'history' then 'history'
    when 'insight' then 'insight'
    when 'intimidation' then 'intimidation'
    when 'investigation' then 'investigation'
    when 'medicine' then 'medicine'
    when 'nature' then 'nature'
    when 'perception' then 'perception'
    when 'performance' then 'performance'
    when 'persuasion' then 'persuasion'
    when 'religion' then 'religion'
    when 'stealth' then 'stealth'
    when 'survival' then 'survival'
    else null
  end;
$function$;

CREATE OR REPLACE FUNCTION private.astral_trance_skill_options_v1()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'key',private.astral_trance_skill_key_v1(c.name),
    'name',c.name,
    'ability',coalesce(c.metadata->>'ability',''),
    'catalogSource',c.source
  ) order by c.name),'[]'::jsonb)
  from public.character_option_catalog_preferred c
  where c.option_type='skill'
    and private.astral_trance_skill_key_v1(c.name) is not null;
$function$;

CREATE OR REPLACE FUNCTION private.khoravar_skill_versatility_options_v1()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
with skill_options as (
  select jsonb_build_object(
    'key','skill:'||(s->>'key'),
    'value','skill:'||(s->>'key'),
    'label',s->>'name',
    'name',s->>'name',
    'kind','skill',
    'source','D&D',
    'metadata',jsonb_build_object('kind','skill','skillKey',s->>'key','name',s->>'name')
  ) as option
  from jsonb_array_elements(private.astral_trance_skill_options_v1()) s
), tool_rows as (
  select distinct on (lower(regexp_replace(i.item_name,'[^a-zA-Z0-9]+','','g')))
    i.*
  from public.items_catalog i
  where lower(coalesce(i.item_rarity,''))='mundane'
    and (
      upper(coalesce(i.payload->>'type','')) in ('AT','GS','INS','T')
      or lower(coalesce(i.item_type,'')) like '%tool%'
      or lower(coalesce(i.item_type,'')) like '%instrument%'
      or lower(coalesce(i.item_type,'')) like '%gaming%'
    )
  order by lower(regexp_replace(i.item_name,'[^a-zA-Z0-9]+','','g')),
           case upper(coalesce(i.payload->>'source','')) when 'XPHB' then 0 when 'PHB' then 1 else 2 end,
           i.item_name
), tool_options as (
  select jsonb_build_object(
    'key','tool:'||id::text,
    'value','tool:'||id::text,
    'label',item_name,
    'name',item_name,
    'kind','tool',
    'source',coalesce(payload->>'source','Campaign'),
    'metadata',jsonb_build_object('kind','tool','itemId',id,'itemKey',item_key,'name',item_name,'source',coalesce(payload->>'source','Campaign'))
  ) as option
  from tool_rows
)
select coalesce(jsonb_agg(option order by option->>'label',option->>'kind'),'[]'::jsonb)
from (
  select option from skill_options
  union all
  select option from tool_options
) q;
$function$;

CREATE OR REPLACE FUNCTION private.resolve_khoravar_skill_versatility_v1(p_key text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  select value
  from jsonb_array_elements(private.khoravar_skill_versatility_options_v1())
  where value->>'key'=p_key
  limit 1;
$function$;

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
$function$;

CREATE OR REPLACE FUNCTION private.materialize_player_forge_khoravar_skill_versatility_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_sheet jsonb;
  v_selection jsonb;
  v_key text;
  v_option jsonb;
  v_state jsonb;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=new.character_id;
  if coalesce(v_sheet #>> '{meta,creator}','')<>'shared_character_forge_player_v2' then return new; end if;
  if not private.character_has_species_source_v1(new.character_id,'Khoravar','EFA') then return new; end if;
  v_selection:=v_sheet #> '{sourceChoices,species-runtime-khoravar-skill-versatility,fields,proficiency,selections}';
  if jsonb_typeof(v_selection)<>'array' or jsonb_array_length(v_selection)<>1 then raise exception 'Khoravar Skill Versatility requires exactly one skill or tool proficiency.'; end if;
  v_key:=v_selection->0->>'key';
  v_option:=private.resolve_khoravar_skill_versatility_v1(v_key);
  if v_option is null then raise exception 'Khoravar Skill Versatility references an invalid skill or tool.'; end if;
  v_state:=jsonb_build_object('proficiency',v_option,'configuredAt',now(),'configuredRestAt',null);
  insert into public.character_runtime_feature_choices(character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,updated_at)
  values(new.character_id,'khoravar-skill-versatility','Skill Versatility','EFA','long_rest',v_state,now(),now())
  on conflict(character_id,feature_key) do update set state=excluded.state,replacement_anchor_at=excluded.replacement_anchor_at,updated_at=now();
  perform private.set_species_runtime_projection_v1(new.character_id,'khoravarSkillVersatility',v_state);
  return new;
end;
$function$;

CREATE CONSTRAINT TRIGGER character_progression_materialize_player_forge_khoravar_skill_v
 AFTER INSERT ON public.character_progression
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 EXECUTE FUNCTION private.materialize_player_forge_khoravar_skill_versatility_v1();
REVOKE ALL ON FUNCTION
 private.normalize_player_choice_name_v1(text),
 private.astral_trance_skill_key_v1(text),
 private.astral_trance_skill_options_v1(),
 private.khoravar_skill_versatility_options_v1(),
 private.resolve_khoravar_skill_versatility_v1(text),
 private.set_species_runtime_projection_v1(uuid,text,jsonb),
 private.materialize_player_forge_khoravar_skill_versatility_v1()
 FROM PUBLIC,anon,authenticated;
DO $i1j_checks$
DECLARE v_trigger text;
BEGIN
 IF md5(pg_get_functiondef('private.normalize_player_choice_name_v1(text)'::regprocedure)) <> 'dd8cdd5b47efe99b1cfff9c2bf7635dd'
 THEN RAISE EXCEPTION 'I1-J original source hash drift for private.normalize_player_choice_name_v1(text)'; END IF;
 IF md5(pg_get_functiondef('private.astral_trance_skill_key_v1(text)'::regprocedure)) <> '68dcc3383c6727020331b9391ec8dde4'
 THEN RAISE EXCEPTION 'I1-J original source hash drift for private.astral_trance_skill_key_v1(text)'; END IF;
 IF md5(pg_get_functiondef('private.astral_trance_skill_options_v1()'::regprocedure)) <> '08962b553e01fa0c2119b988d33518be'
 THEN RAISE EXCEPTION 'I1-J original source hash drift for private.astral_trance_skill_options_v1()'; END IF;
 IF md5(pg_get_functiondef('private.khoravar_skill_versatility_options_v1()'::regprocedure)) <> 'afc3acbe1313d166105794a4be0ebd41'
 THEN RAISE EXCEPTION 'I1-J original source hash drift for private.khoravar_skill_versatility_options_v1()'; END IF;
 IF md5(pg_get_functiondef('private.resolve_khoravar_skill_versatility_v1(text)'::regprocedure)) <> '1d4240ad22fd1c3d017cc8205518bfc9'
 THEN RAISE EXCEPTION 'I1-J original source hash drift for private.resolve_khoravar_skill_versatility_v1(text)'; END IF;
 IF md5(pg_get_functiondef('private.set_species_runtime_projection_v1(uuid,text,jsonb)'::regprocedure)) <> '7f6e7d7d99ff79db1372462b4320c21b'
 THEN RAISE EXCEPTION 'I1-J original source hash drift for private.set_species_runtime_projection_v1(uuid,text,jsonb)'; END IF;
 IF md5(pg_get_functiondef('private.materialize_player_forge_khoravar_skill_versatility_v1()'::regprocedure)) <> '9d5fec42e2aefdd39d8a34adf1548460'
 THEN RAISE EXCEPTION 'I1-J original source hash drift for private.materialize_player_forge_khoravar_skill_versatility_v1()'; END IF;
 SELECT pg_get_triggerdef(oid,true) INTO v_trigger FROM pg_trigger
 WHERE tgrelid='public.character_progression'::regclass
 AND tgname='character_progression_materialize_player_forge_khoravar_skill_v'
 AND NOT tgisinternal AND tgenabled='O' AND tgdeferrable AND tginitdeferred;
 IF v_trigger IS NULL OR v_trigger NOT LIKE '%AFTER INSERT ON%'
 OR v_trigger NOT LIKE '%DEFERRABLE INITIALLY DEFERRED%'
 OR v_trigger NOT LIKE '%private.materialize_player_forge_khoravar_skill_versatility_v1()%'
 OR (SELECT count(*) FROM jsonb_array_elements(private.khoravar_skill_versatility_options_v1())) <> 4
 OR (SELECT count(*) FROM pg_attribute WHERE attrelid='public.character_option_catalog_preferred'::regclass AND attname='metadata' AND NOT attisdropped) <> 1
 THEN RAISE EXCEPTION 'I1-J source exact trigger/options catalog boundary drift'; END IF;
END $i1j_checks$;
NOTIFY pgrst,'reload schema';

DO $t14_after$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O' AND c.relname IN
 ('character_progression','character_sheets','characters','inventory_items');
 IF n<>25 THEN RAISE EXCEPTION 'C34 T14 expected 22 original +3 held trigger definitions, got %',n; END IF;
 IF to_regprocedure('public.configure_character_khoravar_skill_versatility_v1(uuid,text)') IS NOT NULL
 THEN RAISE EXCEPTION 'C34 T14 must not install after-Long-Rest Khoravar RPC'; END IF;
END $t14_after$;
\echo 'PASS C34-T14 original I1-J Khoravar source seven functions/trigger: 22/31 present, original legacy mirror still ON for RED'
