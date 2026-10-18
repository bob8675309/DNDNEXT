# DNDNext Item Art Bible

Status date: 2026-10-15  
Status: **approved direction / production taxonomy draft**  
Related UI contract: `docs/ItemCard_Visual_Standards.md`  
Active branch: `equipment-merchant-shared-storefront` / PR #225

## Purpose

This document defines how DNDNext item artwork should be produced, reused, named, and resolved across MerchantPanel, Character Forge Equipment, inventory, crafting results, recipes, and other ItemCard consumers.

The art system must feel premium without requiring one bespoke painting for every catalog row. It therefore uses a **master-art + reusable-variant** model.

## Core visual direction

- dark fantasy;
- object-first composition;
- high silhouette readability at thumbnail size;
- restrained background texture;
- grounded materials with magical accents;
- rarity and theme should enhance the object, not overwhelm it;
- art must work both as a small merchant/inventory thumbnail and as the larger ItemCard image.

## Canonical canvas

Preferred production source:

- square;
- 1024 × 1024 master;
- centered or slightly asymmetric hero object;
- enough breathing room for contain/crop use;
- low-detail dark background unless a transparent/backgroundless treatment is explicitly required.

## Rarity treatment

### Mundane / Common

**Mundane and Common are the same baseline visual tier.**

They are interchangeable for art-direction purposes:

- same neutral material treatment;
- same baseline card/art color family;
- no separate art variant required merely because one row says Mundane and another says Common;
- preserve source/canonical rarity labels in data until the rules/content pass decides whether to normalize them, but do not create duplicate art for them.

### Uncommon and above

Higher rarities may progressively add:

- cleaner or more unusual materials;
- stronger magical accents;
- more ornament;
- more dramatic rim lighting;
- stronger themed energy;
- more unique silhouettes where warranted.

Rarity should not be represented by replacing the physical identity of the item.

## Approved ItemCard families

Art must support the eight approved presentation variants:

1. Weapon
2. Armor
3. Material
4. Recipe
5. Potion / Elixir / beneficial consumable
6. Bomb / offensive consumable
7. Wondrous wearable / accessory
8. Charged wondrous item / rod / wand

See `ItemCard_Visual_Standards.md` for information hierarchy and field rules.

## Crafter provenance

Crafted art does not need to encode the crafter visually. Provenance belongs to the card data:

`Crafted by <character name>`

Smithing and Alchemy outputs with canonical creator provenance should surface this line. Future Enchanting provenance should follow the same rule if/when the redesign makes it applicable.

## Production strategy

### Do not use one image per catalog item

The live catalog currently contains thousands of named items. The art system should resolve through reusable physical archetypes and controlled variants.

Resolution order should eventually be:

1. unique item-art override;
2. explicit art key;
3. family + subtype + theme master;
4. family + subtype master;
5. family fallback;
6. generic fallback icon.

## Crafting-system freeze rule

**Do not finalize the art manifest for Smithing, Alchemy, or Enchanting until those systems are re-examined.**

The current material/reagent/catalyst catalogs are useful prototypes, but they are not assumed to be final. The redesign may:

- merge ingredient/material families;
- remove redundant materials;
- rename families;
- simplify quality tiers;
- change how Smithing materials combine;
- simplify Alchemy ingredients/modifiers;
- change Enchanting components or slot presentation.

Therefore:

- the *card variants* for Material, Recipe, Consumable, Bomb, Weapon, and Armor are approved;
- the *current list of crafting materials* is provisional;
- crafting-related art counts must be recalculated after the Smithing → Alchemy → Enchanting review is complete;
- do not generate large batches of one-off reagent/material art before that pass.

## Stable art families safe to produce before crafting redesign

These categories are comparatively stable and can receive production art without waiting for crafting-system simplification:

- mundane/common weapons by physical form;
- mundane/common armor by armor form;
- shields;
- ammunition;
- ordinary adventuring gear;
- tools;
- containers;
- instruments;
- vehicles;
- broadly reusable trade goods;
- stable Wondrous Item subtypes;
- rods/wands;
- scroll/focus archetypes;
- generic potion/elixir/bomb vessel archetypes, provided the art remains theme-driven rather than tied to a soon-to-change recipe schema.

## Provisional art families

Delay large-scale bespoke production for:

