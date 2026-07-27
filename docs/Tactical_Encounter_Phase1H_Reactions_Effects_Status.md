# Tactical Encounter Phase 1H — Reactions & Generic Effects Status

Last updated: 2026-07-27

This document extends the tactical encounter roadmap and the Phase 1G LOS/cover/save/damage ledger. Phase 1H adds server-authoritative opportunity-reaction timing plus reusable healing, effect, and condition primitives for later spell/class automation.

## Status

**Implemented, schema deployed, rollback-tested, permission-checked, Realtime-enabled, and preview green.**

## Opportunity-reaction model

Phase 1H does not auto-resolve opportunity attacks in the browser.

`encounter_move_active_participant_v1` now evaluates every submitted movement edge server-side. If an edge would move the active participant from inside a hostile creature's melee threat reach to outside that reach:

- the move pauses at the last accepted hex before the threatened edge;
- any earlier safe steps in the submitted path remain accepted and consume their normal movement cost;
- a row is created in `encounter_reaction_windows`;
- the movement result returns `reactionRequired=true`, the reaction-window id, reactor id, and blocked edge;
- the unresolved edge is **not** entered until the reaction window resolves and the mover submits a new movement request;
- End Turn is rejected while the active mover has a pending reaction window.

This keeps movement authority on the server and avoids a client deciding whether a reaction trigger exists.

## Threat / hostility semantics

`encounter_threat_reach_ft_internal_v1` derives a participant's current melee threat reach from:

- 5-foot Unarmed Strike reach as the minimum;
- all currently equipped supported **non-ranged** weapon profiles;
- the largest current melee reach among those options.

Current automatic hostility is intentionally narrow:

- `enemies` are hostile to `players` and `allies`;
- `players` / `allies` are hostile to `enemies`;
- `neutral` participants do not automatically create opportunity windows.

Future faction/disposition rules can replace this helper without changing the movement/reaction contract.

A potential reactor must also:

- be non-defeated;
- still have its Reaction available;
- have line of sight to the mover at the trigger position.

A resolved reaction window suppresses the same reactor/edge trigger for that same round + turn index. If several creatures can react to one edge, the server exposes them one at a time in deterministic initiative order as movement is retried.

## Disengage

The existing authoritative **Disengage** flag now has its first reaction consequence:

- while the active mover is Disengaged, opportunity-reaction windows are not created;
- movement legality, terrain cost, blockers, occupancy, Speed, and all other Phase 1D rules remain unchanged;
- Disengage still clears at End Turn through the existing turn lifecycle.

## Reaction resolution

`encounter_resolve_opportunity_reaction_v1` is the public guarded reaction RPC.

Only the reactor's controller, an admin, or service-role authority can resolve the window.

Supported choices:

- **Pass** — resolves the window without spending Reaction;
- **Attack** — spends Reaction and resolves one opportunity attack.

Supported opportunity attacks:

- Unarmed Strike;
- a currently equipped supported melee weapon chosen from the reactor's canonical inventory path.

Ranged weapons cannot be selected for the opportunity attack. Melee/thrown weapons are usable in their melee mode through their normal melee reach.

The reaction attack reuses Phase 1G targeting and typed-damage primitives:

- line of sight is authoritative;
- cover can modify target AC;
- Dodge can impose disadvantage;
- weapon ability/proficiency/magic bonus comes from the canonical weapon profile;
- natural 1 / natural 20 rules remain in force;
- critical weapon attacks double damage dice;
- typed damage flows through resistance/immunity/vulnerability and temporary HP;
- the reactor's **Reaction** is spent, not its Action.

Reaction request UUIDs are idempotent; retrying the same resolved reaction cannot spend Reaction, damage, or log the event twice.

## Realtime player surface

`/encounters/play` is upgraded from the Phase 1D movement-only surface to **Turn Movement & Reactions**.

It now includes:

- Dash movement bonus in the remaining-movement readout;
- visible Disengage state;
- pending opportunity-reaction panel;
- reactor and mover names plus the threatened edge;
- controller-specific Attack / Pass controls;
- equipped melee weapon selector plus Unarmed Strike fallback;
- waiting state for observers / the mover while another controller owns the reaction;
- Realtime refresh from `encounter_reaction_windows`;
- movement and End Turn lockout while the mover's reaction window is pending.

`encounter_reaction_windows` is Realtime-published with authenticated SELECT only; direct authenticated writes remain denied.

## Generic healing and max HP

Encounter participants now carry encounter-local `max_hp`.

- new participant rows populate `max_hp` from canonical character-sheet `maxHp`, then `hp`, then current encounter HP as a fallback;
- `encounter_apply_healing_internal_v1` restores encounter-local HP only;
- healing cannot exceed encounter `max_hp`;
- successful positive healing clears the narrow `is_defeated` flag;
- canonical character-sheet HP is still not written during combat.

## Private effect-originated saving throws

