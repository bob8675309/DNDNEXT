# P1.1 — Deployed Tactical Command Authority, Replay, and Lock Inventory

**Status:** Read-only audit; 2026-11-01; proposal/assessment ONLY. No production SQL, role grants, gameplay changes or browser command execution. Live Supabase project: DnDWeb (ucggczovhmauhshvhusx). Audited main: e10f2b28da8181cdc59bc47797f07c5f4d058c3d. Held research PR #312 head: 26d2f278b9e85e8fc0b0c04307b7a87bdd2e8254, stacked on draft PR #309. Always refresh SHA/grants/definitions before code changes.

## Audit contract and provenance

This record fulfills the scoped P1.1 inventory of public encounter commands, request identity, direct character-resource writers and trigger-induced writes. **It does not prove an exploit by another signed-in user or a production deadlock**, nor establish that every independent character-progression RPC is concurrency-safe. The audited evidence is live SELECT-only pg_proc definitions, pg_get_functiondef, has_function_privilege, pg_constraint, pg_trigger, pg_policies, information_schema, aggregate counts, and the reviewed current main client entry points. Reproduction queries: [read-only SQL](../scripts/audits/p1_encounter_command_authority_readonly.sql).

Avoid repeating work already present **only on held PR #312**: Spell_Recipe_P2_Public_RPC_Lock_Audit_2026-10-31.md, Spell_Recipe_P2_Shared_Encounter_Lock_Graph_2026-10-31.md, Spell_Recipe_P2_Command_Replay_Baseline_2026-11-01.md, Spell_Recipe_P2_NonLedger_Resource_Audit_2026-11-01.md, and related disposable PostgreSQL 16/17 + authenticated tests. Their detailed fixture results are research, not a production migration or proof of browser acceptance. The live MD5 fingerprints below were spot-checked and matched the earlier PR #312 research snapshots.

## Entry point census — do not confuse three different counts

1. **22 public encounter_cast_* names:** 14 direct ledger processors plus 8 routing/wrapper functions. Eighteen cast names have authenticated EXECUTE; the four *_pre_1v direct variants do not. None has anon EXECUTE. The eight routing names are encounter_cast_spell_v1, v4, v5, v6, v7, v8, v9, v11.
2. **22 direct command-ledger INSERT functions across all public functions:** 14 spell processors and eight non-spell writers. Eighteen of the direct inserters have authenticated EXECUTE; four spell *_pre_1v implementations are not directly authenticated-executable. **All 22 insert requested_by, none compares v_existing.requested_by on replay in the inspected definitions.** An earlier auth guard exists on some writers, so this count is **not** proof that all 22 disclose results to outsiders.
3. **14 authenticated admin_* encounter/map entry points directly update encounter* tables in their own bodies.** One (admin_apply_encounter_effect_v1) also uses the request ledger; the remaining 13 are outside it. Rest, spell slots, progression, source-choice configuration and class/resource paths add separate character writes. A ledger-only refactor cannot control all of these.

### All 14 spell ledger processors (live source)

| Routing family | Direct ledger processor functions | Authenticated EXECUTE |
| --- | --- | --- |
| Single-target/versioned | encounter_cast_spell_v1_pre_1v, encounter_cast_spell_v2, encounter_cast_spell_v3, encounter_cast_spell_v5_pre_1v, encounter_cast_spell_v6_pre_1v, encounter_cast_spell_v10, encounter_cast_spell_v11_pre_1v, encounter_cast_spell_v12, encounter_cast_spell_v13 | v2/v3/v10/v12/v13: yes; four *_pre_1v: no |
| Specialized selected/allocated/point/directional | encounter_cast_allocated_spell_v1, encounter_cast_area_spell_v1, encounter_cast_point_area_spell_v1, encounter_cast_directional_area_spell_v1, encounter_cast_directional_area_spell_v2 | All yes |

