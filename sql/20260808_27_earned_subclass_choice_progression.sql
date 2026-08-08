-- Reconcile the earned-progression v4 authority with production.
-- This migration intentionally corrects the early migration-26 draft by preserving
-- the original persistent-choice gap detector behind a transaction-local wrapper,
-- then adds the first audited persistent subclass choice families.

create or replace function private.level_up_persistent_choice_gaps_base_v1(
  p_class_key text,
  p_class_source text,
  p_from_level integer,
  p_to_level integer
)
returns jsonb
language plpgsql
immutable
set search_path=pg_catalog
as $$
declare
  v_class text:=lower(btrim(coalesce(p_class_key,'')));
  v_source text:=upper(btrim(coalesce(p_class_source,'')));
  v_from integer:=greatest(1,coalesce(p_from_level,1));
  v_to integer:=greatest(1,coalesce(p_to_level,1));
  v_out jsonb:='[]'::jsonb;
  v_warlock_before integer:=0;
  v_warlock_after integer:=0;
begin
  if v_source<>'XPHB' or v_to<>v_from+1 then return v_out; end if;
  if v_class='warlock' then
    v_warlock_before:=case
      when v_from>=18 then 10 when v_from>=15 then 9 when v_from>=12 then 8
      when v_from>=9 then 7 when v_from>=7 then 6 when v_from>=5 then 5
      when v_from>=2 then 3 else 1 end;
    v_warlock_after:=case
      when v_to>=18 then 10 when v_to>=15 then 9 when v_to>=12 then 8
      when v_to>=9 then 7 when v_to>=7 then 6 when v_to>=5 then 5
      when v_to>=2 then 3 else 1 end;
    if v_warlock_after>v_warlock_before then
      v_out:=v_out||jsonb_build_array('Eldritch Invocations +'||(v_warlock_after-v_warlock_before)::text);
    end if;
  end if;
  return v_out;
end;
$$;

create or replace function private.level_up_persistent_choice_gaps_v1(
  p_class_key text,
  p_class_source text,
  p_from_level integer,
  p_to_level integer
)
returns jsonb
language plpgsql
stable
set search_path=pg_catalog,private
as $$
declare
  v_gaps jsonb:='[]'::jsonb;
  v_filtered jsonb:='[]'::jsonb;
