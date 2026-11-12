# DNDNext — No-lost-work PR integration audit: deployed tactical effects, Spell Engine P1/P2, archived effects, and original PR stack

**Date:** 2026-11-12. **Reference main:** `00c5c4416b99ac256913b48ef96387f3eabfde44` (after #348 documentation and #374 safe P1-only merge). **STATUS: RESEARCH AUDIT ONLY. NO release, PR retirement, or production SQL permission.**

## Correction to the earlier narrow spell preservation

**The six original spell source/test/workflow blobs merged by #374 are byte-identical to the P1 source. They are NOT the complete spell engine or the full #309/#312 work.** Both the deployed engine and the larger unreleased research must be accounted for independently. The original [#309](https://github.com/bob8675309/DNDNEXT/pull/309) is 47 file changes relative to its archived base, and [#312](https://github.com/bob8675309/DNDNEXT/pull/312) adds 65 changes relative to #309. Crucially #312's complete branch tree inherits #309 and earlier archived work: do **not** mistake its 65 incremental paths for the full cumulative contents.

### The FOUR distinct spell/effects systems (source and owner documentation reconciled)

| System | Actual status on 2026-11-12 | Must preserve |
| --- | --- | --- |
| **A. Tactical effect foundation** | Already on production main and live SQL, earlier Phase 1G/1H: geometry/LOS/cover, attack and saves, type-based damage/affinity/mitigation/temp HP, healing, conditions, expiring effects, reaction windows, resource and command ledgers. | Live server ownership, source/permission/expiry semantics, legacy wrappers, official production migrations and positive/negative smoke history. The live `spell_effects` descriptive rows are NOT this engine. |
| **B. Deployed per-spell adapters** | Exactly **19** source-qualified `XPHB` spells in `pages/encounters/combat.js`; multiple versioned `encounter_cast_spell_v1..v13` and chosen-target, allocated, point-area, cone, line RPC families. Already deployed and historically tested; not all 19 have recent signed browser click proof. | Preserve the 19-key source filter, individual roll scopes, official 2024/source-specific behavior, hidden masking, action/slot/turn/condition expiration, prior rollback/CI/smoke results. Unsupported mechanics remain GM-assisted. |
| **C. Archived generic Common Character Effects** | [#251](https://github.com/bob8675309/DNDNEXT/pull/251)→[#253](https://github.com/bob8675309/DNDNEXT/pull/253)→[#255](https://github.com/bob8675309/DNDNEXT/pull/255) old research: source arithmetic `private.resolve_effect_bundle_v1`, equipment adapter and real-catalogue numerical parity; **closed/unmerged**. Separate #250 Physical Specimen and held attunement, item mitigation and atomic Attack comparisons. | The actual original helper SQL, equipment catalogue source fixtures, negative-control tests and historical successful/failed runs. Do not confuse with A's already executing tactical engine. |
| **D. Composable spell recipes and later P2** | P1 pure schema/preflight from #347/#374 now safely on main, while #309 Eldritch Blast, real Auth, LOS and staged UI; #312 Fire Bolt source/shadow, transactional replay, encounter locks, NPC delegated control and filtered spell-profile candidates remain **held**. There is **no approved deployed universal spell recipe interpreter**. | All original source, SQL candidates (uninstalled), actual signed Auth and PG fixture receipts, UI/provenance, shadow contracts, original failures, and owner decisions D1–D6. Do not silently retire or delete #309/#312. |

### Actual 19 production XPHB adapters (independently checked against main combat source)

`fire-bolt|xphb`, `cure-wounds|xphb`, `sacred-flame|xphb`, `toll-the-dead|xphb`, `poison-spray|xphb`, `false-life|xphb`, `inflict-wounds|xphb`, `shocking-grasp|xphb`, `ray-of-frost|xphb`, `chill-touch|xphb`, `mind-sliver|xphb`, `word-of-radiance|xphb`, `guiding-bolt|xphb`, `vicious-mockery|xphb`, `healing-word|xphb`, `acid-splash|xphb`, `magic-missile|xphb`, `burning-hands|xphb`, `lightning-bolt|xphb`.

These adapters are the non-regression baseline, not a count of all catalogue spells. See [Deployed Tactical Spell Effects and Smoke Recovery](../Deployed_Tactical_Spell_Effects_Smoke_Recovery_2026-11-07.md) and existing `scripts/data/tactical_spell_preservation_20261107.json` plus read-only CI.

## Exact source and branch ancestry (verified through non-truncated complete Git trees)

| Ref | Git commit / scope | Exact-path comparison to main | Interpretation |
| --- | --- | --- | --- |
| Current main | `00c5c4416b99ac256913b48ef96387f3eabfde44` | 2,039 blob paths | Includes deployed A/B, documentation, six #374 P1 files |
| Held #309 | `a24006624380570bd693a768e97a0c689f1d42b5`; 47 PR-scoped diff paths | Complete tree has **35 paths absent**, **19 paths present but different**, 1,764 exact same as main | 35 absent are code/SQL/fixtures/workflows; just 2 changed code paths include `pages/encounters/combat.js` and a visibility validator. Absence/difference requires semantic review before any port |
| Held #312 | `26d2f278b9e85e8fc0b0c04307b7a87bdd2e8254`; 65 PR-scoped incremental diff paths | Complete inherited tree has **95 paths absent** and **21 present but different** vs main, with 1,762 same | **82 absent non-document files** = 2 UI + 10 SQL candidates + 61 scripts/fixtures/audits + 5 utility modules + 4 workflows; plus 13 absent docs. Four divergent non-document paths include combat UI, NPC UI, encounter-rest workflow, team-spell visibility test |
| #309 → #312 | Direct stack; #312 base exactly #309 head | **60 added**, **5 modified**, **0 removed** file paths (complete-tree comparison) | #312 did NOT replace or drop the #309 source tree; its PR changes are incremental. Full integration must account for inherited Eldritch Blast and P1 evidence, plus all P2/NPC additions |
| Original #347 → merged #374 | #347 held original; #374 main source-only copy | Five P1 validator/preflight/example/test blobs match **exactly** across #309, #312, #347 and current main. #374 adds a matching source-only workflow and updates two handoff documents. | Safe pure-source foundation **preserved**; NOT proof P2/executor/EB/NPC work was merged |

**Machine-readable exact per-file ledger:** [`SPELL_ENGINE_PR309_PR312_EXACT_SOURCE_MANIFEST_2026-11-12.json`](SPELL_ENGINE_PR309_PR312_EXACT_SOURCE_MANIFEST_2026-11-12.json). It includes **every 47+65 original immediate-diff row**, all missing/different files from the **full 309 and inherited 312 trees**, and per-blob SHA parity against current main. These are exact-path comparisons, NOT proof of functionality absent when code was replaced under another path.

## Held #309 modules — beyond the P1 recipe validator

1. **Player-facing bounded Eldritch Blast planner:** `components/encounter/EldritchBlastPlanner.js`, `utils/eldritchBlastPlanner.mjs`, `utils/eldritchBlastRules.mjs`, `utils/eldritchBlastStagingCast.mjs` plus modified `pages/encounters/combat.js`. Independent beam/target allocation, character-level scaling, bound Agonizing Blast feature, human-readable summary and **explicit production-off staging guard**. These are NOT currently integrated into the main combat page.
2. **Source-original ungranted/private SQL:** `sql/candidates/20261029_eldritch_blast_atomic_candidate.sql`, authenticated bridge, Warlock damage bonus, profile/known-only metadata candidate. Server checks signed actor, bound spell assignment/Warlock invocation, targets, cover/LOS, independent beam damage, request id and ledger; all must be reconciled with #317 command-wide lock/replay before release. No browser/public EXECUTE/cast path is authorized by these files.
3. **Deep source test infrastructure:** local GoTrue tests, signed-in assertions, PG16 and PG17 original profile/targeting/damage, two-session contention and timeout cases, planner and staging guards, and LOS directional negatives. Preserve exact original source MD5 and failed/positive controls rather than carrying only utility modules.
4. **Spell source/rules metadata audits:** `utils/tacticalKnownSpellAssignments.mjs`, `utils/tacticalSpellMechanicsReview.mjs`, their validators, and original source documentation. These are not the same as the P1 schema.

## Held #312 incremental modules — beyond both P1 and Eldritch Blast

1. **P2 spell behavior and Fire Bolt parity:** `scripts/validate_spell_recipe_p2_shadow_contracts.mjs`, `...fire_bolt_shadow.mjs`, synthetic cases, original live cast audit, guarded/replay and atomic `sql/candidates/20261031_fire_bolt_*candidate.sql`; handles current source/edition/total-character-level discrepancy and authority checks. The comparator is source-only; the private transaction SQL is **uninstalled research**.
2. **Request identity / command transaction and global locks:** original replay failure characterization, `request_intent` proposal, private `encounter_core_action_transaction_candidate_v1`, E-before-actor locking vs legacy ledger-first code, multi-session lock-order and cross-encounter shared character resource fixtures. `request_intent` is not established installed on main. **Do not merge a lone E-first function while other public commands retain incompatible lock order**.
3. **NPC/familiar/sidekick delegated combat:** `sql/candidates/20261101_npc_delegated_control_candidate.sql`, `components/NpcControlPermissionsPanel.js`, `pages/npcs.js` and signed 2-player race/revocation fixtures. A distinct `can_control` permission must not be inferred from `can_edit`, and a shared NPC has one server-owned Action/reaction budget. Client UI must not deploy before its compatible schema, RPC and RLS.
4. **Private spell visibility and source-reader protection:** source-original `encounter_spellcasting_profile_v1/v2` known/currently-available-only delegation wrappers, indirect character resource and hidden participant RPC/read audit. **Both v1 and v2**, plus indirect consumers, must be filtered. Controller status must not expose full sheets, unprepared spells, GM/creator secrets or inventory/equipment rights. Also requires secure NPC Profile work #345 and Admin rights #318.
5. **Nonledger resource, request replay and read parity:** 61 scripts/fixtures/audits missing as exact files on main, including original negative behavior and local real GoTrue source tests. A green shadow validator is not source-complete signed release or browser acceptance.

## Older archived effects research NOT included in the 20 original open PR dossiers

[Separate exact original-head archive ledger](SPELL_EFFECTS_ARCHIVED_RESEARCH_MAIN_BLOB_PARITY_2026-11-12.json) preserves all changed paths and source SHA vs main for:

- #250 Physical Specimen 17/17 original changed paths absent on main, closed/unmerged.
- #251 foundational Common Character Effects 8/8 absent; #253 actual equipment resolver parity 3/3 absent; #255 real-catalogue equipment parity 5/5 absent; all closed/unmerged.
- #294 original Guiding Bolt/Vicious Mockery and equipped mitigation candidates 11 changed: 7 absent, 4 differing exact paths; source tests had recorded green isolation.
- #299 atomic Attack terminal research 5 changed: 3 absent, 2 differing; **two previously documented PostgreSQL fixture failures** must remain negative evidence, never silently promoted to green.
- #304 original Eldritch Blast standalone research 12 changed: 11 absent, one differing. #307 later 4-path null-AC/Force resistance follow-up merged **into #304's experimental branch only**, not main (3 absent, one differing). The newer held #309 ancestry contains later Eldritch Blast source variants: reconcile by exact blob/content and acceptance chronology, not by feature title.
- Other attunement/weapon/hand/encounter research and already merged #301 remain indexed in the dated readiness audit; do not infer their absence from a title-only filter.

## ALL 20 owner-prioritized original PRs — exact per-file accounting

The [full original preservation catalog](../pr-integration/README.md) names **20 original PRs**, their full source-head dossiers and **584 PR-scoped file rows**. In a separate machine-readable crosswalk, **all 584 entries were parsed from those source-pinned dossiers** and compared by Git blob to the pinned current main:

| Literal source path status across 584 PR-scoped rows | Count |
| --- | ---: |
| Source blob **identical** at same path on main | **185** |
| File path on main but **different** content blob | **130** |
| Source file path **absent** from main | **269** |
| **Total PR-scoped occurrences** (repeats across stacked PRs) | **584** |

**Exact [all-20 PR dossier blob-parity ledger](ORIGINAL_20_PR_DOSSIER_MAIN_BLOB_PARITY_2026-11-12.json).** This is **not** 269 lost features, **not** 584 unique files and **not** a claim the divergent files are regressions. It is an actionable complete preservation-checklist index to evaluate one source path at a time. Some old paths are obsolete, superseded by a later secure implementation, test-only, incompatible with current main, or depend on a non-deployed migration. Preserve their source and negative evidence until the replacement is specifically justified.

## Binding owner decisions (do not silently simplify)

- **D1 2024 XPHB-first** source-qualified spell identities; do not mix 2014/2024 and alternate edition rules.
- **D2 Spells first**, but future reusable typed primitives rather than hundreds of independent RPCs or independent unreviewed effects implementation.
- **D3 Full source-reviewed mechanics or GM-assisted**, no partial authoritative cast.
- **D4 Future visual Admin recipe authoring** via validated drafts, no arbitrary JS/SQL or unchecked publication.
- **D5 Future opt-in GM-controlled Actor AI** proposes/chooses the same server-issued permitted actions as humans, never authoritative dice/results/data writes.
- **D6 House rules separated** as versioned attributable overlays, never rewriting imported canonical rules.
- 19 deployed adapters remain source/regression oracles; recipes cannot supplant them before spell-by-spell parity. Keep Magic Missile dart identity, Word of Radiance shared rolls/independent saves, Acid Splash point origin, no-ignored reactions and expiring effect semantics.
- NPC delegation and Admin rights are independent of creator private Story and GM secrets. Never bypass current controller permission on replay. R1 fail old unverifiable requests; R2 reauthorize cached results after revocation; TC1 canonical character at most one active encounter; hidden event player wording `Unknown Events`.
- Next.js **Pages Router + Bootstrap/SCSS**; world/town/tactical maps separate, no world-map presentation edits without owner visual review. Preserve all game data, stock, inventory, Storage and original backup receipts.

## Required next integration work and release gates

1. Keep **#309, #312, #317, #345 and their original branches OPEN/immutable** until a feature-by-feature integration map marks every useful source/negative fixture/owner behavior as `exact_copy`, `behavioral_successor_verified`, `deferred_research` or `superseded_with_source_test`. No bulk rebases or wholesale merges of archived work.
2. Integrate **pure P2 read-only shadow validators** independently of candidate SQL/rights/UI once their exact import graph, fixtures and preserved P1 / 19-adapter tests are proven on a clean-current-main branch. Archive signed/source negative cases even if they cannot run on main. Then stage the Eldritch Blast planner/metadata and original signed source tests as a separate **non-live** candidate.
3. Before gameplay execution: coordinated #317 + #312 immutable typed request identity, role/visibility before cached replay, all-original RPC lock order and canonical actor/encounter resource budget, real 2-user signed PG17 Action/reaction/slot races, and complete RLS/sheet/profile/hidden visibility. No lone private core-action SQL or public cast route release.
4. Integrate #312 delegated can_control + safe NPC Profile #345 + Admin #318 together after SQL/client design and source-reader v1/v2 checks, with explicit full browser review. Do not ship NPC UI alone.
5. Only after above, implement a **new bounded server-authoritative composable recipe interpreter** using trusted already-deployed effects primitives, versioned rule registry and owner-reviewed spell data. Compare one spell at a time to golden RPCs, keep unsupported GM-assisted. Source-only P1 being green is not an executor.
6. Preserve older common-effect arithmetic/recovery and spell/equipment/attunement branches as separate source research. Never apply their candidates as a substitute for tactical engine or source grant checks.
7. For **all 20** original PRs, advance [I0–I6 integration plan](../PR_INTEGRATION_PRIORITIZED_PHASED_PLAN_2026-11-09.md), not title-driven cleanup. The safe docs-only and pure-validator main merges #348/#374 do not count as completion of all original feature scopes.
8. **Production release remains BLOCKED** on original full 31-trigger Forge/source catalog; real production role/ACL/RLS service and sheet/user privacy, all-command concurrency/locks/replay, signed full browser/Profile/rest/tactical flows, independent encrypted database + Storage backup restore, and **explicit owner deployment approval**. Current audit branch does not alter SQL, deployed code, grants, world/town/tactical maps or paid agent settings.

## Audit method and honesty

- GitHub PR-scoped files API: all 47 #309, all 65 #312; full patches fetched (**~291 KB and ~480 KB**), code/test/fixture/SQL boundaries classified.
- Complete non-truncated Git trees: main 2,039 blobs, #309 1,818 blobs, #312 1,878 blobs. Full-tree path/blob SHA crosswalk, including inherited #309→#312 60 adds, 5 modifies, **zero deletions**.
- Read substantive source-original held files for Eldritch Blast planner/guard/rules/SQL; P2 Fire Bolt transactional SQL; encounter core action/locks; NPC delegated SQL/permissions panel and multiple source/visibility/roll/replay docs. Read original file-specific #309/#312 detailed 47/65-file dossiers and the 20-PR owner's preservation catalog. No universal engine executable was found/installed from these branches.
- Checked deployed main combat source 19-key whitelist and dispatch, deployed tactical/effects smoke report, six owner decisions, all I0–I6 dependencies and original archived effects code-file lists. Compared all 584 original PR-dossier file rows to current exact main blobs.
- **Limitations:** no full semantic line-by-line verification of every 584 historical source occurrence, full browser acceptance, production signed action execution, no actual remote REST exposure test, no production migration or externally restored encrypted backup. **Exact SHA/file parity is a preservation inventory, not a safety certificate for integration**.
- **No merge, delete, branch cleanup, actual gameplay/DB update or deployment performed by this audit.** Keep this entire evidence branch unmerged until reviewed; do not lose original positive AND negative receipts.

**ONE NEXT TASK:** use the manifests to classify and preserve #309/#312 source-only P2 shadow and original Eldritch Blast test artifacts in a clean-main, non-executing **research** candidate with strict inherited P1 and deployed-19 regressions; no production SQL, cast route, NPC rights or character-data mutation. In parallel with general I0–I6 priorities, resolve status of each PR row before original PR retirement.
