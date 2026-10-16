-- 2026-10-16 campaign item-pool controls, evolving relic repair, and merchant rebalance.
-- Idempotent final-state migration. Keeps merchant selection server-authoritative.
BEGIN;

CREATE TABLE IF NOT EXISTS public.campaign_item_pool_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  future_tech_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_by uuid NULL
);

INSERT INTO public.campaign_item_pool_settings(id, future_tech_enabled)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.campaign_item_pool_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='campaign_item_pool_settings'
      AND policyname='campaign_item_pool_settings_read'
  ) THEN
    CREATE POLICY campaign_item_pool_settings_read
      ON public.campaign_item_pool_settings
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END
$$;

GRANT SELECT ON public.campaign_item_pool_settings TO authenticated;

CREATE OR REPLACE FUNCTION private.item_copy_rule_text_v1(p_node jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO pg_catalog, public, private
AS $$
DECLARE
  v_kind text;
  v_title text;
  v_body text;
BEGIN
  IF p_node IS NULL OR p_node = 'null'::jsonb THEN RETURN ''; END IF;
  v_kind := jsonb_typeof(p_node);
  IF v_kind = 'string' THEN
    RETURN p_node #>> '{}';
  ELSIF v_kind IN ('number','boolean') THEN
    RETURN p_node::text;
  ELSIF v_kind = 'array' THEN
    SELECT string_agg(nullif(private.item_copy_rule_text_v1(value), ''), E'\n\n')
      INTO v_body
      FROM jsonb_array_elements(p_node);
    RETURN coalesce(v_body, '');
  ELSIF v_kind = 'object' THEN
    v_title := nullif(trim(coalesce(p_node->>'name', '')), '');
    IF p_node ? 'entries' THEN
      v_body := private.item_copy_rule_text_v1(p_node->'entries');
    ELSIF p_node ? 'items' THEN
      v_body := private.item_copy_rule_text_v1(p_node->'items');
    ELSIF p_node ? 'entry' THEN
      v_body := private.item_copy_rule_text_v1(p_node->'entry');
    ELSE
      v_body := '';
    END IF;
    RETURN trim(both E'\n' from concat_ws(E'\n\n', v_title, nullif(v_body, '')));
  END IF;
  RETURN '';
END
$$;

-- Repair source _copy chains (notably Dormant -> Awakened -> Exalted evolving relics).
-- Repeating the update resolves chained copies without requiring source-specific names.
DO $$
DECLARE
  v_pass integer;
BEGIN
  FOR v_pass IN 1..4 LOOP
    UPDATE public.items_catalog child
       SET item_type = coalesce(base.item_type, child.item_type),
           item_rarity = coalesce(nullif(base.item_rarity,''), child.item_rarity),
           price_gp = CASE
             WHEN coalesce(base.price_gp,0) > 0 THEN base.price_gp
             ELSE child.price_gp
           END,
           payload = (
             coalesce(base.payload, '{}'::jsonb)
             || coalesce(child.payload, '{}'::jsonb)
             || jsonb_strip_nulls(jsonb_build_object(
               'item_key', child.item_key,
               'item_id', coalesce(child.payload->>'item_id', child.item_key),
               'item_name', child.item_name,
               'name', child.item_name,
               'item_type', coalesce(base.item_type, child.item_type),
               'uiType', coalesce(base.payload->>'uiType', base.item_type, child.item_type),
               'item_rarity', coalesce(nullif(base.item_rarity,''), child.item_rarity),
               'rarity', coalesce(base.payload->>'rarity', nullif(base.item_rarity,''), child.item_rarity),
               'price_gp', CASE WHEN coalesce(base.price_gp,0)>0 THEN base.price_gp ELSE child.price_gp END,
               'item_description', trim(both E'\n' from concat_ws(
                 E'\n\n',
                 nullif(coalesce(base.payload->>'item_description', base.payload->>'rulesShort', ''), ''),
                 nullif(private.item_copy_rule_text_v1(child.payload #> '{_copy,_mod,entries}'), '')
               ))
             ))
           )
      FROM public.items_catalog base
     WHERE child.payload ? '_copy'
       AND lower(base.item_name) = lower(child.payload #>> '{_copy,name}')
       AND upper(coalesce(base.payload->>'source','')) = upper(coalesce(child.payload #>> '{_copy,source}', child.payload->>'source',''));
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION private.item_is_future_tech_v1(
  p_name text,
  p_source text,
  p_type text,
  p_payload jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO pg_catalog, public, private
AS $$
DECLARE
  v_name text := lower(coalesce(p_name, ''));
  v_type text := lower(coalesce(p_type, p_payload->>'item_type', p_payload->>'uiType', ''));
  v_age text := lower(coalesce(p_payload->>'age', p_payload->>'age_category', p_payload->>'age_group', ''));
  v_has_af boolean := false;
BEGIN
  IF v_type = 'future' THEN RETURN true; END IF;
  IF v_age IN ('futuristic','renaissance','modern','contemporary','industrial','victorian') THEN RETURN true; END IF;

  IF jsonb_typeof(coalesce(p_payload->'property', '[]'::jsonb)) = 'array' THEN
    SELECT exists (
      SELECT 1
      FROM jsonb_array_elements_text(coalesce(p_payload->'property', '[]'::jsonb)) value
      WHERE upper(split_part(value, '|', 1)) = 'AF'
    ) INTO v_has_af;
    IF v_has_af THEN RETURN true; END IF;
  END IF;

  IF v_name ~ '(pistol|rifle|musket|revolver|firearm|shotgun|smg|carbine)' THEN RETURN true; END IF;
  IF v_name ~ '(antimatter|laser|grenade launcher|fragmentation grenade|concussion grenade|sleep grenade|smoke grenade|needler pistol|paralysis pistol|powered armor|robot controller|antigravity belt|spaceship trinket|energy cell)' THEN RETURN true; END IF;
  RETURN false;
END
$$;

CREATE OR REPLACE FUNCTION private.item_is_setting_specific_junk_v1(
  p_name text,
  p_type text,
  p_rarity text,
  p_price_gp numeric
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO pg_catalog, public, private
AS $$
  SELECT
    coalesce(p_name, '') ~* 'trinket'
    AND lower(coalesce(p_type, '')) IN ('adventuring gear','gear')
    AND lower(coalesce(p_rarity, 'mundane')) IN ('','none','mundane','common')
    AND coalesce(p_price_gp, 0) <= 1;
$$;

CREATE OR REPLACE FUNCTION private.item_is_progression_state_variant_v1(p_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO pg_catalog, public, private
AS $$
  SELECT coalesce(p_name, '') ~* '\((dormant|awakened|exalted)\)\s*$';
$$;

CREATE OR REPLACE FUNCTION private.item_campaign_loot_eligible_v1(
  p_name text,
  p_source text,
  p_type text,
  p_rarity text,
  p_price_gp numeric,
  p_payload jsonb,
  p_future_enabled boolean
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO pg_catalog, public, private
AS $$
  SELECT
    NOT private.item_is_setting_specific_junk_v1(p_name, p_type, p_rarity, p_price_gp)
    AND NOT private.item_is_progression_state_variant_v1(p_name)
    AND (
      coalesce(p_future_enabled, false)
      OR NOT private.item_is_future_tech_v1(p_name, p_source, p_type, coalesce(p_payload, '{}'::jsonb))
    );
$$;

CREATE OR REPLACE FUNCTION private.merchant_theme_from_identity_v1(
  p_name text,
  p_role text,
  p_affiliation text,
  p_title text,
  p_tagline text,
  p_tags text[]
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO pg_catalog, public, private
AS $$
DECLARE
  v_tags text[] := array(SELECT lower(value) FROM unnest(coalesce(p_tags, '{}'::text[])) value);
  v_identity text := lower(concat_ws(' ',p_name,p_role,p_affiliation,p_title,p_tagline,array_to_string(coalesce(p_tags,'{}'::text[]),' ')));
BEGIN
  IF 'herbalist' = any(v_tags) THEN RETURN 'herbalist'; END IF;
  IF 'smith' = any(v_tags) THEN RETURN 'smith'; END IF;
  IF 'weapons' = any(v_tags) THEN RETURN 'weapons'; END IF;
  IF 'jeweler' = any(v_tags) THEN RETURN 'jeweler'; END IF;
  IF 'arcanist' = any(v_tags) THEN RETURN 'arcanist'; END IF;
  IF 'alchemy' = any(v_tags) OR EXISTS (SELECT 1 FROM unnest(v_tags) value WHERE value LIKE 'profession:alchemy%') THEN RETURN 'alchemy'; END IF;
  IF 'stable' = any(v_tags) THEN RETURN 'stable'; END IF;
  IF 'caravan' = any(v_tags) THEN RETURN 'caravan'; END IF;
  IF 'clothier' = any(v_tags) THEN RETURN 'clothier'; END IF;
  IF 'general' = any(v_tags) THEN RETURN 'general'; END IF;

  IF v_identity ~ '(smith|blacksmith|anvil|forge|hammer|armorer|armourer)' THEN RETURN 'smith'; END IF;
  IF v_identity ~ '(weapon|blade|sword|bowyer|fletcher|arms)' THEN RETURN 'weapons'; END IF;
  IF v_identity ~ '(potion|alch|apothecary|bomb|oil|poison|elixir)' THEN RETURN 'alchemy'; END IF;
  IF v_identity ~ '(leaf|herb|plant|root|oakshade|botanist|gardener)' THEN RETURN 'herbalist'; END IF;
  IF v_identity ~ '(camel|caravan|trader|trade|wagon|peddler|market)' THEN RETURN 'caravan'; END IF;
  IF v_identity ~ '(horse|stable|courier|mount|saddle)' THEN RETURN 'stable'; END IF;
  IF v_identity ~ '(cloak|cloth|tailor|seamstress|weaver|garb|robe)' THEN RETURN 'clothier'; END IF;
  IF v_identity ~ '(^|[^a-z])(gem|jewel|jewelry|ring|rings|amulet|amulets|relic|relics)([^a-z]|$)' THEN RETURN 'jeweler'; END IF;
  IF v_identity ~ '(book|scribe|tome|arcane|wizard|mage|archivist|archive|map|scroll|lore|ritual|curio)' THEN RETURN 'arcanist'; END IF;
  RETURN 'general';
END
$$;

CREATE OR REPLACE FUNCTION private.merchant_item_theme_eligible_v2(
  p_theme text,
  p_item_name text,
  p_item_type text,
  p_tags text[]
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO pg_catalog, public, private
AS $$
DECLARE
  v_theme text := lower(coalesce(nullif(p_theme,''),'general'));
  v_type text := coalesce(p_item_type,'');
  v_name text := lower(coalesce(p_item_name,''));
  v_tags text[] := coalesce(p_tags,'{}'::text[]);
  v_utility_wondrous boolean :=
    v_type='Wondrous Item'
    AND v_name ~ '(bag|boots?|rope|cloak|lantern|compass|map|saddle|horseshoes?|tent|bottle|broom|carpet|quiver|pack|gloves?|goggles|helm|hat)';
BEGIN
  CASE v_theme
    WHEN 'smith' THEN
      RETURN v_type IN ('Melee Weapon','Ranged Weapon','Armor','Shield','Ammunition','Ore / Metal','Material','Tools','Explosives','Future');
    WHEN 'weapons' THEN
      RETURN v_type IN ('Melee Weapon','Ranged Weapon','Ammunition','Explosives','Future');
    WHEN 'alchemy' THEN
      RETURN v_type IN ('Plant / Herb','Reagent / Catalyst','Alchemy Modifier','Catalyst','Monster Part','Potion','Elixir','Oil','Poison','Bomb','Potions & Poisons');
    WHEN 'herbalist' THEN
      RETURN v_type IN ('Plant / Herb','Reagent / Catalyst','Catalyst','Potion','Elixir','Oil','Poison','Potions & Poisons');
    WHEN 'arcanist' THEN
      RETURN v_type IN ('Scroll & Focus','Rods & Wands')
        OR (v_type='Wondrous Item' AND v_tags && array['arcanist','scribe','scroll','focus']::text[]);
    WHEN 'jeweler' THEN
      RETURN v_type IN ('Wondrous Item','Trade Goods') AND v_tags && array['jeweler','gem','relic']::text[];
    WHEN 'clothier' THEN
      RETURN v_type IN ('Adventuring Gear','Armor','Wondrous Item') AND v_tags && array['clothier','tailor']::text[];
    WHEN 'stable' THEN
      RETURN v_type IN ('Adventuring Gear','Tools','Trade Goods','Vehicles & Structures') AND v_tags && array['stable']::text[];
    WHEN 'caravan' THEN
      RETURN v_type IN ('Adventuring Gear','Tools','Trade Goods','Vehicles & Structures','Ammunition') OR v_utility_wondrous;
    ELSE
      RETURN v_type IN ('Adventuring Gear','Tools','Trade Goods','Ammunition') OR v_utility_wondrous;
  END CASE;
END
$$;

CREATE OR REPLACE FUNCTION public.reroll_merchant_inventory_v2(
  p_merchant_id uuid,
  p_theme text DEFAULT 'general'::text,
  p_count integer DEFAULT NULL::integer
)
RETURNS TABLE(inserted_count integer, theme text, merchant_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public, private, auth
AS $$
DECLARE
  v_theme text := coalesce(nullif(lower(p_theme), ''), 'general');
  v_total integer := least(greatest(coalesce(p_count, 28 + floor(random() * 5)::integer), 12), 48);
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_future_enabled boolean := false;
  v_recipe_target integer := 0;
  v_item_target integer;
  v_mundane_target integer;
  v_uncommon_target integer;
  v_rare_target integer;
  v_high_target integer;
  v_recipe_tags text[];
BEGIN
  IF v_uid IS NULL THEN
    v_is_admin := true;
  ELSE
    SELECT coalesce(up.role='admin',false)
      INTO v_is_admin
      FROM public.user_profiles up
      WHERE up.id=v_uid;
  END IF;
  IF NOT coalesce(v_is_admin,false) THEN RAISE EXCEPTION 'Only admins can reroll merchant stock'; END IF;

  SELECT coalesce(s.future_tech_enabled,false)
    INTO v_future_enabled
    FROM public.campaign_item_pool_settings s
    WHERE s.id=1;

  v_recipe_tags := CASE v_theme
    WHEN 'alchemy' THEN array['alchemy','alchemist']::text[]
    WHEN 'herbalist' THEN array['herbalist','potions','elixirs','oils','poisons']::text[]
    ELSE '{}'::text[]
  END;
  v_recipe_target := CASE WHEN v_theme IN ('alchemy','herbalist') THEN 1 ELSE 0 END;
  v_item_target := greatest(0,v_total-v_recipe_target);

  -- Requested merchant shelf mix: 15% mundane, 50% uncommon, 25% rare,
  -- 10% Very Rare/Legendary/Artifact. Integer rounding is reconciled into Rare.
  v_mundane_target := greatest(0,round(v_item_target*0.15)::integer);
  v_uncommon_target := greatest(0,round(v_item_target*0.50)::integer);
  v_high_target := greatest(0,round(v_item_target*0.10)::integer);
  v_rare_target := greatest(0,v_item_target-v_mundane_target-v_uncommon_target-v_high_target);

  DROP TABLE IF EXISTS pg_temp.merchant_reroll_pick;
  CREATE TEMPORARY TABLE merchant_reroll_pick (
    pick_key text PRIMARY KEY,
    item_name text NOT NULL,
    item_type text,
    item_rarity text,
    price_gp numeric NOT NULL,
    payload jsonb NOT NULL,
    note text NOT NULL
  ) ON COMMIT DROP;

  DROP TABLE IF EXISTS pg_temp.merchant_candidate_pool;
  CREATE TEMPORARY TABLE merchant_candidate_pool ON COMMIT DROP AS
  SELECT
    ic.*,
    coalesce(ic.item_type,ic.payload->>'item_type',ic.payload->>'uiType','') AS resolved_type,
    CASE
      WHEN lower(coalesce(ic.item_rarity,'')) IN ('','none','mundane','common') THEN 'mundane'
      WHEN lower(coalesce(ic.item_rarity,''))='uncommon' THEN 'uncommon'
      WHEN lower(coalesce(ic.item_rarity,''))='rare' THEN 'rare'
      WHEN lower(replace(coalesce(ic.item_rarity,''),'-',' ')) IN ('very rare','veryrare','legendary','artifact') THEN 'high'
      ELSE 'other'
    END AS rarity_bucket
  FROM public.items_catalog ic
  WHERE lower(coalesce(ic.item_type,ic.payload->>'item_type','')) <> 'recipe'
    AND private.item_campaign_loot_eligible_v1(
      ic.item_name,
      coalesce(ic.payload->>'source',''),
      coalesce(ic.item_type,ic.payload->>'item_type',ic.payload->>'uiType',''),
      ic.item_rarity,
      ic.price_gp,
      ic.payload,
      v_future_enabled
    )
    AND private.merchant_item_theme_eligible_v2(
      v_theme,
      ic.item_name,
      coalesce(ic.item_type,ic.payload->>'item_type',ic.payload->>'uiType',''),
      ic.merchant_tags
    );

  IF v_recipe_target > 0 THEN
    INSERT INTO merchant_reroll_pick(pick_key,item_name,item_type,item_rarity,price_gp,payload,note)
    SELECT coalesce(ic.item_key,ic.id::text),ic.item_name,ic.item_type,ic.item_rarity,ic.price_gp,ic.payload,'auto_reroll:'||v_theme||':recipe'
    FROM public.items_catalog ic
    WHERE lower(coalesce(ic.item_type,ic.payload->>'item_type',''))='recipe'
      AND lower(coalesce(ic.item_rarity,'mundane')) IN ('mundane','common','uncommon','rare')
      AND ic.merchant_tags && v_recipe_tags
      AND private.item_campaign_loot_eligible_v1(
        ic.item_name,coalesce(ic.payload->>'source',''),coalesce(ic.item_type,ic.payload->>'item_type',''),
        ic.item_rarity,ic.price_gp,ic.payload,v_future_enabled
      )
    ORDER BY random()
    LIMIT v_recipe_target
    ON CONFLICT DO NOTHING;
  END IF;

  INSERT INTO merchant_reroll_pick
  SELECT coalesce(p.item_key,p.id::text),p.item_name,p.item_type,p.item_rarity,p.price_gp,p.payload,'auto_reroll:'||v_theme||':mundane'
  FROM (
    SELECT c.*,
           row_number() OVER (
             PARTITION BY nullif(c.resolved_type,'')
             ORDER BY random()
           ) AS type_slot
    FROM merchant_candidate_pool c
    WHERE c.rarity_bucket='mundane'
  ) p
  ORDER BY p.type_slot, random()
  LIMIT v_mundane_target
  ON CONFLICT DO NOTHING;

  INSERT INTO merchant_reroll_pick
  SELECT coalesce(p.item_key,p.id::text),p.item_name,p.item_type,p.item_rarity,p.price_gp,p.payload,'auto_reroll:'||v_theme||':uncommon'
  FROM (
    SELECT c.*,
           row_number() OVER (
             PARTITION BY nullif(c.resolved_type,'')
             ORDER BY random()
           ) AS type_slot
    FROM merchant_candidate_pool c
    WHERE c.rarity_bucket='uncommon'
      AND NOT EXISTS (SELECT 1 FROM merchant_reroll_pick r WHERE r.pick_key=coalesce(c.item_key,c.id::text))
  ) p
  ORDER BY p.type_slot, random()
  LIMIT v_uncommon_target
  ON CONFLICT DO NOTHING;

  INSERT INTO merchant_reroll_pick
  SELECT coalesce(p.item_key,p.id::text),p.item_name,p.item_type,p.item_rarity,p.price_gp,p.payload,'auto_reroll:'||v_theme||':rare'
  FROM (
    SELECT c.*,
           row_number() OVER (
             PARTITION BY nullif(c.resolved_type,'')
             ORDER BY random()
           ) AS type_slot
    FROM merchant_candidate_pool c
    WHERE c.rarity_bucket='rare'
      AND NOT EXISTS (SELECT 1 FROM merchant_reroll_pick r WHERE r.pick_key=coalesce(c.item_key,c.id::text))
  ) p
  ORDER BY p.type_slot, random()
  LIMIT v_rare_target
  ON CONFLICT DO NOTHING;

  INSERT INTO merchant_reroll_pick
  SELECT coalesce(p.item_key,p.id::text),p.item_name,p.item_type,p.item_rarity,p.price_gp,p.payload,'auto_reroll:'||v_theme||':high'
  FROM (
    SELECT c.*,
           row_number() OVER (
             PARTITION BY nullif(c.resolved_type,'')
             ORDER BY random()
           ) AS type_slot
    FROM merchant_candidate_pool c
    WHERE c.rarity_bucket='high'
      AND NOT EXISTS (SELECT 1 FROM merchant_reroll_pick r WHERE r.pick_key=coalesce(c.item_key,c.id::text))
  ) p
  ORDER BY p.type_slot, random()
  LIMIT v_high_target
  ON CONFLICT DO NOTHING;

  INSERT INTO merchant_reroll_pick
  SELECT coalesce(c.item_key,c.id::text),c.item_name,c.item_type,c.item_rarity,c.price_gp,c.payload,'auto_reroll:'||v_theme||':fill'
  FROM merchant_candidate_pool c
  WHERE c.rarity_bucket IN ('mundane','uncommon','rare','high')
    AND NOT EXISTS (SELECT 1 FROM merchant_reroll_pick r WHERE r.pick_key=coalesce(c.item_key,c.id::text))
  ORDER BY random()
  LIMIT greatest(0,v_total-(SELECT count(*) FROM merchant_reroll_pick))
  ON CONFLICT DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM merchant_reroll_pick) THEN
    RAISE EXCEPTION 'No eligible stock exists for merchant theme %',v_theme;
  END IF;

  DELETE FROM public.character_stock WHERE character_id=p_merchant_id;

  INSERT INTO public.character_stock(character_id,display_name,price_gp,qty,card_payload,item_id,note)
  SELECT
    p_merchant_id,
    p.item_name,
    p.price_gp,
    1,
    private.merchant_alchemy_crafted_payload_v1(
      coalesce(p.payload,'{}'::jsonb)
      || jsonb_strip_nulls(jsonb_build_object(
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
  FROM merchant_reroll_pick p;

  SELECT count(*)::integer INTO inserted_count FROM merchant_reroll_pick;
  theme := v_theme;
  merchant_id := p_merchant_id;
  RETURN NEXT;
END
$$;

CREATE OR REPLACE FUNCTION public.set_campaign_future_tech_enabled_v1(p_enabled boolean)
RETURNS TABLE(future_tech_enabled boolean, rerolled_merchants integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public, private, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_character record;
  v_theme text;
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    v_is_admin := true;
  ELSE
    SELECT coalesce(up.role='admin',false)
      INTO v_is_admin
      FROM public.user_profiles up
      WHERE up.id=v_uid;
  END IF;
  IF NOT coalesce(v_is_admin,false) THEN RAISE EXCEPTION 'Only admins can change the campaign item pool'; END IF;

  INSERT INTO public.campaign_item_pool_settings(id,future_tech_enabled,updated_at,updated_by)
  VALUES (1,coalesce(p_enabled,false),timezone('utc',now()),v_uid)
  ON CONFLICT (id) DO UPDATE
    SET future_tech_enabled=excluded.future_tech_enabled,
        updated_at=excluded.updated_at,
        updated_by=excluded.updated_by;

  FOR v_character IN
    SELECT id,name,role,affiliation,storefront_title,storefront_tagline,tags
    FROM public.characters
    WHERE storefront_enabled=true
    ORDER BY name
  LOOP
    v_theme := private.merchant_theme_from_identity_v1(
      v_character.name,v_character.role,v_character.affiliation,
      v_character.storefront_title,v_character.storefront_tagline,v_character.tags
    );
    PERFORM * FROM public.reroll_merchant_inventory_v2(v_character.id,v_theme,30);
    v_count := v_count+1;
  END LOOP;

  future_tech_enabled := coalesce(p_enabled,false);
  rerolled_merchants := v_count;
  RETURN NEXT;
END
$$;

REVOKE ALL ON FUNCTION public.reroll_merchant_inventory_v2(uuid,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reroll_merchant_inventory_v2(uuid,text,integer) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_campaign_future_tech_enabled_v1(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_campaign_future_tech_enabled_v1(boolean) TO authenticated, service_role;

-- Rebuild current storefronts under the final constraints immediately.
DO $$
DECLARE
  v record;
  v_theme text;
BEGIN
  FOR v IN
    SELECT id,name,role,affiliation,storefront_title,storefront_tagline,tags
    FROM public.characters
    WHERE storefront_enabled=true
    ORDER BY name
  LOOP
    v_theme := private.merchant_theme_from_identity_v1(v.name,v.role,v.affiliation,v.storefront_title,v.storefront_tagline,v.tags);
    PERFORM * FROM public.reroll_merchant_inventory_v2(v.id,v_theme,30);
  END LOOP;
END
$$;

COMMIT;
