-- C34 T15: source-original paired XPHB Battle Master materializer+validator.
-- Original held I1-F #354 function blob fbda236e3c1b96ef9a93c44f0a2f99a6cd77adf9
-- Original joint setup blob c5ae0b31605d9374b295eee01eefdda0718afb80
-- Five original pg_get_functiondef bodies and TWO original deferred DDLs unchanged.
-- Reduced option/grant tables are DISPOSABLE TEST ONLY, not production DDL.
\set ON_ERROR_STOP on
DO $t15_pre$
DECLARE n integer;
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('public.class_feature_catalog') IS NULL
 OR to_regclass('public.class_level_progression') IS NULL
 OR to_regclass('public.class_catalog') IS NULL
 OR to_regclass('public.character_runtime_feature_choices') IS NULL
 OR to_regclass('public.class_feature_option_catalog') IS NOT NULL
 OR to_regclass('public.character_class_option_grant_instances') IS NOT NULL
 OR to_regprocedure('private.materialize_player_forge_battle_master_maneuvers_v1()') IS NOT NULL
 OR md5(pg_get_functiondef('private.normalize_player_choice_name_v1(text)'::regprocedure))<>'dd8cdd5b47efe99b1cfff9c2bf7635dd'
 OR md5(pg_get_functiondef('private.materialize_player_forge_khoravar_skill_versatility_v1()'::regprocedure))<>'9d5fec42e2aefdd39d8a34adf1548460'
 OR EXISTS(SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgname IN
 ('trg_force_depart_on_route_assign','trg_guard_locations_for_resting_and_camping'))
 THEN RAISE EXCEPTION 'T15 requires intact local source-original T14 and excludes world-map triggers'; END IF;
 SELECT count(*) INTO n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O' AND c.relname IN
 ('character_progression','character_sheets','characters','inventory_items');
 IF n<>25 THEN RAISE EXCEPTION 'T15 requires 22 original +3 held, got %',n; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.class_feature_catalog
  WHERE source='XPHB' AND class_key='fighter' AND subclass_name='Battle Master' AND level=3)
 THEN RAISE EXCEPTION 'T15 requires previously installed original T4 Battle Master class feature'; END IF;
END $t15_pre$;
-- T4 already seeded Fighter subclass features and level3. Only level10
-- is absent from the reduced class progression fixture, not from production.
INSERT INTO public.class_level_progression(class_id,class_level,xp_threshold,proficiency_bonus,spell_slots)
VALUES ('00000000-0000-0000-0000-000000000001',10,64000,4,'{}'::jsonb);

