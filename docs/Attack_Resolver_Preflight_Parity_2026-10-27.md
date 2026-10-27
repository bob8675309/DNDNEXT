# Canonical Weapon Resolver Preflight Parity — 2026-10-27

**Draft PR #292, stacked on #291. READ-ONLY resolver preparation, not live multiattack damage execution.**

## Audited active weapon/unarmed writers

The live `public.encounter_weapon_attack_v1` (also checked in `sql/20260729_03_tactical_attack_roll_modifiers.sql`) performs exact participant/target/turn checks, loads `encounter_weapon_profile_internal_v1`, reads `encounter_targeting_context_internal_v1`, validates LOS and melee/thrown/ranged reach, then calls `private.encounter_resolve_attack_roll_v1`.

**Important irreversible side effect:** the roll helper consumes one-shot **Guiding Bolt next-attack advantage** through `DELETE FROM public.encounter_timed_effects` and writes `effect_consumed` to the canonical combat log. Thus a diagnostic must NEVER call the roll helper: doing so would silently consume advantage even if the attack is never committed.

After rolling, the real writer applies damage via `encounter_apply_damage_internal_v1`, spends `action_available=false` even after one attack, and writes the attack result to `encounter_combat_log`, `encounter_command_requests` and `encounters.version`. The unarmed writer has a distinct canonical combat snapshot and 5-ft reach rule; it cannot be assumed equivalent to a weapon attack. Any actual multiattack adaptation must preserve all these effects exactly once per committed event, with Action spend exactly once per Attack action, and must remain compatible with the existing idempotency contract.

An additional source concern is that the canonical weapon profile can fall back to **case-insensitive item display-name catalogue matches**. This may support legacy equipment, but **is not sufficient provenance** to authorize a staged attunement or hand-action source. #292 therefore requires the candidate's exact `inventory_items.item_id`/source payload key to match `items_catalog.item_key`, and conservatively limits it to the unambiguous character custody/weapon equipment slots already supported by #286. That narrower filter is a staging limitation, not a migration of the canonical weapon profile.

## New private stable read-only preflight

`private.encounter_weapon_event_resolver_preflight_shadow_v1(participant_id,action_request_id,target_id,inventory_item_id,expected_ordinal)`:

- Requires a valid #291 attack session with exact encounter, character, round, turn and next available ordinal; an active undefeated participant with available canonical Action; a live same-encounter nondefeated target; no prior canonical weapon/unarmed attack recorded that turn.
- Requires an exact equipped item with character-specific physical custody, exact catalogue `item_key` identity, and a valid unchanged response from the **actual canonical weapon-profile function**. Anonymous/authenticated roles have no EXECUTE grant; service-role-only.
- Calls the **actual stable read-only targeting context** for the same participant and target; reproduces the canonical LOS, distance, melee reach, thrown-range and ranged normal/long-range checks, computes long-range/dodging base-disadvantage **signal**, and reports profile/targeting JSON without copying/rewriting attack modifiers.
- Does **NOT** invoke the attack roll helper, consume a Guiding Bolt advantage effect, apply damage, spend Action, write combat logs/requests, reserve a shadow attack slot, change target HP or alter physical inventory. All readiness/consumer flags remain false.
- Returns target AC including canonical cover bonus, but does **not** claim the future actual attack will hit or can safely reuse this read-only snapshot: target/cover/gear could change before the final locked execution.

## Isolated PG16 regression

`scripts/fixtures/attack_resolver_preflight_parity_shadow.sql` composes the entire #291 source/progression/encounter/weapon-profile fixture chain. It adds two exact catalogue weapons and a deliberately unknown weapon, then uses a **small synthetic geometry/LOS test double** for `encounter_targeting_context_internal_v1` because the full production encounter map/cover graph is not part of this isolated test. This fixture does **not** prove the actual terrain/LOS implementation; it verifies the preflight consumes the canonical targeting function's returned contract.

Cases include:
- Exact equality of the preflight weapon profile to the existing canonical weapon-profile read.
- LOS blocked, ranged normal/long-range disadvantage, beyond-long-range rejected, melee reach rejected and cover-adjusted AC.
- Exact item identity and invalidating a spoofed/unknown catalogue item.
- Next-ordinal, Action-spent, self-target and out-of-turn denial.
- Byte equality of inventory, spell slots, canonical participant rows, command results and shadow attack-event rows before/after the preflight.

The Node source guard explicitly searches for forbidden roll/effect-consumption, canonical action/attack/damage writer and any data mutation and pins the original canonical profile/targeting/roll/damage flow.

## Next safe step

**Do not simply invoke the old `encounter_weapon_attack_v1` twice or reset `action_available`.** That would bypass the original resolver invariants, risk duplicate RNG/effect consumption and cause HP/log/idempotency divergence.

A later, separately reviewed live implementation needs a transactionally atomic event resolver which:
1. Spends one original Attack action, reserves one of the source-authorized attack slots, locks actor/target/encounter and the action-event request identity in a consistent order.
2. Revalidates weapon custody/equipment, target/LOS/cover and any hand interaction at **commit** time, not only during an earlier preview.
3. Runs the roll/effect-consumption helper and applies damage **exactly once**, saving the result+log atomically. Failed transactions must roll back both the one-shot Guiding Bolt effect and the attack slot.
4. Preserves the existing weapon and unarmed one-attack RPCs for legacy/default callers, opportunity attacks, reactions, different target types, and special feature actions.
5. Covers subclass/Action Surge, multitarget/multiattack, ammo/Thrown/Versatile, Shield Utilize, somatic/focus grants, signed-in browser tests, exact-head previews and explicit production merge authorization.

**All #267–#292 attunement/combat PRs remain stacked draft, unmerged and undeployed.** No world map, town map, Forge, equipment UI, existing combat writer or live spell/HP/action touched.

Current dependency ledger: [Attunement_Effects_Integration_Current_Handoff_2026-10-26.md](Attunement_Effects_Integration_Current_Handoff_2026-10-26.md).
