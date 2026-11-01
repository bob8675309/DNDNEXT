# P2 — Shared Encounter Lock, Trigger, and Replay Authority Audit

_2026-10-31. Research-only read of current DnDWeb PostgreSQL definitions, table constraints, and active triggers. This is a proposed direction, **not** an authorized migration, all-RPC implementation or real signed-user acceptance test._

## Why this audit exists

The current P2 Fire Bolt transaction candidate proved useful for isolated spell requests but it locks the caster **before** the encounter. The 30-function command ledger census and the six relevant encounter trigger paths now demonstrate that a safe universal cutover cannot simply copy its ordering to every endpoint. Several legitimate commands lock other actors or reaction windows and update them indirectly. This document follows `docs/Spell_Recipe_P2_Public_RPC_Lock_Audit_2026-10-31.md`; read its 22 spell RPC matrix first.

## Verified 30-function ledger ownership

- **22** public `encounter_cast_%` names: 14 direct ledger processors and eight routers/wrappers, 18 authenticated-executable and four internal `_pre_1v` variants not authenticated-executable. The 14 processors insert command ledger before control/explicit caster locks.
- **Eight** additional authenticated-executable public ledger writers; frozen names/definition fingerprints at `scripts/fixtures/encounter_nonspell_ledger_live_snapshot_p2.mjs`. Among those eight, **five** have an explicit `ledger → first row lock → controller check` order. The admin effect handler also writes the ledger before its *helper* acquires target lock, but checks admin permission **before** the ledger. The save handler checks participant controller permission before writing the ledger and has no explicit `FOR UPDATE` in its own body. The reaction handler instead locks its window and actors before ledger, but has a distinct preauthorization return. Thus **six ledger-before-first-effective-lock paths** is different from **five ledger-before-controller-check paths**. Do not conflate them.
- The command ledger table has `request_id UUID PRIMARY KEY` globally, `encounter_id`, nullable `participant_id`, `command_type`, nullable `requested_by`, nullable `result JSONB`, and `created_at`. **It has no persisted typed request intent/payload/fingerprint column.** A result JSON alone need not preserve the originally selected targets or hidden information.

### Non-spell command paths (read-only live source)

| Path | Effective order / hidden side effects | Authorization and replay risk |
| --- | --- | --- |
| `encounter_end_turn_v1` | Ledger → current participant FOR UPDATE → encounter FOR UPDATE → conditions/timed effects FOR UPDATE → next participant UPDATE → encounter active-participant UPDATE, invoking turn-start trigger | Old completed result may return before caller authorization; previous owner, active turn and expiry must be revalidated on replay |
| `encounter_move_active_participant_v1` | Ledger → mover FOR UPDATE → encounter FOR UPDATE → movement/reactor inspection → possible reaction window INSERT | Saved path/hex intent is not keyed with request; movement can pause for reaction |
| `encounter_weapon_attack_v1` | Ledger → attacker FOR UPDATE → target FOR UPDATE → encounter FOR UPDATE → canonical weapon/equipment and attack roll/damage helpers | Previous result is not an input entitlement. Request must bind target and equipped inventory instance |
| `encounter_unarmed_strike_v1` | Ledger → attacker FOR UPDATE → target FOR UPDATE → encounter FOR UPDATE → damage/attack effects | Target-first/attacker-first differences can form cycles with other commands |
| `encounter_use_core_action_v1` | Ledger → actor FOR UPDATE → encounter FOR UPDATE → Dash/Disengage/Dodge action mutation | Different core-action intent could reuse same UUID unless stored and compared |
| `encounter_resolve_opportunity_reaction_v1` | **Reaction-window FOR UPDATE → reactor FOR UPDATE → mover FOR UPDATE → encounter FOR UPDATE → ledger**, followed by opportunity-attack helper, reaction spend, log | **Confirmed source-order concern:** if window is already resolved, returns `v_w.result` at line before controller authorization. Even later ledger replay checks only command type/reactor, not originally chosen weapon and reaction choice. This is not yet a real Auth exploit proof |
| `encounter_roll_save_v1` | Actor controller checked → ledger → saving throw helper → combat log | No explicit row lock in body, but caller authorization is checked before cached ledger result. Replay still needs actor, ability, DC and source identity binding |
| `admin_apply_encounter_effect_v1` | Admin role guard → ledger → `encounter_resolve_effect_internal_v1` locks target → saving throw/damage/healing/condition → encounter version update | Admin check before replay is preserved. Server-side effect payload, source and target must be bound to the same request; do not generalize player controls to Admin-only commands |

