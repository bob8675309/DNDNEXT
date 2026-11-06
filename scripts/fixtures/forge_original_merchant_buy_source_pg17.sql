-- Read-only source-original DnDWeb PG17.4 public.buy_from_merchant source.
-- md5(pg_get_functiondef) = 1dbe8c24c4c718396d7256f6f7465354; disposable PR #324 GoTrue fixture ONLY.
-- Not production migration. Caller auth/role enforced by original body.
CREATE OR REPLACE FUNCTION public.buy_from_merchant(p_merchant_id uuid, p_stock_uuid uuid, p_qty integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
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
      user_id,
      item_id,
      item_name,
      item_type,
      item_rarity,
      item_description,
      item_weight,
      item_cost,
      card_payload,
      owner_type,
      owner_id,
      is_equipped
    )
    values (
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
