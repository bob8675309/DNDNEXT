-- I1-L: strictly disposable PostgreSQL 17/GoTrue/PostgREST. NOT a hosted migration.
-- This source-original EFA Artificer Magic Item Plan subset is staged after all I1-C..K signed cases.
\set ON_ERROR_STOP on
DO $i1l_pre$
BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL OR to_regclass('private.player_creation_intent_reservations_v1') IS NULL
 OR to_regclass('public.class_feature_option_catalog') IS NULL OR to_regclass('public.character_class_option_grant_instances') IS NULL
 OR to_regclass('public.items_catalog') IS NULL OR to_regclass('public.class_level_progression') IS NULL
 OR to_regprocedure('private.materialize_player_forge_species_replaceable_cantrip_v1()') IS NULL
 OR md5(pg_get_functiondef('private.materialize_player_forge_species_replaceable_cantrip_v1()'::regprocedure))<>'a09198d8e12df12371647fccd8479489'
 OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.character_progression'::regclass AND tgname='character_progression_materialize_player_forge_artificer_plans_')
 OR (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.character_progression'::regclass AND NOT tgisinternal AND tgenabled='O'
 AND tgname IN ('character_progression_validate_player_forge_class_options_v1',
 'character_progression_reject_unmarked_legacy_warlock_invocation',
 'character_progression_validate_player_forge_class_options_v2',
 'character_progression_materialize_eladrin_season_v1',
 'character_progression_materialize_player_forge_khoravar_skill_v',
 'character_progression_materialize_species_cantrip_v1')) <> 6
 OR to_regprocedure('private.artificer_plan_count_v1(integer)') IS NOT NULL
 OR to_regprocedure('private.artificer_plan_slot_level_v1(integer)') IS NOT NULL
 OR to_regprocedure('private.artificer_plan_item_is_eligible_v1(uuid,uuid)') IS NOT NULL
 OR to_regprocedure('private.validate_artificer_plan_choice_v1(uuid,integer,text,uuid,text)') IS NOT NULL
 OR to_regprocedure('private.sync_character_artificer_plan_projection_v1(uuid)') IS NOT NULL
 OR to_regprocedure('private.materialize_player_forge_artificer_plans_v1()') IS NOT NULL
 THEN RAISE EXCEPTION 'I1-L ONLY after original I1-K disposable PG17 environment with 6 prior source triggers'; END IF;
END $i1l_pre$;

-- Real source-owned EFA Artificer class identity and source startingEquipment; the
-- original local Forge starting-equipment resolver remains an explicit reduced stub.
INSERT INTO public.class_catalog(id,class_key,class_name,source,ruleset,hit_die,spellcasting_ability,raw_payload)
VALUES ('46ea4181-2a9c-4f4e-b886-e246b462ed44','artificer','Artificer','EFA','2014',8,'int',
'{"startingEquipment":{"defaultData":[{"A":[{"item":"Studded Leather Armor|XPHB"},{"item":"Dagger|XPHB"},{"item":"Thieves'' Tools|XPHB"},{"item":"Tinker''s Tools|XPHB"},{"item":"Dungeoneer''s Pack|XPHB"},{"value":1600}]},{"B":[{"value":15000}]}]}}'::jsonb);
INSERT INTO public.class_level_progression(class_id,class_level,xp_threshold,proficiency_bonus,spell_slots) VALUES
('46ea4181-2a9c-4f4e-b886-e246b462ed44',1,0,2,'[2,0,0,0,0]'::jsonb),
('46ea4181-2a9c-4f4e-b886-e246b462ed44',2,300,2,'[2,0,0,0,0]'::jsonb),
('46ea4181-2a9c-4f4e-b886-e246b462ed44',6,14000,3,'[4,2,0,0,0]'::jsonb);