begin
  v_gaps:=private.level_up_persistent_choice_gaps_base_v1(p_class_key,p_class_source,p_from_level,p_to_level);
  if coalesce(current_setting('dndnext.resolved_invocation_gap',true),'')<>'on' then
    return coalesce(v_gaps,'[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(entry.value),'[]'::jsonb)
  into v_filtered
  from jsonb_array_elements(coalesce(v_gaps,'[]'::jsonb)) entry(value)
  where not (
    jsonb_typeof(entry.value)='string'
    and (entry.value #>> '{}') like 'Eldritch Invocations +%'
  );
  return coalesce(v_filtered,'[]'::jsonb);
end;
$$;

create or replace function private.level_up_subclass_choice_groups_v1(
  p_character_id uuid,
  p_to_level integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_feature public.class_feature_catalog%rowtype;
  v_groups jsonb:='[]'::jsonb;
  v_options jsonb:='[]'::jsonb;
  v_group_id text;
  v_max_spell_level integer:=0;
  v_subclass_norm text;
begin
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found or coalesce(v_progression.subclass_name,'')='' then return '[]'::jsonb; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if upper(coalesce(v_class.source,''))<>'XPHB' then return '[]'::jsonb; end if;
  v_subclass_norm:=private.normalize_player_choice_name_v1(v_progression.subclass_name);

  for v_feature in
    select f.*
    from public.class_feature_catalog f
    where f.feature_type='subclass'
      and f.class_key=v_class.class_key
      and f.class_source=v_class.source
      and f.level=p_to_level
      and private.normalize_player_choice_name_v1(coalesce(f.subclass_name,f.subclass_short_name,''))=v_subclass_norm
      and private.normalize_player_choice_name_v1(f.name) in ('magicaldiscoveries','elementalaffinity','additionalfightingstyle')
    order by f.name
  loop
    if private.normalize_player_choice_name_v1(v_feature.name)='magicaldiscoveries' then
      v_group_id:='bard-lore-magical-discoveries';
      v_max_spell_level:=least(9,ceil(p_to_level/2.0)::integer);
      select coalesce(jsonb_agg(jsonb_build_object(
        'key',s.id::text,'value',s.id::text,'label',s.name,'source',s.source,'kind','spell','description',coalesce(s.description,''),
        'metadata',jsonb_build_object('spellId',s.id,'spellKey',s.spell_key,'level',s.level,'classes',coalesce(to_jsonb(s.classes),'[]'::jsonb))
      ) order by s.level,s.name),'[]'::jsonb)
      into v_options
      from public.spells_catalog_preferred s
      where s.level between 0 and v_max_spell_level
        and exists(select 1 from unnest(coalesce(s.classes,'{}'::text[])) c where lower(c) in ('cleric','druid','wizard'))
        and not exists(select 1 from public.character_spells cs where cs.character_id=p_character_id and cs.spell_id=s.id);
      v_groups:=v_groups||jsonb_build_array(jsonb_build_object(
        'id',v_group_id,'ownerType','subclass','ownerKey',v_feature.id::text,'label','Magical Discoveries','source',v_feature.source,
        'placement','class','level',p_to_level,'helper',coalesce(v_feature.description,''),
        'fields',jsonb_build_array(jsonb_build_object(
          'id','spells','label','Magical Discoveries spells','kind','spell','count',2,'required',true,'cadence','level-up','replacementCadence','level-up','options',v_options,
          'metadata',jsonb_build_object('sourceFeature','Magical Discoveries','subclassName',v_progression.subclass_name,'maxSpellLevel',v_max_spell_level,'spellClasses',jsonb_build_array('Cleric','Druid','Wizard'))
        )),
        'metadata',jsonb_build_object('family','subclass-choice','featureId',v_feature.id,'featureName','Magical Discoveries','subclassName',v_progression.subclass_name,'subclassSource',v_progression.subclass_source)
      ));
    elsif private.normalize_player_choice_name_v1(v_feature.name)='elementalaffinity' then
      v_group_id:='sorcerer-draconic-affinity';
      v_options:=jsonb_build_array(
        jsonb_build_object('key','acid','value','Acid','label','Acid','source',v_feature.source,'kind','damage-type'),
        jsonb_build_object('key','cold','value','Cold','label','Cold','source',v_feature.source,'kind','damage-type'),
        jsonb_build_object('key','fire','value','Fire','label','Fire','source',v_feature.source,'kind','damage-type'),
        jsonb_build_object('key','lightning','value','Lightning','label','Lightning','source',v_feature.source,'kind','damage-type'),
        jsonb_build_object('key','poison','value','Poison','label','Poison','source',v_feature.source,'kind','damage-type')
      );
      v_groups:=v_groups||jsonb_build_array(jsonb_build_object(
        'id',v_group_id,'ownerType','subclass','ownerKey',v_feature.id::text,'label','Elemental Affinity','source',v_feature.source,
        'placement','class','level',p_to_level,'helper',coalesce(v_feature.description,''),
        'fields',jsonb_build_array(jsonb_build_object(
          'id','damage-type','label','Elemental Affinity','kind','damage-type','count',1,'required',true,'cadence','level-up','options',v_options,
          'metadata',jsonb_build_object('sourceFeature','Elemental Affinity','subclassName',v_progression.subclass_name)
        )),
        'metadata',jsonb_build_object('family','subclass-choice','featureId',v_feature.id,'featureName','Elemental Affinity','subclassName',v_progression.subclass_name,'subclassSource',v_progression.subclass_source)
      ));
    else
      v_group_id:='fighter-champion-additional-fighting-style';
      select coalesce(jsonb_agg(jsonb_build_object(
        'key',o.id::text,'value',o.id::text,'label',o.name,'source',o.source,'kind','fighting-style','description',coalesce(o.description,''),
        'metadata',jsonb_build_object('optionId',o.id,'optionKey',o.option_key,'category',o.category)
      ) order by o.name),'[]'::jsonb)
      into v_options
      from public.character_option_catalog_preferred o
      where o.option_type='feat' and o.category='FS'
        and not exists(select 1 from public.character_option_grant_instances gi where gi.character_id=p_character_id and gi.option_catalog_id=o.id);
      v_groups:=v_groups||jsonb_build_array(jsonb_build_object(
        'id',v_group_id,'ownerType','subclass','ownerKey',v_feature.id::text,'label','Additional Fighting Style','source',v_feature.source,
        'placement','class','level',p_to_level,'helper',coalesce(v_feature.description,''),
        'fields',jsonb_build_array(jsonb_build_object(
          'id','fighting-style','label','Additional Fighting Style','kind','fighting-style','count',1,'required',true,'cadence','level-up','options',v_options,
          'metadata',jsonb_build_object('sourceFeature','Additional Fighting Style','subclassName',v_progression.subclass_name)
        )),
        'metadata',jsonb_build_object('family','subclass-choice','featureId',v_feature.id,'featureName','Additional Fighting Style','subclassName',v_progression.subclass_name,'subclassSource',v_progression.subclass_source)
      ));
    end if;
  end loop;
  return v_groups;
end;
$$;

create or replace function private.apply_level_up_subclass_choices_v1(
  p_character_id uuid,
  p_to_level integer,
  p_selections jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_groups jsonb:='[]'::jsonb;
  v_group jsonb;
  v_group_id text;
  v_feature_name text;
  v_field_id text;
  v_expected integer;
  v_selected jsonb;
  v_key text;
  v_option jsonb;
  v_sheet jsonb:='{}'::jsonb;
  v_choices jsonb:='{}'::jsonb;
  v_summary jsonb:='[]'::jsonb;
  v_serialized jsonb;
  v_serialized_selections jsonb;
  v_spell public.spells_catalog%rowtype;
  v_feat public.character_option_catalog%rowtype;
  v_class public.class_catalog%rowtype;
  v_progression public.character_progression%rowtype;
  v_feat_list jsonb;
  v_class_choice_feats jsonb;
begin
  v_groups:=private.level_up_subclass_choice_groups_v1(p_character_id,p_to_level);
  if jsonb_typeof(coalesce(p_selections,'{}'::jsonb))<>'object' then raise exception 'Subclass level-up choices must be an object.'; end if;
  if jsonb_array_length(v_groups)=0 then
    if exists(select 1 from jsonb_object_keys(coalesce(p_selections,'{}'::jsonb)) k where k in ('bard-lore-magical-discoveries','sorcerer-draconic-affinity','fighter-champion-additional-fighting-style')) then
      raise exception 'This level does not grant a modeled persistent subclass choice.';
    end if;
    return '[]'::jsonb;
  end if;

  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  v_choices:=case when jsonb_typeof(v_sheet->'classFeatureChoices')='object' then v_sheet->'classFeatureChoices' else '{}'::jsonb end;
  v_feat_list:=case when jsonb_typeof(v_sheet->'feats')='array' then v_sheet->'feats' else '[]'::jsonb end;
  v_class_choice_feats:=case when jsonb_typeof(v_sheet->'classChoiceFeats')='array' then v_sheet->'classChoiceFeats' else '[]'::jsonb end;

  for v_group in select value from jsonb_array_elements(v_groups) loop
    v_group_id:=v_group->>'id';
    v_feature_name:=v_group#>>'{metadata,featureName}';
    v_field_id:=(v_group->'fields'->0)->>'id';
    v_expected:=coalesce(((v_group->'fields'->0)->>'count')::integer,1);
    v_selected:=coalesce(p_selections#>array[v_group_id,v_field_id],'[]'::jsonb);
    if jsonb_typeof(v_selected)<>'array' or jsonb_array_length(v_selected)<>v_expected then raise exception '% requires exactly % selection(s).',v_feature_name,v_expected; end if;
    if (select count(distinct value) from jsonb_array_elements_text(v_selected))<>v_expected then raise exception '% selections must be distinct.',v_feature_name; end if;
    v_serialized_selections:='[]'::jsonb;

    for v_key in select value from jsonb_array_elements_text(v_selected) loop
      select entry.value into v_option from jsonb_array_elements((v_group->'fields'->0)->'options') entry(value) where entry.value->>'key'=v_key limit 1;
      if v_option is null then raise exception '% contains a source-invalid selection.',v_feature_name; end if;

      if private.normalize_player_choice_name_v1(v_feature_name)='magicaldiscoveries' then
        begin select * into v_spell from public.spells_catalog s where s.id=v_key::uuid and public.is_preferred_spell_version_v1(s.id); exception when others then raise exception 'Magical Discoveries requires valid spell ids.'; end;
        if not found then raise exception 'Magical Discoveries contains an invalid spell.'; end if;
        insert into public.character_spells(character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,casting_stat,raw_payload)
        values(p_character_id,v_spell.id,'class-feature',v_group_id,'Magical Discoveries',true,true,true,lower(coalesce(v_class.spellcasting_ability,'cha')),jsonb_build_object('grantedAtLevel',p_to_level,'subclass',v_progression.subclass_name,'feature','Magical Discoveries'))
        on conflict(character_id,spell_id,source_type,source_key) do update set known=true,prepared=true,always_available=true,casting_stat=excluded.casting_stat,raw_payload=excluded.raw_payload;
        v_serialized_selections:=v_serialized_selections||jsonb_build_array(jsonb_build_object('key',v_key,'name',v_spell.name,'source',v_spell.source,'kind','spell','spell',jsonb_build_object('id',v_spell.id,'spellKey',v_spell.spell_key,'level',v_spell.level)));
      elsif private.normalize_player_choice_name_v1(v_feature_name)='additionalfightingstyle' then
        begin select * into v_feat from public.character_option_catalog where id=v_key::uuid; exception when others then raise exception 'Additional Fighting Style requires a valid feat id.'; end;
        if not found or v_feat.option_type<>'feat' or v_feat.category<>'FS' then raise exception 'Additional Fighting Style requires a source-valid Fighting Style feat.'; end if;
        if exists(select 1 from public.character_option_grant_instances gi where gi.character_id=p_character_id and gi.option_catalog_id=v_feat.id) then raise exception '% is already known and cannot be selected again.',v_feat.name; end if;
        insert into public.character_option_grants(character_id,option_catalog_id,source_note,metadata,granted_by)
        values(p_character_id,v_feat.id,'subclass Additional Fighting Style',jsonb_build_object('source','level-up','subclass',v_progression.subclass_name,'feature','Additional Fighting Style'),auth.uid())
        on conflict(character_id,option_catalog_id) do nothing;
        insert into public.character_option_grant_instances(character_id,instance_key,option_catalog_id,option_type,option_name,option_source,category,acquired_level,acquisition_owner_type,acquisition_owner_key,acquisition_label,choices,metadata,granted_by,updated_at)
        values(p_character_id,v_group_id||'-feat',v_feat.id,'feat',v_feat.name,v_feat.source,v_feat.category,p_to_level,'subclass',v_group_id,'Additional Fighting Style','{}'::jsonb,jsonb_build_object('source','level-up'),auth.uid(),now());
        v_feat_list:=v_feat_list||to_jsonb(v_feat.name);
        v_class_choice_feats:=v_class_choice_feats||jsonb_build_array(jsonb_build_object('name',v_feat.name,'source',v_feat.source,'feature','Additional Fighting Style'));
        v_serialized_selections:=v_serialized_selections||jsonb_build_array(jsonb_build_object('key',v_key,'name',v_feat.name,'source',v_feat.source,'kind','feat'));
      else
        v_serialized_selections:=v_serialized_selections||jsonb_build_array(jsonb_build_object('key',v_key,'name',v_option->>'label','source',v_option->>'source','kind','damage-type'));
      end if;
    end loop;

    v_serialized:=jsonb_build_object(
      'label',v_group->>'label',
      'kind',case when private.normalize_player_choice_name_v1(v_feature_name)='additionalfightingstyle' then 'fighting-style' when private.normalize_player_choice_name_v1(v_feature_name)='magicaldiscoveries' then 'spell' when private.normalize_player_choice_name_v1(v_feature_name)='elementalaffinity' then 'damage-type' else 'class-feature' end,
      'level',p_to_level,'count',v_expected,'sourceFeature',v_feature_name,'subclassName',v_progression.subclass_name,'placement','class','cadence','creation',
      'constraints',case when private.normalize_player_choice_name_v1(v_feature_name)='magicaldiscoveries' then jsonb_build_object('maxSpellLevel',least(9,ceil(p_to_level/2.0)::integer),'spellClasses',jsonb_build_array('Cleric','Druid','Wizard')) else null end,
      'selections',v_serialized_selections
    );
    v_choices:=jsonb_set(v_choices,array[v_group_id],v_serialized,true);
    for v_option in select value from jsonb_array_elements(v_serialized_selections) loop
      v_summary:=v_summary||jsonb_build_array(jsonb_build_object('groupId',v_group_id,'groupLabel',v_group->>'label','groupKind',v_serialized->>'kind','level',p_to_level,'key',v_option->>'key','name',v_option->>'name','source',v_option->>'source','kind',v_option->>'kind'));
    end loop;
  end loop;

  v_sheet:=jsonb_set(v_sheet,'{classFeatureChoices}',v_choices,true);
  v_sheet:=jsonb_set(v_sheet,'{classFeatureChoiceSummary}',(case when jsonb_typeof(v_sheet->'classFeatureChoiceSummary')='array' then v_sheet->'classFeatureChoiceSummary' else '[]'::jsonb end)||v_summary,true);
  v_sheet:=jsonb_set(v_sheet,'{feats}',v_feat_list,true);
  v_sheet:=jsonb_set(v_sheet,'{classChoiceFeats}',v_class_choice_feats,true);
  v_sheet:=jsonb_set(v_sheet,'{meta,classFeatureChoices}',v_choices,true);
  v_sheet:=jsonb_set(v_sheet,'{meta,classFeatureChoiceSummary}',v_sheet->'classFeatureChoiceSummary',true);
  v_sheet:=jsonb_set(v_sheet,'{meta,classChoiceFeats}',v_class_choice_feats,true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now() where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);
  return v_summary;
end;
$$;

create or replace function public.get_character_level_class_choice_options_v2(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_base jsonb;
  v_progression public.character_progression%rowtype;
  v_invocations jsonb:='[]'::jsonb;
  v_subclass jsonb:='[]'::jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to review these class choices.' using errcode='42501'; end if;
  v_base:=public.get_character_level_class_choice_options_v1(p_character_id);
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found or v_progression.class_level>=20 then return v_base; end if;
  v_invocations:=private.level_up_warlock_invocation_groups_v1(p_character_id,v_progression.class_level+1);
  v_subclass:=private.level_up_subclass_choice_groups_v1(p_character_id,v_progression.class_level+1);
  return jsonb_set(coalesce(v_base,'{}'::jsonb),'{groups}',coalesce(v_base->'groups','[]'::jsonb)||coalesce(v_invocations,'[]'::jsonb)||coalesce(v_subclass,'[]'::jsonb),true);
end;
$$;

create or replace function public.begin_character_level_up_v4(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to review this level-up.' using errcode='42501'; end if;
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found then raise exception 'Character progression has not been initialized.' using errcode='P0002'; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if lower(coalesce(v_class.class_key,''))='warlock' and upper(coalesce(v_class.source,''))='XPHB' then
    perform private.level_up_warlock_invocation_groups_v1(p_character_id,least(20,v_progression.class_level+1));
  end if;
  perform set_config('dndnext.resolved_invocation_gap','on',true);
  return public.begin_character_level_up_v3(p_character_id);
end;
$$;

create or replace function public.complete_character_level_up_v4(p_character_id uuid,p_selections jsonb)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_input jsonb:=coalesce(p_selections,'{}'::jsonb);
  v_progression public.character_progression%rowtype;
  v_to integer;
  v_all_class jsonb:=coalesce(v_input->'class_choice_selections','{}'::jsonb);
  v_invocation jsonb:='{}'::jsonb;
  v_subclass jsonb:='{}'::jsonb;
  v_other jsonb:='{}'::jsonb;
  v_key text;
  v_feat_instances jsonb:=coalesce(v_input->'class_option_feat_instances','[]'::jsonb);
  v_invocation_summary jsonb:='[]'::jsonb;
  v_subclass_summary jsonb:='[]'::jsonb;
  v_v3_input jsonb;
  v_result jsonb;
  v_tough_bonus integer:=0;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to level this character.' using errcode='42501'; end if;
  if jsonb_typeof(v_input)<>'object' or jsonb_typeof(v_all_class)<>'object' or jsonb_typeof(v_feat_instances)<>'array' then raise exception 'Level-up source selections have an invalid shape.'; end if;
  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if not found or v_progression.class_level>=20 then raise exception 'Character progression is unavailable for another level.'; end if;
  v_to:=v_progression.class_level+1;
  for v_key in select key from jsonb_each(v_all_class) loop
    if v_key like 'warlock-invocation-slot-%' then
      v_invocation:=jsonb_set(v_invocation,array[v_key],v_all_class->v_key,true);
    elsif v_key in ('bard-lore-magical-discoveries','sorcerer-draconic-affinity','fighter-champion-additional-fighting-style') then
      v_subclass:=jsonb_set(v_subclass,array[v_key],v_all_class->v_key,true);
    else
      v_other:=jsonb_set(v_other,array[v_key],v_all_class->v_key,true);
    end if;
  end loop;
  v_invocation_summary:=private.apply_level_up_warlock_invocations_v1(p_character_id,v_to,v_invocation,v_feat_instances);
  v_subclass_summary:=private.apply_level_up_subclass_choices_v1(p_character_id,v_to,v_subclass);
  v_v3_input:=(v_input-'class_option_feat_instances')||jsonb_build_object('class_choice_selections',v_other);
  perform set_config('dndnext.resolved_invocation_gap','on',true);
  v_result:=public.complete_character_level_up_v3(p_character_id,v_v3_input);
  v_tough_bonus:=private.apply_tough_progression_bonus_v1(p_character_id,v_to);
  return coalesce(v_result,'{}'::jsonb)||jsonb_build_object('invocations',v_invocation_summary,'subclassChoices',v_subclass_summary,'toughProgressionBonus',v_tough_bonus,'progression',public.get_character_progression_v1(p_character_id));
end;
$$;

revoke all on function public.begin_character_level_up_v3(uuid) from authenticated,anon,public;
grant execute on function public.begin_character_level_up_v3(uuid) to service_role;
revoke all on function public.complete_character_level_up_v3(uuid,jsonb) from authenticated,anon,public;
grant execute on function public.complete_character_level_up_v3(uuid,jsonb) to service_role;
revoke all on function public.begin_character_level_up_v4(uuid) from public;
grant execute on function public.begin_character_level_up_v4(uuid) to authenticated,service_role;
revoke all on function public.complete_character_level_up_v4(uuid,jsonb) from public;
grant execute on function public.complete_character_level_up_v4(uuid,jsonb) to authenticated,service_role;
revoke all on function public.get_character_level_class_choice_options_v2(uuid) from public;
grant execute on function public.get_character_level_class_choice_options_v2(uuid) to authenticated,service_role;

revoke all on function private.level_up_subclass_choice_groups_v1(uuid,integer) from public,anon,authenticated;
revoke all on function private.apply_level_up_subclass_choices_v1(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function private.level_up_subclass_choice_groups_v1(uuid,integer) to service_role;
grant execute on function private.apply_level_up_subclass_choices_v1(uuid,integer,jsonb) to service_role;
