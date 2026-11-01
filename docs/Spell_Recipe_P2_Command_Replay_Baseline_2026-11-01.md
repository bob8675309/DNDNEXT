# P2 — Global Command Replay / Actor Lock Audit and Signed-in Legacy Baseline

_2026-11-01. Research on draft PR #312, based on held #309. DnDWeb live SQL inspection was **SELECT only**. No public combat RPC was changed, deployed, granted, or executed in production._

## What this pass adds beyond the October 31 audits

Existing [public spell RPC audit](Spell_Recipe_P2_Public_RPC_Lock_Audit_2026-10-31.md) and [shared encounter lock graph](Spell_Recipe_P2_Shared_Encounter_Lock_Graph_2026-10-31.md) already document 22 public spell-cast function names (14 direct processors, 8 wrappers), eight additional non-spell ledger writers, trigger-side lock expansion and the proposed but **unimplemented** encounter-first order.

A fresh SELECT-only `pg_get_functiondef` scan on 2026-11-01 verified **18 authenticated-executable public direct ledger-insertion functions**. Each of the 18 has a `requested_by` ledger column on insert, but **none references `v_existing.requested_by` in its cached-replay branch**. This is a source-pattern inventory, not a proof that every 18 function leaks via every input: Admin-only and save/reaction handlers have earlier authorization checks, and some spell processors validate spell assignment/caster before returning. See `scripts/audits/encounter_command_replay_lock_readonly_p2.sql` to re-query sources, MD5 and first lock/controller reference positions.

The source-derived priority examples:

| Entry point | Live MD5 | Replay and lock concern |
| --- | --- | --- |
| `encounter_use_core_action_v1` | `74a43a001247f5fa491b057c97ca4014` | **Ledger then cached return before controller check**, does not bind original Dash/Disengage/Dodge choice or `requested_by`; actor then encounter locks |
| `encounter_move_active_participant_v1` | `1f7fc81b307800f70ab412872473aa14` | Ledger/cached replay before actor/encounter authorization; original hex path not persisted in ledger |
| `encounter_weapon_attack_v1` | `14433e4e379ae811edd9d9d8345711f8` | Ledger/cached replay before actor/target/encounter authorization; original target and inventory instance not bound on replay |
| `encounter_unarmed_strike_v1` | `44f0dad7e8ae9f6d8002c07e025ff0b7` | Ledger/cached replay before actor/target/encounter authorization |
| `encounter_end_turn_v1` | `2785f688af8e200f64f18b6c421f19a6` | Ledger/cached return before turn/controller recheck; actor then encounter locks and turn-start trigger may update other actors |
| `encounter_resolve_opportunity_reaction_v1` | `70cbfda404644c1000a6541ce8bf9c30` | Different order: reaction-window lock, **return if already resolved before controller check**, reactor/mover/encounter locks then ledger. Must bind window, choice, weapon and requesting controller |
| `encounter_roll_save_v1` | `337065c8f21bc89bc0ed2ee353c2d269` | Checks controller before ledger; cached result still lacks original ability/DC/source binding; no explicit FOR UPDATE in this body |
| `admin_apply_encounter_effect_v1` | `5a7da1de8fbb5764c12ed21e24aa0560` | Admin guard before ledger, then effect helper; ensure original source/target/effect payload identity and role survive exact replay |
| `encounter_cast_spell_v10` | `00d51eafc5eac574f979b88b277c6bb6` | Existing direct caster/target spell path locks after ledger and early replay; held private Fire Bolt candidate is not a global retrofit |

**Do not generalize the results to all possible caller paths**. For example, `encounter_cast_spell_v1` and v11 are short wrappers; their original private `*_pre_1v` and other public dispatch paths remain in the call graph. Specific command body/trigger snapshots remain in the previous audit files.

## A genuine signed-in baseline without deploying a vulnerable fix

