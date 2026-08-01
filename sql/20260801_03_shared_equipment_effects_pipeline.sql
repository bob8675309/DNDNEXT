-- Shared authoritative numeric equipment-effects pipeline.
--
-- This consolidates numeric character-sheet and tactical equipment math while
-- preserving presentation-only parsing in utils/equipmentEffects.js. Existing
-- encounter participant rows are immutable snapshots and are not rewritten.

create or replace function private.character_equipment_effects_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private', 'auth'
as $function$
declare
  v_sheet jsonb := '{}'::jsonb;
  v_item record;
  v_catalog jsonb := '{}'::jsonb;
  v_payload jsonb := '{}'::jsonb;
  v_modifiers jsonb := '{}'::jsonb;
  v_node jsonb;
  v_key text;
  v_text text;
  v_number integer;
  v_raw_type text;
  v_item_type text;
  v_item_name text;
  v_category text;
  v_candidate_ac integer;

  v_base_scores jsonb := jsonb_build_object('str',10,'dex',10,'con',10,'int',10,'wis',10,'cha',10);
  v_score_bonuses jsonb := jsonb_build_object('str',0,'dex',0,'con',0,'int',0,'wis',0,'cha',0);
  v_mod_bonuses jsonb := jsonb_build_object('str',0,'dex',0,'con',0,'int',0,'wis',0,'cha',0);
  v_effective_scores jsonb := '{}'::jsonb;
  v_effective_mods jsonb := '{}'::jsonb;

  v_bonus_ac integer := 0;
  v_saves_all integer := 0;
  v_saves jsonb := '{}'::jsonb;
  v_skills_all integer := 0;
  v_skills jsonb := '{}'::jsonb;
  v_initiative integer := 0;

  v_sheet_ac integer;
  v_base_ac integer;
  v_armor_base integer;
  v_armor_category text;
  v_armor_item_id uuid;
  v_armor_name text;
  v_shield_bonus integer := 0;
  v_shield_item_id uuid;
  v_shield_name text;
  v_dex_mod integer := 0;
  v_dex_applied integer := 0;
  v_total_ac integer;
  v_equipped_ids jsonb := '[]'::jsonb;
