# DNDNext — Append-only Development Handoff Log

> See [PHASED_DEVELOPMENT_CHECKLIST.md](PHASED_DEVELOPMENT_CHECKLIST.md) for S0–S7 gate reporting and P0–P6 milestones. P0.1–P0.7 are recorded as complete on dated evidence below; repeat verification before any new deployment.

> This log records what was verified or actually changed. Do **not** replace older entries when a new chat begins. Use [HANDOFF_RECEIPT_TEMPLATE.md](HANDOFF_RECEIPT_TEMPLATE.md); link exact PR/head, tests and deployment. The snapshot dates here are historical after publication.

## 2026-11-01 — Whole-project documentation reconciliation, local preparation

- **Base reviewed:** GitHub `main` `eb376a4e3a7b0a7201a0ecb8a98366c1bba4e00a`; Vercel production READY at the same SHA.
- **Research:** #309 open draft (head `a24006624380570bd693a768e97a0c689f1d42b5`); #312 open draft stacked on #309 (head `26d2f278b9e85e8fc0b0c04307b7a87bdd2e8254`). Draft code and successful isolated JWT tests do not mean main/live code was changed.
- **Read-only database:** 243 recorded migrations, 253 public functions and 292 private functions; live core-action replay authorization weakness confirmed from function text; two active encounters and one character represented in both; v10 alchemy sampled as live; no `request_intent` or `can_control` column.
- **Verified source corrections:** official NPC printable sheet is integrated; Forge reusable 2.5D cube dice exists; PR #301 unified workspace/rest is merged; v10 breath recipes exist live; runtime resistance helper is not called by the live shared damage function.
- **Prepared scope:** system registry, current state, active work, evidence-based handoff log, document lifecycle, and read-only registry validator; corrections to active documentation entry points and two outdated feature headers.
- **No production action:** no DB writes, grants, pushes, merges, rollouts, destructive file removal or new Vercel deployment. This entry is part of a **locally prepared, unpushed documentation change**, not a remote commit receipt.
- **Testing limits:** source/read-only database inspection completed. New docs validator and patches require execution against the actual checkout before push; no new signed-in browser smoke was run.
- **Next one task:** review the documentation-only patch on a clean checkout, run `node scripts/validate_handoff_registry.mjs`, inspect `git diff`, then seek explicit push approval.

---

**Add newer dated receipts above this divider or below it consistently; never silently rewrite the evidence in this initial audit receipt.**
## 2026-11-01 — P0 documentation review branch (separate continuation receipt)

- **Target:** `docs/p0-handoff-registry-20261101` based on audited `main` `eb376a4e3a7b0a7201a0ecb8a98366c1bba4e00a`; fetch actual branch HEAD/CI from GitHub because a commit cannot embed its own final SHA.
- **Scope:** eight existing documentation entry points corrected without deletions, plus seven handoff/registry documents and one read-only validator. Phased S0–S7 and P0–P6 objectives added.
- **Verification:** exact old text anchors matched on audited `main`; all 58 registry source/test references existed in the GitHub tree; staging fixture and structural validations passed. A complete local repository checkout and authenticated browser acceptance were **not** executed in this session.
- **Release status:** documentation-only review branch, **not merged**. No live Supabase writes, grants, manual deployment, world/town map changes or gameplay modification.
- **Remaining gate:** review actual branch diff, verify exact-head CI and run the registry validator in a complete checkout; obtain explicit approval before merging. Continue at `P0.6` in `ACTIVE_WORK.md`.

## 2026-11-01 — P0.1–P0.6 review and exact-head validation