`scripts/fixtures/encounter_core_action_live_replay_pg17.sql` imports the **unchanged 3,350-character original live** `public.encounter_use_core_action_v1(uuid,text,uuid)` body into a separate, disposable local Supabase PG17 database. It adds the two source-shaped participant fields required by the real body. The original RPC is executable for authenticated **local test users only** and is never installed, replaced, or called in production.

The existing three-account signed-in `scripts/test_npc_delegated_control_local_auth.mjs` runs the source SQL **after** its independently verified NPC permission, Fire Bolt, replay and source-secret tests. It sets a separate fresh request UUID and one action, confirms the original owner executes Dash, and then intentionally tests the original unsafe branch:
- Another still-authorized user sharing the same NPC submits **Dodge with that Dash request ID** and receives the owner's original cached Dash result (wrong user, wrong intent).
- The original Admin grant for the requesting owner is then revoked; the owner keeps the same signed-in GoTrue session and submits the original request ID again. The original function returns the cached result **without rechecking authority**.
- The test checks that these replay calls did not add another Action/log/version. **No double-spend of Action is claimed from replay**; the verified defect is result disclosure, stale authorization and unbound intent.
- Tests explicitly label the expected unsafe behavior a **legacy baseline**. Passing proves the current source-derived flaw exists in the isolated fixture; it **does not assert the production database was exploited** and it **does not mean the command has been fixed**.

A source contract `scripts/validate_encounter_command_replay_baseline_p2.mjs` prevents quietly replacing the original source body with a fake stub or describing a test of known-insecure replay as a secure acceptance run.

## Safe unified design contract before any migration

The held `private.encounter_cast_spell_v11_transaction_candidate_v1` is **caster-first**; the earlier trigger/lock graph indicates a production-safe all-command cutover needs an **encounter-first** canonical lock scheme with deterministic actor/target rows (and explicit reaction window priority). The behavior cannot be implemented safely as an isolated replacement of one public spell or action RPC.

For every public command and callback:
1. Validate a genuine signed-in actor, current encounter/participant controller and relevant target visibility **before disclosing an old result**, including post-revocation and shared-controller situations. A reused request UUID is never an authorization token.
2. Lock encounter, then sorted participants/targets and any required command-specific resource rows in one documented global order; account for encounter turn-start triggers, opportunity windows, and persistent character-slot triggers. Per-character resource ownership across two simultaneously active encounters needs a separate owner decision and lock contract.
3. Canonicalize/store **immutable typed intent** (actor, encounter, command type, target(s), hex path/direction, weapon/assignment, spell edition/key, slot and action choice as applicable), plus requester identity; replay must match **both** intent and requester. A request belonging to another user or command fails closed.
4. On exact same-authorized request, return original **completed** response without new rolls/logs, Action/slot expenditure or version increments. Pending/incomplete/modified request/legacy insufficient intent should fail closed, not return placeholder `pending` as success.
5. Do not weaken the authoritative encounter/slot/reaction/condition validation for new requests or allow an unsupported spell to be automatically resolved.
6. Plan atomic, owner-reviewed migration and rollback across all public entry points (including version wrappers), relevant function owners/EXECUTE grants and SQL triggers; deploy schema/server first, then UI only after genuine three-user Auth, old/new client parity, concurrency and browser acceptance.

This is a design checklist, **not approved implementation**. A staged change that makes only one command encounter-first while legacy commands still take ledger/actor/target-first locks risks mixed-order deadlocks.

## Remaining blockers / single next task

After exact-head CI verification, implement a **separate private ungranted encounter-first core-action transactional candidate** with canonical request owner/intent and test it in an isolated PG fixture against the frozen legacy baseline. Then inventory all remaining public RPC mutators and triggers for mixed lock cycles and determine a nonbreaking atomic release sequence. Never call the baseline a fixed vulnerability, never use live DnDWeb as staging, and do not merge/deploy without explicit owner approval. The delegated NPC ready-spell visibility default and overlapping-active-encounter resource policy remain GM decisions.
