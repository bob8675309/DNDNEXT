# Encounter Hand Rules & Spell Component Constraints — October 26, 2026

**Status:** Stacked draft PR #289, diagnostic only; NO live weapon interactions, Action/Bonus/Reaction expenditure, shield don/doff, spell casting or attunement effects.

## Verified source data and rules context

Read-only inspection of the **actual DNDNext live catalogue** found that weapon property codes are under **`items_catalog.payload.property` (singular)**, a JSON array, **not** `properties` or `weaponProperties`. Exact sample rows:

| Item catalogue key | `property` codes | Rule classification |
| --- | --- | --- |
| `Greatsword|XPHB` | `["H","2H"]` | Heavy, Two-Handed |
| `Longbow|XPHB` | `["H","A","2H"]` | Heavy, Ammunition, Two-Handed |
| `Longsword|XPHB` | `["V"]` | Versatile; **not** mandatory Two-Handed |
| `Quarterstaff|XPHB` | `["V"]` | Versatile |
| `Shield|XPHB` | `[]`, `type=S|XPHB` | Shield, separate from an Attack-action weapon interaction |
| `Animated Shield|XDMG` | `[]`, `type=S|XPHB` | Shield with an additional magical animation exception |

Live `spells_catalog` has typed `components_v`, `components_s`, `components_m`, `material_text` and `components_json`; these are much safer than guessing from an imported `raw_payload` description. Eldritch Blast is verbal+somatic, while the XPHB Witch Bolt entry also has a material component (lightning-struck twig). These are **sources for a diagnostic**, not sufficient by themselves for permission to cast.

2024 rules references (context, **not** runtime policy): [Attack Action](https://www.roll20.net/compendium/dnd5e/Rules%3ARules%20Definitions) describes equipping or unequipping a weapon before/after an attack as part of that Attack action; [2024 Free Basic Rules](https://marketplace.roll20.net/compendium/dnd5e/Rules%3AFree%20Basic%20Rules%20%282024%29) lists a **Utilize Action** for donning/doffing Shields; [Casting Spells](https://roll20.net/compendium/dnd5e/Rules%3ACasting%20Spells?expansion=32231&iframe=true) explains somatic and material hand prerequisites, focus substitution and free-hand conditions. These do **not** justify the experimental one-change-per-turn **shadow** quota from #288 as a D&D rule. The distinction between merely *holding* a Two-Handed weapon and needing two hands *while attacking* also must not be collapsed.

## New isolated private diagnostics

`sql/20261026_08_encounter_hand_rules_constraints_shadow.sql` adds `private.encounter_hand_rules_constraints_shadow_v1(participant_id, optional_character_spell_assignment_id)` (service-role-only ACL). It composes the signed-in participant's #287 captured snapshot and existing verified-equipment character custody. It rejects missing/invalidated snapshots and another character's spell assignment.

For every captured item it matches **exact catalogue identity** `items_catalog.item_key` (never guesses from display name); combines catalogue property codes and exact trusted DB item-instance payload, and classifies:
- `twoHandedPropertyObserved` and `twoHandedAttackGripConflictCandidate` if the other hand is occupied, even though `twoHandedAttackGripVerified=false`;
- `versatilePropertyObserved` without pretending it requires both hands;
- `shieldTypeCandidate` and `shieldDonDoffUtilizeContext`, with no automatic use of an Attack-action weapon interaction or shield feature activation;
- `weaponTypeCandidate` (Attack weapon interaction is contextual, not applied), `focusTypeCandidate`, `catalogExactMatch` and raw `property` codes;
- missing exact catalogue entry as an unresolved source, rather than inventing Two-Handed or Versatile properties from the name.

When supplied an exact character-owned spell assignment, the audit separately reports the canonical spell's normalized V/S/M flags and material description; a full-hand layout with S/M components yields **unverified somatic/material access signals**. A free snapshot hand yields only a *candidate*, not spell permission. A magic focus might substitute certain materials when allowed; War Caster can affect somatic gestures; spell costs, consumed material and components must be resolved separately.

All flags explicitly remain FALSE: `attackActionInteractionPaid`, `shieldUtilizeActionPaid`, `twoHandedAndShieldRulesVerified`, `somaticMaterialRulesVerified`, `activeHandsVerified`, `focusBonusApplied`, `combatConsumerEnforced`, `spellCastEligibilityVerified`, `warCasterExceptionVerified`, and `materialCostConsumptionVerified`.

This function **does not alter** #288's idempotent hand transition quota, the character's equipment, #287 snapshots, physical inventory, canonical action economy, spell slots, HP, battleboard logs, character sheet or magical effects. It is read-only server-side evidence to inform a later genuine action implementation.

## Disposable tests

`scripts/fixtures/encounter_hand_rules_constraints_shadow.sql` builds on all #288 PG16 fixtures and models the live item property and normalized spell-component fields. It tests Greatsword+Shield Two-Handed conflict, Greatsword with an empty off hand still **unverified grip**, Versatile Longsword as distinct from Two-Handed, Shield and Animated Shield rule exceptions, exact S/M versus S-only spells, denied foreign spell assignment, missing catalogue identity, stale snapshot failure, private ACL, unchanged participant resources and unchanged encounter spell slots. The dedicated Node validator prevents any live spell/attack/shield action modification; the workflow runs an isolated PostgreSQL16 instance and inherited shadow regressions.

## Explicit next work

1. Reconcile 2024 Attack-action **per-attack** weapon interactions with the battleboard's actual Attack-action + Extra Attack event lifecycle, and decide whether drawing/stowing has other legal cases. An arbitrary once-per-turn limit is not a substitute.
2. Separate Shield don/doff (Utilize action, proficiencies, Animated Shield exceptions) from a weapon's Attack-action equip event; the existing equipment manager's Shield in `weapon_2` alone is not a performed don/doff.
3. Model two-handed attack-time grip versus resting hold, Versatile damage mode, weapon/shield conflicts and hands temporarily freed for somatic/material spells, including War Caster and focus substitution.
4. Complete per-character physical custody, spell acquisition provenance, attunement server rest timing, magic-focus stacking, and per-version cast/attack writer parity before connecting shadow output to gameplay.
5. Signed-in gameplay acceptance and explicit production deployment approval remain outstanding. All #267→#289 PRs are stacked drafts; no production Supabase migration or maps/Forge changes.

See [Attunement_Effects_Integration_Current_Handoff_2026-10-26.md](Attunement_Effects_Integration_Current_Handoff_2026-10-26.md) for the continuously maintained release/dependency ledger.
