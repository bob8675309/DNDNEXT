# DNDNext — Composable Spell Engine with Human + Actor AI Compatibility
_Date: 2026-10-31. Status: **approved architectural direction for research only**, not an implemented engine, AI service, migration, or deployment._

## Required pre-implementation audit

Read [Spell_Engine_PrePivot_Audit_2026-10-31.md](Spell_Engine_PrePivot_Audit_2026-10-31.md) before implementing the recipe interpreter. It reconciles the archived common-effects work, real spell lifecycle and resource bridges, superseded optional attunement directions, and human/AI action authority. **This document alone is not permission to begin a runtime rewrite.**

## Decision and relevant source documents

Treat direct-damage and other tactical spells as **source-qualified, versioned recipes composed of reusable geometry, targeting, resolution, effect, and lifecycle primitives**, rather than implementing a separate hardcoded spell cast RPC for every catalogue entry.

**End-state requirement:** A human-controlled character and a future NPC/monster **Actor AI** must use **one legal-action contract and the same server-authoritative execution path**. AI can select or propose an action; it cannot author authoritative rules, arbitrary effects, rolls, HP, or persistence.

This refines [Tactical_Spell_Mechanics_Review_2026-10-31.md](Tactical_Spell_Mechanics_Review_2026-10-31.md), and must remain compatible with:
- [DNDNEXT_AI_INTEGRATION_FOUNDATION.md](DNDNEXT_AI_INTEGRATION_FOUNDATION.md): future provider-neutral, local-first AI; `generateText`, `generateStructured`, `chooseAction`; visible/actor-known/DM-only context; deferred implementation priority.
- [DNDNext_Effects_AI_Current_Handoff_2026-10-24.md](DNDNext_Effects_AI_Current_Handoff_2026-10-24.md): source/eligibility adapters, pure common effects research PRs #251/#253/#255, existing authoritative consumers, and never duplicated state authority.
- [Character_Effects_Cross_Conversation_Requirements_Audit_2026-10-24.md](Character_Effects_Cross_Conversation_Requirements_Audit_2026-10-24.md): lifecycle, provenance, stacking, scope and consumer parity; potential common numeric effects resolver is **not** a gameplay command.
- [Tactical_Encounter_Combat_Roadmap_Blueprint.md](Tactical_Encounter_Combat_Roadmap_Blueprint.md): independent tactical coordinates, server-owned movement/combat, geometry, concentration and GM-assisted fallback.
- [Current_Development_Status_and_Roadmap.md](Current_Development_Status_and_Roadmap.md): Milestone 3 shared rules and Milestone 4 scalable spell/ability adapters, without breaking existing RPC contracts.

This design **does not start the AI implementation**. The established product priority remains to complete/accept Character Forge and then begin AI with a local admin-only magic-item draft proof, followed by NPC dialogue and eventually bounded tactical decisions.

## Layer boundaries — avoid two overlapping effects engines