This is source inspection, **not** a finding of unauthorized production casts. In particular, the GM effect and save routes already check their respective role/controller before ledger replay. The reaction *window result* early return is separate from ledger replay.

## Trigger and private-helper graph — observed from pg_trigger and pg_get_functiondef

There are **six relevant non-internal triggers** on the encounter runtime tables reviewed here, plus non-encounter triggers on source character/Forge, items and persistent spell resources. No user-defined triggers were found on command ledger, reaction-window, combat-log, or condition/timed-effect tables in this read-only selection.

1. **`encounters`: turn-start expiry** — `encounter_timed_effects_turn_start_expiry` calls `private.expire_encounter_timed_effects_on_turn_start_v1` AFTER changing `active_participant_id`. It locks expired `encounter_timed_effects` rows and can UPDATE `encounter_participants.speed_ft` for a *different* character when a source-turn-start speed effect ends. Therefore the encounter row can lead to a participant-row lock **inside a trigger**, not only in explicit command code.
2. **`encounter_spell_slots`: persistent spending bridge** — `encounter_spell_slot_character_spend_bridge` runs AFTER decrease of `slots_remaining`. `private.mirror_encounter_spell_slot_spend_v1` calls `private.sync_character_spell_slots_v1`, which can INSERT/UPSERT/DELETE persistent slot rows, then SELECTs the persistent `character_spell_slots` row **FOR UPDATE** and decrements it. The resource bridge context suppresses invalid manual writes. This is part of the **authoritative atomic cast**, not a mirrored UI convenience.
3. **`encounter_participants`: HP guard and slot initialization** — `encounter_participant_max_hp_guard` normalizes HP from a character sheet on HP/character updates; `encounter_participant_spell_slot_snapshot` initializes encounter slots AFTER participant INSERT. Both require acceptance in staging setup.
4. **`encounters`: activation slot refresh (two event variants)** — `encounter_spell_slots_refresh_after_active_insert` and `encounter_spell_slots_refresh_on_activation` call `private.refresh_encounter_spell_slots_on_activation_v1`, which refreshes from character pools. Do not confuse campaign encounter activation with an ordinary spell-cast revision update.

Additional relevant helper effects: `private.encounter_resolve_attack_roll_v1` can SELECT `encounter_timed_effects` **FOR UPDATE** to consume advantage/disadvantage effects; `public.encounter_opportunity_attack_internal_v1` relocks reactor and mover and applies damage; `public.encounter_resolve_effect_internal_v1` locks its target and can call save, damage, healing, and conditions. `public.encounter_apply_damage_internal_v1` obtains target **FOR UPDATE** and equipment mitigation before HP update. Thus a caller's first explicit `FOR UPDATE` is only the beginning of the lock graph.

### Why the current candidate cannot be promoted

- Historical slotted wrappers may lock encounter **E** first to enforce one slotted spell per turn, then their processor obtains request ledger **L**, then caster **C**; historical non-slotted attack functions commonly obtain **L → C → target T → E**. Reaction handler obtains **window W → reactor R → mover M → E**, while a turn-start trigger can go **E → other participant P**.
- The current *ungranted* v11 candidate uses **C → slot-turn E → assignment → E → T → L**. It passes isolated tests, but concurrent **C → E** and **E → P** across different actors is a wait-cycle possibility. **Do not install it in parallel with existing paths** or call it a deployable fix because its CI is green.
- Both same-request unique-ledger conflicts and cross-request shared participant/encounter locks can cause mixed-version deadlocks. No owner permission exists for a production rehearsal.

## Proposed uniform contract — design only