- Smithing ores/materials/temper components;
- Alchemy ingredient families;
- Alchemy catalysts/modifiers;
- Monster-part crafting materials;
- Holy components;
- recipe-family variants whose recipes may be consolidated;
- Enchanting-specific components or slot visuals;
- crafted-product subclasses that may be renamed or merged.

A minimal generic fallback is acceptable for these until the rules pass is complete.

## Family standards

### Weapons

Master art should resolve first by physical form:

- sword
- axe
- hammer
- mace/flail
- dagger
- spear/polearm
- staff/club
- whip
- bow
- crossbow
- firearm where retained
- other special weapon forms

Variants may apply material/theme/rarity treatment without changing the core silhouette.

### Armor

Resolve by physical armor form:

- light armor
- medium armor
- heavy armor
- shield

Named armor may receive a unique override when its construction is visually important.

### Potions / Elixirs / Oils / Poisons

Use a small set of vessel silhouettes plus theme-driven content:

- potion bottle;
- elegant elixir flask;
- oil vial;
- poison phial;
- specialty alchemical vessel.

Use liquid color, glow, suspended particles, residue, stopper treatment, and subtle aura to differentiate effects.

### Bombs

Use throwable alchemical vessels with stronger casing/silhouette. Theme is carried by:

- contents;
- cracks/glow;
- elemental particles;
- etched markings;
- fuse/stopper/cap treatment.

### Materials

The Material card/art family is approved, but the current material taxonomy is provisional pending crafting redesign.

When production resumes, prefer reusable material-form art:

- ingot;
- ore;
- crystal;
- worked glass;
- bone;
- hide;
- wood;
- cloth/fiber;
- refined magical component.

### Ingredients / reagents

Also provisional pending Alchemy redesign. When finalized, prefer family masters rather than one picture per ingredient.

### Wondrous Items

Split by recognizable physical subtype, not by the generic "Wondrous Item" category alone:

- ring;
- amulet/necklace;
- cloak;
- boots;
- belt;
- gloves;
- bracers;
- helm;
- mask;
- goggles;
- bag;
- figurine;
- stone;
- Ioun Stone;
- relic / miscellaneous arcane object.

Wondrous items deserve more bespoke overrides than mundane gear because silhouette and object identity matter heavily.

### Scrolls / books / recipes / foci

Use clear physical differentiation:

- spell scroll;
- recipe scroll;
- grimoire/book;
- arcane focus;
- holy/ritual focus.

### Tools / adventuring gear / trade goods

Favor practical physical archetypes that can cover multiple catalog entries. Do not spend bespoke-art budget on every rope, sack, hammer, or commodity unless it becomes narratively important.

## Theme layer

Reusable art may receive a controlled theme layer such as:

- fire;
- cold;
- lightning;
- acid;
- poison;
- necrotic;
- radiant;
- psychic;
- force;
- thunder/storm;
- shadow;
- holy;
- infernal;
- fey;
- draconic;
- blood;
- crystal.

Theme expression should use restrained:

- glow;
- etching;
- liquid color;
- sparks/frost/smoke;
- internal inclusions;
- surface treatment.

Avoid full scenic spell effects that obscure the object.

## Naming convention

Recommended asset key:

`itemart_<family>_<subtype>_<theme>_<variant>`

Examples:

- `itemart_weapon_greataxe_blood_01`
- `itemart_weapon_longsword_fire_01`
- `itemart_armor_leather_arcane_01`
- `itemart_potion_bottle_fire_01`
- `itemart_bomb_orb_lightning_01`
- `itemart_wondrous_ring_warmth_01`
- `itemart_recipe_scroll_alchemy_01`

Unique override:

`itemart_unique_<canonical_slug>_01`

## Suggested runtime fields

Future item-art resolution can use:

- `art_key`
- `art_family`
- `art_subtype`
- `art_theme`
- `art_variant`
- `art_override`

These should describe presentation only. They must not become a second rules authority.

## Production phases

### Phase A — stable merchant art

Before the crafting redesign finishes, produce only stable archetypes needed by currently visible shops:

- weapon forms;
- armor forms;
- wondrous subtypes;
- rods/wands;
- scroll/focus;
- instruments;
- tools;
- adventuring gear;
- trade goods;
- generic consumable vessels.

Crafting materials use generic/provisional art until their rules are locked.

### Phase B — crafting-system review

Review in this order:

