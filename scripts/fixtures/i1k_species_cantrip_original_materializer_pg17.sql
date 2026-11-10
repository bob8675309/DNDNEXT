-- I1-K: disposable local PG17 ONLY; exact live original species replaceable cantrip materializer.
-- This test-only file is NOT a hosted Supabase migration or a full production preferred-spells view.
\set ON_ERROR_STOP on
DO $preflight$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('public.spells_catalog') IS NULL
 OR to_regclass('public.spells_catalog_preferred') IS NULL
 OR to_regclass('public.character_spells') IS NULL
 OR to_regclass('public.character_runtime_feature_choices') IS NULL
 OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR to_regprocedure('private.character_has_species_source_v1(uuid,text,text)') IS NULL
 OR md5(pg_get_functiondef('private.character_has_species_source_v1(uuid,text,text)'::regprocedure)) <> 'd1264573b17e7569ba75371aa7e912eb'
 OR to_regprocedure('private.normalize_player_choice_name_v1(text)') IS NULL
 OR md5(pg_get_functiondef('private.normalize_player_choice_name_v1(text)'::regprocedure)) <> 'dd8cdd5b47efe99b1cfff9c2bf7635dd'
 OR to_regprocedure('private.materialize_player_forge_khoravar_skill_versatility_v1()') IS NULL
 OR md5(pg_get_functiondef('private.materialize_player_forge_khoravar_skill_versatility_v1()'::regprocedure)) <> '9d5fec42e2aefdd39d8a34adf1548460'
 OR EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.spells_catalog'::regclass AND attname='description' AND NOT attisdropped)
 OR (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.character_progression'::regclass
 AND NOT tgisinternal AND tgenabled='O' AND tgname IN (
 'character_progression_validate_player_forge_class_options_v1',
 'character_progression_reject_unmarked_legacy_warlock_invocation',
 'character_progression_validate_player_forge_class_options_v2',
 'character_progression_materialize_eladrin_season_v1',
 'character_progression_materialize_player_forge_khoravar_skill_v')) <> 5
 OR to_regprocedure('private.species_replaceable_cantrip_feature_v1(uuid)') IS NOT NULL
 OR to_regprocedure('private.species_replaceable_cantrip_options_v1(text)') IS NOT NULL
 OR to_regprocedure('private.set_species_replaceable_cantrip_projection_v1(uuid,jsonb)') IS NOT NULL
 OR to_regprocedure('private.materialize_player_forge_species_replaceable_cantrip_v1()') IS NOT NULL
 THEN RAISE EXCEPTION 'I1-K must run only after signed I1-J disposable PG17 setup, before species cantrip original'; END IF;
END $preflight$;

-- Original SELECT s.* INTO public.spells_catalog%rowtype requires preferred view
-- EXACTLY matching the reduced base table position/type order, not merely the
-- 7-column I1-E subset. This local source-identical rowtype is NOT production's
-- true 47-column precedence/priority logic (intentionally unproven).
ALTER TABLE public.spells_catalog ADD COLUMN description text NOT NULL DEFAULT '';
CREATE OR REPLACE VIEW public.spells_catalog_preferred WITH (security_invoker=true)
 AS SELECT * FROM public.spells_catalog;
REVOKE ALL ON public.spells_catalog_preferred FROM PUBLIC,anon,authenticated;

-- Source-grounded preferred XPHB fixed starting cantrips: exact live id/name/level/class/school.
-- Descriptions are empty reduced-fixture metadata, NOT copied spell narratives.
INSERT INTO public.spells_catalog(id,name,level,classes,source,school,spell_key,description)
VALUES ('c667b8ab-a44e-4c23-a8ea-b03f8953fc18','Friends',0,
 ARRAY['Bard','Sorcerer','Warlock','Wizard'],'XPHB','Enchantment','friends|XPHB',''),
 ('5f62b543-f6ac-405f-baa8-1f196190ff35','Prestidigitation',0,
 ARRAY['Artificer','Bard','Sorcerer','Warlock','Wizard'],'XPHB','Transmutation','prestidigitation|XPHB','');

-- Exact live private.species_replaceable_cantrip_feature_v1(uuid) MD5 560088a5e3ad85866b6aa9b10ccfd2db
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

-- Exact live private.species_replaceable_cantrip_options_v1(text) MD5 f8bf8cdf45cf57953dca333e5f856a84
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

-- Exact live private.set_species_replaceable_cantrip_projection_v1(uuid,jsonb) MD5 7af5408f062f786aa633254a0d5d6365
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

-- Exact live private.materialize_player_forge_species_replaceable_cantrip_v1() MD5 a09198d8e12df12371647fccd8479489
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

