> **NOVEMBER 15 REAL THREE-FILE PUBLISHER GREEN (MAIN CONTINUITY RELEASE):** The prior no-AI publisher activation failures are now verified repaired. [Real owner C34 source 244ec59c](https://github.com/bob8675309/DNDNEXT/pull/379) had [publisher SUCCESS 43729672932](https://github.com/bob8675309/DNDNEXT/actions/runs/43729672932); [OPEN_PRS.generated.md](https://github.com/bob8675309/DNDNEXT/blob/docs/agent-status/docs/OPEN_PRS.generated.md) was opened and verified with **44 unique open PR metadata rows** captured `2026-11-15T15:24:23Z`, source `244ec59c20c830610c4794ac905d1ca94585c0e0`; companion project health and C34 research snapshot match. New index is *metadata navigation only*, not complete CI/feature acceptance. The four original anchor CI reports and original source/negative-test dossiers remain preserved. Process PRs #380/#381/#382 merged to `main` `c3101a019a1c0a6a5c0191b05ee36cc7c456d2fc`, Vercel production READY. Later research pushes can update archive; always re-read source SHA. Owner active C34 **T27** next, not an autonomous agent task. Older draft/pending statements below describe historical states.

> **NOVEMBER 15 — REAL PUBLISHER SOURCE LIMITATION:** The first new-publisher owner research push [43728713385](https://github.com/bob8675309/DNDNEXT/actions/runs/43728713385) proved real pagination found **44 open PR metadata entries**, but shell archive publication failed on an extra quote at `openprs_old=`. An isolated follow-up candidate removes the extra quote and adds `bash -n` + intentional invalid quote regression. The **all-open-PR archive is NOT yet published**; `PROJECT_HEALTH.generated.md` still checks only four anchor PRs. Do not invent operational success from synthetic tests or the 44-entry collection; verify actual archive SHA after a new qualifying research push. Current domain work C34 T27 remains separate.

> **NOVEMBER 15, 2026 — REVIEW CANDIDATE, NOT CURRENT MAIN BEHAVIOR:** [draft #380](https://github.com/bob8675309/DNDNEXT/pull/380) proposes additive protection against missing source-fresh authored handoffs and a separate full-paginated list of all open PR heads in the existing docs/agent-status archive. The original four-PR detailed CI collector, Forge/agent snapshots, and atomic archive publishing remain intact. The proposed broader list has HEAD/base/draft/updated metadata only, **not 44 tested CI histories**, and refreshes only on qualifying owner research/agent pushes. A new PR gate is proposed only from **2026-11-16 00:00 UTC**; earlier/stacked PRs remain advisory to avoid retroactive CI blockage. Nothing here represents an existing deployed gate until a separately reviewed #380 merge. [Contract and rollback](HANDOFF_CONTINUITY_GUARD_2026-11-15.md).

# Research documentation maintenance — source-driven, no paid AI

**Owner request recorded November 6, 2026.** Keep research documentation current as engineering changes are made, without paid AI or broad production permissions.

## Two complementary paths

1. **Free automatic status:** `.github/workflows/research-docs-maintenance.yml` runs only on owner pushes to `research/**` and `agent/**` (never `main`), reads the exact source SHA, compares changed paths to the main-branch merge base, and uses independently recorded Forge trigger/JWT receipts if available. It publishes **only** `docs/research-status/<source-branch>.generated.md` on dedicated `docs/agent-status` using an atomic expected-head operation. No model call, live SQL, or production deployment.
2. **Living documents in the same proposed patch:** The supervised research agent's hard scope checker now rejects any proposed fixture/test/source patch without BOTH a factual append-only `docs/HANDOFF_LOG.md` receipt and an affected `docs/*.md` update, such as `ACTIVE_WORK.md` or a subsystem contract. Changes to `docs/SYSTEM_REGISTRY.json` must be identified for human review while that file remains outside the agent's research-only modification allowlist.

## Honesty and lifecycle

The generated status is a snapshot of a source commit, not proof of deployed code, production RLS, a passed CI run, or owner browser acceptance. It flags implementation commits with no authored docs updates. It cannot safely infer a new game rule or rewrite the living project contracts. Read `DOCUMENT_LIFECYCLE.md` before removing, replacing, or labeling any older doc obsolete. All dated receipts stay append-only.

A docs-only commit made with the default GitHub Actions `GITHUB_TOKEN` **does not trigger new CI**. Accordingly, the generated file explicitly cites the previous exact source SHA. The archive commit cannot alter the source PR tip or trigger additional source CI; it changes NO runtime/test code. Compare the recorded source SHA and its actual checks before using it as acceptance evidence.

## Security and budget

The docs-only workflow is owner-push-only, uses `contents: write` in its single job, checks out with credentials not persisted, supplies its short-lived token only in the final publish step, and uses GitHub GraphQL `createCommitOnBranch` with `expectedHeadOid` to avoid updating stale refs. The only permitted automatic path is `docs/research-status/<source-branch>.generated.md` on `docs/agent-status`. Failed permissions or branch protection must fail closed, not trigger a PAT workaround. The project-wide Vercel preview disable remains temporary and should be reviewed before resuming browser preview work.

The existing Codex research workflow remains manual, draft, non-funded, review-only, and with no production authority. Its requirement to update authored docs is still meaningful even when the free status workflow runs.

## How to verify

On each owner push inspect the `Research docs auto-maintainer (no AI, docs-only)` job and its generated file. Confirm that only the generated Markdown was appended to the separate status archive. Compare source commit and GitHub CI conclusions; separately check that authored living docs/handoff receipts were included with the engineering changes. Do not auto-merge this draft policy into main.

See `Legacy_PHB_Optional_Content_Design_2026-11-06.md` for the separate owner-requested future Admin setting.

## Stable new-chat entry point

The stable [Agent Touchstone](https://github.com/bob8675309/DNDNEXT/blob/docs/agent-status/docs/AGENT_TOUCHSTONE.md) is curated navigation. It links the generated Forge and agent source-status snapshots, main handoff rules, exact PR heads and original research/CI receipts. It is not an autonomous worker or substitute for replaying current source checks. It is intentionally separate from automatically generated snapshots and is mirrored in held PR #325 as `docs/AGENT_TOUCHSTONE.md`.

## Free consolidated project health — prototype-phase extension (research only)

`scripts/agents/project_health.mjs` and `scripts/agents/validate_project_health.mjs` provide a deterministic **GitHub-only** status report. On the owner research-branch push, the existing docs maintenance workflow fetches only PR metadata, latest exact-head GitHub Actions runs, last-commit file names, and generated research status archives for #317, #321, #324, and #325. It writes [`PROJECT_HEALTH.generated.md`](https://github.com/bob8675309/DNDNEXT/blob/docs/agent-status/docs/PROJECT_HEALTH.generated.md) **beside** the per-branch source snapshot in the independent `docs/agent-status` branch through the existing atomic expected-head publishing operation.

**Evidence limits:** GitHub `main` SHA is not Vercel production verification. A successful run for one branch is not a merge. The report is captured while other Actions may still be running; completion after capture requires checking GitHub directly or a later owner push. It never fabricates current Forge trigger counts when the source archive SHA does not match PR #324 HEAD. A failed read fails closed; the live project and authored handoff documents are never modified by the collector.

**Usage policy:** DNDNext is still a prototype; all game content is testing/fixture content rather than active players. **ChatGPT Work is on demand only for difficult investigations**, not a scheduled monitor. No OpenAI API key, Codex paid invocation, Work event task, extra credits, production SQL or Vercel deployment is involved. Source health generation runs on GitHub's standard public-repository hosted runners. The separate project-health status is factual navigation; accepted changes still require source-specific authored Markdown and handoff receipts.

**Activation and scope:** This isolated free-documentation PR proposes a default-branch source/CI publisher. It runs only after an owner push to matching research/agent branches, writes only the archive `docs/agent-status` under an expected-head check, and never invokes a model, Supabase, Vercel or a schedule. After merge, verify an actual matching owner-push run and the archive's source SHA before claiming that publication is operational. Paid supervised Codex remains in held PR #325, not this PR.
