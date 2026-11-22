-- C34 B14-P20B: disposable-only atomic Town Inscribe & Copy subset.
-- Source anchors: pages/town/[id].js buildCraftedResult/handleCraftWorkshop,
-- components/TownSheet.js buildWorkshopServices('scribe'), original P20A gate.
-- No production migration; no general/forge/imbue/plant recipe authorization.
-- Current browser raw ingredient DELETE + crafted INSERT + rollback INSERT is
-- NOT edited or declared fixed. This RPC models ONE narrower compatible path.
BEGIN;
DO $p20b_preflight$
BEGIN
 IF current_database()<>'postgres'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regclass('auth.users') IS NULL
 OR to_regclass('public.inventory_items') IS NULL
 OR to_regclass('public.characters') IS NULL
 OR to_regclass('private.c34_b14_p20a_earned_item_receipts') IS NULL
 OR to_regprocedure('public.c34_b14_p20a_claim_earned_account_item_v1(uuid)') IS NULL
 OR to_regprocedure('public.c34_b14_p20b_inscribe_owned_item_v1(uuid,uuid,uuid,bigint)') IS NOT NULL
 OR (SELECT count(*) FROM pg_policy
  WHERE polrelid='public.inventory_items'::regclass) <> 5
 OR NOT EXISTS(SELECT 1 FROM pg_policy
  WHERE polrelid='public.inventory_items'::regclass
  AND polname='c34_b14_p20a_temporary_signed_insert_gate' AND NOT polpermissive)
 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.inventory_items'::regclass
  AND tgname='c34_b14_p16_guard_direct_inventory_dml' AND NOT tgisinternal)
 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.inventory_items'::regclass
  AND tgname='c34_b14_p18_guard_direct_character_item_creation' AND NOT tgisinternal)
 THEN RAISE EXCEPTION 'P20B requires exact signed P20A/P16/P18 disposable PG17 stack'
  USING ERRCODE='42501';
 END IF;
END $p20b_preflight$;

