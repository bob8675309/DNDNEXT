-- Recipe purchase unlocks + improved themed merchant reroll.
-- Applied live before committing this file.
--
-- Summary:
-- - public.buy_from_merchant now treats Recipe stock as learnable formulas/patterns.
--   Buying a Recipe row inserts public.player_recipes(player_id, recipe_id) and does not
--   add a clutter inventory row.
-- - public.reroll_merchant_inventory_v2 now builds a themed shelf mix from items_catalog:
--   a few recipes, relevant consumables, relevant materials, then themed catalog fill.
-- - Reroll test was performed inside a transaction and rolled back; alchemy reroll produced
--   16 rows with recipes, consumables, and materials represented.
--
-- Safety:
-- - No NPC deletion.
-- - No world-map, route, sprite, or movement rows changed by these functions unless an admin
--   explicitly presses merchant reroll, which only replaces that merchant's character_stock.
-- - buy_from_merchant still requires auth.uid().

create or replace function public.buy_from_merchant(p_merchant_id uuid, p_stock_uuid uuid, p_qty integer)
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private', 'auth'
as $function$
declare
  buyer uuid := auth.uid();
  buy_qty int;
  price_each numeric;
  total numeric;
  cur_gp numeric;
  stock public.character_stock%rowtype;
  i int;
  per_item_payload jsonb;
  is_recipe boolean := false;
  recipe_id_text text;
  recipe_id_value uuid;
begin
  if buyer is null then
    raise exception 'Not signed in';
  end if;

  buy_qty := greatest(coalesce(p_qty, 1), 1);

  select * into stock
    from public.character_stock
   where id = p_stock_uuid
     and character_id = p_merchant_id
   for update;

  if not found then
    raise exception 'Stock not found';
  end if;

  is_recipe := coalesce((stock.card_payload ->> 'recipe_item')::boolean, false)
    or lower(coalesce(stock.card_payload ->> 'item_type', '')) = 'recipe'
    or lower(coalesce(stock.card_payload ->> 'uiType', '')) = 'recipe'
    or stock.display_name ilike 'Recipe:%';

  if is_recipe then
    buy_qty := 1;
    recipe_id_text := stock.card_payload #>> '{recipe_unlock,recipe_id}';
    if recipe_id_text is null or recipe_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'Recipe unlock metadata missing';
    end if;
    recipe_id_value := recipe_id_text::uuid;

    if exists (
      select 1 from public.player_recipes pr
      where pr.player_id = buyer
        and pr.recipe_id = recipe_id_value
    ) then
      raise exception 'Recipe already known';
    end if;
  end if;

  if stock.qty < buy_qty then
    raise exception 'Not enough stock';
  end if;

  price_each := coalesce(stock.price_gp, 0);
  total := price_each * buy_qty;

  insert into public.player_wallets(user_id, gp)
  values (buyer, 0)
  on conflict (user_id) do nothing;

  select gp into cur_gp from public.player_wallets where user_id = buyer for update;
  cur_gp := coalesce(cur_gp, 0);

  if cur_gp <> -1 and cur_gp < total then
    raise exception 'Insufficient funds';
  end if;

  if cur_gp <> -1 then
    update public.player_wallets
       set gp = cur_gp - total,
           updated_at = now()
     where user_id = buyer;
  end if;

  update public.character_stock
     set qty = qty - buy_qty,
         updated_at = now()
   where id = p_stock_uuid;

  delete from public.character_stock where id = p_stock_uuid and qty <= 0;

  per_item_payload := coalesce(stock.card_payload, '{}'::jsonb)
    || jsonb_build_object(
      'purchase_price_gp', price_each,
      'purchase_total_gp', total,
      'purchase_qty', buy_qty,
      'merchant_id', p_merchant_id,
      'stock_id', p_stock_uuid
    );

  if is_recipe then
    insert into public.player_recipes(player_id, recipe_id, discovered_at)
    values (buyer, recipe_id_value, now())
    on conflict (player_id, recipe_id) do nothing;
    return buy_qty;
  end if;

  for i in 1..buy_qty loop
    insert into public.inventory_items(
      user_id, item_id, item_name, item_type, item_rarity, item_description,
      item_weight, item_cost, card_payload, owner_type, owner_id, is_equipped
    ) values (
      buyer,
      coalesce(stock.item_id, stock.id::text),
      stock.display_name,
      (stock.card_payload ->> 'item_type'),
      (stock.card_payload ->> 'item_rarity'),
      coalesce(stock.card_payload ->> 'item_description', stock.card_payload ->> 'description'),
      (stock.card_payload ->> 'item_weight'),
      (stock.card_payload ->> 'item_cost'),
      per_item_payload,
      'player',
      buyer::text,
      false
    );
  end loop;

  return buy_qty;
