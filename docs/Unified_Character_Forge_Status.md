# Unified NPC and Player Character Forge Status

Status date: 2026-08-08
PR: #170 (`agent/character-forge-resilience-presentation`)

## Current state

The shared Character Forge is the intended creation surface for NPCs and player-owned characters. PR #170 remains open and unmerged. Source validation, production builds, live migrations, and rollback-only database proofs are strong regression evidence but are not final authenticated browser acceptance.

The governing parity rule remains:

> A character created directly at level N and a character that earns level N through XP should converge on equivalent **persistent** source-owned state.

Rest-configurable, Short-Rest, Long-Rest, per-use, and informational decisions are not converted into permanent Forge locks merely because imported source text contains choices.

## Choice semantics

The shared Forge distinguishes cadence and placement explicitly.

- `creation` / attained-level persistent choices → authoritative Forge/progression state.
- `training` → proficiency-dependent choices such as Expertise.
- `spells` → persistent choices whose legal options depend on the assembled spellbook, such as Wizard Signature Spells.
- Long-/Short-Rest choices → guarded runtime configuration.
- per-use choices → runtime/action UI.
- informational features → display only.

Examples now modeled correctly:

- Wizard Signature Spells → permanent spellbook-dependent choice.
- Wizard Spell Mastery → Long-Rest runtime configuration.
- class-granted Weapon Mastery → Long-Rest runtime configuration.
- Weapon Master feat weapon → per-feat-instance Long-Rest runtime configuration.

## Player creation authority

Player creation is server-authoritative. Live generations include `create_player_character_v1`, `v2`, and `v3`.

The **shared Player Forge now calls `create_player_character_v3`** for Spell-step creation authority. It no longer stops at v2.

The Forge serializes exact Spell-step state into `sheet.startingMagicSelections`. v3 owns:

- native class-list starting spells;
- Background-expanded class access;
- XPHB Eldritch Knight starting spellcasting;
- XPHB Arcane Trickster starting spellcasting, including fixed Mage Hand.

Species, feat, and unrelated class-feature spell grants remain owned by their separate source systems.

Migration 47 completes the v3 frontend/server/deferred-validator boundary. Migration 48 removes the stale explicit `anon` execute grant from v3 so v1/v2/v3 now expose the same intended authenticated/service-role surface.

See `Player_Forge_Starting_Magic_v3_Status.md` for exact contracts and rollback evidence.

## Earned progression authority

The active Level Up UI submits to `complete_character_level_up_v5`. v5 composes reviewed v4/v3 progression with source-owned acquisition/replacement work in one transaction.

Connected persistent families include:

- one-level-at-a-time XP advancement;
- fixed/rolled HP;
- subclass entry;
- ordinary class spell acquisition;
- General feat / Epic Boon advancement;
- persistent simple class choices;
- Bard Magical Secrets;
- Lore Magical Discoveries;
- Draconic Elemental Affinity;
- Champion Additional Fighting Style;
- Sorcerer Metamagic acquisition/replacement;
- Warlock Mystic Arcanum acquisition/replacement;
- Magic Initiate per-instance spell replacement;
- Eldritch Invocation acquisition/replacement, prerequisites, dependent choices, repeatability, and Lessons of the First Ones;
- Battle Master maneuver acquisition/replacement;
- XPHB Wizard Savant spellbook chronology;
- XPHB Wizard Signature Spells.

Direct authenticated v3/v4 level-up completion is revoked. Legacy `complete_character_level_up_v1/v2` still retain authenticated execute and remain an explicit authority-cleanup item once confirmed unused.

## Battle Master

Migrations 38-39 normalize the 20 XPHB Battle Master maneuvers into generic class-option instances shared by higher-level Forge and earned progression.

Cumulative maneuver counts are 3 / 5 / 7 / 9 at Fighter levels 3 / 7 / 10 / 15. Later gains require two new maneuvers and permit one optional replacement while preserving the original maneuver-slot acquisition level.

Known presentation debt remains: while Fighter-3 subclass selection is pending, the generic renderer can show a clearly labeled Battle-Master-only group before subclass selection resolves. Server enforcement is correct; conditional hide/require polish remains for final browser acceptance.

## Wizard authority

### Savant — migrations 40-41

Savant is live for Abjurer, Diviner, Evoker, and Illusionist across earned progression and direct higher-level Forge.

Savant spellbook additions use `source_type='class-feature'` plus `raw_payload.wizardSpellbook=true`; they do not inflate ordinary base-Wizard class spell counts.

Historical acquisitions are replayed at 3/3/5/7/9/11/13/15/17. Cantrips are not Wizard spellbook entries. Cross-provenance duplicate spellbook membership is rejected.

### Signature Spells — migrations 42-43

Signature Spells is a permanent Wizard-20 choice of exactly two level-3 spells already in the **final normalized spellbook**.

Direct Forge places the choice on the Spells step. Earned Wizard 19→20 applies ordinary level-20 Wizard spellbook acquisition first, then Signature validation, so same-transaction learned level-3 spells may qualify.

A Savant-granted level-3 spell may also be selected as a Signature Spell without duplicating spellbook membership.

