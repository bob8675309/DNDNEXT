# Source-Derived Attack Action Sequence — Shadow Stage (2026-10-27)

**Draft PR #291, stacked on #290. Does not change real Attack actions, Extra Attack, combat damage, item interactions, spellcasting, or production database.**

## Motivation and exact source

The canonical weapon/unarmed attack RPCs still consume `encounter_participants.action_available=false` after **one** attack. The read-only audit in #290 established that there is no per-Attack-action subattack ledger. This stage tests a safe **server-derived capacity + idempotent event sequence** without bypassing the existing writer.

Read-only live Supabase inspection confirmed actual `public.character_progression(class_id,class_level)`, `public.class_catalog(id,class_key,source)`, and `public.class_feature_catalog(feature_key,feature_type,class_key,class_source,source,subclass_name,level,name)`.

The **exact** class/source feature records support these conservative base-class bounds:
- **Fighter XPHB:** Extra Attack at 5 → 2; Two Extra Attacks at 11 → 3; Three Extra Attacks at 20 → 4.
- **Fighter PHB:** Extra Attack at 5 → 2; Extra Attack (2) at 11 → 3; Extra Attack (3) at 20 → 4.
- **Barbarian, Monk, Paladin, Ranger, PHB/XPHB:** Extra Attack at 5 → 2.
- Other recognized PHB/XPHB base classes have at most **one baseline slot** in this prototype, with subclass and special grants explicitly unverified.

Source identity must match `class_key`, `class_source`, `source`, `feature_type='class'`, `subclass_name IS NULL`, exact feature name/tier, and earned level. A Fighter whose catalogue lacks a required source tier is **not silently given** a guessed budget; its `sourceReady=false` blocks starting the shadow sequence.

**Do not generalize:** Valor/Swords Bard, Bladesinger Wizard, Armorer/Battle Smith Artificer, Grim Hollow Monster Hunter, Warrior Sidekick, multiclass composition, Action Surge, Nick/Light attacks, bonus attacks and attack replacements have separate feature/interaction rules. This prototype does not grant their special allowances.

## New isolated schema and commands

`sql/20261027_01_attack_action_source_budget_shadow.sql` introduces:

- `private.encounter_attack_capacity_source_shadow_v1(character_id)` — reads only canonical DB progression and exact class-feature rows, returns a conservative source status and up-to-four baseline attack slots. Service-role-only, with fixed search path; cannot be called by browser roles.
- `public.encounter_attack_action_sessions_shadow_v1` — one Attack-action *prototype session* per encounter participant + round + turn; locks a snapshot of the server-derived attack allowance to its starting turn/request UUID/actor. RLS enabled and direct browser table access revoked.
- `public.encounter_attack_events_shadow_v1` — immutable-in-practice idempotency ledger for simulated attack ordinal 1,2,3,4; unique event UUID and unique action-session/ordinal. No target, damage, roll or inventory fields to spoof.
- `public.begin_encounter_attack_action_shadow_v1(participant,request,round,turn)` — authenticated participant-control check, participant then encounter row locks, current undefeated active turn with **unspent** canonical Action, no existing original weapon/unarmed log event, no previous shadow Attack action session this turn, and trusted source budget. Identical request retry returns the stored session; UUID reuse for different actor/turn is rejected.
- `public.record_encounter_attack_event_shadow_v1(participant,actionRequest,eventRequest,ordinal)` — locks participant, encounter, session; validates still the same undefeated active turn, current canonical Action still unspent, no canonical attack since the session opened, and ordinal equals the next unspent slot. Atomically increments the *shadow only* attack counter and logs a replay-safe result. Gaps, skipped ordinals, exceeding source capacity, out-of-turn and unauthorized requests are rejected. Identical request replays return their original result even if the real Action has since been spent.

The source attack budget is captured **once at session begin**; changing character progression mid-turn cannot retroactively expand the session.

### Deliberate non-features

- **NO** real attack rolls, targets, hit/miss, damage, resistance, armor class, ammo, proficiency, conditions, reactions, opportunity attacks, Attack action expenditure, or canonical combat log writes.
- **NO** weapon draw/stow, Shield Utilize, Two-Handed attack grip, Versatile mode, spell components, attunement focus bonuses, or action-economy exception integration.
- **NO** overwriting existing combat RPCs, player UI or character equipment.
- `canonicalActionSpent=false`, `damageApplied=false`, `combatLogWritten=false`, `weaponInteractionCharged=false`, `combatConsumerEnforced=false` remain explicit.
- An eligible Wizard Bladesinger *may have* Extra Attack under its own subclass rules; this prototype purposefully does **not** infer that from a Wizard base-class record and is **not ready to enforce actual gameplay**.

This is a concurrency/source-grant design proof, not a functional fix for Extra Attack in production.

## PG16 / CI

`scripts/fixtures/attack_action_source_budget_shadow.sql` composes the earlier precise attunement/equipment/spell/encounter/attack-log fixtures and adds a live-shaped class-feature catalogue. Cases cover PHB/XPHB Fighter levels 4/5/11/20; XPHB Barbarian 5; subtype/source spoofed features not granting; Wizard subclass-only Extra Attack not silently assumed; missing required Fighter source tier; exact participant/round/turn, action state and source authorization; one session per turn; duplicate request replay/conflicts; ordinal sequence 1/2/3 and capped 4; real Action spent blocking new events; unauthorized cross-account replay; and unchanged existing character inventory, hand snapshots, participant resources and spell-slot rows.

`scripts/validate_attack_action_source_budget_shadow.mjs` source-pins the existing canonical one-attack-per-Action writer and ensures the new migrations cannot call or alter it. CI runs this and previous source tests plus isolated PG16.

## Before real consumer integration

1. Review canonical Attack-action atomic transaction and its compatibility with existing `encounter_command_requests` and active encounter snapshots. Implement first Action spend **once** while allowing sourced subsequent attack events. Protect dice rolls, damage, status effects, logs, and per-event idempotency.
2. Expand source-resolution to verified subclass grants, multiclass rules, other book sources, Extra Attack replacements (e.g. Bladesinger), Action Surge, Light/Nick offhand/bonus attacks, monsters and conditional attacks. Exactly one actor-controlled, turn-scoped attack budget must be authoritative across melee/ranged/unarmed writers.
3. Attach weapon equip/unequip actions **to specific per-attack events**, not the #288 experimental one-shadow-change-per-turn quota.
4. Handle Shield don/doff Utilize independently, Two-Handed/Versatile held-state, somatic/material focuses, shared physical custody and attunement/rest/source eligibility.
5. Run signed-in player/admin tactical browser tests and all existing action/log/HP/slot/position/rest regressions. The complete stacked chain #267→#291 remains draft and not applied live.

Start with [Attunement_Effects_Integration_Current_Handoff_2026-10-26.md](Attunement_Effects_Integration_Current_Handoff_2026-10-26.md) for the dependency ledger.
