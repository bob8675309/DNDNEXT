-- Forward repair for source-owned Origin feat acquisition (for example
-- Lessons of the First Ones). The original helper predates the normalized
-- character_option_grants / character_option_grant_instances schema.

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
  v_notes text;
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
        v_skill:=lower(coalesce(v_choice->>'value',''));
        v_skills:=jsonb_set(v_skills,array[v_skill],coalesce(v_skills->v_skill,'{}'::jsonb)||jsonb_build_object('proficient',true),true);
      else
        v_tool:=coalesce(v_choice->>'label',v_choice->>'value','');
        if not exists(select 1 from jsonb_array_elements_text(v_tools) t where private.normalize_player_choice_name_v1(t)=private.normalize_player_choice_name_v1(v_tool)) then
          v_tools:=v_tools||to_jsonb(v_tool);
        end if;
      end if;
    end loop;
  elsif v_name in ('crafter','musician') then
    for v_choice in select value from jsonb_array_elements(v_choices->'tool-1') loop
      v_tool:=coalesce(v_choice->>'label',v_choice->>'value','');
      if not exists(select 1 from jsonb_array_elements_text(v_tools) t where private.normalize_player_choice_name_v1(t)=private.normalize_player_choice_name_v1(v_tool)) then
        v_tools:=v_tools||to_jsonb(v_tool);
      end if;
    end loop;
  elsif v_name='tavernbrawler' then
    if not exists(select 1 from jsonb_array_elements_text(v_weapons) w where private.normalize_player_choice_name_v1(w)='improvisedweapons') then
      v_weapons:=v_weapons||to_jsonb('Improvised Weapons'::text);
    end if;
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
      on conflict(character_id,spell_id,source_type,source_key) do update
      set known=true,prepared=true,always_available=true,casting_stat=excluded.casting_stat,raw_payload=excluded.raw_payload;
    end loop;
    v_field:='level-1-'||lower(v_list);
    v_spell:=private.origin_feat_spell_choice_v1(v_choices->v_field->0);
    insert into public.character_spells(character_id,spell_id,source_type,source_key,source_label,known,prepared,always_available,casting_stat,uses_remaining,uses_max,recharge,raw_payload)
    values(p_character_id,v_spell.id,'feat',p_instance_key,v_option.name,true,true,true,v_ability,1,1,'long-rest',jsonb_build_object('grantedByFeat',v_option.name,'grantedAtLevel',p_level,'spellList',v_list,'freeCast',true))
    on conflict(character_id,spell_id,source_type,source_key) do update
    set known=true,prepared=true,always_available=true,casting_stat=excluded.casting_stat,uses_remaining=1,uses_max=1,recharge='long-rest',raw_payload=excluded.raw_payload;
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
    'fixedEffects',coalesce(p_instance->'fixedEffects','[]'::jsonb),
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
    v_choices,
    coalesce(p_instance->'fixedEffects','[]'::jsonb),
    coalesce(p_instance->'fixedSpellTokens','[]'::jsonb),
    v_repeatable,
    auth.uid(),
    now()
  );

  return v_sanitized;
end;
$$;

revoke all on function private.apply_source_owned_origin_feat_v1(uuid,integer,uuid,jsonb,text,text,text) from public,anon,authenticated;
grant execute on function private.apply_source_owned_origin_feat_v1(uuid,integer,uuid,jsonb,text,text,text) to service_role;