Eight additional callable cast wrappers (v1/v4/v5/v6/v7/v8/v9/v11) delegate to the active version chain or older implementations and can invoke the turn-slot guard before command-ledger ownership. Review their **complete call graph**, not just the latest v13 route.

### Eight non-spell ledger writers — exact order in deployed source

| Public entry point | Caller / current lock and authorization evidence | Replay binding gap |
| --- | --- | --- |
| encounter_use_core_action_v1 | combat.js dynamic runRpc; ledger INSERT/duplicate return -> actor FOR UPDATE -> encounter FOR UPDATE -> control check -> Dash/Disengage/Dodge/log | Duplicate accepted by type + participant without original requester or action choice; cached return before current authorization |
| encounter_move_active_participant_v1 | play.js; ledger -> mover FOR UPDATE -> encounter FOR UPDATE -> controller check -> path/reaction window | Original JSON hex path, original requester and fresh control not enforced on cached return |
| encounter_end_turn_v1 | play.js; ledger -> current participant FOR UPDATE -> encounter FOR UPDATE -> control -> condition/timed effect expiry -> next actor + encounter | Duplicate branch checks **command type only**, not even the same participant, original requester or active turn |
| encounter_weapon_attack_v1 | combat.js dynamic runRpc; ledger -> attacker FOR UPDATE -> target FOR UPDATE -> encounter FOR UPDATE -> control -> item profile/damage/log | Original target and inventory item identity absent from duplicate check; authorization follows cached return |
| encounter_unarmed_strike_v1 | combat.js dynamic runRpc; ledger -> attacker FOR UPDATE -> target FOR UPDATE -> encounter FOR UPDATE -> control/damage | Original target/requester not bound to cached replay |
| encounter_resolve_opportunity_reaction_v1 | play.js; reaction window FOR UPDATE -> **if already resolved, return** -> reactor FOR UPDATE -> mover FOR UPDATE -> encounter FOR UPDATE -> controller -> ledger -> attack/log | Already-resolved window returns before control check; pending duplicate checks type/reactor but not original choice or weapon |
| encounter_roll_save_v1 | combat.js dynamic runRpc; reads participant/encounter, **controller check before ledger**; no explicit row lock in this RPC body -> roll/log | Original ability, DC, source participant and requester not preserved/checked for duplicate |
| admin_apply_encounter_effect_v1 | Admin-only guarded function; admin auth **before ledger** -> effect resolver (target lock) -> log -> version | Original source/target/effect JSON and requester are not matched to the duplicate request |

Each function is SECURITY DEFINER and has authenticated EXECUTE. Client-side canControl flags are UX only; the server is the authority. Public helper encounter_can_control_participant_v1 presently accepts service role, Admin, matching participant.controller_user_id, or character_permissions.can_edit; the **proposed delegated NPC can_control permission on #312 is not in production**. Do not equate general character editing with the final desired per-NPC combat control policy.

**Concrete source fingerprints:** core action 74a43a001247f5fa491b057c97ca4014; move 1f7fc81b307800f70ab412872473aa14; end turn 2785f688af8e200f64f18b6c421f19a6; weapon attack 14433e4e379ae811edd9d9d8345711f8; reaction 70cbfda404644c1000a6541ce8bf9c30; save 337065c8f21bc89bc0ed2ee353c2d269; admin effect 5a7da1de8fbb5764c12ed21e24aa0560; spell v13 03ea7bd00bcd9734ef70ebc035c54a8d. These are **snapshot identifiers**, not immutable contracts.

## Other live, authenticated command and resource writers (outside same ledger)

