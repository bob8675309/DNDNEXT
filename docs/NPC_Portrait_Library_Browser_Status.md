# NPC Portrait Library Browser Status

Status date: 2026-10-16

## Direction

NPCs and merchants use one shared portrait library. Merchant presentation does not need a separate art subsystem.

The active portrait library already contains 185 portraits across 24 species/category groups. Before this pass, species metadata was broadly populated but profession metadata was empty, so the selector could only operate as a flat searchable grid even though many filenames already encoded useful roles such as merchant, shopkeeper, smith, apothecary, herbalist, jeweler, scribe, tavernkeeper, and trader.

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

No new portrait table is introduced. The existing public.npc_portrait_library fields remain authoritative:

- category
- tags
- species_tags
- profession_tags
- theme_tags
- recommended_use

Migration 20261016_09_portrait_library_semantic_tags backfills semantic profession/theme tags from the existing curated portrait names/tags. It does not replace artwork or reassign any character portrait.

Merchant-friendly roles currently include merchants, smiths, apothecaries, herbalists, alchemists, jewelers, scribes, hospitality portraits, and artisan portraits. This is a browsing/use-case tag, not an exclusivity rule; all portraits remain selectable.

## Artwork expansion

Future merchant-biased portrait batches should be added to the same npc_portrait_library and tagged through the existing metadata rather than creating merchant-only artwork tables or picker logic. Useful additions include general-goods merchants, smiths/armorers, apothecaries, arcane dealers, jewelers/relic dealers, caravan outfitters, innkeepers/provisioners, scribes, and curio dealers across underrepresented species.

Binary artwork remains additive and independently reviewable; this browser/metadata pass does not regenerate or replace approved portrait files.

## Protected boundaries

No world-map, town/city-map, movement, weather, tactical, inventory, crafting, or merchant-economy authority is changed by this portrait-browser work.
