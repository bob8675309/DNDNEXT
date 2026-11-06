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
- After owner approval/merge and key configuration, open **GitHub → Actions → “DNDNext supervised research agent (manual, review-only)” → Run workflow**. Choose \`target_ref\` (e.g., \`research/forge-immutable-creation-replay-20261105\`), give one bounded task, optional failed GitHub Actions run ID, validator suite, and \`max_passes=1\` initially. Explicitly select \`RUN_RESEARCH\`.
- Download the run's \`dndnext-research-agent-review-<run>\` artifact. Check \`research.patch\`, validate provenance/source hashes, and apply only after human review. Never equate patch generation with a passed authenticated database run.
- A second unattended, multi-PR agent phase requires separate owner approval, a restricted GitHub App identity, explicit cost/CI quotas, reviewed branch-protection rules, rollback/recovery and tests for prompt-injection/log-exfiltration. It is **not enabled** by this PR.

### Files, costs, and Vercel budget

The proposed \`vercel.json\` adds \`git.deploymentEnabled\` exclusions for \`agent/**\`, \`research/**\`, and \`docs/**\`. It preserves the existing \`buildCommand\` and \`ignoreCommand\` exactly. Vercel's branch-based deployment exclusions prevent those Git pushes from triggering automatic previews when the configuration is active; the existing agent-only \`ignoreCommand\` was insufficient as a quota guarantee. Other preview branches retain their prior behavior. Do **not** assume Vercel has adopted the change before review/merge and inspection. No Vercel project API configuration or preview deployment was changed in this setup.

**Cost and limit posture:** no cron, no scheduled paid calls, no automatic AI on PRs, no model calls from free validation, maximum 2 paid passes per explicitly confirmed dispatch, 35-minute job timeout, single branch-scoped concurrency key, seven-day patch retention, no live DB credentials. GitHub Actions runner minutes and API token usage still count under the owner's applicable billing plans and should be monitored.

### Accepted versus unverified

Source-static PR check verifies boundary tests and that the workflow does not request write permissions. It does **not** verify an actual Codex run or paid API success, nor original Forge J124 source behavior, until a manually funded dispatch on an approved branch. The current DNDNext product state is always reverified from the actual GitHub PR/head, live read-only Supabase and exact CI. Historical docs do not override new facts.

**References:** [official Codex GitHub Action](https://github.com/openai/codex-action), [Codex noninteractive mode](https://learn.chatgpt.com/docs/non-interactive-mode), [Vercel branch deployment exclusions](https://vercel.com/docs/project-configuration/git-configuration), [approved DNDNext AI foundation](DNDNEXT_AI_INTEGRATION_FOUNDATION.md).

**Single next action:** run the no-cost PR validation, inspect the actual draft PR changed-file list and commit SHA, then get owner approval to merge in a controlled release batch; configure an OpenAI API key only through a secure setup flow and run the first bounded manual invocation.
