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
