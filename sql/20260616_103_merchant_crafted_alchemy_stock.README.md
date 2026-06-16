# Merchant-crafted alchemy stock

Live Supabase migrations applied on 2026-06-16:

- `merchant_crafted_alchemy_stock_v1`
- `merchant_stock_item_alchemy_v1`

The live migrations add these database contracts:

- `private.merchant_alchemy_duration_v1(...)`
- `private.merchant_alchemy_pick_ingredient_v1(...)`
- `private.merchant_alchemy_crafted_payload_v1(jsonb)`
- repaired `public.reroll_merchant_inventory_v2(uuid,text,integer)`
- updated `public.stock_merchant_item(uuid,text,numeric,integer,jsonb)`

## Behavior

Merchant-stock alchemy products are decorated as finished brews rather than raw reference cards. Each finished stock payload stores:

- recipe-derived use and duration;
- final Save DC and save ability when the formula requires a save;
- selected ingredient names, families, and rarities;
- accumulated Effect %, Duration %, Area %, Save DC, extra-dose, and die-step bonuses;
- final effect dice/area when those recipe fields exist;
- a `merchant-alchemy-v1` payload marker.

Core ingredient selection uses the intended commercial weighting:

- Common: 55%
- Uncommon: 40%
- Rare: 5%

A recipe-required tagged component may use the nearest available rarity when no lower-rarity match exists. Oil of Stunning currently requires a Stunning/Nerve/Lightning/Thunder component, whose matching catalog entries are Rare.

Existing merchant alchemy stock and previously purchased merchant alchemy inventory were backfilled. Both themed rerolls and manually stocked catalog items now pass through the same payload decorator.

The executable migration is recorded in Supabase migration history; the duration and ingredient-selection helper definitions are also tracked in `20260616_102_merchant_alchemy_helpers.sql`.
