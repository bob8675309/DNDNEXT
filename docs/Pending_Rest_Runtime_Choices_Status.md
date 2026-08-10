# Pending Rest Runtime Choices — Status

Status: implementation prepared for PR #170; migration 83-85 source-control parity restored; migration 89 adds read-only post-rest choice aggregation.

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

Migration 89 adds:

- `private.safe_character_runtime_profile_v1(text, uuid)` — an allow-listed internal adapter so one source-specific getter that is unavailable for an unrelated character cannot break the aggregate notice;
- `public.get_character_pending_rest_choices_v1(uuid)` — authenticated read-only aggregation of existing runtime getters.

The aggregate function does not mutate character state. Actual choices remain owned by their existing feature-specific configure RPCs.

## UI

`CharacterRestChoiceNotice`:

- is mounted in the always-reachable character runtime/currency chain;
- reloads on character change, browser focus, explicit refresh, runtime-choice events, and a short polling fallback so the notice reacts to a rest even when the surrounding profile component does not rerender;
- pulses only when `needsSelection` is non-empty;
- disables animation for `prefers-reduced-motion`;
- keeps optional replacements and post-rest actions collapsed;
- does not duplicate any feature selection logic.

## Source-control parity repair

The live database already contained migrations 83-85 while the PR branch had lost their migration files and two reachable runtime panels. This slice restores:

- migration 83 — XPHB Hunter Defensive Tactics runtime;
- migration 84 — TCE Phantom Whispers of the Dead runtime;
- migration 85 — progression v2 compatibility RPC ACL cleanup;
- `CharacterDefensiveTacticsPanel`;
- `CharacterWhispersOfTheDeadPanel`.

Migrations 83-85 must not be re-applied to production; they are restored to source control so a fresh environment can reproduce the current live schema.

## Protected boundaries

This slice does not touch `components/MapPageClient.js`, world-map behavior, town/city-map behavior, route/travel/weather, unrelated crafting/inventory, or tactical combat execution.

## Acceptance

Before merge:

- exact-head semantic validation and Vercel/build must be green;
- migration 89 must pass rollback-only database classification tests and ACL checks;
- deployed migration 89 must leave production counts and QA residue unchanged;
- a real signed-in browser smoke should confirm the notice appears after a qualifying rest and that persistent choices do not falsely flash.
