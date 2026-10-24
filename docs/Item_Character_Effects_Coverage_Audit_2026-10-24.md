# Item and Character Effects Coverage Audit — 2026-10-24

**Status:** read-only architecture/field coverage gate. No effect migrations, runtime changes, production DB writes, Forge/Profile UI changes, or PR #250/#251 modifications.

## Baseline and scope
- `main` audited at `f55c224006dbc9c3613470cafa2cf65e7c350f00`. Re-fetch before any implementation.
- Live Supabase `DnDWeb` project `ucggczovhmauhshvhusx`, read-only catalogue inventory queries.
- 2,739 catalogue rows; 19 inventory rows when sampled. Counts are field **presence**, not active equipped effects or functional proof.
- `node scripts/validate_item_effect_coverage_audit.mjs` provides regression *contracts*, not a comprehensive runtime parity test. It intentionally fails on missing known integration seams and reports unwired fields without falsely passing them as implemented.

## Actual data flow (do not conflate display and authority)
1. `scripts/build-all-items.mjs` and `scripts/seed_items_catalog.mjs` import upstream source + homebrew, resolve `_copy` inheritance with `scripts/lib/resolve_item_copies.mjs`, apply `scripts/lib/campaign_item_overrides.mjs`, preserve source mechanic fields and upsert `items_catalog`.
2. Merchant, starting equipment, crafting and inventory flows create or modify `inventory_items.card_payload`. Check individual instance overrides and ownership before computing.
3. `components/ItemCard.js` imports `utils/itemCardText.js` to **present** bonuses, duration, attunement, damage, immunity and resistance. Neither component is a combat authority.
4. `utils/equipmentEffects.js` derives local numeric modifiers and conservative wearer text-derived Advantage/Disadvantage. `pages/npcs.js` and `components/NpcPanel.js` pass results to `CharacterSheetPanel`.
5. `private.character_equipment_effects_v1` (SQL) merges matching `items_catalog.payload || inventory_items.card_payload`, enumerates equipped item instances, and computes numeric AC/ability/save/check/initiative outputs. `public.character_equipment_effects_v1` provides permission-controlled access. `utils/authoritativeEquipmentEffects.js` merges numeric server values over local display effects, preserving local Advantage/Disadvantage and reminders. `CharacterSheet5e.js` renders the final sheet formulas.
6. Tactical weapon profiles independently consume `bonusWeapon`. Tactical typed-damage mitigation consumes equipped `resist` and `damageReductionByType`. Neither is equivalent to a flat sheet bonus.

## Live structured source-field presence

| Field | Catalogue rows | Verified path | Status |
|---|---:|---|---|
| `bonusWeapon` | 195 | weapon profile and sheet weapon action | Separate supported mechanism |
| `resist` | 121 | tactical equipped damage mitigation | Supported for matched damage types |
| `bonusAc` | 80 | shared numeric equipment and sheet | Supported |
| `bonusSpellAttack` | 40 | ItemCard/merchant presentation | **No matching numeric consumer located** |
| `bonusSpellSaveDc` | 27 | ItemCard/merchant presentation | **No matching numeric consumer located** |
| `conditionImmune` | 18 | ItemCard presentation | **No equipped gameplay consumer verified** |
| `immune` | 14 | ItemCard presentation | **No equipped gameplay consumer verified** |
| `damageReductionByType` | 10 | tactical typed damage mitigation | Separate supported mechanism |
| `bonusProficiencyBonus` | 1 | ItemCard presentation | **No numeric consumer located** |

All counts come from a read-only JSON-key audit; an item may have multiple fields. Some effects may be controlled by other active spells, class features, uses or targeted commands. Missing direct consumer is a coverage **investigation**, not automatically a confirmed player bug.

## Source ownership and compatibility hazards
- **Catalogue vs instance:** live `private.character_equipment_effects_v1` uses `catalogue || instance` (right-hand instance properties override). The local parser reads `row.card_payload` alone; parity is not guaranteed when fields exist only in the catalogue.
- **Ability changes:** bonuses to score, direct modifier, and final derived check/save/attack differ. AC cannot be represented as an unconditional flat `ac` when armor/Dex caps/unarmored defense matter.
- **Spell focus:** magic focus `bonusSpellAttack`/`bonusSpellSaveDc` requires source/class/attunement/specific spell eligibility checks, not universal addition.
- **Weapon:** attack/damage bonus must remain item- and attack-specific; do not add it to all attacks.
- **Resist/immune:** typed damage, reduction ordering, character/condition resistance and damage immunity need targeted consumers and lifecycle checks.
- **Wearer vs target:** conditional saving throws, stealth checks against the wearer and other-creature effects must never become unconditional wearer bonuses.
- **Per-use:** charges, action economy, potion consumption, attunement and rest/concentration have existing authorities and cannot be deduced from card text.
- **Staged encounters:** existing combat snapshots and permissions are not to be overwritten by a generic getter.
- **Stacking:** source-group selection must implement particular item/spell/features rules, not `max(abs(value))` universally.

## Required parity matrix before integrating PR #251
1. Catalog-only bonus vs inventory override; repeated copies; wrong equip slot; unequipped item.
2. Unarmored (including Monk/Barbarian), light/medium/heavy armor, shields, negative Dex and alternative base AC.
3. Score bonuses vs direct ability-modifier bonuses, all/specific saves and checks, Expertise and initiative.
4. `bonusWeapon` with physical/ranged, proficiency, attack and damage; compare sheet and tactical profiles.
5. Class-specific spellcasting focus bonuses (spell attack and save DC), attunement and conditional applicability.
6. Resistance + typed flat reduction + vulnerability, immunity and condition immunity (distinguish implemented/unimplemented).
7. Active effects during encounter stage/start/turn/expiry; HP changes, speed refresh, source provenance and idempotency.

## Release gate
**No production migration or consumer replacement** until executable isolated fixture tests exercise representative real source payloads and demonstrate unchanged established numeric/tactical outcomes. Implement missing consumers as separately reviewed slices only after eligibility/ownership verification. Keep the draft Physical Specimen PR #250 and common effects PR #251 unmerged during parity testing. No map changes.
