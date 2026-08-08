-- Source-backed starting equipment / higher-level wealth authority for Player Forge.
-- Restores structured class packages the class importer dropped, reuses Background
-- equipment already stored in character_option_catalog metadata, materializes gear
-- into character-scoped canonical inventory rows, and stores cash as character-
-- scoped copper value rather than account wallet state.

create table if not exists public.character_currency (
  character_id uuid primary key references public.characters(id) on delete cascade,
  copper_value bigint not null default 0 check (copper_value >= 0),
  source_breakdown jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

revoke all on table public.character_currency from public, anon, authenticated;
grant select,insert,update,delete on table public.character_currency to service_role;

-- Restore structured starting-equipment source data for the preferred 2024 core
-- classes plus the imported EFA Artificer. Currency `value` entries are copper.
with packages(class_key,source,default_data) as (values
  ('artificer','EFA','[{"A":[{"item":"Studded Leather Armor|XPHB"},{"item":"Dagger|XPHB"},{"item":"Thieves'' Tools|XPHB"},{"item":"Tinker''s Tools|XPHB"},{"item":"Dungeoneer''s Pack|XPHB"},{"value":1600}]},{"B":[{"value":15000}]}]'::jsonb),
  ('barbarian','XPHB','[{"A":[{"item":"Greataxe|XPHB"},{"item":"Handaxe|XPHB","quantity":4},{"item":"Explorer''s Pack|XPHB"},{"value":1500}]},{"B":[{"value":7500}]}]'::jsonb),
  ('bard','XPHB','[{"A":[{"item":"Leather Armor|XPHB"},{"item":"Dagger|XPHB","quantity":2},{"equipmentType":"instrumentMusical"},{"item":"Entertainer''s Pack|XPHB"},{"value":1900}]},{"B":[{"value":9000}]}]'::jsonb),
  ('cleric','XPHB','[{"A":[{"item":"Chain Shirt|XPHB"},{"item":"Shield|XPHB"},{"item":"Mace|XPHB"},{"equipmentType":"focusHoly"},{"item":"Priest''s Pack|XPHB"},{"value":700}]},{"B":[{"value":11000}]}]'::jsonb),
  ('druid','XPHB','[{"A":[{"item":"Leather Armor|XPHB"},{"item":"Shield|XPHB"},{"item":"Sickle|XPHB"},{"equipmentType":"focusDruidic"},{"item":"Explorer''s Pack|XPHB"},{"item":"Herbalism Kit|XPHB"},{"value":900}]},{"B":[{"value":5000}]}]'::jsonb),
  ('fighter','XPHB','[{"A":[{"item":"Chain Mail|XPHB"},{"item":"Greatsword|XPHB"},{"item":"Flail|XPHB"},{"item":"Javelin|XPHB","quantity":8},{"item":"Dungeoneer''s Pack|XPHB"},{"value":400}]},{"B":[{"item":"Studded Leather Armor|XPHB"},{"item":"Scimitar|XPHB"},{"item":"Shortsword|XPHB"},{"item":"Longbow|XPHB"},{"item":"Arrow|XPHB","quantity":20},{"item":"Quiver|XPHB"},{"item":"Dungeoneer''s Pack|XPHB"},{"value":1100}]},{"C":[{"value":15500}]}]'::jsonb),
  ('monk','XPHB','[{"A":[{"item":"Spear|XPHB"},{"item":"Dagger|XPHB","quantity":5},{"equipmentTypes":["instrumentMusical","toolArtisan"]},{"item":"Explorer''s Pack|XPHB"},{"value":1100}]},{"B":[{"value":5000}]}]'::jsonb),
  ('paladin','XPHB','[{"A":[{"item":"Chain Mail|XPHB"},{"item":"Shield|XPHB"},{"item":"Longsword|XPHB"},{"item":"Javelin|XPHB","quantity":6},{"equipmentType":"focusHoly"},{"item":"Priest''s Pack|XPHB"},{"value":900}]},{"B":[{"value":15000}]}]'::jsonb),
  ('ranger','XPHB','[{"A":[{"item":"Studded Leather Armor|XPHB"},{"item":"Scimitar|XPHB"},{"item":"Shortsword|XPHB"},{"item":"Longbow|XPHB"},{"item":"Arrow|XPHB","quantity":20},{"item":"Quiver|XPHB"},{"item":"Sprig of Mistletoe|XPHB"},{"item":"Explorer''s Pack|XPHB"},{"value":700}]},{"B":[{"value":15000}]}]'::jsonb),
  ('rogue','XPHB','[{"A":[{"item":"Leather Armor|XPHB"},{"item":"Dagger|XPHB","quantity":2},{"item":"Shortsword|XPHB"},{"item":"Shortbow|XPHB"},{"item":"Arrow|XPHB","quantity":20},{"item":"Quiver|XPHB"},{"item":"Thieves'' Tools|XPHB"},{"item":"Burglar''s Pack|XPHB"},{"value":800}]},{"B":[{"value":10000}]}]'::jsonb),
  ('sorcerer','XPHB','[{"A":[{"item":"Spear|XPHB"},{"item":"Dagger|XPHB","quantity":2},{"item":"Crystal|XPHB"},{"item":"Dungeoneer''s Pack|XPHB"},{"value":2800}]},{"B":[{"value":5000}]}]'::jsonb),
  ('warlock','XPHB','[{"A":[{"item":"Leather Armor|XPHB"},{"item":"Sickle|XPHB"},{"item":"Dagger|XPHB","quantity":2},{"item":"Orb|XPHB"},{"item":"Book|XPHB"},{"item":"Scholar''s Pack|XPHB"},{"value":1500}]},{"B":[{"value":10000}]}]'::jsonb),
  ('wizard','XPHB','[{"A":[{"item":"Dagger|XPHB","quantity":2},{"item":"Quarterstaff|XPHB"},{"item":"Robe|XPHB"},{"special":"Spellbook"},{"item":"Scholar''s Pack|XPHB"},{"value":500}]},{"B":[{"value":5500}]}]'::jsonb)
)
update public.class_catalog c
set raw_payload=jsonb_set(
      jsonb_set(coalesce(c.raw_payload,'{}'::jsonb),'{startingEquipment}',coalesce(c.raw_payload->'startingEquipment','{}'::jsonb),true),
      '{startingEquipment,defaultData}',p.default_data,true
    ),
    updated_at=now()
from packages p
where lower(c.class_key)=p.class_key and upper(c.source)=p.source;

create or replace function private.player_forge_equipment_choice_allowed_v1(p_category text,p_item_key text)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
  select exists(
    select 1 from public.items_catalog i
    where lower(i.item_key)=lower(p_item_key)
      and lower(coalesce(i.item_rarity,''))='mundane'
      and case p_category
        when 'toolArtisan' then coalesce(i.payload->>'type','') like 'AT%'
        when 'instrumentMusical' then coalesce(i.payload->>'type','') like 'INS%'
        when 'setGaming' then coalesce(i.payload->>'type','') like 'GS%'
        when 'focusHoly' then coalesce(i.payload->>'scfType','')='holy'
        when 'focusDruidic' then coalesce(i.payload->>'scfType','')='druid'
        else false
      end
  );
$$;

create or replace function private.player_forge_equipment_option_parts_v1(p_options jsonb,p_option_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_group jsonb;
  v_key text:=upper(btrim(coalesce(p_option_key,'')));
begin
  if jsonb_typeof(p_options)<>'array' or v_key='' then return null; end if;
  for v_group in select value from jsonb_array_elements(p_options) loop
    if jsonb_typeof(v_group)='object' and v_group ? v_key and jsonb_typeof(v_group->v_key)='array' then return v_group->v_key; end if;
  end loop;
  return null;
end;
$$;

create or replace function private.format_copper_currency_v1(p_copper bigint)
returns text
language plpgsql
immutable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_cp bigint:=greatest(0,coalesce(p_copper,0));
  v_gp bigint;
  v_sp bigint;
  v_rem bigint;
  v_out text:='';
begin
  v_gp:=v_cp/100;
  v_rem:=v_cp%100;
  v_sp:=v_rem/10;
  v_rem:=v_rem%10;
  if v_gp>0 then v_out:=v_gp||' gp'; end if;
  if v_sp>0 then v_out:=v_out||case when v_out<>'' then ' ' else '' end||v_sp||' sp'; end if;
  if v_rem>0 then v_out:=v_out||case when v_out<>'' then ' ' else '' end||v_rem||' cp'; end if;
  return case when v_out='' then '0 gp' else v_out end;
end;
$$;

create or replace function private.player_forge_higher_level_wealth_v1(p_level integer,p_roll integer)
returns jsonb
language plpgsql
immutable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_level integer:=greatest(1,least(20,coalesce(p_level,1)));
  v_roll integer:=p_roll;
  v_cp bigint:=0;
  v_magic jsonb:='{}'::jsonb;
begin
  if v_level between 2 and 4 then
    v_magic:=jsonb_build_object('common',1);
  elsif v_level between 5 and 10 then
    if v_roll not between 1 and 10 then raise exception 'Higher-level starting wealth requires a d10 result from 1 to 10.'; end if;
    v_cp:=(500+v_roll*25)*100;
    v_magic:=jsonb_build_object('common',1,'uncommon',1);
  elsif v_level between 11 and 16 then
    if v_roll not between 1 and 10 then raise exception 'Higher-level starting wealth requires a d10 result from 1 to 10.'; end if;
    v_cp:=(5000+v_roll*250)*100;
    v_magic:=jsonb_build_object('common',2,'uncommon',3,'rare',1);
  elsif v_level between 17 and 20 then
    if v_roll not between 1 and 10 then raise exception 'Higher-level starting wealth requires a d10 result from 1 to 10.'; end if;
    v_cp:=(20000+v_roll*250)*100;
    v_magic:=jsonb_build_object('common',2,'uncommon',4,'rare',3,'veryRare',1);
  end if;
  return jsonb_build_object('copper',v_cp,'magicItems',v_magic,'rollRequired',v_level>=5);
end;
$$;

create or replace function public.get_player_forge_starting_equipment_v1(p_class_id uuid,p_background_id uuid,p_level integer default 1)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_class public.class_catalog%rowtype;
  v_background public.character_option_catalog%rowtype;
  v_class_options jsonb:='[]'::jsonb;
  v_background_options jsonb:='[]'::jsonb;
  v_choice_options jsonb:='{}'::jsonb;
  v_level integer:=greatest(1,least(20,coalesce(p_level,1)));
begin
  if auth.uid() is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  select * into v_class from public.class_catalog where id=p_class_id;
  if found then v_class_options:=coalesce(v_class.raw_payload#>'{startingEquipment,defaultData}','[]'::jsonb); end if;
  select * into v_background from public.character_option_catalog where id=p_background_id and option_type='background';
  if found then v_background_options:=coalesce(v_background.metadata->'equipment','[]'::jsonb); end if;

  select jsonb_build_object(
    'toolArtisan',coalesce(jsonb_agg(jsonb_build_object('itemKey',i.item_key,'name',i.item_name,'source',i.payload->>'source','itemType',i.item_type) order by i.item_name) filter(where coalesce(i.payload->>'type','') like 'AT%' and i.payload->>'source'='XPHB'),'[]'::jsonb),
    'instrumentMusical',coalesce(jsonb_agg(jsonb_build_object('itemKey',i.item_key,'name',i.item_name,'source',i.payload->>'source','itemType',i.item_type) order by i.item_name) filter(where coalesce(i.payload->>'type','') like 'INS%' and i.payload->>'source'='XPHB'),'[]'::jsonb),
    'setGaming',coalesce(jsonb_agg(jsonb_build_object('itemKey',i.item_key,'name',i.item_name,'source',i.payload->>'source','itemType',i.item_type) order by i.item_name) filter(where coalesce(i.payload->>'type','') like 'GS%' and i.payload->>'source'='XPHB'),'[]'::jsonb),
    'focusHoly',coalesce(jsonb_agg(jsonb_build_object('itemKey',i.item_key,'name',i.item_name,'source',i.payload->>'source','itemType',i.item_type) order by i.item_name) filter(where i.payload->>'scfType'='holy' and i.payload->>'source'='XPHB'),'[]'::jsonb),
    'focusDruidic',coalesce(jsonb_agg(jsonb_build_object('itemKey',i.item_key,'name',i.item_name,'source',i.payload->>'source','itemType',i.item_type) order by i.item_name) filter(where i.payload->>'scfType'='druid' and i.payload->>'source'='XPHB'),'[]'::jsonb)
  ) into v_choice_options
  from public.items_catalog i
  where lower(coalesce(i.item_rarity,''))='mundane';

  return jsonb_build_object(
    'catalogReady',true,
    'classId',p_class_id,
    'classKey',coalesce(v_class.class_key,''),
    'className',coalesce(v_class.class_name,''),
    'classSource',coalesce(v_class.source,''),
    'classOptions',v_class_options,
    'backgroundId',p_background_id,
    'backgroundKey',coalesce(v_background.option_key,''),
    'backgroundName',coalesce(v_background.name,''),
    'backgroundSource',coalesce(v_background.source,''),
    'backgroundOptions',v_background_options,
    'choiceOptions',v_choice_options,
    'level',v_level,
    'higherLevelGuide',private.player_forge_higher_level_wealth_v1(v_level,case when v_level>=5 then 1 else null end)-'copper'
  );
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
  v_category text;
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
    begin select * into v_background from public.character_option_catalog where id=(v_selection->>'backgroundId')::uuid and option_type='background';
    exception when invalid_text_representation then raise exception 'Starting equipment references an invalid Background id.'; end;
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
        v_categories:=case when nullif(v_part->>'equipmentType','') is not null then jsonb_build_array(v_part->>'equipmentType') when jsonb_typeof(v_part->'equipmentTypes')='array' then v_part->'equipmentTypes' else '[]'::jsonb end;
        if jsonb_array_length(v_categories)>0 then
          v_item_key:=v_choices->>(v_scope||':'||v_option_key||':'||v_index);
          if nullif(v_item_key,'') is null then raise exception 'Complete every starting equipment item-category choice.'; end if;
          if not exists(select 1 from jsonb_array_elements_text(v_categories) c(value) where private.player_forge_equipment_choice_allowed_v1(c.value,v_item_key)) then raise exception 'Selected item % is not legal for this starting equipment category.',v_item_key; end if;
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
    begin v_roll:=(v_selection->>'wealthRoll')::integer; exception when others then raise exception 'Higher-level wealth roll must be a d10 result from 1 to 10.'; end;
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
  update public.players p set sheet=v_sheet,updated_at=now() where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);

  return jsonb_build_object('applied',true,'inventoryRows',v_rows,'currencyCopper',v_package_copper+v_higher_copper,'items',v_summary,'magicItemGuide',v_higher->'magicItems');
end;
$$;

create or replace function private.materialize_player_forge_starting_equipment_trigger_v1()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private,auth
as $$
begin
  perform private.materialize_player_forge_starting_equipment_v1(new.character_id);
  return new;
end;
$$;

drop trigger if exists character_progression_materialize_player_forge_starting_equipment_v1 on public.character_progression;
create constraint trigger character_progression_materialize_player_forge_starting_equipment_v1
after insert on public.character_progression
deferrable initially deferred
for each row execute function private.materialize_player_forge_starting_equipment_trigger_v1();

create or replace function public.get_character_currency_v1(p_character_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private,auth
as $$
declare
  v_row public.character_currency%rowtype;
begin
  if not private.can_access_character_v1(p_character_id,'inventory') then raise exception 'You do not have permission to view this character currency.' using errcode='42501'; end if;
  select * into v_row from public.character_currency where character_id=p_character_id;
  return jsonb_build_object('characterId',p_character_id,'copperValue',coalesce(v_row.copper_value,0),'display',private.format_copper_currency_v1(coalesce(v_row.copper_value,0)),'sourceBreakdown',coalesce(v_row.source_breakdown,'{}'::jsonb));
end;
$$;

revoke all on function private.player_forge_equipment_choice_allowed_v1(text,text) from public,anon,authenticated;
revoke all on function private.player_forge_equipment_option_parts_v1(jsonb,text) from public,anon,authenticated;
revoke all on function private.format_copper_currency_v1(bigint) from public,anon,authenticated;
revoke all on function private.player_forge_higher_level_wealth_v1(integer,integer) from public,anon,authenticated;
revoke all on function private.materialize_player_forge_starting_equipment_v1(uuid) from public,anon,authenticated;
revoke all on function private.materialize_player_forge_starting_equipment_trigger_v1() from public,anon,authenticated;
grant execute on function private.player_forge_equipment_choice_allowed_v1(text,text) to service_role;
grant execute on function private.player_forge_equipment_option_parts_v1(jsonb,text) to service_role;
grant execute on function private.format_copper_currency_v1(bigint) to service_role;
grant execute on function private.player_forge_higher_level_wealth_v1(integer,integer) to service_role;
grant execute on function private.materialize_player_forge_starting_equipment_v1(uuid) to service_role;
grant execute on function private.materialize_player_forge_starting_equipment_trigger_v1() to service_role;
revoke all on function public.get_player_forge_starting_equipment_v1(uuid,uuid,integer) from public,anon;
grant execute on function public.get_player_forge_starting_equipment_v1(uuid,uuid,integer) to authenticated,service_role;
revoke all on function public.get_character_currency_v1(uuid) from public,anon;
grant execute on function public.get_character_currency_v1(uuid) to authenticated,service_role;
