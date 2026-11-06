-- Exact original live DnDWeb PostgreSQL17.4 function definitions, captured READ-ONLY.
-- Held PR #324 disposable local Supabase Auth fixture ONLY. NO production migration.
-- Specialized handlers preserve complete source text, but Lucky specimen does not
-- enter their feat-specific branches (other feat families remain untested).
-- md5(pg_get_functiondef) private.materialize_boon_energy_resistance_instance_v1() 35cb3d6560ffde5a94b019a9f373f65d
CREATE OR REPLACE FUNCTION private.materialize_boon_energy_resistance_instance_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_pair text[];
  v_feature_key text;
  v_names jsonb;
  v_state jsonb;
begin
  if private.normalize_player_choice_name_v1(new.option_name)<>private.normalize_player_choice_name_v1('Boon of Energy Resistance')
     or upper(coalesce(new.option_source,''))<>'XPHB' then
    return new;
  end if;

  v_pair:=private.validate_boon_energy_resistance_pair_v1(private.boon_energy_resistance_choices_v1(new.choices));
  select jsonb_agg(entry.value->>'name' order by array_position(v_pair,entry.value->>'key')) into v_names
  from jsonb_array_elements(private.boon_energy_resistance_options_v1()) entry(value)
  where entry.value->>'key'=any(v_pair);

  v_feature_key:=private.boon_energy_resistance_feature_key_v1(new.instance_key);
  v_state:=jsonb_build_object(
    'configured',true,
    'instanceKey',new.instance_key,
    'optionId',new.option_id,
    'resistances',to_jsonb(v_pair),
    'resistanceNames',coalesce(v_names,'[]'::jsonb),
    'configuredAt',timezone('utc',now()),
    'configuredBy','acquisition'
  );

  insert into public.character_runtime_feature_choices(
    character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at
  ) values(
    new.character_id,v_feature_key,'Boon of Energy Resistance','XPHB','long_rest',v_state,now(),now(),now()
  ) on conflict(character_id,feature_key) do nothing;

  perform private.sync_boon_energy_resistance_projection_v1(new.character_id);
  return new;
end;
$function$;

-- md5(pg_get_functiondef) private.materialize_cartomancer_instance_v1() 30939673464de80a0791a89017d48065
CREATE OR REPLACE FUNCTION private.materialize_cartomancer_instance_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_context jsonb;
  v_stat text;
  v_spell public.spells_catalog%rowtype;
begin
  if not private.cartomancer_family_v1(new.option_name,new.option_source) then return new; end if;
  v_context:=private.cartomancer_character_context_v1(new.character_id);
  v_stat:=nullif(v_context->>'spellcastingAbility','');
  if v_stat is null then raise exception 'Cartomancer requires a class with the Spellcasting feature.'; end if;

  select * into v_spell from public.spells_catalog_preferred
  where private.normalize_player_choice_name_v1(name)=private.normalize_player_choice_name_v1('Prestidigitation')
    and level=0
  order by case when source='XPHB' then 0 when source='PHB' then 1 else 2 end,name
  limit 1;
  if v_spell.id is null then raise exception 'Cartomancer could not resolve Prestidigitation.'; end if;

  if not exists(
    select 1 from public.character_spells
    where character_id=new.character_id and spell_id=v_spell.id and source_type='feat' and source_key=new.instance_key
  ) then
    insert into public.character_spells(
      character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,
      casting_stat,raw_payload,created_at,updated_at
    ) values(
      new.character_id,v_spell.id,'feat',new.instance_key,'Cartomancer • Card Tricks',true,true,true,
      v_stat,jsonb_build_object(
        'cartomancer',true,'cardTricks',true,'sourceFeat','Cartomancer','source','BMT',
        'instanceKey',new.instance_key,'grantedAtLevel',new.acquisition_level
      ),now(),now()
    );
  end if;
  return new;
end;
$function$;

-- md5(pg_get_functiondef) private.materialize_feat_runtime_expertise_instance_v1() c56af0b4f49f024a18baf396eeb2d1e2
CREATE OR REPLACE FUNCTION private.materialize_feat_runtime_expertise_instance_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_family text;
  v_sheet jsonb:='{}'::jsonb;
  v_skills text[]:='{}'::text[];
  v_choice jsonb;
  v_skill_key text;
  v_expertise_key text;
  v_expertise_name text;
  v_language text;
  v_languages jsonb:='[]'::jsonb;
  v_feature_key text;
  v_state jsonb;
