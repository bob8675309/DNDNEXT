# Pending Rest Runtime Choices — Status

Status: **migration 89 deployed and rollback-accepted** on PR #170. Migration 83-85 source-control parity is restored. Interactive browser smoke remains external acceptance.

## Purpose

A completed rest can affect several feature families, but they do not all have the same semantics. The player-facing notice must not treat every post-rest replacement opportunity as a missing choice.

The presentation is split into three groups:

1. **Rest-cycle choice waiting** — the feature currently has no active rest-cycle benefit or still needs its first rest-backed selection. These entries receive the attention pulse.
2. **Optional persistent changes** — the current benefit remains active; the rest merely unlocked a replacement. These entries are quiet and collapsed.
3. **Optional post-rest actions** — the rest opened an action such as Memorize Spell, Cantrip Formulas, or Cartomancer Hidden Ace. These are also quiet and collapsed.

## Attention semantics

Current temporary/rest-cycle families include source-backed states such as:

- Astral Trance;
- Bestial Soul;
- Circle Spells;
- Eladrin Trance training;
- Githyanki Astral Knowledge;
- Zhentarim Tactics runtime Expertise.

Fiendish Resilience and Whispers of the Dead can also surface as attention when their first rest-backed selection is unlocked and no benefit is active yet. Once configured, later rests expose only an optional replacement because the current benefit persists.

Persistent families such as Aspect of the Wilds, Hunter's Prey, Defensive Tactics, Armor Model, Dread Allegiance, Eladrin Season, Khoravar Skill Versatility, Weapon Mastery, Weapon Master, Boon of Energy Resistance, and Echoing Soul Expertise do not flash merely because a rest unlocks a replacement.

## Server authority

Migration 89 `pending_rest_runtime_choices` (`20260810181530`) adds:

- `private.safe_character_runtime_profile_v1(text, uuid)` — an allow-listed internal adapter so one source-specific getter that is unavailable for an unrelated character cannot break the aggregate notice;
- `public.get_character_pending_rest_choices_v1(uuid)` — authenticated read-only aggregation of existing runtime getters.

The aggregate function does not mutate character state. Actual choices remain owned by their existing feature-specific configure RPCs.

The safe adapter was added after rollback candidate QA showed that a direct aggregate call could be aborted by an unrelated source getter before that getter reached its eligibility return. The adapter isolates those incompatible getter paths without weakening any feature's own configure authority.

## UI

`CharacterRestChoiceNotice`:

- is mounted in the always-reachable character runtime/currency chain;
- reloads on character change, browser focus, explicit refresh, runtime-choice events, and a four-second polling fallback so a completed rest can be noticed even when the surrounding profile component does not rerender;
- pulses only when `needsSelection` is non-empty;
- disables animation for `prefers-reduced-motion`;
- keeps optional replacements and post-rest actions collapsed;
- does not duplicate any feature selection logic.

`CharacterDefensiveTacticsPanel` and `CharacterWhispersOfTheDeadPanel` were also restored to the reachable chain when live/repository parity was repaired.

## Source-control parity repair

The live database already contained migrations 83-85 while the PR branch had lost their migration files and two reachable runtime panels. This slice restores:

- migration 83 — XPHB Hunter Defensive Tactics runtime;
- migration 84 — TCE Phantom Whispers of the Dead runtime;
- migration 85 — progression v2 compatibility RPC ACL cleanup;
- `CharacterDefensiveTacticsPanel`;
- `CharacterWhispersOfTheDeadPanel`.

Migrations 83-85 were **not** re-applied to production. They were restored to source control so a fresh environment can reproduce current live authority.

## Exact-head gate before deployment

Head `a05c4b03f9a36cbf9021108aa07856cfab474fd1` passed **31/31 PR-triggered GitHub workflows** and Vercel before migration 89 deployment.

The gate also exposed and corrected two stale validators: source-magic markers were aligned to the actual migration-86 helper calls, and the nested-choice validator was aligned to the intentional Training placement for higher-level feat decisions.

## Deployed rollback acceptance

### Temporary/rest-cycle classification

A rollback-only authenticated fixture temporarily gave an editable, non-encounter character AAG Astral Elf authority and completed a Long Rest. The aggregate returned:

- `hasAttention = true`;
- exactly one `needsSelection` item;
- Astral Trance classified as `temporary` / `long_rest`;
- no optional persistent replacement.

An earlier attempt against a character currently controlled by an active encounter was correctly rejected by the existing rest guard; that failed transaction left no residue.

### Persistent replacement classification

A separate rollback-only fixture temporarily aligned the editable character to XPHB Barbarian 6 / Wild Heart, seeded active Owl authority, and completed a newer Long Rest. The source getter reported Owl still active with replacement available. The aggregate returned:

- `hasAttention = false`;
- zero `needsSelection` items;
- exactly one `optionalChanges` item for Aspect of the Wilds.

This directly proves the notice does not nag for a persistent choice that remains mechanically active.

### ACLs

- anon public getter execute: false;
- authenticated public getter execute: true;
- service-role public getter execute: true;
- anon/authenticated private adapter execute: false;
- service-role private adapter execute: true.

### Zero residue / integrity

After rollback QA:

- 7 characters;
- 7 character sheets;
- 30 character-spell rows;
- 7 progression rows;
- 18 inventory rows;
- 20 locations;
- 4 map routes;
- 9 map route points;
- 0 runtime rows;
- 0 rest-log rows;
- 0 migration-89 QA residue.

## Protected boundaries

This slice does not touch `components/MapPageClient.js`, world-map behavior, town/city-map behavior, route/travel/weather, unrelated crafting/inventory, or tactical combat execution.

## Remaining acceptance

The only presentation proof not available through the connected toolset is a real signed-in browser smoke. It should confirm the attention pulse after a qualifying rest for an inactive rest-cycle feature, quiet/collapsed persistent replacement opportunities, notice refresh after resolving the choice, and responsive/reduced-motion behavior.