CREATE TABLE public.class_feature_option_catalog(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 option_key text NOT NULL UNIQUE,
 option_type text NOT NULL,
 name text NOT NULL,
 source text NOT NULL,
 class_key text,
 feature_types text[] NOT NULL DEFAULT '{}'::text[],
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.character_class_option_grant_instances(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
 instance_key text NOT NULL,
 option_catalog_id uuid NOT NULL REFERENCES public.class_feature_option_catalog(id) ON DELETE RESTRICT,
 option_type text NOT NULL,
 acquired_level integer NOT NULL CHECK (acquired_level BETWEEN 1 AND 20),
 choices jsonb NOT NULL DEFAULT '{}'::jsonb,
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (character_id,instance_key)
);
-- Scratch public tables have no direct browser-role DML. The original
-- private source functions run as SECURITY DEFINER under the local owner.
ALTER TABLE public.class_feature_option_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_class_option_grant_instances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.class_feature_option_catalog,public.character_class_option_grant_instances FROM PUBLIC,anon,authenticated;

INSERT INTO public.class_feature_option_catalog
(id,option_key,option_type,name,source,class_key) VALUES
 ('37457afe-5996-4502-9651-130d25c059e6','optional-feature:ambush|XPHB','battle-master-maneuver','Ambush','XPHB','fighter'),
 ('e50d1c2c-3c17-4fcd-ae00-9df2a4dee83a','optional-feature:bait-and-switch|XPHB','battle-master-maneuver','Bait and Switch','XPHB','fighter'),
 ('cb18f479-a1a1-4455-9db9-c14dd591c9d8','optional-feature:commanders-strike|XPHB','battle-master-maneuver','Commander''s Strike','XPHB','fighter'),
 ('5988a57f-2afb-43e0-b5e1-1a9fe59f215a','optional-feature:commanding-presence|XPHB','battle-master-maneuver','Commanding Presence','XPHB','fighter'),
 ('b3b35d8d-ca6a-471e-9835-3ce5a1ef4666','optional-feature:disarming-attack|XPHB','battle-master-maneuver','Disarming Attack','XPHB','fighter'),
 ('4e6e3e61-f5fc-4d12-ae03-b6220d5b540c','optional-feature:distracting-strike|XPHB','battle-master-maneuver','Distracting Strike','XPHB','fighter'),
 ('f8a5b869-0690-4d6a-97a6-dd3f97219cbc','optional-feature:evasive-footwork|XPHB','battle-master-maneuver','Evasive Footwork','XPHB','fighter'),
 ('cb02ba27-0ba9-41c8-b55e-0a06421da568','optional-feature:feinting-attack|XPHB','battle-master-maneuver','Feinting Attack','XPHB','fighter'),
 ('5af72334-d553-448e-a146-8e8aa270d024','optional-feature:goading-attack|XPHB','battle-master-maneuver','Goading Attack','XPHB','fighter'),
 ('959e68df-9541-4e89-92bb-30c3ec75c0ba','optional-feature:lunging-attack|XPHB','battle-master-maneuver','Lunging Attack','XPHB','fighter'),
 ('689feabb-37c2-4d7e-830a-6e28ecc5a615','optional-feature:maneuvering-attack|XPHB','battle-master-maneuver','Maneuvering Attack','XPHB','fighter'),
 ('59ccbe6c-ccc7-4aab-b363-e20721915f88','optional-feature:menacing-attack|XPHB','battle-master-maneuver','Menacing Attack','XPHB','fighter');

CREATE OR REPLACE FUNCTION private.battle_master_maneuver_count_v1(p_level integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select case
    when greatest(1,least(20,coalesce(p_level,1)))>=15 then 9
    when greatest(1,least(20,coalesce(p_level,1)))>=10 then 7
    when greatest(1,least(20,coalesce(p_level,1)))>=7 then 5
    when greatest(1,least(20,coalesce(p_level,1)))>=3 then 3
    else 0 end;
$function$;

CREATE OR REPLACE FUNCTION private.battle_master_maneuver_slot_level_v1(p_slot integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select case greatest(1,least(9,coalesce(p_slot,1)))
    when 1 then 3 when 2 then 3 when 3 then 3
    when 4 then 7 when 5 then 7
    when 6 then 10 when 7 then 10
    when 8 then 15 when 9 then 15 end;
$function$;

CREATE OR REPLACE FUNCTION private.is_xphb_battle_master_v1(p_class_id uuid, p_subclass_name text, p_subclass_source text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  select exists(
    select 1 from public.class_catalog c
    where c.id=p_class_id and lower(coalesce(c.class_key,''))='fighter' and upper(coalesce(c.source,''))='XPHB'
  )
  and private.normalize_player_choice_name_v1(coalesce(p_subclass_name,''))=private.normalize_player_choice_name_v1('Battle Master')
  and upper(coalesce(nullif(p_subclass_source,''),'XPHB'))='XPHB';
$function$;

CREATE OR REPLACE FUNCTION private.materialize_player_forge_battle_master_maneuvers_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_sheet jsonb:='{}'::jsonb;
  v_expected integer:=0;
  v_selected jsonb:='[]'::jsonb;
  v_names text[]:='{}'::text[];
  v_choice jsonb;
  v_name text;
  v_option public.class_feature_option_catalog%rowtype;
  v_slot integer:=0;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=new.character_id;
  if coalesce(v_sheet#>>'{meta,creator}','')<>'shared_character_forge_player_v2' then return new; end if;

  if not private.is_xphb_battle_master_v1(new.class_id,new.subclass_name,new.subclass_source) then return new; end if;
  v_expected:=private.battle_master_maneuver_count_v1(new.class_level);
  if v_expected<=0 then raise exception 'Battle Master requires Fighter level 3 or higher.'; end if;

  select coalesce(jsonb_agg(sel.value order by grp.key,sel.ord),'[]'::jsonb)
  into v_selected
  from jsonb_each(case when jsonb_typeof(v_sheet->'classFeatureChoices')='object' then v_sheet->'classFeatureChoices' else '{}'::jsonb end) grp
  cross join lateral jsonb_array_elements(case when jsonb_typeof(grp.value->'selections')='array' then grp.value->'selections' else '[]'::jsonb end) with ordinality sel(value,ord)
  where grp.value->>'kind'='battle-master-maneuver'
    and private.normalize_player_choice_name_v1(coalesce(grp.value->>'subclassName','Battle Master'))=private.normalize_player_choice_name_v1('Battle Master');

  if jsonb_array_length(v_selected)<>v_expected then
    raise exception 'Battle Master Fighter level % requires exactly % maneuver choice(s); received %.',new.class_level,v_expected,jsonb_array_length(v_selected);
  end if;

  for v_choice in select value from jsonb_array_elements(v_selected) loop
    v_name:=coalesce(nullif(v_choice->>'name',''),nullif(v_choice->>'label',''),nullif(v_choice->>'value',''),v_choice->>'key','');
    select * into v_option from public.class_feature_option_catalog o
    where o.option_type='battle-master-maneuver' and o.source='XPHB' and lower(coalesce(o.class_key,''))='fighter'
      and private.normalize_player_choice_name_v1(o.name)=private.normalize_player_choice_name_v1(v_name)
    limit 1;
    if not found then raise exception 'Battle Master contains an unknown maneuver choice: %.',v_name; end if;
    if private.normalize_player_choice_name_v1(v_option.name)=any(v_names) then raise exception 'Battle Master maneuver choices must be distinct.'; end if;
    v_names:=array_append(v_names,private.normalize_player_choice_name_v1(v_option.name));
    v_slot:=v_slot+1;
    insert into public.character_class_option_grant_instances(
      character_id,instance_key,option_catalog_id,option_type,acquired_level,choices,metadata,updated_at
    ) values(
      new.character_id,'battle-master-maneuver-slot-'||v_slot::text,v_option.id,'battle-master-maneuver',
      private.battle_master_maneuver_slot_level_v1(v_slot),'{}'::jsonb,
      jsonb_build_object('source','player-forge','family','battle-master-maneuver','slot',v_slot),now()
    );
  end loop;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.validate_existing_battle_master_maneuvers_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_expected integer:=0;
  v_actual integer:=0;
  v_battle_master boolean:=false;
  v_distinct integer:=0;
begin
  v_battle_master:=private.is_xphb_battle_master_v1(new.class_id,new.subclass_name,new.subclass_source);
  select count(*) into v_actual from public.character_class_option_grant_instances g
  where g.character_id=new.character_id and g.option_type='battle-master-maneuver';

  if not v_battle_master then
    if v_actual>0 then raise exception 'A non-Battle-Master progression cannot retain normalized Battle Master maneuver instances.'; end if;
    return new;
  end if;

  v_expected:=private.battle_master_maneuver_count_v1(new.class_level);
  if v_actual<>v_expected then
    raise exception 'Battle Master Fighter level % requires % normalized maneuver instance(s); found %.',new.class_level,v_expected,v_actual;
  end if;
  select count(distinct g.option_catalog_id) into v_distinct
  from public.character_class_option_grant_instances g
  join public.class_feature_option_catalog o on o.id=g.option_catalog_id
  where g.character_id=new.character_id and g.option_type='battle-master-maneuver'
    and o.option_type='battle-master-maneuver' and o.source='XPHB' and lower(coalesce(o.class_key,''))='fighter';
  if v_distinct<>v_expected then raise exception 'Battle Master maneuver instances must be distinct canonical XPHB maneuvers.'; end if;
  return new;
end;
$function$;

CREATE CONSTRAINT TRIGGER character_progression_materialize_battle_master_maneuvers_v1
 AFTER INSERT ON public.character_progression
 DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION private.materialize_player_forge_battle_master_maneuvers_v1();
CREATE CONSTRAINT TRIGGER character_progression_validate_battle_master_maneuvers_v1
 AFTER UPDATE OF class_id,subclass_name,subclass_source,class_level,level_choices
 ON public.character_progression DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION private.validate_existing_battle_master_maneuvers_v1();


REVOKE ALL ON FUNCTION private.is_xphb_battle_master_v1(uuid,text,text),
 private.materialize_player_forge_battle_master_maneuvers_v1(),
 private.validate_existing_battle_master_maneuvers_v1()
 FROM PUBLIC,anon,authenticated;
DO $i1f_verify$
BEGIN
 IF md5(pg_get_functiondef('private.battle_master_maneuver_count_v1(integer)'::regprocedure)) <> '32cbfe62f855affe40443da2fc9d20eb' THEN
    RAISE EXCEPTION 'Original I1-F function source drift: battle_master_maneuver_count_v1'; END IF;
 IF md5(pg_get_functiondef('private.battle_master_maneuver_slot_level_v1(integer)'::regprocedure)) <> '70b3639eb4b6535aab3efbfc80828a0e' THEN
    RAISE EXCEPTION 'Original I1-F function source drift: battle_master_maneuver_slot_level_v1'; END IF;
 IF md5(pg_get_functiondef('private.is_xphb_battle_master_v1(uuid,text,text)'::regprocedure)) <> '17688ec8bceac3c06d58415de20a544b' THEN
    RAISE EXCEPTION 'Original I1-F function source drift: is_xphb_battle_master_v1'; END IF;
 IF md5(pg_get_functiondef('private.materialize_player_forge_battle_master_maneuvers_v1()'::regprocedure)) <> 'daf3fc12e7c30165dca50ca650f9d308' THEN
    RAISE EXCEPTION 'Original I1-F function source drift: materialize_player_forge_battle_master_maneuvers_v1'; END IF;
 IF md5(pg_get_functiondef('private.validate_existing_battle_master_maneuvers_v1()'::regprocedure)) <> '8bc8a467e95b07e93df833bcfc585e80' THEN
    RAISE EXCEPTION 'Original I1-F function source drift: validate_existing_battle_master_maneuvers_v1'; END IF;
END $i1f_verify$;
DO $t15_post$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgenabled='O' AND c.relname IN
 ('character_progression','character_sheets','characters','inventory_items');
 IF n<>27 THEN RAISE EXCEPTION 'T15 requires 24 original +3 held, got %',n; END IF;
 IF has_table_privilege('authenticated','public.character_class_option_grant_instances','INSERT')
 OR has_table_privilege('anon','public.character_class_option_grant_instances','SELECT')
 THEN RAISE EXCEPTION 'T15 reduced normalized grant table cannot be user-writable/public'; END IF;
END $t15_post$;
\echo 'PASS C34-T15 five unchanged source-original Battle Master functions, 12 source options and paired deferred DDL; 24/31 original (local only)'