begin
  if p_character_id is null then
    return jsonb_build_object(
      'schemaVersion', 1,
      'abilities', jsonb_build_object(
        'str',jsonb_build_object('base',10,'scoreBonus',0,'effectiveScore',10,'modBonus',0,'effectiveMod',0),
        'dex',jsonb_build_object('base',10,'scoreBonus',0,'effectiveScore',10,'modBonus',0,'effectiveMod',0),
        'con',jsonb_build_object('base',10,'scoreBonus',0,'effectiveScore',10,'modBonus',0,'effectiveMod',0),
        'int',jsonb_build_object('base',10,'scoreBonus',0,'effectiveScore',10,'modBonus',0,'effectiveMod',0),
        'wis',jsonb_build_object('base',10,'scoreBonus',0,'effectiveScore',10,'modBonus',0,'effectiveMod',0),
        'cha',jsonb_build_object('base',10,'scoreBonus',0,'effectiveScore',10,'modBonus',0,'effectiveMod',0)
      ),
      'ac', jsonb_build_object('total',10,'base',10,'dexApplied',0,'armorCategory',null,'armorBase',null,'armorItemId',null,'armorName',null,'shieldBonus',0,'shieldItemId',null,'shieldName',null,'otherBonus',0),
      'savesAll', 0,
      'saves', '{}'::jsonb,
      'skillsAll', 0,
      'skills', '{}'::jsonb,
      'initiative', 0,
      'equippedItemIds', '[]'::jsonb
    );
  end if;

  select coalesce(cs.sheet, '{}'::jsonb)
  into v_sheet
  from public.character_sheets cs
  where cs.character_id = p_character_id;

  foreach v_key in array array['str','dex','con','int','wis','cha']
  loop
    v_text := nullif(v_sheet#>>array['abilities',v_key,'score'], '');
    if v_text ~ '^-?[0-9]+$' then
      v_base_scores := jsonb_set(v_base_scores, array[v_key], to_jsonb(greatest(1,least(30,v_text::integer))), true);
    end if;
  end loop;

  v_text := nullif(v_sheet->>'ac','');
  if v_text ~ '^-?[0-9]+$' and v_text::integer <> 0 then
    v_sheet_ac := v_text::integer;
  end if;

  for v_item in
    select i.*
    from public.inventory_items i
    where i.is_equipped
      and (
        (i.owner_id = p_character_id::text and lower(coalesce(i.owner_type,'')) in ('npc','merchant','character'))
        or (
          lower(coalesce(i.owner_type,''))='player'
          and exists (
            select 1
            from public.character_permissions cp
            where cp.character_id=p_character_id
              and coalesce(cp.can_edit,false)
              and i.owner_id=cp.user_id::text
          )
        )
      )
    order by i.updated_at desc nulls last, i.id
  loop
    v_catalog := '{}'::jsonb;
    select coalesce(ic.payload,'{}'::jsonb)
    into v_catalog
    from public.items_catalog ic
    where ic.item_key = coalesce(v_item.card_payload->>'item_key',v_item.card_payload->>'item_id',v_item.item_id)
       or ic.item_key = v_item.item_id
       or lower(ic.item_name)=lower(v_item.item_name)
    order by
      case when ic.item_key=coalesce(v_item.card_payload->>'item_key',v_item.card_payload->>'item_id',v_item.item_id) then 0
           when ic.item_key=v_item.item_id then 1 else 2 end,
      case when coalesce(ic.payload->>'edition','')='one' then 0 else 1 end
    limit 1;

    v_payload := coalesce(v_catalog,'{}'::jsonb) || coalesce(v_item.card_payload,'{}'::jsonb);
    v_equipped_ids := v_equipped_ids || jsonb_build_array(v_item.id);

    foreach v_key in array array['bonusAc','acBonus','bonus_ac']
    loop
      v_text := nullif(v_payload->>v_key,'');
      if v_text is not null and v_text ~ '[-+]?[0-9]+' then
        v_number := substring(v_text from '[-+]?[0-9]+')::integer;
        v_bonus_ac := v_bonus_ac + v_number;
        exit;
      end if;
    end loop;

    foreach v_key in array array['bonusSavingThrow','saveBonus','bonus_saving_throw']
    loop
      v_text := nullif(v_payload->>v_key,'');
      if v_text is not null and v_text ~ '[-+]?[0-9]+' then
        v_number := substring(v_text from '[-+]?[0-9]+')::integer;
        v_saves_all := v_saves_all + v_number;
        exit;
      end if;
    end loop;

    foreach v_key in array array['bonusInitiative','initiativeBonus','bonus_initiative']
    loop
      v_text := nullif(v_payload->>v_key,'');
      if v_text is not null and v_text ~ '[-+]?[0-9]+' then
        v_number := substring(v_text from '[-+]?[0-9]+')::integer;
        v_initiative := v_initiative + v_number;
        exit;
      end if;
    end loop;

    v_modifiers := case when jsonb_typeof(v_payload->'modifiers')='object' then v_payload->'modifiers' else '{}'::jsonb end;

    v_node := case when jsonb_typeof(v_modifiers->'abilities')='object' then v_modifiers->'abilities'
                   when jsonb_typeof(v_modifiers->'abilityScores')='object' then v_modifiers->'abilityScores'
                   else '{}'::jsonb end;
    foreach v_key in array array['str','dex','con','int','wis','cha']
    loop
      v_text := nullif(v_node->>v_key,'');
      if v_text is not null and v_text ~ '[-+]?[0-9]+' then
        v_number := substring(v_text from '[-+]?[0-9]+')::integer;
        v_score_bonuses := jsonb_set(v_score_bonuses,array[v_key],to_jsonb(coalesce((v_score_bonuses->>v_key)::integer,0)+v_number),true);
      end if;
    end loop;

    v_node := case when jsonb_typeof(v_modifiers->'abilityMods')='object' then v_modifiers->'abilityMods'
                   when jsonb_typeof(v_modifiers->'abilityModifiers')='object' then v_modifiers->'abilityModifiers'
                   else '{}'::jsonb end;
    foreach v_key in array array['str','dex','con','int','wis','cha']
    loop
      v_text := nullif(v_node->>v_key,'');
      if v_text is not null and v_text ~ '[-+]?[0-9]+' then
        v_number := substring(v_text from '[-+]?[0-9]+')::integer;
        v_mod_bonuses := jsonb_set(v_mod_bonuses,array[v_key],to_jsonb(coalesce((v_mod_bonuses->>v_key)::integer,0)+v_number),true);
      end if;
    end loop;

    v_node := case when jsonb_typeof(v_modifiers->'saves')='object' then v_modifiers->'saves' else '{}'::jsonb end;
    for v_key,v_text in select key,value #>> '{}' from jsonb_each(v_node)
    loop
      if v_text is not null and v_text ~ '[-+]?[0-9]+' then
        v_number := substring(v_text from '[-+]?[0-9]+')::integer;
        if lower(v_key)='all' then
          v_saves_all := v_saves_all + v_number;
        else
          v_saves := jsonb_set(v_saves,array[lower(v_key)],to_jsonb(coalesce((v_saves->>lower(v_key))::integer,0)+v_number),true);
        end if;
      end if;
    end loop;

    v_node := case when jsonb_typeof(v_modifiers->'checks')='object' then v_modifiers->'checks' else '{}'::jsonb end;
    for v_key,v_text in select key,value #>> '{}' from jsonb_each(v_node)
    loop
      if v_text is not null and v_text ~ '[-+]?[0-9]+' then
        v_number := substring(v_text from '[-+]?[0-9]+')::integer;
        if lower(v_key)='all' then
          v_skills_all := v_skills_all + v_number;
        else
          v_skills := jsonb_set(v_skills,array[lower(v_key)],to_jsonb(coalesce((v_skills->>lower(v_key))::integer,0)+v_number),true);
        end if;
      end if;
    end loop;

    if jsonb_typeof(v_modifiers->'initiative') in ('number','string') then
      v_text := v_modifiers->>'initiative';
      if v_text ~ '[-+]?[0-9]+' then v_initiative := v_initiative + substring(v_text from '[-+]?[0-9]+')::integer; end if;
    elsif jsonb_typeof(v_modifiers->'init') in ('number','string') then
      v_text := v_modifiers->>'init';
      if v_text ~ '[-+]?[0-9]+' then v_initiative := v_initiative + substring(v_text from '[-+]?[0-9]+')::integer; end if;
    end if;

    v_raw_type := lower(coalesce(v_payload->>'type',''));
    v_item_type := lower(coalesce(v_payload->>'item_type',v_payload->>'uiType',v_item.item_type,''));
    v_item_name := lower(coalesce(v_payload->>'item_name',v_payload->>'name',v_item.item_name,''));

    if coalesce(v_payload->>'ac','') ~ '^-?[0-9]+$' then
      v_candidate_ac := (v_payload->>'ac')::integer;
    elsif coalesce(v_payload->'armor'->>'ac','') ~ '^-?[0-9]+$' then
      v_candidate_ac := (v_payload->'armor'->>'ac')::integer;
    else
      v_candidate_ac := public.craft_payload_inferred_ac(v_item.item_name);
    end if;

    v_category := case
      when split_part(v_raw_type,'|',1)='s' or v_item_type='shield' or v_item_name='shield' then 'shield'
      when split_part(v_raw_type,'|',1)='ha' or v_item_name in ('ring mail','chain mail','splint','splint armor','plate','plate armor') then 'heavy'
      when split_part(v_raw_type,'|',1)='ma' or v_item_name in ('hide armor','chain shirt','scale mail','breastplate','half plate','half plate armor') then 'medium'
      when split_part(v_raw_type,'|',1)='la' or v_item_name in ('padded armor','leather armor','studded leather armor') then 'light'
      else null end;

    if v_category='shield' then
      if coalesce(v_candidate_ac,2)>v_shield_bonus then
        v_shield_bonus:=coalesce(v_candidate_ac,2);
        v_shield_item_id:=v_item.id;
        v_shield_name:=coalesce(v_payload->>'item_name',v_payload->>'name',v_item.item_name,'Shield');
      end if;
    elsif lower(coalesce(v_item.equip_slot,''))='body'
      and v_category in ('light','medium','heavy')
      and v_candidate_ac is not null
      and (v_armor_base is null or v_candidate_ac>v_armor_base) then
      v_armor_base:=v_candidate_ac;
      v_armor_category:=v_category;
      v_armor_item_id:=v_item.id;
      v_armor_name:=coalesce(v_payload->>'item_name',v_payload->>'name',v_item.item_name,'Armor');
    end if;
  end loop;

  foreach v_key in array array['str','dex','con','int','wis','cha']
  loop
    v_number := greatest(1,least(30,coalesce((v_base_scores->>v_key)::integer,10)+coalesce((v_score_bonuses->>v_key)::integer,0)));
    v_effective_scores := jsonb_set(v_effective_scores,array[v_key],to_jsonb(v_number),true);
    v_effective_mods := jsonb_set(v_effective_mods,array[v_key],to_jsonb(floor((v_number-10)/2.0)::integer+coalesce((v_mod_bonuses->>v_key)::integer,0)),true);
  end loop;

  v_dex_mod := coalesce((v_effective_mods->>'dex')::integer,0);
  v_base_ac := coalesce(v_sheet_ac,10+v_dex_mod);
  if v_armor_base is not null then
    v_dex_applied := case v_armor_category when 'light' then v_dex_mod when 'medium' then least(v_dex_mod,2) else 0 end;
    v_base_ac := v_armor_base + v_dex_applied;
  end if;
  v_total_ac := v_base_ac + v_shield_bonus + v_bonus_ac;

  return jsonb_build_object(
    'schemaVersion',1,
    'abilities',jsonb_build_object(
      'str',jsonb_build_object('base',(v_base_scores->>'str')::integer,'scoreBonus',(v_score_bonuses->>'str')::integer,'effectiveScore',(v_effective_scores->>'str')::integer,'modBonus',(v_mod_bonuses->>'str')::integer,'effectiveMod',(v_effective_mods->>'str')::integer),
      'dex',jsonb_build_object('base',(v_base_scores->>'dex')::integer,'scoreBonus',(v_score_bonuses->>'dex')::integer,'effectiveScore',(v_effective_scores->>'dex')::integer,'modBonus',(v_mod_bonuses->>'dex')::integer,'effectiveMod',(v_effective_mods->>'dex')::integer),
      'con',jsonb_build_object('base',(v_base_scores->>'con')::integer,'scoreBonus',(v_score_bonuses->>'con')::integer,'effectiveScore',(v_effective_scores->>'con')::integer,'modBonus',(v_mod_bonuses->>'con')::integer,'effectiveMod',(v_effective_mods->>'con')::integer),
      'int',jsonb_build_object('base',(v_base_scores->>'int')::integer,'scoreBonus',(v_score_bonuses->>'int')::integer,'effectiveScore',(v_effective_scores->>'int')::integer,'modBonus',(v_mod_bonuses->>'int')::integer,'effectiveMod',(v_effective_mods->>'int')::integer),
      'wis',jsonb_build_object('base',(v_base_scores->>'wis')::integer,'scoreBonus',(v_score_bonuses->>'wis')::integer,'effectiveScore',(v_effective_scores->>'wis')::integer,'modBonus',(v_mod_bonuses->>'wis')::integer,'effectiveMod',(v_effective_mods->>'wis')::integer),
      'cha',jsonb_build_object('base',(v_base_scores->>'cha')::integer,'scoreBonus',(v_score_bonuses->>'cha')::integer,'effectiveScore',(v_effective_scores->>'cha')::integer,'modBonus',(v_mod_bonuses->>'cha')::integer,'effectiveMod',(v_effective_mods->>'cha')::integer)
    ),
    'ac',jsonb_build_object('total',v_total_ac,'base',v_base_ac,'dexApplied',v_dex_applied,'armorCategory',v_armor_category,'armorBase',v_armor_base,'armorItemId',v_armor_item_id,'armorName',v_armor_name,'shieldBonus',v_shield_bonus,'shieldItemId',v_shield_item_id,'shieldName',v_shield_name,'otherBonus',v_bonus_ac),
    'savesAll',v_saves_all,'saves',v_saves,'skillsAll',v_skills_all,'skills',v_skills,'initiative',v_initiative,'equippedItemIds',v_equipped_ids
  );
end;
$function$;

revoke all on function private.character_equipment_effects_v1(uuid) from public,anon,authenticated;
grant execute on function private.character_equipment_effects_v1(uuid) to service_role;

create or replace function public.character_equipment_effects_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','private','auth'
as $function$
begin
  if p_character_id is null then raise exception 'Character is required'; end if;
  if coalesce(auth.role(),'')<>'service_role'
     and not private.current_user_is_admin()
     and not private.can_access_character_v1(p_character_id,'read') then
    raise exception 'Not authorized to view character equipment effects' using errcode='42501';
  end if;
  return private.character_equipment_effects_v1(p_character_id);
end;
$function$;

revoke all on function public.character_equipment_effects_v1(uuid) from public,anon;
grant execute on function public.character_equipment_effects_v1(uuid) to authenticated,service_role;

-- Backwards-compatible adapter. All AC logic now comes from the shared resolver.
create or replace function private.encounter_equipped_armor_class_v1(p_character_id uuid,p_dex integer,p_fallback_ac integer)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','private','auth'
as $function$
declare v_effects jsonb; v_ac jsonb;
begin
  if p_character_id is null then
    return jsonb_build_object('ac',coalesce(p_fallback_ac,10+floor((coalesce(p_dex,10)-10)/2.0)::integer),'baseAc',coalesce(p_fallback_ac,10+floor((coalesce(p_dex,10)-10)/2.0)::integer),'armorCategory',null,'armorItemId',null,'shieldBonus',0,'shieldItemId',null);
  end if;
  v_effects:=private.character_equipment_effects_v1(p_character_id);
  v_ac:=coalesce(v_effects->'ac','{}'::jsonb);
  return jsonb_build_object('ac',coalesce((v_ac->>'total')::integer,p_fallback_ac),'baseAc',coalesce((v_ac->>'base')::integer,p_fallback_ac),'armorCategory',v_ac->>'armorCategory','armorItemId',v_ac->>'armorItemId','shieldBonus',coalesce((v_ac->>'shieldBonus')::integer,0),'shieldItemId',v_ac->>'shieldItemId');
end;
$function$;

revoke all on function private.encounter_equipped_armor_class_v1(uuid,integer,integer) from public,anon,authenticated;
grant execute on function private.encounter_equipped_armor_class_v1(uuid,integer,integer) to service_role;

create or replace function public.encounter_canonical_combat_snapshot_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','private','auth'
as $function$
declare v_sheet jsonb:='{}'::jsonb; v_effects jsonb:='{}'::jsonb; v_prof integer:=2; v_hp integer:=1;
begin
  if p_character_id is null then return jsonb_build_object('str',10,'dex',10,'prof',2,'ac',10,'hp',1); end if;
  select coalesce(cs.sheet,'{}'::jsonb) into v_sheet from public.character_sheets cs where cs.character_id=p_character_id;
  begin v_prof:=coalesce(nullif(v_sheet->>'proficiencyBonus','')::integer,2); exception when others then v_prof:=2; end;
  begin v_hp:=coalesce(nullif(v_sheet->>'hp','')::integer,nullif(v_sheet->>'maxHp','')::integer,1); exception when others then v_hp:=1; end;
  v_effects:=private.character_equipment_effects_v1(p_character_id);
  return jsonb_build_object(
    'str',coalesce((v_effects#>>'{abilities,str,effectiveScore}')::integer,10),
    'dex',coalesce((v_effects#>>'{abilities,dex,effectiveScore}')::integer,10),
    'prof',v_prof,
    'ac',coalesce((v_effects#>>'{ac,total}')::integer,10),
    'hp',v_hp
  );
end;
$function$;