Signature overlays the existing spell row, preserves original provenance, marks it prepared/always available, and adds one tracked free level-3 cast recharging on Short Rest. Existing rest authority restores the use on Short or Long Rest. Migration 43 adds the explicit character-sheet resource label/protection.

### Spell Mastery — migration 44

Spell Mastery is live as guarded runtime state, not a permanent Wizard-18 Forge choice.

An XPHB Wizard 18+ configures one level-1 and one level-2 Action spell from the actual normalized Wizard spellbook. Both are always prepared and usable at their lowest level without expending a spell slot.

Initial configuration is immediate. A later replacement requires a **newer Long Rest** and may replace at most one mastered spell with an eligible spell of the same level. The old spell's prior prepared/availability state is restored when mastery moves. Configuration is blocked while an active encounter owns character resources.

See `Wizard_Spell_Mastery_Runtime_Status.md` for exact evidence.

## Weapon Mastery runtime authority

### Class-granted Weapon Mastery — migration 45

Class-granted XPHB Weapon Mastery is runtime cadence state rather than a permanent Forge selection.

Source-backed capacities include Barbarian, Fighter, Paladin, Ranger, and Rogue progression. Canonical options come from XPHB mundane `items_catalog` rows with mastery metadata and class-specific eligibility restrictions.

New capacity can be filled immediately. Replacing an existing active mastery requires a newer Long Rest; no-op preserves the opportunity; more than one old selection is rejected; a second change on the same rest is rejected.

### Weapon Master feat — migration 46

Every XPHB Weapon Master feat grant instance owns an independent Long-Rest runtime weapon selection while the permanent feat grant and original nested acquisition choices remain immutable audit history.

Migration 46 also centralizes the derived `sheet.weaponMasteries` projection as the union of class-granted runtime masteries plus every active Weapon Master feat instance. Authenticated class writes use `configure_character_weapon_mastery_v2`; the old v1 class writer is no longer the authenticated surface.

## Guarded multi-source starting magic — migrations 47-48

This blocker is **complete**.

The shared Player Forge now sends exact Spell-step authority through `create_player_character_v3`.

### Native class spell

Stored as class source with canonical class key/label/casting stat and validated against the native class spell list.

### Background-expanded class access

Still consumes the ordinary class spell-count slot, but the selected spell may be outside the native class list when its name is explicitly granted by `sheet.backgroundExpandedSpells`.

v3 gives v2 a temporary same-level native proxy only for v2's historical count validation, removes v2-created temporary/base rows, and then inserts the exact expanded-access row.

Production rollback proof used **Entangle** for a level-1 Wizard; Entangle is Druid/Ranger in the preferred catalogue, proving this was real expanded access rather than a native-list coincidence.

### Eldritch Knight / Arcane Trickster

Fighter/Rogue base classes remain noncasters. The deferred v3 validator recognizes the canonical subclass and validates subclass-source Wizard-list spells with Intelligence.

Rollback proof established:

- Eldritch Knight 3 → 2 cantrips + 3 prepared level-1 spells;
- Arcane Trickster 3 → fixed Mage Hand exactly once + 2 additional cantrips + 3 prepared level-1 spells.

### Fail-closed / ACL evidence

Rollback proofs rejected atomically:

- undeclared Background expansion;
- invalid Arcane Trickster fixed spell;
- duplicate exact starting-magic selection.

No temporary v2 character/spell state survived the rejected calls.

Migration 48 removes a stale explicit `anon` execute grant. v1, v2, and v3 now expose only owner/postgres, `authenticated`, and `service_role` execution.

## Current production integrity checkpoint

After migrations 47-48 and all rollback fixtures:

- 7 characters;
- 7 character sheets;
- 30 character-spell assignments;
- 7 progression rows;
- 0 open level-up sessions;
- 0 synthetic `__v3_*` characters;
- 0 QA `startingMagic=true` rows;
- 20 world locations;
- 4 map routes;
- 9 map route points.

No world-map, town/city-map, route/travel/weather, combat, or crafting behavior changed in this slice.

## Remaining PR #170 blockers

The guarded multi-source starting-magic blocker is closed. Remaining work is:

1. extend the runtime cadence framework to remaining families such as Astral Trance, Circle-of-the-Land choices, Primal Companion, Dread Allegiance, Fiendish Resilience, and per-use Steps of the Fey;
2. source-backed starting equipment packages and higher-level starting wealth/equipment;
3. character-scoped starting currency for multi-character accounts;
4. Artificer wildcard Magic Item Plan concrete-item instances;
5. remaining persistent Species / Background / Class / Feat / Subclass coverage and conditional-choice UI audit;
6. audit/revoke obsolete authenticated level-up completion RPC generations when confirmed unused;
7. authenticated browser acceptance across representative low/high-level, martial/caster, nested-feat, subclass, starting-magic, and runtime-rest cases;
8. merge PR #170 only after those gates are satisfied.

## Protected boundaries

This work does not authorize changes to world-map, town/city-map, route/travel/weather, encounter/combat, or unrelated crafting behavior. `components/MapPageClient.js` remains outside PR #170 Forge/progression work.
