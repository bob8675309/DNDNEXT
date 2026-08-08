# Documentation Refresh Manifest

Updated: 2026-08-08

## Purpose

This manifest identifies the current documentation authority for DNDNext while active subsystem branches move faster than the older platform-wide roadmap. Current repository source and live Supabase remain higher-trust than historical prose.

## Authoritative starting points

For general platform/tactical history:

1. `Current_Development_Status_and_Roadmap.md`
2. `README.md`
3. the active subsystem or tactical phase ledger
4. current repository source and validators
5. live Supabase schema and migration history

For active Character Forge / progression PR #170, read these branch documents before older platform-wide Forge text:

1. `Unified_Character_Forge_Status.md` — current shared NPC/player Forge state and remaining blockers.
2. `Character_Progression_Foundation.md` — creation/progression architecture and normalized authority boundaries.
3. `Character_Forge_PR_A_Deployment_Evidence.md` — migration/build/rollback evidence.
4. `Character_Progression_and_Higher_Level_Forge.md` — higher-level replay / earned-progression convergence.
5. `Wizard_Spell_Mastery_Runtime_Status.md` — detailed migration-44 runtime evidence.
6. `Player_Forge_Starting_Magic_v3_Status.md` — detailed migrations-47/48 Spell-step authority and rollback evidence.
7. `DNDNext_Current_Handoff_Prompt.md` — copy-ready takeover prompt after reconciliation.

If those documents conflict with the Character Forge/progression section of `Current_Development_Status_and_Roadmap.md`, the PR #170 documents control until the broader roadmap receives a full cross-system rewrite.

## August 8 Character Forge / progression checkpoint

Production now includes:

- Battle Master normalized maneuver authority and earned/Forge progression — migrations 38-39;
- Wizard Savant earned progression and higher-level Forge chronology — 40-41;
- Wizard Signature Spells and explicit free-cast resource labels — 42-43;
- Wizard Spell Mastery Long-Rest runtime configuration — 44;
- class-granted Weapon Mastery Long-Rest runtime authority — 45;
- per-instance Weapon Master feat runtime weapon authority and combined mastery projection — 46;
- guarded multi-source Player Forge starting-magic v3 completion — 47;
- authenticated-only Player Forge v3 ACL cleanup — 48.

### Creation / progression / runtime split

Persistent decisions still follow creation/progression parity. Rest-configurable features are not frozen into Forge state.

Current examples:

- Savant / Signature → persistent spellbook/progression state;
- Spell Mastery → runtime Long-Rest state;
- class Weapon Mastery → runtime Long-Rest state;
- Weapon Master feat current weapon → per-grant runtime Long-Rest state;
- Player Forge Spell-step starting magic → server-authoritative creation state through v3.

### Starting-magic checkpoint

The shared Player Forge now calls `create_player_character_v3` and serializes exact `startingMagicSelections` for:

- native class-list spells;
- Background-expanded class access;
- Eldritch Knight subclass spells;
- Arcane Trickster subclass spells including fixed Mage Hand.

Species/feat/class-feature grants remain separate source-owned systems.

Migration-47 rollback proofs used the real authenticated public v3 RPC for native Wizard, a non-native Background-expanded Wizard spell (Entangle), Eldritch Knight, and Arcane Trickster. Invalid expansion, invalid fixed spell, and duplicate exact selection were rejected atomically with no residue.

Migration 48 removed the stale explicit anonymous execute grant from v3; v1/v2/v3 now expose the same authenticated/service-role execution surface.

### Current CI / integrity checkpoint

The exact PR head that introduced the migration-48 contract passed the dedicated Player Forge v3 semantic validator and full repository production build gate. Broader Forge/progression workflows also remained green at the implementation checkpoint.

Final live integrity after rollback proofs and migrations 47-48:

- 7 characters;
- 7 sheets;
- 30 character-spell assignments;
- 7 progression rows;
- 0 open level-up sessions;
- 0 synthetic `__v3_*` characters;
- 0 QA starting-magic rows;
- world baseline 20 locations / 4 routes / 9 route points.

## Remaining active PR #170 work

The guarded multi-source starting-magic blocker is closed. Remaining major work:

1. remaining runtime cadence families such as Astral Trance, Circle-of-the-Land choices, Primal Companion, Dread Allegiance, Fiendish Resilience, and per-use Steps of the Fey;
2. source-backed starting equipment packages and higher-level starting wealth/equipment;
3. character-scoped starting currency;
4. Artificer wildcard Magic Item Plan concrete-item instances;
5. remaining persistent/conditional source-choice audit;
6. obsolete authenticated progression RPC cleanup;
7. authenticated browser acceptance;
8. merge PR #170 only after those gates close.

## Protected boundaries

Character Forge/progression documentation does not authorize world-map, town/city-map, route/travel/weather, encounter/combat, or unrelated crafting changes. Those systems retain their own controlling handoffs and acceptance history.
