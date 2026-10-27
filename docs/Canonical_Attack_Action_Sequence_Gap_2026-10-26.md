# Canonical Attack Action / Extra Attack Sequencing Gap — 2026-10-26

**Active staged draft #290, based on #289. Read-only evidence and release blocker; NOT an implemented Extra Attack or weapon interaction.**

## Live database and source evidence (READ ONLY)

I inspected the live `public.encounter_weapon_attack_v1` implementation via `pg_get_functiondef`, in addition to the matching checked-in SQL `sql/20260729_03_tactical_attack_roll_modifiers.sql`, the active `pages/encounters/combat.js` RPC dispatch, and `sql/20260727_06_core_combat_actions.sql`.

**Important architecture gap:**
1. An authenticated controlled active participant invokes `encounter_weapon_attack_v1(attacker,target,equipped_inventory_id,request_id)`. The writer checks `if not v_a.action_available then raise exception 'Action already spent'`, resolves **one** weapon attack, applies target damage/log, then sets the attacker's `action_available=false`. The weapon writer has **no per-Attack-action attack sequence, remaining-attack counter or equipment-interaction hook**.
2. `encounter_unarmed_strike_v1` follows the same one-strike-spends-full-Action pattern. The 2024 rules' *Extra Attack* feature cannot perform its second attack through these writers without further design.
3. `encounter_end_turn_v1` restores `action_available` for the next turn, but **does not** create a per-attack budget within one Attack action.
4. `encounter_use_core_action_v1` expressly accepts only **Dash, Disengage, Dodge**. No current `encounter_*utilize*` or `encounter_*shield*` RPC was found by the read-only live schema function inventory. A Shield's don/doff cannot be safely treated as a supported existing action.
5. The battleboard calls `encounter_weapon_attack_v1` directly; it has no event-based Attack action wrapper that could decide attack #1 versus attack #2, or allow drawing/stowing at the allowed moment.
6. The canonical `encounter_command_requests` table is idempotency/authorization metadata; it does **not** have a persisted attack sequence number or encounter round/turn columns. Canonical `encounter_combat_log` provides event type, actor, round, turn index and detail with a `requestId` for weapon/unarmed results. Historical events may lack a matching command. Logs alone cannot prove feature entitlement or how many attacks remain.

**Therefore implementing actual draw/stow or Shield Utilize costs before fixing the canonical Attack-action event model risks gameplay regression.** Prior #288's one-changed-shadow-hand-per-turn quota is diagnostic concurrency scaffolding, not an official 2024 rule and NOT an acceptable permanent limit.

## Added service-only read-only audit

`sql/20261026_09_encounter_attack_action_sequence_audit_shadow.sql` introduces:

`private.encounter_attack_action_sequence_audit_shadow_v1(participant_id)`

The diagnostic scopes **existing** encounter event logs to the exact participant, current encounter round and turn index, distinguishes `weapon_attack` from `unarmed_strike`, and joins `detail.requestId` to `encounter_command_requests` with actor/encounter/command-type matching. It reports logged attack counts, linked/unlinked command counts, current `action_available` and encounter state. It **does not** infer whether an actor has Extra Attack, how many attacks remain, what gear is currently held, whether a spell can be cast, or which interactions can be performed. All readiness fields stay false:
`canonicalPerAttackSequenceStatePresent=false`, `extraAttackFeatureGrantVerified=false`, `extraAttackExecutionSupported=false`, `attackActionWeaponInteractionCounterPresent=false`, `attackEquipBeforeAfterAttackIntegrated=false`, `shieldUtilizeActionImplemented=false`, `combatConsumerEnforced=false`.

It is a private service-role-only RPC with fixed search path and no writes, rerolls, combat logs or action/spell/inventory mutations. It does not even call the `#286–#289` hand-transition writers.

## Disposable verification

`scripts/fixtures/encounter_attack_action_sequence_audit_shadow.sql` composes the full earlier #289 fixture stack (actual source/ownership, hand and spell probes) and creates only the missing event/command read surfaces in disposable PG16. Cases validate zero attacks with an available Action, one logged weapon attack with the Action marked spent by the simulated canonical writer, matching request actor/type/encounter, unrelated participant/turn/round event isolation, an unlinked historical unarmed attack, a separate nonactive participant, null input rejection, server-only function ACL and unchanged inventory, spell slots and prior shadow-hand records.

`scripts/validate_attack_action_sequence_audit_shadow.mjs` pins the *actual current SQL* for action-available checks, spend, event types, core action whitelist and battleboard RPC dispatch. If a future real consumer fixes Extra Attack or adds Utilize, this deliberately **fails** until the diagnostic and its limitations are reviewed. GitHub Actions run Node source checks and isolated PostgreSQL 16.

## Release-safe implementation sequence after #290

1. **Propose explicit Attack action execution state** within the canonical encounter turn, tied to a specific participant, round, turn index and Attack-action command ID, plus server-computed authorized attacks by class/level/features (Extra Attack, possible Attack replacements, bonus-action attacks; do not generalize without tests). Preserve existing OFF/legacy one-attack behavior until exact endpoint compatibility and idempotency are established.
2. Move attack #1 / #2 resolution through one authoritative **per-attack event** adapter, with consistent target/roll/damage/resistance/attack-use accounting; only the first Attack action spends `action_available`, subsequent attack events must have valid remaining Attack action budget. Preserve opportunity attacks and reactions in separate windows.
3. Associate the **weapon draw/stow interaction** with a concrete attack event before/after that attack, not a blanket once-per-turn allowance. Bind the equipment UUID and any hand transition atomically with that attack. The old shadow command must not become an unguarded alternative pathway.
4. Add a separate reviewed Shield **Utilize** route, don/doff lifecycle and Animated Shield exceptions; and rules-aware S/M focus, two-handed attack grip and War Caster requirements. Keep physical gear slots versus active hands distinct.
5. Reconcile class-grant provenance, shared-account physical custody, optional attunement source gating/rest authorization, exact spell writer focus parity and signed-in player/admin browser tests before any live effects rollout.

All PRs **#267→#290** are staged draft/unmerged and no SQL in this branch was applied to production. World map, town map, Character Forge, Inventory UI, canonical Attack/spell/shield consumers and HP/Action/slot resources remain untouched.

Current overall handoff: [Attunement_Effects_Integration_Current_Handoff_2026-10-26.md](Attunement_Effects_Integration_Current_Handoff_2026-10-26.md).
