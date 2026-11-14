-- C34-T12 ORIGINAL migration 67 canonical High Elf/Khoravar fixed initial cantrip.
-- Source original git blob 3116cb96d9d812d4540ff8210c24e0a0af0cbd30; complete five original source
-- functions captured read-only from live PG17; no code alterations.
-- Disposable C34 local signed PG17/GoTrue ONLY, not a production migration.
\set ON_ERROR_STOP on
DO $t12_before$
DECLARE n integer;
BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  OR to_regclass('auth.users') IS NULL
  OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
  OR to_regclass('public.character_sheets') IS NULL
  OR to_regclass('public.character_spells') IS NULL
  OR to_regclass('public.character_runtime_feature_choices') IS NOT NULL
  OR to_regclass('public.spells_catalog_preferred') IS NOT NULL
  OR to_regprocedure('private.materialize_player_forge_species_replaceable_cantrip_v1()') IS NOT NULL
  OR md5(pg_get_functiondef('private.materialize_player_forge_source_magic_v1()'::regprocedure)) <> '4c35eaab8dff7d3d15b64ed71881d4a6'
  OR EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgname='character_progression_materialize_species_cantrip_v1')
 THEN RAISE EXCEPTION 'C34 T12 only after source-original signed T11, and no previous runtime choice fixture'; END IF;
 SELECT count(*) INTO n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O' AND c.relname IN
 ('character_progression','character_sheets','characters','inventory_items');
 IF n<>22 THEN RAISE EXCEPTION 'C34 T12 expects 19 original plus 3 held triggers, got %',n; END IF;
 IF EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgname IN
 ('trg_force_depart_on_route_assign','trg_guard_locations_for_resting_and_camping'))
 THEN RAISE EXCEPTION 'C34 T12 world-map trigger exclusion breached'; END IF;
END $t12_before$;

-- Exactly the original runtime-choice table definition, index, CHECKs and
-- RLS/ACL restrictions, from source migration 44 (live source Git blob 0d9ec7d003eca7589cce2f77f09f71432f7d8961).
create table if not exists public.character_runtime_feature_choices (
  character_id uuid not null references public.characters(id) on delete cascade,
  feature_key text not null,
  feature_name text not null,
  source text not null default 'CAMPAIGN',
  cadence text not null,
  state jsonb not null default '{}'::jsonb,
  replacement_anchor_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(character_id,feature_key),
  constraint character_runtime_feature_choices_cadence_chk
    check(cadence in ('long_rest','short_rest','per_use','informational')),
  constraint character_runtime_feature_choices_state_object_chk
    check(jsonb_typeof(state)='object')
);

create index if not exists character_runtime_feature_choices_feature_idx
  on public.character_runtime_feature_choices(feature_key,character_id);

alter table public.character_runtime_feature_choices enable row level security;
revoke all on table public.character_runtime_feature_choices from public,anon,authenticated;

-- Reduced TEST-ONLY preferred spell view: live view has 47 source columns.
-- No attempt to call this projection complete production catalog parity.
CREATE VIEW public.spells_catalog_preferred AS
 SELECT s.* FROM public.spells_catalog s WHERE public.is_preferred_spell_version_v1(s.id);
REVOKE ALL ON TABLE public.spells_catalog_preferred FROM PUBLIC, anon;

