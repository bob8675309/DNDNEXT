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

### Foundation Batch 04
- `itemart_armor_helmet_plain_01`
- `itemart_armor_gauntlets_plain_01`
- `itemart_armor_boots_plain_01`
- `itemart_wondrous_ring_ruby_01`
- `itemart_wondrous_amulet_sapphire_01`
- `itemart_gear_lantern_plain_01`
- `itemart_gear_rope_hook_plain_01`
- `itemart_container_waterskin_plain_01`
- `itemart_book_spellbook_arcane_01`
- `itemart_ammo_quiver_plain_01`

### Foundation Batch 05
- `itemart_container_satchel_plain_01`
- `itemart_gear_bedroll_plain_01`
- `itemart_gear_compass_plain_01`
- `itemart_map_travel_plain_01`
- `itemart_weapon_warhammer_plain_01`
- `itemart_material_herb_bundle_plain_01`
- `itemart_tools_healers_kit_plain_01`
- `itemart_wondrous_astrolabe_plain_01`
- `itemart_wondrous_scrying_orb_plain_01`
- `itemart_tools_cauldron_plain_01`
- `itemart_gear_torch_bundle_plain_01`
- `itemart_wondrous_hourglass_plain_01`
- `itemart_wondrous_censer_plain_01`
- `itemart_gear_spyglass_plain_01`
- `itemart_container_chest_plain_01`
- `itemart_gear_grappling_hook_plain_01`
- `itemart_wondrous_scepter_arcane_01`
- `itemart_container_map_tube_plain_01`
- `itemart_tools_climbers_kit_plain_01`

### Foundation Batch 06
- `itemart_wondrous_chalice_moonlit_01`
- `itemart_wondrous_pocket_watch_celestial_01`
- `itemart_wondrous_wand_crystal_01`
- `itemart_wondrous_reliquary_radiant_01`
- `itemart_wondrous_moonstone_relic_01`
- `itemart_instrument_lyre_celestial_01`
- `itemart_wondrous_tuning_fork_runic_01`
- `itemart_wondrous_dice_obsidian_01`
- `itemart_wondrous_cube_arcane_01`
- `itemart_wondrous_bell_crystal_01`

### Foundation Batch 07 — recovered accepted broad-base set
- `itemart_armor_bracers_leather_01`
- `itemart_gear_camping_bundle_plain_01`
- `itemart_gear_fireside_kit_plain_01`
- `itemart_gear_mess_kit_plain_01`
- `itemart_gear_rations_plain_01`
- `itemart_gear_writing_kit_sealed_letters_01`
- `itemart_instrument_flute_silver_01`
- `itemart_instrument_horn_runic_blue_01`
- `itemart_tools_carpenters_kit_plain_01`
- `itemart_tools_merchant_scales_plain_01`
- `itemart_tools_tailors_kit_plain_01`
- `itemart_wondrous_amulet_feather_moonlit_01`
- `itemart_wondrous_bag_holding_cosmic_01`
- `itemart_wondrous_belt_runebound_crystal_01`
- `itemart_wondrous_brooch_moonstone_crescent_01`
- `itemart_wondrous_circlet_amethyst_elven_01`
- `itemart_wondrous_cloak_midnight_celestial_01`
- `itemart_wondrous_decanter_aquamarine_01`
- `itemart_wondrous_driftglobe_moonstone_01`
- `itemart_wondrous_figurine_owl_obsidian_01`
- `itemart_wondrous_key_sapphire_arcane_01`
- `itemart_wondrous_medallion_teal_runic_01`
- `itemart_wondrous_mirror_moonlit_gothic_01`
- `itemart_wondrous_music_box_celestial_01`
- `itemart_wondrous_relic_prismatic_crystal_01`
- `itemart_wondrous_ring_amethyst_runic_01`
- `itemart_wondrous_rod_immovable_runic_01`
- `itemart_wondrous_rune_stones_twin_01`
- `itemart_wondrous_runes_twin_blue_01`
- `itemart_wondrous_tablet_runic_glowing_01`

### Foundation Batch 08 — recovered wondrous expansion
- `itemart_elixir_moonstone_starlit_01`
- `itemart_wondrous_amulet_vine_emerald_01`
- `itemart_wondrous_boots_winged_celestial_01`
- `itemart_wondrous_bracelet_jade_moonlit_01`
- `itemart_wondrous_bracers_crystal_stormforged_01`
- `itemart_wondrous_brooch_spider_crimson_01`
- `itemart_wondrous_cloak_starweave_moonlit_01`
- `itemart_wondrous_conch_pearl_moonlit_01`
- `itemart_wondrous_cube_astral_crystal_01`
- `itemart_wondrous_dreamcatcher_moonstone_01`
- `itemart_wondrous_figurine_raven_sapphire_01`
- `itemart_wondrous_lantern_celestial_01`
- `itemart_wondrous_locket_celestial_01`
- `itemart_wondrous_mask_amethyst_masquerade_01`
- `itemart_wondrous_pendant_serpent_emerald_01`
- `itemart_wondrous_prayer_wheel_sunstone_01`
- `itemart_wondrous_ring_moonstone_celestial_01`
- `itemart_wondrous_snowglobe_citadel_01`
- `itemart_wondrous_staff_crystal_enchanted_01`
- `itemart_wondrous_vial_copper_stormbound_01`

### Foundation Batch 09 — recovered final single-item set
- `itemart_armor_breastplate_runeforged_01`
- `itemart_armor_chainmail_plain_01`
- `itemart_elixir_frost_moonlit_01`
- `itemart_shield_obsidian_runic_01`
- `itemart_shield_tower_battleworn_01`
- `itemart_wondrous_figurine_fox_silver_01`
- `itemart_wondrous_figurine_wolf_jade_01`
- `itemart_wondrous_monocle_crystal_01`
- `itemart_wondrous_pouch_arcane_indigo_01`
- `itemart_wondrous_relic_amber_glowing_01`

