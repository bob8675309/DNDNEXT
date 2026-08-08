-- Source-owned Origin feat application for nested class options such as
-- Warlock: Lessons of the First Ones. This uses a distinct instance key so it can
-- coexist with the normal level-N advancement instance in the same transaction.

create or replace function private.origin_feat_choice_rows_v1(p_instance jsonb)
returns table(field_id text, choice jsonb)
language sql immutable set search_path=pg_catalog as $$
  select field.key, selected.value
  from jsonb_each(case when jsonb_typeof(coalesce(p_instance->'choices','{}'::jsonb))='object' then p_instance->'choices' else '{}'::jsonb end) field
  cross join lateral jsonb_array_elements(case when jsonb_typeof(field.value)='array' then field.value else '[]'::jsonb end) selected;
$$;

create or replace function private.origin_feat_tool_choice_valid_v1(p_choice jsonb, p_mode text)
returns boolean
language sql stable security definer
set search_path=pg_catalog,public,private as $$
  select exists(
    select 1 from public.items_catalog i
    where coalesce(i.item_rarity,'')='mundane'
      and (
        i.item_key=coalesce(p_choice->>'value',p_choice->>'key','')
        or private.normalize_player_choice_name_v1(i.item_name)=private.normalize_player_choice_name_v1(coalesce(p_choice->>'label',p_choice->>'value',''))
      )
      and case lower(coalesce(p_mode,''))
        when 'artisan' then upper(coalesce(i.payload->>'type','')) like 'AT%'
        when 'instrument' then upper(coalesce(i.payload->>'type','')) like 'INS%' or lower(coalesce(i.item_type,''))='instrument'
        else lower(coalesce(i.item_type,'')) in ('tools','tool','instrument') or coalesce(i.payload->>'type','')<>''
      end
  );
$$;

create or replace function private.origin_feat_skill_choice_valid_v1(p_choice jsonb)
returns boolean
language sql stable security definer
set search_path=pg_catalog,public,private as $$
  select exists(
    select 1 from public.character_option_catalog_preferred o
    where o.option_type='skill'
      and (
        private.normalize_player_choice_name_v1(o.option_key)=private.normalize_player_choice_name_v1(coalesce(p_choice->>'value',p_choice->>'key',''))
        or private.normalize_player_choice_name_v1(o.name)=private.normalize_player_choice_name_v1(coalesce(p_choice->>'label',p_choice->>'value',''))
      )
  );
$$;

