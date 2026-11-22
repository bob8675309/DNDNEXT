-- B14-P20A disposable-only proof of earned account item issuance.
-- This is NOT a deployed migration or a finished Town/Forge/Stage4 cutover.
-- Receipt creation is reserved to trusted server-side writers; the real
-- recipe/loot event issuer is deliberately NOT implemented by this candidate.
-- Requires preceding original P16/P18 and genuine JWT RED, PG17 only.
BEGIN;
DO $p20a_preflight$
BEGIN
 IF current_database()<>'postgres'
  OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  OR to_regclass('auth.users') IS NULL
  OR to_regclass('public.inventory_items') IS NULL
  OR to_regclass('private.c34_b14_p20a_earned_item_receipts') IS NOT NULL
  OR to_regprocedure('public.c34_b14_p20a_claim_earned_account_item_v1(uuid)') IS NOT NULL
  OR to_regprocedure('public.c34_b14_p16_is_item_grant_manager_v1()') IS NULL
  OR (SELECT count(*) FROM pg_policy
      WHERE polrelid='public.inventory_items'::regclass)<>4
  OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.inventory_items'::regclass
      AND tgname='c34_b14_p16_guard_direct_inventory_dml' AND NOT tgisinternal)
  OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.inventory_items'::regclass
      AND tgname='c34_b14_p18_guard_direct_character_item_creation' AND NOT tgisinternal)
 THEN
  RAISE EXCEPTION 'P20A only accepts original four-policy P16/P18 disposable PG17 state'
   USING ERRCODE='42501';
 END IF;
END $p20a_preflight$;

-- A RESTRICTIVE RLS overlay composes with the ORIGINAL permissive four
-- policies. It does NOT revoke table grants or edit the original policies.
-- Ordinary client INSERT for ALL owner types is rejected, not merely player.
-- Trusted source-definer functions are a distinct server-authority seam.
CREATE POLICY c34_b14_p20a_temporary_signed_insert_gate
 ON public.inventory_items AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK (coalesce(public.c34_b14_p16_is_item_grant_manager_v1(),false));

-- The receipt ledger is PRIVATE, no client INSERT/UPDATE/DELETE/SELECT.
-- In this isolated test only postgres inserts a trusted receipt; a real
-- game event must prove earned ingredients/stock/quest before issuing one.
CREATE TABLE private.c34_b14_p20a_earned_item_receipts (
 receipt_id uuid PRIMARY KEY,
 recipient_user_id uuid NOT NULL,
 source_kind text NOT NULL CHECK (source_kind IN ('trusted_craft','trusted_loot','trusted_purchase')),
 source_ref uuid NOT NULL,
 item_id text NOT NULL CHECK (length(btrim(item_id))>0),
 item_name text NOT NULL CHECK (length(btrim(item_name))>0),
 inventory_item_id uuid UNIQUE,
 UNIQUE(source_kind,source_ref,recipient_user_id)
);
REVOKE ALL ON TABLE private.c34_b14_p20a_earned_item_receipts
 FROM PUBLIC,anon,authenticated;

-- A caller supplies ONLY the unguessable receipt id. Owner, catalogue item,
-- source and destination derive from a locked, trusted server receipt.
-- The receipt row lock makes concurrent repeated calls idempotent.
CREATE FUNCTION public.c34_b14_p20a_claim_earned_account_item_v1(p_receipt_id uuid)
RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,private,public,auth
AS $p20a_claim$
DECLARE
 v_actor uuid := auth.uid();
 v_receipt private.c34_b14_p20a_earned_item_receipts%ROWTYPE;
 v_item_id uuid;
BEGIN
 IF v_actor IS NULL OR p_receipt_id IS NULL THEN
  RAISE EXCEPTION 'Signed claimant and earned receipt required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_receipt
 FROM private.c34_b14_p20a_earned_item_receipts
 WHERE receipt_id=p_receipt_id FOR UPDATE;
 IF NOT FOUND OR v_receipt.recipient_user_id IS DISTINCT FROM v_actor THEN
  RAISE EXCEPTION 'Earned receipt not authorized' USING ERRCODE='42501';
 END IF;
 IF v_receipt.inventory_item_id IS NOT NULL THEN
  RETURN v_receipt.inventory_item_id;
 END IF;
 INSERT INTO public.inventory_items
   (id,owner_type,owner_id,user_id,item_id,item_name,item_type,item_rarity,card_payload,is_equipped)
 VALUES
   (gen_random_uuid(),'player',v_actor::text,v_actor,
    v_receipt.item_id,v_receipt.item_name,'Misc','Common',
    jsonb_build_object('earned_receipt',p_receipt_id,'source_kind',v_receipt.source_kind,
      'source_ref',v_receipt.source_ref),false)
 RETURNING id INTO v_item_id;
 UPDATE private.c34_b14_p20a_earned_item_receipts
 SET inventory_item_id=v_item_id WHERE receipt_id=p_receipt_id;
 RETURN v_item_id;
END;
$p20a_claim$;
REVOKE ALL ON FUNCTION public.c34_b14_p20a_claim_earned_account_item_v1(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.c34_b14_p20a_claim_earned_account_item_v1(uuid)
 TO authenticated;

DO $p20a_postflight$
BEGIN
 IF (SELECT count(*) FROM pg_policy
  WHERE polrelid='public.inventory_items'::regclass
   AND polname='c34_b14_p20a_temporary_signed_insert_gate'
   AND polcmd='a' AND NOT polpermissive
   AND polroles=ARRAY['authenticated'::regrole::oid])<>1
 OR has_table_privilege('authenticated',
   'private.c34_b14_p20a_earned_item_receipts','INSERT')
 OR has_function_privilege('anon',
   'public.c34_b14_p20a_claim_earned_account_item_v1(uuid)','EXECUTE')
 THEN
  RAISE EXCEPTION 'P20A strict account authority or grants invalid'
   USING ERRCODE='42501';
 END IF;
END $p20a_postflight$;
COMMIT;
