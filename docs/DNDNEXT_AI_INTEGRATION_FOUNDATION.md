# DNDNext AI Integration Foundation

Status date: 2026-10-09

Status: **architecture direction only; implementation intentionally deferred until the current Character Forge completion pass is finished.**

This document records the agreed long-term direction for adding local/free AI-assisted features to DNDNext without forcing a future reconstruction of Character Forge, crafting, NPC, or encounter systems.

## Product direction

The intended first AI use is **local text generation**, not a cloud-dependent autonomous agent.

Initial likely runtime:

- development/server-hosted local model through Ollama or a llama.cpp-compatible local service;
- provider-neutral application interface so the model backend can later be replaced;
- eventual downloadable desktop build may run a quantized model locally on the player's machine;
- cloud providers remain optional fallbacks rather than a required architecture dependency.

Planned uses:

1. admin-only magic-item drafting through the existing item-creation workflow;
2. text NPC conversations;
3. text monster/hostile-NPC reactions;
4. later, bounded tactical decision suggestions chosen only from actions already declared legal by the encounter engine.

AI is a creative/reasoning layer. Existing DNDNext rules, validation, persistence, permissions, and game-state authorities remain authoritative.

## Current priority: finish Character Forge first

Do not interrupt the current Character Forge completion work to build the AI subsystem.

Character Forge work should, however, preserve and strengthen the structured data that future AI context builders will consume.

### Forge requirements that are also AI-readiness requirements

Continue to preserve:

- stable canonical ids/keys for Species, Background, Class, subclass, feat, spell, equipment, and source-owned choices;
- source/provenance metadata instead of flattening rule selections into presentation-only prose;
- structured lifecycle distinctions between permanent creation state, rest-configurable state, per-use choices, and narrative unlocks;
- shared creation/progression authority rather than introducing a second AI-oriented save path;
- explicit character ownership/permission boundaries;
- complete structured character sheet projections that can be read without scraping rendered HTML;
- centralized catalogue resolvers and shared cards/details rather than duplicating rule text for AI use.

Do **not** add AI-specific columns or duplicated character state merely because AI is planned. The first AI layer should consume canonical DNDNext data through read-model/context adapters.

## Provider-neutral AI service contract

Future application code should call one DNDNext-owned interface rather than directly coupling NPCs/items/encounters to a specific model vendor.

Conceptual surface:

```js
dndnextAI.generateText(request)
dndnextAI.generateStructured(request, schema)
dndnextAI.chooseAction(request, legalActions)
```

Likely provider adapters:

- `LocalOllamaProvider`
- `LocalLlamaProvider`
- optional future cloud provider adapters

The provider is replaceable. NPC, item, and encounter code should not know which model implementation is active.

## Context builders, not database access

The model must never receive unrestricted Supabase access or arbitrary SQL authority.

DNDNext will construct bounded context objects on the server/application side.

Future examples:

```text
buildCharacterContext(characterId, viewerId)
buildNpcConversationContext(npcId, characterId, viewerId)
buildMagicItemDraftContext(request, viewerId)
buildEncounterActorContext(participantId, encounterId)
```

These context builders own:

- authorization;
- visibility filtering;
- canonical IDs and source metadata;
- relevant current state;
- maximum context size;
- omission of secrets the caller is not allowed to know.

The model only receives the already-filtered result.

## Information visibility contract

Before player-facing AI dialogue is enabled, campaign/NPC knowledge needs an explicit visibility model.

Conceptually distinguish:

- **player-visible** — information this authenticated viewer may receive;
- **actor-known** — information this NPC/monster knows and may reason from;
- **DM-only** — never sent to a player-facing model call.

Security must come from **not supplying forbidden data**, not merely from prompting a model not to reveal it.

No schema migration is required yet. This is a future data-model requirement to satisfy before broad player NPC chat ships.

## Magic-item generation design

Magic-item generation is the preferred first prototype because it is admin-only and can remain non-authoritative until explicitly saved.

The AI should draft into the **existing admin item-creation workflow**, not replace it.

Target flow:

```text
Admin request
  -> DNDNext gathers applicable item/crafting constraints
  -> local AI returns structured draft
  -> existing item-creation modal is populated
  -> admin edits / regenerates / rejects
  -> existing validated Save path persists the item
```

