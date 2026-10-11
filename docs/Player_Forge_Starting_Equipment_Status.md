# Player Forge Starting Equipment & Character Currency Status

Status date: 2026-10-10  
Active PR: #207 (`agent/forge-spell-browser-readability-20261009`)  
Current authority: migrations 49-51 plus `20261010_01_player_forge_starting_market.sql`

## Current player-facing model

The Character Forge **Equipment** step no longer asks a player to choose Package A / B / C.

The imported class and Background equipment sources already contain a cash-only alternative. The Forge now treats that source-backed cash alternative as the character's starting purse and lets the player stage purchases from the campaign's existing merchant storefronts.

The live source audit on 2026-10-10 found:

- 14 supported class entries with imported starting-equipment choices;
- all 14 have a source-backed cash alternative;
- 16 XPHB Background entries with imported starting-equipment choices;
- all 16 have a source-backed cash alternative.

No arbitrary flat starting-gold table was invented for the new UI.

At levels 5+, the existing higher-level wealth rule remains additive to that source-backed class + Background purse:

- levels 5-10: `500 gp + 1d10 x 25 gp`;
- levels 11-16: `5,000 gp + 1d10 x 250 gp`;
- levels 17-20: `20,000 gp + 1d10 x 250 gp`.

The higher-level magic-item allowance remains a **DM guide only**. The Forge does not create free magic items from that guide.

## Starting Market UI

`components/NpcForgeEquipmentStep.js` now uses the existing merchant data model:

- merchant identity and storefront metadata come from `public.characters`;
- only `storefront_enabled=true` merchants are shown;
- live stock comes from `public.character_stock`;
- the existing `ItemCard` is reused for item details;
- the player can search/filter stock and stage purchases into a Starting Cart;
- the UI shows source class cash, source Background cash, total budget, staged spending, and remaining coin;
- keeping some or all starting gold is legal.

The storefront presentation was also given a modest readability/scale pass. Existing shop/admin/purchase capabilities were intentionally preserved.

Recipes are not treated as starting equipment. They remain owned by the normal recipe/unlock flow rather than being projected into a new character's equipment inventory.

## Transaction boundary

Character Forge does **not** run the normal account-wallet merchant purchase RPC while the new character is still only a draft.

Instead, `startingEquipmentSelections` stores a staged `marketPurchases[]` cart. At character creation, the deferred Player Forge equipment materializer performs the authoritative checkout in the same database transaction.

For every staged row it:

1. re-resolves the merchant and stock row;
2. requires that the merchant still has an enabled storefront;
3. locks the stock row;
4. rechecks available quantity;
5. uses the **current server-side merchant price**, not the client-staged price;
6. rejects recipe/unlock rows;
7. recomputes the source-backed class + Background + higher-level cash budget on the server;
8. rejects the whole creation transaction if authoritative purchase cost exceeds that budget;
9. moves the purchased item into `inventory_items` as character-owned inventory;
10. decrements or removes the merchant stock row;
11. writes only the unspent balance to `public.character_currency`.

A stale cart therefore fails closed instead of silently overspending or duplicating merchant stock.

## Character-scoped inventory and currency

Starting-market purchases retain the existing multi-character authority:

- `inventory_items.owner_type='character'`;
- `inventory_items.owner_id=<character uuid>`;
- items start unequipped;
- AC, attacks, equipment bonuses, and tactical derived effects remain owned by the existing equip pipeline;
- unspent coin is stored in `public.character_currency`;
- the starting market does not spend or modify the account-wide wallet.

The sheet receives:

- `startingEquipmentSummary`;
- `startingCurrencyCopper`;
- `higherLevelMagicItemGuide`;
- the same remaining balance under `meta.startingCurrencyCopper`.

The Review step shows the source budget, staged market spend, remaining currency, merchant count, purchased items, higher-level d10 result, and magic-item guide.

## Legacy compatibility

The server materializer still accepts legacy `mode='package'` payloads from older drafts.

Legacy package materialization continues to resolve canonical items through `items_catalog`, preserve source quantities, validate category choices, and write character-scoped inventory/currency.

New Player Forge drafts normalize to `mode='market'`, so Package A/B/C is no longer the player-facing path.

## Guards

The deferred sheet guard still verifies:

- `startingEquipmentSelections` is an object;
- submitted Background id exists;
- submitted Background id/name matches the character Background;
- Background source matches when recorded;
- level 5+ requires a valid d10 result;
- levels below 5 reject a higher-level wealth roll.

For market mode it additionally requires:

- `marketPurchases` is an array when supplied;
- every staged purchase is an object;
- every purchase identifies its merchant and stock row;
- quantity is a positive whole number.

Live stock, price, storefront state, budget, and recipe eligibility are revalidated by the materializer at checkout.

## 2026-10-10 live verification

The new SQL compiled and replaced the live helper/materializer/guard successfully.

Live source-backed cash audit after deployment:

- classes: 14 total, 0 missing cash alternatives;
- Backgrounds: 16 total, 0 missing cash alternatives;
- class cash alternatives ranged from 50 gp to 160 gp;
- XPHB Background cash alternatives are 50 gp in the current imported set.

The live materializer contains the market branch, the live deferred guard recognizes `marketPurchases`, and the existing materializer/guard triggers remain attached.

Applying the migration did not purchase or consume merchant stock. The active storefront stock count remained unchanged after the authority migration.

## Protected boundaries

This work does not change:

- world-map movement, routes, weather, or time simulation;
- town/city-map roster semantics;
- encounter/tactical combat;
- crafting recipe logic;
- equipment-derived AC/attack authority.

The change is confined to Character Forge starting equipment, merchant storefront presentation, merchant stock checkout at character creation, character inventory, and character-scoped starting currency.
