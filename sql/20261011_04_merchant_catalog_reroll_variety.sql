-- Broaden merchant rerolls while keeping public.items_catalog as the sole stock catalogue.
--
-- v2 already queried the canonical table directly, but several themes could be dominated by
-- recipe-tagged rows. This replacement keeps a small recipe shelf, spreads the remaining
-- stock across item types, and uses the complete catalogue as a fallback candidate pool.

create or replace function public.reroll_merchant_inventory_v2(
  p_merchant_id uuid,
  p_theme text default 'general'::text,
  p_count integer default null::integer
)
returns table(inserted_count integer, theme text, merchant_id uuid)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private', 'auth'
as $function$
declare
  v_theme text := coalesce(nullif(lower(p_theme), ''), 'general');
  v_total integer := least(greatest(coalesce(p_count, 20 + floor(random() * 13)::integer), 8), 48);
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_tags text[];
  v_recipe_target integer;
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
    when 'clothier' then array['clothier','tailor','general','recipe']::text[]
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

  -- Recipes remain useful in the normal merchant shop, but never dominate a shelf.
  v_recipe_target := case when v_theme = 'stable' then 0 else least(3, greatest(1, round(v_total * 0.08)::integer)) end;
  insert into merchant_reroll_pick(pick_key,item_name,item_type,item_rarity,price_gp,payload,note)
  select coalesce(s.item_key,s.id::text),s.item_name,s.item_type,s.item_rarity,s.price_gp,s.payload,
         'auto_reroll:'||v_theme||':recipe'
    from (
      select ic.*
        from public.items_catalog ic
       where lower(coalesce(ic.item_type,''))='recipe'
         and (ic.merchant_tags && v_tags or v_theme='general')
       order by random()
       limit v_recipe_target
    ) s
  on conflict do nothing;

  -- The candidate CTE always starts from the complete canonical items_catalog.
  -- Theme/type affinity controls ordering only; it is not a separate sample table.
  with candidate_base as (
    select
      ic.*,
      coalesce(ic.item_type,ic.payload->>'item_type','') as resolved_type,
      case lower(coalesce(ic.item_rarity,''))
        when 'mundane' then 0
        when 'common' then 1
        when 'uncommon' then 2
        when 'rare' then 3
        when 'very rare' then 4
        when 'legendary' then 5
        when 'artifact' then 6
        else 7
      end as rarity_rank,
      case
        when v_theme in ('smith','weapons') and coalesce(ic.item_type,ic.payload->>'item_type','') in
          ('Melee Weapon','Ranged Weapon','Armor','Shield','Ammunition','Ore / Metal','Material','Tools') then 0
        when v_theme in ('alchemy','herbalist') and coalesce(ic.item_type,ic.payload->>'item_type','') in
          ('Plant / Herb','Reagent / Catalyst','Alchemy Modifier','Catalyst','Monster Part','Potion','Elixir','Oil','Poison','Bomb','Potions & Poisons') then 0
        when v_theme='arcanist' and coalesce(ic.item_type,ic.payload->>'item_type','') in
          ('Scroll & Focus','Rods & Wands','Wondrous Item','Instrument','Potion','Potions & Poisons') then 0
        when v_theme='jeweler' and (
          coalesce(ic.item_type,ic.payload->>'item_type','') in ('Wondrous Item','Trade Goods')
          or ic.merchant_tags && array['jeweler','gem','relic']::text[]
        ) then 0
        when v_theme in ('caravan','stable') and coalesce(ic.item_type,ic.payload->>'item_type','') in
          ('Adventuring Gear','Tools','Instrument','Trade Goods','Vehicles & Structures','Ammunition','Armor','Melee Weapon','Ranged Weapon') then 0
        when v_theme='clothier' and coalesce(ic.item_type,ic.payload->>'item_type','') in
          ('Adventuring Gear','Armor','Wondrous Item') then 0
        when v_theme='general' and ic.merchant_tags && array['general']::text[] then 0
        when ic.merchant_tags && v_tags then 1
        when ic.merchant_tags && array['general']::text[] then 2
        else 4
      end as theme_rank
    from public.items_catalog ic
    where lower(coalesce(ic.item_type,'')) <> 'recipe'
      and not exists (
        select 1 from merchant_reroll_pick p
         where p.pick_key=coalesce(ic.item_key,ic.id::text)
      )
  ),
  candidates as (
    select cb.*,
           row_number() over (
             partition by nullif(cb.resolved_type,'')
             order by cb.theme_rank,cb.rarity_rank,random()
           ) as type_slot
      from candidate_base cb
  ),
  picked as (
    select c.*
      from candidates c
     order by
       c.theme_rank,
       case when c.type_slot <= 6 then 0 else 1 end,
       c.type_slot,
       c.rarity_rank,
       random()
     limit greatest(0,v_total-(select count(*) from merchant_reroll_pick))
  )
  insert into merchant_reroll_pick(pick_key,item_name,item_type,item_rarity,price_gp,payload,note)
  select coalesce(p.item_key,p.id::text),p.item_name,p.item_type,p.item_rarity,p.price_gp,p.payload,
         'auto_reroll:'||v_theme||':catalog'
    from picked p
  on conflict do nothing;

  insert into public.character_stock(character_id,display_name,price_gp,qty,card_payload,item_id,note)
  select
    p_merchant_id,
    p.item_name,
    p.price_gp,
    1,
    private.merchant_alchemy_crafted_payload_v1(
      coalesce(p.payload,'{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
        'item_id',coalesce(p.payload->>'item_id',p.pick_key),
        'item_key',p.pick_key,
        'item_name',p.item_name,
        'item_type',p.item_type,
        'item_rarity',p.item_rarity,
        'price_gp',p.price_gp
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

do $$
declare
  v record;
begin
  for v in
    select c.id,s.theme
      from public.characters c
      join (values
        ('Mara Ironvein','smith'),
        ('Selene Quill','arcanist'),
        ('Pell Mossgrove','herbalist'),
        ('Brakka Wayfarer','caravan'),
        ('Ilyra Glasshand','jeweler'),
        ('Torren Packswell','general')
      ) as s(name,theme) on lower(s.name)=lower(c.name)
  loop
    perform * from public.reroll_merchant_inventory_v2(v.id,v.theme,36);
  end loop;
end
$$;