The AI may propose:

- name;
- flavor text;
- rarity;
- suggested base item;
- suggested effects/riders;
- charges;
- suggested materials;
- thematic crafting hooks.

DNDNext remains authoritative for:

- allowed item types;
- legal schema;
- numerical limits;
- rarity/effect budgets;
- crafting DCs;
- valid materials;
- actual persistence.

Where the existing Smithing/Enchanting/Alchemy systems already define balance rules, those systems should constrain or normalize the AI draft rather than asking the model to invent a parallel balance system.

## NPC and monster dialogue design

NPCs and hostile creatures should share one future **Actor AI** concept.

An actor context may include:

- identity;
- Species/creature type;
- role;
- personality;
- speaking style;
- faction;
- relationship/reputation;
- current location;
- current world time;
- player-safe memories/knowledge;
- current disposition;
- current shop/service context when applicable.

A monster is therefore not a separate AI architecture. It is an actor with different goals, knowledge, temperament, and permissions.

The model may control narrative response such as:

- speech;
- threats;
- bargaining;
- fear;
- surrender;
- deception;
- body-language description.

It does not gain authority over canonical movement, combat resolution, inventory, damage, conditions, XP, or world-state writes.

## Future tactical AI boundary

If AI later influences combat, the encounter engine first computes legal actions.

Example:

```json
{
  "legalActions": [
    "attack:participant-3",
    "disengage",
    "dash:hex-17",
    "hide",
    "surrender"
  ]
}
```

The model may choose among those legal actions. It does not calculate AC, movement legality, occupied hexes, spell-slot availability, saving throws, damage, or tactical persistence.

This preserves the existing server/game-engine authority.

## Local model / desktop direction

For the eventual downloadable application, local inference should be optional and tiered.

Conceptual installation choices:

- AI Off;
- Lightweight local model;
- Standard local model;
- Enhanced local model.

The model should be a separate downloadable asset rather than inflating the base application installer.

The runtime may load the model on demand and unload it after inactivity.

The web version and desktop version should use the same DNDNext AI service contract so moving from a local development server to a packaged local model does not require rewriting gameplay features.

## Logging and persistence

Do not automatically turn every generated message into permanent campaign truth.

Future AI outputs fall into two categories:

- **ephemeral generation** — ordinary dialogue/drafts that may be discarded;
- **explicitly accepted state** — an admin-approved item, a validated game action, or a deliberately recorded NPC memory.

Only accepted state should enter canonical tables through existing guarded application paths.

Conversation-history retention should be bounded and deliberately designed rather than stored indefinitely by default.

## Character Forge completion implications

While finishing the Forge:

1. keep rule/source choices structured;
2. keep permanent and runtime lifecycle state separate;
3. avoid UI-only values becoming the sole source of truth;
4. preserve stable canonical identifiers;
5. keep creation and level-up convergent;
6. keep player/DM permissions explicit;
7. prefer reusable read models over component scraping;
8. do not add model-provider dependencies into Forge components.

These choices are sufficient to make the Forge AI-ready without actually adding AI code now.

## Planned implementation sequence

### Phase 0 — complete Character Forge
Finish and browser-accept the remaining Forge slices and reconcile stale Forge documentation.

### Phase 1 — local admin magic-item draft proof
Use a local model against the existing admin item modal. Read-only/generative until the admin clicks the existing Save action.

### Phase 2 — one NPC conversation proof
One controlled NPC, text only, player-safe context only, no game-state writes.

### Phase 3 — shared Actor AI
Generalize NPC dialogue to merchants, companions, neutral NPCs, and hostile creatures.

### Phase 4 — bounded encounter decisions
Allow AI to choose among encounter-engine-generated legal actions. Game engine remains authoritative.

### Phase 5 — downloadable local-AI packaging
Optional local model downloads, hardware-aware quality presets, shared provider abstraction.

## Protected boundaries

This future direction does not authorize current changes to:

- world-map behavior;
- town/city-map behavior;
- route/travel/weather/camp/clock simulation;
- tactical combat authority;
- crafting formulas;
- inventory or merchant persistence;
- Character Forge save/progression authority;
- Supabase schema/data.

Any future AI implementation must be a bounded project with explicit review of its affected authority and data visibility.
