-- Merchant-crafted alchemy stock v1
-- Finished potions, oils, poisons, elixirs, and related alchemy products are
-- decorated with recipe-derived duration, Save DC, and selected ingredients
-- when placed in merchant stock.

create or replace function private.merchant_alchemy_duration_v1(
  p_duration text,
  p_duration_pct numeric default 0,
  p_die_steps integer default 0
)
returns text
language plpgsql
immutable
set search_path = pg_catalog, public, private
as $$
declare
  v_text text := nullif(btrim(p_duration), '');
  v_match text[];
  v_count numeric;
  v_die_size integer;
  v_unit text;
  v_units text[] := array['round','minute','hour','day','week'];
  v_unit_seconds bigint[] := array[6,60,3600,86400,604800];
  v_index integer;
  v_seconds bigint;
  v_major bigint;
  v_minor bigint;
  v_scaled_dice integer;
begin
  if v_text is null then
    return 'Until used';
  end if;

  if v_text ~* '^(instant|instantaneous|until\b)' then
    return regexp_replace(v_text, '^instantaneous$', 'Instant', 'i');
  end if;

  v_match := regexp_match(v_text, '^(\d+)d(\d+)\s*(round|minute|hour|day|week)s?$', 'i');
  if v_match is not null then
    v_count := v_match[1]::numeric;
    v_die_size := v_match[2]::integer;
    v_unit := lower(v_match[3]);
    v_index := greatest(1, least(5, coalesce(array_position(v_units, v_unit), 1) + greatest(0, coalesce(p_die_steps, 0))));
    v_scaled_dice := greatest(1, ceil(v_count * (1 + greatest(0, coalesce(p_duration_pct, 0)) / 100.0) - 0.000000001)::integer);
    return v_scaled_dice::text || 'd' || v_die_size::text || ' ' || v_units[v_index] || case when v_scaled_dice = 1 then '' else 's' end;
  end if;

  v_match := regexp_match(v_text, '^(\d+(?:\.\d+)?)\s*(round|minute|hour|day|week)s?$', 'i');
  if v_match is null then
    return v_text;
  end if;

  v_count := v_match[1]::numeric;
  v_unit := lower(v_match[2]);
  v_index := greatest(1, least(5, coalesce(array_position(v_units, v_unit), 1) + greatest(0, coalesce(p_die_steps, 0))));
  v_seconds := greatest(1, round(v_count * v_unit_seconds[v_index] * (1 + greatest(0, coalesce(p_duration_pct, 0)) / 100.0))::bigint);

  if v_seconds >= 604800 then
    v_major := v_seconds / 604800;
    v_minor := (v_seconds % 604800) / 86400;
    return v_major::text || ' week' || case when v_major = 1 then '' else 's' end
      || case when v_minor > 0 then ' ' || v_minor::text || ' day' || case when v_minor = 1 then '' else 's' end else '' end;
  elsif v_seconds >= 86400 then
    v_major := v_seconds / 86400;
    v_minor := (v_seconds % 86400) / 3600;
    return v_major::text || ' day' || case when v_major = 1 then '' else 's' end
      || case when v_minor > 0 then ' ' || v_minor::text || ' hour' || case when v_minor = 1 then '' else 's' end else '' end;
  elsif v_seconds >= 3600 then
    v_major := v_seconds / 3600;
    v_minor := (v_seconds % 3600) / 60;
    return v_major::text || ' hour' || case when v_major = 1 then '' else 's' end
      || case when v_minor > 0 then ' ' || v_minor::text || ' minute' || case when v_minor = 1 then '' else 's' end else '' end;
  elsif v_seconds >= 60 then
    v_major := v_seconds / 60;
    v_minor := v_seconds % 60;
    return v_major::text || ' minute' || case when v_major = 1 then '' else 's' end
      || case when v_minor > 0 then ' ' || v_minor::text || ' second' || case when v_minor = 1 then '' else 's' end else '' end;
  end if;

  return v_seconds::text || ' second' || case when v_seconds = 1 then '' else 's' end;
end;
$$;

create or replace function private.merchant_alchemy_pick_ingredient_v1(
  p_family text,
  p_required_tags text[] default '{}'::text[]
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_roll numeric := random();
  v_target_rarity text;
  v_tags text[];
  v_row record;
begin
  -- Commercial stock is intentionally ordinary: 55% Common, 40% Uncommon,
  -- and 5% Rare for each core ingredient. Required theme tags can force the
  -- nearest available rarity (for example a Rare Stunning component).
  v_target_rarity := case
    when v_roll < 0.55 then 'Common'
    when v_roll < 0.95 then 'Uncommon'
    else 'Rare'
  end;

  select coalesce(array_agg(lower(tag)), '{}'::text[])
  into v_tags
  from unnest(coalesce(p_required_tags, '{}'::text[])) as tag;

  select
    ic.item_key,
    ic.item_name,
    ic.item_type,
    ic.item_rarity,
    ic.payload
  into v_row
  from public.items_catalog ic
  where ic.item_key like 'alchemy:ingredient:%'
    and lower(coalesce(ic.payload->'alchemy'->>'kind', '')) = 'ingredient'
    and ic.item_rarity = v_target_rarity
    and (
      coalesce(nullif(lower(p_family), ''), 'any') = 'any'
      or lower(coalesce(ic.payload->'alchemy'->>'family', '')) = lower(p_family)
    )
    and (
      cardinality(v_tags) = 0
      or ic.merchant_tags && v_tags
    )
  order by random()
  limit 1;

  if not found then
    select
      ic.item_key,
      ic.item_name,
      ic.item_type,
      ic.item_rarity,
      ic.payload
    into v_row
    from public.items_catalog ic
    where ic.item_key like 'alchemy:ingredient:%'
      and lower(coalesce(ic.payload->'alchemy'->>'kind', '')) = 'ingredient'
      and ic.item_rarity in ('Common', 'Uncommon', 'Rare')
      and (
        coalesce(nullif(lower(p_family), ''), 'any') = 'any'
        or lower(coalesce(ic.payload->'alchemy'->>'family', '')) = lower(p_family)
      )
      and (
        cardinality(v_tags) = 0
        or ic.merchant_tags && v_tags
      )
    order by
      case ic.item_rarity when 'Common' then 1 when 'Uncommon' then 2 when 'Rare' then 3 else 9 end,
      random()
    limit 1;
  end if;

  if not found then
    return null;
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'item_key', v_row.item_key,
    'name', v_row.item_name,
    'item_type', v_row.item_type,
    'rarity', v_row.item_rarity,
    'family', v_row.payload->'alchemy'->>'family',
    'family_label', v_row.payload->'alchemy'->>'familyLabel',
    'bonuses', coalesce(v_row.payload->'alchemy'->'bonuses', '{}'::jsonb),
    'brew_impact', v_row.payload->'alchemy'->>'brewImpact',
    'brew_tags', coalesce(v_row.payload->'alchemy'->'brewTags', '[]'::jsonb),
    'physical_description', v_row.payload->'alchemy'->>'physicalDescription'
  ));
end;
$$;
