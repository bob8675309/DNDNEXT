# Player Forge Starting Equipment & Character Currency Status

Status date: 2026-08-08
PR: #170 (`agent/character-forge-resilience-presentation`)
Live migrations: 49-51

## Scope

This document is the controlling evidence for source-backed Player Forge starting equipment, higher-level starting wealth, and character-scoped starting currency.

The slice intentionally preserves the existing canonical item pipeline:

`items_catalog -> inventory_items -> equip state -> sheet/tactical derived effects`

The Forge does not copy starter armor/weapon bonuses into sheet formulas and does not auto-equip gear.

## Player Forge Equipment step

Player mode now includes an Equipment step between Spells and Identity. NPC step order is unchanged.

The step loads `get_player_forge_starting_equipment_v1(class_id, background_id, level)` and cannot advance until:

- the source-backed catalogue loads;
- a legal class package is selected when imported packages exist;
- a legal Background package is selected when imported packages exist;
- every item-category selector is resolved;
- a level-5+ character has a d10 starting-wealth result.

The Equipment step shows:

- class package A/B/C choices;
- Background package A/B choices;
- fixed items and quantities;
- source-legal instrument/tool/holy-focus/druidic-focus selectors;
- additive higher-level cash;
- resulting character currency;
- the higher-level magic-item allowance as a **DM guide only**.

The Review step now repeats the exact package, d10, currency, and DM-guide summary before Create.

## Source-backed class packages

Migration 49 restores structured `startingEquipment.defaultData` into the existing `class_catalog.raw_payload` for:

- XPHB Barbarian
- XPHB Bard
- XPHB Cleric
- XPHB Druid
- XPHB Fighter
- XPHB Monk
- XPHB Paladin
- XPHB Ranger
- XPHB Rogue
- XPHB Sorcerer
- XPHB Warlock
- XPHB Wizard
- EFA Artificer

Classes without an imported structured package are not given invented gear.

Background packages continue to come from the already-imported `character_option_catalog.metadata.equipment` source data.

## Package item resolution

Fixed source item UIDs resolve through `items_catalog`.

Supported generic selectors are server-validated against canonical item metadata:

- `toolArtisan`
- `instrumentMusical`
- `setGaming`
- `focusHoly`
- `focusDruidic`

Wizard's source `special: Spellbook` resolves to the preferred canonical Spellbook item instead of creating an ad-hoc inventory card.

Source currency `value` fields are treated as copper-piece integers.

## Higher-level starting wealth

Normal class + Background starting equipment remains the base at every starting level.

Additional cash is additive:

- levels 1-4: no extra cash roll;
- levels 5-10: `500 gp + 1d10 x 25 gp`;
- levels 11-16: `5,000 gp + 1d10 x 250 gp`;
- levels 17-20: `20,000 gp + 1d10 x 250 gp`.

The higher-level magic-item quantities are stored/displayed as a DM guide only. The Forge does not randomly or automatically create magic items from that allowance.

## Canonical starter inventory

Migration 49 adds a deferred Player Forge materializer. Migration 51 makes its final projection explicitly character-scoped.

Every concrete starter item is inserted into `inventory_items` with:

- `owner_type='character'`;
- `owner_id=<character uuid>`;
- canonical `item_id/item_key` and catalogue payload;
- source quantity;
- `is_equipped=false`;
- starter-equipment provenance in `card_payload`.

This deliberately avoids the older account-scoped `owner_type='player'` convention for new multi-character Player Forge gear.

The existing `get_character_inventory_v1` reader already includes character-owned rows, so no parallel inventory store was introduced.

Starter items begin unequipped. AC, attacks, equipment bonuses, and tactical snapshots remain owned by the existing equip pipeline.

## Character-scoped currency

Migration 49 adds `public.character_currency`:

- one row per character;
- copper-piece canonical balance;
- source breakdown for class package, Background package, higher-level cash, d10 result, and DM magic-item guide;
- RLS enabled by migration 50;
- no direct anonymous/authenticated table mutation.

`get_character_currency_v1(character_id)` is the guarded read surface. It distinguishes:

- `hasBalance=false` when no character-currency row exists;
- `hasBalance=true` even when an authoritative character balance is exactly zero.

This feature does **not** use `player_wallets` or any account-wide wallet state.

Current UX note: the Equipment/Review steps show the starting balance before creation, and the authoritative balance is available after creation through `get_character_currency_v1`. A compact post-create inventory/profile balance display is still a presentation follow-up and should not be confused with missing currency authority.

