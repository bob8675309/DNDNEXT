# C3.1 — Independent Forge source/JWT/PG17/browser research extraction

**2026-11-07; research-only, not a release.** [Draft PR #341](https://github.com/bob8675309/DNDNEXT/pull/341) was created **directly from main** `1ccde22f57c37dfed2e26473e8f28b11f639c8db` at exact head `3a1536754359af0bdab23c0764f49e85ea7d0d2d`. This separates the Forge J00–J169 research tests from held #324→#335's **old #321 NPC secret/RLS research inheritance**. [C3 crosswalk](C3_RESEARCH_PR_CONSOLIDATION_CROSSWALK_2026-11-07.md) and [C2 source diagnosis](C2_FORGE_CONSTRAINT_AND_RLS_CLOSEOUT_2026-11-07.md) remain authoritative for outstanding release gates.

## What was copied — verified Git object identity

Exactly **66 source files** from the held #335 tip `19d7275d24d26f9641c9e6d98ea24cf9431f4d81` are byte-identical Git blobs on the new clean branch: two disposable Forge research CI workflows; original `scripts/fixtures/forge_*` (SQL and scenario JSON); original source/seed/Warlock validators and test runner; local JWT/PG17 diagnostics; isolated React/Chromium J169 harness; three `sql/candidates/20261105_*` review files. Plus **two new provenance documents**, totaling 68 added files and **no modifications to existing main files**. Every source blob SHA and dependency comparison is pinned in [the research branch manifest](https://github.com/bob8675309/DNDNEXT/blob/research/forge-isolated-source-tests-20261107/docs/C3_1_FORGE_EXTRACTED_BLOBS_2026-11-07.json).

Ten unchanged main application prerequisites (`SourceChoiceFields`, `NewNpcModalV3`, `NpcPanel`, Forge class/derived/equipment UI, real Warlock/source-choice utilities) have the **same Git blob SHA** as the held #335 source. Thus the new tests use current main application source, not a copied/re-written mock of those UI rules. Four unused Forge automation/trigger-audit helpers remain in held #335; no `AGENTS.md`, `ACTIVE_WORK.md`, `HANDOFF_LOG.md`, registry, main app code, old #321 NPC SQL/test/source-guard, or map changes were imported. The remaining original trigger-acceptance gaps do **not** disappear.

The three `sql/candidates/` files are preserved at original paths because original source validators/isolated fixtures inspect and apply them only to **disposable PostgreSQL** with explicit nonproduction guards. **They are not production migrations**, no installed production RLS/grant/database data was changed.

## Exact new-head execution receipt (not inherited CI)

| Workflow | Result on `3a1536754359` |
| --- | --- |
| [Forge original source + disposable PG17 and real local GoTrue/PostgREST](https://github.com/bob8675309/DNDNEXT/actions/runs/42400448866) | **SUCCESS** — both original-pg17-replay and true-local-supabase-jwt jobs |
| [Actual React SourceChoiceFields Chromium J169](https://github.com/bob8675309/DNDNEXT/actions/runs/42400448862) | **SUCCESS**, component only |
| [Tactical spell preservation](https://github.com/bob8675309/DNDNEXT/actions/runs/42400448867) | SUCCESS |
| [Class browser](https://github.com/bob8675309/DNDNEXT/actions/runs/42400448945) | SUCCESS |
| [Handoff registry](https://github.com/bob8675309/DNDNEXT/actions/runs/42400448946) | SUCCESS |

The real local JWT run job log at 18:18–18:19 UTC explicitly reports **PASS J79** and **PASS J79B** for original signed v2/v3 deferred COMMIT `23514` under the old constraint with atomic rollback; **PASS J81** dropping the old CHECK in disposable PG17; **PASS J86/J87** demonstrating direct unauthorized item assignment under old live-shaped RLS after constraint-only removal; **PASS J88/J90** guarded four-policy+CHECK candidate and authorized original creation; **PASS J95** original signed v3 starting-market stock/currency/owner write, and **PASS J168** real frontend serializer→signed v3. Separate Chromium workflow J169 passed actual component clicks with no app-auth/browser creation request.

## Remaining gates and next owner decision

**C3.1 source-extraction and independent CI complete; merge NOT approved.** This is an isolated research suite, not a full source-catalogue/signed production Auth test, not a full `NewNpcModalV3` browser-to-RPC test, and only **17 of 31** originally identified creation-adjacent triggers are staged in the research lineage. It does not establish global P1.3 lock protocol, original GM/creator/outsider privacy, full RLS compatibility or all crafting/merchant consumers. The combined inventory RLS+CHECK SQL candidate remains **unapplied in production**; never drop the obsolete CHECK alone.

**ONE NEXT TASK:** Review [draft #341](https://github.com/bob8675309/DNDNEXT/pull/341) for a **separate explicit owner merge decision** on this non-executing research test package; inspect exact source scope/CI and the preserved negative/positive receipts. On approval, merge #341 after fresh exact-head CI and verify main; **do not automatically close #324/#328–#335** until source/unique evidence retention and owner retirement approval. Then C3.2 P1.3 security fixture extraction is next. This documentation receipt is not an approval to merge the research branch.