begin
  v_family:=private.feat_runtime_expertise_family_v1(new.option_name,new.option_source);
  if v_family is null then return new; end if;

  if v_family='zhentarim-tactics' then
    if exists(
      select 1 from jsonb_each(coalesce(new.choices,'{}'::jsonb)) field
      cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice
      where choice->>'kind'='runtime-expertise'
    ) then
      raise exception 'Zhentarim Tactics does not grant Expertise until a Long Rest is completed.';
    end if;
    return new;
  end if;

  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=new.character_id for update;
  if not found then raise exception 'Echoing Soul could not resolve the character sheet.'; end if;

  for v_choice in
    select choice from jsonb_each(coalesce(new.choices,'{}'::jsonb)) field
    cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice
    where choice->>'kind'='skill'
  loop
    v_skill_key:=private.player_sheet_skill_key_v1(coalesce(nullif(v_choice->>'value',''),v_choice->>'label',''));
    if v_skill_key is null or not exists(
      select 1 from public.character_option_catalog_preferred s
      where s.option_type='skill' and private.player_sheet_skill_key_v1(s.name)=v_skill_key
    ) then raise exception 'Echoing Soul contains an invalid skill proficiency choice.'; end if;
    if v_skill_key=any(v_skills) then raise exception 'Echoing Soul skill proficiency choices must be distinct.'; end if;
    v_skills:=array_append(v_skills,v_skill_key);
  end loop;
  if cardinality(v_skills)<>2 then raise exception 'Echoing Soul requires exactly two skill proficiency choices.'; end if;

  if coalesce(jsonb_typeof(v_sheet#>'{proficiencies,skills}'),'')<>'object' then
    if coalesce(jsonb_typeof(v_sheet->'proficiencies'),'')<>'object' then v_sheet:=jsonb_set(v_sheet,'{proficiencies}','{}'::jsonb,true); end if;
    v_sheet:=jsonb_set(v_sheet,'{proficiencies,skills}','{}'::jsonb,true);
  end if;
  foreach v_skill_key in array v_skills loop
    v_sheet:=jsonb_set(v_sheet,array['proficiencies','skills',v_skill_key],coalesce(v_sheet#>array['proficiencies','skills',v_skill_key],'{}'::jsonb)||jsonb_build_object('proficient',true),true);
  end loop;

  select private.phb_additional_language_name_v1(coalesce(nullif(choice->>'value',''),choice->>'label','')) into v_language
  from jsonb_each(coalesce(new.choices,'{}'::jsonb)) field
  cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice
  where choice->>'kind'='language'
  limit 1;
  if v_language is null then raise exception 'Echoing Soul requires one additional Player''s Handbook language.'; end if;
  if (
    select count(*) from jsonb_each(coalesce(new.choices,'{}'::jsonb)) field
    cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice
    where choice->>'kind'='language'
  )<>1 then raise exception 'Echoing Soul requires exactly one additional language.'; end if;
  v_languages:=case when jsonb_typeof(v_sheet->'languages')='array' then v_sheet->'languages' else '[]'::jsonb end;
  if exists(select 1 from jsonb_array_elements_text(v_languages) known where private.normalize_player_choice_name_v1(known)=private.normalize_player_choice_name_v1(v_language)) then
    raise exception 'Echoing Soul must grant a language the character does not already know.';
  end if;
  v_sheet:=jsonb_set(v_sheet,'{languages}',v_languages||to_jsonb(v_language),true);

  select private.player_sheet_skill_key_v1(coalesce(nullif(choice->>'value',''),choice->>'label','')) into v_expertise_key
  from jsonb_each(coalesce(new.choices,'{}'::jsonb)) field
  cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice
  where choice->>'kind'='runtime-expertise'
  limit 1;
  if v_expertise_key is null then raise exception 'Echoing Soul requires one initial Expertise choice.'; end if;
  if (
    select count(*) from jsonb_each(coalesce(new.choices,'{}'::jsonb)) field
    cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) choice
    where choice->>'kind'='runtime-expertise'
  )<>1 then raise exception 'Echoing Soul requires exactly one initial Expertise choice.'; end if;
  if not coalesce((v_sheet#>>array['proficiencies','skills',v_expertise_key,'proficient'])::boolean,false) then
    raise exception 'Echoing Soul Expertise must use a skill the character is proficient in.';
  end if;
  select name into v_expertise_name from public.character_option_catalog_preferred
  where option_type='skill' and private.player_sheet_skill_key_v1(name)=v_expertise_key limit 1;
  if v_expertise_name is null then raise exception 'Echoing Soul Expertise skill is unavailable.'; end if;

  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=new.character_id;

  v_feature_key:=private.feat_runtime_expertise_feature_key_v1(v_family,new.instance_key);
  v_state:=jsonb_build_object(
    'configured',true,'family',v_family,'instanceKey',new.instance_key,'optionId',new.option_id,
    'skill',jsonb_build_object('key',v_expertise_key,'name',v_expertise_name),
    'configuredAt',timezone('utc',now()),'configuredBy','acquisition'
  );
  insert into public.character_runtime_feature_choices(
    character_id,feature_key,feature_name,source,cadence,state,replacement_anchor_at,created_at,updated_at
  ) values(
    new.character_id,v_feature_key,'Echoing Soul Expertise','RHW','long_rest',v_state,now(),now(),now()
  ) on conflict(character_id,feature_key) do nothing;
  perform private.sync_feat_runtime_expertise_projection_v1(new.character_id);
  return new;
end;
$function$;

-- md5(pg_get_functiondef) private.materialize_player_forge_feat_instances_v1() c27c4181a51cfd018bbb8244e9931550
CREATE OR REPLACE FUNCTION private.materialize_player_forge_feat_instances_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_sheet jsonb;
  v_instance jsonb;
  v_option_id uuid;
  v_catalog public.character_option_catalog%rowtype;
begin
  select cs.sheet into v_sheet from public.character_sheets cs where cs.character_id = new.character_id;
  if coalesce(v_sheet #>> '{meta,creator}', '') <> 'shared_character_forge_player_v2' then return new; end if;
  perform private.validate_player_forge_feat_instances_v1(v_sheet);
  for v_instance in select value from jsonb_array_elements(coalesce(v_sheet -> 'featGrantInstances', '[]'::jsonb)) loop
    v_option_id := (v_instance ->> 'optionId')::uuid;
    select * into v_catalog from public.character_option_catalog where id = v_option_id and option_type in ('feat','boon');
    insert into public.character_option_grant_instances(character_id, option_id, option_key, option_type, option_name, option_source, instance_key, acquisition_owner_type, acquisition_owner_key, acquisition_label, acquisition_level, choices, effects, fixed_spell_tokens, repeatable, granted_by, updated_at)
    values (new.character_id, v_catalog.id, v_catalog.option_key, v_catalog.option_type, v_catalog.name, v_catalog.source, v_instance ->> 'instanceId', nullif(v_instance ->> 'acquisitionOwnerType', ''), nullif(v_instance ->> 'acquisitionOwnerKey', ''), nullif(v_instance ->> 'acquisitionLabel', ''), coalesce((v_instance ->> 'acquisitionLevel')::integer, 1), coalesce(v_instance -> 'choices', '{}'::jsonb), coalesce(v_instance -> 'fixedEffects', '[]'::jsonb), coalesce(v_instance -> 'fixedSpellTokens', '[]'::jsonb), coalesce((v_catalog.metadata ->> 'repeatable')::boolean, false), new.created_by, now())
    on conflict (character_id, instance_key) do update set choices=excluded.choices,effects=excluded.effects,fixed_spell_tokens=excluded.fixed_spell_tokens,acquisition_owner_type=excluded.acquisition_owner_type,acquisition_owner_key=excluded.acquisition_owner_key,acquisition_label=excluded.acquisition_label,acquisition_level=excluded.acquisition_level,option_type=excluded.option_type,updated_at=now();
    insert into public.character_option_grants(character_id, option_id, notes, granted_by, updated_at)
    values (new.character_id, v_catalog.id, case when v_catalog.option_type='boon' then 'Character Forge Epic Boon grant; see character_option_grant_instances for source-owned instance choices.' else 'Character Forge feat grant; see character_option_grant_instances for source-owned instance choices.' end, new.created_by, now())
    on conflict (character_id, option_id) do nothing;
  end loop;
  return new;
end;
$function$;