end;
$function$;

create or replace function public.reroll_merchant_inventory_v2(p_merchant_id uuid, p_theme text default 'general'::text, p_count integer default null::integer)
returns table(inserted_count integer, theme text, merchant_id uuid)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private', 'auth'
as $function$
declare
  v_theme text := coalesce(nullif(lower(p_theme), ''), 'general');
  v_total integer := least(greatest(coalesce(p_count, 12 + floor(random() * 9)::integer), 8), 24);
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_tags text[];
  v_target integer;
begin
  if v_uid is null then
    v_is_admin := true;
  else
    select coalesce(up.role = 'admin', false)
      into v_is_admin
      from public.user_profiles up
     where up.id = v_uid;
  end if;

  if not coalesce(v_is_admin, false) then
    raise exception 'Only admins can reroll merchant stock';
  end if;

  v_tags := case v_theme
    when 'alchemy' then array['alchemy','alchemist','potions','poisons','bombs','oils','formula','recipe']::text[]
    when 'herbalist' then array['herbalist','alchemy','alchemist','plant','herb','reagent','formula','recipe']::text[]
    when 'arcanist' then array['arcanist','scribe','scroll','focus','formula','recipe']::text[]
    when 'smith' then array['smith','blacksmith','weapons','smithing','material','recipe']::text[]
    when 'weapons' then array['weapons','smith','blacksmith','smithing','recipe']::text[]
    when 'jeweler' then array['jeweler','arcanist','gem','relic','recipe']::text[]
    when 'clothier' then array['clothier','tailor','recipe']::text[]
    when 'stable' then array['stable','caravan','general']::text[]
    when 'caravan' then array['caravan','general','material','recipe']::text[]
    else array['general','recipe']::text[]
  end;

  delete from public.character_stock where character_id = p_merchant_id;

  drop table if exists pg_temp.merchant_reroll_pick;
  create temporary table merchant_reroll_pick (
    pick_key text primary key,
    item_name text not null,
    item_type text,
    item_rarity text,
    price_gp numeric not null,
    payload jsonb not null,
    note text not null
  ) on commit drop;

  -- Recipe rows: formulas/patterns show up here and there.
  v_target := case when v_theme in ('stable') then 0 else greatest(1, round(v_total * 0.12)::integer) end;
  insert into merchant_reroll_pick(pick_key, item_name, item_type, item_rarity, price_gp, payload, note)
  select coalesce(s.item_key, s.id::text), s.item_name, s.item_type, s.item_rarity, s.price_gp, s.payload, 'auto_reroll:' || v_theme || ':recipe'
  from (
    select ic.* from public.items_catalog ic
    where ic.item_type = 'Recipe'
      and (v_theme = 'general' or ic.merchant_tags && v_tags or ic.merchant_tags @> array['recipe']::text[])
    order by random()
    limit v_target
  ) s
  on conflict do nothing;

  -- Consumables, especially for alchemy/herbalist themes.
  v_target := case when v_theme in ('alchemy','herbalist') then greatest(4, round(v_total * 0.35)::integer) else greatest(1, round(v_total * 0.10)::integer) end;
  insert into merchant_reroll_pick(pick_key, item_name, item_type, item_rarity, price_gp, payload, note)
  select coalesce(s.item_key, s.id::text), s.item_name, s.item_type, s.item_rarity, s.price_gp, s.payload, 'auto_reroll:' || v_theme || ':consumable'
  from (
    select ic.* from public.items_catalog ic
    where coalesce(ic.item_type, ic.payload->>'item_type', ic.payload->'alchemy'->>'section') in ('Potion','Poison','Elixir','Bomb','Oil','Potions & Poisons')
      and (v_theme = 'general' or ic.merchant_tags && v_tags)
      and not exists (select 1 from merchant_reroll_pick p where p.pick_key = coalesce(ic.item_key, ic.id::text))
    order by random()
    limit v_target
  ) s
  on conflict do nothing;

  -- Materials/supplies, so shops use more of the catalog than just Wondrous Items.
  v_target := case when v_theme in ('alchemy','herbalist','smith','weapons','caravan') then greatest(2, round(v_total * 0.20)::integer) else greatest(1, round(v_total * 0.10)::integer) end;
  insert into merchant_reroll_pick(pick_key, item_name, item_type, item_rarity, price_gp, payload, note)
  select coalesce(s.item_key, s.id::text), s.item_name, s.item_type, s.item_rarity, s.price_gp, s.payload, 'auto_reroll:' || v_theme || ':material'
  from (
    select ic.* from public.items_catalog ic
    where coalesce(ic.item_type, ic.payload->>'item_type') in ('Plant / Herb','Reagent / Catalyst','Monster Part','Ore / Metal','Material','Catalyst','Alchemy Modifier')
      and (v_theme = 'general' or ic.merchant_tags && v_tags)
      and not exists (select 1 from merchant_reroll_pick p where p.pick_key = coalesce(ic.item_key, ic.id::text))
    order by random()
    limit v_target
  ) s
  on conflict do nothing;

  -- Themed fill, then fallback catalog fill if a theme is sparse.
  insert into merchant_reroll_pick(pick_key, item_name, item_type, item_rarity, price_gp, payload, note)
  select coalesce(s.item_key, s.id::text), s.item_name, s.item_type, s.item_rarity, s.price_gp, s.payload, 'auto_reroll:' || v_theme || ':themed'
  from (
    select ic.* from public.items_catalog ic
    where (v_theme = 'general' or ic.merchant_tags && v_tags)
      and not exists (select 1 from merchant_reroll_pick p where p.pick_key = coalesce(ic.item_key, ic.id::text))
    order by case coalesce(ic.item_rarity,'') when 'Common' then 1 when 'Uncommon' then 2 when 'Rare' then 3 when 'Very Rare' then 4 else 5 end, random()
    limit greatest(0, v_total - (select count(*) from merchant_reroll_pick))
  ) s
  on conflict do nothing;

  insert into merchant_reroll_pick(pick_key, item_name, item_type, item_rarity, price_gp, payload, note)
  select coalesce(s.item_key, s.id::text), s.item_name, s.item_type, s.item_rarity, s.price_gp, s.payload, 'auto_reroll:fallback_catalog'
  from (
    select ic.* from public.items_catalog ic
    where not exists (select 1 from merchant_reroll_pick p where p.pick_key = coalesce(ic.item_key, ic.id::text))
    order by random()
    limit greatest(0, v_total - (select count(*) from merchant_reroll_pick))
  ) s
  on conflict do nothing;

  insert into public.character_stock(character_id, display_name, price_gp, qty, card_payload, item_id, note)
  select p_merchant_id, p.item_name, p.price_gp, 1,
    private.merchant_alchemy_crafted_payload_v1(
      coalesce(p.payload, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
        'item_id', coalesce(p.payload->>'item_id', p.pick_key),
        'item_key', p.pick_key,
        'item_name', p.item_name,
        'item_type', p.item_type,
        'item_rarity', p.item_rarity,
        'price_gp', p.price_gp
      ))
    ),
    p.pick_key,
    p.note
  from merchant_reroll_pick p;

  select count(*)::integer into inserted_count from merchant_reroll_pick;
  theme := v_theme;
  merchant_id := p_merchant_id;
  return next;
end;
$function$;
