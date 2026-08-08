-- Optional replace-on-level-up authority for source-explicit, reversibly owned features.
-- Supported in this migration:
--   * Sorcerer Metamagic
--   * Warlock Mystic Arcanum
--   * Bard (Lore) Magical Discoveries
-- Eldritch Invocation replacement is intentionally excluded because some Invocations can
-- own persistent Origin-feat effects that cannot yet be reversed safely.

create or replace function private.level_up_metamagic_replacement_group_v1(p_character_id uuid,p_to_level integer)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_sheet jsonb:='{}'::jsonb;
  v_current jsonb:='[]'::jsonb;
  v_replace_options jsonb:='[]'::jsonb;
  v_with_options jsonb:='[]'::jsonb;
  v_replace_keys jsonb:='[]'::jsonb;
begin
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found or p_to_level<>v_progression.class_level+1 or v_progression.class_level<2 then return '[]'::jsonb; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if lower(coalesce(v_class.class_key,''))<>'sorcerer' or upper(coalesce(v_class.source,''))<>'XPHB' then return '[]'::jsonb; end if;
  if not exists(
    select 1 from public.class_feature_catalog f
    where f.class_key='sorcerer' and f.class_source='XPHB' and f.name='Metamagic'
      and lower(coalesce(f.description,'')) like '%whenever you gain a sorcerer level%'
      and lower(coalesce(f.description,'')) like '%replace one of your metamagic options%'
  ) then return '[]'::jsonb; end if;

  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id;
  v_current:=case when jsonb_typeof(v_sheet#>'{classFeatureChoices,sorcerer-metamagic,selections}')='array'
    then v_sheet#>'{classFeatureChoices,sorcerer-metamagic,selections}' else '[]'::jsonb end;
  if jsonb_array_length(v_current)=0 then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'key',o.option_key,'value',o.option_key,'label',o.name,'source',o.source,'kind','metamagic',
    'metadata',jsonb_build_object('optionId',o.id,'optionKey',o.option_key)
  ) order by o.name),'[]'::jsonb),
  coalesce(jsonb_agg(to_jsonb(o.option_key) order by o.name),'[]'::jsonb)
  into v_replace_options,v_replace_keys
  from public.class_feature_option_catalog o
  where o.option_type='metamagic' and o.source='XPHB' and lower(coalesce(o.class_key,''))='sorcerer'
    and exists(
      select 1 from jsonb_array_elements(v_current) entry
      where private.normalize_player_choice_name_v1(entry->>'name')=private.normalize_player_choice_name_v1(o.name)
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'key',o.option_key,'value',o.option_key,'label',o.name,'source',o.source,'kind','metamagic',
    'metadata',jsonb_build_object('optionId',o.id,'optionKey',o.option_key)
  ) order by o.name),'[]'::jsonb)
  into v_with_options
  from public.class_feature_option_catalog o
  where o.option_type='metamagic' and o.source='XPHB' and lower(coalesce(o.class_key,''))='sorcerer'
    and not exists(
      select 1 from jsonb_array_elements(v_current) entry
      where private.normalize_player_choice_name_v1(entry->>'name')=private.normalize_player_choice_name_v1(o.name)
    );

  if jsonb_array_length(v_replace_options)=0 or jsonb_array_length(v_with_options)=0 then return '[]'::jsonb; end if;
  return jsonb_build_array(jsonb_build_object(
    'id','replacement-sorcerer-metamagic','ownerType','replacement','ownerKey','sorcerer-metamagic','label','Replace a Metamagic option',
    'source','XPHB','placement','class','level',p_to_level,
    'helper','Optional: when gaining a Sorcerer level, replace one known Metamagic option with one you do not know.',
    'metadata',jsonb_build_object('family','metamagic','replacementCadence','level-up'),
    'fields',jsonb_build_array(
      jsonb_build_object('id','replace','label','Metamagic option to replace','kind','metamagic','count',1,'required',false,'cadence','level-up','replacementCadence','level-up','options',v_replace_options),
      jsonb_build_object('id','with','label','New Metamagic option','kind','metamagic','count',1,'required',true,'cadence','level-up','replacementCadence','level-up','options',v_with_options,
        'activeWhen',jsonb_build_object('groupId','replacement-sorcerer-metamagic','fieldId','replace','values',v_replace_keys))
    )
  ));
end;
$$;