-- Entire unmodified function bodies from live read-only pg_get_functiondef.
-- ORIGINAL private.character_has_species_source_v1  PG17 function MD5 d1264573b17e7569ba75371aa7e912eb
CREATE OR REPLACE FUNCTION private.character_has_species_source_v1(p_character_id uuid, p_species_name text, p_species_source text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  select exists(
    select 1
    from public.character_sheets cs
    where cs.character_id=p_character_id
      and lower(regexp_replace(coalesce(cs.sheet->>'species',cs.sheet->>'race',cs.sheet #>> '{meta,species}',''),'[^a-zA-Z0-9]+','','g'))
          =lower(regexp_replace(coalesce(p_species_name,''),'[^a-zA-Z0-9]+','','g'))
      and upper(coalesce(cs.sheet #>> '{meta,speciesSource}',cs.sheet->>'speciesSource',''))=upper(coalesce(p_species_source,''))
  );
$function$;

-- ORIGINAL private.materialize_player_forge_species_replaceable_cantrip_v1  PG17 function MD5 a09198d8e12df12371647fccd8479489
CREATE OR REPLACE FUNCTION private.materialize_player_forge_species_replaceable_cantrip_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_sheet jsonb:='{}'::jsonb;
  v_feature jsonb;
  v_spell public.spells_catalog%rowtype;
  v_feature_key text;
  v_feature_name text;
  v_source text;
  v_initial_name text;
  v_casting_stat text;
  v_state jsonb;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets where character_id=new.character_id;
  if coalesce(v_sheet #>> '{meta,creator}','')<>'shared_character_forge_player_v2' then return new; end if;

  v_feature:=private.species_replaceable_cantrip_feature_v1(new.character_id);
  if not coalesce((v_feature->>'available')::boolean,false) then return new; end if;

  v_feature_key:=v_feature->>'featureKey';
  v_feature_name:=v_feature->>'featureName';
  v_source:=v_feature->>'source';
  v_initial_name:=v_feature->>'initialCantripName';
  v_casting_stat:=lower(coalesce(v_feature->>'castingStat',''));
  if v_casting_stat not in ('int','wis','cha') then
    raise exception '% requires a permanent Intelligence, Wisdom, or Charisma spellcasting-ability choice.',v_feature_name;
  end if;

  select s.* into v_spell
  from public.spells_catalog_preferred s
  where lower(s.name)=lower(v_initial_name) and s.level=0
  limit 1;
  if not found or not exists(
    select 1 from jsonb_array_elements(private.species_replaceable_cantrip_options_v1(v_feature_key)) option
    where option->>'spellId'=v_spell.id::text
  ) then
    raise exception 'Could not resolve the source-fixed initial cantrip % for %.',v_initial_name,v_feature_name;
  end if;

  v_state:=jsonb_build_object(
    'configured',true,
    'featureKey',v_feature_key,
    'featureName',v_feature_name,
    'source',v_source,
    'spellId',v_spell.id,
    'cantripName',v_spell.name,
    'castingStat',v_casting_stat,
    'initial',true,
    'configuredAt',timezone('utc',now()),
    'configuredRestAt',null
  );

  delete from public.character_spells
  where character_id=new.character_id
    and source_type='species'
    and source_key=v_feature_key;

  insert into public.character_spells(
    character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,
    uses_max,uses_remaining,recharge,casting_stat,raw_payload,created_at,updated_at
  ) values(
    new.character_id,v_spell.id,'species',v_feature_key,v_feature_name,true,true,true,
    null,null,null,v_casting_stat,jsonb_build_object(
      'creator','shared_character_forge_player_v3',
      'runtimeFeatureKey',v_feature_key,
      'runtimeFeatureName',v_feature_name,
      'speciesReplaceableCantrip',true,
      'sourceTrait',v_feature_name,
      'catalogSource',v_spell.source,
      'initial',true
    ),now(),now()
  );

  insert into public.character_runtime_feature_choices(
    character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at
  ) values(
    new.character_id,v_feature_key,v_feature_name,v_source,'long_rest',v_state,timezone('utc',now()),now(),now()
  ) on conflict(character_id,feature_key) do update set
    feature_name=excluded.feature_name,
    source=excluded.source,
    cadence=excluded.cadence,
    state=excluded.state,
    replacement_anchor_at=excluded.replacement_anchor_at,
    updated_at=now();

  perform private.set_species_replaceable_cantrip_projection_v1(new.character_id,v_state);
  return new;
end;
$function$;

-- ORIGINAL private.set_species_replaceable_cantrip_projection_v1  PG17 function MD5 7af5408f062f786aa633254a0d5d6365
CREATE OR REPLACE FUNCTION private.set_species_replaceable_cantrip_projection_v1(p_character_id uuid, p_state jsonb)
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
    v_sheet:=v_sheet #- array['runtimeFeatures','speciesReplaceableCantrip'];
  else
    v_sheet:=jsonb_set(v_sheet,'{runtimeFeatures,speciesReplaceableCantrip}',p_state,true);
  end if;
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
end;
$function$;

-- ORIGINAL private.species_replaceable_cantrip_feature_v1  PG17 function MD5 560088a5e3ad85866b6aa9b10ccfd2db
CREATE OR REPLACE FUNCTION private.species_replaceable_cantrip_feature_v1(p_character_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_sheet jsonb:='{}'::jsonb;
  v_group jsonb;
  v_casting_stat text;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets where character_id=p_character_id;
  if not found then return jsonb_build_object('available',false); end if;

  if private.character_has_species_source_v1(p_character_id,'Khoravar','EFA') then
    select entry.value into v_group
    from jsonb_each(coalesce(v_sheet->'sourceChoices','{}'::jsonb)) entry
    where coalesce(entry.value->>'ownerType','')='species'
      and upper(coalesce(entry.value->>'source',''))='EFA'
      and private.normalize_player_choice_name_v1(entry.value->>'label')='feygift'
    limit 1;
    v_casting_stat:=lower(coalesce(v_group #>> '{fields,feature-ability,selections,0,value}',''));
    return jsonb_build_object(
      'available',true,
      'featureKey','khoravar-fey-gift-cantrip',
      'featureName','Fey Gift',
      'source','EFA',
      'speciesName','Khoravar',
      'initialCantripName','Friends',
      'castingStat',v_casting_stat,
      'listClasses',jsonb_build_array('Cleric','Druid','Wizard')
    );
  end if;

  if private.character_has_species_source_v1(p_character_id,'Elf','XPHB') then
    select entry.value into v_group
    from jsonb_each(coalesce(v_sheet->'sourceChoices','{}'::jsonb)) entry
    where coalesce(entry.value->>'ownerType','')='species'
      and upper(coalesce(entry.value->>'source',''))='XPHB'
      and private.normalize_player_choice_name_v1(entry.value->>'label')='elvenlineage'
      and exists(
        select 1
        from jsonb_array_elements(coalesce(entry.value #> '{fields,lineage,selections}','[]'::jsonb)) selected
        where private.normalize_player_choice_name_v1(coalesce(selected->>'label',selected->>'value',selected->>'key'))='highelf'
      )
    limit 1;
    if v_group is null then return jsonb_build_object('available',false); end if;
    v_casting_stat:=lower(coalesce(v_group #>> '{fields,spellcasting-ability,selections,0,value}',''));
    return jsonb_build_object(
      'available',true,
      'featureKey','high-elf-lineage-cantrip',
      'featureName','Elven Lineage — High Elf',
      'source','XPHB',
      'speciesName','Elf',
      'initialCantripName','Prestidigitation',
      'castingStat',v_casting_stat,
      'listClasses',jsonb_build_array('Wizard')
    );
  end if;

  return jsonb_build_object('available',false);
end;
$function$;

-- ORIGINAL private.species_replaceable_cantrip_options_v1  PG17 function MD5 f8bf8cdf45cf57953dca333e5f856a84
CREATE OR REPLACE FUNCTION private.species_replaceable_cantrip_options_v1(p_feature_key text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'spellId',s.id,
    'name',s.name,
    'source',s.source,
    'description',coalesce(s.description,''),
    'classes',to_jsonb(coalesce(s.classes,'{}'::text[]))
  ) order by s.name),'[]'::jsonb)
  from public.spells_catalog_preferred s
  where s.level=0
    and (
      (p_feature_key='high-elf-lineage-cantrip' and exists(
        select 1 from unnest(coalesce(s.classes,'{}'::text[])) c where lower(c)='wizard'
      ))
      or
      (p_feature_key='khoravar-fey-gift-cantrip' and exists(
        select 1 from unnest(coalesce(s.classes,'{}'::text[])) c where lower(c) in ('cleric','druid','wizard')
      ))
    );
$function$;

-- Keep the migration-67 private executable permissions, no broad PUBLIC/anon
-- function EXECUTE. Source owner postgres; direct call service_role only.
REVOKE ALL ON FUNCTION private.character_has_species_source_v1(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.character_has_species_source_v1(uuid,text,text) TO service_role;
REVOKE ALL ON FUNCTION private.materialize_player_forge_species_replaceable_cantrip_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.materialize_player_forge_species_replaceable_cantrip_v1() TO service_role;
REVOKE ALL ON FUNCTION private.set_species_replaceable_cantrip_projection_v1(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.set_species_replaceable_cantrip_projection_v1(uuid,jsonb) TO service_role;
REVOKE ALL ON FUNCTION private.species_replaceable_cantrip_feature_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.species_replaceable_cantrip_feature_v1(uuid) TO service_role;
REVOKE ALL ON FUNCTION private.species_replaceable_cantrip_options_v1(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.species_replaceable_cantrip_options_v1(text) TO service_role;
DO $t12_functions$
BEGIN
 IF md5(pg_get_functiondef('private.character_has_species_source_v1(uuid,text,text)'::regprocedure)) <> 'd1264573b17e7569ba75371aa7e912eb' THEN RAISE EXCEPTION 'C34 T12 source-original function drift private.character_has_species_source_v1'; END IF;
 IF md5(pg_get_functiondef('private.materialize_player_forge_species_replaceable_cantrip_v1()'::regprocedure)) <> 'a09198d8e12df12371647fccd8479489' THEN RAISE EXCEPTION 'C34 T12 source-original function drift private.materialize_player_forge_species_replaceable_cantrip_v1'; END IF;
 IF md5(pg_get_functiondef('private.set_species_replaceable_cantrip_projection_v1(uuid,jsonb)'::regprocedure)) <> '7af5408f062f786aa633254a0d5d6365' THEN RAISE EXCEPTION 'C34 T12 source-original function drift private.set_species_replaceable_cantrip_projection_v1'; END IF;
 IF md5(pg_get_functiondef('private.species_replaceable_cantrip_feature_v1(uuid)'::regprocedure)) <> '560088a5e3ad85866b6aa9b10ccfd2db' THEN RAISE EXCEPTION 'C34 T12 source-original function drift private.species_replaceable_cantrip_feature_v1'; END IF;
 IF md5(pg_get_functiondef('private.species_replaceable_cantrip_options_v1(text)'::regprocedure)) <> 'f8bf8cdf45cf57953dca333e5f856a84' THEN RAISE EXCEPTION 'C34 T12 source-original function drift private.species_replaceable_cantrip_options_v1'; END IF;
END $t12_functions$;

-- EXACT original migration 67 event, AFTER INSERT initially deferred.
create constraint trigger character_progression_materialize_species_cantrip_v1
after insert on public.character_progression
deferrable initially deferred
for each row execute function private.materialize_player_forge_species_replaceable_cantrip_v1();

DO $t12_post$
DECLARE d text; n integer;
BEGIN
 SELECT pg_get_triggerdef(oid,true) INTO d FROM pg_trigger
 WHERE tgrelid='public.character_progression'::regclass
  AND tgname='character_progression_materialize_species_cantrip_v1'
  AND NOT tgisinternal AND tgenabled='O';
 IF d IS NULL
  OR position('AFTER INSERT ON character_progression' IN d)=0
  OR position('DEFERRABLE INITIALLY DEFERRED' IN d)=0
  OR position('private.materialize_player_forge_species_replaceable_cantrip_v1()' IN d)=0
 THEN RAISE EXCEPTION 'C34 T12 original species cantrip timing/handler drift: %',d; END IF;
 SELECT count(*) INTO n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O' AND c.relname IN
 ('character_progression','character_sheets','characters','inventory_items');
 IF n<>23 THEN RAISE EXCEPTION 'C34 T12 expected 20/31 original+3 held triggers; got %',n; END IF;
 IF has_function_privilege('anon','private.materialize_player_forge_species_replaceable_cantrip_v1()','EXECUTE')
 THEN RAISE EXCEPTION 'C34 T12 private materializer must not expose anon execute'; END IF;
END $t12_post$;
\echo 'PASS C34 T12 original species replaceable cantrip handler/source, deferred trigger and 20/31 original; full rest/configure RPC not installed'
