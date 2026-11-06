# DNDNext — Supervised Research Agent Setup

**Status: proposed, inactive until merged and configured.** This file belongs to the separate draft automation PR, not to the live DNDNext application or held Forge PR #324. It is a real implementation blueprint, not evidence that an AI key is configured or that a Codex run was executed.

## Scope and authority

The research agent is a **developer-side GitHub Actions tool**, entirely separate from the future **in-game local-first Actor AI** in [DNDNEXT_AI_INTEGRATION_FOUNDATION.md](DNDNEXT_AI_INTEGRATION_FOUNDATION.md). It can read a chosen existing \`research/*\` or \`agent/*\` branch, inspect optional **failed** GitHub Actions logs, carry out a single bounded research/test task, make at most two Codex attempts in a GitHub runner workspace, rerun one local Node source validator, and upload a human-review patch artifact. It does **not** auto-push, merge, open a PR, run live SQL, deploy, write production data, or turn on gameplay AI.

**PR branch:** \`agent/research-orchestrator-20261105\` (to be checked at creation).
**Runtime:** \`.github/workflows/dndnext-research-agent.yml\` using official \`openai/codex-action@v1\`, \`scripts/agents/research_agent.mjs\`, and \`.github/codex/prompts/dndnext-research-agent.md\`. No automatic \`schedule\`, \`workflow_run\`, \`pull_request_target\`, issue-comment trigger, or background AI cost. A separate **free static validator** \`.github/workflows/validate-dndnext-research-agent.yml\` runs on a relevant pull request (no key).

### Run flow

1. Only a user with GitHub Actions workflow-dispatch access can explicitly start the agent after the workflow has been merged to the default branch. The input \`confirmation=RUN_RESEARCH\` is required; other dispatches skip. **API usage is paid separately from ChatGPT** and requires the user to configure \`OPENAI_API_KEY\` as a GitHub Actions repository secret first. The workflow fails early if it is absent.
2. The workflow checks out **trusted controller code from main** and the named \`research/*\` or \`agent/*\` target into a second checkout, with both \`persist-credentials:false\`. Branch and ref are checked before creating any model context. Only the target working tree is eligible for a patch. GitHub Actions permissions are **\`contents: read\`, \`actions: read\`**.
3. The optional \`source_run_id\` fetches existing **failed-job GitHub Actions logs**, sanitized before model access. The user supplies the task, which is written into \`target/.agent-input/REQUEST.md\` alongside the sanitized logs. Any log content is untrusted evidence, not instructions.
4. Run one selected **local source/static validator** (Forge, handoff, or security). This is **not** the original PG17/GoTrue full JWT suite; that remains a separate held-PR CI gate. The research agent cannot claim DB acceptance from static validation.
5. Invoke the OpenAI Codex Action with \`sandbox:workspace-write\`, restricted to the target checkout. Run its first pass, strictly reject changed paths outside docs/*.md, research-only fixtures/tests/validators, or \`sql/candidates/*.sql\`. The runner enforces file/count/size/deletion/symlink and whitespace checks. If validator still fails and \`max_passes=2\` was explicitly selected, allow **one** additional Codex pass, then retest.
6. Upload \`research.patch\`, \`REVIEW.md\` and sanitized validation output as a 7-day GitHub Actions artifact. **No git push or write token is available.** A human must inspect and apply the patch, then rerun the full disposable, authenticated suite on the actual proposed commit. An unresolved or forbidden-path failure causes the workflow to fail closed.

### Preconditions / activation (not performed by this draft PR)

- Owner reviews this separate draft PR; **do not merge automatically**. Merging a configuration-only PR into \`main\` may itself cause a Vercel production deployment; coordinate merge with an intentionally batched release.
- Review the bounded workflow permissions, file scope, official Codex Action version, and OpenAI API project budget. In GitHub **Settings → Secrets and variables → Actions → New repository secret**, create \`OPENAI_API_KEY\`. Do not paste it into issues, files, this chat, GitHub workflows, a Vercel env var or Supabase. Prefer a budget-capped dedicated API project/key, and rotate/revoke when no longer needed.
- After owner approval/merge and key configuration, open **GitHub → Actions → “DNDNext supervised research agent (manual, review-only)” → Run workflow**. Choose \`target_ref\` (e.g., \`research/forge-immutable-creation-replay-20261105\`), give one bounded task, optional failed GitHub Actions run ID, validator suite, . Explicitly select \`RUN_RESEARCH\`.
- Download the run's \`dndnext-research-agent-review-<run>\` artifact. Check \`research.patch\`, validate provenance/source hashes, and apply only after human review. Never equate patch generation with a passed authenticated database run.
- A second unattended, multi-PR agent phase requires separate owner approval, a restricted GitHub App identity, explicit cost/CI quotas, reviewed branch-protection rules, rollback/recovery and tests for prompt-injection/log-exfiltration. It is **not enabled** by this PR.

### Files, costs, and Vercel budget

The proposed \`vercel.json\` adds \`git.deploymentEnabled\` exclusions for \`agent/**\`, \`research/**\`, and \`docs/**\`. It preserves the existing \`buildCommand\` and \`ignoreCommand\` exactly. Vercel's branch-based deployment exclusions prevent those Git pushes from triggering automatic previews when the configuration is active; the existing agent-only \`ignoreCommand\` was insufficient as a quota guarantee. Other preview branches retain their prior behavior. Do **not** assume Vercel has adopted the change before review/merge and inspection. No Vercel project API configuration or preview deployment was changed in this setup.

**Cost and limit posture:** no cron, no scheduled paid calls, no automatic AI on PRs, no model calls from free validation, one paid invocation per explicitly confirmed dispatch, 35-minute job timeout, single branch-scoped concurrency key, seven-day patch retention, no live DB credentials. GitHub Actions runner minutes and API token usage still count under the owner's applicable billing plans and should be monitored.

### Accepted versus unverified

Source-static PR check verifies boundary tests and that the workflow does not request write permissions. It does **not** verify an actual Codex run or paid API success, nor original Forge J124 source behavior, until a manually funded dispatch on an approved branch. The current DNDNext product state is always reverified from the actual GitHub PR/head, live read-only Supabase and exact CI. Historical docs do not override new facts.

**References:** [official Codex GitHub Action](https://github.com/openai/codex-action), [Codex noninteractive mode](https://learn.chatgpt.com/docs/non-interactive-mode), [Vercel branch deployment exclusions](https://vercel.com/docs/project-configuration/git-configuration), [approved DNDNext AI foundation](DNDNEXT_AI_INTEGRATION_FOUNDATION.md).

**Single next action:** run the no-cost PR validation, inspect the actual draft PR changed-file list and commit SHA, then get owner approval to merge in a controlled release batch; configure an OpenAI API key only through a secure setup flow and run the first bounded manual invocation.

## 2026-11-05 follow-up: source-grounded Forge creation-trigger assistance (still a draft)

The bot adds a **free manual audit mode**: GitHub Actions workflow dispatch with `confirmation=RUN_AUDIT`, `suite=forge-triggers`, and target `research/forge-immutable-creation-replay-20261105`. It runs without `OPENAI_API_KEY` or a model call. The controller compares the held PR's dated **31 original** trigger census against actual executable `CREATE TRIGGER` SQL in the Forge fixtures, checks handler identity/timing and notes declarations/hash strings. Artifacts include `FORGE_TRIGGER_COVERAGE.md` and `.json` with installed-DDL-versus-unstaged gaps. This is an offline report from a dated live census, not a fresh live database audit.

The **optional** `RUN_RESEARCH` mode can use that report to prepare a review-only patch for **one** missing trigger. It remains one paid Codex action invocation (the model may make up to two local corrections within that invocation), never a two-call autonomous repair loop. Exact original handler bodies, source MD5, dependencies, trigger timing and honest negative/positive JWT acceptance must come from original source; if absent, the bot must report a blocker rather than invent data. The source inventory document itself is removed from the bot's writable allowlist.

At the dated PR #324 review, original live table census was 19 progression + 4 sheets + 6 characters + 2 inventory. The then-current disposable Forge fixtures contained DDL for 12 of those original 31, leaving 19 original triggers not yet staged. Additional original grant-table triggers are separate and do not count toward these 31. A staged trigger is not proof that its branch, surrounding schema, transaction ordering, or all original RLS was exercised.

This proposal does **not** add a paid API key, dispatch a workflow, install SQL, merge, deploy, or configure Vercel. After owner-reviewed approval/merge, run the free mode first, inspect the report, then optionally fund and dispatch one narrowly specified research attempt. Preserve the user's preview-deployment budget.

## Proof without merging the research bot (2026-11-05 continuation)

The free PR validator now has a second **pull-request-only** job that checks out the current held Forge research branch and runs the same 31-trigger static audit on the exact checked-out source. It prints the target commit SHA, fails closed if the dated original census is incomplete or fixture metadata mismatches, and uploads Markdown/JSON artifacts. This does not require merging the bot to `main`, any OpenAI API key, a paid invocation, database writes or a Vercel deployment.

This is an audit of original trigger **DDL coverage**, not a source-body parity or signed JWT acceptance run. Follow the latest PR CI artifact rather than copying the older 7/31 historical status. The next single fixture candidate should be selected from that report and the live `pg_get_functiondef`/trigger metadata, preserving the exact source and staging only on held research.

## Verified free cross-branch audit receipt (Nov 5 CST / Nov 6 UTC)

- **Agent draft:** PR #325, exact head `a75205dba51930fc5b99b6ea5c4b8ee45c0c2f1a`. The PR-side checkout in GitHub Actions is a synthetic merge commit; distinguish it from the actual PR branch head.
- **Source:** held Forge PR #324, exact head `4e213b8ac272001343f7e42ee3c56373a4527024f`, stacked on held NPC-privacy PR #321.
- **Free GitHub Actions:** [run 42163324696](https://github.com/bob8675309/DNDNEXT/actions/runs/42163324696) **SUCCESS**, including the full-source trigger census job and the original agent safety validator. No API key/model call; no SQL executed, no merges, no game code changes.
- **Uploaded review artifact:** [forge-original-trigger-coverage-42163324696](https://github.com/bob8675309/DNDNEXT/actions/runs/42163324696/artifacts/13477393963), Markdown and JSON; seven-day retention through Nov 13 UTC.
- **Result:** 31 deployed original creation-adjacent triggers in the dated census; **12** matching fixture DDL, **19** not staged, **0** DDL mismatch. Distinguish original table triggers from other downstream G/GI triggers and proposed new creator triggers. Staged does not mean all branches exercised.
- **Live read-only source verification:** selected next trigger `characters_guard_player_tags_v1` (`BEFORE UPDATE OF tags` on `public.characters`), original handler `private.guard_player_character_tag_update_v1()`, MD5 `b8b0008a718de1aa3e74d66b30f1a679`, 575 source characters. The handler checks a direct, signed-in, non-admin mutation of existing player tags at `pg_trigger_depth() = 1` and raises SQLSTATE 42501 with the original message. The test harness already has separately source-matched sheet-to-character tag synchronization and a **reduced** local Admin helper/RLS, not full production roles.
- **One bounded next research fixture:** preserve the unchanged `pg_get_functiondef` body and original `pg_get_triggerdef` event/timing on held PR #324. Add only a fail-closed, disposable PG17 source MD5 gate and genuine GoTrue/PostgREST tests: direct authorized player tag change must return original 42501/message with no G/GI/I/C/CP/CS side effects; a nested sheet-driven tag refresh must succeed and preserve campaign tags; current Admin/GM access and non-editor/anonymous revocation must be distinguished under explicitly reduced local RLS. Run exact-head existing J00–J124 regressions. Do **not** infer full production-equivalent schema, authorization or browser acceptance.
- **Release:** Agent and Forge PRs remain draft/unmerged. Nothing was pushed to PR #324 during this audit. No paid Codex dispatch, new API key, production migration, Vercel rollout, or server-authoritative gameplay change. Owner review required before any controlled release; never conflate the successful static coverage report with a complete original-trigger acceptance suite.

## Cross-branch J132 verified; J133–J141 staged (Nov 6 UTC)

- [Forge PR #324 exact-head authenticated run 42164951469](https://github.com/bob8675309/DNDNEXT/actions/runs/42164951469) **SUCCESS** at `8b247ebe9df2d77410b087cb9370d3dea3f938e9`, including original tag guard and real GoTrue J125–J132. No production write. The original 42501 error, nested sheet sync, current Admin editor grant, outsider/anon/revoked access were demonstrated under **reduced local RLS**.
- This raised original creation-adjacent installed DDL to **13/31**, but no full production grant/trigger/canonical-catalog parity.
- A subsequent Forge PR #324 draft commit `c616209ced727f04cff06923ba9b2237a9c59bd4` stages unchanged original portrait-library sync and signed-in **J133–J141**. That set of tests requires its *own* exact-head success before counting authenticated acceptance. DDL audit is expected to see 14/31 installed, 17 absent if its original definition matches.
- The bot's **free** cross-branch PR workflow will independently audit PR #324's newest DDL when this receipt is committed to PR #325; no paid model run or API key.
- **Next single step:** verify J133–J141 exact-head authenticated PG17/GoTrue outcomes; diagnose original source/fixture discrepancies without changing deployed code. Both PRs remain held and draft.