create or replace function private.level_up_mystic_arcanum_replacement_group_v1(p_character_id uuid,p_to_level integer)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_replace_options jsonb:='[]'::jsonb;
  v_fields jsonb:='[]'::jsonb;
  v_keys jsonb:='[]'::jsonb;
  v_row record;
  v_options jsonb:='[]'::jsonb;
begin
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found or p_to_level<>v_progression.class_level+1 or v_progression.class_level<11 then return '[]'::jsonb; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if lower(coalesce(v_class.class_key,''))<>'warlock' or upper(coalesce(v_class.source,''))<>'XPHB' then return '[]'::jsonb; end if;
  if not exists(
    select 1 from public.class_feature_catalog f
    where f.class_key='warlock' and f.class_source='XPHB' and f.name='Mystic Arcanum'
      and lower(coalesce(f.description,'')) like '%whenever you gain a warlock level%'
      and lower(coalesce(f.description,'')) like '%replace one of your arcanum spells%'
  ) then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'key',cs.source_key,'value',cs.source_key,'label',s.name,'source',s.source,'kind','spell',
    'metadata',jsonb_build_object('assignmentId',cs.id,'spellId',s.id,'spellKey',s.spell_key,'level',s.level,'sourceKey',cs.source_key)
  ) order by s.level),'[]'::jsonb),
  coalesce(jsonb_agg(to_jsonb(cs.source_key) order by s.level),'[]'::jsonb)
  into v_replace_options,v_keys
  from public.character_spells cs
  join public.spells_catalog_preferred s on s.id=cs.spell_id
  where cs.character_id=p_character_id and cs.source_type='class-feature' and cs.source_key like 'warlock-mystic-arcanum-%';
  if jsonb_array_length(v_replace_options)=0 then return '[]'::jsonb; end if;

  v_fields:=jsonb_build_array(jsonb_build_object(
    'id','replace','label','Mystic Arcanum spell to replace','kind','mystic-arcanum','count',1,'required',false,'cadence','level-up','replacementCadence','level-up','options',v_replace_options
  ));
  for v_row in
    select cs.source_key,s.id as old_spell_id,s.level
    from public.character_spells cs join public.spells_catalog_preferred s on s.id=cs.spell_id
    where cs.character_id=p_character_id and cs.source_type='class-feature' and cs.source_key like 'warlock-mystic-arcanum-%'
    order by s.level
  loop
    select coalesce(jsonb_agg(jsonb_build_object(
      'key',s.id::text,'value',s.id::text,'label',s.name,'source',s.source,'kind','spell',
      'metadata',jsonb_build_object('spellId',s.id,'spellKey',s.spell_key,'level',s.level)
    ) order by s.name),'[]'::jsonb)
    into v_options
    from public.spells_catalog_preferred s
    where s.level=v_row.level and s.id<>v_row.old_spell_id
      and exists(select 1 from unnest(coalesce(s.classes,'{}'::text[])) c where lower(c)='warlock');
    v_fields:=v_fields||jsonb_build_array(jsonb_build_object(
      'id','with-'||v_row.level::text,'label','New level '||v_row.level::text||' Warlock spell','kind','spell','count',1,'required',true,'cadence','level-up','replacementCadence','level-up','options',v_options,
      'activeWhen',jsonb_build_object('groupId','replacement-warlock-mystic-arcanum','fieldId','replace','values',jsonb_build_array(v_row.source_key)),
      'metadata',jsonb_build_object('spellLevel',v_row.level,'sourceKey',v_row.source_key)
    ));
  end loop;

  return jsonb_build_array(jsonb_build_object(
    'id','replacement-warlock-mystic-arcanum','ownerType','replacement','ownerKey','warlock-mystic-arcanum','label','Replace a Mystic Arcanum spell',
    'source','XPHB','placement','class','level',p_to_level,
    'helper','Optional: when gaining a Warlock level, replace one Mystic Arcanum spell with another Warlock spell of the same level.',
    'metadata',jsonb_build_object('family','mystic-arcanum','replacementCadence','level-up'),
    'fields',v_fields
  ));
end;
$$;

create or replace function private.level_up_lore_discoveries_replacement_group_v1(p_character_id uuid,p_to_level integer)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_next public.class_level_progression%rowtype;
  v_max_level integer:=0;
  v_replace_options jsonb:='[]'::jsonb;
  v_replace_keys jsonb:='[]'::jsonb;
  v_with_options jsonb:='[]'::jsonb;
