-- I1-F source-original Battle Master helpers/handlers captured via read-only SELECT
-- from DnDWeb PostgreSQL17 pg_get_functiondef on November 9, 2026 local.
-- Unmodified original function bodies, exact MD5 verified below.
-- RESEARCH FIXTURE ONLY; NEVER RUN AGAINST HOSTED OR PRODUCTION DATABASE.
\set ON_ERROR_STOP on

-- private.battle_master_maneuver_count_v1(integer) exact original md5 32cbfe62f855affe40443da2fc9d20eb
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

-- private.battle_master_maneuver_slot_level_v1(integer) exact original md5 70b3639eb4b6535aab3efbfc80828a0e
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

-- private.is_xphb_battle_master_v1(uuid,text,text) exact original md5 17688ec8bceac3c06d58415de20a544b
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

-- private.materialize_player_forge_battle_master_maneuvers_v1() exact original md5 daf3fc12e7c30165dca50ca650f9d308
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

-- private.validate_existing_battle_master_maneuvers_v1() exact original md5 8bc8a467e95b07e93df833bcfc585e80
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
\echo 'PASS I1F SOURCE: five original Battle Master functions unchanged against live source MD5'