1. Smithing
2. Alchemy
3. Enchanting

For each system:

- remove/merge redundant materials;
- finalize family names;
- finalize mechanical roles;
- finalize what deserves a distinct visual identity;
- only then regenerate the art-manifest counts.

### Phase C — crafting art

Once the rules are accepted:

- produce final material/ingredient masters;
- produce final catalyst/component masters;
- produce crafted-output thematic variants;
- add unique art only for iconic outputs.

### Phase D — premium overrides

Add bespoke art for:

- iconic named magic items;
- narratively important relics;
- signature crafted results;
- major merchant showcase items;
- player-favorite equipment.

## Quality checklist

An art asset passes only if:

- its family is recognizable at thumbnail size;
- silhouette remains clear;
- object is distinct from background;
- material reads correctly;
- theme is visible but restrained;
- it fits the approved ItemCard thumbnail region;
- it can be reused without making unrelated items look identical in a misleading way.

## Current production-count policy

Do **not** treat earlier whole-catalog image estimates as a locked production requirement.

The final count must be recalculated after Smithing, Alchemy, and Enchanting are simplified. In particular, current materials, ingredients, catalysts, and recipes are expected to shrink or consolidate.

For now:

- use current catalog counts only as an audit baseline;
- use stable-family art for immediate UI work;
- defer final crafting-art totals until the crafting redesign is complete.


## Foundation master production status — 2026-10-17

The first stable ItemCard master-art foundation set is now produced on PR #230. All assets are square PNG masters at **1024 × 1024** and live under `public/item-art/masters/`.

### Foundation Batch 01
- `itemart_weapon_sword_plain_01`
- `itemart_weapon_dagger_plain_01`
- `itemart_weapon_axe_plain_01`
- `itemart_weapon_mace_plain_01`
- `itemart_weapon_spear_plain_01`
- `itemart_weapon_bow_plain_01`
- `itemart_weapon_crossbow_plain_01`
- `itemart_weapon_staff_plain_01`
- `itemart_armor_light_plain_01`
- `itemart_armor_medium_plain_01`

### Foundation Batch 02
- `itemart_armor_heavy_plain_01`
- `itemart_shield_round_plain_01`
- `itemart_shield_kite_plain_01`
- `itemart_potion_vial_red_01`
- `itemart_elixir_bottle_arcane_01`
- `itemart_bomb_flask_plain_01`
- `itemart_scroll_arcane_plain_01`
- `itemart_wand_plain_01`
- `itemart_rod_plain_01`
- `itemart_focus_arcane_plain_01`

### Foundation Batch 03
- `itemart_symbol_holy_plain_01`
- `itemart_tools_kit_plain_01`
- `itemart_container_backpack_plain_01`
- `itemart_trade_coinpouch_plain_01`
- `itemart_material_ingot_plain_01`
- `itemart_ammo_arrow_bundle_plain_01`
- `itemart_instrument_lute_plain_01`

This is **27 masters total**. The foundation pass is intentionally limited to stable physical archetypes. It does not finalize Smithing, Alchemy, or Enchanting material/component art.

Production of the image files does **not** by itself make them a second item-rules authority. Runtime resolution still needs a bounded follow-up implementation for art-key mapping/fallback behavior. No `items_catalog` image/art columns were added during this production pass.


## Canonical static-art generation source — 2026-10-17

DNDNext permanent static artwork uses **ChatGPT native image generation** as the canonical production source unless the project owner explicitly approves changing engines.

This rule applies to:
- character portraits
- species and class artwork
- merchant and NPC portraits
- ItemCard artwork
- crafting and item illustrations
- other permanent site imagery

External image/video tools may be used for experiments, animation, or explicitly approved exceptions, but they must not silently replace the canonical static-art pipeline.

For the foundation ItemCard pass, the Batch 02 and Batch 03 candidate renders from the temporary alternate-engine experiment were replaced before runtime integration. The retained Batch 02/03 masters are derived from native ChatGPT-generated DNDNext artboards and standardized to 1024×1024 square PNG masters with full-object framing and dark-background extension.

The production consistency target remains:
- 1024×1024 square PNG master
- dark cinematic fantasy realism
- isolated hero object
- strong silhouette at thumbnail size
- restrained environmental backdrop
- consistent visual margins and scale
- no baked-in UI, labels, or readable text