`encounter_roll_save_internal_v1` is the reusable private save resolver for future effects.

It uses the same canonical ability, class save proficiency, proficiency bonus, LOS, and Dexterity-cover rules introduced in Phase 1G.

The public manual `encounter_roll_save_v1` now delegates to that private resolver instead of maintaining a separate roll implementation.

## Generic effect envelope

`encounter_resolve_effect_internal_v1` accepts an authoritative structured effect envelope with optional:

- `save` — ability, DC, and `onSuccess` behavior (`none`, `half`, or `negate`);
- `damage` — amount and typed damage;
- `healing` — amount;
- `condition` — condition key, optional target-turn duration, and metadata.

Effect ordering is:

1. resolve the optional saving throw;
2. adjust damage for the save result (`half` / `negate` where requested);
3. apply typed damage through the Phase 1G damage primitive;
4. apply healing through the max-HP-aware healing primitive;
5. apply the condition unless a successful `negate` save suppresses it.

The internal resolver is not executable directly by authenticated clients.

`admin_apply_encounter_effect_v1` is the current GM/testing wrapper. It is admin/service-role guarded, idempotent through the command ledger, and writes a Realtime combat-log event. Future spells/class features should call the private effect/save primitives from their own authoritative RPCs rather than letting players construct arbitrary effects.

## Conditions and expiry hooks

`encounter_conditions` is the first structured encounter condition table.

Supported keys in this phase:

- blinded
- charmed
- deafened
- frightened
- grappled
- incapacitated
- invisible
- paralyzed
- poisoned
- prone
- restrained
- stunned
- unconscious

A condition can be indefinite or have `remaining_target_turn_ends`.

At the affected participant's End Turn:

- a condition at `1` expires and writes a `condition_expired` combat-log event;
- a value above `1` decrements by one;
- indefinite conditions remain until removed by a guarded GM action or a future authoritative rule.

**Phase 1H tracks these conditions but does not yet implement the full 5e mechanical consequences of every condition.** Their structured presence/duration is the hook future action/spell rules will consume.

`encounter_conditions` is Realtime-published with authenticated SELECT only; direct authenticated condition writes remain denied.

## Validation completed

The rollback integration matrix verified:

- leaving 5-foot hostile reach paused movement before the threatened edge;
- the pending reaction row was created and the mover did not cross the edge;
- Pass resolved the window without spending Reaction;
- the same resolved edge could then be crossed;
- an opportunity attack spent Reaction exactly once;
- retrying the same reaction request did not duplicate its combat-log event or result;
- Disengage suppressed the opportunity window;
- End Turn was rejected while a movement reaction remained pending;
- 50 requested healing on 10/20 HP applied only 10 and capped at 20;
- generic piercing damage reused Phase 1G resistance and converted 7 damage to 3;
- generic effect retries were idempotent;
- an effect-originated Constitution save at DC 40 resolved server-side as a failure for the test participant;
- a one-target-turn Stunned condition was added then expired at that target's End Turn;
- condition expiry wrote a combat-log entry;
- all temporary map/session/participant/reaction/condition/command/log rows rolled back to zero;
- world state remained 2 characters / 20 locations / 4 routes / 9 route points.

The permission rehearsal verified:

- a synthetic non-admin reactor controller could resolve its own opportunity window;
- another controller could not resolve that reactor's window;
- a non-admin could not invoke the GM effect wrapper successfully;
- authenticated clients have SELECT but not INSERT on reaction windows and conditions;
- anon cannot execute the reaction-resolution RPC;
- authenticated clients cannot execute internal opportunity-attack or generic-effect helpers;
- both new tables are in Supabase Realtime.

## Explicit non-goals still in force

Phase 1H does **not** yet implement:

- full mechanical behavior for every tracked condition;
- Ready-action reactions or arbitrary reaction triggers;
- Sentinel, Polearm Master, War Caster, class features, feats, or special monster reactions;
- faction/disposition hostility beyond the current players/allies-vs-enemies MVP;
- multi-hex threat footprints;
- forced movement reaction rules;
- ranged attacks while threatened disadvantage;
- ammunition/reload rules;
- canonical condition/resistance import from species, classes, feats, or equipment;
- canonical HP writeback after an encounter;
- death-save / unconscious lifecycle automation;
- spells, spell slots, concentration, AoE templates, or class-resource spending;
- world-map movement, route, travel, weather, camp, or clock changes.

## Next implementation slice

The next bounded slice should begin **authoritative spell/action-effect automation** on top of these stable primitives:

1. canonical spell profile extraction from the existing Known spellbook;
2. spell-slot resource snapshot/spending in encounter state;
3. attack-roll spells using the existing targeting/LOS/cover contract;
4. save-based spells using the private effect save resolver and authoritative spell DC;
5. damage/healing spells through the generic effect envelope;
6. single-target conditions through `encounter_conditions`;
7. concentration state and interruption hooks;
8. AoE templates only after single-target spell authority is stable.