**Candidate principle: serialize an encounter's authoritative mutations by locking its encounter row first**, then revalidate all identities and intent under that lock. This is a **proposed**, not proven, universal lock scheme:

1. **Read-only discovery:** from supplied UUID/trigger window, discover encounter ID and prospective actor/targets *without acquiring row locks*. Treat lookup data as untrusted and nonauthoritative.
2. **Lock encounter `E FOR UPDATE` FIRST**, before any command ledger insert, participant lock or reaction-window lock. Reload/revalidate the discovered encounter, actor, target team and current turn after lock. Reject stale/cross-encounter identifiers.
3. **Lock affected participant rows in a deterministic UUID order**, including actor, target(s), reaction reactor/mover, and any participant updated by a known turn-start effect; if the full set cannot be safely precomputed, E-first encounter-wide serialization still protects collaborating commands in that encounter, but only after all other writers are converted. Preserve hidden visibility rules.
4. **Lock reaction windows and timed effects in a reviewed consistent order**, then character inventory/equipment/slot resource rows as each authoritative helper requires. `encounter_spell_slots → character_spell_slots` is a required slot bridge; examine shared characters in multiple active encounters and non-combat resource writers for **cross-encounter** lock inversions. Global E-first alone does NOT prove cross-encounter safety.
5. **Only after authorization/visibility and canonical intent validation, reserve ledger request ID `L`** and/or return an existing result. For replay check `requested_by`, encounter, command type, participant, and **the entire typed command intent**. Recheck current authority and concealed target permissions before returning any cached result. A previously completed Action may already be unavailable; don't demand a fresh Action just to return a validated cached result.
6. **Commit all effects and ledger result together.** The existing command, condition, HP, damage mitigation, slot bridge, turn trigger, logs, and encounter version remain server-owned; no duplicate Action, movement, healing, damage, resource charge, or source-visible information.

**Request intent design gate:** the ledger currently stores only result JSON. A proposed future versioned server-produced payload/fingerprint must canonically represent each family's *input*, not reconstruct sensitive choices from visible output: move path and movement mode; attack target and inventory instance; reaction window, choice and weapon; end turn actor+turn identity; action type; save ability/DC/source; GM effect source/target/allowlisted effect schema; spell source/grant, target/point/facing, selected target UUID set, Magic Missile dart allocations and slot pool. Sort genuinely unordered sets, but preserve allocations/paths whose order carries meaning. Treat legacy rows without trustworthy bound intent as **not replay-safe** until an explicit backwards-compatibility policy is approved.

The goal is one **authoritative RPC-command envelope**, not an open-ended new rules executor. Keep unsupported rules GM-assisted and AI OFF. Do not rename or overwrite canonical edition/source grants.

## Research test and limits

- Dated static source evidence: `scripts/fixtures/encounter_nonspell_ledger_live_snapshot_p2.mjs` and the prior 22-spell snapshot; `scripts/validate_encounter_shared_lock_audit_p2.mjs` verifies census, trigger contracts and that the *current* v11 candidate remains explicitly caster-first and ungranted.
- Repeatable SELECT-only audit: `scripts/audits/spell_cast_rpc_order_readonly.sql`; never use that path for writes.
- Disposable two-client **miniature**: `scripts/fixtures/encounter_global_lock_order_p2_pg16.sh` creates independent small tables in `fire_bolt_p2` and verifies that two encounter-first commands serialize, while an AFTER UPDATE trigger touches a third participant. This is a **model of a proposed lock-order invariant**, not proof that any existing DnDNext RPC adopts it, and not proof against a real signed-in race.

## Single next task

**Inventory other encounter writers that do NOT reference the command ledger**, including admin encounter setup/status, reaction/condition/resource helpers and persistent rest/character-slot operations that may modify shared actor/encounter resources. Reconcile cross-encounter slot concurrency and establish a reviewed all-writer lock graph before implementing any E-first cast candidate or running real two-account Auth acceptance in a separate disposable Supabase environment.

**No production SQL, grants, migrations, account changes, web UI, world/town map, AI activation, branch merges, or hosting charges have been authorized or performed.**