| Scope | Functions / authority and cross-lock concern |
| --- | --- |
| Encounter setup, activation, stage | admin_create_encounter_v1, admin_start_encounter_v1, admin_set_encounter_status_v1, admin_add_encounter_participant_v1, admin_update_encounter_participant_staging_v1, admin_remove_encounter_participant_v1; all explicit Admin/service-role guards; encounter/participant writes trigger slot snapshots or activation refresh. Admin start takes encounter lock then changes participants, unlike participant-first commands. |
| Turn and combat administration | admin_set_encounter_turn_marker_v1, admin_set_encounter_damage_affinities_v1, admin_set_encounter_hex_v1, admin_remove_encounter_condition_v1; no shared request ledger. Turn-marker encounter UPDATE can trigger other actors' timed-effect/Speed writes. |
| Map/workshop administration | admin_upsert_encounter_map_v1, admin_upsert_encounter_map_object_v1, admin_delete_encounter_map_object_v1; admin guarded, mutate tactical map data, **not** the protected world/town map. |
| Persistent sheet resources | update_character_spell_slot_v1, update_character_spell_use_v1, complete_character_rest_v1; guarded character management RPCs; slot/uses updates and rest insert have active-encounter triggers. Rest performs restoration before inserting rest log, whose BEFORE trigger rejects active use, rolling back the SQL transaction if raised. |
| Other authenticated spell-assignment writers (secondary review inventory) | complete_character_level_up_v1; configure_character_circle_land_v1, configure_character_dread_allegiance_v1, configure_character_species_replaceable_cantrip_v1, configure_character_wizard_cantrip_formulas_v1, configure_character_wizard_memorize_spell_v1, configure_wizard_spell_mastery_v1; create_player_character_v1/v2/v3. The live SELECT-only source scan found direct character_spell table writes. **Their complete lock semantics were not traced line-by-line in P1.1**; P1.2 must include a concurrency audit if they overlap active encounters. |
| Internal damage/conditions | encounter_apply_damage_internal_v1 locks the target participant and applies equipped mitigation; encounter_opportunity_attack_internal_v1 also locks reactor and mover; timed effects helpers/conditions/slot refresh are server-controlled. No unrestricted authenticated EXECUTE on these internal damage helpers was observed. |

Additional public admin functions may affect encounter metadata indirectly through nested helpers; this table is a scoped census of directly matching functions, **not** a blanket certification of every function in the 253-public-function schema.

## Actual trigger and lock expansion

- **encounter_spell_slots AFTER UPDATE (spend)** -> private.mirror_encounter_spell_slot_spend_v1 -> character_spell_slots FOR UPDATE -> decrement with session-local resource_bridge_context='encounter_spend'; guard normally blocks direct sheet spending during active encounters but permits this trusted bridge.
- **character_spell_slots BEFORE UPDATE slots_remaining**, **character_spells BEFORE UPDATE uses_remaining**, **character_rest_log BEFORE INSERT** -> private.assert_character_resource_not_active_v1 -> private.character_active_encounter_v1. The guard only needs any matching active encounter, but its read model returns the most recently updated one; that is **not** a multi-encounter transaction-lock policy.
- **encounter_participants AFTER INSERT** snapshots slot pools; **encounters AFTER INSERT/UPDATE activation** refreshes encounter slot snapshots from character resources. These writes can overlap resource-bridge writes.
- **encounters AFTER UPDATE active_participant_id** expires target/source timed effects, locks effects and may update another participant's Speed; thus an encounter UPDATE is not merely an isolated header write.
- **encounter_participants BEFORE INSERT/UPDATE HP** runs max-HP guard; independent combat damage operations lock target and update HP.
- **character_spells** has four active trigger families, including the direct-authority guard, spell-use guard, wizard uniqueness and special resource overlay guard.

**Lock-order conflict to model, not an observed production deadlock:** participant -> encounter -> target/trigger in some legacy commands; encounter -> participants in admin start/slot-turn guard; window -> reactor -> mover -> encounter in reaction; slot snapshot -> persistent character slot in cast bridge. A candidate encounter-first lock placed alongside legacy ledger-first/participant-first paths can introduce wait cycles. PR #312 contains isolated concurrency scripts; it does **not** prove a safe partial deployment.

## Grants, RLS, and request constraints — observed