CREATE CONSTRAINT TRIGGER character_progression_materialize_species_cantrip_v1
 AFTER INSERT ON public.character_progression
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 EXECUTE FUNCTION private.materialize_player_forge_species_replaceable_cantrip_v1();
REVOKE ALL ON FUNCTION
 private.species_replaceable_cantrip_feature_v1(uuid),
 private.species_replaceable_cantrip_options_v1(text),
 private.set_species_replaceable_cantrip_projection_v1(uuid,jsonb),
 private.materialize_player_forge_species_replaceable_cantrip_v1()
 FROM PUBLIC,anon,authenticated;

DO $i1k_gate$
DECLARE tdef text; n_source integer; n_view integer;
BEGIN
 IF md5(pg_get_functiondef('private.species_replaceable_cantrip_feature_v1(uuid)'::regprocedure)) <> '560088a5e3ad85866b6aa9b10ccfd2db'
 THEN RAISE EXCEPTION 'I1-K exact original function source hash drift: private.species_replaceable_cantrip_feature_v1(uuid)'; END IF;
 IF md5(pg_get_functiondef('private.species_replaceable_cantrip_options_v1(text)'::regprocedure)) <> 'f8bf8cdf45cf57953dca333e5f856a84'
 THEN RAISE EXCEPTION 'I1-K exact original function source hash drift: private.species_replaceable_cantrip_options_v1(text)'; END IF;
 IF md5(pg_get_functiondef('private.set_species_replaceable_cantrip_projection_v1(uuid,jsonb)'::regprocedure)) <> '7af5408f062f786aa633254a0d5d6365'
 THEN RAISE EXCEPTION 'I1-K exact original function source hash drift: private.set_species_replaceable_cantrip_projection_v1(uuid,jsonb)'; END IF;
 IF md5(pg_get_functiondef('private.materialize_player_forge_species_replaceable_cantrip_v1()'::regprocedure)) <> 'a09198d8e12df12371647fccd8479489'
 THEN RAISE EXCEPTION 'I1-K exact original function source hash drift: private.materialize_player_forge_species_replaceable_cantrip_v1()'; END IF;
 SELECT pg_get_triggerdef(t.oid,true) INTO tdef FROM pg_trigger t
 WHERE t.tgrelid='public.character_progression'::regclass
 AND t.tgname='character_progression_materialize_species_cantrip_v1'
 AND NOT t.tgisinternal AND t.tgenabled='O' AND t.tgdeferrable AND t.tginitdeferred;
 IF tdef IS NULL OR tdef NOT LIKE '%AFTER INSERT ON%' OR tdef NOT LIKE '%DEFERRABLE INITIALLY DEFERRED%'
 OR tdef NOT LIKE '%private.materialize_player_forge_species_replaceable_cantrip_v1()%'
 THEN RAISE EXCEPTION 'I1-K original species cantrip trigger placement/handler mismatch'; END IF;
 SELECT count(*) INTO n_source FROM pg_attribute WHERE attrelid='public.spells_catalog'::regclass
 AND attnum>0 AND NOT attisdropped;
 SELECT count(*) INTO n_view FROM pg_attribute a JOIN pg_attribute v
 ON v.attrelid='public.spells_catalog_preferred'::regclass AND v.attnum=a.attnum
 AND v.attname=a.attname AND v.atttypid=a.atttypid
 WHERE a.attrelid='public.spells_catalog'::regclass AND a.attnum>0 AND NOT a.attisdropped;
 IF n_view<>n_source OR
 (SELECT count(*) FROM pg_attribute WHERE attrelid='public.spells_catalog_preferred'::regclass AND attnum>0 AND NOT attisdropped)<>n_source
 OR (SELECT count(*) FROM public.spells_catalog_preferred WHERE name IN ('Friends','Prestidigitation') AND level=0 AND source='XPHB')<>2
 THEN RAISE EXCEPTION 'I1-K reduced preferred spell view must match every underlying table column/type and fixed source cantrip'; END IF;
 IF (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.character_progression'::regclass
 AND NOT tgisinternal AND tgenabled='O' AND tgname IN (
 'character_progression_validate_player_forge_class_options_v1',
 'character_progression_reject_unmarked_legacy_warlock_invocation',
 'character_progression_validate_player_forge_class_options_v2',
 'character_progression_materialize_eladrin_season_v1',
 'character_progression_materialize_player_forge_khoravar_skill_v',
 'character_progression_materialize_species_cantrip_v1'))<>6
 THEN RAISE EXCEPTION 'I1-K original cumulative six-trigger boundary missing'; END IF;
END $i1k_gate$;
NOTIFY pgrst,'reload schema';
\echo 'PASS I1K-SOURCE: four exact original Species cantrip functions, deferred trigger, two XPHB starting spells and reduced full-rowtype preferred view installed after I1-J'
