# DNDNext — Selective Codex delegation and verification

**Owner directive, 2026-11-27 Central.** The owner confirms the private DNDNEXT Codex cloud environment is published and authorizes the interactive engineering assistant and existing agents A–D to use or recommend the existing Codex capacity when it materially improves engineering work. This supplements the [connected development runbook](CONNECTED_DEVELOPMENT_WORKFLOW.md), [new-chat router](NEXT_CHAT_START_HERE.md), [full PR review protocol](PR_FULL_SCOPE_REVIEW_PROTOCOL.md), and [low-risk merge policy](LOW_RISK_MERGE_POLICY.md). It does not approve new paid services, scope expansion, automatic merges, protected-system changes or additional agents.

## 1. Environment and current capability evidence

The owner showed the DNDNEXT cloud configuration and confirmed publication. The visible setup uses the DNDNEXT repository, an isolated checkout, install/start scripts, package-manager domain access with unrestricted public internet disabled, private owner access, and no configured HTTP secrets, environment variables, OIDC or VPN. Keep this least-privilege baseline. Recheck actual environment and script contents if changed; screenshots and owner publication are not independent runtime verification.

Earlier owner environment testing reported Node 22.23.5, Supabase CLI 2.120.0, PostgreSQL 17 tools and Chromium/Playwright 1.56.1, synthetic sign-in and authenticated REST passing, but unattended Supabase startup blocked by the managed proxy returning HTTP 403 on the GoTrue health check. Do not bypass health checks, alter proxy trust, suppress errors or connect to production. Existing GitHub Actions remains the authoritative disposable PG17/Auth/PostgREST signed validation path. Codex can assist with source inspection, bounded implementation and browser work; its environment must prove any additional runtime claim through actual tests.

Live saved prompts for the four enabled roles were updated and verified on November 27, retaining their original schedules and enabled states. Retired tasks were not changed. The task environment selections were inherited, with no explicit attached environment returned. The available saved-task update capability changed prompts only; it did not attach a cloud environment or launch a Codex task. No direct general Codex launch action has been established in the connected chat. Do not equate environment publication, task instructions, GitHub access, or a mention in a PR comment with successful task execution.

## 2. When to use Codex

| Role | Useful bounded Codex assignment | Boundary |
| --- | --- | --- |
| Interactive development assistant | Complex cross-file changes, implementation/test design, independent second review | Owner-selected branch only; protected changes remain approval-gated |
| A — PR Integration | Full-tree original/inherited contribution comparisons, preservation ledger and regression review | Own C34 branch / #379 research, tests and docs only |
| B — CI Reliability | Reproducible harness failure analysis, dependency closure and conservative CI optimization evidence | Own Issue #389 independent branch; no live gate or workflow reduction |
| C — Spell & Combat | Cross-file rules and source-preservation analysis, bounded synthetic regression review | Own independent research branch; no unapproved protected gameplay implementation |
| D — Supervisor | Consolidate requests, independent evidence review and queue/rollover coordination | Read-only engineering supervisor; existing registry/rollover permissions only, no dispatch or PR comments |

Continue normal real executable deliverables. Do not send routine status work, trivial docs changes, repeated resolved investigations, or unnecessary duplicate reviews to Codex. Prefer independent reviewer separation when a complex patch merits it.

## 3. Request and execution paths

**Owner-submitted cloud task (available route):** open Codex, select the published private DNDNEXT environment, choose the exact authorized base branch and verify the requested base SHA in the checkout. Provide a bounded task card. Do not assume publication attaches the environment to scheduled ChatGPT agents. If a supported task environment selector becomes available, verify the actual selected environment and run checkout before calling that route operational; never claim attachment from prompt text.

**On-demand GitHub PR Code Review (pilot pending):** OpenAI documents the `@codex review` request mechanism ([official guidance](https://developers.openai.com/blog/custom-code-review-rules-for-codex)). Check the repository's [Code Review settings](https://chatgpt.com/codex/cloud/settings/code-review) separately. Environment publication alone does not establish repository-level Code Review access. Keep automatic reviews off initially if configurable. Before any agent dispatch, confirm repository enablement, the existing coordination allowance and one successful connector-posted pilot on an authorized PR. Record exact head, comment URL, actual Codex response and resulting review evidence. A comment posted successfully but no confirmed response is not a successful delegation; no automatic retries. Only agents already authorized to comment on their own PR may use the validated route, subject to supervisor coordination and original scope. Supervisor D coordinates but does not post requests. Do not modify or close original PRs or create feature PRs just to trigger a review.

**Direct general task launch / SDK / Actions:** not established in this chat. Do not add a new paid API key, SDK service, runner, agent or workflow merely to automate delegation. Separate owner approval and demonstrated capability are required. Existing manual limits remain TWO assignments per America/Chicago date across the project and ONE active assignment at a time, coordinated by D; these are operational limits, not platform quotas. Unknown usage or active state means do not dispatch. Failed submissions count; no auto-retry. Owner may explicitly revise these limits later.

## 4. Bounded handoff card

Use this structure; provide only relevant public-repository information and synthetic fixtures.

- Requesting role and one concrete deliverable; why Codex adds value.
- Exact repository, base branch/SHA, target paths, permitted branch and read-only versus implementation scope.
- Prior exact source/test receipts to reuse; original positive, negative and rollback evidence to preserve.
- Expected commands/checks, positive and negative cases, and realistic success criteria.
- Explicit no-go scope; no unrelated edits, main merges, deployments, protected maps or gameplay, private source transfer, production SQL, real data, credentials or billing changes.
- Return actual patch/diff, base/head identity, changed paths, command logs, case markers, unresolved gaps and one next step; do not auto-apply.

For a review-only task, request evidence with file/line references and regression implications, not file edits. Keep task patches unmerged and reviewable, and do not write another role's branch. Use a separately approved isolated task branch if necessary; verify base and patch scope against live source before acceptance.

## 5. Evidence, privacy and release

GitHub is public. Do not copy private database definitions, backup files, credentials, temporary URLs, player data, private task IDs, raw agent transcripts or secret-bearing logs into Codex, GitHub, CI or review comments. Use already-public Git sources and synthetic fixtures only in Codex unless a separate specific private transfer is authorized. Existing Dropbox custody remains separate. No hosted Supabase SQL (including SELECT) or production access through this environment.

A Codex review or patch is additional engineering evidence, not an acceptance gate replacement. Review full inherited diff, original contribution coverage, actual test outcomes and limitations; run the relevant exact-head Actions checks and inspect logs, signed case markers and teardown when applicable. Preserve failures, prior receipts, source fingerprints and branch ownership. Do not waive CI, production/restore gates or owner approval. No automatic application of a review finding. Record meaningful request/return/verification evidence in the authorized branch's handoff and D's existing coordination registry where appropriate, using sanitized identifiers only.

## 6. Continuity

Read this policy when starting a fresh assistant or agent replacement. Existing live role definitions and branch-local handoffs govern actual work. Preserve the approved cadence (A :05, B :25, C :45, D :55 Central condition-watch); do not create duplicate agents or change schedules. The November 27 live prompt amendments apply now, even if the documentation PR is awaiting integration. No separate Codex dispatch or verified PR review has occurred as part of this configuration update. Next capability step: confirm repository Code Review settings and run one coordinated, useful, read-only pilot; continue normal engineering in parallel.