- **Review:** PR [#313](https://github.com/bob8675309/DNDNEXT/pull/313) is a docs-only delta from audited `main` `eb376a4e3a7b0a7201a0ecb8a98366c1bba4e00a`, initially 16 paths: eight existing doc edits, seven new docs, one read-only validator; no deletion, SQL or gameplay modification. An additional scope-limited `.github/workflows/validate-handoff-registry.yml` was added to test the validator on actual GitHub checkout.
- **CI evidence:** exact-head full-checkout validator succeeded at `6beb583770c3152f4fa5d7e848e5714d1b80ca19` ([run 41362632909](https://github.com/bob8675309/DNDNEXT/actions/runs/41362632909)); both other `validate` jobs also passed there. The verifier confirms all 18 system entries, linked source/test paths, phase headings and required document links. All latest-head results must be checked again before merge.
- **Approval:** Owner said `PROCEED` after being informed of the review/merge gate, authorizing the documentation review and merge contingent on passing checks. **No** approval was given to execute combat database migrations or deploy research code.
- **P0 objective state:** P0.1–P0.6 evidenced as review, checkout validation, navigation, classification, preservation and approved PR. P0.7 remains explicitly open until PR merge, Vercel production SHA and final handoff receipt are verified.
- **One next task:** `P0.7` — verify exact post-merge source and deployment and append receipt; then move to read-only `P1.1` command writer/lock-order inventory.

## 2026-11-01 — P0.7 merged production documentation foundation; handoff to P1.1

- **Review and merge:** [PR #313](https://github.com/bob8675309/DNDNEXT/pull/313) squash-merged into `main` at `de4cfb8c79264fa49aa12da0d1e3752f4a8ca03b` after final PR-head `97c819a3f646a0e11934cc922aafa3cc0a34d712` recorded four successful GitHub checks, including the dedicated full-checkout `handoff-registry` job.
- **Production verification:** Vercel deployment `dpl_8LeoXePm93rcz69rABa3B5ZoadpG` was independently observed READY in production with Git SHA `de4cfb8c79264fa49aa12da0d1e3752f4a8ca03b`; post-merge GitHub `handoff-registry` also completed successfully at that SHA.
- **Boundaries:** No gameplay JS, SQL migration, grant, Supabase data mutation, world/town map edit, AI action or research PR #309/#312 modification. Deployment occurred automatically because a documentation-only `main` merge triggers Vercel; READY does not imply owner browser acceptance.
- **Closure:** P0.1–P0.7 checkboxes have been marked on documented evidence. The living one-next-task pointer in `ACTIVE_WORK.md` advances to `P1 / P1.1`: **read-only deployed encounter command writer/replay/lock order inventory**. Do not deploy private core-action or spell-recipe research in this milestone.
- **Caveat:** This closeout receipt is committed in a separate docs-only follow-up, whose own SHA/deployment may supersede this observed checkpoint. Always verify the new branch and `main` after any follow-up merge.

## 2026-11-01 — P1.1 read-only live tactical command and resource inventory

- **Base/source:** production main `e10f2b28da8181cdc59bc47797f07c5f4d058c3d` (P0 complete); PR #309 draft head `a24006624380570bd693a768e97a0c689f1d42b5`; PR #312 draft head `26d2f278b9e85e8fc0b0c04307b7a87bdd2e8254` stacked on #309. Verify freshness before any next session.
- **Queries:** SELECT-only live `pg_proc`, `pg_get_functiondef`, function grants, `pg_constraint`, RLS/policies, triggers and aggregate counts. No mutating public RPC was called. Full scoped evidence [P1.1 matrix](P1_1_Tactical_Command_Authority_Live_Audit_2026-11-01.md) and repeatable [SQL](../scripts/audits/p1_encounter_command_authority_readonly.sql).
- **Observed:** 22 public spell-cast functions (14 ledger processors, eight wrappers); 22 direct public command-ledger inserters (18 authenticated-executable); zero existing request-row requested_by comparisons in direct replay logic. Additional Admin and character-rest/slot/feature resource writers outside the ledger, plus trigger-induced cross-locks. Legacy core/movement/end/attack duplicate checks can precede reauthorization; save and Admin effect have earlier guards, while reaction has an already-resolved pre-guard return. Do not assert every function has the same risk.
- **Other boundary:** 2 active encounters, 4 character participations, 3 distinct characters, one present in two active encounters (aggregate only). No live double spend or deadlock observed. Client source traced in combat/play/live/workspace, sheet resource module. PR #312 evidence is research only, no public candidate installed.
- **Status:** P1.1 read-only inventory evidenced complete; security defect **NOT remediated**. New documents prepared on an isolated docs research branch for review. No world/town map edits, prod SQL, auth grants, live data modifications, rollout or browser acceptance.
- **Next single task:** P1.2 canonical typed immutable request and replay policy design across all relevant command/actor/resource families. Require explicit review before P1.3 lock-order changes.

## 2026-11-01 — P1.2 proposed immutable command identity/replay policy (research only)

- **Source:** merged P1.1 on main `7727d75a92abb5904fdb7fd4e109accfe8e4603f`; live SELECT-only command ledger count 78, 20 null requester and zero null result rows. This is an aggregate snapshot, not requester provenance.
- **Proposal:** [P1.2 contract](P1_2_Command_Replay_Contract_2026-11-01.md) documents thirteen command-intent families, completed/pending/legacy/revoked replay decisions, same-NPC multi-controller isolation, role/visibility barriers and P1.3 locking dependencies.
- **Evidence boundary:** Declarative acceptance-case matrix plus pure Node checker verify **document coverage only**; they do not test JWT/SQL concurrency or demonstrate a fixed security vulnerability.
- **Owner gates:** R1 legacy fail-closed, R2 revoked-controller cache denial, R3 named trusted service principal, R4 same-character two-encounter resource policy (deferred to P1.5). P1.2 checklist intentionally remains unchecked until review.
- **Next one task:** review and approve/amend P1.2 proposal before starting P1.3. No production SQL, grants, gameplay, world/town maps or NPC delegation deployed.

## 2026-11-01 — P1.3 global lock-order design started, not proven

- **Source:** GitHub `main` `51c351a142d03378dff8e47e05182afe21a15622` after merged PR #316; held #309/#312 research remains unmerged. Supabase live SELECT-only fingerprints corroborate the sampled command and trigger definitions.
- **New research:** [P1.3 graph](P1_3_Global_Lock_Order_Research_2026-11-01.md) and [machine data](../scripts/fixtures/p1_3_lock_order_graph.json) classify 14 direct/helper/trigger paths, including four **possible** conflicting class-order pairs. New static CI checks consistency, not actual deadlock freedom.
- **Scope:** No combat/server code, production SQL, grants, mutating DB calls, world/town maps, AI enablement or migrations. Same canonical character may participate in two active encounters; P1.5 owner decision still open.
- **Outcome:** P1.2 marked complete as **research contract acceptance only** based on owner progression; P1.3 remains unchecked while full source coverage, mixed-version PG races and rollback are absent.
- **Single next task:** Expand true row-identity lock graph and run disposable two-session race fixtures before choosing a production transaction scheme. Owner manual testing not needed for this source-only branch.

## 2026-11-01 — TC1 owner selection: Option A, no simultaneous active encounters for same canonical character

- **Owner decision:** Explicitly selected **Option A** in chat. One canonical `public.characters.id` cannot be in two `encounters.status='active'` sessions at the same time. This is independent of multiple controllers per NPC or one controller of many NPCs. Durable specification: [Tactical Encounter Owner Decisions / TC1](TACTICAL_ENCOUNTER_OWNER_DECISIONS.md).
- **Read-only DB evidence refreshed:** Two active encounters, four linked active participant rows, three distinct canonical characters; **one** canonical character presently appears in two active encounters. No names/IDs extracted. **No records altered, deleted, reassigned or auto-resolved.**
- **Enforcement status:** Product policy approved; server-side guards, serialization, pause/resume classification, and historical reconciliation remain P1.3/P1.5 research and later explicitly authorized implementation. **Do not mark P1.5 complete** based solely on this decision.
- **Repository target:** Append this receipt and update contract, P1.3 research, active work, phase checklist and registry on draft PR #317's documentation branch only; preserve main/production.
- **Next single action:** Expand P1.3 lock proof and test competing same-character activation in disposable two-session PostgreSQL before selecting lock/root order or proposing migrations.

## 2026-11-01 — P1.3 Option A disposable PG16 fixture staged; CI pending

- **Scope:** New scratch PostgreSQL 16 schema, model-only admission function, two-process Bash race suite, GitHub service workflow and [eight-case evidence plan](P1_3_Option_A_Concurrency_Model_2026-11-01.md). Never calls Supabase or real combat RPCs.
- **Test cases:** competing same-character activation, unrelated characters, inverted participant staging order, historic-overlap preservation, rollback/retry, idempotence, synthetic reversed lock deadlock and ordered positive control.
- **Status at authoring:** New fixture **not yet tested by GitHub CI**; the next response must report actual exact-head run outcome and any patch. Passing a scratch model does not finish P1.3/P1.5.
- **Next single action:** Verify CI, fix any test fixture issues and then extend coverage to real source-derived trigger and grant paths.

## 2026-11-01 — P1.3 disposable PG16 model passed; live activation/resume path verified

- **CI:** [run 41385726293](https://github.com/bob8675309/DNDNEXT/actions/runs/41385726293) job 125086003890 **SUCCESS** on commit `cd2c070ac6e64fdf28e7755d264d60ea6f8d3df8`. Logs show all eight synthetic cases, expected activation conflicts, forced rollback, and an actual PostgreSQL `deadlock detected` event in intentionally reversed **scratch** L/E locks. The uniform ordering positive control passed. All other exact-head checks passed.
- **Live SELECT-only source:** `admin_start_encounter_v1` handles staged start; `admin_set_encounter_status_v1` delegates staged→active but has a separate paused→active UPDATE. Both need eventual TC1 admission. Participant staging/removal routines also have E/P lock differences.
- **Boundary:** No deployed RPC or migration was exercised. No Supabase writes, privileges, production schema/data, maps or AI were changed. P1.3 and P1.5 remain incomplete; one observed live overlapping character remains for GM review.
- **Next action:** Extend exact-production function and trigger fixture coverage including activation/resume, permission races and legacy wrappers; do not merge PR #317 without review.

## 2026-11-01 — P1.3 exact-source Admin Start/Resume fixture staged (CI pending)

- **Read-only live source:** `pg_get_functiondef` captured exact `admin_start_encounter_v1` and `admin_set_encounter_status_v1` bodies and MD5 fingerprints; no Supabase writes.
- **CI target:** disposable PostgreSQL 16, mocked dependencies and test-only TC1 admission trigger. Seven cases include **baseline unguarded starts and paused resume**, candidate two-session start race, candidate resume/direct writes, independent characters, and rollback/retry. No real JWT or complete combat triggers.
- **Evidence status:** New fixture CI **pending**; only earlier scratch 8-case suite is verified. P1.3/P1.5 still open; no merge or production migration.
- **Single next action:** Inspect exact-head CI and repair fixture-only issues, then extend to actual trigger/permission/resource dependencies.

## 2026-11-01 — P1.3 actual Admin function bodies executed in isolated PG16 (seven passes)

- **Exact test:** [run 41389394032](https://github.com/bob8675309/DNDNEXT/actions/runs/41389394032) / [job 125097217840](https://github.com/bob8675309/DNDNEXT/actions/runs/41389394032/job/125097217840) **SUCCESS** at `2f8c42deee0d85b36793b74b1ea1b488ac2b220a`; original source definitions MD5 `admin_set_encounter_status_v1=ab4592dc22632d646886f0d808cfb95f`, `admin_start_encounter_v1=ce7bb040cb09d9dac85517ea8206b44e`. All six other exact-commit GitHub checks passed.
- **Observed:** Two unguarded original Start Encounter function calls accepted separate encounters sharing one character in scratch tables; paused→active status function also allowed an overlapping character. A **test-only trigger** blocked concurrent conflicts and direct/resume status changes. Distinct characters succeeded; rollback restored state and prevented orphan logs. Log confirms seven cases.
- **Boundary:** Mock DB tables/Auth, no real Supabase RLS/GoTrue, no actual server trigger graph and no production writes. This is **not** acceptance of test-only E/P/C ordering or an authorized migration; P1.3 global proof and P1.5 enforcement remain undone.
- **Next one task:** Extend source-equivalent participant mutation/activation/expiry/slot bridge/permission tests and mixed-version two-client races in disposable PG before recommending any shared transaction scheme.

## 2026-11-01 — P1.3 source-derived Start/Staging PG16 deadlock verified

- **Exact evidence:** [run 41392432969](https://github.com/bob8675309/DNDNEXT/actions/runs/41392432969) / job `125106533413`, commit `30c646ee8a235e21036548f6f3796133fc1b4b2b`, all seven GitHub checks PASS. Logs explicitly report PostgreSQL `deadlock detected` for a scheduled same-row conflict using the original Start and Staging-Update bodies, plus a successful E-first prelock positive control.
- **Safety:** This occurred only in isolated PG16 with mocked dependencies and explicitly orchestrated transactions; no live production incident, SQL write or database change. [Detailed evidence](P1_3_Staging_Start_Lock_Race_2026-11-01.md).
- **Next task:** Expand to actual effect expiry and slot-bridge triggers, permission/authorization locking and old spell versions. No merge or production rollout.

## 2026-11-01 — P1.3 source turn-start expiry deadlock verified (scratch PG16)

- **CI evidence:** [run 41394548206](https://github.com/bob8675309/DNDNEXT/actions/runs/41394548206), job `125112944491`, commit `b2db2f8af7c5d2d745072422adf2e5317e65ba82`; all **7 GitHub checks PASSED**. Tests 10 and 11 complete on exact deployed turn-start trigger and speed-penalty helper source in mock schema.
- **Observation:** Source-derived E→X→P trigger reached the **same target P** held by a participant-first transaction; PostgreSQL logged `deadlock detected` in disposable PG16. Transactional effect/log consistency asserted. Positive control using E-first prelock completed the expiry/log, **only for this pair**.
- **Additional SELECT-only source:** slot bridge S→C calls `sync_character_spell_slots_v1` before locking C; sync includes persistent pool upsert/deletion and can introduce unique waits. Not yet concurrently tested.
- **Safety:** No live Supabase writes, runtime changes, map edits, AI or migrations. Draft PR #317 unmerged; P1.3/P1.5 unchecked. [Full evidence](P1_3_Turn_Start_Expiry_Lock_Race_2026-11-01.md).
- **Next one task:** build source-derived S→C sync and authorization/revocation race fixtures with real two-session PG16 before selecting transaction order.

## 2026-11-01 — P1.3 resource bridge and permission race model verified

- **CI:** [run 41395991124](https://github.com/bob8675309/DNDNEXT/actions/runs/41395991124), job 125117310710, SHA 0ffcd12b066e578baf6a48ff705f7ec439c0c944, all seven GitHub checks success; slot cases 12–14 and permission cases 15–16 passed.
- **Spell bridge:** Actual mirror/sync source prevented overspend across two snapshots in isolated PostgreSQL. The S-to-C bridge collided with a **synthetic** C-first transaction and produced a test-only deadlock with consistent rollback.
- **Permission:** Exact control-helper approval became stale when grant revocation preceded a **simulated** actor action; explicit permission row locking serialized the comparison test. Neither is a confirmed exploit in a deployed command.
- **Boundaries:** No real JWT, maintenance writer, combat command, live SQL, migration, grant or world/town map changes. TC1 Option A and historical overlap preservation remain intact. [Detailed evidence](P1_3_Spell_Slot_and_Revocation_PG16_2026-11-01.md).
- **Next single action:** find production resource/permission writers and test actual source-derived mixed-command lock and revocation behavior; P1.3/P1.5 remain OPEN.

## 2026-11-02 — Deployed encounter refresh C→S versus spend S→C race in scratch PG16

- **Exact CI:** [run 41558043789](https://github.com/bob8675309/DNDNEXT/actions/runs/41558043789), job `125661626514`, tested SHA `4831a8e746cae106a0689e1c311cf46914de555b`; **7/7 GitHub checks PASS**, case 17 PostgreSQL `deadlock detected`, case 18 scoped positive control PASS.
- **Live source:** refresh helper MD5 `d16af751b63fc3214b2b5d6cc9621160` performs sync(C) then snapshot(S) delete/upsert; activation-trigger wrapper MD5 `2c167384bbd138656a28c342eec8710b`. Real spend mirror S→C MD5 `b30565d75b05b042c1ad8f9803284486`, sync MD5 `6c276ab2135fb90894fd8684e39ce1c3`. [Source and test report](P1_3_Refresh_vs_Spend_Source_Lock_2026-11-02.md).
- **Scope/precision:** Both opposing functions are deployed source, but a manually imposed C lock and direct private refresh call were used to force interleaving. The real activation/turn/status triggers and cast entry points were not jointly executed. **No live production deadlock or exploit claim**. Scratch initial attempt failed on missing UUID default; corrected after verifying live `gen_random_uuid()` and rerun passed.
- **Other maintenance:** `update_character_spell_slot_v1` and `complete_character_rest_v1` write C but are not shown to write S directly; do not mislabel them C→S writers. Permission grant RLS is Admin-write/self-select, but command-authorization serialization remains unresolved.
- **No side effects:** No production Supabase writes, grants, migrations, gameplay/map changes or research PR merge. P1.3/P1.5 remain open; existing active overlap untouched for GM decision.
- **Next single task:** Test whether valid concurrent activation/refresh and actual public spell casting can reach opposing locks under genuine status/turn constraints; then cover signed-in grant revocation and full mixed-version lock graph before any lock-order proposal.

## 2026-11-02 — Exact public Start/Resume versus Healing Word v13 integration verified (scratch PG16)

- **Exact CI:** [run 41560428459](https://github.com/bob8675309/DNDNEXT/actions/runs/41560428459), job `125669464564`, tested SHA `cebc04adcc2651ea9e38db1a9d815798d8cfcd3d`: cases **19–21 all PASS**, all seven GitHub checks succeeded.
- **Live source snapshots:** `encounter_cast_spell_v13` MD5 `03ea7bd00bcd9734ef70ebc035c54a8d`; slot-turn guard `78195a807865efdbf74122a3d562a095`; Admin Start `ce7bb040cb09d9dac85517ea8206b44e`; Admin status `ab4592dc22632d646886f0d808cfb95f`; refresh `d16af751b63fc3214b2b5d6cc9621160`; mirror `b30565d75b05b042c1ad8f9803284486`.
- **Results:** Sequential *valid active-turn* Start→Healing Word consumes one S/C slot and logs once. A public v13 cast *attempted while Start was still staged/uncommitted* deadlocks against original Start E→P via caster P→E; abort leaves no partial slot/action/log. Paused→active public Resume then queued v13 cast commits correctly without deadlock in that pair.
- **Precision:** The pre-start cast attempt was not yet a committed valid active-turn action; do not claim deadlock among two already-valid turns or that private C↔S inversion is proven reachable through valid public actions. Healing/profile/Auth schema dependencies remain mocked. No user data or production RPC executed. [Full report](P1_3_Public_Activation_Cast_Reachability_2026-11-02.md).
- **Test repair:** first run `41560249154` failed only due to a quote in an assertion message after cases 19–20; fixed fixture and rerun green at exact test SHA.
- **No production change:** PR #317 draft and unmerged, main unchanged, no live migrations/grants/gameplay/map changes, TC1 Option A not deployed, existing one-character overlap preserved for GM review.
- **One next task:** Test real attack/movement/reaction/end-turn and v10–v13 delegated spell writers under valid turn and status transitions, then verify real NPC grant revocation with JWTs; keep P1.3/P1.5 unchecked.
