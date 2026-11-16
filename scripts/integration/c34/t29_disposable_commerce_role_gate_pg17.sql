-- T29 REVIEW-ONLY: generated from hosted pg_get_functiondef SELECT-only,
-- four EXACT authorization guard edits, no original-buyer or world-map edits.
-- Applies only AFTER existing T26/T27/T28 tests on disposable PG17/GoTrue.
-- NEVER apply this SQL to hosted/production, including via Supabase MCP.
\if :{?T29_DISPOSABLE_LOCAL_CONFIRMED}
\else
 \echo 'REFUSE T29: signed disposable local flag missing'
 SELECT 1/0;
\endif
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $guard$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('private.test_admins') IS NULL
 OR to_regclass('private.t28_wallet_probe') IS NULL
 OR to_regclass('public.character_stock') IS NULL
 OR to_regclass('public.player_wallets') IS NULL
 OR to_regprocedure('public.buy_from_merchant(uuid,uuid,integer)') IS NULL
 OR md5(pg_get_functiondef('public.buy_from_merchant(uuid,uuid,integer)'::regprocedure))
 <> '1dbe8c24c4c718396d7256f6f7465354'
 THEN RAISE EXCEPTION 'T29 REFUSE: not exact original-buyer disposable T28 fixture'; END IF;
END $guard$;
CREATE TABLE IF NOT EXISTS public.user_profiles(
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 role text NOT NULL DEFAULT 'player'
);
REVOKE ALL ON public.user_profiles FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION private.current_user_can_manage_commerce_v1()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog','public','auth'
AS $commerce$
 SELECT auth.uid() IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.user_profiles p WHERE p.id=auth.uid()
  AND p.role IN ('admin','gm','dm')
 );
$commerce$;
REVOKE ALL ON FUNCTION private.current_user_can_manage_commerce_v1()
 FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_can_manage_commerce_v1() TO authenticated;
-- Synthetic C34 reduced-catalog adapters only; existing source helpers
-- (if present) remain untouched. Real item rules are a separate release gate.
ALTER TABLE public.character_stock ADD COLUMN IF NOT EXISTS note text;
CREATE TABLE IF NOT EXISTS public.campaign_item_pool_settings(
 id integer PRIMARY KEY,future_tech_enabled boolean NOT NULL DEFAULT false
);
INSERT INTO public.campaign_item_pool_settings(id,future_tech_enabled)
 VALUES(1,false) ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS public.items_catalog(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),item_key text,item_name text,
 item_type text,item_rarity text,price_gp numeric,
 payload jsonb DEFAULT '{}'::jsonb,merchant_tags text[] DEFAULT ARRAY[]::text[]
);
-- Original Forge materializer already installed a reduced items_catalog with
-- item_key/name/type/rarity/payload but WITHOUT price_gp or merchant_tags.
-- CREATE TABLE IF NOT EXISTS alone cannot upgrade existing scratch schema.
-- Add only the two absent merchant reroll columns, local transaction only.
ALTER TABLE public.items_catalog
 ADD COLUMN IF NOT EXISTS price_gp numeric,
 ADD COLUMN IF NOT EXISTS merchant_tags text[] DEFAULT ARRAY[]::text[];
DO $synthetic$
BEGIN
 IF to_regprocedure('private.merchant_alchemy_crafted_payload_v1(jsonb)') IS NULL THEN
  EXECUTE $fn$CREATE FUNCTION private.merchant_alchemy_crafted_payload_v1(p jsonb)
   RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER
   SET search_path TO 'pg_catalog','public'
   AS $body$ SELECT coalesce(p,'{}'::jsonb); $body$;$fn$;
 END IF;
 IF to_regprocedure('private.item_campaign_loot_eligible_v1(text,text,text,text,numeric,jsonb,boolean)') IS NULL THEN
  EXECUTE $fn$CREATE FUNCTION private.item_campaign_loot_eligible_v1(
   name text,src text,typ text,rarity text,price numeric,payload jsonb,future boolean)
   RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER
   SET search_path TO 'pg_catalog','public'
   AS $body$ SELECT true; $body$;$fn$;
 END IF;
 IF to_regprocedure('private.merchant_item_theme_eligible_v2(text,text,text,text[])') IS NULL THEN
  EXECUTE $fn$CREATE FUNCTION private.merchant_item_theme_eligible_v2(
   theme text,item text,kind text,tags text[])
   RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY INVOKER
   SET search_path TO 'pg_catalog','public'
   AS $body$ SELECT true; $body$;$fn$;
 END IF;
END $synthetic$;
REVOKE ALL ON public.items_catalog,public.campaign_item_pool_settings
 FROM PUBLIC,anon,authenticated;
INSERT INTO public.items_catalog(item_key,item_name,item_type,item_rarity,price_gp,payload,merchant_tags)
SELECT 'T29-'||n,'T29 Inventory '||n,'Potion',
 CASE WHEN n%4=0 THEN 'Rare' WHEN n%4=1 THEN 'Uncommon' ELSE 'Common' END,
 5+n,'{"source":"XPHB","item_type":"Potion"}'::jsonb, ARRAY['alchemy','potions']::text[]
FROM generate_series(1,24) g(n);

