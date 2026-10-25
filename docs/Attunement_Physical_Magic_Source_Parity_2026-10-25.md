# Attunement physical base versus magical rider — shadow parity (2026-10-25)

**Draft only. No gameplay consumer is rerouted.** This change corrects a structural flaw in the preliminary `private.filter_rest_magic_effect_candidates_v1` introduced by PR #271.

## Invariant

An item can contribute *more than one effect type*. A magic shield may supply ordinary physical shield AC and an additional magical saving throw or defense rider. Equipped armor may supply a physical armor base even when its magical enhancement is inactive.

When the optional rule is **OFF**, preserve the existing equipped-source results. When **ON**, preserve *physical* contributions from equipped items regardless of their selected magic status, but suppress **magical riders** on unselected sources. NEVER destroy, transfer, unequip, or change the base gear merely to suppress a magical enhancement.

The shadow function now requires an explicit, server-derived `effectChannel: "physical" | "magical"` on each normalized effect contribution. An item may appear more than once with the same exact `inventoryItemId`, but different channels. A magical contribution with `magic=false` is invalid. Only legitimate, server-proven magical contributions are gated against the up-to-three selected item UUIDs. `consumerEnforced=false` remains true.

## Regression coverage

Isolated PostgreSQL16 fixture covers four equipped magic sources, one unselected and one unequipped, a mundane armor contribution, and **one additional magic shield expressed as two contributions**: physical AC +2 (always if equipped) and magical save +1 (selected only). It verifies the OFF baseline, ON-selected / unselected sources, that the shield base survives without attunement, approximate numeric AC projection (6 while selected vs 4 physical-only), item cap and duplicates, forged magical provenance, omitted channel, unexpected user-supplied fields, and anonymous function ACL.

The fixture values are intentionally *synthetic*: numerical AC examples prove the source-split contract only and do not prove the full legacy AC algorithm. It does **not** connect to the separately staged #251→#253→#255 actual legacy and genuine catalogue parity tests; merging that stack requires further source-level and encounter regression work.

## Remaining release blockers

1. Current legacy `private.character_equipment_effects_v1(uuid)` aggregates equipment bonus fields directly and currently does not accept per-contribution eligibility; `private.encounter_equipped_damage_mitigation_v1` processes structured resistance and typed flat reduction on equipped sources without the new selection gate. The tactical damage order must remain Resistance → highest matching flat reduction → Vulnerability (30 Fire → 15 → 5 in the campaign ring example).
2. Catalogue versus instance payload merge rules, physical armor/shield legality, weapon mastery/damage, saving throw and spell bonus provenance, class exceptions and active-encounter snapshots must be handled before changing consumers. Shadow arrays supplied by the client MUST NOT be treated as authoritative inventory state.
3. The attunement selection setter currently checks signed-in character permissions and active combat, but the inventory `restActivity` URL flag is **not server-verified proof of an eligible rest**. This remains a backend release blocker.
4. Existing equipped magic items exceeding the three-item limit need a non-destructive ON transition; ON should never silently strip physical equipment or change existing encounter snapshots.
5. Authenticated player/admin, multiple-character, keyboard/mobile and tactical smoke remain outstanding. All branches remain draft; do not merge into production.

No world or town maps, Forge, ItemCard presentation, original equipment slots, live Supabase rows, or deployed rules were changed.
