-- Reversible source-owned Origin feat effects for class-option ownership such as
-- Warlock: Lessons of the First Ones. This migration records the aggregate effects
-- introduced by each feat instance so later legal source replacement can remove only
-- benefits that instance actually introduced.

create or replace function private.other_character_option_effect_claim_v1(
  p_character_id uuid,
  p_exclude_instance_key text,
  p_effect_type text,
  p_effect_key text
)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $$
  select exists(
    select 1
    from public.character_option_grant_instances gi
    cross join lateral jsonb_array_elements(case when jsonb_typeof(gi.effects)='array' then gi.effects else '[]'::jsonb end) effect
    where gi.character_id=p_character_id
      and gi.instance_key<>coalesce(p_exclude_instance_key,'')
      and effect->>'type'=p_effect_type
      and private.normalize_player_choice_name_v1(
        coalesce(effect->>'skill',effect->>'tool',effect->>'weapon',effect->>'key','')
      )=private.normalize_player_choice_name_v1(coalesce(p_effect_key,''))
  );
$$;

revoke all on function private.other_character_option_effect_claim_v1(uuid,text,text,text) from public,anon,authenticated;
grant execute on function private.other_character_option_effect_claim_v1(uuid,text,text,text) to service_role;

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
  v_preexisting boolean:=false;
  v_effects jsonb:='[]'::jsonb;
  v_sanitized jsonb;
  v_notes text;
  v_fixed_effects jsonb:='[]'::jsonb;