-- SOURCE ORIGINAL wallet_get md5 0df12d179f1c68a4dd8ddeaf3fca4fd0; only role guard patched
CREATE OR REPLACE FUNCTION public.wallet_get(p_user uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  caller uuid := auth.uid();
  caller_role text;
  target uuid;
  v numeric;
begin
  if caller is null then
    raise exception 'Not signed in';
  end if;

  select role into caller_role from public.user_profiles where id = caller;
  caller_role := coalesce(caller_role, 'player');

  target := coalesce(p_user, caller);
  if target <> caller and not private.current_user_can_manage_commerce_v1() then
    raise exception 'Not authorized';
  end if;

  -- Ensure a row exists
  insert into public.player_wallets(user_id, gp)
  values (target, 0)
  on conflict (user_id) do nothing;

  select gp into v from public.player_wallets where user_id = target;
  return coalesce(v, 0);
end;
$function$
;

-- SOURCE ORIGINAL wallet_set md5 e8f2751e4d2807d36136935fda109dcf; only role guard patched
CREATE OR REPLACE FUNCTION public.wallet_set(p_user uuid, p_amount numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  caller uuid := auth.uid();
  caller_role text;
  target uuid;
  nxt numeric;
begin
  if caller is null then
    raise exception 'Not signed in';
  end if;

  select role into caller_role from public.user_profiles where id = caller;
  caller_role := coalesce(caller_role, 'player');

  -- In this app, wallet_set is intended for admin controls.
  if not private.current_user_can_manage_commerce_v1() then
    raise exception 'Not authorized';
  end if;

  target := coalesce(p_user, caller);

  nxt := coalesce(p_amount, 0);
  if nxt <> -1 and nxt < 0 then
    nxt := 0;
  end if;

  insert into public.player_wallets(user_id, gp)
  values (target, nxt)
  on conflict (user_id) do update
    set gp = excluded.gp,
        updated_at = now();

  return nxt;
end;
$function$
;

-- SOURCE ORIGINAL stock_merchant_item md5 228c511610fed16047a83ae061cd7790; only role guard patched
CREATE OR REPLACE FUNCTION public.stock_merchant_item(p_merchant_id uuid, p_display_name text, p_price_gp numeric, p_qty integer, p_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
declare
  v_caller uuid := auth.uid();
  v_role text;
  v_stock_id uuid;
  v_payload jsonb;
  v_item_id text;
begin
  if v_caller is null then
    raise exception 'Not signed in';
  end if;

  select role into v_role from public.user_profiles where id = v_caller;
  if not private.current_user_can_manage_commerce_v1() then
    raise exception 'Not authorized';
  end if;

  v_payload := private.merchant_alchemy_crafted_payload_v1(coalesce(p_payload, '{}'::jsonb));
  v_item_id := nullif(coalesce(v_payload->>'item_id', v_payload->>'item_key', ''), '');

  insert into public.character_stock(character_id, item_id, display_name, price_gp, qty, card_payload)
  values (
    p_merchant_id,
    v_item_id,
    coalesce(p_display_name, v_payload->>'item_name', v_payload->>'name', 'Item'),
    coalesce(p_price_gp, nullif(v_payload->>'price_gp', '')::numeric, 0),
    greatest(coalesce(p_qty, 1), 1),
    v_payload
  )
  returning id into v_stock_id;

  return v_stock_id;
end;
$function$
;

-- SOURCE ORIGINAL reroll_merchant_inventory_v2 md5 f5fef581df07fcb8c8aa2e009259736e; only role guard patched
CREATE OR REPLACE FUNCTION public.reroll_merchant_inventory_v2(p_merchant_id uuid, p_theme text DEFAULT 'general'::text, p_count integer DEFAULT NULL::integer)
 RETURNS TABLE(inserted_count integer, theme text, merchant_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
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
  IF v_uid IS NOT NULL AND NOT private.current_user_can_manage_commerce_v1() THEN RAISE EXCEPTION 'Commerce manager required to reroll merchant stock' USING ERRCODE='42501'; END IF;

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
$function$
;


-- Live policy source shape: FOR ALL to authenticated, USING + WITH CHECK.
ALTER TABLE public.character_stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS character_stock_admin_write ON public.character_stock;
CREATE POLICY character_stock_admin_write ON public.character_stock
 FOR ALL TO authenticated
 USING (private.current_user_can_manage_commerce_v1())
 WITH CHECK (private.current_user_can_manage_commerce_v1());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.character_stock TO authenticated;
REVOKE ALL ON FUNCTION public.wallet_get(uuid),
 public.wallet_set(uuid,numeric),
 public.stock_merchant_item(uuid,text,numeric,integer,jsonb),
 public.reroll_merchant_inventory_v2(uuid,text,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_get(uuid),
 public.wallet_set(uuid,numeric),
 public.stock_merchant_item(uuid,text,numeric,integer,jsonb),
 public.reroll_merchant_inventory_v2(uuid,text,integer) TO authenticated;
DO $verify$
BEGIN
 IF has_function_privilege('anon','public.wallet_set(uuid,numeric)','EXECUTE')
 OR has_function_privilege('anon','public.stock_merchant_item(uuid,text,numeric,integer,jsonb)','EXECUTE')
 OR has_function_privilege('anon','public.reroll_merchant_inventory_v2(uuid,text,integer)','EXECUTE')
 OR NOT has_table_privilege('authenticated','public.character_stock','UPDATE')
 OR (SELECT count(*) FROM pg_policies WHERE schemaname='public'
   AND tablename='character_stock' AND policyname='character_stock_admin_write')<>1
 THEN RAISE EXCEPTION 'T29 grants/policy unexpectedly changed'; END IF;
END $verify$;
COMMIT;
NOTIFY pgrst,'reload schema';
