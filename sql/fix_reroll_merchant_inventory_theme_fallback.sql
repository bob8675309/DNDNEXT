-- Fix: Merchant reroll returns 0 stock when items_catalog.merchant_tags are missing or too sparse.
-- This replaces reroll_merchant_inventory_v2 with a single signature and adds a theme-matching fallback
-- (merchant_tags OR heuristic on item_type/item_name) and a final general fallback so rerolls always restock.

BEGIN;

-- Remove any overloaded variants to avoid ambiguous RPC resolution
DROP FUNCTION IF EXISTS public.reroll_merchant_inventory_v2(uuid, text);
DROP FUNCTION IF EXISTS public.reroll_merchant_inventory_v2(uuid, text, integer);

CREATE OR REPLACE FUNCTION public.reroll_merchant_inventory_v2(
  p_merchant_id uuid,
  p_theme text DEFAULT 'general',
  p_count integer DEFAULT NULL
)
RETURNS TABLE(inserted_count integer, theme text, merchant_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_theme text := COALESCE(NULLIF(p_theme, ''), 'general');
  v_total int;
  v_uncommon int;
  v_rare int;
  v_veryrare int;
  v_inserted int := 0;
  v_ins int;

  -- theme matching helpers
  v_type text;
  v_name text;
  v_is_theme_match boolean;
BEGIN
  -- target count: default to 12-20
  v_total := COALESCE(p_count, 12 + floor(random() * 9)::int);
  IF v_total < 1 THEN v_total := 12; END IF;

  -- rarity distribution: mostly Uncommon/Rare, occasional Very Rare
  v_uncommon := GREATEST(0, round(v_total * 0.55)::int);
  v_rare := GREATEST(0, round(v_total * 0.35)::int);
  v_veryrare := GREATEST(0, v_total - v_uncommon - v_rare);

  -- Clear existing stock for this merchant
  DELETE FROM public.character_stock WHERE character_id = p_merchant_id;

  -- Ensure merchant profile row exists / update theme
  INSERT INTO public.merchant_profiles (merchant_id, theme)
  VALUES (p_merchant_id, v_theme)
  ON CONFLICT (merchant_id) DO UPDATE SET theme = EXCLUDED.theme;

  -----------------------------------------------------------------------------
  -- Insert helper: pick N items for a given rarity with theme match first,
  -- then fall back to general pool for any remaining.
  -----------------------------------------------------------------------------
  FOR v_type, v_ins IN
    SELECT 'Uncommon'::text, v_uncommon
    UNION ALL SELECT 'Rare'::text, v_rare
    UNION ALL SELECT 'Very Rare'::text, v_veryrare
  LOOP
    IF v_ins <= 0 THEN
      CONTINUE;
    END IF;

    -- 1) Theme-first pass
    WITH candidates AS (
      SELECT
        id,
        payload,
        item_name,
        item_type,
        rarity
      FROM public.items_catalog
      WHERE (rarity = v_type)
        AND (
          v_theme = 'general'
          OR (merchant_tags IS NOT NULL AND merchant_tags @> ARRAY[v_theme])
          OR (
            -- Heuristic fallback if tags are missing/sparse
            (
              CASE
                WHEN v_theme = 'weapons' THEN
                  lower(coalesce(item_type,'')) LIKE '%weapon%'
                  OR lower(coalesce(item_name,'')) LIKE ANY (ARRAY['%sword%','%axe%','%bow%','%dagger%','%mace%','%spear%','%crossbow%','%halberd%'])

                WHEN v_theme = 'smith' THEN
                  lower(coalesce(item_type,'')) LIKE ANY (ARRAY['%weapon%','%armor%','%shield%'])
                  OR lower(coalesce(item_name,'')) LIKE ANY (ARRAY['%anvil%','%hammer%','%tongs%','%ingot%','%steel%','%iron%','%mithril%','%adamant%'])

                WHEN v_theme = 'alchemy' THEN
                  lower(coalesce(item_type,'')) LIKE ANY (ARRAY['%potion%','%poison%','%consum%','%elixir%'])
                  OR lower(coalesce(item_name,'')) LIKE ANY (ARRAY['%potion%','%elixir%','%tincture%','%vial%','%serum%','%poison%','%alchem%'])

                WHEN v_theme = 'herbalist' THEN
                  lower(coalesce(item_name,'')) LIKE ANY (ARRAY['%herb%','%root%','%leaf%','%flower%','%mushroom%','%poultice%','%salve%','%antitoxin%'])
                  OR lower(coalesce(item_type,'')) LIKE ANY (ARRAY['%potion%','%consum%'])

                WHEN v_theme = 'arcanist' THEN
                  lower(coalesce(item_type,'')) LIKE ANY (ARRAY['%wand%','%staff%','%scroll%','%spellbook%','%rod%','%wondrous%'])
                  OR lower(coalesce(item_name,'')) LIKE ANY (ARRAY['%scroll%','%wand%','%staff%','%spell%','%arcane%','%rune%'])

                WHEN v_theme = 'jeweler' THEN
                  lower(coalesce(item_type,'')) LIKE ANY (ARRAY['%ring%','%wondrous%'])
                  OR lower(coalesce(item_name,'')) LIKE ANY (ARRAY['%ring%','%amulet%','%necklace%','%gem%','%jewel%','%bracelet%','%brooch%'])

                WHEN v_theme = 'clothier' THEN
                  lower(coalesce(item_name,'')) LIKE ANY (ARRAY['%cloak%','%robe%','%garb%','%silk%','%linen%','%leather%','%boots%','%gloves%','%hat%','%hood%'])

                WHEN v_theme = 'stable' THEN
                  lower(coalesce(item_type,'')) LIKE ANY (ARRAY['%mount%','%vehicle%','%gear%','%adventuring%'])
                  OR lower(coalesce(item_name,'')) LIKE ANY (ARRAY['%saddle%','%bridle%','%reins%','%horse%','%mule%','%camel%','%mount%','%riding%','%stirr%','%hoof%','%feed%','%harness%'])

                WHEN v_theme = 'caravan' THEN
                  lower(coalesce(item_type,'')) LIKE ANY (ARRAY['%gear%','%adventuring%','%tool%','%vehicle%','%mount%'])
                  OR lower(coalesce(item_name,'')) LIKE ANY (ARRAY['%tent%','%bedroll%','%wagon%','%cart%','%pack%','%backpack%','%rations%','%lantern%','%rope%','%travel%','%compass%','%map%','%torch%'])

                ELSE true
              END
            )
          )
        )
      ORDER BY random()
      LIMIT v_ins
    )
    INSERT INTO public.character_stock (character_id, item_id, qty, card_payload, price_cp, notes)
    SELECT
      p_merchant_id,
      (payload->>'item_id')::text,
      1,
      payload,
      COALESCE((payload->>'value_cp')::int, (payload->>'price_cp')::int, 0),
      'auto_reroll:' || v_theme
    FROM candidates;

    GET DIAGNOSTICS v_ins = ROW_COUNT;
    v_inserted := v_inserted + v_ins;

    -- 2) If the theme pool was sparse, fill remaining from general pool for this rarity
    IF v_ins < (SELECT CASE v_type WHEN 'Uncommon' THEN v_uncommon WHEN 'Rare' THEN v_rare ELSE v_veryrare END) THEN
      WITH fill AS (
        SELECT
          id,
          payload
        FROM public.items_catalog
        WHERE (rarity = v_type)
          AND NOT EXISTS (
            SELECT 1
            FROM public.character_stock cs
            WHERE cs.character_id = p_merchant_id
              AND cs.item_id = (public.items_catalog.payload->>'item_id')::text
          )
        ORDER BY random()
        LIMIT ((SELECT CASE v_type WHEN 'Uncommon' THEN v_uncommon WHEN 'Rare' THEN v_rare ELSE v_veryrare END) - v_ins)
      )
      INSERT INTO public.character_stock (character_id, item_id, qty, card_payload, price_cp, notes)
      SELECT
        p_merchant_id,
        (payload->>'item_id')::text,
        1,
        payload,
        COALESCE((payload->>'value_cp')::int, (payload->>'price_cp')::int, 0),
        'auto_reroll:fallback_general'
      FROM fill;

      GET DIAGNOSTICS v_ins = ROW_COUNT;
      v_inserted := v_inserted + v_ins;
    END IF;
  END LOOP;

  -- Final safety: if still empty for any reason, seed from any Uncommon/Rare
  IF NOT EXISTS (SELECT 1 FROM public.character_stock WHERE character_id = p_merchant_id) THEN
    WITH safety AS (
      SELECT payload
      FROM public.items_catalog
      WHERE rarity IN ('Uncommon','Rare')
      ORDER BY random()
      LIMIT v_total
    )
    INSERT INTO public.character_stock (character_id, item_id, qty, card_payload, price_cp, notes)
    SELECT
      p_merchant_id,
      (payload->>'item_id')::text,
      1,
      payload,
      COALESCE((payload->>'value_cp')::int, (payload->>'price_cp')::int, 0),
      'auto_reroll:safety'
    FROM safety;

    GET DIAGNOSTICS v_ins = ROW_COUNT;
    v_inserted := v_inserted + v_ins;
  END IF;

  RETURN QUERY SELECT v_inserted, v_theme, p_merchant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reroll_merchant_inventory_v2(uuid, text, integer) TO anon, authenticated;

COMMIT;