## Background / wealth tamper guard

Migration 50 adds a deferred sheet guard before materialization.

It verifies:

- `startingEquipmentSelections` is an object;
- submitted Background id exists;
- submitted Background id/name matches the Background actually recorded on the character sheet;
- Background source matches when recorded;
- level 5+ requires a d10 result from 1-10;
- levels below 5 reject a higher-level wealth roll.

Category selections are independently validated by the materializer against canonical item metadata.

## Character-scoped projection correction

Migration 49 initially contained a compatibility write to legacy `players.sheet`.

Migration 51 immediately replaces the materializer so its final live behavior updates only:

- `character_sheets`;
- `inventory_items(owner_type='character')`;
- `character_currency`.

It does not project starter gear/currency into the account-wide `players.sheet` and does not use `player_wallets`.

## Validation gates

Before live deployment:

- the full migration 49-50 schema/function/trigger set compiled against the live Supabase schema inside an explicit rollback transaction;
- the final migration-51 materializer behavior matched that compiled character-scoped version;
- `validate_player_forge_starting_equipment.mjs` passed;
- `validate_player_forge_starting_equipment_guard.mjs` passed;
- `validate_player_forge_character_scoped_equipment_projection.mjs` passed;
- `validate_player_forge_equipment_review.mjs` passed;
- unified Character Forge validation passed;
- the exact equipment workflow passed the repository production `npm run build:vercel` gate.

## Live rollback proofs

All successful cases used the real authenticated `create_player_character_v3` path and forced deferred constraints inside rollback transactions.

### Fighter package A + Criminal package A

Verified:

- actual inventory-row count exactly matched the live source packages;
- every row used `owner_type='character'` and the new character UUID;
- all items began unequipped;
- no account-scoped starter inventory row was created;
- character currency equaled the exact class + Background package copper;
- `get_character_inventory_v1` returned the same starter rows;
- sheet currency projection matched the authoritative balance.

### Fighter package C + Criminal package B

Verified cash-only behavior:

- zero starter inventory rows;
- exact source-derived character currency still materialized.

### Monk package A selector

The proof asked `get_player_forge_starting_equipment_v1` for a live source-legal musical-instrument/artisan-tool option and submitted that exact item.

Verified exactly one selector-owned item materialized and no substitute/duplicate selector item appeared.

### Level-5 higher-level wealth

A Fighter 5 / Champion used cash-only normal packages and deterministic `d10=7`.

Verified:

- additive higher-level cash = 675 gp;
- total currency equaled package cash + 675 gp;
- source breakdown retained `higherLevelRoll=7`;
- DM guide was exactly `{common:1, uncommon:1}`;
- no magic inventory row was automatically created;
- the same guide appeared on the character sheet projection.

### Wizard package A

A level-1 Wizard used the real v3 nine-spell starting-magic path plus class package A.

Verified:

- source `special: Spellbook` resolved exactly once to canonical inventory;
- Wizard starting spell materialization remained nine exact v3 rows;
- equipment materialization did not regress starting-magic authority.

### Fail-closed cases

Rollback proofs rejected atomically:

1. a different Background id hidden inside the equipment selection;
2. `Dagger|XPHB` submitted for Monk's instrument/artisan-tool selector;
3. missing d10 for a level-5 character;
4. d10 submitted for a level-1 character.

Each rejected transaction left no character, starter inventory, or character-currency residue.

## Final production integrity

After all rollback fixtures:

- production character/sheet/spell/progression counts returned to the protected baseline;
- zero QA `startingEquipment=true` inventory rows survived;
- zero QA `character_currency` rows survived;
- zero synthetic `__equipment_*` characters survived;
- world baseline remained 20 locations / 4 routes / 9 route points.

No world-map, town/city-map, route/travel/weather, tactical combat, or crafting behavior was changed by this slice.

## Status

Source-backed Player Forge equipment materialization, higher-level starting cash, and character-scoped currency authority are **live and rollback-proven**.

Remaining UX follow-up inside this area: surface `get_character_currency_v1` as a compact post-create balance in the inventory/profile UI.

The larger PR #170 blockers remain runtime cadence families, Artificer wildcard Magic Item Plan concrete-item instances, remaining source-choice/conditional UI audit, obsolete level-up RPC cleanup, and final authenticated browser acceptance.
