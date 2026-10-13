-- Cap routine merchant recipe rarity at Rare so baseline storefronts never
-- introduce Very Rare, Legendary, or Artifact stock through the recipe slot.
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
  v_total integer := least(greatest(coalesce(p_count, 28 + floor(random() * 5)::integer), 12), 48);
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_tags text[];
  v_recipe_target integer := 0;
  v_item_target integer;
  v_low_target integer;
  v_uncommon_target integer;
  v_rare_target integer;
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

  v_recipe_target := case
    when v_theme in ('alchemy','herbalist','arcanist','smith','weapons','jeweler','clothier') then 1
    else 0
  end;

  v_item_target := greatest(0, v_total - v_recipe_target);
  v_low_target := greatest(1, round(v_item_target * 0.57)::integer);
  v_uncommon_target := greatest(1, round(v_item_target * 0.33)::integer);
  v_rare_target := greatest(0, v_item_target - v_low_target - v_uncommon_target);

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

  drop table if exists pg_temp.merchant_candidate_pool;
  create temporary table merchant_candidate_pool on commit drop as
  select
    ic.*,
    coalesce(ic.item_type,ic.payload->>'item_type','') as resolved_type,
    case
      when lower(coalesce(ic.item_rarity,'')) in ('mundane','common') then 'low'
      when lower(coalesce(ic.item_rarity,'')) = 'uncommon' then 'uncommon'
      when lower(coalesce(ic.item_rarity,'')) = 'rare' then 'rare'
      else 'excluded'
    end as rarity_bucket,
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
  where lower(coalesce(ic.item_type,'')) <> 'recipe';

  if v_recipe_target > 0 then
    insert into merchant_reroll_pick(pick_key,item_name,item_type,item_rarity,price_gp,payload,note)
    select coalesce(s.item_key,s.id::text),s.item_name,s.item_type,s.item_rarity,s.price_gp,s.payload,
           'auto_reroll:'||v_theme||':recipe'
      from (
        select ic.*
          from public.items_catalog ic
         where lower(coalesce(ic.item_type,''))='recipe'
           and lower(coalesce(ic.item_rarity,'mundane')) in ('mundane','common','uncommon','rare')
           and (ic.merchant_tags && v_tags or v_theme='general')
         order by random()
         limit v_recipe_target
      ) s
    on conflict do nothing;
  end if;

  insert into merchant_reroll_pick(pick_key,item_name,item_type,item_rarity,price_gp,payload,note)
  select coalesce(p.item_key,p.id::text),p.item_name,p.item_type,p.item_rarity,p.price_gp,p.payload,
         'auto_reroll:'||v_theme||':low'
  from (
    select c.*,
           row_number() over (
             partition by nullif(c.resolved_type,'')
             order by c.theme_rank,random()
           ) as type_slot
      from merchant_candidate_pool c
     where c.rarity_bucket='low'
  ) p
  order by p.theme_rank, case when p.type_slot <= 6 then 0 else 1 end, p.type_slot, random()
  limit v_low_target
  on conflict do nothing;

  insert into merchant_reroll_pick(pick_key,item_name,item_type,item_rarity,price_gp,payload,note)
  select coalesce(p.item_key,p.id::text),p.item_name,p.item_type,p.item_rarity,p.price_gp,p.payload,
         'auto_reroll:'||v_theme||':uncommon'
  from (
    select c.*,
           row_number() over (
             partition by nullif(c.resolved_type,'')
             order by c.theme_rank,random()
           ) as type_slot
      from merchant_candidate_pool c
     where c.rarity_bucket='uncommon'
       and not exists (
         select 1 from merchant_reroll_pick r
         where r.pick_key=coalesce(c.item_key,c.id::text)
       )
  ) p
  order by p.theme_rank, case when p.type_slot <= 6 then 0 else 1 end, p.type_slot, random()
  limit v_uncommon_target
  on conflict do nothing;

  insert into merchant_reroll_pick(pick_key,item_name,item_type,item_rarity,price_gp,payload,note)
  select coalesce(p.item_key,p.id::text),p.item_name,p.item_type,p.item_rarity,p.price_gp,p.payload,
         'auto_reroll:'||v_theme||':rare'
  from (
    select c.*,
           row_number() over (
             partition by nullif(c.resolved_type,'')
             order by c.theme_rank,random()
           ) as type_slot
      from merchant_candidate_pool c
     where c.rarity_bucket='rare'
       and not exists (
         select 1 from merchant_reroll_pick r
         where r.pick_key=coalesce(c.item_key,c.id::text)
       )
  ) p
  order by p.theme_rank, case when p.type_slot <= 4 then 0 else 1 end, p.type_slot, random()
  limit v_rare_target
  on conflict do nothing;

  insert into merchant_reroll_pick(pick_key,item_name,item_type,item_rarity,price_gp,payload,note)
  select coalesce(c.item_key,c.id::text),c.item_name,c.item_type,c.item_rarity,c.price_gp,c.payload,
         'auto_reroll:'||v_theme||':fill'
    from merchant_candidate_pool c
   where c.rarity_bucket in ('low','uncommon','rare')
     and not exists (
       select 1 from merchant_reroll_pick r
       where r.pick_key=coalesce(c.item_key,c.id::text)
     )
   order by c.theme_rank,
            case c.rarity_bucket when 'low' then 0 when 'uncommon' then 1 else 2 end,
            random()
   limit greatest(0,v_total-(select count(*) from merchant_reroll_pick))
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
  v_identity text;
  v_theme text;
begin
  for v in
    select c.id,c.name,c.role,c.affiliation,c.storefront_title,c.storefront_tagline,c.tags
    from public.characters c
    where c.storefront_enabled is true
  loop
    v_identity := lower(concat_ws(' ',
      v.name,
      v.role,
      v.affiliation,
      v.storefront_title,
      v.storefront_tagline,
      array_to_string(coalesce(v.tags,'{}'::text[]),' ')
    ));
    v_theme := case
      when v_identity ~ '(smith|blacksmith|anvil|forge|hammer|armorer|armourer)' then 'smith'
      when v_identity ~ '(weapon|blade|sword|bowyer|fletcher|arms)' then 'weapons'
      when v_identity ~ '(potion|alch|apothecary|bomb|oil|poison|elixir)' then 'alchemy'
      when v_identity ~ '(leaf|herb|plant|root|botanist|gardener)' then 'herbalist'
      when v_identity ~ '(horse|stable|courier|mount|saddle)' then 'stable'
      when v_identity ~ '(cloak|cloth|tailor|seamstress|weaver|garb|robe)' then 'clothier'
      when v_identity ~ '(gem|jewel|ring|amulet|relic)' then 'jeweler'
      when v_identity ~ '(book|scribe|tome|arcane|wizard|mage|archivist|archive|map|scroll|lore|ritual|curio)' then 'arcanist'
      when v_identity ~ '(camel|caravan|trader|trade|wagon|peddler|market)' then 'caravan'
      else 'general'
    end;
    perform * from public.reroll_merchant_inventory_v2(v.id,v_theme,30);
  end loop;
end
$$;