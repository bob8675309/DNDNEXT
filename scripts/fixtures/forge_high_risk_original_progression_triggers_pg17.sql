-- Live source-original three high-risk progression triggers read-only 2026-11-05.
-- Captured from pg_get_functiondef of live DnDWeb PG17, no modifications.
-- Disposable J103+ research fixture only; never deploy to production.

-- private.materialize_player_forge_source_magic_v1() MD5 4c35eaab8dff7d3d15b64ed71881d4a6
CREATE OR REPLACE FUNCTION private.materialize_player_forge_source_magic_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_sheet jsonb;
  v_source_choices jsonb;
  v_group_key text;
  v_group jsonb;
  v_field_key text;
  v_field jsonb;
  v_selection jsonb;
  v_owner_type text;
  v_owner_key text;
  v_character_level integer;
  v_class_ability text;
  v_casting_stat text;
  v_species public.character_option_catalog%rowtype;
  v_trait jsonb;
  v_spell public.spells_catalog%rowtype;
  v_spell_id uuid;
  v_min_level integer;
  v_choice_limit integer;
  v_selected_count integer;
  v_expected_count integer;
  v_spell_token text[];
  v_token_name text;
  v_uses integer;
  v_recharge text;
  v_instance public.character_option_grant_instances%rowtype;
  v_feat public.character_option_catalog%rowtype;
  v_choices jsonb;
  v_list text;
  v_college text;
  v_background text;
  v_cantrip_names text[];
  v_spell_classes text[];
  v_active_field text;
