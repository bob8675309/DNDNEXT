# Attunement-aware tactical mitigation — legacy comparison shadow (2026-10-25)

**Status: draft-only, no gameplay consumer changes or live SQL deployment.**

## Existing authoritative behavior retained

The deployed tactical consumer `public.encounter_apply_damage_internal_v1` continues to use `private.encounter_equipped_damage_mitigation_v1`. The current canonical damage order is **immunity → Resistance → highest applicable flat damage reduction → vulnerability → temporary HP → HP**. The DNDNext Ring of Fire Resistance test example remains **30 Fire → 15 after Resistance → 5 after flat 10**. The original `20261016_07` damage writer has a superseded order; the authoritative correction is `20261016_08` and must never be reverted.

## New private comparison surface

`private.encounter_attuned_damage_mitigation_shadow_v1(character_id,damage_type)` returns a **baseline** calculated by the unchanged legacy helper and a separate **shadow** result. It reads the authoritative, server-derived character inventory/attunement source gate from #274; no browser/client-asserted equipment identities or source effects are accepted.

- Rule **OFF** returns the exact legacy mitigation object as both baseline and shadow, without requiring selection and without recalculating source math.
- Rule **ON** uses the same underlying inventory ownership, catalogue lookup order, instance payload scan, structured `resist` array/string, and max matching `damageReductionByType` or snake_case key as the original helper, but excludes item magic riders not eligible for the given character.
- A player-account-owned item attuned to one character may appear in another character's legacy-equipped inventory view. It remains physically present but its magical resistance and flat reduction should not leak to the second character's shadow candidate.
- The return includes `consumerEnforced=false`, `attunementEnabled`, the legacy baseline, shadow candidate, a difference flag, and the server-derived source audit.

## Fixture assertions

An isolated PostgreSQL16 suite runs the existing campaign-rule, rest choice, and inventory source-gate fixtures with their original database-like schema. It then compiles the original legacy mitigation helper and the new shadow. The test adds genuine-shaped catalogue and instance `resist`/typed reduction sources and compares returned JSON at OFF, checks a chosen Ring of Fire Resistance retaining the 30→15→5 mitigation, checks suppression when the ring is not chosen but a lesser shared-item source is selected, checks that the shared item does not leak magical protection to the second character, confirms unknown rare source payloads are not automatically trusted, confirms unequipped items never count, and verifies private ACLs.

## Not production ready

Typed damage reduction on mundane or otherwise exceptional physical gear needs source classification, and magic-source detection must be reconciled with the real catalogue-plus-instance precedence and per-item metadata; this shadow presently treats the helper's structured mitigation as the item's magical rider unless the gate explicitly permits it. Combat encounters also use snapshots whose lifecycle cannot be altered silently. **This does not invoke or replace the live damage writer and does not change HP or any encounter rows.**

Additional gates: a server-authenticated rest opportunity; verified ownership/provenance; parity for numeric AC/saves, spell attack/DC, weapons, class exceptions and conditions; and signed-in admin/player browser and tactical tests. The three-item effect restriction is not yet enforced in production; the dashboard must continue reporting enforcement **not ready**. No world/town map, Forge, ItemCard, or equipment-slot changes.