- public.encounter_command_requests: UUID request_id **global primary key**; encounter_id FK, nullable participant_id FK, command_type restricted to move/end_turn/core_action/attack/weapon_attack/save/reaction/effect/spell_cast; nullable requested_by; result JSONB; **no persisted immutable request intent, canonical input hash, explicit original action payload or controlling grant epoch**.
- Command ledger RLS enabled; authenticated role has **no direct SELECT/INSERT/UPDATE/DELETE table privileges** in checked metadata. The exploit surface is SECURITY DEFINER RPC replay, **not** an unrestricted table write.
- encounters, participants, spell snapshots, reaction windows, combat logs are RLS enabled and authenticated-readable under specific policies; checked tables have no direct authenticated mutation grant. Visibility checks need endpoint-specific review; direct table RLS alone does not sanitize all SECURITY DEFINER result JSON.
- character_spell_slots: authenticated SELECT but no direct mutations; character_spells has authenticated table write grants but its ALL-write policy is Admin-only, and a direct-authority trigger denies player authoritative spell writes. **Do not call this an unrestricted player bypass.**
- Confirmed 2 active encounters, 4 active participant rows with characters, 3 distinct character IDs and **1 character in both encounters** (aggregate only). **No production double spend or exploited replay was demonstrated**; shared canonical slot resource contention is a real policy/locking question.

## Main UI call graph traced

- pages/encounters/combat.js: runRpc(name,args) dispatches core, unarmed, weapon, several cast families and save; direct profile/control/targeting reads. Source-qualified spell routing and allowed choices must remain server checked; JavaScript dynamic name means a literal supabase.rpc search misses most commands.
- pages/encounters/play.js: direct move, reaction resolution, end turn; optimistic version updates/reaction UI are not transaction authority.
- pages/encounters/live.js: GM creation/activation, add/remove/stage/control participant; server Admin guards verified for sampled writers.
- pages/encounters/workspace.js: navigation/composition; no direct mutating RPC found in the inspected file.
- components/CharacterSheetResourceTracker.js: resource-profile read and Spell Mastery configuration; additional sheet/resource RPCs live in components/CharacterSheetEnhancements.js and other caller modules. Do not infer all character-sheet writes from one component.
- Relevant independent testing and ledgers: scripts/validate_tactical_spell_suite.mjs on main; existing PR #312 read-only SQL and simulated JWT concurrency tests. A static/source validator is not the same as two-controller browser concurrency.

## Release blockers and P1.2 one-task contract

1. Define an immutable, server-normalized **intent identity** per command family (requested_by, actor, encounter, exact action and parameters; path, target, weapon, slot/assignment, direction/area allocations, save DC/source, reaction window/choice). A result JSON cannot reconstruct hidden or changed original intent reliably.
2. Choose explicit behavior for legacy rows lacking stored intent, pending result rows, changed/revoked control, GM/service-role overrides and sensitive cached log/result visibility. Fail closed where proof is absent, but preserve documented safe retries.
3. Specify a **global** lock order covering encounter, participant(s) sorted, reaction windows, request ledger and canonical character resources, with existing wrappers, triggers and admin mutations included. Document exception handling and rollback/retry behavior; test mixed old/new calls in disposable PG16/17.
4. Decide shared canonical character in multiple active encounters: whether disallowed or globally serialized, and how slot spend/rest/level-up synchronization behaves. Do not infer user consent from snapshot data.
5. Keep NPC delegated combat permission separate from inventory/edit, and decide visibility of hidden/NPC spell choices; held PR #312 has candidates and real Auth tests but no live adoption.
6. Only after P1.2 contract approval pursue P1.3+ implementation/migration, source and genuine JWT tests, coordinated rollback and eventual owner-authorized deployment.

**Next single task (P1.2):** Draft a cross-command immutable request/replay/auth contract with compatibility table for every row above, including legacy/pending/revoked cases, and require a source-backed lock-order decision before changing SQL. **No production changes authorized.**