begin
  perform private.validate_source_owned_origin_feat_v1(p_character_id,p_level,p_option_id,p_instance);
  select * into v_option from public.character_option_catalog where id=p_option_id;
  if not found then raise exception 'Source-owned Origin feat option is unavailable.'; end if;
  v_name:=private.normalize_player_choice_name_v1(v_option.name);
  v_repeatable:=coalesce((v_option.metadata->>'repeatable')::boolean,false);

  select exists(
    select 1 from public.character_option_grant_instances gi
    where gi.character_id=p_character_id and gi.option_id=p_option_id
  ) into v_existing;
  if v_existing and not v_repeatable then raise exception '% is not repeatable and is already granted to this character.',v_option.name; end if;
  if exists(
    select 1 from public.character_option_grant_instances gi
    where gi.character_id=p_character_id and gi.instance_key=p_instance_key
  ) then raise exception 'The source-owned feat instance key is already in use.'; end if;

  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets where character_id=p_character_id for update;
  v_skills:=case when jsonb_typeof(v_sheet#>'{proficiencies,skills}')='object' then v_sheet#>'{proficiencies,skills}' else '{}'::jsonb end;
  v_tools:=case when jsonb_typeof(v_sheet->'tools')='array' then v_sheet->'tools' else '[]'::jsonb end;
  v_weapons:=case when jsonb_typeof(v_sheet->'weaponProficiencies')='array' then v_sheet->'weaponProficiencies' else '[]'::jsonb end;

  if v_name='skilled' then
    for v_choice in select value from jsonb_array_elements(v_choices->'skills-or-tools') loop
      if v_choice->>'kind'='skill' then
        v_skill:=private.player_sheet_skill_key_v1(coalesce(v_choice->>'label',v_choice->>'value',''));
        if v_skill is null then raise exception 'Skilled contains an invalid skill choice.'; end if;
        v_preexisting:=coalesce((v_skills#>>array[v_skill,'proficient'])::boolean,false);
        v_skills:=jsonb_set(v_skills,array[v_skill],coalesce(v_skills->v_skill,'{}'::jsonb)||jsonb_build_object('proficient',true),true);
        v_effects:=v_effects||jsonb_build_array(jsonb_build_object('type','skill-proficiency','skill',v_skill,'introduced',not v_preexisting));
      else
        v_tool:=coalesce(v_choice->>'label',v_choice->>'value','');
        v_preexisting:=exists(select 1 from jsonb_array_elements_text(v_tools) t where private.normalize_player_choice_name_v1(t)=private.normalize_player_choice_name_v1(v_tool));
        if not v_preexisting then v_tools:=v_tools||to_jsonb(v_tool); end if;
        v_effects:=v_effects||jsonb_build_array(jsonb_build_object('type','tool-proficiency','tool',v_tool,'introduced',not v_preexisting));
      end if;
    end loop;
  elsif v_name in ('crafter','musician') then
    for v_choice in select value from jsonb_array_elements(v_choices->'tool-1') loop
      v_tool:=coalesce(v_choice->>'label',v_choice->>'value','');
      v_preexisting:=exists(select 1 from jsonb_array_elements_text(v_tools) t where private.normalize_player_choice_name_v1(t)=private.normalize_player_choice_name_v1(v_tool));
      if not v_preexisting then v_tools:=v_tools||to_jsonb(v_tool); end if;
      v_effects:=v_effects||jsonb_build_array(jsonb_build_object('type','tool-proficiency','tool',v_tool,'introduced',not v_preexisting));
    end loop;
  elsif v_name='tavernbrawler' then
    v_tool:='Improvised Weapons';
    v_preexisting:=exists(select 1 from jsonb_array_elements_text(v_weapons) w where private.normalize_player_choice_name_v1(w)=private.normalize_player_choice_name_v1(v_tool));
    if not v_preexisting then v_weapons:=v_weapons||to_jsonb(v_tool); end if;
    v_effects:=v_effects||jsonb_build_array(jsonb_build_object('type','weapon-proficiency','weapon',v_tool,'introduced',not v_preexisting));
  elsif v_name='tough' then
    v_sheet:=jsonb_set(v_sheet,'{hp}',to_jsonb(greatest(1,coalesce((v_sheet->>'hp')::integer,1)+2*greatest(1,p_level))),true);
    v_sheet:=jsonb_set(v_sheet,'{maxHp}',to_jsonb(greatest(1,coalesce((v_sheet->>'maxHp')::integer,coalesce((v_sheet->>'hp')::integer,1))+2*greatest(1,p_level))),true);
    v_sheet:=jsonb_set(v_sheet,'{featChoiceEffects,tough}',jsonb_build_object('hpPerLevel',2,'acquiredLevel',p_level,'ownerInstanceKey',p_instance_key),true);
    v_effects:=v_effects||jsonb_build_array(jsonb_build_object('type','tough-hit-points','hpPerLevel',2,'acquiredLevel',p_level,'introduced',true));
  elsif v_name='magicinitiate' then
    v_list:=coalesce((v_choices->'spell-list'->0)->>'value',(v_choices->'spell-list'->0)->>'label','');
    v_ability:=lower(coalesce((v_choices->'spellcasting-ability'->0)->>'value',''));
    v_field:='cantrips-'||lower(v_list);
    for v_choice in select value from jsonb_array_elements(v_choices->v_field) loop
      v_spell:=private.origin_feat_spell_choice_v1(v_choice);
      insert into public.character_spells(character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,casting_stat,raw_payload)
      values(p_character_id,v_spell.id,'feat',p_instance_key,v_option.name,true,true,true,v_ability,jsonb_build_object('grantedByFeat',v_option.name,'grantedAtLevel',p_level,'spellList',v_list))
      on conflict(character_id,spell_id,source_type,source_key) do update
      set known=true,prepared=true,always_available=true,casting_stat=excluded.casting_stat,raw_payload=excluded.raw_payload;
    end loop;
    v_field:='level-1-'||lower(v_list);
    v_spell:=private.origin_feat_spell_choice_v1(v_choices->v_field->0);
    insert into public.character_spells(character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,casting_stat,uses_remaining,uses_max,recharge,raw_payload)
    values(p_character_id,v_spell.id,'feat',p_instance_key,v_option.name,true,true,true,v_ability,1,1,'long-rest',jsonb_build_object('grantedByFeat',v_option.name,'grantedAtLevel',p_level,'spellList',v_list,'freeCast',true))
    on conflict(character_id,spell_id,source_type,source_key) do update
    set known=true,prepared=true,always_available=true,casting_stat=excluded.casting_stat,uses_remaining=1,uses_max=1,recharge='long-rest',raw_payload=excluded.raw_payload;
    v_effects:=v_effects||jsonb_build_array(jsonb_build_object('type','feat-spell-source','sourceKey',p_instance_key,'spellList',v_list,'introduced',true));
  end if;

  v_sheet:=jsonb_set(v_sheet,'{proficiencies,skills}',v_skills,true);
  v_sheet:=jsonb_set(v_sheet,'{tools}',v_tools,true);
  v_sheet:=jsonb_set(v_sheet,'{weaponProficiencies}',v_weapons,true);
  if not exists(
    select 1 from jsonb_array_elements_text(case when jsonb_typeof(v_sheet->'feats')='array' then v_sheet->'feats' else '[]'::jsonb end) f
    where private.normalize_player_choice_name_v1(f)=private.normalize_player_choice_name_v1(v_option.name)
  ) then
    v_sheet:=jsonb_set(v_sheet,'{feats}',(case when jsonb_typeof(v_sheet->'feats')='array' then v_sheet->'feats' else '[]'::jsonb end)||to_jsonb(v_option.name),true);
  end if;

  v_fixed_effects:=coalesce(p_instance->'fixedEffects','[]'::jsonb)||v_effects;
  v_sanitized:=jsonb_build_object(
    'instanceId',p_instance_key,
    'optionId',v_option.id,
    'optionKey',v_option.option_key,
    'name',v_option.name,
    'source',v_option.source,
    'category',v_option.category,
    'optionType','feat',
    'repeatable',v_repeatable,
    'acquisitionOwnerType',p_owner_type,
    'acquisitionOwnerKey',p_owner_key,
    'acquisitionLabel',coalesce(p_instance->>'acquisitionLabel',v_option.name),
    'acquisitionLevel',p_level,
    'fixedEffects',v_fixed_effects,
    'fixedSpellTokens',coalesce(p_instance->'fixedSpellTokens','[]'::jsonb),
    'choices',v_choices
  );
  v_sheet:=jsonb_set(
    v_sheet,
    '{featGrantInstances}',
    (case when jsonb_typeof(v_sheet->'featGrantInstances')='array' then v_sheet->'featGrantInstances' else '[]'::jsonb end)||jsonb_build_array(v_sanitized),
    true
  );

  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now()
  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);

  v_notes:='source-owned Origin feat; instance='||p_instance_key||'; owner='||coalesce(p_owner_type,'')||':'||coalesce(p_owner_key,'');
  insert into public.character_option_grants(character_id,option_id,notes,granted_by)
  values(p_character_id,v_option.id,v_notes,auth.uid())
  on conflict(character_id,option_id) do update
  set notes=excluded.notes,
      granted_by=coalesce(excluded.granted_by,public.character_option_grants.granted_by),
      updated_at=now();

  insert into public.character_option_grant_instances(
    character_id,instance_key,option_id,option_key,option_type,option_name,option_source,
    acquisition_level,acquisition_owner_type,acquisition_owner_key,acquisition_label,
    choices,effects,fixed_spell_tokens,repeatable,granted_by,updated_at
  ) values (
    p_character_id,p_instance_key,v_option.id,v_option.option_key,'feat',v_option.name,v_option.source,
    p_level,p_owner_type,p_owner_key,coalesce(p_instance->>'acquisitionLabel',v_option.name),
    v_choices,v_effects,coalesce(p_instance->'fixedSpellTokens','[]'::jsonb),v_repeatable,auth.uid(),now()
  );

  return v_sanitized;
end;
$$;

create or replace function private.remove_source_owned_origin_feat_v1(
  p_character_id uuid,
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
  v_instance public.character_option_grant_instances%rowtype;
  v_option public.character_option_catalog%rowtype;
  v_sheet jsonb:='{}'::jsonb;
  v_effect jsonb;
  v_type text;
  v_key text;
  v_skills jsonb:='{}'::jsonb;
  v_tools jsonb:='[]'::jsonb;
  v_weapons jsonb:='[]'::jsonb;
  v_current_level integer:=1;
  v_hp integer:=0;
  v_max integer:=0;
  v_new_max integer:=0;
  v_delta integer:=0;
  v_remaining_same_option integer:=0;
  v_feats jsonb:='[]'::jsonb;
  v_feat_instances jsonb:='[]'::jsonb;
begin
  select * into v_instance
  from public.character_option_grant_instances gi
  where gi.character_id=p_character_id
    and gi.instance_key=p_instance_key
    and gi.acquisition_owner_type=p_owner_type
    and gi.acquisition_owner_key=p_owner_key
  for update;
  if not found then raise exception 'The source-owned Origin feat instance is missing.'; end if;

  select * into v_option from public.character_option_catalog where id=v_instance.option_id;
  if not found or v_instance.option_type<>'feat' or coalesce(v_option.category,'')<>'O' then
    raise exception 'The requested source-owned grant is not an Origin feat.';
  end if;

  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets where character_id=p_character_id for update;
  v_skills:=case when jsonb_typeof(v_sheet#>'{proficiencies,skills}')='object' then v_sheet#>'{proficiencies,skills}' else '{}'::jsonb end;
  v_tools:=case when jsonb_typeof(v_sheet->'tools')='array' then v_sheet->'tools' else '[]'::jsonb end;
  v_weapons:=case when jsonb_typeof(v_sheet->'weaponProficiencies')='array' then v_sheet->'weaponProficiencies' else '[]'::jsonb end;

  for v_effect in select value from jsonb_array_elements(case when jsonb_typeof(v_instance.effects)='array' then v_instance.effects else '[]'::jsonb end)
  loop
    v_type:=coalesce(v_effect->>'type','');
    if v_type='skill-proficiency' and coalesce((v_effect->>'introduced')::boolean,false) then
      v_key:=coalesce(v_effect->>'skill','');
      if not private.other_character_option_effect_claim_v1(p_character_id,p_instance_key,'skill-proficiency',v_key) then
        if coalesce((v_skills#>>array[v_key,'expertise'])::boolean,false) then
          raise exception 'Cannot remove % because % proficiency currently supports Expertise.',v_option.name,v_key;
        end if;
        v_skills:=jsonb_set(v_skills,array[v_key],coalesce(v_skills->v_key,'{}'::jsonb)||jsonb_build_object('proficient',false),true);
      end if;
    elsif v_type='tool-proficiency' and coalesce((v_effect->>'introduced')::boolean,false) then
      v_key:=coalesce(v_effect->>'tool','');
      if not private.other_character_option_effect_claim_v1(p_character_id,p_instance_key,'tool-proficiency',v_key) then
        select coalesce(jsonb_agg(to_jsonb(entry.value) order by entry.ord),'[]'::jsonb) into v_tools
        from jsonb_array_elements_text(v_tools) with ordinality entry(value,ord)
        where private.normalize_player_choice_name_v1(entry.value)<>private.normalize_player_choice_name_v1(v_key);
      end if;
    elsif v_type='weapon-proficiency' and coalesce((v_effect->>'introduced')::boolean,false) then
      v_key:=coalesce(v_effect->>'weapon','');
      if not private.other_character_option_effect_claim_v1(p_character_id,p_instance_key,'weapon-proficiency',v_key) then
        select coalesce(jsonb_agg(to_jsonb(entry.value) order by entry.ord),'[]'::jsonb) into v_weapons
        from jsonb_array_elements_text(v_weapons) with ordinality entry(value,ord)
        where private.normalize_player_choice_name_v1(entry.value)<>private.normalize_player_choice_name_v1(v_key);
      end if;
    elsif v_type='tough-hit-points' then
      select coalesce(class_level,1) into v_current_level from public.character_progression where character_id=p_character_id;
      begin v_hp:=coalesce((v_sheet->>'hp')::integer,0); exception when others then v_hp:=0; end;
      begin v_max:=coalesce((v_sheet->>'maxHp')::integer,v_hp); exception when others then v_max:=v_hp; end;
      v_delta:=greatest(1,v_current_level)*greatest(1,coalesce((v_effect->>'hpPerLevel')::integer,2));
      v_new_max:=greatest(1,v_max-v_delta);
      v_sheet:=jsonb_set(v_sheet,'{maxHp}',to_jsonb(v_new_max),true);
      v_sheet:=jsonb_set(v_sheet,'{hp}',to_jsonb(greatest(0,least(v_hp,v_new_max))),true);
      v_sheet:=v_sheet#-'{featChoiceEffects,tough}';
    elsif v_type='feat-spell-source' then
      delete from public.character_spells
      where character_id=p_character_id and source_type='feat' and source_key=p_instance_key;
    end if;
  end loop;

  v_sheet:=jsonb_set(v_sheet,'{proficiencies,skills}',v_skills,true);
  v_sheet:=jsonb_set(v_sheet,'{tools}',v_tools,true);
  v_sheet:=jsonb_set(v_sheet,'{weaponProficiencies}',v_weapons,true);

  delete from public.character_option_grant_instances
  where character_id=p_character_id and instance_key=p_instance_key;

  select count(*) into v_remaining_same_option
  from public.character_option_grant_instances
  where character_id=p_character_id and option_id=v_option.id;

  v_feat_instances:=case when jsonb_typeof(v_sheet->'featGrantInstances')='array' then v_sheet->'featGrantInstances' else '[]'::jsonb end;
  select coalesce(jsonb_agg(entry.value order by entry.ord),'[]'::jsonb) into v_feat_instances
  from jsonb_array_elements(v_feat_instances) with ordinality entry(value,ord)
  where entry.value->>'instanceId'<>p_instance_key;
  v_sheet:=jsonb_set(v_sheet,'{featGrantInstances}',v_feat_instances,true);

  if v_remaining_same_option=0 then
    v_feats:=case when jsonb_typeof(v_sheet->'feats')='array' then v_sheet->'feats' else '[]'::jsonb end;
    select coalesce(jsonb_agg(to_jsonb(entry.value) order by entry.ord),'[]'::jsonb) into v_feats
    from jsonb_array_elements_text(v_feats) with ordinality entry(value,ord)
    where private.normalize_player_choice_name_v1(entry.value)<>private.normalize_player_choice_name_v1(v_option.name);
    v_sheet:=jsonb_set(v_sheet,'{feats}',v_feats,true);
    delete from public.character_option_grants where character_id=p_character_id and option_id=v_option.id;
  end if;

  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
  update public.players p set sheet=v_sheet,updated_at=now()
  where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);

  return jsonb_build_object(
    'instanceKey',p_instance_key,
    'optionId',v_option.id,
    'optionKey',v_option.option_key,
    'name',v_option.name,
    'source',v_option.source,
    'removedEffects',v_instance.effects
  );
end;
$$;

revoke all on function private.apply_source_owned_origin_feat_v1(uuid,integer,uuid,jsonb,text,text,text) from public,anon,authenticated;
revoke all on function private.remove_source_owned_origin_feat_v1(uuid,text,text,text) from public,anon,authenticated;
grant execute on function private.apply_source_owned_origin_feat_v1(uuid,integer,uuid,jsonb,text,text,text) to service_role;
grant execute on function private.remove_source_owned_origin_feat_v1(uuid,text,text,text) to service_role;
