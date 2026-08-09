-- Keep Player Forge starting equipment/currency projection character scoped.
-- Migration 49 introduced the materializer with a legacy players.sheet mirror.
-- Multi-character accounts must not use that account-wide projection for starter gear.

create or replace function private.materialize_player_forge_starting_equipment_v1(p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_progression public.character_progression%rowtype;
  v_class public.class_catalog%rowtype;
  v_sheet jsonb:='{}'::jsonb;
  v_selection jsonb:='{}'::jsonb;
  v_background public.character_option_catalog%rowtype;
  v_class_options jsonb:='[]'::jsonb;
  v_background_options jsonb:='[]'::jsonb;
  v_class_parts jsonb;
  v_background_parts jsonb;
  v_scope text;
  v_parts jsonb;
  v_option_key text;
  v_part jsonb;
  v_index integer;
  v_choices jsonb:='{}'::jsonb;
  v_categories jsonb;
  v_item_key text;
  v_special text;
  v_item public.items_catalog%rowtype;
  v_quantity integer;
  v_package_copper bigint:=0;
  v_higher jsonb;
  v_higher_copper bigint:=0;
  v_roll integer;
  v_user uuid;
  v_rows integer:=0;
  v_summary jsonb:='[]'::jsonb;
begin
  select * into v_progression from public.character_progression where character_id=p_character_id for update;
  if not found then return jsonb_build_object('applied',false,'reason','progression unavailable'); end if;
  select coalesce(sheet,'{}'::jsonb) into v_sheet from public.character_sheets where character_id=p_character_id for update;
  if coalesce(v_sheet#>>'{meta,creator}','')<>'shared_character_forge_player_v2' then return jsonb_build_object('applied',false,'reason','not Player Forge'); end if;
  if jsonb_typeof(v_sheet->'startingEquipmentSelections')<>'object' then return jsonb_build_object('applied',false,'reason','no starting equipment selection'); end if;
  if exists(select 1 from public.character_currency where character_id=p_character_id) then return jsonb_build_object('applied',false,'reason','already materialized'); end if;

  v_selection:=v_sheet->'startingEquipmentSelections';
  v_choices:=case when jsonb_typeof(v_selection->'choices')='object' then v_selection->'choices' else '{}'::jsonb end;
  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found then raise exception 'Starting equipment could not resolve the selected class.'; end if;
  v_class_options:=coalesce(v_class.raw_payload#>'{startingEquipment,defaultData}','[]'::jsonb);
  v_option_key:=upper(coalesce(v_selection->>'classOption',''));
  v_class_parts:=private.player_forge_equipment_option_parts_v1(v_class_options,v_option_key);
  if jsonb_array_length(v_class_options)>0 and v_class_parts is null then raise exception 'Choose a valid source-backed class starting equipment package.'; end if;

  if nullif(v_selection->>'backgroundId','') is not null then
    begin
      select * into v_background from public.character_option_catalog where id=(v_selection->>'backgroundId')::uuid and option_type='background';
    exception when invalid_text_representation then
      raise exception 'Starting equipment references an invalid Background id.';
    end;
  end if;
  if v_background.id is not null then
    v_background_options:=coalesce(v_background.metadata->'equipment','[]'::jsonb);
    v_background_parts:=private.player_forge_equipment_option_parts_v1(v_background_options,upper(coalesce(v_selection->>'backgroundOption','')));
    if jsonb_array_length(v_background_options)>0 and v_background_parts is null then raise exception 'Choose a valid source-backed Background starting equipment package.'; end if;
  end if;

  v_user:=coalesce(v_progression.created_by,(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id and cp.can_edit order by cp.created_at nulls last limit 1));
  if v_user is null then raise exception 'Starting equipment could not resolve the owning user.'; end if;

  for v_scope,v_parts,v_option_key in
    select 'class'::text,v_class_parts,upper(coalesce(v_selection->>'classOption',''))
    union all
    select 'background'::text,v_background_parts,upper(coalesce(v_selection->>'backgroundOption',''))
  loop
    if jsonb_typeof(v_parts)<>'array' then continue; end if;
    v_index:=0;
    for v_part in select value from jsonb_array_elements(v_parts) loop
      if v_part ? 'value' then
        v_package_copper:=v_package_copper+greatest(0,coalesce((v_part->>'value')::bigint,0));
        v_index:=v_index+1;
        continue;
      end if;
      v_quantity:=greatest(1,coalesce((v_part->>'quantity')::integer,1));
      v_item_key:=null;
      if nullif(v_part->>'item','') is not null then
        v_item_key:=v_part->>'item';
      elsif nullif(v_part->>'special','') is not null then
        v_special:=v_part->>'special';
        if lower(v_special)='spellbook' then
          select * into v_item from public.items_catalog where lower(item_name)='spellbook' order by case when payload->>'source'='XPHB' then 0 when payload->>'source'='PHB' then 1 else 2 end limit 1;
          if not found then raise exception 'Starting equipment could not resolve the Spellbook item.'; end if;
          v_item_key:=v_item.item_key;
        else
          raise exception 'Unsupported source-backed special starting item: %.',v_special;
        end if;
      else
        v_categories:=case
          when nullif(v_part->>'equipmentType','') is not null then jsonb_build_array(v_part->>'equipmentType')
          when jsonb_typeof(v_part->'equipmentTypes')='array' then v_part->'equipmentTypes'
          else '[]'::jsonb
        end;
        if jsonb_array_length(v_categories)>0 then
          v_item_key:=v_choices->>(v_scope||':'||v_option_key||':'||v_index);
          if nullif(v_item_key,'') is null then raise exception 'Complete every starting equipment item-category choice.'; end if;
          if not exists(select 1 from jsonb_array_elements_text(v_categories) c(value) where private.player_forge_equipment_choice_allowed_v1(c.value,v_item_key)) then
            raise exception 'Selected item % is not legal for this starting equipment category.',v_item_key;
          end if;
        end if;
      end if;

      if nullif(v_item_key,'') is not null then
        select * into v_item from public.items_catalog where lower(item_key)=lower(v_item_key) order by case when payload->>'source'='XPHB' then 0 when payload->>'source'='PHB' then 1 else 2 end limit 1;
        if not found then raise exception 'Starting equipment item % is unavailable in the canonical item catalogue.',v_item_key; end if;
        insert into public.inventory_items(
          user_id,item_id,item_name,item_type,item_rarity,item_description,item_weight,item_cost,card_payload,owner_type,owner_id,is_equipped,quantity,equip_slot,updated_at
        ) values(
          v_user,v_item.item_key,v_item.item_name,v_item.item_type,initcap(coalesce(v_item.item_rarity,'mundane')),v_item.description,
          case when v_item.weight_lb is null then null else v_item.weight_lb::text end,
          private.format_copper_currency_v1(coalesce((v_item.payload->>'value')::bigint,0)),
          coalesce(v_item.payload,'{}'::jsonb)||jsonb_build_object('item_key',v_item.item_key,'item_name',v_item.item_name,'startingEquipment',true,'startingEquipmentScope',v_scope,'startingEquipmentOption',v_option_key),
          'character',p_character_id::text,false,v_quantity,null,now()
        );
        v_rows:=v_rows+1;
        v_summary:=v_summary||jsonb_build_array(jsonb_build_object('scope',v_scope,'option',v_option_key,'itemKey',v_item.item_key,'name',v_item.item_name,'quantity',v_quantity));
      end if;
      v_index:=v_index+1;
    end loop;
  end loop;

  if nullif(v_selection->>'wealthRoll','') is not null then
    begin v_roll:=(v_selection->>'wealthRoll')::integer;
    exception when others then raise exception 'Higher-level wealth roll must be a d10 result from 1 to 10.'; end;
  end if;
  v_higher:=private.player_forge_higher_level_wealth_v1(v_progression.class_level,v_roll);
  v_higher_copper:=coalesce((v_higher->>'copper')::bigint,0);

  insert into public.character_currency(character_id,copper_value,source_breakdown,updated_at,updated_by)
  values(p_character_id,v_package_copper+v_higher_copper,jsonb_build_object(
    'classPackageCopper',coalesce((select sum(coalesce((x->>'value')::bigint,0)) from jsonb_array_elements(coalesce(v_class_parts,'[]'::jsonb)) x where x ? 'value'),0),
    'backgroundPackageCopper',coalesce((select sum(coalesce((x->>'value')::bigint,0)) from jsonb_array_elements(coalesce(v_background_parts,'[]'::jsonb)) x where x ? 'value'),0),
    'higherLevelCopper',v_higher_copper,
    'higherLevelRoll',v_roll,
    'magicItemGuide',v_higher->'magicItems'
  ),now(),v_user);

  v_sheet:=jsonb_set(v_sheet,'{startingEquipmentSummary}',v_summary,true);
  v_sheet:=jsonb_set(v_sheet,'{startingCurrencyCopper}',to_jsonb(v_package_copper+v_higher_copper),true);
  v_sheet:=jsonb_set(v_sheet,'{higherLevelMagicItemGuide}',coalesce(v_higher->'magicItems','{}'::jsonb),true);
  v_sheet:=jsonb_set(v_sheet,'{meta,startingCurrencyCopper}',to_jsonb(v_package_copper+v_higher_copper),true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;

  return jsonb_build_object('applied',true,'inventoryRows',v_rows,'currencyCopper',v_package_copper+v_higher_copper,'items',v_summary,'magicItemGuide',v_higher->'magicItems');
end;
$$;

revoke all on function private.materialize_player_forge_starting_equipment_v1(uuid) from public,anon,authenticated;
grant execute on function private.materialize_player_forge_starting_equipment_v1(uuid) to service_role;