1. **Canonical catalogue + source grants**: `spells_catalog`, `spell_effects`, character spell assignments, source edition, features, class level, inventory/crafting effects. These describe sources and entitlement, not actual spell execution. The current `spell_effects` catalogue is a single broad record per spell, not an executable graph.
2. **Authorized actor and rules context**: controller/DM permission, actor type, character sheet, spell known/prepared and grant source, current resources, targeting visibility, timed effects, concentration, equipment/attunement and grants. Shared for human UI and actor AI; source-specific eligibility cannot be invented from the model's input.
3. **Reviewed spell recipe registry**: a bounded set of declarative, allowlisted operations with `spellKey` including source/edition, schema/recipe version, geometry, attack/save/auto-hit nodes, effects, trigger branches, repeat rules, target requirements, scaling, resource/lifecycle constraints. Recipes must be *reviewed catalogue content*, never free-form player/AI-authored JSON.
4. **Canonical arithmetic/effects calculation**: existing live damage/mitigation/roll/condition/stat authority; optional future **pure** common character-effects resolver (draft #251 and dependent parity work), only after equivalence proof. It calculates eligible modifiers, stacking and typed defenses, but does not select targets, spend an Action or commit a spell.
5. **Authoritative action executor**: server calculates legality and performs bounded transaction: lock/revalidate actor, target/cover/LOS, spell identity/entitlement, Action/Bonus Action/Reaction, slots/charges/concentration, repeat/branch nodes, RNG, typed damage/heal, timed state, logging/version and idempotency. All writes happen here, never in a model, client, catalogue importer or untrusted recipe.
6. **Read models and presentation**: render permitted targets and possible choices for a human; supply strictly **visibility-filtered** legal options and selected effect explanations for future AI, without leaking hidden enemies, secrets, concealed stats, NPC DM-only memory, or backend credentials.

### Suggested primitive families

- **Geometry/targets:** self, single creature/object, target list, occupied/unoccupied hex, point origin, ray/line, cone, sphere/radius, cube, emanation, persistent zone; distances on tactical hexes, blocking LOS, cover, friend/enemy and target repetition constraints.
- **Resolution:** ranged/melee spell attack, independent repeated attack, saving throw, auto-hit, contests/ability check, advantage/disadvantage, critical, miss/partial-success branches, upcast and total-character-level scaling.
- **Effect nodes:** typed dice damage, mitigation, healing/temp HP, condition apply/remove, forced movement, speed/vision/AC modifiers, teleport, summon, resource adjustment, persistent damage, concentration, trigger and duration; source-owned feature modifiers or exceptions only with verified eligibility.
- **Flow:** sequential/parallel steps, conditional `onHit`, `onMiss`, `onSaveSuccess`, `onSaveFail`, `onTurnStart`, `onTurnEnd`, `onConcentrationEnd`; repeat counts and explicit rules for simultaneous effects and target deduplication. Never infer ordering merely from `effect_index` in current catalogue records.

**Example:** 2024 `ice-knife|XPHB` = select creature → ranged spell attack → if hit apply piercing → whether hit or miss place 5-ft explosion at its position → affected creatures roll Dexterity saves → cold damage on failures. The same primitives compose `fire-bolt|XPHB`, `scorching-ray|XPHB`, `fireball|XPHB`, `magic-missile|XPHB`, and `healing-word|XPHB` with different branches/resources and special constraints. No spell is castable simply because it classifies into a primitive family.

## Human and AI receive the same action authority

Future **conceptual API**, not existing runtime functions:

```text
authorizedActorContext = buildEncounterActorContext(actorId, encounterId, viewerId)
actionOptions = listLegalEncounterActions(actorId, encounterId, viewerId)
  -> server-created action IDs/types and parameter constraints
  -> human UI renders controls OR dndnextAI.chooseAction(context, options)
  -> proposed action ID + permitted parameters + request UUID
  -> existing guarded server command/revalidation
  -> authoritative rolls, effects, version, action log
  -> visibility-filtered results for human/AI narration
```

Do not let AI compose executable effect nodes from conversation text. It can choose a **server-published approved action** and permitted target/parameter values, just like a human. Large hex/target option spaces may use **two-stage bounded querying** (action family then server-validated target/geometry options); the selected values must still belong to an authorized, state-versioned options set. All options are revalidated at commit to handle turn changes, movement, visibility, spell-slot depletion, concurrent actions and stale results. A GM-assisted/manual option remains available for unsupported spells; no false automation.

**Critical security distinction:** the model's own actor knowledge may differ from the current player's allowed view; a player-facing AI response receives only the intersection that is appropriate for that actor *and viewer*. A hostile AI NPC may plan from its actor-known game state but should never be given DM-only truths or hidden player data merely because it is a model.

For future automated NPC turns, enforce bounded decisions, fallback on timeout/invalid choice, actor controller/GM scope, deterministic/legal testing, rate limits, idempotent request identity and standard audit events. Avoid coupling model inference to open database transactions. `AI Off` and manual human/GM control must continue working.

## Research implementation order (no deployment authorization)

1. **Inventory existing primitives and pending effects work** (including the draft #251/#253/#255 chain and current live `encounter_*_v*` consumers). Draw a source-to-consumer compatibility matrix. Do not create a parallel character modifier resolver.
2. **Write a versioned recipe schema and interpreter contract**, including legal action discovery, bounded parameters and source-qualified IDs. Keep it pure/read-only at first and use synthetic examples. Unit tests must reject arbitrary node names, unknown sources, unauthorized modifiers and malformed branching.
3. **Prove parity** against existing Fire Bolt, Sacred Flame, Magic Missile, point/line/cone spells and the tested Eldritch Blast research candidate in disposable local PostgreSQL/Auth. Old entry points remain intact; compare targets, range, hit/save distributions, damage stages, cost, logs and idempotency. Do not copy a single spell's lifecycle into a different spell.
4. **Test hybrid recipes** (Ice Knife, Scorching Ray, conditional damage and duration) without enabling gameplay. Verify repeat targets, simultaneous vs sequential effects, ongoing triggers, and roll scopes.
5. **Add safe human-readable option previews** driven by the exact registry; no browser-executed rules authority. Later provide the same server-filtered legal action options to the future AI consumer as a separate, expressly approved workstream.
6. **Release gates**: isolated regression and real signed-JWT tests, source and privilege audit, actual browser/controller smoke, no production SQL or merge without owner approval, no paid hosted staging.

## Non-goals / protections

No implementation of an AI bot in this document. No provider dependencies, model downloads, AI-specific database columns, raw model-authored SQL/JS, unrestricted Supabase access, manual bypass of character grants, map edits, world-time or town travel behavior changes. Tactical map coordinates and world/city simulation remain independent. Preserve human player turns, GM overrides, 2024-vs-2014 source distinctions and existing production rules throughout the migration.