begin
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found or p_to_level<>v_progression.class_level+1 or v_progression.class_level<6 then return '[]'::jsonb; end if;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if lower(coalesce(v_class.class_key,''))<>'bard' or upper(coalesce(v_class.source,''))<>'XPHB'
     or private.normalize_player_choice_name_v1(v_progression.subclass_name)<>private.normalize_player_choice_name_v1('Lore') then return '[]'::jsonb; end if;
  if not exists(
    select 1 from public.class_feature_catalog f
    where f.feature_type='subclass' and f.class_key='bard' and f.class_source='XPHB' and f.name='Magical Discoveries'
      and private.normalize_player_choice_name_v1(coalesce(f.subclass_name,f.subclass_short_name,''))=private.normalize_player_choice_name_v1('Lore')
      and lower(coalesce(f.description,'')) like '%whenever you gain a bard level%'
      and lower(coalesce(f.description,'')) like '%replace one of the spells%'
  ) then return '[]'::jsonb; end if;

  select * into v_next from public.class_level_progression where class_id=v_progression.class_id and class_level=p_to_level;
  if not found then return '[]'::jsonb; end if;
  v_max_level:=private.highest_spell_level_from_slots_v1(v_next.spell_slots);

  select coalesce(jsonb_agg(jsonb_build_object(
    'key',cs.id::text,'value',cs.id::text,'label',s.name,'source',s.source,'kind','spell',
    'metadata',jsonb_build_object('assignmentId',cs.id,'spellId',s.id,'spellKey',s.spell_key,'level',s.level)
  ) order by s.level,s.name),'[]'::jsonb),
  coalesce(jsonb_agg(to_jsonb(cs.id::text) order by s.level,s.name),'[]'::jsonb)
  into v_replace_options,v_replace_keys
  from public.character_spells cs
  join public.spells_catalog_preferred s on s.id=cs.spell_id
  where cs.character_id=p_character_id and cs.source_type='class-feature' and cs.source_key='bard-lore-magical-discoveries';
  if jsonb_array_length(v_replace_options)=0 then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'key',s.id::text,'value',s.id::text,'label',s.name,'source',s.source,'kind','spell',
    'metadata',jsonb_build_object('spellId',s.id,'spellKey',s.spell_key,'level',s.level,'classes',coalesce(to_jsonb(s.classes),'[]'::jsonb))
  ) order by s.level,s.name),'[]'::jsonb)
  into v_with_options
  from public.spells_catalog_preferred s
  where s.level between 0 and v_max_level
    and exists(select 1 from unnest(coalesce(s.classes,'{}'::text[])) c where lower(c) in ('cleric','druid','wizard'))
    and not exists(
      select 1 from public.character_spells cs
      where cs.character_id=p_character_id and cs.source_type='class-feature' and cs.source_key='bard-lore-magical-discoveries' and cs.spell_id=s.id
    );

  return jsonb_build_array(jsonb_build_object(
    'id','replacement-bard-lore-magical-discoveries','ownerType','replacement','ownerKey','bard-lore-magical-discoveries','label','Replace a Magical Discoveries spell',
    'source','XPHB','placement','class','level',p_to_level,
    'helper','Optional: when gaining a Bard level, replace one Magical Discoveries spell with another eligible Cleric, Druid, or Wizard spell.',
    'metadata',jsonb_build_object('family','magical-discoveries','replacementCadence','level-up','maxSpellLevel',v_max_level),
    'fields',jsonb_build_array(
      jsonb_build_object('id','replace','label','Magical Discoveries spell to replace','kind','spell','count',1,'required',false,'cadence','level-up','replacementCadence','level-up','options',v_replace_options),
      jsonb_build_object('id','with','label','New Magical Discoveries spell','kind','spell','count',1,'required',true,'cadence','level-up','replacementCadence','level-up','options',v_with_options,
        'activeWhen',jsonb_build_object('groupId','replacement-bard-lore-magical-discoveries','fieldId','replace','values',v_replace_keys))
    )
  ));
end;
$$;

create or replace function private.level_up_replacement_groups_v1(p_character_id uuid,p_to_level integer)
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $$
  select coalesce(private.level_up_metamagic_replacement_group_v1(p_character_id,p_to_level),'[]'::jsonb)
      || coalesce(private.level_up_mystic_arcanum_replacement_group_v1(p_character_id,p_to_level),'[]'::jsonb)
      || coalesce(private.level_up_lore_discoveries_replacement_group_v1(p_character_id,p_to_level),'[]'::jsonb);
$$;

