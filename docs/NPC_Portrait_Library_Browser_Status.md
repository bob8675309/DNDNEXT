# NPC Portrait Library Browser Status

Status date: 2026-10-17

## Direction

NPCs and merchants use one shared portrait library. Merchant presentation does not need a separate art subsystem.

The active portrait library now contains 214 portraits across 31 species/category groups. Species metadata is broadly populated and profession/theme metadata supports merchant-focused browsing without making portraits exclusive to merchants.

## Browser behavior

Both the existing Character/NPC portrait picker and the NPC Forge portrait picker now share the same filtering model.

The profile picker exposes:

- search;
- sort by library order, name, merchant-friendly first, or unassigned first;
- quick Merchant-friendly and Unassigned filters;
- expandable Species, Role / profession, Theme, and Assignment branches;
- compact role/theme chips on portrait cards;
- existing assignment markers and current-selection behavior.

The NPC Forge portrait picker exposes the same Species, Role / profession, and Theme hierarchy in compact form, plus portrait sorting.

When the Forge is creating a Merchant, the portrait picker opens with Merchant-friendly filtering enabled by default. Existing NPC/merchant profile selectors can also receive the same preferred use-case hint.

## Metadata

No new portrait table is introduced. The existing `public.npc_portrait_library` fields remain authoritative:

- category
- tags
- species_tags
- profession_tags
- theme_tags
- recommended_use

Migration `20261016_09` introduced the semantic backfill and `20261016_10` applies the corrected scalar-array aggregation used by the live library.

Migration `20261017_01_merchant_portrait_library_batch.sql` registers the approved 29-image merchant batch that lives under `public/npc-portraits/library/merchant-batch-20261016/`. The batch uses the same shared library and adds species, profession, and theme metadata rather than introducing merchant-only infrastructure.

Live verification after the merchant batch:

- 214 active portraits total;
- 140 with semantic profession tags;
- 86 tagged Merchant-friendly;
- 46 general Merchant portraits;
- 9 Smith portraits;
- 12 Apothecary portraits;
- 9 Herbalist portraits;
- 3 Jeweler portraits;
- 16 Scribe portraits;
- 29 portraits in the new merchant batch.

Merchant-friendly roles include merchants, smiths, apothecaries, herbalists, alchemists, jewelers, scribes, hospitality portraits, and artisan portraits. This is a browsing/use-case tag, not an exclusivity rule; all portraits remain selectable.

## Merchant assignments

The batch migration only fills merchants that had no portrait at execution time. It does not overwrite an existing library or generated portrait.

Current assignments added by this batch:

- Ilyra Glasshand → Dwarven Jeweler;
- Mara Ironvein → Goblin Prosthetic Smith;
- Pell Mossgrove → Firbolg Herbalist;
- Selene Quill → Tiefling Curio Dealer;
- Torren Packswell → Minotaur Caravan Outfitter.

Brakka Wayfarer, Dawn Whiteflame, and Quill Ashborn retain their pre-existing portraits.

## Artwork expansion

The new batch deliberately broadens merchant presentation beyond clean indoor shops. It includes caravan, roadside, rain-soaked, industrial, alley, frontier, desert-night, and border-town scenes alongside polished shop portraits.

Future merchant-biased portrait batches should continue to use `npc_portrait_library` and the existing semantic metadata rather than creating merchant-only artwork tables or picker logic.

Binary artwork remains additive and independently reviewable. The 29 files were imported through the established guarded binary-art path with Dropbox content-hash verification, PNG signature checks, minimum-resolution checks, and exact 3:4 aspect-ratio checks before being committed to the PR branch.

## Protected boundaries

No world-map, town/city-map, movement, weather, tactical, inventory, crafting, or merchant-economy authority is changed by this portrait-browser/artwork work.
