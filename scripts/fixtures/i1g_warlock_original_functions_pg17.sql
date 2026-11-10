-- I1-G: original DnDWeb PG17 Warlock deferred safeguard function bodies.
-- SELECT-only pg_get_functiondef source capture; exact original MD5s checked.
-- Research fixture ONLY, never execute against hosted Supabase.
\set ON_ERROR_STOP on

-- Original xphb_warlock_invocation_count_v1 61c83f0172b33386f0a50435c2fe1ddb
CREATE OR REPLACE FUNCTION private.xphb_warlock_invocation_count_v1(p_level integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select case
    when greatest(1,least(20,coalesce(p_level,1))) >= 18 then 10
    when greatest(1,least(20,coalesce(p_level,1))) >= 15 then 9
    when greatest(1,least(20,coalesce(p_level,1))) >= 12 then 8
    when greatest(1,least(20,coalesce(p_level,1))) >= 9 then 7
    when greatest(1,least(20,coalesce(p_level,1))) >= 7 then 6
    when greatest(1,least(20,coalesce(p_level,1))) >= 5 then 5
    when greatest(1,least(20,coalesce(p_level,1))) >= 2 then 3
    else 1 end;
$function$;

-- Original reject_unmarked_legacy_warlock_invocations_v1 631fbb585f47e71a619ca8ac8e212407
CREATE OR REPLACE FUNCTION private.reject_unmarked_legacy_warlock_invocations_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_sheet jsonb := '{}'::jsonb;
  v_class_key text := '';
  v_class_source text := '';
  v_source_count integer := 0;
  v_legacy_bucket boolean := false;
  v_server_legacy boolean := false;
begin
  select coalesce(cs.sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets cs
  where cs.character_id = new.character_id;

  if coalesce(v_sheet #>> '{meta,creator}','') <> 'shared_character_forge_player_v2' then return new; end if;

  select lower(coalesce(cc.class_key,'')), upper(coalesce(cc.source,''))
  into v_class_key,v_class_source
  from public.class_catalog cc
  where cc.id = new.class_id;

  if v_class_key <> 'warlock' or v_class_source <> 'XPHB' then return new; end if;

  select count(*) into v_source_count
  from jsonb_each(case when jsonb_typeof(v_sheet->'sourceChoices')='object' then v_sheet->'sourceChoices' else '{}'::jsonb end) entry
  where entry.value->>'ownerType'='class-option'
    and entry.value #>> '{metadata,family}'='eldritch-invocation';

  select exists(
    select 1
    from jsonb_each(case when jsonb_typeof(v_sheet->'classFeatureChoices')='object' then v_sheet->'classFeatureChoices' else '{}'::jsonb end) legacy
    where legacy.value->>'kind'='eldritch-invocation'
  ) into v_legacy_bucket;

  select exists(
    select 1 from private.player_forge_source_choice_legacy_v1 legacy
    where legacy.character_id = new.character_id
  ) into v_server_legacy;

  if v_source_count = 0 and v_legacy_bucket and not v_server_legacy then
    raise exception 'New XPHB Warlocks must use source-owned Eldritch Invocation instances; the legacy classFeatureChoices shape is not accepted.';
  end if;

  return new;
end;
$function$;

-- Original validate_existing_normalized_warlock_invocations_v2 4f1752db655b6ba490113f604c7583ef
CREATE OR REPLACE FUNCTION private.validate_existing_normalized_warlock_invocations_v2()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_sheet jsonb:='{}'::jsonb;
  v_class public.class_catalog%rowtype;
  v_expected integer:=0;
  v_actual integer:=0;
  v_selected_names text[]:='{}'::text[];
  v_seen_nonrepeatable text[]:='{}'::text[];
  v_seen_children text[]:='{}'::text[];
  v_row record;
  v_requirement text;
  v_child_kind text;
  v_child_key text;
  v_child_token text;
  v_spell public.spells_catalog%rowtype;
  v_spell_id uuid;
  v_feat_id uuid;
begin
  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=new.character_id;
  if coalesce(v_sheet#>>'{meta,creator}','')<>'shared_character_forge_player_v2' then return new; end if;

  select * into v_class from public.class_catalog where id=new.class_id;
  if not found then return new; end if;

  select count(*) into v_actual
  from public.character_class_option_grant_instances g
  where g.character_id=new.character_id and g.option_type='eldritch-invocation';

  if lower(coalesce(v_class.class_key,''))<>'warlock' or upper(coalesce(v_class.source,''))<>'XPHB' then
    if v_actual>0 then raise exception 'A non-Warlock progression cannot retain normalized Eldritch Invocation instances.'; end if;
    return new;
  end if;

  v_expected:=private.xphb_warlock_invocation_count_v1(new.class_level);
  if v_actual<>v_expected then
    raise exception 'Warlock level % requires exactly % normalized Invocation instance(s); found %.',new.class_level,v_expected,v_actual;
  end if;

  select coalesce(array_agg(private.normalize_player_choice_name_v1(o.name) order by g.instance_key),'{}'::text[])
  into v_selected_names
  from public.character_class_option_grant_instances g
  join public.class_feature_option_catalog o on o.id=g.option_catalog_id
  where g.character_id=new.character_id and g.option_type='eldritch-invocation';

  for v_row in
    select g.*,o.name,o.source,o.class_key,o.repeatable,o.prerequisites,o.choice_schema
    from public.character_class_option_grant_instances g
    join public.class_feature_option_catalog o on o.id=g.option_catalog_id
    where g.character_id=new.character_id and g.option_type='eldritch-invocation'
    order by g.instance_key
  loop
    if v_row.source<>'XPHB' or lower(coalesce(v_row.class_key,''))<>'warlock' then
      raise exception 'Normalized Invocation % is not a canonical XPHB Warlock option.',v_row.instance_key;
    end if;
    if coalesce((v_row.prerequisites->>'minClassLevel')::integer,1)>new.class_level then
      raise exception '% is not legal at Warlock level %.',v_row.name,new.class_level;
    end if;
    if not v_row.repeatable then
      if private.normalize_player_choice_name_v1(v_row.name)=any(v_seen_nonrepeatable) then raise exception '% is not repeatable.',v_row.name; end if;
      v_seen_nonrepeatable:=array_append(v_seen_nonrepeatable,private.normalize_player_choice_name_v1(v_row.name));
    end if;
    for v_requirement in select value from jsonb_array_elements_text(coalesce(v_row.prerequisites->'requiresOptions','[]'::jsonb))
    loop
      if not(private.normalize_player_choice_name_v1(v_requirement)=any(v_selected_names)) then
        raise exception '% requires % to be part of the current Invocation set.',v_row.name,v_requirement;
      end if;
    end loop;

    v_child_kind:=coalesce(v_row.choice_schema->>'kind','');
    v_child_key:=coalesce(v_row.choices#>>'{child,value}',v_row.choices#>>'{child,key}','');
    if v_child_kind in ('warlock-damage-cantrip','warlock-attack-cantrip') then
      if v_child_key='' then raise exception '% requires an affected cantrip.',v_row.name; end if;
      begin v_spell_id:=v_child_key::uuid; exception when others then raise exception '% contains an invalid affected cantrip.',v_row.name; end;
      select * into v_spell from public.spells_catalog s where s.id=v_spell_id and public.is_preferred_spell_version_v1(s.id);
      if not found or v_spell.level<>0
         or not exists(select 1 from unnest(coalesce(v_spell.classes,'{}'::text[])) c where lower(c)='warlock')
         or (coalesce(array_length(v_spell.damage_types,1),0)=0 and coalesce(v_spell.damage_dice,'')='') then
        raise exception '% requires a preferred Warlock damage cantrip.',v_row.name;
      end if;
      if v_child_kind='warlock-attack-cantrip' and coalesce(btrim(v_spell.attack_type),'')='' then raise exception '% requires an attack-roll cantrip.',v_row.name; end if;
      if coalesce((v_row.choice_schema->>'minRangeFeet')::integer,0)>0 and not(
        (lower(coalesce(v_spell.range_unit,'')) in ('feet','foot','ft') and coalesce(v_spell.range_distance,0)>=(v_row.choice_schema->>'minRangeFeet')::integer)
        or (lower(coalesce(v_spell.range_unit,'')) in ('mile','miles') and coalesce(v_spell.range_distance,0)>0)
      ) then raise exception '% requires a cantrip with sufficient range.',v_row.name; end if;
      v_child_token:=private.normalize_player_choice_name_v1(v_row.name)||'|'||v_spell.id::text;
      if coalesce((v_row.choice_schema->>'distinctPerRepeat')::boolean,false) and v_child_token=any(v_seen_children) then
        raise exception 'Repeated % instances must use different dependent choices.',v_row.name;
      end if;
      v_seen_children:=array_append(v_seen_children,v_child_token);
    elsif v_child_kind='origin-feat' then
      if v_child_key='' then raise exception '% requires an Origin feat.',v_row.name; end if;
      begin v_feat_id:=v_child_key::uuid; exception when others then raise exception '% contains an invalid Origin feat id.',v_row.name; end;
      if not exists(
        select 1 from public.character_option_catalog_preferred f
        where f.id=v_feat_id and f.option_type='feat' and f.category=coalesce(v_row.choice_schema->>'category','O')
      ) then raise exception '% requires a source-valid Origin feat.',v_row.name; end if;
      if not exists(
        select 1 from public.character_option_grant_instances gi
        where gi.character_id=new.character_id
          and gi.acquisition_owner_type='class-option'
          and gi.acquisition_owner_key=v_row.instance_key
          and gi.option_id=v_feat_id
      ) then raise exception '% is missing its owned Origin feat instance.',v_row.name; end if;
      v_child_token:=private.normalize_player_choice_name_v1(v_row.name)||'|'||v_feat_id::text;
      if coalesce((v_row.choice_schema->>'distinctPerRepeat')::boolean,false) and v_child_token=any(v_seen_children) then
        raise exception 'Repeated % instances must use different dependent choices.',v_row.name;
      end if;
      v_seen_children:=array_append(v_seen_children,v_child_token);
    elsif v_child_key<>'' then
      raise exception '% does not accept a persistent dependent choice.',v_row.name;
    end if;
  end loop;
  return new;
end;
$function$;

DO $verify_i1g_source$
BEGIN
 IF md5(pg_get_functiondef('private.xphb_warlock_invocation_count_v1(integer)'::regprocedure)) <> '61c83f0172b33386f0a50435c2fe1ddb' THEN
   RAISE EXCEPTION 'I1-G original Warlock source drift: xphb_warlock_invocation_count_v1'; END IF;
 IF md5(pg_get_functiondef('private.reject_unmarked_legacy_warlock_invocations_v1()'::regprocedure)) <> '631fbb585f47e71a619ca8ac8e212407' THEN
   RAISE EXCEPTION 'I1-G original Warlock source drift: reject_unmarked_legacy_warlock_invocations_v1'; END IF;
 IF md5(pg_get_functiondef('private.validate_existing_normalized_warlock_invocations_v2()'::regprocedure)) <> '4f1752db655b6ba490113f604c7583ef' THEN
   RAISE EXCEPTION 'I1-G original Warlock source drift: validate_existing_normalized_warlock_invocations_v2'; END IF;
 IF md5(pg_get_functiondef('private.normalize_player_choice_name_v1(text)'::regprocedure)) <> 'dd8cdd5b47efe99b1cfff9c2bf7635dd'
 THEN RAISE EXCEPTION 'I1-G original choice normalizer source drift'; END IF;
END $verify_i1g_source$;
\echo 'PASS I1G SOURCE: three original Warlock invocation guard and level-count functions source-MD5 pinned'
