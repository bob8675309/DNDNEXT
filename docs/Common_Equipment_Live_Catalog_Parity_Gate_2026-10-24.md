# Genuine DnDWeb catalogue-source parity — October 24, 2026

**Draft stacked test-only PR; based on #253 which is based on #251. No merges, migrations, production mutations, UI changes or consumer rerouting.** The goal is to close the meaningful distinction identified in the three-chat audit: prior PR #253 invoked the real legacy SQL function, but only on hand-authored item catalogue values.

## Evidence and scope
The source-controlled JSON snapshot in scripts/fixtures/common_equipment_catalog_source_snapshot_20261024.json contains **16 real item identities and verbatim selected structured payload fields** retrieved read-only from DnDWeb public.items_catalog. The complete source payload's MD5 is retained for drift investigation, but item descriptions, copyrighted prose, characters, owners and inventory state are omitted. The fixture constructs synthetic inventory records/character IDs **only in an isolated PostgreSQL 16 GitHub Actions service container**.

The seed script validates exact known canonical values (Ring of Protection, +2 Ring, Cloak, Staff of Power, genuine light/medium/heavy armor, Shield, Ascendant Ornament, Gloves of Soul Catching, Ioun Stone Mastery, Robe of Archmagi, All-Purpose Tool and campaign Resistance Ring). It emits deterministic SQL; never connects to production.

### Asserted **working legacy numeric output** and draft adapter equivalence
- Global saving throw bonuses and AC from real Ring, Cloak, Staff, and +2 Ring, while an unequipped item and another character's item contribute nothing.
- Synthetic instance JSON can override a matching catalogue numeric key without erasing unrelated catalogue bonuses; zero override is explicitly tested.
- The real numeric output composes through private.normalize_equipment_bonus_effects_v1 and private.resolve_effect_bundle_v1 for a saving throw; missing skills/initiative remain zero rather than fabricating source mechanics.
- Leather Armor 11, Scale Mail 14, Chain Mail 16, Shield 2 with negative Dexterity and real XPHB source type codes, through the **existing armor resolver**; no AC migration to the draft adapter.

### Explicit **coverage gaps** and known hazard
These tests deliberately **do not** claim functional gameplay support for:
- Gloves of Soul Catching \`ability.static.con=20\` (source-based stat replacement; the legacy effective CON score remains unchanged).
- Ascendant Scaled Ornament \`modifySpeed.equal.fly="walk"\` (legacy bonus AC works, flight does not appear in the numeric output).
- Ioun Stone Mastery \`bonusProficiencyBonus\` or Robe/All-Purpose Tool \`bonusSpellSaveDc\`, \`bonusSpellAttack\` (no corresponding numeric output keys).
- Staff of Power **attunement eligibility**. The current shared numeric resolver checks only \`is_equipped\`, does not use \`reqAttuneTags\`, and production inventory has no confirmed authoritative attunement-state column. Green parity merely establishes **current behavior**.
- The legacy resolver applies Shield AC even if the equipped Shield is assigned to an invalid \`back\` slot. This is a **known correctness/eligibility defect** revealed by source review; the fixture pins it as observed behavior, not approved gameplay rules. Fix requires separate scoped owner-reviewed implementation and encounter snapshot parity.
- Item resist/DR, immunity, conditions, spell-granted charges/durations, action/target legality, crafted effects and source-aware stacking. These belong to specialist authorities until tested.
- The extracted snapshot is a **selected structured subset** of 16 actual payloads, not a complete census of 2,739 items or production-character comparisons.

## Next gates
1. Determine authoritative attunement state and eligible equipped slots, and how existing caller/permissions enforce them; document before writing any mutation.
2. Use source-aware score replacement and spellcasting/movement adapters with context, stacking, rest/resource authority, and targeted tactical consumers.
3. Compare production-shaped current and draft outcomes, including equipped item attack/damage, Resistance before DR, full skills/Expertise, spell DC, vision, climb/swim/fly/burrow, saves, condition immunity, rest/encounter expiry.
4. Only then consider a separate **bounded consumer integration PR**. Maintain draft #250–#254 separation, protected maps, Forge appearance and paper-style sheet.
