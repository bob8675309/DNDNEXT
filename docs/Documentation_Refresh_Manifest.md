# Documentation Refresh Manifest

Updated: 2026-08-08

## Purpose

This manifest identifies the current documentation authority for DNDNext while active subsystem branches continue to move faster than the older platform-wide roadmap. It changes documentation only.

## Authoritative starting points

For general platform/tactical history:

1. `Current_Development_Status_and_Roadmap.md`
2. `README.md`
3. the active subsystem or tactical phase ledger
4. current repository source and validators
5. live Supabase schema and migration history

For active Character Forge / progression PR #170, use these branch-specific documents **before** the older platform-wide roadmap:

1. `Unified_Character_Forge_Status.md` — shared NPC/player Forge state, choice cadence, current blockers, and protected boundaries.
2. `Character_Progression_Foundation.md` — creation/progression parity architecture, v5 level-up transaction model, normalized class-option authority, Battle Master, and Wizard spellbook/Savant chronology.
3. `Character_Forge_PR_A_Deployment_Evidence.md` — exact migration, CI, rollback, and acceptance evidence.

Where the Character Forge/progression section of `Current_Development_Status_and_Roadmap.md` conflicts with those three PR #170 documents, the three PR #170 documents control until the broader roadmap receives a full cross-system reconciliation. Historical exports and archived deployment runbooks are evidence only.

## August 8 Character Forge / progression checkpoint

Production now includes normalized progression authority through:

- XPHB Battle Master maneuver source normalization and earned/Forge progression;
- XPHB Wizard Savant earned progression;
- Wizard Savant level-1+ spellbook correction and higher-level Forge acquisition chronology/materialization.

Wizard Savant is acquisition-based rather than one cumulative current-level bucket: Wizard level 3 grants two matching-school level-1/2 Wizard spells; Wizard levels 5/7/9/11/13/15/17 each add one matching-school Wizard spell legal at that historical slot level. Cantrips are not Wizard spellbook entries.

Spell Mastery remains Long-Rest runtime configuration and is intentionally not a permanent Forge/level-up lock. Signature Spells remains pending.

## Earlier July 30 corrections retained

- records tactical foundations and reviewed adapters through Phase 1Z;
- records the completed Lightning Bolt server/client production gates and protected post-deploy baseline;
- marks older Shocking Grasp and Mind Sliver gates complete;
- replaces obsolete town bake/retry instructions with source-owned handoffs;
- updates loading, progression, spell, visual-runtime, and UI-polish backlogs;
- marks raw database/function exports as historical and non-executable;
- preserves strict separation between world, town/city, and tactical behavior.

## Protected boundaries

Character Forge/progression documentation changes do not authorize changes to world-map, town/city-map, route/travel/weather, encounter/combat, or unrelated crafting runtime behavior. Those systems retain their own controlling handoffs and acceptance history.
