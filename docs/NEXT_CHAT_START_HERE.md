> **2026-11-26 later owner standing merge authorization:** [LOW_RISK_MERGE_POLICY.md](LOW_RISK_MERGE_POLICY.md) defines the narrow low-risk merge exception for the interactive assistant. Minor verified non-disruptive changes may merge without repeated individual approval; important systems, held feature PRs, hosted SQL, paid services, manual deploys, agent-specific no-merge rules and other protected scope remain approval-gated. This supersedes older blanket merge wording only within that exception.

# DNDNext — NEXT CHAT START HERE

**Permanent owner-directed navigation, updated 2026-11-26.** This is a workflow, not a frozen task list. Live source and the owner's latest instruction win over dated headlines. All prior wording is preserved verbatim in [historical router archive](archive/historical_handoffs/2026-11-26__NEXT_CHAT_START_HERE.md).

## First five-minute recovery

1. Read [CONNECTED_DEVELOPMENT_WORKFLOW.md](CONNECTED_DEVELOPMENT_WORKFLOW.md) and [AGENTS.md](../AGENTS.md). Use the connected GitHub, Dropbox, Supabase and Vercel services and established GitHub Actions runners; missing local executables are not a connector failure.
2. Verify current main, owner-selected work branch (may have no PR), exact PR HEAD/base if relevant, CI jobs/logs and Vercel source SHA. Use Supabase metadata discovery; no hosted SQL including SELECT without separate approval.
3. Read **that branch's** topmost `docs/ACTIVE_WORK.md` and last appended `docs/HANDOFF_LOG.md`, linked dossiers, actual code/SQL, source receipts and tests. The copies on main are historical if work is on another branch. Establish **ONE next bounded engineering task** rather than resuming an old task banner.
4. Determine ownership using the [live-work navigation](CONNECTED_DEVELOPMENT_WORKFLOW.md#6-parallel-development-and-ownership), [agent rollover registry](https://github.com/bob8675309/DNDNEXT/blob/docs/agent-rollover-registry/docs/agents/AGENT_REGISTRY.json), live private saved tasks if relevant, and [open PR index](https://github.com/bob8675309/DNDNEXT/blob/docs/agent-status/docs/OPEN_PRS.generated.md). Verify live; generated indexes and registry are dated metadata. Never change another agent's exclusive branch or schedules.
5. Follow [WORKSTREAMS_AND_PR_DEPENDENCIES.md](WORKSTREAMS_AND_PR_DEPENDENCIES.md), [full PR review](PR_FULL_SCOPE_REVIEW_PROTOCOL.md), [system registry](SYSTEM_REGISTRY.json), [project state](PROJECT_STATE.md), [phase checklist](PHASED_DEVELOPMENT_CHECKLIST.md), and [spell decisions](SPELL_ENGINE_DECISIONS.md) when relevant. Check current package/lock and source contracts. Do not repeat completed tests absent drift/conflicting evidence.
6. Execute on the authorized branch, preserve original source and negative tests, verify exact-head evidence, update branch-local ACTIVE_WORK and append HANDOFF_LOG with source/test limits and one next task. [Receipt template](HANDOFF_RECEIPT_TEMPLATE.md).

## Dated navigation checkpoint (not current task authority)

On November 26 the owner interactive I2J progression research is on [research/i2j-levelup-v2-source-preflight-20261123](https://github.com/bob8675309/DNDNEXT/tree/research/i2j-levelup-v2-source-preflight-20261123), separate from agent A's [C34 #379](https://github.com/bob8675309/DNDNEXT/pull/379). The independent owner PR334/318, CI reliability and spell preservation tracks are listed in the runbook. Verify live; no assumption that only one active PR exists. I2J recovered source custody is not signed nested feat acceptance; see current branch receipts. Preserve the **19 currently deployed XPHB** original tactical adapters; generalized Spell Engine remains separate research. Canonical Option A source research is not a production cutover.

## Protected boundaries

Apply [LOW_RISK_MERGE_POLICY.md](LOW_RISK_MERGE_POLICY.md) for minor, verified non-disruptive merges. No hosted Supabase SQL (including SELECT), protected/held feature merges, protected world map edits, manual deployment, gameplay release, paid services, PR retirement or agent changes without separate owner scope. Public GitHub must not receive private recovered definitions/backups or credentials. Maintain Pages Router + Bootstrap/SCSS (no Tailwind), world/town/tactical separation and existing server authority. Never infer feature or production acceptance from static checks, source matches, a CI badge, or a Vercel READY record.

## Documentation map

- [Connected development runbook](CONNECTED_DEVELOPMENT_WORKFLOW.md): services, remote execution, source custody, parallel agents, startup and close.
- [Repository access standing rule](REPO_ACCESS_STANDING_RULE.md) and [write procedure](CHATGPT_REPO_WRITE_PROCEDURE.md): safe exact-head write and asset workflows.
- [Documentation lifecycle](DOCUMENT_LIFECYCLE.md) and [docs index](README.md): historical records versus living authority.
- [Historical router archive](archive/historical_handoffs/2026-11-26__NEXT_CHAT_START_HERE.md): original dated instructions, **not current tasks**.