This is **126 masters total**. The foundation pass is intentionally limited to stable physical archetypes. It does not finalize Smithing, Alchemy, or Enchanting material/component art.

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


## Production checklist and duplicate gate — 2026-10-18

Use this gate before every new ItemCard-art generation batch.

- [ ] Check the existing master list by physical form, not only by exact item name.
- [ ] Generate a new image only when it adds a reusable silhouette, object form, or clearly useful visual role.
- [ ] Do not generate another generic sword, bow, shield, potion, chest, spellbook, or other already-covered form merely for variety.
- [ ] Prefer broad reusable masters over one-off named-item illustrations unless the named item is visually distinctive enough to justify unique art.
- [ ] Keep canonical static art on ChatGPT native image generation unless the project owner explicitly approves another engine.
- [ ] Standardize accepted production masters to 1024×1024 PNG.
- [ ] Keep the hero object readable at ItemCard thumbnail size and useful elsewhere on the site.
- [ ] Do not bake item names, UI chrome, prices, rarity labels, readable writing, or ownership/provenance into the image.
- [ ] Do not create art centered on illicit or illegal activity. Exclude burglary/lockpicking kits, contraband, illicit drugs, counterfeit documents/currency, poison-making kits, or similar activity-focused props.
- [ ] After each batch, stage accepted source art through Dropbox, validate the import, record accepted masters, and record rejected repeats so they are not generated again.

### Latest repeat rejections

The following recent shots were intentionally **not** added as new masters because equivalent coverage already exists:

- extra round shield → covered by `itemart_shield_round_plain_01`
- sheathed sword → covered by `itemart_weapon_sword_plain_01`
- recurve bow → covered by `itemart_weapon_bow_plain_01`
- crimson potion/elixir → covered by the existing potion/elixir masters
- second treasure chest → Batch 05 already selected one chest master
- second grimoire/spellbook → covered by `itemart_book_spellbook_arcane_01`

### Useful broad-base gaps for future batches

The recovery audit closed many earlier gaps. Prioritize these before making more variants of covered objects:

- travel/survival still missing: tent, blanket, flint-and-steel as a dedicated single-item master, shovel, pickaxe
- lawful/general tools still missing: cook's utensils, smithing hand tools, dedicated sewing kit if a materially different form is needed
- instruments still missing: hand drum and other materially distinct instrument silhouettes
- additional distinct weapon silhouettes only where the form materially differs: rapier, greatsword, halberd/glaive, sling, javelin
- additional neutral containers: scroll case, document folio, strongbox, specimen jar
- additional lawful utility magic forms where materially distinct: sending stone, crystal prism, or a named-item override not already covered by the current key/mirror/tablet/cube/relic families

Do not regenerate generic forms now covered by Batches 07–09: merchant scales, carpenter tools, tailor tools, flute, horn, cloak, belt, bracers, brooch, circlet, magical key, magic mirror, rune tablet, bag of holding, driftglobe, decanter, magical figurines, magical ring/amulet variants, magical cube, snow globe, prayer wheel, tower shield, obsidian shield, breastplate, or chainmail.

Smithing, Alchemy, and Enchanting material/component families remain provisional until their system redesigns are finalized.


### 2026-10-18 checklist update — Batch 06 accepted

The following physical forms are now covered and should be treated as existing art before generating another generic version:

- [x] moonlit chalice / magical goblet
- [x] celestial pocket watch / magical timepiece
- [x] crystal wand variant
- [x] radiant reliquary
- [x] moonstone relic / oval arcane token
- [x] celestial lyre
- [x] runic tuning fork
- [x] obsidian magical dice set
- [x] arcane mechanical cube
- [x] crystal magical bell

Batch 06 source renders arrived as **1254 × 1254 square PNGs**. The guarded import verified the Dropbox source byte size/content hash, required a square source at least 1024 pixels, and normalized each accepted production master to **1024 × 1024 PNG** with Lanczos resampling before commit.

For future generation, do not make another generic chalice, pocket watch, lyre, tuning fork, magical dice set, arcane cube, or magical bell simply for variety. Only add another instance when its physical construction or named-item identity is materially different enough to justify a bespoke override.


## 2026-10-18 recovery audit — missed accepted art patched

A full chat-to-repository reconciliation found that 60 previously accepted single-item images had not been included in the first merge to `main`. They were recovered without regeneration and installed as Foundation Batches 07–09.

Recovery result:
- pre-recovery repo count: **66** masters
- recovered accepted images: **60**
- post-recovery expected repo count: **126** masters
- Batch 07: 30
- Batch 08: 20
- Batch 09: 10

The recovery used the established Dropbox → one-shot GitHub Actions binary-art bridge. The transfer hard-guarded the expected recovery-branch head, ZIP SHA-256, every individual PNG SHA-256, exact filenames, exact 1024×1024 output dimensions, and an exact 60-file diff before the bot commit was pushed.

Ten portrait-format source renders from the wondrous-expansion set were normalized without stretching: the complete source object was retained over a darkened/blurred square backdrop derived from the same image. All other recovered square sources were resampled directly to 1024×1024.

The two rune-stone images `itemart_wondrous_rune_stones_twin_01` and `itemart_wondrous_runes_twin_blue_01` remain intentionally distinct accepted variants. Do not remove either as a duplicate unless the project owner explicitly chooses to collapse them.
