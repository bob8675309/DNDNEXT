# Tactical Spell Execution and Magic Focus Scope Preflight — 2026-10-26

**Status: draft-only private read-only diagnostic; NO live casting or persistent-resource changes.**

## Exact execution paths discovered

Current `pages/encounters/combat.js` dispatches reviewed single-target spells among `encounter_cast_spell_v1` through `v13` according to spell identity; area spells and some effects have independent entry points. The user-facing spell profile alone is not the active execution authority. For example the source-controlled Guiding Bolt attack handler reads a raw sheet casting score and uses `coalesce(assignment.attack_bonus_override, abilityModifier + proficiency)`; Toll the Dead similarly uses `coalesce(assignment.save_dc_override,8 + abilityModifier + proficiency)`. Multiple reviewed writers compute their own roll/DC and are not subscribers to a unified equipment focus effect service.

Read-only production SQL inspection confirms `encounter_spellcasting_profile_v2` **calls `private.sync_character_spell_slots_v1`**, which can synchronize persistent character slot resources. For that reason the preflight calls only the earlier **read-only** `encounter_spellcasting_profile_v1` through the previously tested #282 source comparison and explicitly never invokes v2 or any `encounter_cast_spell_v*` function.

## New private comparison

`private.encounter_attuned_spell_execution_preflight_shadow_v1(participant_id,assignment_id)` validates an exact existing encounter participant and spell assignment belonging to that same character. On OFF, it returns the unchanged original profile and slot/known-spell snapshots. On ON, it independently computes candidate spell attack and saving-throw DC using the **spell assignment's casting stat** (falling back to class profile stat), the original profile proficiency, raw sheet ability for the legacy baseline, and source-selected ability scores/modifiers for the proposed candidate. Explicit numeric per-spell overrides are preserved on both sides and their provenance remains unverified; this is **not yet proof of precise behavior for every versioned writer**.

The result contains both numeric comparisons and an item-focused eligibility audit; it never rolls dice, chooses a target, decrements spell slots, mutates resources, logs a cast, modifies HP or calls any versioned casting RPC.

## Source-specific focus rules audited from actual catalogue text

| Item | Raw catalogue fields | Descriptive scope | Diagnostic status |
|---|---|---|---|
| +1 Rod of the Pact Keeper (XDMG) | `bonusSpellAttack=+1`, `bonusSpellSaveDc=+1` | While **holding** the rod; bonus to spell attacks and save DC of **Warlock spells** | Warlock class AND assignment class attribution must be checked; held state and stacking remain unverified |
| +1 Wand of the War Mage (XDMG) | `bonusSpellAttack=+1`, no save field | While **holding** the wand; **spell attack** only | Never infer save-DC bonus; non-attack spells do not qualify; held state unverified |
| +1 Arcane Grimoire (TCE) | `+1` to each | While **holding** book, to **Wizard spells** | Wizard class/spell source candidate only; held state unverified |
| +1 Amulet of the Devout (TCE) | `+1` to each | While **wearing** symbol, spell attacks/save DC | Worn state unverified |

The audit returns conservative `scopeStatus` codes such as `warlock_spell_candidate_requires_held_proof`, `spell_class_attribution_unverified`, `class_mismatch`, `spell_has_no_attack_roll` or `wizard_spell_candidate_requires_held_proof`. **Even when a focus is selected**, `appliedToPreflight=false`, `heldOrWornConfirmed=false`, `sourceSpellClassVerified=false`, and `stackingVerified=false`. These are NOT validated enhancement totals.

The source probe reads real server-side equipped item UUIDs, catalogue/instance payloads, existing per-character selection and exclusive account-shared state via #282. No user-provided focus list or custom effect array is authoritative.

## Isolated verification

A disposable PostgreSQL16 fixture composes the existing original spell profile, character/ownership/selection, equipment, and casting test data, then adds a save-only spell and a second character with a Wizard Grimoire. It verifies OFF exact baseline, Warlock spell attack/DC projected from original raw ability versus selected Staff CHA, fixed attack=11 and save DC=19 assignment overrides, Warlock source versus item-provided spell attribution, Rod/Wand scope and no fake save bonus, Wizard Grimoire class matching, unauthorized other-character assignment rejection, service-only function permissions and **exact preservation of every encounter spell-slot snapshot**.

The Node source validator additionally checks real tactical UI version-dispatch strings, original Guiding Bolt/Toll the Dead per-assignment override formulas, absence of any live writer calls or DML in the diagnostic SQL, and the v2 persistent-resource synchronization boundary.

## Remaining barriers before real gameplay integration

1. Explicit definition of **holding/wearing** versus legacy `is_equipped` / `equip_slot`, dual-wield focus conflicts, different classes and multi-class spell origin. Class membership alone cannot prove each spell was learned through the eligible class.
2. Trusted focus effect normalization, legal enhancement stacking, effect status and selection semantics; incomplete canonical item catalogue text/VAR/custom crafting provenance.
3. Per-version and per-spell execution adapters, spell resource accounting, action economy, reaction, concentration, immunity, damage/resistance, and target save resolution.
4. Active encounter snapshots must not be rewritten on item-selection changes. The separate profile-v2 persistent slot synchronization is explicitly **not safe to call during an inert shadow comparison**.
5. Verified rest-action authorization on the server, account-shared physical equipment custody, full character sheet/encounter parity, and signed-in player/admin browser tests.

**All effect enforcement/readiness flags remain false.** This is stacked on draft #282 and previous attunement PRs. No production Supabase migration, main merge, live UI, Forge, item art, world map or town map change.
