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

1. `Unified_Character_Forge_Status.md` — shared NPC/player Forge state, explicit choice cadence/placement, live Wizard parity, remaining blockers, and protected boundaries.
2. `Character_Progression_Foundation.md` — creation/progression parity architecture, v5 transaction model, normalized class-option authority, Wizard spellbook/Savant/Signature authority, and rollback policy.
3. `Character_Forge_PR_A_Deployment_Evidence.md` — exact migration, CI/build, rollback, production-integrity, and acceptance evidence.
4. `Character_Progression_and_Higher_Level_Forge.md` — current architectural handoff for permanent higher-level replay and earned-progression convergence. Older v3-only language has been retired from this document.

Where the Character Forge/progression section of `Current_Development_Status_and_Roadmap.md` conflicts with these PR #170 documents, the PR #170 documents control until the broader roadmap receives a full cross-system reconciliation. Historical exports and archived deployment runbooks are evidence only.

## August 8 Character Forge / progression checkpoint

Production now includes normalized progression authority through:

- XPHB Battle Master maneuver source normalization and earned/Forge progression;
- XPHB Wizard Savant earned progression;
- Wizard Savant level-1+ spellbook correction and higher-level Forge acquisition chronology/materialization;
- XPHB Wizard Signature Spells in direct level-20 Forge creation and earned Wizard 19→20 progression.

### Wizard spellbook state

Wizard Savant is acquisition-based rather than one cumulative current-level bucket: Wizard level 3 grants two matching-school level-1/2 Wizard spells; Wizard levels 5/7/9/11/13/15/17 each add one matching-school Wizard spell legal at that historical slot level. Cantrips are not Wizard spellbook entries.

Signature Spells is a permanent Wizard-20 choice of two level-3 spells already in the final normalized spellbook. It is placed on the Forge **Spells** step because eligibility depends on actual spellbook membership. Signature overlays the existing spell row rather than adding duplicate membership, preserves source provenance, and adds one `short_rest` free-use resource restored by the existing Short/Long Rest authority.

Direct level-20 Forge materializes Savant before Signature; earned 19→20 progression materializes ordinary level-20 Wizard spells before Signature. Both directions are rollback-proven.

Spell Mastery remains Long-Rest runtime configuration and is intentionally not a permanent Forge/level-up lock. It is the next Wizard-specific runtime slice.

### Migration / validation checkpoint

Live production migrations now include:

- `wizard_savant_spellbook_progression`
- `wizard_savant_forge_chronology`
- `wizard_signature_spells_authority`

Runtime source head `9740d66a45b215805a6c988c25874a01d1e35e55` passed all five PR GitHub Actions workflows and the repository's exact `npm run build:vercel` production build inside CI. Hosted Vercel itself was blocked by the account build-rate limit and is not claimed successful for this checkpoint.

Migration 42 rollback proofs covered successful resource overlay/rest recovery, fail-closed invalid submissions, a full level-20 Abjurer higher-level Forge replay using a Savant-granted Signature Spell, and an authenticated Wizard 19→20 v5 transition using same-level learned Signature Spells. Final integrity remained 7 characters / 7 sheets / 30 spell assignments / 7 progression rows, with zero synthetic proof residue and world baseline 20 locations / 4 routes / 9 route points unchanged.

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
