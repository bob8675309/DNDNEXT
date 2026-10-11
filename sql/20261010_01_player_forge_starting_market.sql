-- DNDNext Player Forge starting market
--
-- Replaces the player-facing Package A/B picker with the source-backed cash
-- alternative already present in each class/background starting-equipment source.
-- The Forge stages purchases against existing character_stock rows. Character
-- creation revalidates and locks those stock rows, moves purchased items into
-- character-scoped inventory, decrements merchant stock, and stores unspent
-- source-backed coin in public.character_currency.
--
-- Existing package-mode payloads remain supported for older drafts/characters.
-- This migration does not use or mutate the account-wide player wallet.

create or replace function private.player_forge_cash_equipment_option_v1(p_options jsonb)
returns jsonb
language plpgsql
immutable
set search_path=pg_catalog,public,private
as $$
declare
  v_group jsonb;
  v_key text;
  v_parts jsonb;
  v_copper bigint;
begin
  if jsonb_typeof(coalesce(p_options,'[]'::jsonb)) <> 'array' then return null; end if;

  for v_group in select value from jsonb_array_elements(coalesce(p_options,'[]'::jsonb)) loop
    if jsonb_typeof(v_group) <> 'object' then continue; end if;
    for v_key,v_parts in select key,value from jsonb_each(v_group) loop
      if jsonb_typeof(v_parts) <> 'array' or jsonb_array_length(v_parts)=0 then continue; end if;
      if exists(
        select 1
        from jsonb_array_elements(v_parts) p(value)
        where not (p.value ? 'value')
      ) then
        continue;
      end if;

      select coalesce(sum(greatest(0,coalesce(nullif(p.value->>'value','')::bigint,0))),0)
      into v_copper
      from jsonb_array_elements(v_parts) p(value);

      return jsonb_build_object(
        'key',upper(coalesce(v_key,'')),
        'parts',v_parts,
        'copper',coalesce(v_copper,0)
      );
    end loop;
  end loop;

  return null;
end;
$$;

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

  v_mode text;
  v_class_cash jsonb;
  v_background_cash jsonb;
  v_market_purchases jsonb:='[]'::jsonb;
  v_purchase jsonb;
  v_merchant_id uuid;
  v_stock_id uuid;
  v_stock public.character_stock%rowtype;
  v_price_copper bigint;
  v_market_spent bigint:=0;
  v_market_budget bigint:=0;
  v_remaining_copper bigint:=0;
