-- Derive canonical tactical Armor Class from equipped inventory without
-- mutating existing encounter snapshots. New participant staging consumes the
-- updated canonical snapshot through admin_add_encounter_participant_v1.

create or replace function private.encounter_equipped_armor_class_v1(
  p_character_id uuid,
  p_dex integer,
  p_fallback_ac integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private', 'auth'
as $function$
declare
  v_item record;
  v_payload jsonb;
  v_raw_type text;
  v_item_type text;
  v_item_name text;
  v_category text;
  v_candidate_ac integer;
  v_dex_mod integer := floor((coalesce(p_dex, 10) - 10) / 2.0)::integer;
  v_base_ac integer := coalesce(p_fallback_ac, 10 + floor((coalesce(p_dex, 10) - 10) / 2.0)::integer);
  v_armor_base integer;
  v_armor_category text;
  v_armor_item_id uuid;
  v_shield_bonus integer := 0;
  v_shield_item_id uuid;
  v_final_ac integer;
begin
  if p_character_id is null then
    return jsonb_build_object(
      'ac', v_base_ac,
      'baseAc', v_base_ac,
      'armorCategory', null,
      'armorItemId', null,
      'shieldBonus', 0,
      'shieldItemId', null
    );
  end if;

  for v_item in
    select i.*
    from public.inventory_items i
    where i.is_equipped
      and (
        (
          i.owner_id = p_character_id::text
          and lower(coalesce(i.owner_type, '')) in ('npc', 'merchant', 'character')
        )
        or (
          lower(coalesce(i.owner_type, '')) = 'player'
          and exists (
            select 1
            from public.character_permissions cp
            where cp.character_id = p_character_id
              and coalesce(cp.can_edit, false)
              and i.owner_id = cp.user_id::text
          )
        )
      )
    order by i.updated_at desc nulls last, i.id
  loop
    v_payload := coalesce(v_item.card_payload, '{}'::jsonb);
    v_raw_type := lower(coalesce(v_payload->>'type', ''));
    v_item_type := lower(coalesce(v_payload->>'item_type', v_item.item_type, ''));
    v_item_name := lower(coalesce(v_payload->>'name', v_item.item_name, ''));

    if coalesce(v_payload->>'ac', '') ~ '^-?[0-9]+$' then
      v_candidate_ac := (v_payload->>'ac')::integer;
    elsif coalesce(v_payload->'armor'->>'ac', '') ~ '^-?[0-9]+$' then
      v_candidate_ac := (v_payload->'armor'->>'ac')::integer;
    else
      v_candidate_ac := public.craft_payload_inferred_ac(v_item.item_name);
    end if;

    v_category := case
      when v_raw_type like 's|%'
        or v_item_type = 'shield'
        or v_item_name = 'shield'
        then 'shield'
      when v_raw_type like 'ha|%'
        or v_item_name in ('ring mail', 'chain mail', 'splint', 'splint armor', 'plate', 'plate armor')
        then 'heavy'
      when v_raw_type like 'ma|%'
        or v_item_name in ('hide armor', 'chain shirt', 'scale mail', 'breastplate', 'half plate', 'half plate armor')
        then 'medium'
      when v_raw_type like 'la|%'
        or v_item_name in ('padded armor', 'leather armor', 'studded leather armor')
        then 'light'
      else null
    end;

    if v_category = 'shield' then
      if coalesce(v_candidate_ac, 2) > v_shield_bonus then
        v_shield_bonus := coalesce(v_candidate_ac, 2);
        v_shield_item_id := v_item.id;
      end if;
    elsif v_armor_base is null
      and lower(coalesce(v_item.equip_slot, '')) = 'body'
      and v_category in ('light', 'medium', 'heavy')
      and v_candidate_ac is not null then
      v_armor_base := v_candidate_ac;
      v_armor_category := v_category;
      v_armor_item_id := v_item.id;
    end if;
  end loop;

  if v_armor_base is not null then
    v_base_ac := case v_armor_category
      when 'heavy' then v_armor_base
      when 'medium' then v_armor_base + least(v_dex_mod, 2)
      when 'light' then v_armor_base + v_dex_mod
      else v_base_ac
    end;
  end if;

  v_final_ac := v_base_ac + v_shield_bonus;

  return jsonb_build_object(
    'ac', v_final_ac,
    'baseAc', v_base_ac,
    'armorCategory', v_armor_category,
    'armorItemId', v_armor_item_id,
    'shieldBonus', v_shield_bonus,
    'shieldItemId', v_shield_item_id
  );
end;
$function$;

revoke all on function private.encounter_equipped_armor_class_v1(uuid, integer, integer)
from public, anon, authenticated;
grant execute on function private.encounter_equipped_armor_class_v1(uuid, integer, integer)
to service_role;

create or replace function public.encounter_canonical_combat_snapshot_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'private', 'auth'
as $function$
declare
  v_sheet jsonb;
  v_str integer := 10;
  v_dex integer := 10;
  v_prof integer := 2;
  v_ac integer;
  v_hp integer;
  v_ac_details jsonb;
begin
  if p_character_id is null then
    return jsonb_build_object('str', 10, 'dex', 10, 'prof', 2, 'ac', 10, 'hp', 1);
  end if;

  select cs.sheet
  into v_sheet
  from public.character_sheets cs
  where cs.character_id = p_character_id;

  if v_sheet is null then
    return jsonb_build_object('str', 10, 'dex', 10, 'prof', 2, 'ac', 10, 'hp', 1);
  end if;

  begin
    v_str := coalesce(nullif(v_sheet#>>'{abilities,str,score}', '')::integer, 10);
  exception when others then
    v_str := 10;
  end;

  begin
    v_dex := coalesce(nullif(v_sheet#>>'{abilities,dex,score}', '')::integer, 10);
  exception when others then
    v_dex := 10;
  end;

  begin
    v_prof := coalesce(nullif(v_sheet->>'proficiencyBonus', '')::integer, 2);
  exception when others then
    v_prof := 2;
  end;

  begin
    v_ac := nullif(v_sheet->>'ac', '')::integer;
  exception when others then
    v_ac := null;
  end;

  begin
    v_hp := coalesce(
      nullif(v_sheet->>'hp', '')::integer,
      nullif(v_sheet->>'maxHp', '')::integer,
      1
    );
  exception when others then
    v_hp := 1;
  end;

  v_ac := coalesce(v_ac, 10 + floor((v_dex - 10) / 2.0)::integer);
  v_ac_details := private.encounter_equipped_armor_class_v1(p_character_id, v_dex, v_ac);
  v_ac := coalesce(nullif(v_ac_details->>'ac', '')::integer, v_ac);

  return jsonb_build_object(
    'str', v_str,
    'dex', v_dex,
    'prof', v_prof,
    'ac', v_ac,
    'hp', v_hp
  );
end;
$function$;