-- Genuine live source-qualified EFA plan option catalog specimens, including
-- 4 nonrepeatable level2 plans, one level2 repeatable common magic item
-- wildcard, and one level6 illegal-at-level2 plan. No fabricated option keys.
INSERT INTO public.class_feature_option_catalog
(id,option_key,option_type,name,source,class_key,repeatable,prerequisites,choice_schema) VALUES
 ('bee85784-f6cd-416d-9c0d-cb9f6fbdadaf','artificer-plan:1-shield|EFA','artificer-plan','+1 Shield','EFA','artificer',false,'{"minClassLevel":2}'::jsonb,'{}'::jsonb),
 ('c3e113c1-8f41-4028-9ca5-2f123c321818','artificer-plan:1-wand-of-the-war-mage|EFA','artificer-plan','+1 Wand of the War Mage','EFA','artificer',false,'{"minClassLevel":2}'::jsonb,'{}'::jsonb),
 ('f38fac21-028d-4314-a170-f1b171a9ed75','artificer-plan:1-weapon|EFA','artificer-plan','+1 Weapon','EFA','artificer',false,'{"minClassLevel":2}'::jsonb,'{}'::jsonb),
 ('cdd0e441-d773-4d01-90a4-c3e3e3e13b76','artificer-plan:1-wraps-of-unarmed-power|EFA','artificer-plan','+1 Wraps of Unarmed Power','EFA','artificer',false,'{"minClassLevel":2}'::jsonb,'{}'::jsonb),
 ('f8897bf9-5bb5-4e4f-8280-ad2a2e941112','artificer-plan:common-magic-item-that-isn-t-a-potion-a-scroll-or-cursed|EFA','artificer-plan','Common magic item that isn''t a Potion, a Scroll, or cursed','EFA','artificer',true,'{"minClassLevel":2}'::jsonb,'{"kind":"magic-item","rarity":"common","excludeTypes":["potion","scroll"],"excludeCursed":true,"distinctPerRepeat":true}'::jsonb),
 ('eda4194f-7d01-44e4-a78c-79f29b7a83e2','artificer-plan:1-armor|EFA','artificer-plan','+1 Armor','EFA','artificer',false,'{"minClassLevel":6}'::jsonb,'{}'::jsonb);

-- Canonical XDMG Prosthetic Limb is common Wondrous Item and eligible under
-- original source check. Potion of Comprehension is a canonical XDMG potion
-- and deliberately INELIGIBLE. Neither is assigned to a character inventory.
INSERT INTO public.items_catalog(id,item_key,item_name,item_type,item_rarity,payload) VALUES
 ('8adeb0df-1434-41f3-8702-1e1e3e0b5da7','Prosthetic Limb|XDMG','Prosthetic Limb','Wondrous Item','common','{"source":"XDMG","wondrous":"true"}'::jsonb),
 ('d0f8d472-b20f-402b-8405-b65a4330d348','Potion of Comprehension|XDMG','Potion of Comprehension','Potions & Poisons','common','{"source":"XDMG","type":"P|XPHB"}'::jsonb);

