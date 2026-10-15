# ItemCard Visual Standards

Status date: 2026-10-15  
Status: **approved visual contract**  
Active implementation branch: `equipment-merchant-shared-storefront` / PR #225

This document records the eight ItemCard variants approved during Character Forge / MerchantPanel browser review. These are presentation standards, not a second item-rules engine. Canonical item payloads, crafting outputs, prices, source identities, and merchant checkout authority remain unchanged.

## Global visual contract

All approved variants share these rules:

- dark fantasy / arcane textured card interior with the existing DNDNext rarity-driven frame;
- deep rarity tone owns the outer border, header, divider, and principal section accents; the lighter rarity tone is reserved for labels and restrained glow;
- title at upper left, type pill and price at upper right;
- rarity line immediately below the header;
- crafted Smithing or Alchemy results show `Crafted by <name>` beside the rarity when crafter provenance exists;
- upper content row is item description/flavor at left and item artwork/thumbnail at right;
- description text must contain descriptive prose only. Mechanical effects should not leak into this box merely because they occur first in a source paragraph;
- a 2–3px luminous rarity divider with a centered crystal/diamond ornament separates description/art from mechanics;
- player-facing source markup such as `{@spell ...}`, `{@damage ...}`, `{@dc ...}`, and `{@condition ...}` must render as clean player text;
- cards must use their available vertical body down to the lower inset rather than leaving an arbitrary empty band;
- redundant bottom chip rows are not part of the approved standard when the same values are already present elsewhere on the card;
- long mechanics remain complete but should be structured into field grids, effect panels, and named-property disclosures rather than one uninterrupted wall of text;
- card layout may vary by item family, but flavor and mechanical values must not be rewritten or silently omitted.

## Variant 1 — Weapon

Approved calibration item: **Bloodrage Greataxe**

Order:

1. title / type / price;
2. rarity + crafted-by provenance when applicable;
3. description + artwork;
4. luminous rarity divider;
5. rarity-tinted primary effect box;
6. weapon information grid extending to the lower card inset.

Primary fields:

- Damage
- Range / Reach — melee weapons should still present reach when the payload allows it (for example `5 feet`);
- Weight
- Properties

Do not add a separate traits section unless the item actually has named special traits beyond the primary effect.

## Variant 2 — Armor

Approved calibration item: **Leather Golem Armor**

Order:

1. title / type / price;
2. rarity + crafted-by provenance when applicable;
3. description + artwork;
4. luminous rarity divider;
5. armor information grid;
6. rarity-tinted main effect/rules panel;
7. named special traits as individual chevron disclosures;
8. traits extend to the lower card inset.

Primary fields:

- Armor Class
- Weight
- other armor-specific fields only when they add information not already expressed by the AC string or named traits.

AC presentation must preserve Dexterity rules. Example: Leather Golem Armor is `12 + Dex (no max)`: base Leather Armor 11 + Dex with no maximum, plus the item's +1 AC effect. If an armor limits Dexterity, show the limit explicitly, e.g. `15 + Dex (max 2)`.

Description/effect separation is semantic, not positional. For Leather Golem Armor, `Strange rituals have repurposed the body of a flesh golem into this partially sentient suit of leather armor.` belongs in description, while `While wearing this armor...` begins the mechanical effect.

## Variant 3 — Material

Approved calibration item: **HQ Obsidian Edgeglass**

Order:

1. title / type / price;
2. rarity;
3. description + artwork;
4. luminous rarity divider;
5. compact material field grid extending to the lower inset.

Typical fields:

- Category
- Quality
- Used In
- Weight
- Trait
- Note / material behavior

Material cards generally do not need a large effect panel unless the material has an actual standalone mechanical effect.

## Variant 4 — Recipe

Approved calibration item: **Recipe: Potion of Poison Breath**

Order:

1. title / recipe pill / price;
2. rarity;
3. recipe description + artwork;
4. luminous rarity divider;
5. highlighted output/effect box;
6. recipe field grid extending to the lower inset.

Typical fields:

- Craft Type
- Output
- Save
- Damage / effect family
- Duration
- Doses / Charges where meaningful

A recipe card describes what the recipe produces; it is not presented as though the recipe scroll itself is the consumable.

## Variant 5 — Potion / Elixir / Beneficial Consumable

Approved calibration item: **Potion of Fire Resistance**

Order:

1. title / consumable type / price;
2. rarity + crafted-by provenance when applicable;
3. description + artwork;
4. luminous rarity divider;
5. rarity-tinted Effect panel;
6. consumable field grid extending to the lower inset.

Typical fields:

- Use
- Duration
- Doses / Charges
- Application / delivery

A Save field appears only if the finished item actually calls for a saving throw. Generic or stale `save_dc` data must not make a beneficial potion display a meaningless save.

## Variant 6 — Bomb / Offensive Consumable

Approved calibration item: **Bomb of Lightning**

Order:

1. title / Bomb pill / price;
2. rarity + crafted-by provenance when applicable;
3. description + artwork;
4. luminous rarity divider;
5. rarity-tinted Effect panel;
6. tactical field grid extending to the lower inset.

Typical fields:

- Use
- Area
- Save ability + DC
- Damage
- Duration
- Charges / doses
- named conditions / repeat-save data when present

Merchant-crafted alchemy presentation must use the finished crafted result, not stale base-recipe text, for damage, area, duration, save, and effect.

## Variant 7 — Wondrous Item / Wearable

Approved calibration item: **Ring of Warmth**

Order:

1. title / Wondrous Item pill / price;
2. rarity + crafted-by provenance when applicable;
3. description + artwork;
4. luminous rarity divider;
5. rarity-tinted Effect panel;
6. item-specific field grid extending to the lower inset.

Typical fields:

- Slot / worn location
- Attunement when meaningful
- Weight
- item subtype

For items with named secondary traits, switch to the same chevron treatment used by complex armor after the main effect panel.

## Variant 8 — Charged Wondrous Item / Rod & Wand

Approved calibration item: **Rod of Retribution**

Order:

1. title / subtype pill / price;
2. rarity + crafted-by provenance when applicable;
3. description + artwork;
4. luminous rarity divider;
5. rarity-tinted primary rules/effect panel;
6. charged-item field grid extending to the lower inset.

Typical fields:

- Charges
- Range
- Save
- Damage
- Weight
- subtype or other non-redundant mechanical field

If a charged item has multiple named powers, the primary effect may remain visible while additional powers become individual chevron disclosures.

## Crafter provenance

Any successfully crafted Smithing or Alchemy item with creator provenance must render:

`Crafted by <character name>`

This is presentation metadata and must come from canonical crafted-item/merchant-stock provenance. Do not infer a crafter from the merchant currently selling the item.

## Adaptive family rule

The eight variants are standards, not eight hard-coded one-off components. `ItemCard` should classify the canonical payload into the closest family and then populate only fields actually supported by that payload. Fields that are absent or meaningless should be omitted rather than filled with decorative dashes merely to preserve a fixed count.

## Accepted examples

- Weapon: Bloodrage Greataxe
- Armor: Leather Golem Armor
- Material: HQ Obsidian Edgeglass
- Recipe: Potion of Poison Breath
- Potion / Elixir: Potion of Fire Resistance
- Bomb: Bomb of Lightning
- Wondrous wearable: Ring of Warmth
- Charged wondrous item: Rod of Retribution

These eight examples are the current visual calibration set for future ItemCard implementation and browser review.
