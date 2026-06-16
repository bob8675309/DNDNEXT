-- DNDNext merchant alchemy stock backfill
-- Merchant potion/oil/elixir/poison stock should be shown and delivered as if
-- the merchant crafted the item with ordinary commercial ingredients.
-- The live helper private.merchant_alchemy_crafted_payload_v1 uses mostly
-- Common and Uncommon ingredients with an occasional Rare component.

update public.character_stock cs
set card_payload = private.merchant_alchemy_crafted_payload_v1(cs.card_payload)
where jsonb_typeof(cs.card_payload) = 'object'
  and lower(coalesce(cs.card_payload->'alchemy'->>'kind', '')) = 'crafted_product';
