# Atomic Weapon Attack Candidate — 2026-10-27

**Draft PR #293, stacked on #292. Unmerged, undeployed, NOT connected to the live battleboard.**

## Purpose

The existing `encounter_weapon_attack_v1` and unarmed RPCs resolve one attack and spend the character's entire Action. #291 established source-derived base-class attack budgets; #292 established safe, read-only weapon/target validation. The next stage is a transaction proof for multiple weapon attacks within one Attack action.

## Staged implementation

The migration `sql/20261027_03_attack_action_atomic_weapon_candidate.sql` adds a **private, service-role-only** candidate RPC and separate attack-action and event ledgers. Both new tables are RLS-enabled with no direct browser access.

The candidate verifies actor control, exact turn, source-derived class capacity, target status, equipped weapon custody and exact catalogue identity. It locks attacker, target and encounter, then validates the next event ordinal. It spends one canonical Action on the first committed attack, not each subsequent event. It invokes the existing weapon-profile and targeting readers, then the canonical attack-roll and damage helpers, and writes an individual attack log, command result and saved event. Identical requests return their original result; mismatched reuse is rejected.

**A failed SQL transaction must roll back everything together:** Action spending, Guiding Bolt one-shot advantage consumption, damage, combat logs, and the event ledger.

This is an isolated, unconnected candidate, **not the deployed Extra Attack feature**. The existing public weapon/unarmed/opportunity attack functions have not been replaced.

## Verification

`scripts/fixtures/attack_action_atomic_weapon_candidate.sql` composes the previous equipment, spell, hand and attack source fixtures, then exercises an 11th-level Fighter's three allowed attacks. It includes a deliberately injected damage failure after the first attack has started and the advantage effect has been consumed. The test checks complete rollback, exactly one Action spent on successful execution, exact request replay without reroll or double damage, one effect-consumption log, and rejection of skipped/excess ordinals and unsupported inventory.

**Fixture limitation:** The PostgreSQL suite uses deterministic test doubles for attack rolls and damage, plus the previous synthetic targeting context. It does not prove the complete real damage resistances, live terrain, all class features or signed-in browser behavior.

## Release blockers

- Source resolution for subclasses, multiclass, Action Surge, bonus attacks, Light/Nick, special substitutions, monsters and reactions
- Attack-time grip, two-handed/Versatile weapons, shield Utilize, ammo, per-attack draw/stow
- Character-exclusive physical custody for account-owned equipment and focus/attunement rules
- Signed-in battleboard tests covering real Guiding Bolt, resistance/vulnerability, temporary HP, death and log parity
- Explicit production migration, endpoint exposure and rollout approval

All readiness flags remain false. Production Supabase, active combat writers, Forge, Equipment UI, and world/town maps are unchanged.

See [current effects integration handoff](Attunement_Effects_Integration_Current_Handoff_2026-10-26.md).

### Caller identity is not yet integrated

The candidate is **service-role-only** yet also checks `auth.uid()` and participant control. A typical server call using only a service-role token may have **no end-user UID**, so the candidate deliberately fails closed in that context. The disposable fixture injects a test UID and does **not** demonstrate a valid production server-to-user authorization bridge. Before any API route can call this function, design and test a trusted server-side actor identity and permission protocol that cannot be forged by an untrusted browser; do not remove the UID check simply to make the call work.
