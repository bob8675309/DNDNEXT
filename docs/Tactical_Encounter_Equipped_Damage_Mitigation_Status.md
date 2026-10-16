# Tactical Encounter — Equipped Damage Mitigation Status

Last updated: 2026-10-16

## Status

**Implemented in the live Supabase damage resolver and source-controlled on the ItemCard audit branch.**

This follow-up was explicitly authorized after the DNDNext elemental Resistance Rings gained structured campaign mechanics. It closes the gap between the item payload and the server-authoritative tactical damage resolver.

## Authority

`public.encounter_apply_damage_internal_v1` remains the single shared typed-damage authority used by supported weapon, reaction, generic-effect, and spell paths.

The resolver now calls `private.encounter_equipped_damage_mitigation_v1(character_id, damage_type)` before applying damage.

The helper reads only structured data from currently equipped `inventory_items` and their matching `items_catalog` rows:

- `resist: ["fire", ...]`
- `damageReductionByType: { "fire": 10, ... }`
- snake-case `damage_reduction_by_type` is accepted for compatibility.

It deliberately does **not** parse `item_description`, `rulesShort`, or other prose to invent combat effects.

## Equipment ownership

The helper follows the existing tactical equipped-weapon ownership model:

- character/NPC/merchant-scoped inventory can match the encounter participant's `character_id`;
- legacy player-scoped inventory is accepted only through an editable `character_permissions` relationship;
- only `is_equipped=true` rows can affect damage.

Because the helper also resolves the canonical catalog row, an older inventory snapshot can still receive a newly corrected structured catalog mechanic without requiring the item to be re-purchased.

## Damage order

The authoritative order is now:

1. begin with non-negative raw typed damage;
2. immunity reduces damage to 0;
3. otherwise apply the highest equipped flat reduction for that damage type;
4. apply Resistance to the remaining damage, rounding down;
5. apply vulnerability to the remaining damage;
6. temporary HP absorbs damage;
7. remaining damage reduces current HP.

Flat reductions use the **highest applicable value**, not the sum of duplicate equipped copies. This prevents duplicate copies of the same structured effect from multiplying the reduction unintentionally.

## DNDNext Resistance Rings

An equipped `Ring of X Resistance` now functions exactly as its DNDNext campaign item data states:

- Resistance to X damage;
- reduce each matching damage instance by 10;
- then halve the remaining damage through Resistance.

Example: **30 Fire damage → 20 after the ring's flat reduction → 10 after Fire Resistance.**

The damage result now returns additional structured fields for later UI/log presentation:

- `flatReductionAvailable`
- `flatReductionApplied`
- `damageAfterFlatReduction`
- `equipmentResistance`
- `mitigationSources`

Existing `resistant`, `immune`, `vulnerable`, `damage`, HP, and temp-HP fields remain intact.

## Live verification

The live database migration compiled successfully.

A controlled runtime test used an existing archived encounter participant and a temporary equipped Fire Resistance Ring inventory row whose snapshot intentionally lacked the new flat-reduction field. The helper recovered the current campaign mechanic from `items_catalog`.

Observed result:

- raw Fire damage: 30;
- catalog-derived flat reduction: 10;
- damage after flat reduction: 20;
- equipment-derived Fire Resistance: true;
- final damage: 10;
- mitigation source: `Ring of Fire Resistance`.

A Cold lookup against the same ring returned no resistance and no flat reduction. The temporary test inventory row was removed and the encounter participant's original HP state was restored.

## Validation guard

`scripts/validate_tactical_equipped_damage_mitigation.mjs` is part of `check:tactical-spell-suite`, which is already run by the Vercel production build.

The guard verifies:

- equipped-only authority;
- structured resistance/reduction keys;
- catalog + inventory resolution;
- maximum rather than additive flat reduction;
- flat reduction occurs before Resistance;
- the new result envelope fields;
- no item-prose inference;
- no world-map movement/weather coupling.

## Remaining boundaries

This follow-up imports **structured equipped-item** mitigation only. It does not broadly infer or import resistance/immunity/vulnerability from species, class prose, feat prose, or arbitrary narrative text.

World-map, town/city-map, movement, routes, weather, and time simulation are unchanged.
