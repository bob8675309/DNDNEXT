-- Complete the shared equipment-effects integration for tactical weapon math.
-- Migration 03 establishes the resolver. This migration uses direct audited
-- function definitions so the complete tactical contract remains visible in
-- migration history and no dynamic source rewriting is required.

-- Harden the public read wrapper so a NULL permission result never grants access.
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
     and not coalesce(private.current_user_is_admin(),false)
     and not coalesce(private.can_access_character_v1(p_character_id,'read'),false) then
    raise exception 'Not authorized to view character equipment effects' using errcode='42501';
  end if;
  return private.character_equipment_effects_v1(p_character_id);
end;
$function$;

revoke all on function public.character_equipment_effects_v1(uuid) from public,anon;
grant execute on function public.character_equipment_effects_v1(uuid) to authenticated,service_role;

-- Preserve existing snapshot keys and add effective modifiers for consumers
-- that must not reconstruct them from adjusted scores.
create or replace function public.encounter_canonical_combat_snapshot_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','private','auth'
as $function$
declare
  v_sheet jsonb:='{}'::jsonb;
  v_effects jsonb:='{}'::jsonb;
  v_prof integer:=2;
  v_hp integer:=1;
begin
  if p_character_id is null then
    return jsonb_build_object('str',10,'dex',10,'strMod',0,'dexMod',0,'prof',2,'ac',10,'hp',1);
  end if;
  select coalesce(cs.sheet,'{}'::jsonb)
  into v_sheet
  from public.character_sheets cs
  where cs.character_id=p_character_id;
  begin v_prof:=coalesce(nullif(v_sheet->>'proficiencyBonus','')::integer,2); exception when others then v_prof:=2; end;
  begin v_hp:=coalesce(nullif(v_sheet->>'hp','')::integer,nullif(v_sheet->>'maxHp','')::integer,1); exception when others then v_hp:=1; end;
  v_effects:=private.character_equipment_effects_v1(p_character_id);
  return jsonb_build_object(
    'str',coalesce((v_effects#>>'{abilities,str,effectiveScore}')::integer,10),
    'dex',coalesce((v_effects#>>'{abilities,dex,effectiveScore}')::integer,10),
    'strMod',coalesce((v_effects#>>'{abilities,str,effectiveMod}')::integer,0),
    'dexMod',coalesce((v_effects#>>'{abilities,dex,effectiveMod}')::integer,0),
    'prof',v_prof,
    'ac',coalesce((v_effects#>>'{ac,total}')::integer,10),
    'hp',v_hp
  );
end;
$function$;

create or replace function public.encounter_weapon_profile_internal_v1(
  p_participant_id uuid,
  p_inventory_item_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','public','private','auth'
as $function$
declare
  v_p public.encounter_participants%rowtype;
  v_inv public.inventory_items%rowtype;
  v_catalog jsonb := '{}'::jsonb;
  v_payload jsonb := '{}'::jsonb;
  v_sheet jsonb := '{}'::jsonb;
  v_snapshot jsonb := '{}'::jsonb;
  v_starting jsonb := '{}'::jsonb;
  v_weapon_profs jsonb := '[]'::jsonb;
  v_name text;
  v_item_type text;
  v_item_key text;
  v_damage_dice text;
  v_damage_type text;
  v_range text;
  v_category text;
  v_class_key text;
  v_bonus_raw text;
  v_magic_bonus integer := 0;
  v_str integer := 10;
  v_dex integer := 10;
  v_str_mod integer := 0;
  v_dex_mod integer := 0;
  v_prof_bonus integer := 2;
  v_ability text := 'str';
  v_ability_mod integer := 0;
  v_attack_bonus integer := 0;
  v_reach integer := 5;
  v_normal_range integer := 5;
  v_long_range integer := 5;
  v_is_ranged boolean := false;
  v_is_thrown boolean := false;
  v_is_finesse boolean := false;
  v_proficient boolean := false;
  v_owner_ok boolean := false;
  v_is_weapon boolean := false;
begin
  select * into v_p from public.encounter_participants where id=p_participant_id;
  if not found then return null; end if;

  select * into v_inv from public.inventory_items where id=p_inventory_item_id and is_equipped;
  if not found then return null; end if;

  v_owner_ok := (
    v_inv.owner_id = v_p.character_id::text
    and lower(coalesce(v_inv.owner_type,'')) in ('npc','merchant','character')
  ) or exists (
    select 1
    from public.character_permissions cp
    where cp.character_id=v_p.character_id
      and coalesce(cp.can_edit,false)
      and lower(coalesce(v_inv.owner_type,''))='player'
      and v_inv.owner_id=cp.user_id::text
  );
  if not v_owner_ok then return null; end if;

  select ic.payload into v_catalog
  from public.items_catalog ic
  where ic.item_key = coalesce(v_inv.card_payload->>'item_key', v_inv.card_payload->>'item_id', v_inv.item_id)
     or ic.item_key = v_inv.item_id
     or lower(ic.item_name)=lower(v_inv.item_name)
  order by
    case
      when ic.item_key = coalesce(v_inv.card_payload->>'item_key', v_inv.card_payload->>'item_id', v_inv.item_id) then 0
      when ic.item_key = v_inv.item_id then 1
      else 2
    end,
    case when coalesce(ic.payload->>'edition','')='one' then 0 else 1 end
  limit 1;

  v_payload := coalesce(v_catalog,'{}'::jsonb) || coalesce(v_inv.card_payload,'{}'::jsonb);
  v_name := coalesce(nullif(v_payload->>'item_name',''),nullif(v_payload->>'name',''),v_inv.item_name,'Weapon');
  v_item_type := coalesce(nullif(v_payload->>'item_type',''),nullif(v_payload->>'uiType',''),v_inv.item_type,'');
  v_item_key := coalesce(nullif(v_payload->>'item_key',''),nullif(v_payload->>'item_id',''),v_inv.item_id,v_inv.id::text);
  v_damage_dice := coalesce(v_payload->>'dmg1','');
  v_damage_type := upper(coalesce(v_payload->>'dmgType',''));
  v_range := coalesce(v_payload->>'range','');
  v_category := lower(coalesce(v_payload->>'weaponCategory',''));

  v_is_weapon := coalesce(v_payload->>'weapon','false')='true'
    or lower(v_item_type) like '%weapon%'
    or split_part(coalesce(v_payload->>'type',''),'|',1) in ('M','R');
  if not v_is_weapon or v_damage_dice !~ '^[1-9][0-9]*d[1-9][0-9]*$' then return null; end if;

  v_is_ranged := lower(v_item_type) like '%ranged weapon%'
    or split_part(coalesce(v_payload->>'type',''),'|',1)='R';
  v_is_thrown := exists (
    select 1 from jsonb_array_elements_text(
      case when jsonb_typeof(v_payload->'property')='array' then v_payload->'property' else '[]'::jsonb end
    ) p(value) where split_part(value,'|',1)='T'
  );
  v_is_finesse := exists (
    select 1 from jsonb_array_elements_text(
      case when jsonb_typeof(v_payload->'property')='array' then v_payload->'property' else '[]'::jsonb end
    ) p(value) where split_part(value,'|',1)='F'
  );
  if exists (
    select 1 from jsonb_array_elements_text(
      case when jsonb_typeof(v_payload->'property')='array' then v_payload->'property' else '[]'::jsonb end
    ) p(value) where split_part(value,'|',1)='R'
  ) then v_reach := 10; end if;

  if v_range ~ '^[0-9]+/[0-9]+$' then
    v_normal_range := split_part(v_range,'/',1)::integer;
    v_long_range := split_part(v_range,'/',2)::integer;
  elsif v_is_ranged then
    v_normal_range := 5;
    v_long_range := 5;
  else
    v_normal_range := v_reach;
    v_long_range := v_reach;
  end if;

  if not v_is_ranged and not v_is_thrown then
    v_normal_range := v_reach;
    v_long_range := v_reach;
  end if;

  v_bonus_raw := coalesce(v_payload->>'bonusWeapon',v_payload->>'bonus_weapon',v_payload->>'enhancement_bonus',v_payload->>'smith_tier','0');
  if v_bonus_raw ~ '[-+]?[0-9]+' then
    begin v_magic_bonus := replace(substring(v_bonus_raw from '[-+]?[0-9]+'),'+','')::integer; exception when others then v_magic_bonus := 0; end;
  end if;

  select cs.sheet into v_sheet from public.character_sheets cs where cs.character_id=v_p.character_id;
  v_snapshot := public.encounter_canonical_combat_snapshot_v1(v_p.character_id);
  v_str := coalesce((v_snapshot->>'str')::integer,10);
  v_dex := coalesce((v_snapshot->>'dex')::integer,10);
  v_str_mod := coalesce((v_snapshot->>'strMod')::integer,floor((v_str-10)/2.0)::integer);
  v_dex_mod := coalesce((v_snapshot->>'dexMod')::integer,floor((v_dex-10)/2.0)::integer);
  v_prof_bonus := coalesce((v_snapshot->>'prof')::integer,2);
  v_class_key := lower(coalesce(v_sheet#>>'{meta,classKey}',v_sheet->>'classKey',''));

  select c.raw_payload->'starting_proficiencies' into v_starting
  from public.class_catalog_preferred c
  where lower(c.class_key)=v_class_key
  limit 1;
  v_weapon_profs := case
    when jsonb_typeof(v_starting->'weapons')='array' then v_starting->'weapons'
    else '[]'::jsonb
  end;

  v_proficient := exists (
    select 1 from jsonb_array_elements_text(v_weapon_profs) w(value)
    where lower(value)=v_category
       or lower(value)=lower(v_name)
       or lower(value) like '%'||lower(v_name)||'%'
  );

  if v_is_ranged then
    v_ability := 'dex';
    v_ability_mod := v_dex_mod;
  elsif v_is_finesse and v_dex_mod > v_str_mod then
    v_ability := 'dex';
    v_ability_mod := v_dex_mod;
  else
    v_ability := 'str';
    v_ability_mod := v_str_mod;
  end if;
  v_attack_bonus := v_ability_mod + case when v_proficient then v_prof_bonus else 0 end + v_magic_bonus;

  v_damage_type := case v_damage_type
    when 'B' then 'bludgeoning'
    when 'P' then 'piercing'
    when 'S' then 'slashing'
    else lower(coalesce(nullif(v_damage_type,''),'untyped'))
  end;

  return jsonb_build_object(
    'inventoryItemId',v_inv.id,
    'itemKey',v_item_key,
    'name',v_name,
    'damageDice',v_damage_dice,
    'damageType',v_damage_type,
    'ability',v_ability,
    'abilityMod',v_ability_mod,
    'proficient',v_proficient,
    'proficiencyBonus',case when v_proficient then v_prof_bonus else 0 end,
    'magicBonus',v_magic_bonus,
    'attackBonus',v_attack_bonus,
    'reachFt',v_reach,
    'normalRangeFt',v_normal_range,
    'longRangeFt',v_long_range,
    'isRanged',v_is_ranged,
    'isThrown',v_is_thrown,
    'isFinesse',v_is_finesse,
    'equipSlot',v_inv.equip_slot
  );
end;
$function$;