begin
  select coalesce(cs.sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets cs
  where cs.character_id=new.character_id;
  if coalesce(v_sheet #>> '{meta,creator}','') <> 'shared_character_forge_player_v2' then return new; end if;
  v_source_choices := coalesce(v_sheet->'sourceChoices','{}'::jsonb);
  if jsonb_typeof(v_source_choices) <> 'object' then raise exception 'Forge sourceChoices must be an object.'; end if;
  v_character_level := greatest(1, least(20, coalesce(nullif(v_sheet->>'level','')::integer, new.class_level, 1)));
  select c.spellcasting_ability into v_class_ability from public.class_catalog c where c.id=new.class_id;

  for v_group_key, v_group in select key,value from jsonb_each(v_source_choices) loop
    if coalesce(v_group->>'placement','') <> 'spells' then continue; end if;
    v_owner_type := lower(coalesce(v_group->>'ownerType',''));
    v_owner_key := coalesce(v_group->>'ownerKey','');

    if v_owner_type='species' then
      begin
        select * into v_species from public.character_option_catalog o
        where o.id=v_owner_key::uuid and o.option_type='species';
      exception when invalid_text_representation then
        raise exception 'Species source magic has an invalid canonical owner.';
      end;
      if not found then raise exception 'Species source magic does not reference a canonical species.'; end if;
      if private.normalize_player_choice_name_v1(v_species.name) <> private.normalize_player_choice_name_v1(coalesce(v_sheet->>'species',v_sheet->>'race',v_sheet #>> '{meta,species}',''))
         or upper(v_species.source) <> upper(coalesce(v_sheet #>> '{meta,speciesSource}',v_species.source)) then
        raise exception 'Species source magic does not match the selected species.';
      end if;
      select value into v_trait
      from jsonb_array_elements(coalesce(v_species.metadata->'traits','[]'::jsonb))
      where private.normalize_player_choice_name_v1(value->>'name') = private.normalize_player_choice_name_v1(v_group->>'label')
      limit 1;
      if v_trait is null then raise exception 'Species source magic feature % was not found in the canonical species.', v_group->>'label'; end if;
      if lower(v_trait::text) like '%intelligence%' and lower(v_trait::text) like '%wisdom%' and lower(v_trait::text) like '%charisma%' then
        v_casting_stat := private.player_forge_best_casting_ability_v1(v_sheet,array['int','wis','cha'],v_class_ability);
      else
        v_casting_stat := null;
      end if;
      v_selected_count := 0;
      for v_field_key, v_field in select key,value from jsonb_each(coalesce(v_group->'fields','{}'::jsonb)) loop
        if coalesce(v_field->>'kind','') <> 'spell' then continue; end if;
        if jsonb_typeof(coalesce(v_field->'selections','[]'::jsonb)) <> 'array' then raise exception 'Species spell selections must be arrays.'; end if;
        v_selected_count := v_selected_count + jsonb_array_length(coalesce(v_field->'selections','[]'::jsonb));
        for v_selection in select value from jsonb_array_elements(coalesce(v_field->'selections','[]'::jsonb)) loop
          begin
            v_spell_id := coalesce(nullif(v_selection #>> '{metadata,spellId}',''),nullif(v_selection->>'value',''),nullif(v_selection->>'key',''))::uuid;
          exception when invalid_text_representation then raise exception 'Species source magic contains an invalid spell id.'; end;
          select * into v_spell from public.spells_catalog s where s.id=v_spell_id and public.is_preferred_spell_version_v1(s.id);
          if not found then raise exception 'Species source magic contains an unavailable spell.'; end if;
          if not private.player_forge_trait_has_spell_v1(v_trait,v_spell.name) then raise exception '% is not granted by species feature %.',v_spell.name,v_group->>'label'; end if;
          v_min_level := private.player_forge_json_spell_min_level_v1(coalesce(v_species.raw_payload->'additionalSpells',v_species.metadata->'additionalSpells','[]'::jsonb),v_spell.name,1);
          v_min_level := coalesce(v_min_level,1);
          if v_character_level < v_min_level then raise exception '% is not granted by % until level %.',v_spell.name,v_group->>'label',v_min_level; end if;
          v_uses := null;
          v_recharge := null;
          if v_spell.level>0 and lower(v_trait::text) like '%long rest%' and (lower(v_trait::text) like '%once%' or lower(v_trait::text) like '%can''t cast%again%') then
            v_uses := 1;
            v_recharge := 'long-rest';
          end if;
          perform private.upsert_player_forge_source_magic_spell_v1(
            new.character_id,v_spell.id,'species',v_group_key,coalesce(v_group->>'label',v_species.name),v_casting_stat,v_uses,v_recharge,
            jsonb_build_object('sourceOwner','species','sourceOptionId',v_species.id,'sourceFeature',v_group->>'label','grantedAtLevel',v_min_level,'automaticCastingAbility',v_casting_stat is not null)
          );
        end loop;
      end loop;
      v_choice_limit := private.player_forge_species_spell_choice_limit_v1(v_trait);
      if v_choice_limit is not null then
        if v_selected_count <> v_choice_limit then raise exception 'Species feature % requires exactly % spell choice(s).',v_group->>'label',v_choice_limit; end if;
      else
        v_expected_count := 0;
        for v_spell_token in select distinct regexp_matches(v_trait::text, E'\\{@spell\\s+([^}|]+)', 'gi') loop
          v_token_name := v_spell_token[1];
          v_min_level := private.player_forge_json_spell_min_level_v1(coalesce(v_species.raw_payload->'additionalSpells',v_species.metadata->'additionalSpells','[]'::jsonb),v_token_name,1);
          if coalesce(v_min_level,1) <= v_character_level then v_expected_count := v_expected_count + 1; end if;
        end loop;
        if v_expected_count>0 and v_selected_count<>v_expected_count then raise exception 'Species feature % requires all % currently granted spell(s).',v_group->>'label',v_expected_count; end if;
      end if;

    elsif v_owner_type='feat' then
      select gi.* into v_instance
      from public.character_option_grant_instances gi
      where gi.character_id=new.character_id and gi.instance_key=v_owner_key;
      if not found then raise exception 'Feat source magic instance % was not materialized.',v_owner_key; end if;
      select * into v_feat from public.character_option_catalog o where o.id=v_instance.option_id and o.option_type='feat';
      if not found then raise exception 'Feat source magic references an unavailable feat.'; end if;
      v_choices := coalesce(v_instance.choices,'{}'::jsonb);

      if private.normalize_player_choice_name_v1(v_feat.name)='magic initiate' then
        perform private.validate_source_owned_origin_feat_v1(new.character_id,v_character_level,v_feat.id,jsonb_build_object('choices',v_choices));
        v_list := lower(coalesce((v_choices->'spell-list'->0)->>'value',(v_choices->'spell-list'->0)->>'label',''));
        v_casting_stat := lower(coalesce((v_choices->'spellcasting-ability'->0)->>'value',''));
        v_active_field := 'cantrips-'||v_list;
        for v_selection in select value from jsonb_array_elements(v_choices->v_active_field) loop
          v_spell := private.origin_feat_spell_choice_v1(v_selection);
          perform private.upsert_player_forge_source_magic_spell_v1(new.character_id,v_spell.id,'feat',v_owner_key,v_feat.name,v_casting_stat,null,null,
            jsonb_build_object('sourceOwner','feat','featName',v_feat.name,'featOptionId',v_feat.id,'spellList',v_list,'grantedAtLevel',v_instance.acquisition_level,'automaticCastingAbility',true));
        end loop;
        v_active_field := 'level-1-'||v_list;
        v_spell := private.origin_feat_spell_choice_v1(v_choices->v_active_field->0);
        perform private.upsert_player_forge_source_magic_spell_v1(new.character_id,v_spell.id,'feat',v_owner_key,v_feat.name,v_casting_stat,1,'long-rest',
          jsonb_build_object('sourceOwner','feat','featName',v_feat.name,'featOptionId',v_feat.id,'spellList',v_list,'grantedAtLevel',v_instance.acquisition_level,'freeCast',true,'automaticCastingAbility',true));

      elsif private.normalize_player_choice_name_v1(v_feat.name)='strixhaven initiate' then
        v_background := lower(coalesce(v_sheet->>'background',v_sheet #>> '{meta,background}',''));
        v_college := case
          when v_instance.acquisition_owner_type='background' and v_background like '%lorehold%' then 'lorehold'
          when v_instance.acquisition_owner_type='background' and v_background like '%prismari%' then 'prismari'
          when v_instance.acquisition_owner_type='background' and v_background like '%quandrix%' then 'quandrix'
          when v_instance.acquisition_owner_type='background' and v_background like '%silverquill%' then 'silverquill'
          when v_instance.acquisition_owner_type='background' and v_background like '%witherbloom%' then 'witherbloom'
          else lower(coalesce((v_choices->'college'->0)->>'value',(v_choices->'college'->0)->>'label',''))
        end;
        if v_college not in ('lorehold','prismari','quandrix','silverquill','witherbloom') then raise exception 'Strixhaven Initiate requires a source-valid college.'; end if;
        v_cantrip_names := case v_college
          when 'lorehold' then array['light','sacred flame','thaumaturgy']
          when 'prismari' then array['fire bolt','prestidigitation','ray of frost']
          when 'quandrix' then array['druidcraft','guidance','mage hand']
          when 'silverquill' then array['sacred flame','thaumaturgy','vicious mockery']
          else array['chill touch','druidcraft','spare the dying'] end;
        v_spell_classes := case v_college
          when 'lorehold' then array['cleric','wizard']
          when 'prismari' then array['bard','sorcerer']
          when 'quandrix' then array['druid','wizard']
          when 'silverquill' then array['bard','cleric']
          else array['druid','wizard'] end;
        v_active_field := 'cantrips-'||v_college;
        if jsonb_array_length(coalesce(v_choices->v_active_field,'[]'::jsonb))<>2 then raise exception 'Strixhaven Initiate requires exactly two % cantrips.',initcap(v_college); end if;
        v_casting_stat := private.player_forge_best_casting_ability_v1(v_sheet,array['int','wis','cha'],v_class_ability);
        for v_selection in select value from jsonb_array_elements(v_choices->v_active_field) loop
          v_spell := private.origin_feat_spell_choice_v1(v_selection);
          if v_spell.level<>0 or not (lower(v_spell.name)=any(v_cantrip_names)) then raise exception '% is not a valid % Strixhaven Initiate cantrip.',v_spell.name,initcap(v_college); end if;
          perform private.upsert_player_forge_source_magic_spell_v1(new.character_id,v_spell.id,'feat',v_owner_key,v_feat.name,v_casting_stat,null,null,
            jsonb_build_object('sourceOwner','feat','featName',v_feat.name,'featOptionId',v_feat.id,'college',initcap(v_college),'grantedAtLevel',v_instance.acquisition_level,'automaticCastingAbility',true));
        end loop;
        v_active_field := 'level-1-'||v_college;
        if jsonb_array_length(coalesce(v_choices->v_active_field,'[]'::jsonb))<>1 then raise exception 'Strixhaven Initiate requires exactly one level 1 % spell.',initcap(v_college); end if;
        v_spell := private.origin_feat_spell_choice_v1(v_choices->v_active_field->0);
        if v_spell.level<>1 or not exists(select 1 from unnest(coalesce(v_spell.classes,'{}'::text[])) c where lower(c)=any(v_spell_classes)) then raise exception '% is not a valid level 1 % Strixhaven Initiate spell.',v_spell.name,initcap(v_college); end if;
        perform private.upsert_player_forge_source_magic_spell_v1(new.character_id,v_spell.id,'feat',v_owner_key,v_feat.name,v_casting_stat,1,'long-rest',
          jsonb_build_object('sourceOwner','feat','featName',v_feat.name,'featOptionId',v_feat.id,'college',initcap(v_college),'grantedAtLevel',v_instance.acquisition_level,'freeCast',true,'automaticCastingAbility',true));
      else
        raise exception 'Unsupported routed feat source magic: %.',v_feat.name;
      end if;
    else
      raise exception 'Unsupported Forge source-magic owner type %.',v_owner_type;
    end if;
  end loop;
  return new;
end;
$function$;

-- private.validate_and_materialize_player_forge_class_options_v1() MD5 6df5aee6f0519c9c77758d6e887ed8e4
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

-- private.validate_player_forge_starting_magic_exactness_v1() MD5 ba645ad0f2c17addad0b40e0602c2ac8
CREATE OR REPLACE FUNCTION private.validate_player_forge_starting_magic_exactness_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$ declare v_sheet jsonb; v_expected jsonb; v_expected_count integer; v_actual_count integer; begin select cs.sheet into v_sheet from public.character_sheets cs where cs.character_id=new.character_id; if coalesce(v_sheet #>> '{meta,creator}','')<>'shared_character_forge_player_v2' then return new; end if; v_expected:=coalesce(v_sheet->'startingMagicSelections','[]'::jsonb); if jsonb_typeof(v_expected)<>'array' then raise exception 'startingMagicSelections must be a JSON array.'; end if; select count(*) into v_expected_count from jsonb_array_elements(v_expected); select count(*) into v_actual_count from public.character_spells where character_id=new.character_id and coalesce((raw_payload->>'startingMagic')::boolean,false); if v_expected_count<>v_actual_count then raise exception 'Starting magic summary does not match authoritative starting spell rows.'; end if; if exists(select 1 from jsonb_array_elements(v_expected) expected where not exists(select 1 from public.character_spells cs where cs.character_id=new.character_id and coalesce((cs.raw_payload->>'startingMagic')::boolean,false) and cs.spell_id=(expected->>'spell_id')::uuid and cs.source_type=coalesce(nullif(expected->>'source_type',''),'class') and cs.source_key=coalesce(nullif(expected->>'source_key',''),coalesce(nullif(expected->>'source_type',''),'class')) and cs.prepared=coalesce((expected->>'prepared')::boolean,false))) then raise exception 'Starting magic summary contains a spell/source/prepared state that was not materialized.'; end if; return new; end; $function$;