begin
  select * into v_progression
  from public.character_progression
  where character_id=p_character_id
  for update;
  if not found then return jsonb_build_object('applied',false,'reason','progression unavailable'); end if;

  select coalesce(sheet,'{}'::jsonb) into v_sheet
  from public.character_sheets
  where character_id=p_character_id
  for update;
  if coalesce(v_sheet#>>'{meta,creator}','')<>'shared_character_forge_player_v2' then
    return jsonb_build_object('applied',false,'reason','not Player Forge');
  end if;
  if jsonb_typeof(v_sheet->'startingEquipmentSelections')<>'object' then
    return jsonb_build_object('applied',false,'reason','no starting equipment selection');
  end if;
  if exists(select 1 from public.character_currency where character_id=p_character_id) then
    return jsonb_build_object('applied',false,'reason','already materialized');
  end if;

  v_selection:=v_sheet->'startingEquipmentSelections';
  v_mode:=lower(coalesce(nullif(v_selection->>'mode',''),'package'));
  v_choices:=case when jsonb_typeof(v_selection->'choices')='object' then v_selection->'choices' else '{}'::jsonb end;

  select * into v_class from public.class_catalog where id=v_progression.class_id;
  if not found then raise exception 'Starting equipment could not resolve the selected class.'; end if;
  v_class_options:=coalesce(v_class.raw_payload#>'{startingEquipment,defaultData}','[]'::jsonb);

  if nullif(v_selection->>'backgroundId','') is not null then
    begin
      select * into v_background
      from public.character_option_catalog
      where id=(v_selection->>'backgroundId')::uuid
        and option_type='background';
    exception when invalid_text_representation then
      raise exception 'Starting equipment references an invalid Background id.';
    end;
  end if;
  if v_background.id is not null then
    v_background_options:=coalesce(v_background.metadata->'equipment','[]'::jsonb);
  end if;

  v_user:=coalesce(
    v_progression.created_by,
    (select cp.user_id
     from public.character_permissions cp
     where cp.character_id=p_character_id and cp.can_edit
     order by cp.created_at nulls last
     limit 1)
  );
  if v_user is null then raise exception 'Starting equipment could not resolve the owning user.'; end if;

  if nullif(v_selection->>'wealthRoll','') is not null then
    begin
      v_roll:=(v_selection->>'wealthRoll')::integer;
    exception when others then
      raise exception 'Higher-level wealth roll must be a d10 result from 1 to 10.';
    end;
  end if;
  v_higher:=private.player_forge_higher_level_wealth_v1(v_progression.class_level,v_roll);
  v_higher_copper:=coalesce((v_higher->>'copper')::bigint,0);

  if v_mode='market' then
    v_class_cash:=private.player_forge_cash_equipment_option_v1(v_class_options);
    v_background_cash:=private.player_forge_cash_equipment_option_v1(v_background_options);

    if jsonb_array_length(v_class_options)>0 and v_class_cash is null then
      raise exception 'The selected class has no source-backed cash starting-equipment alternative.';
    end if;
    if jsonb_array_length(v_background_options)>0 and v_background_cash is null then
      raise exception 'The selected Background has no source-backed cash starting-equipment alternative.';
    end if;

    v_package_copper:=coalesce((v_class_cash->>'copper')::bigint,0)
      + coalesce((v_background_cash->>'copper')::bigint,0);
    v_market_budget:=v_package_copper+v_higher_copper;
    v_market_purchases:=coalesce(v_selection->'marketPurchases','[]'::jsonb);
    if jsonb_typeof(v_market_purchases)<>'array' then
      raise exception 'Starting market purchases must be a JSON array.';
    end if;

    for v_purchase in select value from jsonb_array_elements(v_market_purchases) loop
      if jsonb_typeof(v_purchase)<>'object' then
        raise exception 'Each starting market purchase must be a JSON object.';
      end if;

      begin
        v_merchant_id:=nullif(v_purchase->>'merchantId','')::uuid;
        v_stock_id:=nullif(v_purchase->>'stockId','')::uuid;
      exception when invalid_text_representation then
        raise exception 'Starting market purchase contains an invalid merchant or stock id.';
      end;
      if v_merchant_id is null or v_stock_id is null then
        raise exception 'Starting market purchase must identify both merchant and stock row.';
      end if;

      begin
        v_quantity:=coalesce(nullif(v_purchase->>'qty','')::integer,1);
      exception when others then
        raise exception 'Starting market purchase quantity must be a whole number.';
      end;
      if v_quantity<1 then raise exception 'Starting market purchase quantity must be at least 1.'; end if;

      select cs.* into v_stock
      from public.character_stock cs
      join public.characters merchant on merchant.id=cs.character_id
      where cs.id=v_stock_id
        and cs.character_id=v_merchant_id
        and merchant.storefront_enabled is true
      for update of cs;

      if not found then
        raise exception 'A staged starting-market item is no longer sold by that merchant.';
      end if;
      if coalesce(v_stock.qty,0)<v_quantity then
        raise exception 'Not enough stock remains for starting-market item %.',coalesce(v_stock.display_name,'item');
      end if;
      if lower(coalesce(v_stock.card_payload->>'item_type',v_stock.card_payload->>'type',''))='recipe'
         or coalesce(v_stock.card_payload,'{}'::jsonb) ? 'recipe_unlock'
         or coalesce(v_stock.card_payload,'{}'::jsonb) ? 'recipeUnlock' then
        raise exception 'Recipes are not starting-equipment purchases.';
      end if;

      v_price_copper:=round(greatest(0,coalesce(v_stock.price_gp,0))*100)::bigint;
      v_market_spent:=v_market_spent+(v_price_copper*v_quantity);
      if v_market_spent>v_market_budget then
        raise exception 'Starting-market purchases exceed the source-backed starting purse.';
      end if;

      insert into public.inventory_items(
        user_id,item_id,item_name,item_type,item_rarity,item_description,item_weight,item_cost,
        card_payload,owner_type,owner_id,is_equipped,quantity,equip_slot,updated_at
      ) values(
        v_user,
        coalesce(nullif(v_stock.item_id,''),v_stock.id::text),
        coalesce(nullif(v_stock.display_name,''),v_stock.card_payload->>'item_name',v_stock.card_payload->>'name','Item'),
        coalesce(v_stock.card_payload->>'item_type',v_stock.card_payload->>'type'),
        initcap(coalesce(v_stock.card_payload->>'item_rarity',v_stock.card_payload->>'rarity','mundane')),
        coalesce(v_stock.card_payload->>'item_description',v_stock.card_payload->>'description'),
        coalesce(v_stock.card_payload->>'item_weight',v_stock.card_payload->>'weight'),
        private.format_copper_currency_v1(v_price_copper),
        coalesce(v_stock.card_payload,'{}'::jsonb)||jsonb_build_object(
          'startingEquipment',true,
          'startingMarket',true,
          'purchase_price_gp',coalesce(v_stock.price_gp,0),
          'purchase_qty',v_quantity,
          'merchant_id',v_merchant_id,
          'stock_id',v_stock_id
        ),
        'character',p_character_id::text,false,v_quantity,null,now()
      );

      if v_stock.qty=v_quantity then
        delete from public.character_stock where id=v_stock_id;
      else
        update public.character_stock
        set qty=qty-v_quantity
        where id=v_stock_id;
      end if;

      v_rows:=v_rows+1;
      v_summary:=v_summary||jsonb_build_array(jsonb_build_object(
        'scope','market',
        'merchantId',v_merchant_id,
        'stockId',v_stock_id,
        'itemKey',coalesce(v_stock.item_id,v_stock.id::text),
        'name',coalesce(nullif(v_stock.display_name,''),v_stock.card_payload->>'item_name',v_stock.card_payload->>'name','Item'),
        'quantity',v_quantity,
        'priceGp',coalesce(v_stock.price_gp,0)
      ));
    end loop;

    v_remaining_copper:=v_market_budget-v_market_spent;

    insert into public.character_currency(character_id,copper_value,source_breakdown,updated_at,updated_by)
    values(
      p_character_id,
      v_remaining_copper,
      jsonb_build_object(
        'mode','market',
        'classCashOption',coalesce(v_class_cash->>'key',''),
        'backgroundCashOption',coalesce(v_background_cash->>'key',''),
        'classMarketCopper',coalesce((v_class_cash->>'copper')::bigint,0),
        'backgroundMarketCopper',coalesce((v_background_cash->>'copper')::bigint,0),
        'higherLevelCopper',v_higher_copper,
        'higherLevelRoll',v_roll,
        'marketBudgetCopper',v_market_budget,
        'marketSpentCopper',v_market_spent,
        'magicItemGuide',v_higher->'magicItems'
      ),
      now(),v_user
    );

    v_sheet:=jsonb_set(v_sheet,'{startingEquipmentSummary}',v_summary,true);
    v_sheet:=jsonb_set(v_sheet,'{startingCurrencyCopper}',to_jsonb(v_remaining_copper),true);
    v_sheet:=jsonb_set(v_sheet,'{higherLevelMagicItemGuide}',coalesce(v_higher->'magicItems','{}'::jsonb),true);
    v_sheet:=jsonb_set(v_sheet,'{meta,startingCurrencyCopper}',to_jsonb(v_remaining_copper),true);
    update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;

    return jsonb_build_object(
      'applied',true,
      'mode','market',
      'inventoryRows',v_rows,
      'currencyCopper',v_remaining_copper,
      'marketBudgetCopper',v_market_budget,
      'marketSpentCopper',v_market_spent,
      'items',v_summary,
      'magicItemGuide',v_higher->'magicItems'
    );
  end if;

  -- Legacy package mode remains available for pre-existing Forge drafts.
  v_option_key:=upper(coalesce(v_selection->>'classOption',''));
  v_class_parts:=private.player_forge_equipment_option_parts_v1(v_class_options,v_option_key);
  if jsonb_array_length(v_class_options)>0 and v_class_parts is null then
    raise exception 'Choose a valid source-backed class starting equipment package.';
  end if;

  if v_background.id is not null then
    v_background_parts:=private.player_forge_equipment_option_parts_v1(
      v_background_options,
      upper(coalesce(v_selection->>'backgroundOption',''))
    );
    if jsonb_array_length(v_background_options)>0 and v_background_parts is null then
      raise exception 'Choose a valid source-backed Background starting equipment package.';
    end if;
  end if;

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
          select * into v_item
          from public.items_catalog
          where lower(item_name)='spellbook'
          order by case when payload->>'source'='XPHB' then 0 when payload->>'source'='PHB' then 1 else 2 end
          limit 1;
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
          if not exists(
            select 1
            from jsonb_array_elements_text(v_categories) c(value)
            where private.player_forge_equipment_choice_allowed_v1(c.value,v_item_key)
          ) then
            raise exception 'Selected item % is not legal for this starting equipment category.',v_item_key;
          end if;
        end if;
      end if;

      if nullif(v_item_key,'') is not null then
        select * into v_item
        from public.items_catalog
        where lower(item_key)=lower(v_item_key)
        order by case when payload->>'source'='XPHB' then 0 when payload->>'source'='PHB' then 1 else 2 end
        limit 1;
        if not found then raise exception 'Starting equipment item % is unavailable in the canonical item catalogue.',v_item_key; end if;

        insert into public.inventory_items(
          user_id,item_id,item_name,item_type,item_rarity,item_description,item_weight,item_cost,
          card_payload,owner_type,owner_id,is_equipped,quantity,equip_slot,updated_at
        ) values(
          v_user,v_item.item_key,v_item.item_name,v_item.item_type,initcap(coalesce(v_item.item_rarity,'mundane')),v_item.description,
          case when v_item.weight_lb is null then null else v_item.weight_lb::text end,
          private.format_copper_currency_v1(coalesce((v_item.payload->>'value')::bigint,0)),
          coalesce(v_item.payload,'{}'::jsonb)||jsonb_build_object(
            'item_key',v_item.item_key,
            'item_name',v_item.item_name,
            'startingEquipment',true,
            'startingEquipmentScope',v_scope,
            'startingEquipmentOption',v_option_key
          ),
          'character',p_character_id::text,false,v_quantity,null,now()
        );
        v_rows:=v_rows+1;
        v_summary:=v_summary||jsonb_build_array(jsonb_build_object(
          'scope',v_scope,'option',v_option_key,'itemKey',v_item.item_key,'name',v_item.item_name,'quantity',v_quantity
        ));
      end if;
      v_index:=v_index+1;
    end loop;
  end loop;

  insert into public.character_currency(character_id,copper_value,source_breakdown,updated_at,updated_by)
  values(
    p_character_id,
    v_package_copper+v_higher_copper,
    jsonb_build_object(
      'mode','package',
      'classPackageCopper',coalesce((select sum(coalesce((x->>'value')::bigint,0)) from jsonb_array_elements(coalesce(v_class_parts,'[]'::jsonb)) x where x ? 'value'),0),
      'backgroundPackageCopper',coalesce((select sum(coalesce((x->>'value')::bigint,0)) from jsonb_array_elements(coalesce(v_background_parts,'[]'::jsonb)) x where x ? 'value'),0),
      'higherLevelCopper',v_higher_copper,
      'higherLevelRoll',v_roll,
      'magicItemGuide',v_higher->'magicItems'
    ),
    now(),v_user
  );

  v_sheet:=jsonb_set(v_sheet,'{startingEquipmentSummary}',v_summary,true);
  v_sheet:=jsonb_set(v_sheet,'{startingCurrencyCopper}',to_jsonb(v_package_copper+v_higher_copper),true);
  v_sheet:=jsonb_set(v_sheet,'{higherLevelMagicItemGuide}',coalesce(v_higher->'magicItems','{}'::jsonb),true);
  v_sheet:=jsonb_set(v_sheet,'{meta,startingCurrencyCopper}',to_jsonb(v_package_copper+v_higher_copper),true);
  update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;

  return jsonb_build_object(
    'applied',true,
    'mode','package',
    'inventoryRows',v_rows,
    'currencyCopper',v_package_copper+v_higher_copper,
    'items',v_summary,
    'magicItemGuide',v_higher->'magicItems'
  );
end;
$$;

create or replace function private.validate_player_forge_starting_equipment_sheet_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_sheet jsonb:=coalesce(new.sheet,'{}'::jsonb);
  v_selection jsonb;
  v_background_id uuid;
  v_background public.character_option_catalog%rowtype;
  v_sheet_background text;
  v_sheet_background_source text;
  v_level integer;
  v_roll integer;
  v_mode text;
  v_purchase jsonb;
begin
  if coalesce(v_sheet#>>'{meta,creator}','')<>'shared_character_forge_player_v2' then return new; end if;
  if not (v_sheet ? 'startingEquipmentSelections') then return new; end if;
  if jsonb_typeof(v_sheet->'startingEquipmentSelections')<>'object' then
    raise exception 'startingEquipmentSelections must be a JSON object.';
  end if;

  v_selection:=v_sheet->'startingEquipmentSelections';
  v_mode:=lower(coalesce(nullif(v_selection->>'mode',''),'package'));
  if v_mode not in ('market','package') then
    raise exception 'Unknown Player Forge starting-equipment mode.';
  end if;

  begin
    v_background_id:=nullif(v_selection->>'backgroundId','')::uuid;
  exception when invalid_text_representation then
    raise exception 'Starting equipment references an invalid Background id.';
  end;
  if v_background_id is null then raise exception 'Starting equipment must reference the selected Background.'; end if;

  select * into v_background
  from public.character_option_catalog
  where id=v_background_id and option_type='background';
  if not found then raise exception 'Starting equipment references an unavailable Background.'; end if;

  v_sheet_background:=lower(regexp_replace(btrim(coalesce(v_sheet->>'background',v_sheet#>>'{meta,background}','')),'[^a-zA-Z0-9]+','','g'));
  if v_sheet_background='' or v_sheet_background<>lower(regexp_replace(btrim(coalesce(v_background.name,'')),'[^a-zA-Z0-9]+','','g')) then
    raise exception 'Starting equipment Background does not match the character Background.';
  end if;

  v_sheet_background_source:=upper(btrim(coalesce(v_sheet#>>'{meta,backgroundSource}','')));
  if v_sheet_background_source<>'' and v_sheet_background_source<>upper(btrim(coalesce(v_background.source,''))) then
    raise exception 'Starting equipment Background source does not match the character Background source.';
  end if;

  v_level:=greatest(1,least(20,coalesce(nullif(v_sheet->>'level','')::integer,nullif(v_sheet#>>'{meta,level}','')::integer,1)));
  if nullif(v_selection->>'wealthRoll','') is not null then
    begin
      v_roll:=(v_selection->>'wealthRoll')::integer;
    exception when others then
      raise exception 'Higher-level starting wealth roll must be a d10 result from 1 to 10.';
    end;
    if v_roll not between 1 and 10 then raise exception 'Higher-level starting wealth roll must be a d10 result from 1 to 10.'; end if;
  end if;
  if v_level>=5 and v_roll is null then raise exception 'Higher-level starting wealth requires a d10 result from 1 to 10.'; end if;
  if v_level<5 and v_roll is not null then raise exception 'A higher-level starting wealth roll is not used below level 5.'; end if;

  if v_mode='market' then
    if (v_selection ? 'marketPurchases') and jsonb_typeof(v_selection->'marketPurchases')<>'array' then
      raise exception 'Starting market purchases must be a JSON array.';
    end if;
    for v_purchase in select value from jsonb_array_elements(coalesce(v_selection->'marketPurchases','[]'::jsonb)) loop
      if jsonb_typeof(v_purchase)<>'object' then
        raise exception 'Each starting market purchase must be a JSON object.';
      end if;
      if nullif(v_purchase->>'merchantId','') is null or nullif(v_purchase->>'stockId','') is null then
        raise exception 'Each starting market purchase must identify its merchant and stock row.';
      end if;
      begin
        if coalesce(nullif(v_purchase->>'qty','')::integer,1)<1 then
          raise exception 'Starting market purchase quantity must be at least 1.';
        end if;
      exception when invalid_text_representation then
        raise exception 'Starting market purchase quantity must be a whole number.';
      end;
    end loop;
  end if;

  return new;
end;
$$;

revoke all on function private.player_forge_cash_equipment_option_v1(jsonb) from public,anon,authenticated;
revoke all on function private.materialize_player_forge_starting_equipment_v1(uuid) from public,anon,authenticated;
revoke all on function private.validate_player_forge_starting_equipment_sheet_v1() from public,anon,authenticated;
grant execute on function private.player_forge_cash_equipment_option_v1(jsonb) to service_role;
grant execute on function private.materialize_player_forge_starting_equipment_v1(uuid) to service_role;
grant execute on function private.validate_player_forge_starting_equipment_sheet_v1() to service_role;

do $$
declare
  v_class_without_cash integer;
  v_background_without_cash integer;
begin
  select count(*) into v_class_without_cash
  from public.class_catalog c
  where c.source in ('XPHB','EFA','GrimHollowPG24')
    and jsonb_array_length(coalesce(c.raw_payload#>'{startingEquipment,defaultData}','[]'::jsonb))>0
    and private.player_forge_cash_equipment_option_v1(c.raw_payload#>'{startingEquipment,defaultData}') is null;

  select count(*) into v_background_without_cash
  from public.character_option_catalog b
  where b.option_type='background'
    and b.source='XPHB'
    and jsonb_array_length(coalesce(b.metadata->'equipment','[]'::jsonb))>0
    and private.player_forge_cash_equipment_option_v1(b.metadata->'equipment') is null;

  if v_class_without_cash<>0 then
    raise exception 'Player Forge starting market requires source cash alternatives for every supported class; missing %.',v_class_without_cash;
  end if;
  if v_background_without_cash<>0 then
    raise exception 'Player Forge starting market requires source cash alternatives for every supported Background; missing %.',v_background_without_cash;
  end if;
end;
$$;