create or replace function private.origin_feat_spell_choice_v1(p_choice jsonb)
returns public.spells_catalog
language plpgsql stable security definer
set search_path=pg_catalog,public,private as $$
declare v_id uuid; v_spell public.spells_catalog%rowtype;
begin
  begin v_id:=coalesce(p_choice#>>'{metadata,spellId}',p_choice->>'value',p_choice->>'key')::uuid; exception when others then return null; end;
  select * into v_spell from public.spells_catalog s where s.id=v_id and public.is_preferred_spell_version_v1(s.id);
  if not found then return null; end if;
  return v_spell;
end;
$$;

create or replace function private.validate_source_owned_origin_feat_v1(
  p_character_id uuid,
  p_level integer,
  p_option_id uuid,
  p_instance jsonb
)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_option public.character_option_catalog%rowtype;
  v_name text;
  v_choices jsonb:=coalesce(p_instance->'choices','{}'::jsonb);
  v_nonempty_fields integer:=0;
  v_field text;
  v_values jsonb;
  v_choice jsonb;
  v_count integer;
  v_seen text[]:='{}'::text[];
  v_list text;
  v_spell public.spells_catalog%rowtype;
  v_ability text;
begin
  select * into v_option from public.character_option_catalog_preferred o
  where o.id=p_option_id and o.option_type='feat' and o.category='O';
  if not found then raise exception 'The source-owned feat is not a preferred Origin feat.'; end if;
  v_name:=private.normalize_player_choice_name_v1(v_option.name);
  if jsonb_typeof(v_choices)<>'object' then raise exception '% choices must be an object.',v_option.name; end if;
  select count(*) into v_nonempty_fields from jsonb_each(v_choices) e where jsonb_typeof(e.value)='array' and jsonb_array_length(e.value)>0;

  if v_name in ('alert','healer','lucky','savageattacker') then
    if v_nonempty_fields<>0 then raise exception '% does not accept a persistent child choice.',v_option.name; end if;
    return;
  end if;

  if v_name='tough' or v_name='tavernbrawler' then
    if v_nonempty_fields<>0 then raise exception '% does not accept a persistent child choice.',v_option.name; end if;
    return;
  end if;

  if v_name in ('crafter','musician') then
    v_values:=coalesce(v_choices->'tool-1','[]'::jsonb);
    if jsonb_typeof(v_values)<>'array' or jsonb_array_length(v_values)<>3 or v_nonempty_fields<>1 then
      raise exception '% requires exactly three source-valid % choices.',v_option.name,case when v_name='crafter' then 'Artisan tool' else 'instrument' end;
    end if;
    for v_choice in select value from jsonb_array_elements(v_values) loop
      if not private.origin_feat_tool_choice_valid_v1(v_choice,case when v_name='crafter' then 'artisan' else 'instrument' end) then
        raise exception '% contains an invalid tool choice.',v_option.name;
      end if;
      if private.normalize_player_choice_name_v1(coalesce(v_choice->>'value',v_choice->>'label',''))=any(v_seen) then raise exception '% tool choices must be distinct.',v_option.name; end if;
      v_seen:=array_append(v_seen,private.normalize_player_choice_name_v1(coalesce(v_choice->>'value',v_choice->>'label','')));
    end loop;
    return;
  end if;

  if v_name='skilled' then
    v_values:=coalesce(v_choices->'skills-or-tools','[]'::jsonb);
    if jsonb_typeof(v_values)<>'array' or jsonb_array_length(v_values)<>3 or v_nonempty_fields<>1 then raise exception 'Skilled requires exactly three skill or tool choices.'; end if;
    for v_choice in select value from jsonb_array_elements(v_values) loop
      if coalesce(v_choice->>'kind','')='skill' then
        if not private.origin_feat_skill_choice_valid_v1(v_choice) then raise exception 'Skilled contains an invalid skill choice.'; end if;
      elsif coalesce(v_choice->>'kind','')='tool' then
        if not private.origin_feat_tool_choice_valid_v1(v_choice,'any') then raise exception 'Skilled contains an invalid tool choice.'; end if;
      else raise exception 'Skilled choices must be skills or tools.'; end if;
      if private.normalize_player_choice_name_v1(coalesce(v_choice->>'value',v_choice->>'label',''))=any(v_seen) then raise exception 'Skilled choices must be distinct.'; end if;
      v_seen:=array_append(v_seen,private.normalize_player_choice_name_v1(coalesce(v_choice->>'value',v_choice->>'label','')));
    end loop;
    return;
  end if;

  if v_name='magicinitiate' then
    if jsonb_array_length(coalesce(v_choices->'spell-list','[]'::jsonb))<>1
       or jsonb_array_length(coalesce(v_choices->'spellcasting-ability','[]'::jsonb))<>1 then
      raise exception 'Magic Initiate requires a spell list and spellcasting ability.';
    end if;
    v_list:=coalesce((v_choices->'spell-list'->0)->>'value',(v_choices->'spell-list'->0)->>'label','');
    if lower(v_list) not in ('cleric','druid','wizard') then raise exception 'Magic Initiate spell list must be Cleric, Druid, or Wizard.'; end if;
    v_ability:=lower(coalesce((v_choices->'spellcasting-ability'->0)->>'value',''));
    if v_ability not in ('int','wis','cha') then raise exception 'Magic Initiate spellcasting ability must be Intelligence, Wisdom, or Charisma.'; end if;
    v_field:='cantrips-'||lower(v_list);
    if jsonb_array_length(coalesce(v_choices->v_field,'[]'::jsonb))<>2 then raise exception 'Magic Initiate requires exactly two % cantrips.',v_list; end if;
    v_seen:='{}'::text[];
    for v_choice in select value from jsonb_array_elements(v_choices->v_field) loop
      v_spell:=private.origin_feat_spell_choice_v1(v_choice);
      if v_spell.id is null or v_spell.level<>0 or not exists(select 1 from unnest(coalesce(v_spell.classes,'{}'::text[])) c where lower(c)=lower(v_list)) then raise exception 'Magic Initiate contains an invalid % cantrip.',v_list; end if;
      if v_spell.id::text=any(v_seen) then raise exception 'Magic Initiate cantrips must be distinct.'; end if;
      v_seen:=array_append(v_seen,v_spell.id::text);
    end loop;
    v_field:='level-1-'||lower(v_list);
    if jsonb_array_length(coalesce(v_choices->v_field,'[]'::jsonb))<>1 then raise exception 'Magic Initiate requires exactly one level 1 % spell.',v_list; end if;
    v_spell:=private.origin_feat_spell_choice_v1(v_choices->v_field->0);
    if v_spell.id is null or v_spell.level<>1 or not exists(select 1 from unnest(coalesce(v_spell.classes,'{}'::text[])) c where lower(c)=lower(v_list)) then raise exception 'Magic Initiate contains an invalid level 1 % spell.',v_list; end if;
    select count(*) into v_count from jsonb_each(v_choices) e where jsonb_typeof(e.value)='array' and jsonb_array_length(e.value)>0;
    if v_count<>4 then raise exception 'Magic Initiate contains an unexpected active child choice.'; end if;
    return;
  end if;

  raise exception 'Origin feat % does not have a modeled source-owned choice shape.',v_option.name;
end;
$$;

create or replace function private.apply_source_owned_origin_feat_v1(
  p_character_id uuid,
  p_level integer,
  p_option_id uuid,
  p_instance jsonb,
  p_instance_key text,
  p_owner_type text,
  p_owner_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_option public.character_option_catalog%rowtype;
  v_name text;
  v_sheet jsonb:='{}'::jsonb;
  v_choices jsonb:=coalesce(p_instance->'choices','{}'::jsonb);
  v_choice jsonb;
  v_values jsonb;
  v_skill text;
  v_tool text;
  v_skills jsonb;
  v_tools jsonb;
  v_weapons jsonb;
  v_spell public.spells_catalog%rowtype;
  v_list text;
  v_ability text;
  v_field text;
  v_existing boolean:=false;
  v_repeatable boolean:=false;
  v_sanitized jsonb;
begin
  perform private.validate_source_owned_origin_feat_v1(p_character_id,p_level,p_option_id,p_instance);
  select * into v_option from public.character_option_catalog where id=p_option_id;
  v_name:=private.normalize_player_choice_name_v1(v_option.name);
  v_repeatable:=coalesce((v_option.metadata->>'repeatable')::boolean,false);

  select exists(select 1 from public.character_option_grant_instances gi where gi.character_id=p_character_id and gi.option_catalog_id=p_option_id) into v_existing;
  if v_existing and not v_repeatable then raise exception '% is not repeatable and is already granted to this character.',v_option.name; end if;
  if exists(select 1 from public.character_option_grant_instances gi where gi.character_id=p_character_id and gi.instance_key=p_instance_key) then raise exception 'The source-owned feat instance key is already in use.'; end if;

  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  v_skills:=case when jsonb_typeof(v_sheet#>'{proficiencies,skills}')='object' then v_sheet#>'{proficiencies,skills}' else '{}'::jsonb end;
  v_tools:=case when jsonb_typeof(v_sheet->'tools')='array' then v_sheet->'tools' else '[]'::jsonb end;
  v_weapons:=case when jsonb_typeof(v_sheet->'weaponProficiencies')='array' then v_sheet->'weaponProficiencies' else '[]'::jsonb end;

  if v_name='skilled' then
    for v_choice in select value from jsonb_array_elements(v_choices->'skills-or-tools') loop
      if v_choice->>'kind'='skill' then
        v_skill:=lower(coalesce(v_choice->>'value',''));
        v_skills:=jsonb_set(v_skills,array[v_skill],coalesce(v_skills->v_skill,'{}'::jsonb)||jsonb_build_object('proficient',true),true);
      else
        v_tool:=coalesce(v_choice->>'label',v_choice->>'value','');
        if not exists(select 1 from jsonb_array_elements_text(v_tools) t where private.normalize_player_choice_name_v1(t)=private.normalize_player_choice_name_v1(v_tool)) then v_tools:=v_tools||to_jsonb(v_tool); end if;
      end if;
    end loop;
  elsif v_name in ('crafter','musician') then
    for v_choice in select value from jsonb_array_elements(v_choices->'tool-1') loop
      v_tool:=coalesce(v_choice->>'label',v_choice->>'value','');
      if not exists(select 1 from jsonb_array_elements_text(v_tools) t where private.normalize_player_choice_name_v1(t)=private.normalize_player_choice_name_v1(v_tool)) then v_tools:=v_tools||to_jsonb(v_tool); end if;
    end loop;
  elsif v_name='tavernbrawler' then
    if not exists(select 1 from jsonb_array_elements_text(v_weapons) w where private.normalize_player_choice_name_v1(w)='improvisedweapons') then v_weapons:=v_weapons||to_jsonb('Improvised Weapons'::text); end if;
  elsif v_name='tough' then
    v_sheet:=jsonb_set(v_sheet,'{hp}',to_jsonb(greatest(1,coalesce((v_sheet->>'hp')::integer,1)+2*greatest(1,p_level))),true);
    v_sheet:=jsonb_set(v_sheet,'{maxHp}',to_jsonb(greatest(1,coalesce((v_sheet->>'maxHp')::integer,coalesce((v_sheet->>'hp')::integer,1))+2*greatest(1,p_level))),true);
    v_sheet:=jsonb_set(v_sheet,'{featChoiceEffects,tough}',jsonb_build_object('hpPerLevel',2,'acquiredLevel',p_level),true);
  elsif v_name='magicinitiate' then
    v_list:=coalesce((v_choices->'spell-list'->0)->>'value',(v_choices->'spell-list'->0)->>'label','');
    v_ability:=lower(coalesce((v_choices->'spellcasting-ability'->0)->>'value',''));
    v_field:='cantrips-'||lower(v_list);
    for v_choice in select value from jsonb_array_elements(v_choices->v_field) loop
      v_spell:=private.origin_feat_spell_choice_v1(v_choice);
      insert into public.character_spells(character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,casting_stat,raw_payload)
      values(p_character_id,v_spell.id,'feat',p_instance_key,v_option.name,true,true,true,v_ability,jsonb_build_object('grantedByFeat',v_option.name,'grantedAtLevel',p_level,'spellList',v_list))
      on conflict(character_id,spell_id,source_type,source_key) do update set known=true,prepared=true,always_available=true,casting_stat=excluded.casting_stat,raw_payload=excluded.raw_payload;
    end loop;
    v_field:='level-1-'||lower(v_list);
    v_spell:=private.origin_feat_spell_choice_v1(v_choices->v_field->0);
    insert into public.character_spells(character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,casting_stat,uses_remaining,uses_max,recharge,raw_payload)
    values(p_character_id,v_spell.id,'feat',p_instance_key,v_option.name,true,true,true,v_ability,1,1,'long-rest',jsonb_build_object('grantedByFeat',v_option.name,'grantedAtLevel',p_level,'spellList',v_list,'freeCast',true))
    on conflict(character_id,spell_id,source_type,source_key) do update set known=true,prepared=true,always_available=true,casting_stat=excluded.casting_stat,uses_remaining=1,uses_max=1,recharge='long-rest',raw_payload=excluded.raw_payload;
  end if;

  v_sheet:=jsonb_set(v_sheet,'{proficiencies,skills}',v_skills,true);
  v_sheet:=jsonb_set(v_sheet,'{tools}',v_tools,true);
  v_sheet:=jsonb_set(v_sheet,'{weaponProficiencies}',v_weapons,true);
  if not exists(select 1 from jsonb_array_elements_text(case when jsonb_typeof(v_sheet->'feats')='array' then v_sheet->'feats' else '[]'::jsonb end) f where private.normalize_player_choice_name_v1(f)=private.normalize_player_choice_name_v1(v_option.name)) then
    v_sheet:=jsonb_set(v_sheet,'{feats}',(case when jsonb_typeof(v_sheet->'feats')='array' then v_sheet->'feats' else '[]'::jsonb end)||to_jsonb(v_option.name),true);
  end if;

  v_sanitized:=jsonb_build_object(
    'instanceId',p_instance_key,'optionId',v_option.id,'optionKey',v_option.option_key,'name',v_option.name,'source',v_option.source,'category',v_option.category,
    'optionType','feat','repeatable',v_repeatable,'acquisitionOwnerType',p_owner_type,'acquisitionOwnerKey',p_owner_key,'acquisitionLabel',coalesce(p_instance->>'acquisitionLabel',v_option.name),
    'acquisitionLevel',p_level,'fixedEffects',coalesce(p_instance->'fixedEffects','[]'::jsonb),'fixedSpellTokens',coalesce(p_instance->'fixedSpellTokens','[]'::jsonb),'choices',v_choices
  );
  v_sheet:=jsonb_set(v_sheet,'{featGrantInstances}',(case when jsonb_typeof(v_sheet->'featGrantInstances')='array' then v_sheet->'featGrantInstances' else '[]'::jsonb end)||jsonb_build_array(v_sanitized),true);

  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now() where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);

  insert into public.character_option_grants(character_id,option_catalog_id,source_note,metadata,granted_by)
  values(p_character_id,v_option.id,'source-owned Origin feat',jsonb_build_object('source','source-owned','instanceKey',p_instance_key,'ownerType',p_owner_type,'ownerKey',p_owner_key),auth.uid())
  on conflict(character_id,option_catalog_id) do update set metadata=excluded.metadata,source_note=excluded.source_note;

  insert into public.character_option_grant_instances(character_id,instance_key,option_catalog_id,option_type,option_name,option_source,category,acquired_level,acquisition_owner_type,acquisition_owner_key,acquisition_label,choices,metadata,granted_by,updated_at)
  values(p_character_id,p_instance_key,v_option.id,'feat',v_option.name,v_option.source,v_option.category,p_level,p_owner_type,p_owner_key,coalesce(p_instance->>'acquisitionLabel',v_option.name),v_choices,jsonb_build_object('source','source-owned'),auth.uid(),now());

  return v_sanitized;
end;
$$;

revoke all on function private.validate_source_owned_origin_feat_v1(uuid,integer,uuid,jsonb) from public,anon,authenticated;
revoke all on function private.apply_source_owned_origin_feat_v1(uuid,integer,uuid,jsonb,text,text,text) from public,anon,authenticated;
grant execute on function private.validate_source_owned_origin_feat_v1(uuid,integer,uuid,jsonb) to service_role;
grant execute on function private.apply_source_owned_origin_feat_v1(uuid,integer,uuid,jsonb,text,text,text) to service_role;
