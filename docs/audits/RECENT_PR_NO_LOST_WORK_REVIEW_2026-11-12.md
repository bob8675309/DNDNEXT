# DNDNext — Recent PR omissions and future full-source review: 45-open/32-reviewed-source-scope follow-up

**Source snapshot: November 12, 2026 before #375's audit-only main merge.** Main source pin `00c5c4416b99ac256913b48ef96387f3eabfde44`. This report is a source-exact GitHub review of **45 open draft PRs** (20 original user-priority drafts + **25 additional** I1/I2/audit drafts), the recently merged docs/P1/Tough PRs, and three previously merged adjacent source-preservation PRs. **No SQL/role/app/map/data was changed by the audit.** The detailed [Spell Engine/20-PR forensic report](SPELL_ENGINE_AND_ORIGINAL_PR_NO_LOST_WORK_AUDIT_2026-11-12.md) remains in held #375; its 19 deployed spell adapters, full #309/#312, archived effects and 584 original PR-scoped rows are not replaced by this follow-up.

## Findings that require correction or explicit protection

### F1 — #373 exact-head CI was NOT green when originally described as merge-ready

At head `53ac1ffd8fa3afa2947e9a9a93f044e35cafe973`, [run #43321108060](https://github.com/bob8675309/DNDNEXT/actions/runs/43321108060) had 5 successes but I2-I **FAILED** in the static ledger validator BEFORE the Admin source tests: its report text no longer contained a literal old phrase `I2I-01 through I2I-11`. The final teardown also failed because the disposable directory was never created. Prior source/test-only I2I cases were successful, but that does NOT satisfy final-head CI.

**Fixed, and retested:** #373 branch `b1b6a5179aee3bb27a0bf534c3e001b4222ba642` validates original signed case evidence against structured immutable result fields and fixes disposable teardown without touching original function fingerprints, the original RED, scratch GREEN, role constraints, or gameplay. **All six exact-head workflows are now SUCCESS**. In [I2-I run #43324887497](https://github.com/bob8675309/DNDNEXT/actions/runs/43324887497), all four sequential inherited I2-F/I2-G/I2-H/I2-I jobs are successful; the final Admin job log explicitly records **I2I-01 through I2I-11 PASS**. The separate normal I2-G, I2-H, handoff, Class and tactical checks succeeded. This supports a precise **12/34 original `UPDATE public.players` writers bounded-tested; 22 untested**, and nothing broader. No production Account Option A SQL cutover/role change. The original `authenticated` private helper database-role privilege concern is a separate local rolled-back SQL-role result; **external PostgREST exposure is unproven**. The I2-I report's older "final CI pending" sentence is historical; final status is this verified receipt.

### F2 — #348 preserved 20 ORIGINAL PR heads, but that wasn't the entire CURRENT open queue

[#348](https://github.com/bob8675309/DNDNEXT/pull/348) was correctly **merged to main** as docs/AGENTS only (38 files) with 4/4 checks, [source `1af494966210c62a5ea6705bdb27a1ce90485207`](https://github.com/bob8675309/DNDNEXT/pull/348) and merge `621de3cbd09c71f82d3ac4f02a858035cac9e207`; Vercel was READY. Its original 20 source-dossier heads were rechecked today: **20/20 match their still-open current GitHub heads**. But the 20 dossiers cannot stand in for the additional **25** stacked I1/I2/audit drafts and their inherited source trees. The original 584 source-file occurrences have prior exact SHA crosswalk in #375; those are not 584 unique features/files.

**Remedy:** all 45 active PR source HEAD and base SHAs are pinned in [ALL_OPEN_PR_REGISTER](ALL_OPEN_PR_REGISTER_2026-11-12.json). Every **24** I1/I2 new draft source diff (#349–#371 plus #373), together with held #375 and main/research merged #348/#372/#374 and original #347, is mapped per changed file SHA into **four exhaustive recent PR manifests**: 29 PRs, **245 PR-scoped path occurrences**, each base branch and main blob parity recorded. The live register is a dated snapshot; future PR events must be audited dynamically and the register refreshed instead of assuming it never changes.

### F3 — A merged badge concealed the destination branch; P1 source-only merge concealed deferred feature scope

[#372](https://github.com/bob8675309/DNDNEXT/pull/372) original signed Tough research **merged only to held #371**, not main: 10 files, 0 exact-main source blobs, 2 changed paths, 8 paths absent. Its source signed I2H-01–10 prior RED/GREEN and 11/34 historical count are preserved. The current #371 parent has 5/5 exact-head CI success; #373 inherits it and increases bounded coverage after source tests.

[#374](https://github.com/bob8675309/DNDNEXT/pull/374) **merged to main** with 4/4 exact-head CI and Vercel READY: 8 files all exactly on current main. This is a SAFE pure, **non-executing P1 validator/preflight** extraction from #347/#309, NOT the complete Spell Engine. It did not include source-original #309 Eldritch Blast planner/UI/private SQL/LOS/GoTrue fixtures nor inherited #312 P2 Fire Bolt behavior/transaction research, NPC shared delegation/known-ready v1/v2 visibility or command replay/locking. These remain open and intact in original branches, as fully indexed in #375. Future PRs must explicitly list **all inherited/deferred original source features**, not present a successfully extracted part as feature completion.

[#375](https://github.com/bob8675309/DNDNEXT/pull/375) was **safely merged into main on November 12** as docs/audit script/workflow only, merge SHA `cd87af6a95a94196f0db68e5d5a44a3ece489745` after 3/3 exact-head workflows succeeded at `2bb3e4d5a545da89b6b796885eecf43eadbc23bf`. Its six paths were absent **in the old main snapshot** but are now preserved on main. It remains a file-level original/source scope index, not semantic line-by-line acceptance or a deployable gameplay engine.

### F4 — Additional already-merged adjacent work was easy to overlook

A separate [three-PR source parity ledger](RELATED_MERGED_319_337_341_SOURCE_PARITY_2026-11-12.json) checks **81 changed-file entries** across previously merged:
- **#319** alternate-character legacy sheet preservation: six source/workflow/fixture/docs paths, all six present on main (five exact blobs, one later-updated doc). Its `sql/candidates` file is an *unapplied candidate*, not a claim that Option A sheet freeze is installed.
- **#337** original **19 XPHB** tactical spell adapter preservation gate: seven entries, source workflow, manifest, tests and audit report exact on main (handoff later updated); not a new Spell Engine executor.
- **#341** clean-main **68-file Forge source/fixture/tests extraction** (original #324/#328–#335 provenance): most paths exact, one later-updated doc. It shipped local signed source and browser test assets, **not production creation/Story/31-trigger migration**. This materially reduces the risk of treating all original Forge tests as missing, while original integration and security remain incomplete.

### F5 — The old root/main handoffs were stale even after successful merges

Before this audit, main `docs/ACTIVE_WORK.md` still said #374 was *pending* and Option A I2-I was **11/34**; root `AGENTS.md` pointed to unmerged #348 and no P1 completion. That is a factual handoff hazard, independent of source CI. This audit branch prepends a **dated authoritative current overlay** instead of deleting original negative receipts or history and appends to `HANDOFF_LOG.md`. The originals remain as dated snapshots.

## Complete audit of the 25 ADDITIONAL currently open PRs (no title-only retirement)

The following are source-pinned and **still held**; their immediate changed paths and inherited parent dependencies are recorded as *distinct* evidence. Each entry is **one bounded slice**, not a whole feature cutover:

| PR(s) | Distinct original feature, test and negative evidence to carry forward | Main disposition |
| --- | --- | --- |
| **#349** | Source-only original 31-trigger Forge ledger, historical 17 staged DDL names/14 not staged; six source artifacts and CI. | Held, not 31/31 runtime proof |
| **#350 → #351** | Original signed Forge nonce/creator Story RED: changed-only Story was accepted under same nonce in #350; #351 adds versioned complete-intent Story nonce correction, preserves historical negative. | Held stacked, not on main |
| **#352** | Joined signed original Stage4 inventory CHECK + 4 RLS/nonce/Story regression; original trigger gap and protected two world-map guard handlers. | Held; 31-trigger/auth/catalog/browser incomplete |
| **#353 → #354** | Original Wizard Savant/Signature + Battle Master maneuver grants/deferred validator, signed COMMIT/rollback; synthetic/reduced source catalog limits. | Held, not full Forge |
| **#355 → #356** | Warlock original legacy/normalized invocation safeguards, initial RED absent actual class materializer, followed by source-real signed first-creation acquisition and immutable Story/nonce/child grants. Both sets of positive and negative source assertions matter. | Held, partial trigger/catalog acceptance |
| **#357 → #358 → #359** | Original Eladrin season, Khoravar skill/tool versatility, High Elf/Khoravar cantrip materializers, with Warlock coexistence, source choice/ability validation and atomic deferred rejects. | Held, protected world-map never touched |
| **#360 → #361** | Original EFA Artificer Magic Item Plans at signed creation; distinct multi-character legacy-sheet overwrite RED and bounded compatibility scratch GREEN. | Held; historical green can still mirror same-character |
| **#362 → #364** | Original 34 account UPDATE writer census (plus INSERT/UPSERT and app readers), source-original HP/Admin XP cross-family REDs and earned-v5/Rage-rest RED/GREEN. | Held, not a global account freeze |
| **#365** | **Owner-selected Option A:** canonical per-character `character_sheets`, freeze all `players.sheet` historical bytes after *both same and other character* activity, retire automatic account mirror writers after consumer/role audit. | Policy research only, not installed |
| **#366 → #368** | First three original writer scratch changes plus authenticated ACL, original v1/v2 creation/signup RED/identity-only GREEN, modern signed v3/Story/nonce empty legacy sheet control. | Held, incomplete full 34 + 3 insert |
| **#369 → #371** | Signed original HP/Admin/Rage actions, private sourceChoices/species projection, player earned v1 level-up RED/GREEN, preserving inherited I2C–I2F tests. Private source helper tests are explicitly privileged **local SQL**, not signed RPCs. | Held, source-specific local proof |
| **#373** | Original signed Admin feat/boon projected account mirror RED and one reversible local Option A GREEN; actual final-head I2I-01..11 plus inherited green; separate SQL-role ACL exposure concern but no confirmed REST call. | **12/34 locally bounded-tested, 22 untested**, no hosted SQL |
| **#375** | Source-level 20-original + full Spell Engine/archived effects missing-blob inventory and 19-spell preservation CI. | Audit draft, no code integration |

**The 20 ORIGINAL drafts** #309/#312/#317/#318/#320–#325/#328–#335/#345/#347 remain independently documented and all **20 original dossier heads currently match live**. Their actual feature value was not discarded merely because recent research continues in descendant branches.

## Exact source path and test accounting

| Scope | Verified | Interpretation |
| --- | ---: | --- |
| Current open drafts | **45 at snapshot; 44 after #375's merger** | 20 original owner-priority + 25 additional I1/I2/audit initially; #375 then closed by safe audit-only main merge |
| Earlier original changed-file occurrences | **584** | 20 PR dossiers, repeats across stacked diffs, original #375 report |
| NEW recent/merged immediate-diff rows indexed | **245** | 29 PR entries including #347/#348/#372/#374/#375; not 245 unique files |
| Additional merged #319/#337/#341 immediate changed-file rows | **81** | Three already-on-main source-workstream bundles, separate from runtime release |
| Option A original `UPDATE public.players` writers tested in isolated source scratch | **12/34** | Current #373 exact-head signed CI success; **22** remain untested |
| Original Forge trigger DDL staged across original separate source fixtures | **17/31** historical baseline | Not a single 17/31 co-resident runnable graph; full **31/31** still blocked |
| Deployed source-qualified tactical adapters | **19** | Existing production XPHB per-spell casts preserved; no general recipe executor |

**Primary machine-readable audit artifacts:**
- [ALL_OPEN_PR_REGISTER_2026-11-12.json](ALL_OPEN_PR_REGISTER_2026-11-12.json)
- [RECENT_PR_SCOPE_PARITY_349_356_2026-11-12.json](RECENT_PR_SCOPE_PARITY_349_356_2026-11-12.json)
- [RECENT_PR_SCOPE_PARITY_357_364_2026-11-12.json](RECENT_PR_SCOPE_PARITY_357_364_2026-11-12.json)
- [RECENT_PR_SCOPE_PARITY_365_373_2026-11-12.json](RECENT_PR_SCOPE_PARITY_365_373_2026-11-12.json)
- [RECENT_PR_SCOPE_PARITY_MERGED_AND_PRESERVED_2026-11-12.json](RECENT_PR_SCOPE_PARITY_MERGED_AND_PRESERVED_2026-11-12.json)
- [RELATED_MERGED_319_337_341_SOURCE_PARITY_2026-11-12.json](RELATED_MERGED_319_337_341_SOURCE_PARITY_2026-11-12.json)

## Future work requirement, with automated enforcement AND honest limits

A new mandatory [PR_FULL_SCOPE_REVIEW_PROTOCOL.md](../PR_FULL_SCOPE_REVIEW_PROTOCOL.md), source review [template](../../.github/PULL_REQUEST_TEMPLATE.md), and [trusted-base GitHub Actions audit](../../.github/workflows/audit-pr-full-inheritance.yml) now exist in this held process PR. For every new or changed PR, the workflow enumerates **all paginated changed-file rows AND all inherited head/base/default-branch Git tree paths** and emits a machine-readable artifact/review summary. Future new PRs require explicit filled scope, original source, deferred work, evidence and release/rollback headings. Runtime/SQL changes cannot masquerade as docs/source-only. Old PRs remain warned and can be manually re-audited using workflow_dispatch, which is especially important for stacked bases predating the workflow.

**This workflow does not claim to prove semantics**, correct source class/edition, source ownership/RLS, full browser, hidden data, SQL lock consistency, backup restore, or whether a replacement genuinely preserves every feature. Those require qualified source review, full positive/negative tests and explicit approval. A passing CI step is NOT enough. GitHub branch protection must be separately configured by a maintainer to make the review check required; merely adding CI does not guarantee an unreviewed PR cannot merge.

**No source was silently removed.** Only audited #375 was closed through a verified docs/script/workflow-only main merge; original source research PRs remain open, and no live Supabase rows, migrations, grants, app maps or paid agents were modified. A main merge of this **docs/audit/CI-only** process would run standard hosting auto-CI; it cannot be treated as a gameplay release.

**ONE NEXT TASK:** perform a source-by-source final review of #373's original Admin grant callgraph/source hash and inherited I2-F/G/H signed evidence; keep 22 writers untested and the 31-trigger/full Author/Auth/restore gates open. If scoped research integration remains approved and exact HEAD checks are green, merge only into research parent, not main. Continue P2 spell and safe NPC/Forge source integration per I0–I6 without retiring any original PR until all behavior is classified and tested.