-- SOURCE ORIGINAL private.artificer_plan_count_v1(integer); live MD5 3b2a115e3059fcfac280d90a788bc9b9
CREATE OR REPLACE FUNCTION private.artificer_plan_count_v1(p_level integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select case
    when coalesce(p_level,0) >= 18 then 8
    when coalesce(p_level,0) >= 14 then 7
    when coalesce(p_level,0) >= 10 then 6
    when coalesce(p_level,0) >= 6 then 5
    when coalesce(p_level,0) >= 2 then 4
    else 0 end;
$function$;

-- SOURCE ORIGINAL private.artificer_plan_slot_level_v1(integer); live MD5 4797ebbbbc9888aa02771b0de6afcf30
CREATE OR REPLACE FUNCTION private.artificer_plan_slot_level_v1(p_slot integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select case
    when p_slot between 1 and 4 then 2
    when p_slot = 5 then 6
    when p_slot = 6 then 10
    when p_slot = 7 then 14
    when p_slot = 8 then 18
    else null end;
$function$;

-- SOURCE ORIGINAL private.artificer_plan_item_is_eligible_v1(uuid,uuid); live MD5 483bd056efd89e769cdefe97f1c80e62
CREATE OR REPLACE FUNCTION private.artificer_plan_item_is_eligible_v1(p_option_catalog_id uuid, p_item_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_option public.class_feature_option_catalog%rowtype;
  v_item public.items_catalog%rowtype;
  v_schema jsonb;
  v_type text;
  v_rarity text;
  v_source text;
  v_excluded text;
  v_is_magic_item boolean;
begin
  select * into v_option
  from public.class_feature_option_catalog
  where id=p_option_catalog_id
    and option_type='artificer-plan'
    and source='EFA'
    and lower(coalesce(class_key,''))='artificer';
  if not found then return false; end if;

  v_schema:=coalesce(v_option.choice_schema,'{}'::jsonb);
  if v_schema->>'kind' <> 'magic-item' then return false; end if;

  select * into v_item from public.items_catalog where id=p_item_id;
  if not found then return false; end if;

  v_type:=lower(btrim(coalesce(v_item.item_type,v_item.payload->>'uiType','')));
  v_rarity:=lower(btrim(coalesce(v_item.item_rarity,v_item.payload->>'rarity','')));
  v_source:=upper(btrim(coalesce(v_item.payload->>'source','')));
  v_is_magic_item:=nullif(btrim(coalesce(v_item.payload->>'type','')),'') is not null
    or lower(coalesce(v_item.payload->>'wondrous','false'))='true'
    or v_type='wondrous item';

  -- Canonical rows must positively identify as magic. Imported magic weapons/armor/etc.
  -- carry payload.type; Wondrous Items use wondrous=true or the canonical Wondrous Item type.
  -- Alchemy, recipe, and other non-magic rows carry none of these markers.
  if not v_is_magic_item then return false; end if;

  if nullif(v_schema->>'rarity','') is not null and v_rarity<>lower(v_schema->>'rarity') then return false; end if;
  if coalesce((v_schema->>'excludeCursed')::boolean,false)
     and lower(coalesce(v_item.payload->>'curse','false'))='true' then return false; end if;
  if lower(coalesce(v_schema->>'itemType',''))='wondrous item'
     and not (v_type='wondrous item' or lower(coalesce(v_item.payload->>'wondrous','false'))='true') then return false; end if;

  for v_excluded in
    select value from jsonb_array_elements_text(coalesce(v_schema->'excludeTypes','[]'::jsonb))
  loop
    if v_type like '%'||lower(v_excluded)||'%' then return false; end if;
  end loop;

  -- Campaign-wide preferred-version convention: a same-name 2024 DMG row wins.
  if v_source<>'XDMG' and exists(
    select 1
    from public.items_catalog preferred
    where lower(regexp_replace(preferred.item_name,'[^a-zA-Z0-9]+','','g'))
          =lower(regexp_replace(v_item.item_name,'[^a-zA-Z0-9]+','','g'))
      and upper(coalesce(preferred.payload->>'source',''))='XDMG'
  ) then return false; end if;

  return true;
end;
$function$;

-- SOURCE ORIGINAL private.validate_artificer_plan_choice_v1(uuid,integer,text,uuid,text); live MD5 42730b6b8cc5fb57c55799f2b4396bf7
CREATE OR REPLACE FUNCTION private.validate_artificer_plan_choice_v1(p_character_id uuid, p_level integer, p_plan_option_key text, p_item_id uuid DEFAULT NULL::uuid, p_exclude_instance_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_option public.class_feature_option_catalog%rowtype;
  v_item public.items_catalog%rowtype;
  v_schema jsonb;
  v_choices jsonb:='{}'::jsonb;
begin
  select * into v_option
  from public.class_feature_option_catalog
  where option_key=p_plan_option_key and option_type='artificer-plan' and source='EFA' and lower(coalesce(class_key,''))='artificer';
  if not found then raise exception 'The selected Magic Item Plan is not canonical EFA plan authority.'; end if;
  if coalesce((v_option.prerequisites->>'minClassLevel')::integer,1)>p_level then
    raise exception '% requires Artificer level %.',v_option.name,v_option.prerequisites->>'minClassLevel';
  end if;
  if not v_option.repeatable and exists(
    select 1 from public.character_class_option_grant_instances gi
    where gi.character_id=p_character_id and gi.option_catalog_id=v_option.id
      and (p_exclude_instance_key is null or gi.instance_key<>p_exclude_instance_key)
  ) then raise exception '% is already a learned Magic Item Plan.',v_option.name; end if;

  v_schema:=coalesce(v_option.choice_schema,'{}'::jsonb);
  if v_schema->>'kind'='magic-item' then
    if p_item_id is null then raise exception '% requires a concrete magic item.',v_option.name; end if;
    if not private.artificer_plan_item_is_eligible_v1(v_option.id,p_item_id) then
      raise exception 'The selected item is not legal for %.',v_option.name;
    end if;
    if coalesce((v_schema->>'distinctPerRepeat')::boolean,false) and exists(
      select 1 from public.character_class_option_grant_instances gi
      where gi.character_id=p_character_id and gi.option_catalog_id=v_option.id
        and (p_exclude_instance_key is null or gi.instance_key<>p_exclude_instance_key)
        and gi.choices #>> '{child,key}'=p_item_id::text
    ) then raise exception 'Each repeat of % must choose a different magic item.',v_option.name; end if;
    select * into v_item from public.items_catalog where id=p_item_id;
    v_choices:=jsonb_build_object('child',jsonb_build_object(
      'kind','item','key',v_item.id::text,'value',v_item.id::text,'label',v_item.item_name,
      'source',coalesce(v_item.payload->>'source','Campaign'),
      'metadata',jsonb_build_object('itemId',v_item.id,'itemKey',v_item.item_key,'itemType',v_item.item_type,'rarity',v_item.item_rarity,'source',coalesce(v_item.payload->>'source','Campaign'))
    ));
  elsif p_item_id is not null then
    raise exception '% is a fixed Magic Item Plan and does not accept a wildcard item.',v_option.name;
  end if;

  return jsonb_build_object(
    'optionId',v_option.id,'optionKey',v_option.option_key,'name',v_option.name,'source',v_option.source,
    'repeatable',v_option.repeatable,'minClassLevel',coalesce((v_option.prerequisites->>'minClassLevel')::integer,1),
    'choices',v_choices
  );
end;
$function$;

-- SOURCE ORIGINAL private.sync_character_artificer_plan_projection_v1(uuid); live MD5 5ebf572db01143e9b523c7dba0d43ad5
CREATE OR REPLACE FUNCTION private.sync_character_artificer_plan_projection_v1(p_character_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_sheet jsonb;
  v_selections jsonb;
  v_group jsonb;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets
  where character_id=p_character_id
  for update;
  if v_sheet is null then return; end if;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'key',o.option_key,
    'name',o.name,
    'source',o.source,
    'kind','artificer-plan',
    'instanceKey',gi.instance_key,
    'acquiredLevel',gi.acquired_level,
    'item',case when gi.choices ? 'child' then gi.choices->'child' else null end
  )) order by gi.instance_key),'[]'::jsonb)
  into v_selections
  from public.character_class_option_grant_instances gi
  join public.class_feature_option_catalog o on o.id=gi.option_catalog_id
  where gi.character_id=p_character_id
    and gi.option_type='artificer-plan';

  v_group:=jsonb_build_object(
    'label','Magic Item Plans',
    'kind','artificer-plan',
    'sourceFeature','Replicate Magic Item',
    'source','EFA',
    'level',2,
    'count',jsonb_array_length(v_selections),
    'placement','class',
    'subclassName',null,
    'cadence','creation',
    'replacementCadence','level-up',
    'selections',v_selections,
    'normalizedAuthority',true
  );

  if jsonb_typeof(v_sheet->'classFeatureChoices')<>'object' then
    v_sheet:=jsonb_set(v_sheet,'{classFeatureChoices}','{}'::jsonb,true);
  end if;
  v_sheet:=jsonb_set(v_sheet,'{classFeatureChoices,artificer-magic-item-plans}',v_group,true);

  update public.character_sheets set sheet=v_sheet,updated_at=now()
  where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now()
  where p.user_id in(
    select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id
  );
end;
$function$;

-- SOURCE ORIGINAL private.materialize_player_forge_artificer_plans_v1(); live MD5 67766989a466b82f170b5e00f9154e24
CREATE OR REPLACE FUNCTION private.materialize_player_forge_artificer_plans_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_class public.class_catalog%rowtype;
  v_sheet jsonb;
  v_source jsonb;
  v_group jsonb;
  v_plan_selection jsonb;
  v_plan_key text;
  v_option public.class_feature_option_catalog%rowtype;
  v_schema jsonb;
  v_child_field jsonb;
  v_child_selection jsonb;
  v_item_id uuid;
  v_resolved jsonb;
  v_slot integer;
  v_count integer;
  v_slot_level integer;
  v_acquired integer;
begin
  select * into v_class from public.class_catalog where id=new.class_id;
  if not found or lower(v_class.class_key)<>'artificer' or upper(v_class.source)<>'EFA' then return new; end if;
  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=new.character_id;
  if coalesce(v_sheet #>> '{meta,creator}','')<>'shared_character_forge_player_v2' then return new; end if;
  v_count:=private.artificer_plan_count_v1(new.class_level);
  if v_count=0 then return new; end if;
  v_source:=case when jsonb_typeof(v_sheet->'sourceChoices')='object' then v_sheet->'sourceChoices' else '{}'::jsonb end;

  for v_slot in 1..v_count loop
    v_group:=v_source->('artificer-plan-slot-'||v_slot::text);
    if v_group is null then raise exception 'Player Forge is missing Magic Item Plan slot %.',v_slot; end if;
    v_plan_selection:=v_group #> '{fields,plan,selections}';
    if jsonb_typeof(v_plan_selection)<>'array' or jsonb_array_length(v_plan_selection)<>1 then
      raise exception 'Magic Item Plan slot % requires exactly one plan.',v_slot;
    end if;
    v_plan_key:=v_plan_selection->0->>'key';
    select * into v_option from public.class_feature_option_catalog where option_key=v_plan_key;
    if not found then raise exception 'Magic Item Plan slot % references an unknown plan.',v_slot; end if;
    v_schema:=coalesce(v_option.choice_schema,'{}'::jsonb);
    v_item_id:=null;
    if v_schema->>'kind'='magic-item' then
      select value into v_child_field
      from jsonb_each(coalesce(v_group->'fields','{}'::jsonb))
      where value #>> '{metadata,planOptionKey}'=v_plan_key
      limit 1;
      v_child_selection:=v_child_field->'selections';
      if jsonb_typeof(v_child_selection)<>'array' or jsonb_array_length(v_child_selection)<>1 then
        raise exception '% requires one concrete magic item.',v_option.name;
      end if;
      begin v_item_id:=(v_child_selection->0->>'key')::uuid;
      exception when others then raise exception '% requires a canonical item id.',v_option.name; end;
    end if;
    v_resolved:=private.validate_artificer_plan_choice_v1(new.character_id,new.class_level,v_plan_key,v_item_id,null);
    v_slot_level:=private.artificer_plan_slot_level_v1(v_slot);
    v_acquired:=greatest(v_slot_level,coalesce((v_resolved->>'minClassLevel')::integer,v_slot_level));
    insert into public.character_class_option_grant_instances(
      character_id,instance_key,option_catalog_id,option_type,acquired_level,choices,metadata,updated_at
    ) values(
      new.character_id,'artificer-plan-'||v_slot::text,(v_resolved->>'optionId')::uuid,'artificer-plan',v_acquired,
      coalesce(v_resolved->'choices','{}'::jsonb),
      jsonb_build_object('creator','shared_character_forge_player_v2','slot',v_slot,'slotAcquisitionLevel',v_slot_level,'startingLevel',new.class_level,'materializesInventory',false),now()
    );
  end loop;
  perform private.sync_character_artificer_plan_projection_v1(new.character_id);
  return new;
end;
$function$;

CREATE CONSTRAINT TRIGGER character_progression_materialize_player_forge_artificer_plans_
 AFTER INSERT ON public.character_progression DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION private.materialize_player_forge_artificer_plans_v1();
REVOKE ALL ON FUNCTION
 private.artificer_plan_count_v1(integer),
 private.artificer_plan_slot_level_v1(integer),
 private.artificer_plan_item_is_eligible_v1(uuid,uuid),
 private.validate_artificer_plan_choice_v1(uuid,integer,text,uuid,text),
 private.sync_character_artificer_plan_projection_v1(uuid),
 private.materialize_player_forge_artificer_plans_v1()
 FROM PUBLIC,anon,authenticated;

DO $i1l_guard$
DECLARE vdef text;
BEGIN
 IF md5(pg_get_functiondef('private.artificer_plan_count_v1(integer)'::regprocedure)) <> '3b2a115e3059fcfac280d90a788bc9b9'
 THEN RAISE EXCEPTION 'I1-L original source hash drift: private.artificer_plan_count_v1(integer)'; END IF;
 IF md5(pg_get_functiondef('private.artificer_plan_slot_level_v1(integer)'::regprocedure)) <> '4797ebbbbc9888aa02771b0de6afcf30'
 THEN RAISE EXCEPTION 'I1-L original source hash drift: private.artificer_plan_slot_level_v1(integer)'; END IF;
 IF md5(pg_get_functiondef('private.artificer_plan_item_is_eligible_v1(uuid,uuid)'::regprocedure)) <> '483bd056efd89e769cdefe97f1c80e62'
 THEN RAISE EXCEPTION 'I1-L original source hash drift: private.artificer_plan_item_is_eligible_v1(uuid,uuid)'; END IF;
 IF md5(pg_get_functiondef('private.validate_artificer_plan_choice_v1(uuid,integer,text,uuid,text)'::regprocedure)) <> '42730b6b8cc5fb57c55799f2b4396bf7'
 THEN RAISE EXCEPTION 'I1-L original source hash drift: private.validate_artificer_plan_choice_v1(uuid,integer,text,uuid,text)'; END IF;
 IF md5(pg_get_functiondef('private.sync_character_artificer_plan_projection_v1(uuid)'::regprocedure)) <> '5ebf572db01143e9b523c7dba0d43ad5'
 THEN RAISE EXCEPTION 'I1-L original source hash drift: private.sync_character_artificer_plan_projection_v1(uuid)'; END IF;
 IF md5(pg_get_functiondef('private.materialize_player_forge_artificer_plans_v1()'::regprocedure)) <> '67766989a466b82f170b5e00f9154e24'
 THEN RAISE EXCEPTION 'I1-L original source hash drift: private.materialize_player_forge_artificer_plans_v1()'; END IF;
 SELECT pg_get_triggerdef(oid,true) INTO vdef FROM pg_trigger WHERE tgrelid='public.character_progression'::regclass
 AND tgname='character_progression_materialize_player_forge_artificer_plans_'
 AND NOT tgisinternal AND tgenabled='O' AND tgdeferrable AND tginitdeferred;
 IF vdef IS NULL OR vdef NOT LIKE '%AFTER INSERT ON%' OR vdef NOT LIKE '%DEFERRABLE INITIALLY DEFERRED%'
 OR vdef NOT LIKE '%private.materialize_player_forge_artificer_plans_v1()%'
 OR private.artificer_plan_count_v1(2)<>4 OR private.artificer_plan_slot_level_v1(4)<>2
 OR (SELECT count(*) FROM public.class_feature_option_catalog WHERE option_type='artificer-plan' AND source='EFA') <> 6
 OR (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.character_progression'::regclass AND NOT tgisinternal AND tgenabled='O'
 AND tgname IN ('character_progression_validate_player_forge_class_options_v1',
 'character_progression_reject_unmarked_legacy_warlock_invocation',
 'character_progression_validate_player_forge_class_options_v2',
 'character_progression_materialize_eladrin_season_v1',
 'character_progression_materialize_player_forge_khoravar_skill_v',
 'character_progression_materialize_species_cantrip_v1',
 'character_progression_materialize_player_forge_artificer_plans_'))<>7
 THEN RAISE EXCEPTION 'I1-L source-original Artificer seven-trigger co-resident guard failed'; END IF;
END $i1l_guard$;
NOTIFY pgrst,'reload schema';
\echo 'PASS I1L-SOURCE: six exact-source EFA Artificer handlers, genuine plan/item catalog and seven original deferred CP triggers in disposable local PG17'
