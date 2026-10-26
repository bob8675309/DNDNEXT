# Armor and shield AC source channels — read-only audit (2026-10-25)

**Status: additive, private, shadow-only. No production migration or gameplay consumer was changed.**

## Live catalogue evidence (read-only Supabase audit)

The current `items_catalog.payload` often separates nominal armor/shield `ac` from magic direct `bonusAc`:

| Catalogue identity | Source type | `ac` | `bonusAc` |
|---|---|---:|---:|
| Dwarven Plate `Dwarven Plate|DMG` | HA | 18 | +2 |
| Arrow-Catching Shield `Arrow-Catching Shield|XDMG` | S\|XPHB | 2 | +2 |
| Armor of the Valiant Soul (Awakened) `...|TDCSR` | MA | 14 | +2 |
| Animated Shield `Animated Shield|XDMG` | S\|XPHB | 2 | absent |
| Breastplate `Breastplate|XPHB` | MA\|XPHB | 14 | absent |

Among catalogued magical armor and shield types the combined `ac`+ `bonusAc` format appears repeatedly, including different rarities. The mere presence of `ac` does **not** prove whether an arbitrary magic item's AC field is its natural physical armor value or a magical enhanced value. Nor does rarity alone establish a magic rider. Do not blindly zero or subtract the equipment `ac` field.

## New private source audit

`private.character_attuned_armor_channel_audit_v1(character_id)` obtains the exact baseline and already-developed source-filtered comparison from #277 and the verified account/character item gate from #274. It then fetches each equipped armor/shield inventory record and merges the catalogue payload with the instance payload following the *existing canonical resolver's source-key, edition, and item-name precedence* (instance top-level fields win).

For each actual equipped armor/shield it reports:
- exact inventory UUID, item key, category and equip slot;
- legacy `ac` candidate, catalogue `ac` candidate, and the amount of physical armor/shield AC actually picked by the legacy resolver;
- direct `bonusAc` parsed using the resolver's first-recognized alias, the attunement-specific source eligibility and whether the previous direct-bonus shadow suppressed this rider;
- whether the candidate preserved the baseline **armor base and shield bonus**;
- explicit unresolved source cases such as instance-level `ac` override, catalogue mismatch, nonstandard shield base, an implicit armor type, or magical physical-base provenance not independently verified.

The function reports `sourceChannelProvenanceReady=false`, `physicalChannelSourceProofReady=false`, `fullEffectConsumerParityReady=false` and `consumerEnforced=false` deliberately. Those flags cannot be flipped just because a structured catalogue record looks ordinary.

It does **not** rewrite `character_equipment_effects_v1`, weapon/armor slots, `character_sheets`, or active tactical encounter snapshots.

## Isolated PostgreSQL16 regression

Compose the exact canonical equipment resolver and preceding real-schema-shaped selection/ability fixtures, then insert genuine-shaped catalogue+instance rows for Dwarven Plate and Arrow-Catching Shield.

- OFF returns the exact unmodified authoritative resolver JSON.
- ON with no items selected retains heavy-armor AC 18 and shield AC 2 while the magic +2 and +2 riders are excluded.
- ON with those two items plus the Cloak selected retains the physical bases and restores exactly +2, +2 and +2 direct magic AC riders, while unselected Staff bonuses remain out.
- Editing Dwarven Plate's instance `ac` from 18 to 21 revokes its attunement selection, leaves the legacy physical AC unchanged **in the shadow** and surfaces `instance_ac_override_unverified` and `catalogue_instance_ac_mismatch`. It never pretends to know how much of 21 is natural plate versus magic.
- Reverting the campaign rule to OFF recovers exact legacy calculations even after the instance override.
- The private function has no direct anonymous or authenticated-role EXECUTE grant.

## Next release gates

1. Define a **trusted physical-base identity** or canonical armor archetype for crafted, tempered, enchanted and VAR inventory items, including item-specific exceptions; separately prove which direct AC and spell/weapon effects are magical.
2. Continue actual effects normalization for weapons and spell attacks/DC and compare against original tactical/sheet consumers; no numeric substitution may double count `bonusAc`.
3. Resolve shared account equipment **physical custody**, server-authorized rest opportunities, character exceptions, and combat snapshot lifecycle before gameplay enforcement.
4. Run signed-in browser and battle-board tests before integrating or merging the long draft PR chain (#267→#278 and parallel #251→#255).

No world-map or town-map changes; no Forge or portrait/UI artwork changes.
