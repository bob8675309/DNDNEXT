-- I1-G ORIGINAL WARLOCK ACQUISITION. Read-only pg_get_functiondef capture.
-- Unmodified live function bodies, MD5 verified on disposable PG17 only.
-- Do NOT use as hosted migration.
\set ON_ERROR_STOP on

-- live original source xphb_warlock_invocation_slot_level_v1, md5 942dd3a4e08b8874f3e42cbbb8323038
CREATE OR REPLACE FUNCTION private.xphb_warlock_invocation_slot_level_v1(p_slot integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select case greatest(1,least(10,coalesce(p_slot,1)))
    when 1 then 1 when 2 then 2 when 3 then 2 when 4 then 5 when 5 then 5
    when 6 then 7 when 7 then 9 when 8 then 12 when 9 then 15 when 10 then 18 end;
$function$;

-- live original source validate_and_materialize_player_forge_class_options_v1, md5 6df5aee6f0519c9c77758d6e887ed8e4
CREATE OR REPLACE FUNCTION private.validate_and_materialize_player_forge_class_options_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_sheet jsonb := '{}'::jsonb;
  v_choices jsonb := '{}'::jsonb;
  v_class_key text;
  v_class_source text;
  v_expected integer := 0;
  v_slot integer;
  v_slot_level integer;
  v_group_key text;
  v_group jsonb;
  v_invocation_field jsonb;
  v_invocation_selection jsonb;
  v_option public.class_feature_option_catalog%rowtype;
  v_option_key text;
  v_requirement text;
  v_selected_names text[] := '{}'::text[];
  v_seen_children text[] := '{}'::text[];
  v_child_kind text;
  v_child_field jsonb;
  v_child_selection jsonb;
  v_child_key text;
  v_child_token text;
  v_spell_id uuid;
  v_spell public.spells_catalog%rowtype;
  v_feat_id uuid;
  v_legacy boolean := false;
  v_class_option_group_count integer := 0;
begin
  select coalesce(cs.sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets cs where cs.character_id=new.character_id;
  if coalesce(v_sheet #>> '{meta,creator}','') <> 'shared_character_forge_player_v2' then return new; end if;

  select lower(cc.class_key), upper(cc.source) into v_class_key,v_class_source
  from public.class_catalog cc where cc.id=new.class_id;
  v_choices := case when jsonb_typeof(v_sheet->'sourceChoices')='object' then v_sheet->'sourceChoices' else '{}'::jsonb end;

  select count(*) into v_class_option_group_count
  from jsonb_each(v_choices) entry
  where entry.value->>'ownerType'='class-option'
    and entry.value #>> '{metadata,family}'='eldritch-invocation';

  if v_class_key <> 'warlock' or v_class_source <> 'XPHB' then
    if v_class_option_group_count > 0 then
      raise exception 'Eldritch Invocation source choices are only valid for an XPHB Warlock.';
    end if;
    return new;
  end if;

  select exists(
    select 1 from jsonb_each(case when jsonb_typeof(v_sheet->'classFeatureChoices')='object' then v_sheet->'classFeatureChoices' else '{}'::jsonb end) legacy
    where legacy.value->>'kind'='eldritch-invocation'
  ) or exists(
    select 1 from private.player_forge_source_choice_legacy_v1 legacy where legacy.character_id=new.character_id
  ) into v_legacy;

  v_expected := private.xphb_warlock_invocation_count_v1(new.class_level);
  if v_class_option_group_count=0 and v_legacy then return new; end if;
  if v_class_option_group_count <> v_expected then
    raise exception 'Warlock level % requires exactly % source-owned Eldritch Invocation instance(s); received %.',new.class_level,v_expected,v_class_option_group_count;
  end if;

  delete from public.character_class_option_grant_instances
  where character_id=new.character_id and option_type='eldritch-invocation';

  for v_slot in 1..v_expected loop
    v_slot_level := private.xphb_warlock_invocation_slot_level_v1(v_slot);
    v_group_key := 'warlock-invocation-slot-' || v_slot::text;
    v_group := v_choices -> v_group_key;
    if jsonb_typeof(v_group) <> 'object'
       or v_group->>'ownerType' <> 'class-option'
       or v_group #>> '{metadata,family}' <> 'eldritch-invocation'
       or coalesce((v_group #>> '{metadata,slot}')::integer,0) <> v_slot
       or coalesce((v_group #>> '{metadata,acquisitionLevel}')::integer,0) <> v_slot_level
       or coalesce((v_group->>'level')::integer,0) <> v_slot_level
       or v_group->>'placement' <> 'class' then
      raise exception 'Warlock Invocation instance % has an invalid source-owned group shape.',v_slot;
    end if;

    v_invocation_field := v_group #> '{fields,invocation}';
    if jsonb_typeof(v_invocation_field) <> 'object'
       or jsonb_typeof(coalesce(v_invocation_field->'selections','[]'::jsonb)) <> 'array'
       or jsonb_array_length(coalesce(v_invocation_field->'selections','[]'::jsonb)) <> 1 then
      raise exception 'Warlock Invocation instance % requires exactly one Invocation selection.',v_slot;
    end if;
    v_invocation_selection := (v_invocation_field->'selections')->0;
    v_option_key := coalesce(v_invocation_selection->>'key','');
    select * into v_option from public.class_feature_option_catalog o
    where o.option_key=v_option_key and o.option_type='eldritch-invocation'
      and o.source='XPHB' and lower(coalesce(o.class_key,''))='warlock';
    if not found then raise exception 'Warlock Invocation instance % contains an unknown Invocation option.',v_slot; end if;
    if coalesce((v_option.prerequisites->>'minClassLevel')::integer,1) > v_slot_level then
      raise exception '% is not available at the acquisition level for Invocation slot %.',v_option.name,v_slot;
    end if;
    if not v_option.repeatable and private.normalize_player_choice_name_v1(v_option.name)=any(v_selected_names) then
      raise exception '% is not repeatable and cannot fill multiple Invocation slots.',v_option.name;
    end if;
    for v_requirement in select value from jsonb_array_elements_text(coalesce(v_option.prerequisites->'requiresOptions','[]'::jsonb)) loop
      if not (private.normalize_player_choice_name_v1(v_requirement)=any(v_selected_names)) then
        raise exception '% requires % to have been acquired in an earlier Invocation slot.',v_option.name,v_requirement;
      end if;
    end loop;

    v_child_kind := coalesce(v_option.choice_schema->>'kind','');
    v_child_field := null;
    select field.value into v_child_field
    from jsonb_each(case when jsonb_typeof(v_group->'fields')='object' then v_group->'fields' else '{}'::jsonb end) field
    where field.key <> 'invocation'
      and exists(
        select 1 from jsonb_array_elements_text(coalesce(field.value #> '{activeWhen,values}','[]'::jsonb)) active_key
        where active_key=v_option.option_key
      )
    limit 1;

    if v_child_kind in ('warlock-damage-cantrip','warlock-attack-cantrip','origin-feat') then
      if jsonb_typeof(v_child_field) <> 'object'
         or jsonb_array_length(coalesce(v_child_field->'selections','[]'::jsonb)) <> 1 then
        raise exception '% requires exactly one dependent source choice.',v_option.name;
      end if;
      v_child_selection := (v_child_field->'selections')->0;
      v_child_key := coalesce(v_child_selection->>'value',v_child_selection->>'key','');
      v_child_token := private.normalize_player_choice_name_v1(v_option.name) || '|' || v_child_key;
      if coalesce((v_option.choice_schema->>'distinctPerRepeat')::boolean,false) and v_child_token=any(v_seen_children) then
        raise exception 'Repeated % instances must use different dependent choices.',v_option.name;
      end if;
      v_seen_children := array_append(v_seen_children,v_child_token);

      if v_child_kind in ('warlock-damage-cantrip','warlock-attack-cantrip') then
        begin v_spell_id := v_child_key::uuid; exception when others then raise exception '% requires a valid cantrip id.',v_option.name; end;
        select * into v_spell from public.spells_catalog s where s.id=v_spell_id;
        if not found or not public.is_preferred_spell_version_v1(v_spell.id)
           or v_spell.level<>0
           or not exists(select 1 from unnest(coalesce(v_spell.classes,'{}'::text[])) c where lower(c)='warlock')
           or (coalesce(array_length(v_spell.damage_types,1),0)=0 and coalesce(v_spell.damage_dice,'')='') then
          raise exception '% requires a preferred Warlock damage cantrip.',v_option.name;
        end if;
        if v_child_kind='warlock-attack-cantrip' and coalesce(btrim(v_spell.attack_type),'')='' then
          raise exception '% requires a Warlock cantrip that deals damage with an attack roll.',v_option.name;
        end if;
        if coalesce((v_option.choice_schema->>'minRangeFeet')::integer,0)>0 then
          if lower(coalesce(v_spell.range_unit,'')) in ('feet','foot','ft') then
            if coalesce(v_spell.range_distance,0) < (v_option.choice_schema->>'minRangeFeet')::integer then raise exception '% requires a cantrip with sufficient range.',v_option.name; end if;
          elsif lower(coalesce(v_spell.range_unit,'')) in ('mile','miles') then
            if coalesce(v_spell.range_distance,0)<=0 then raise exception '% requires a cantrip with sufficient range.',v_option.name; end if;
          else
            raise exception '% requires a cantrip with a measurable range.',v_option.name;
          end if;
        end if;
      elsif v_child_kind='origin-feat' then
        begin v_feat_id := v_child_key::uuid; exception when others then raise exception 'Lessons of the First Ones requires a valid Origin feat id.'; end;
        if not exists(select 1 from public.character_option_catalog_preferred f where f.id=v_feat_id and f.option_type='feat' and f.category=coalesce(v_option.choice_schema->>'category','O')) then
          raise exception 'Lessons of the First Ones requires a source-valid Origin feat.';
        end if;
        if not exists(
          select 1 from jsonb_array_elements(coalesce(v_sheet->'featGrantInstances','[]'::jsonb)) instance
          where instance->>'acquisitionOwnerType'='class-option'
            and instance->>'acquisitionOwnerKey'=v_group_key
            and instance->>'optionId'=v_feat_id::text
        ) then
          raise exception 'Lessons of the First Ones feat instance must match its Invocation source choice.';
        end if;
      end if;
    else
      if exists(
        select 1 from jsonb_each(case when jsonb_typeof(v_group->'fields')='object' then v_group->'fields' else '{}'::jsonb end) field
        where field.key<>'invocation' and jsonb_array_length(coalesce(field.value->'selections','[]'::jsonb))>0
      ) then
        raise exception '% does not accept a permanent dependent creation choice.',v_option.name;
      end if;
      v_child_selection := null;
    end if;

    insert into public.character_class_option_grant_instances(
      character_id,instance_key,option_catalog_id,option_type,acquired_level,choices,metadata,updated_at
    ) values(
      new.character_id,v_group_key,v_option.id,'eldritch-invocation',v_slot_level,
      case when v_child_selection is null then '{}'::jsonb else jsonb_build_object('child',v_child_selection) end,
      jsonb_build_object('source','player-forge','slot',v_slot,'family','eldritch-invocation'),now()
    );
    v_selected_names := array_append(v_selected_names,private.normalize_player_choice_name_v1(v_option.name));
  end loop;
  return new;
end;
$function$;

DO $original_acquisition_guard$
BEGIN
 IF md5(pg_get_functiondef('private.xphb_warlock_invocation_slot_level_v1(integer)'::regprocedure)) <> '942dd3a4e08b8874f3e42cbbb8323038'
 THEN RAISE EXCEPTION 'I1-G source-original acquisition drift: xphb_warlock_invocation_slot_level_v1'; END IF;
 IF md5(pg_get_functiondef('private.validate_and_materialize_player_forge_class_options_v1()'::regprocedure)) <> '6df5aee6f0519c9c77758d6e887ed8e4'
 THEN RAISE EXCEPTION 'I1-G source-original acquisition drift: validate_and_materialize_player_forge_class_options_v1'; END IF;
END $original_acquisition_guard$;
\echo 'PASS I1G ACQUISITION: unchanged original deferred source-choice grant materializer and Warlock slot helper'