create or replace function public.get_character_level_replacement_options_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_groups jsonb:='[]'::jsonb;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to review replacement choices.' using errcode='42501'; end if;
  select * into v_progression from public.character_progression where character_id=p_character_id;
  if not found or v_progression.class_level>=20 then return jsonb_build_object('available',false,'groups','[]'::jsonb); end if;
  v_groups:=private.level_up_replacement_groups_v1(p_character_id,v_progression.class_level+1);
  return jsonb_build_object('available',jsonb_array_length(v_groups)>0,'level',v_progression.class_level+1,'groups',v_groups);
end;
$$;

create or replace function private.apply_level_up_metamagic_replacement_v1(p_character_id uuid,p_to_level integer,p_group jsonb)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_groups jsonb:=private.level_up_metamagic_replacement_group_v1(p_character_id,p_to_level);
  v_group jsonb;
  v_replace jsonb:=coalesce(p_group->'replace','[]'::jsonb);
  v_with jsonb:=coalesce(p_group->'with','[]'::jsonb);
  v_old_key text;
  v_new_key text;
  v_old public.class_feature_option_catalog%rowtype;
  v_new public.class_feature_option_catalog%rowtype;
  v_sheet jsonb:='{}'::jsonb;
  v_choices jsonb:='{}'::jsonb;
  v_existing jsonb:='{}'::jsonb;
  v_current jsonb:='[]'::jsonb;
  v_next jsonb:='[]'::jsonb;