CREATE TABLE private.c34_b14_p20b_town_inscribe_receipts(
 request_id uuid PRIMARY KEY,
 actor_id uuid NOT NULL,
 crafter_id uuid NOT NULL,
 town_id bigint NOT NULL,
 consumed_item_id uuid NOT NULL,
 result_item_id uuid NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.c34_b14_p20b_town_inscribe_receipts
 FROM PUBLIC,anon,authenticated;

-- Authenticated browser supplies the request nonce and existing item/crafter/town
-- identifiers ONLY. The result, owner, type, description and item provenance
-- are exclusively computed from server-locked source rows.
-- The nonce advisory lock serializes repeated same-request claims; the
-- inventory row lock serializes independent competing consumes.
-- A thrown exception after DELETE rolls back both DELETE and INSERT.
CREATE FUNCTION public.c34_b14_p20b_inscribe_owned_item_v1(
 p_request_id uuid,p_primary_item_id uuid,p_crafter_id uuid,p_town_id bigint)
RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,private,auth
AS $p20b_craft$
DECLARE
 v_actor uuid:=auth.uid();
 v_previous private.c34_b14_p20b_town_inscribe_receipts%ROWTYPE;
 v_item public.inventory_items%ROWTYPE;
 v_crafter_name text;
 v_name text;
 v_description text;
 v_payload jsonb;
 v_type text;
 v_result uuid;
BEGIN
 IF v_actor IS NULL OR p_request_id IS NULL OR p_primary_item_id IS NULL
 OR p_crafter_id IS NULL OR p_town_id IS NULL THEN
  RAISE EXCEPTION 'Signed Town crafter, item, town and nonce required'
   USING ERRCODE='42501';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('p20b-town:'||p_request_id::text,0));
 SELECT * INTO v_previous FROM private.c34_b14_p20b_town_inscribe_receipts
 WHERE request_id=p_request_id;
 IF FOUND THEN
  IF v_previous.actor_id IS DISTINCT FROM v_actor
  OR v_previous.consumed_item_id IS DISTINCT FROM p_primary_item_id
  OR v_previous.crafter_id IS DISTINCT FROM p_crafter_id
  OR v_previous.town_id IS DISTINCT FROM p_town_id THEN
   RAISE EXCEPTION 'Craft nonce belongs to a different original intent'
    USING ERRCODE='42501';
  END IF;
  RETURN v_previous.result_item_id;
 END IF;

 -- The original TownSheet 'inscribe' service is attached to a scribe.
 -- Only source-confirmed present, nonhidden, resting NPC/merchant and
 -- the exact requested town are admitted. No world-map code is altered.
 SELECT c.name INTO v_crafter_name FROM public.characters c
 WHERE c.id=p_crafter_id AND c.kind IN ('npc','merchant')
 AND c.is_hidden IS NOT TRUE AND c.state='resting'
 AND c.location_id=p_town_id
 AND 'scribe'=ANY(coalesce(c.tags,'{}'::text[]));
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Town scribe unavailable' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_item FROM public.inventory_items
 WHERE id=p_primary_item_id
 AND user_id=v_actor AND owner_type='player' AND owner_id=v_actor::text
 AND is_equipped IS NOT TRUE
 FOR UPDATE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Base item missing or not yours' USING ERRCODE='42501';
 END IF;

 -- Exact bounded case: source normalizeCraftType outputs 'gear' for plain
 -- "Misc"/"gear" rows with no stronger item-name or type signals. Other
 -- source types, magic-slot, plant, catalysts, tier and service are HELD.
 v_type:=lower(btrim(coalesce(v_item.item_type,'')));
 v_name:=btrim(coalesce(v_item.item_name,''));
 IF v_type NOT IN ('misc','gear')
 OR v_name='' OR v_name ~* '(weapon|armor|armour|shield|ammunition|arrow|bolt|bullet|sword|axe|mace|staff|hammer|spear|bow|dagger|book|manual|tome|scroll|potion|poison|wand|ring|amulet)'
 OR length(v_name)>160
 OR coalesce(v_item.card_payload,'{}'::jsonb) ? 'enchant_slots'
 OR coalesce(v_item.card_payload,'{}'::jsonb) ? 'crafted_bonus'
 THEN RAISE EXCEPTION 'Item is outside the bounded plain-gear inscribe source case'
  USING ERRCODE='42501';
 END IF;

 -- Source original buildCraftedResult(serviceId='inscribe', bonus=0,
 -- no optional secondary/material/catalyst) preserves the original name,
 -- weight, cost and base card data, writes Common rarity and craft metadata.
 -- Only the instance item_id timestamp is server generated instead of JS.
 v_description:=v_crafter_name||' inscribed '||v_name||
  ' into a utility script or encoded form.';
 v_payload:=coalesce(v_item.card_payload,'{}'::jsonb)||
  jsonb_build_object(
   'name',v_name,'item_name',v_name,'item_type','gear','rarity','Common',
   'item_rarity','Common','item_description',v_description,
   'damageText',coalesce(v_item.card_payload->>'damageText',v_item.card_payload->>'damage',''),
   'ac',coalesce(v_item.card_payload->>'ac',v_item.card_payload->>'armorClass',''),
   'crafted_by',v_crafter_name,'crafted_service','inscribe',
   'crafted_bonus',0,'crafted_material',NULL,'crafted_components','[]'::jsonb,
   'flavor',coalesce(nullif(v_item.card_payload->>'flavor',''),v_description),
   'craft_request_id',p_request_id,'source_item_id',v_item.id
  );
 DELETE FROM public.inventory_items WHERE id=v_item.id;
 INSERT INTO public.inventory_items(
  id,user_id,owner_type,owner_id,is_equipped,
  item_id,item_name,item_type,item_rarity,item_description,
  item_weight,item_cost,card_payload)
 VALUES(
  gen_random_uuid(),v_actor,'player',v_actor::text,false,
  'crafted-'||(floor(extract(epoch FROM clock_timestamp())*1000)::bigint)::text,
  v_name,'gear','Common',v_description,
  v_item.item_weight,v_item.item_cost,v_payload)
 RETURNING id INTO v_result;
 INSERT INTO private.c34_b14_p20b_town_inscribe_receipts(
  request_id,actor_id,crafter_id,town_id,consumed_item_id,result_item_id)
 VALUES(p_request_id,v_actor,p_crafter_id,p_town_id,p_primary_item_id,v_result);
 RETURN v_result;
END;
$p20b_craft$;
REVOKE ALL ON FUNCTION public.c34_b14_p20b_inscribe_owned_item_v1(uuid,uuid,uuid,bigint)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.c34_b14_p20b_inscribe_owned_item_v1(uuid,uuid,uuid,bigint)
 TO authenticated;

DO $p20b_postflight$
BEGIN
 IF has_table_privilege('authenticated',
 'private.c34_b14_p20b_town_inscribe_receipts','INSERT')
 OR has_function_privilege('anon',
 'public.c34_b14_p20b_inscribe_owned_item_v1(uuid,uuid,uuid,bigint)','EXECUTE')
 OR (SELECT count(*) FROM pg_policy
  WHERE polrelid='public.inventory_items'::regclass)<>5
 THEN RAISE EXCEPTION 'P20B ledger/public grants or original RLS changed'
  USING ERRCODE='42501';
 END IF;
END $p20b_postflight$;
COMMIT;
