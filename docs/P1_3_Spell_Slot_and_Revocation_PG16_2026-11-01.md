# P1.3 — Source-Derived Spell-Slot and Permission Concurrency Evidence

**Result: five research cases PASSED in disposable PostgreSQL 16. Not a deployed combat-security fix.**

Verified on 2026-11-01 local time: [GitHub run 41395991124](https://github.com/bob8675309/DNDNEXT/actions/runs/41395991124), [job 125117310710](https://github.com/bob8675309/DNDNEXT/actions/runs/41395991124/job/125117310710), commit 0ffcd12b066e578baf6a48ff705f7ec439c0c944. All seven CI checks passed at this SHA. Database function bodies were retrieved SELECT-only from live DnDWeb. No production SQL, grants, character resources, application files or deployments were modified.

## Exact sources and bounded fixture

| Live function or trigger | Definition MD5 | Usage in scratch PostgreSQL |
| --- | --- | --- |
| private.mirror_encounter_spell_slot_spend_v1 | b30565d75b05b042c1ad8f9803284486 | Unmodified trigger function |
| private.sync_character_spell_slots_v1 | 6c276ab2135fb90894fd8684e39ce1c3 | Unmodified persistent-slot synchronization |
| encounter_spell_slot_character_spend_bridge | Live trigger definition | AFTER UPDATE on snapshot slot decrease |
| public.encounter_can_control_participant_v1 | b91d975f399efb2ed2db8519f633fae7 | Unmodified permission-check helper |

The scratch schema and Auth uid function are mocks. Real GoTrue sessions, RLS, other combat triggers, all player/GM grant writers and actual action RPC bodies are not reproduced. The permission tests call the original control helper but use a **simulated action** afterward. The slot tests call actual slot bridge/sync source bodies using simulated encounter and class tables.

[Slot setup](../scripts/fixtures/p1_3_slot_bridge_setup_pg16.sql), [slot source](../scripts/fixtures/p1_3_slot_bridge_live_source_pg16.sql), [slot race script](../scripts/fixtures/p1_3_slot_bridge_race_pg16.sh), [permission setup](../scripts/fixtures/p1_3_permission_setup_pg16.sql), [permission source](../scripts/fixtures/p1_3_permission_live_source_pg16.sql), [permission race script](../scripts/fixtures/p1_3_permission_race_pg16.sh), [CI workflow](../.github/workflows/validate-p1-3-real-admin-paths.yml).

## Observed outcomes from real two-session PostgreSQL tests

**Case 12 — two snapshots, one persistent slot:** Two concurrent transactions try to spend one remaining canonical character slot from different snapshots. One commits; the other receives the existing insufficient-persistent-slots exception and rolls back. The persistent remaining balance and the two snapshots reflect exactly one spend. This is an adversarial test of *historical overlap*; owner-approved TC1 Option A forbids one canonical character in two active encounters in the eventual system.

**Case 13 — two snapshots, two persistent slots:** Both separate transactions commit, and the canonical pool decreases to zero. This verifies accounting in the limited scratch schema, not approval of concurrent dual-encounter gameplay.

**Case 14 — actual S to sync(C) source versus synthetic C-first maintenance-style operation:** One test session takes the canonical persistent pool row C before attempting the encounter slot snapshot S. The other decreases snapshot S, firing the exact mirror trigger and the sync function, whose INSERT ON CONFLICT path attempts C. PostgreSQL reports an actual scratch deadlock; rollback leaves S and C in a consistent balance. **The C-first writer was synthetic. No existing deployed maintenance RPC has yet been shown to take these same locks in that order.** The S-to-C sequence also contains upsert/delete uniqueness waits before the explicit FOR UPDATE C, so modeling it as a single C lock would be incomplete.

**Case 15 — stale controller approval:** The exact deployed control helper confirms the test user has a can_edit permission. A second session revokes it while the first session waits. The first session then performs a **simulated** character action, committed after revocation. This shows the stale-check risk when a command does not bind permission freshness through its transaction. **It is not an exploit reproduction for an existing live combat RPC.**

**Case 16 — permission-row lock positive control:** The authorized test transaction explicitly locks its permission row FOR SHARE, checks the same deployed helper, and executes the simulated action. A concurrent grant revocation blocks until the action transaction commits. The final event order confirms serialization. This is a bounded positive control, **not a globally approved grant-lock or combat transaction protocol**.

## Policy and safety boundaries

TC1 Option A remains approved: one canonical character can be active in only one encounter at a time. The one historical live overlap must be reviewed by the GM and never silently deleted or retargeted. The intended separate per-NPC delegated combat permission exists only in unmerged research; the deployed helper currently accepts controller_user_id, Admin, or character_permissions.can_edit, and the fixture does not pretend this is the final permission policy.

No actual signed-in JWT, real grant-revocation writer, real character maintenance function, or public spell/attack/reaction RPC was tested concurrently with these new paths. The opposite C-first path is a synthetic control, not evidence of a production deadlock. These cases neither establish production authorization exploitability nor choose a safe universal lock ordering across E, P, L, W, X, S, C and grants.

## Next single objective

Audit exact live persistent resource-maintenance and grant-revocation writers. Expand source-derived two-session tests and signed-in authorization races across real combat command versions. Only then propose a coordinated transaction order and reversible migration. **P1.3 and P1.5 remain OPEN; draft PR #317 must not be merged as a production fix.**