begin
  if jsonb_array_length(v_groups)=0 then
    if jsonb_array_length(v_replace)>0 or jsonb_array_length(v_with)>0 then raise exception 'Metamagic replacement is not available on this level-up.'; end if;
    return '[]'::jsonb;
  end if;
  if jsonb_array_length(v_replace)=0 then
    if jsonb_array_length(v_with)>0 then raise exception 'Choose the Metamagic option being replaced first.'; end if;
    return '[]'::jsonb;
  end if;
  if jsonb_array_length(v_replace)<>1 or jsonb_array_length(v_with)<>1 then raise exception 'Metamagic replacement requires exactly one old option and one new option.'; end if;
  v_group:=v_groups->0;
  v_old_key:=v_replace->>0; v_new_key:=v_with->>0;
  if not exists(select 1 from jsonb_array_elements(v_group#>'{fields,0,options}') o where o->>'key'=v_old_key) then raise exception 'The selected Metamagic option is not currently replaceable.'; end if;
  if not exists(select 1 from jsonb_array_elements(v_group#>'{fields,1,options}') o where o->>'key'=v_new_key) then raise exception 'The replacement Metamagic option is not source-legal.'; end if;
  select * into v_old from public.class_feature_option_catalog where option_key=v_old_key and option_type='metamagic' and source='XPHB';
  select * into v_new from public.class_feature_option_catalog where option_key=v_new_key and option_type='metamagic' and source='XPHB';
  if not found then raise exception 'Replacement Metamagic option is unavailable.'; end if;

  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  v_choices:=case when jsonb_typeof(v_sheet->'classFeatureChoices')='object' then v_sheet->'classFeatureChoices' else '{}'::jsonb end;
  v_existing:=coalesce(v_choices->'sorcerer-metamagic','{}'::jsonb);
  v_current:=case when jsonb_typeof(v_existing->'selections')='array' then v_existing->'selections' else '[]'::jsonb end;
  if not exists(select 1 from jsonb_array_elements(v_current) e where private.normalize_player_choice_name_v1(e->>'name')=private.normalize_player_choice_name_v1(v_old.name)) then raise exception '% is not currently known.',v_old.name; end if;
  if exists(select 1 from jsonb_array_elements(v_current) e where private.normalize_player_choice_name_v1(e->>'name')=private.normalize_player_choice_name_v1(v_new.name)) then raise exception '% is already known.',v_new.name; end if;
  select coalesce(jsonb_agg(
    case when private.normalize_player_choice_name_v1(e.value->>'name')=private.normalize_player_choice_name_v1(v_old.name)
      then jsonb_build_object('key',v_new.option_key,'name',v_new.name,'source',v_new.source,'kind','metamagic')
      else e.value end order by e.ord
  ),'[]'::jsonb)
  into v_next from jsonb_array_elements(v_current) with ordinality e(value,ord);
  v_existing:=v_existing||jsonb_build_object('selections',v_next,'count',jsonb_array_length(v_next),'replacementCadence','level-up');
  v_choices:=jsonb_set(v_choices,'{sorcerer-metamagic}',v_existing,true);
  v_sheet:=jsonb_set(v_sheet,'{classFeatureChoices}',v_choices,true);
  v_sheet:=jsonb_set(v_sheet,'{meta,classFeatureChoices}',v_choices,true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now() where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);
  return jsonb_build_array(jsonb_build_object('family','metamagic','replaced',v_old.name,'with',v_new.name,'source','XPHB'));
end;
$$;

create or replace function private.apply_level_up_mystic_arcanum_replacement_v1(p_character_id uuid,p_to_level integer,p_group jsonb)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_groups jsonb:=private.level_up_mystic_arcanum_replacement_group_v1(p_character_id,p_to_level);
  v_group jsonb;
  v_replace jsonb:=coalesce(p_group->'replace','[]'::jsonb);
  v_source_key text;
  v_old_assignment public.character_spells%rowtype;
  v_old_spell public.spells_catalog%rowtype;
  v_new_spell public.spells_catalog%rowtype;
  v_field_id text;
  v_with jsonb:='[]'::jsonb;
  v_new_key text;
  v_sheet jsonb:='{}'::jsonb;
  v_choices jsonb:='{}'::jsonb;
  v_existing jsonb:='{}'::jsonb;
  v_serialized jsonb;
begin
  if jsonb_array_length(v_groups)=0 then
    if jsonb_typeof(coalesce(p_group,'{}'::jsonb))='object' and exists(select 1 from jsonb_each(p_group) e where jsonb_array_length(coalesce(e.value,'[]'::jsonb))>0) then raise exception 'Mystic Arcanum replacement is not available on this level-up.'; end if;
    return '[]'::jsonb;
  end if;
  if jsonb_array_length(v_replace)=0 then
    if exists(select 1 from jsonb_each(coalesce(p_group,'{}'::jsonb)) e where e.key<>'replace' and jsonb_array_length(coalesce(e.value,'[]'::jsonb))>0) then raise exception 'Choose the Mystic Arcanum spell being replaced first.'; end if;
    return '[]'::jsonb;
  end if;
  if jsonb_array_length(v_replace)<>1 then raise exception 'Choose exactly one Mystic Arcanum spell to replace.'; end if;
  v_group:=v_groups->0; v_source_key:=v_replace->>0;
  if not exists(select 1 from jsonb_array_elements(v_group#>'{fields,0,options}') o where o->>'key'=v_source_key) then raise exception 'The selected Mystic Arcanum is not currently replaceable.'; end if;
  select * into v_old_assignment from public.character_spells where character_id=p_character_id and source_type='class-feature' and source_key=v_source_key for update;
  if not found then raise exception 'The selected Mystic Arcanum assignment is missing.'; end if;
  select * into v_old_spell from public.spells_catalog_preferred where id=v_old_assignment.spell_id;
  v_field_id:='with-'||v_old_spell.level::text;
  v_with:=coalesce(p_group->v_field_id,'[]'::jsonb);
  if jsonb_array_length(v_with)<>1 then raise exception 'Choose exactly one level % replacement Warlock spell.',v_old_spell.level; end if;
  v_new_key:=v_with->>0;
  if not exists(
    select 1 from jsonb_array_elements(v_group->'fields') f, jsonb_array_elements(f->'options') o
    where f->>'id'=v_field_id and o->>'key'=v_new_key
  ) then raise exception 'The replacement Mystic Arcanum spell is not source-legal.'; end if;
  begin select * into v_new_spell from public.spells_catalog_preferred where id=v_new_key::uuid; exception when others then raise exception 'Mystic Arcanum replacement requires a canonical spell id.'; end;
  if not found or v_new_spell.level<>v_old_spell.level or not exists(select 1 from unnest(coalesce(v_new_spell.classes,'{}'::text[])) c where lower(c)='warlock') then raise exception 'Mystic Arcanum replacement must be another Warlock spell of the same level.'; end if;

  update public.character_spells
  set spell_id=v_new_spell.id,known=true,prepared=true,always_available=true,uses_max=1,recharge='long-rest',
      raw_payload=coalesce(raw_payload,'{}'::jsonb)||jsonb_build_object('replacedAtLevel',p_to_level,'replacedSpellId',v_old_spell.id,'replacementFeature','Mystic Arcanum'),
      updated_at=now()
  where id=v_old_assignment.id;

  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  v_choices:=case when jsonb_typeof(v_sheet->'classFeatureChoices')='object' then v_sheet->'classFeatureChoices' else '{}'::jsonb end;
  if jsonb_typeof(v_choices->v_source_key)<>'object' then raise exception 'Mystic Arcanum class-choice authority is missing for %.',v_source_key; end if;
  v_existing:=v_choices->v_source_key;
  v_serialized:=jsonb_build_array(jsonb_build_object('key',v_new_spell.id::text,'name',v_new_spell.name,'source',v_new_spell.source,'kind','mystic-arcanum'));
  v_existing:=v_existing||jsonb_build_object('selections',v_serialized,'count',1,'replacementCadence','level-up');
  v_choices:=jsonb_set(v_choices,array[v_source_key],v_existing,true);
  v_sheet:=jsonb_set(v_sheet,'{classFeatureChoices}',v_choices,true);
  v_sheet:=jsonb_set(v_sheet,'{meta,classFeatureChoices}',v_choices,true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now() where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);
  return jsonb_build_array(jsonb_build_object('family','mystic-arcanum','sourceKey',v_source_key,'replaced',v_old_spell.name,'with',v_new_spell.name,'spellLevel',v_new_spell.level,'source','XPHB'));
end;
$$;

create or replace function private.apply_level_up_lore_discoveries_replacement_v1(p_character_id uuid,p_to_level integer,p_group jsonb)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_groups jsonb:=private.level_up_lore_discoveries_replacement_group_v1(p_character_id,p_to_level);
  v_group jsonb;
  v_replace jsonb:=coalesce(p_group->'replace','[]'::jsonb);
  v_with jsonb:=coalesce(p_group->'with','[]'::jsonb);
  v_assignment_id uuid;
  v_new_id uuid;
  v_old_assignment public.character_spells%rowtype;
  v_old_spell public.spells_catalog%rowtype;
  v_new_spell public.spells_catalog%rowtype;
  v_sheet jsonb:='{}'::jsonb;
  v_choices jsonb:='{}'::jsonb;
  v_existing jsonb:='{}'::jsonb;
  v_current jsonb:='[]'::jsonb;
  v_next jsonb:='[]'::jsonb;
begin
  if jsonb_array_length(v_groups)=0 then
    if jsonb_array_length(v_replace)>0 or jsonb_array_length(v_with)>0 then raise exception 'Magical Discoveries replacement is not available on this level-up.'; end if;
    return '[]'::jsonb;
  end if;
  if jsonb_array_length(v_replace)=0 then
    if jsonb_array_length(v_with)>0 then raise exception 'Choose the Magical Discoveries spell being replaced first.'; end if;
    return '[]'::jsonb;
  end if;
  if jsonb_array_length(v_replace)<>1 or jsonb_array_length(v_with)<>1 then raise exception 'Magical Discoveries replacement requires exactly one old spell and one new spell.'; end if;
  v_group:=v_groups->0;
  begin v_assignment_id:=(v_replace->>0)::uuid; v_new_id:=(v_with->>0)::uuid; exception when others then raise exception 'Magical Discoveries replacement requires canonical spell choices.'; end;
  if not exists(select 1 from jsonb_array_elements(v_group#>'{fields,0,options}') o where o->>'key'=v_assignment_id::text) then raise exception 'The selected Magical Discoveries spell is not currently replaceable.'; end if;
  if not exists(select 1 from jsonb_array_elements(v_group#>'{fields,1,options}') o where o->>'key'=v_new_id::text) then raise exception 'The replacement Magical Discoveries spell is not source-legal.'; end if;
  select * into v_old_assignment from public.character_spells where id=v_assignment_id and character_id=p_character_id and source_type='class-feature' and source_key='bard-lore-magical-discoveries' for update;
  if not found then raise exception 'The selected Magical Discoveries assignment is missing.'; end if;
  select * into v_old_spell from public.spells_catalog_preferred where id=v_old_assignment.spell_id;
  select * into v_new_spell from public.spells_catalog_preferred where id=v_new_id;
  if not found then raise exception 'The replacement Magical Discoveries spell is unavailable.'; end if;
  if exists(select 1 from public.character_spells cs where cs.character_id=p_character_id and cs.source_type='class-feature' and cs.source_key='bard-lore-magical-discoveries' and cs.id<>v_assignment_id and cs.spell_id=v_new_spell.id) then raise exception '% is already a Magical Discoveries spell.',v_new_spell.name; end if;

  update public.character_spells
  set spell_id=v_new_spell.id,known=true,prepared=true,always_available=true,
      raw_payload=coalesce(raw_payload,'{}'::jsonb)||jsonb_build_object('replacedAtLevel',p_to_level,'replacedSpellId',v_old_spell.id,'replacementFeature','Magical Discoveries'),
      updated_at=now()
  where id=v_assignment_id;

  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  v_choices:=case when jsonb_typeof(v_sheet->'classFeatureChoices')='object' then v_sheet->'classFeatureChoices' else '{}'::jsonb end;
  if jsonb_typeof(v_choices->'bard-lore-magical-discoveries')<>'object' then raise exception 'Magical Discoveries class-choice authority is missing.'; end if;
  v_existing:=v_choices->'bard-lore-magical-discoveries';
  v_current:=case when jsonb_typeof(v_existing->'selections')='array' then v_existing->'selections' else '[]'::jsonb end;
  if jsonb_array_length(v_current)=0 then raise exception 'Magical Discoveries selections are missing from class-choice authority.'; end if;
  select coalesce(jsonb_agg(
    case when (e.value->>'key')=v_old_spell.id::text or (e.value#>>'{spell,id}')=v_old_spell.id::text
      then jsonb_build_object('key',v_new_spell.id::text,'name',v_new_spell.name,'source',v_new_spell.source,'kind','spell','spell',jsonb_build_object('id',v_new_spell.id,'spellKey',v_new_spell.spell_key,'level',v_new_spell.level))
      else e.value end order by e.ord
  ),'[]'::jsonb)
  into v_next from jsonb_array_elements(v_current) with ordinality e(value,ord);
  if v_next=v_current then raise exception 'The old Magical Discoveries spell was not found in class-choice authority.'; end if;
  v_existing:=v_existing||jsonb_build_object('selections',v_next,'count',jsonb_array_length(v_next),'replacementCadence','level-up');
  v_choices:=jsonb_set(v_choices,'{bard-lore-magical-discoveries}',v_existing,true);
  v_sheet:=jsonb_set(v_sheet,'{classFeatureChoices}',v_choices,true);
  v_sheet:=jsonb_set(v_sheet,'{meta,classFeatureChoices}',v_choices,true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now() where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);
  return jsonb_build_array(jsonb_build_object('family','magical-discoveries','replaced',v_old_spell.name,'with',v_new_spell.name,'source','XPHB'));
end;
$$;

create or replace function private.apply_level_up_replacements_v1(p_character_id uuid,p_to_level integer,p_selections jsonb)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_input jsonb:=coalesce(p_selections,'{}'::jsonb);
  v_summary jsonb:='[]'::jsonb;
  v_part jsonb;
  v_key text;
begin
  if jsonb_typeof(v_input)<>'object' then raise exception 'Replacement selections must be a JSON object.'; end if;
  for v_key in select key from jsonb_each(v_input) loop
    if v_key not in ('replacement-sorcerer-metamagic','replacement-warlock-mystic-arcanum','replacement-bard-lore-magical-discoveries') then
      raise exception 'Replacement payload contains an unexpected group: %.',v_key;
    end if;
  end loop;
  v_part:=private.apply_level_up_metamagic_replacement_v1(p_character_id,p_to_level,coalesce(v_input->'replacement-sorcerer-metamagic','{}'::jsonb));
  v_summary:=v_summary||coalesce(v_part,'[]'::jsonb);
  v_part:=private.apply_level_up_mystic_arcanum_replacement_v1(p_character_id,p_to_level,coalesce(v_input->'replacement-warlock-mystic-arcanum','{}'::jsonb));
  v_summary:=v_summary||coalesce(v_part,'[]'::jsonb);
  v_part:=private.apply_level_up_lore_discoveries_replacement_v1(p_character_id,p_to_level,coalesce(v_input->'replacement-bard-lore-magical-discoveries','{}'::jsonb));
  v_summary:=v_summary||coalesce(v_part,'[]'::jsonb);
  return v_summary;
end;
$$;

create or replace function public.complete_character_level_up_v5(p_character_id uuid,p_selections jsonb)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_input jsonb:=coalesce(p_selections,'{}'::jsonb);
  v_progression public.character_progression%rowtype;
  v_to integer;
  v_replacements jsonb:=coalesce(v_input->'replacement_selections','{}'::jsonb);
  v_summary jsonb:='[]'::jsonb;
  v_result jsonb;
  v_level_choice jsonb:='{}'::jsonb;
  v_session_id uuid;
begin
  if not private.can_manage_character_progression_v1(p_character_id) then raise exception 'You do not have permission to level this character.' using errcode='42501'; end if;
  if jsonb_typeof(v_input)<>'object' or jsonb_typeof(v_replacements)<>'object' then raise exception 'Level-up selections and replacement selections must be JSON objects.'; end if;
  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if not found or v_progression.class_level>=20 then raise exception 'Character progression is unavailable for another level.'; end if;
  v_to:=v_progression.class_level+1;
  v_summary:=private.apply_level_up_replacements_v1(p_character_id,v_to,v_replacements);
  v_result:=public.complete_character_level_up_v4(p_character_id,v_input-'replacement_selections');

  if jsonb_array_length(v_summary)>0 then
    select coalesce(level_choices->v_to::text,'{}'::jsonb) into v_level_choice from public.character_progression where character_id=p_character_id;
    v_level_choice:=v_level_choice||jsonb_build_object('replacements',v_summary);
    update public.character_progression
    set level_choices=jsonb_set(coalesce(level_choices,'{}'::jsonb),array[v_to::text],v_level_choice,true),updated_at=now()
    where character_id=p_character_id;

    select id into v_session_id from public.character_level_up_sessions
    where character_id=p_character_id and to_level=v_to and status='completed'
    order by completed_at desc limit 1;
    if v_session_id is not null then
      update public.character_level_up_sessions
      set selections=coalesce(selections,'{}'::jsonb)||jsonb_build_object('replacement_selections',v_replacements,'replacements',v_summary),updated_at=now()
      where id=v_session_id;
    end if;

    update public.character_level_events
    set details=coalesce(details,'{}'::jsonb)||jsonb_build_object('replacements',v_summary)
    where id=(select id from public.character_level_events where character_id=p_character_id and event_type='level_up_completed' and to_level=v_to order by created_at desc limit 1);
  end if;

  return coalesce(v_result,'{}'::jsonb)||jsonb_build_object('replacements',v_summary,'progression',public.get_character_progression_v1(p_character_id));
end;
$$;

revoke all on function public.get_character_level_replacement_options_v1(uuid) from public;
grant execute on function public.get_character_level_replacement_options_v1(uuid) to authenticated,service_role;
revoke all on function public.complete_character_level_up_v4(uuid,jsonb) from authenticated,anon,public;
grant execute on function public.complete_character_level_up_v4(uuid,jsonb) to service_role;
revoke all on function public.complete_character_level_up_v5(uuid,jsonb) from public;
grant execute on function public.complete_character_level_up_v5(uuid,jsonb) to authenticated,service_role;

revoke all on function private.level_up_metamagic_replacement_group_v1(uuid,integer) from public,anon,authenticated;
revoke all on function private.level_up_mystic_arcanum_replacement_group_v1(uuid,integer) from public,anon,authenticated;
revoke all on function private.level_up_lore_discoveries_replacement_group_v1(uuid,integer) from public,anon,authenticated;
revoke all on function private.level_up_replacement_groups_v1(uuid,integer) from public,anon,authenticated;
revoke all on function private.apply_level_up_metamagic_replacement_v1(uuid,integer,jsonb) from public,anon,authenticated;
revoke all on function private.apply_level_up_mystic_arcanum_replacement_v1(uuid,integer,jsonb) from public,anon,authenticated;
revoke all on function private.apply_level_up_lore_discoveries_replacement_v1(uuid,integer,jsonb) from public,anon,authenticated;
revoke all on function private.apply_level_up_replacements_v1(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function private.level_up_metamagic_replacement_group_v1(uuid,integer) to service_role;
grant execute on function private.level_up_mystic_arcanum_replacement_group_v1(uuid,integer) to service_role;
grant execute on function private.level_up_lore_discoveries_replacement_group_v1(uuid,integer) to service_role;
grant execute on function private.level_up_replacement_groups_v1(uuid,integer) to service_role;
grant execute on function private.apply_level_up_metamagic_replacement_v1(uuid,integer,jsonb) to service_role;
grant execute on function private.apply_level_up_mystic_arcanum_replacement_v1(uuid,integer,jsonb) to service_role;
grant execute on function private.apply_level_up_lore_discoveries_replacement_v1(uuid,integer,jsonb) to service_role;
grant execute on function private.apply_level_up_replacements_v1(uuid,integer,jsonb) to service_role;
