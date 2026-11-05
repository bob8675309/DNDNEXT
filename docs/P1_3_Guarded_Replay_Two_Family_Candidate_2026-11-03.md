# P1.3 — Two-family guarded replay candidate, real-JWT and concurrency model (2026-11-03)

> **VERIFIED IN ISOLATION — NOT A PRODUCTION SECURITY FIX.** [GitHub Actions run 41638042390](https://github.com/bob8675309/DNDNEXT/actions/runs/41638042390) passed at exact source/test commit `62a0cf01a6ac1c83df5704b42565ba9ee5f85bc0`, all **8 GitHub checks green**. Cases **56–69** passed with three distinct genuine local GoTrue JWTs and a disposable PostgreSQL 17/PostgREST stack. The original vulnerable baseline cases **48–55** also continued passing as expected. No live database migration, grants, deployed code, data cleanup, merge or Vercel deployment.

## What was constructed

- [`scripts/fixtures/p1_3_guarded_replay_candidate_pg17.sql`](../scripts/fixtures/p1_3_guarded_replay_candidate_pg17.sql) is **scratch SQL**, never a production migration. It creates `private.p13_guarded_commands` (globally unique UUID; original human requester; actor; encounter; command family; versioned JSONB typed canonical intent; result), a common guarded transaction and two explicitly named test wrappers.
- [`scripts/fixtures/p1_3_legacy_core_action_live_pg17.sql`](../scripts/fixtures/p1_3_legacy_core_action_live_pg17.sql) is the source-exact deployed `public.encounter_use_core_action_v1` body, verified read-only against live MD5 `74a43a001247f5fa491b057c97ca4014` on 2026-11-03. The original deployed public spell v9→v1 source snapshot remains unchanged from earlier research.
- [`scripts/test_p1_3_guarded_candidate_local_jwt.mjs`](../scripts/test_p1_3_guarded_candidate_local_jwt.mjs) signs in three new accounts, uses PostgREST under their genuine claims, verifies resources/ledger and creates controlled concurrent requests. Tests run only on GitHub Actions CI with loopback-only GoTrue/PG17 requirements.
- The candidate locks encounter row **E**, then required participant rows **P** in ascending UUID order, then reads the relevant permission row `FOR SHARE` where an editor grant is needed, and then locks/inserts the scoped request row. The original source executor runs **after** these prelocks, in the same transaction. A failed executor rolls back both the guarded claim and the original ledger/action/slot changes.
- A request retry is checked against the current controller and current target visibility **before returning any result**, then matched to original requested-by, actor, encounter, family, and exact versioned typed JSONB operands. Completed matching requests return the original result without spending a new Action/slot. Missing original intent, changed operands, wrong requester, now-hidden target, and null-result pending requests fail closed. This is a **candidate implementation of P1.2's proposed R1/R2 behaviors**, not owner approval of those proposals.
- Scratch grants deliberately deny authenticated direct invocation of legacy `v9` and core-action RPCs while exposing only two guarded test entry points, with explicit `PUBLIC`/`anon` revokes. **Production grants are unchanged.** A real cutover must close *every* directly executable old version and alternate public command entry in one reviewed release.

## Verified real-JWT and concurrency cases

| Case | Actual isolated assertion |
| --- | --- |
| 56–58 | Three real JWT identities; an authorized spell cast commits once; same-user exact request replays; changed target/slot rejects |
| 59–60 | A second editor/controller cannot reuse the original user's UUID; revoked original controller cannot retrieve a prior result |
| 61–62 | Prior original-ledger UUID cannot be silently adopted; request IDs cannot cross actor, encounter, or spell/core family |
| 63 | Source-exact Dash core-action transaction and replay use same guard; Dodge intent substitution rejects |
| 64 | Concurrent signed-in Cast versus Dodge on one actor yields **exactly one** successful Action, without a deadlock in the tested schedule |
| 65 | Concurrent duplicate spell requests produce exactly one log and one slot debit, with identical cached outcomes |
| 66 | Anonymous candidate calls and directly callable legacy v9/core-action bypasses fail under the modeled cutover grants |
| 67 | Original target becoming hidden after cast blocks an otherwise exact replay; no stale private result is returned |
| 68 | Permission revocation holds an editor-grant row lock; overlapping signed-in Cast waits, rechecks, denies, and leaves no action, slot or request side effect |
| 69 | A committed request row with `result IS NULL` rejects as pending without reroll or new slot debit |

Source run: [41638042390](https://github.com/bob8675309/DNDNEXT/actions/runs/41638042390), tested SHA `62a0cf01a6ac1c83df5704b42565ba9ee5f85bc0`; **8/8 checks passed**. Earlier [run 41637437165](https://github.com/bob8675309/DNDNEXT/actions/runs/41637437165) tested cases 56–66 and also passed all eight checks.

## Constraints, open security work and nonclaims

1. **Only two command families covered.** Not a verified global lock protocol for all 22 public spell names, eight nonspell ledger writers, Admin staging, Move, End Turn, reactions, result-read RPCs, slot/rest writers, and turn/effect triggers. Legacy source internals still have incompatible lock orders. No universal deadlock freedom claim.
2. **Legacy bypass closure remains hypothetical.** The fixture's initial global function REVOKE is synthetic; deployed authenticated grants remain open. A new guarded wrapper **alone** is not secure if any old direct RPC remains reachable.
3. **Only direct-controller/`can_edit` authority works end-to-end through the unchanged original executor.** The proposed combat-only `can_control` grant is correctly kept distinct, but original source doesn't recognize it; coordinated executor/permission changes must preserve NPC secrets, sheet, and inventory isolation.
4. **Synthetic schema/role membership, controlled RLS, targeting, stats, and healing.** Auth/JWT is genuine, but there is no production-equivalent rule coverage, browser acceptance, real live-user exploit evidence or exploit of DnDWeb.
5. The candidate uses JSONB equality of a typed/versioned input map. The final P1.2 contract requires **an audited canonical fingerprint and normalized input persistence**, strict per-family validators, assignment/source mutation serialization, Admin/service identity treatment, safe result projection, bounded pending recovery and a coherent transaction protocol for every command.
6. The original spell/source assignment is looked up before the shared lock gate in this **bounded** candidate; a concurrently changing spellbook/assignment source is not proven safe. Do not promote it into the final algorithm without moving authoritative assignment validation under the selected locks.
7. TC1 **Option A** (one canonical character in at most one active encounter) is owner-approved but **not enforced in production**. The existing live overlap has not been reconciled. Paused/resume semantics and all C/S resource/trigger lock dependencies remain open.
8. P1.2 **R1 (unverifiable historic request IDs)** and **R2 (post-revocation cached-result access)** are still **owner-review gates**. This research models conservative fail-closed behavior, not final policy authorization.

**Next single P1.3 task:** Extend the **same candidate protocol to original End Turn, Move and reaction-window paths** and source-exact trigger/slot bridge, then run two-session E/P/W/L/X/S/C/grant contention (including cross-encounter shared character) in disposable PostgreSQL with real JWTs. Resolve R1/R2 owner choices before any authorized production design or migration. Do not merge PR #317 or touch live Supabase until all affected paths and rollback are approved.

**No manual user testing needed now.** Do not reproduce request replay cases on real campaign characters.
