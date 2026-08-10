begin;

create or replace function private.player_forge_best_casting_ability_v1(
  p_sheet jsonb,
  p_allowed text[],
  p_class_ability text default null
) returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_key text;
  v_score integer;
  v_modifier integer;
  v_best_key text := null;
  v_best_score integer := -999;
  v_best_modifier integer := -999;
  v_best_class_preferred boolean := false;
  v_class_key text := lower(coalesce(p_class_ability, ''));
  v_class_preferred boolean;
  v_rank integer;
  v_best_rank integer := 999;
begin
  foreach v_key in array coalesce(p_allowed, '{}'::text[]) loop
    v_key := lower(btrim(v_key));
    if v_key not in ('int','wis','cha','str','dex','con') then continue; end if;
    begin
      v_score := coalesce(nullif(p_sheet #>> array['abilities',v_key,'score'], '')::integer, 10);
    exception when others then
      v_score := 10;
    end;
    v_modifier := floor((v_score - 10)::numeric / 2)::integer;
    v_class_preferred := v_key = v_class_key;
    v_rank := case v_key when 'int' then 0 when 'wis' then 1 when 'cha' then 2 when 'str' then 3 when 'dex' then 4 else 5 end;
    if v_best_key is null
       or v_modifier > v_best_modifier
       or (v_modifier = v_best_modifier and v_class_preferred and not v_best_class_preferred)
       or (v_modifier = v_best_modifier and v_class_preferred = v_best_class_preferred and v_score > v_best_score)
       or (v_modifier = v_best_modifier and v_class_preferred = v_best_class_preferred and v_score = v_best_score and v_rank < v_best_rank) then
      v_best_key := v_key;
      v_best_score := v_score;
      v_best_modifier := v_modifier;
      v_best_class_preferred := v_class_preferred;
      v_best_rank := v_rank;
    end if;
  end loop;
  return v_best_key;
end;
$$;

create or replace function private.player_forge_trait_has_spell_v1(
  p_trait jsonb,
  p_spell_name text
) returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1
    from regexp_matches(coalesce(p_trait::text,''), E'\\{@spell\\s+([^}|]+)', 'gi') as match
    where private.normalize_player_choice_name_v1(match[1]) = private.normalize_player_choice_name_v1(p_spell_name)
  );
$$;

create or replace function private.player_forge_json_spell_min_level_v1(
  p_node jsonb,
  p_spell_name text,
  p_level integer default 1
) returns integer
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_type text := jsonb_typeof(p_node);
  v_key text;
  v_value jsonb;
  v_child integer;
  v_best integer := null;
  v_text text;
  v_next_level integer;
begin
  if p_node is null then return null; end if;
  if v_type = 'string' then
    v_text := p_node #>> '{}';
    v_text := split_part(split_part(v_text, '#', 1), '|', 1);
    if private.normalize_player_choice_name_v1(v_text) = private.normalize_player_choice_name_v1(p_spell_name) then
      return greatest(1, coalesce(p_level,1));
    end if;
    return null;
  elsif v_type = 'array' then
    for v_value in select value from jsonb_array_elements(p_node) loop
      v_child := private.player_forge_json_spell_min_level_v1(v_value, p_spell_name, p_level);
      if v_child is not null and (v_best is null or v_child < v_best) then v_best := v_child; end if;
    end loop;
    return v_best;
  elsif v_type = 'object' then
    for v_key, v_value in select key, value from jsonb_each(p_node) loop
      v_next_level := coalesce(p_level,1);
      if v_key ~ '^\\d+$' then v_next_level := greatest(v_next_level, v_key::integer); end if;
      v_child := private.player_forge_json_spell_min_level_v1(v_value, p_spell_name, v_next_level);
      if v_child is not null and (v_best is null or v_child < v_best) then v_best := v_child; end if;
    end loop;
    return v_best;
  end if;
  return null;
end;
$$;

create or replace function private.player_forge_species_spell_choice_limit_v1(p_trait jsonb)
returns integer
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_text text := lower(coalesce(p_trait::text,''));
  v_match text[];
  v_value text;
begin
  v_match := regexp_match(v_text, '(one|two|three|four|[0-9]+)\\s+(?:of the following\\s+)?cantrips?(?:\\s+of your choice)?');
  if v_match is null then
    v_match := regexp_match(v_text, 'know\\s+(one|two|three|four|[0-9]+)\\s+of the following cantrips?');
  end if;
  if v_match is null and (v_text like '%cantrip%of your choice%' or v_text like '%one of the following cantrips%') then return 1; end if;
  if v_match is null then return null; end if;
  v_value := v_match[1];
  return case v_value when 'one' then 1 when 'two' then 2 when 'three' then 3 when 'four' then 4 else greatest(1, v_value::integer) end;
end;
$$;

create or replace function private.upsert_player_forge_source_magic_spell_v1(
  p_character_id uuid,
  p_spell_id uuid,
  p_source_type text,
  p_source_key text,
  p_source_label text,
  p_casting_stat text,
  p_uses_max integer default null,
  p_recharge text default null,
  p_payload jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_spell public.spells_catalog%rowtype;
begin
  select * into v_spell from public.spells_catalog where id=p_spell_id and public.is_preferred_spell_version_v1(id);
  if not found then raise exception 'Source magic references an unavailable or non-preferred spell.'; end if;
  insert into public.character_spells(
    character_id, spell_id, source_type, source_key, source_label, known, prepared,
    always_available, casting_stat, uses_remaining, uses_max, recharge, raw_payload, updated_at
  ) values (
    p_character_id, p_spell_id, p_source_type, p_source_key, p_source_label, true, true,
    true, nullif(lower(coalesce(p_casting_stat,'')),''), p_uses_max, p_uses_max, p_recharge,
    coalesce(p_payload,'{}'::jsonb) || jsonb_build_object('creator','shared_character_forge_source_magic_v1'), now()
  )
  on conflict(character_id,spell_id,source_type,source_key) do update
  set source_label=excluded.source_label,
      known=true,
      prepared=true,
      always_available=true,
      casting_stat=excluded.casting_stat,
      uses_remaining=excluded.uses_remaining,
      uses_max=excluded.uses_max,
      recharge=excluded.recharge,
      raw_payload=excluded.raw_payload,
      updated_at=now();
end;
$$;

create or replace function private.materialize_player_forge_source_magic_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
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
          v_uses := null; v_recharge := null;
          if v_spell.level>0 and lower(v_trait::text) like '%long rest%' and (lower(v_trait::text) like '%once%' or lower(v_trait::text) like '%can''t cast%again%') then
            v_uses := 1; v_recharge := 'long-rest';
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

      if private.normalize_player_choice_name_v1(v_feat.name)='magicinitiate' then
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

      elsif private.normalize_player_choice_name_v1(v_feat.name)='strixhaveninitiate' then
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
$$;

revoke all on function private.player_forge_best_casting_ability_v1(jsonb,text[],text) from public;
revoke all on function private.player_forge_trait_has_spell_v1(jsonb,text) from public;
revoke all on function private.player_forge_json_spell_min_level_v1(jsonb,text,integer) from public;
revoke all on function private.player_forge_species_spell_choice_limit_v1(jsonb) from public;
revoke all on function private.upsert_player_forge_source_magic_spell_v1(uuid,uuid,text,text,text,text,integer,text,jsonb) from public;
revoke all on function private.materialize_player_forge_source_magic_v1() from public;

drop trigger if exists character_progression_materialize_player_forge_source_magic_v1 on public.character_progression;
create constraint trigger character_progression_materialize_player_forge_source_magic_v1
after insert on public.character_progression
deferrable initially deferred
for each row execute function private.materialize_player_forge_source_magic_v1();

commit;
