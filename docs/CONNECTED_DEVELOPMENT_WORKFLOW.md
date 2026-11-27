> **2026-11-27 owner directive — selective Codex delegation:** [CODEX_DELEGATION_WORKFLOW.md](CODEX_DELEGATION_WORKFLOW.md) records the published private DNDNEXT environment and optional, bounded Codex assistance for the interactive assistant and existing agents A–D. Existing branches, schedules, manual coordination limits and protected-system approvals remain unchanged. Publication does not prove automatic attachment, direct task launch or GitHub Code Review activation. GitHub Actions remains authoritative for signed integration; do not expose private recovered source or bypass environment failures.

> **2026-11-26 later owner standing merge authorization:** [LOW_RISK_MERGE_POLICY.md](LOW_RISK_MERGE_POLICY.md) defines the narrow low-risk merge exception for the interactive assistant. Minor verified non-disruptive changes may merge without repeated individual approval; important systems, held feature PRs, hosted SQL, paid services, manual deploys, agent-specific no-merge rules and other protected scope remain approval-gated. This supersedes older blanket merge wording only within that exception.

# DNDNext connected development and recovery runbook

**Owner-directed documentation refresh, 2026-11-26.** Durable workflow, not a frozen feature queue. Start at [NEXT_CHAT_START_HERE](NEXT_CHAT_START_HERE.md); follow the owner-selected branch, which may have no PR. The later [standing low-risk merge policy](LOW_RISK_MERGE_POLICY.md) is the only new narrow merge authority; no expanded production SQL, paid-service or agent authority.

## 1. Architecture and responsibilities

DNDNext is a Next.js Pages Router application with Bootstrap/SCSS, backed by Supabase PostgreSQL/Auth/Realtime/Storage. Vercel hosts the app; GitHub stores source, SQL history, tests, and review decisions. Dropbox retains recovered database source and approved binary transfer bundles. GitHub Actions supplies disposable execution environments for source, SQL, signed Auth, and browser tests. ChatGPT is the engineering coordinator, not the production rules authority.

| Service | Use directly from connected tools | Do not infer |
| --- | --- | --- |
| GitHub | Read exact refs, trees, blobs, files, PRs, Actions logs; commit bounded changes to authorized branches | Repo access equals production approval |
| Supabase | Discover project/branches and metadata without SQL; approved hosted operations only with separate scope | Installed schema equals Git migrations; access grants permission to query live |
| Dropbox | Fetch exact source text and receipts; approved artwork bundle transfer | Permission to publish private source or backups |
| GitHub Actions | Run actual checkout, Node, SQL fixtures, isolated PostgreSQL/Auth/PostgREST, Chromium where existing tests require it | Green status means every test ran; scratch equals production |
| Vercel | Inspect project, production source SHA, deployment status, relevant build/runtime logs | READY equals browser acceptance or DB compatibility |
| ChatGPT Automations | Private live task discovery and reports for scheduled agents; owner-authorized continuity | Registry snapshot equals active task state; automatic rollover or paid activation |

Application authority: client UI -> authenticated server/API/RPC -> canonical character and encounter state -> permitted projections -> UI. Preserve per-character canonical `public.character_sheets` Option A direction, legacy account-sheet writer research and existing production behavior until an approved cutover. NPC/merchant Profile-first, sprite/roster exclusivity, world-map vs town vs tactical separation, source-qualified XPHB vs PHB, server combat/resource authority and GM-assisted unsupported effects are durable constraints. Consult [system registry](SYSTEM_REGISTRY.json), [project state](PROJECT_STATE.md), [spell decisions](SPELL_ENGINE_DECISIONS.md), [phased checklist](PHASED_DEVELOPMENT_CHECKLIST.md), and affected actual sources for precise contracts.

## 2. Startup: verify capabilities, not assumptions

1. Read live `main` ref, repository visibility/permissions, intended work branch and PR (if any), base ref and exact base/head SHAs; identify branch owner and concurrent writers. The actual owner's latest instruction outranks dated notes.
2. Open branch-local `docs/ACTIVE_WORK.md` top checkpoint, `docs/HANDOFF_LOG.md` last receipt, cited dossiers and source/test files. Read only relevant historical evidence for normal resumption, or full inventory if explicitly requested. Do not say a file was read if only its name/summary was inspected.
3. Verify exact-head Actions runs and jobs, actual case markers, skips, failures and fixture limitations. Inspect package/lock and pinned CLI as relevant. Use Vercel latest production record/source SHA; verify Supabase project/branch discovery. **No hosted SQL, even SELECT, under the current research authorization.** Obtain separate owner permission if live SQL is necessary.
4. Check Dropbox metadata and fetch required private source by exact identity/path. For agents, discover live saved tasks privately and compare branch refs, run reports and registry. Never publish private IDs/prompts or raw transcripts.
5. State deployed vs research-only vs historical vs unresolved. Select ONE bounded executable engineering deliverable within the correct branch; no unnecessary re-audit or replacement of completed work. If user requests a wider audit, report precise coverage.
6. If a tool fails, record operation/error and try the appropriate established alternative. Missing Docker/psql/git checkout in the chat's container does **not** mean GitHub, Supabase or Dropbox access is unavailable. No blanket claims that the owner must download, re-export, reconnect, run PowerShell, or perform local tests. Ask only if a specific necessary capability or authorization is genuinely absent.

## 3. GitHub write and integration workflow

Use exact-head reads -> bounded diff plan -> Git tree/commit/ref update (expected old SHA, non-force) or equivalent safe file writes -> verify remote head and changed path list. Preserve branch ownership, no cross-agent writes; new independent work uses a separate branch. Never overwrite concurrent movement. A full working tree is available through established Actions checkout, not assumed to exist in the chat runtime. For every PR follow [full PR source review](PR_FULL_SCOPE_REVIEW_PROTOCOL.md): full HEAD vs immediate base vs main, recursive non-truncated trees, original source/test dispositions, five required PR sections and actual exact-head results. Do not skip inherited work or retire original PRs on a narrow extraction.

Main merge may auto-deploy via Vercel, including docs-only changes. Under the owner-approved [low-risk merge policy](LOW_RISK_MERGE_POLICY.md), eligible verified minor changes may merge without individual approval, including incidental existing auto-deployment. Other merges and manual deploys require separate approval. Research-to-research merge is not production. Re-fetch head before any merge. Preserve original source and negative tests. No force moves, deletion, closure, rebasing or paid work without authorization.

## 4. Testing: actual remote execution, disposable only

Established example: [I2J Warlock workflow at verified source](https://github.com/bob8675309/DNDNEXT/blob/fedf33160b7fc95a1c0a8ff3c5b1bec59cc1005a/.github/workflows/validate-i2j-warlock-earned-v5.yml), [historical genuine signed run](https://github.com/bob8675309/DNDNEXT/actions/runs/45531518287). It uses GitHub-hosted ubuntu, Node22, npm lockfile, Supabase CLI 2.120.0, local PostgreSQL17, Auth and PostgREST, loopback endpoints, synthetic users/data and teardown even after failure. Version pins are examples from that source; inspect actual current workflow rather than upgrade blindly. Existing local integration guards are intentional. No production URL, project link, credentials, data, or DB connection in scratch tests.

Select the smallest appropriate evidence tier, then run inherited regressions:
- T0 source/blob inventory, syntax, pure Node and payload tests.
- T1 disposable schema/SQL fixtures and synthetic role contracts.
- T2 real local signed GoTrue/PostgREST original RPCs, role/rollback/deferred/negative behavior, not hand-made auth.uid claims.
- T3 mounted component Chromium; T4 genuine signed application browser flows.
- T5 separately authorized deployed smoke and independent encrypted restore evidence.
Use [the established tier definitions](PR_FULL_SCOPE_REVIEW_PROTOCOL.md); never promote a lower tier to a higher one. Preserve observed RED before reversible scratch GREEN where fixing defects. Test actual source, not a fake stub that bypasses the contract. Verify exact installed function body fingerprints, dependency closure, owner/effective privileges and fixture source as relevant. CI run IDs, job IDs, executable SHA, markers, pass/fail/skip, and fixture limitations go into receipts. A later docs-only head requires its own checks; a prior signed run can be cited as historical exact executable evidence, not final-head rerun. Do not weaken gates to save CI minutes. Agent B owns independent CI optimization; live workflow changes require review.

## 5. Dropbox source custody and asset transfer: separate paths

**Private source:** `/DNDNext-Development/Database-Source/` contains `DNDNext-Original-Functions.json`, `DNDNext-Complete-Schema.sql`, `Export-Receipt.json`, `REVIEW-BEFORE-SHARING.txt`, and supporting manifest/function files. Inspect live listing/receipt and review notice. At the November 26 checkpoint the aggregate held 545 definitions and 13 I2J scoped complete definition fingerprints plus owner/ACL metadata independently matched. [Exact scoped receipt](https://github.com/bob8675309/DNDNEXT/blob/269b2a04deda3c0eea9203554add3dded2dfc06a/docs/research/I2J_ORIGIN_FEAT_PRIVATE_INTAKE_2026-11-26.md). Distinguish restored source text, archive byte checksums, installed fingerprints, effective ACL, dependencies and signed runtime evidence. No live parity inferred. A null ACL is not proof of denied execution.

GitHub repository is PUBLIC. Never publish recovered private definitions, raw dumps, real data, keys, private Dropbox URLs, task/chat IDs, or secret-bearing logs/artifacts in any branch/PR/workflow/comment. Do not use a public artwork transfer as a private-source test transfer. Safe source intake can use connector-returned text and hash/metadata-only evidence. An existing approved private staging mechanism for the new nested Origin feat signed test has **not** been demonstrated; investigate an isolated authorized path without publishing data or incurring new cost, and continue source/fixture work in parallel. Do not treat optional owner-local intake command as a mandatory step. Explicit narrow approval is needed before a new private-source transfer beyond its existing custody. Never copy whole backup to a runner just to test one function.

**Approved assets:** separate `/DNDNext-Transfer/` bridge is historically proven for intended public artwork. See [binary transfer runbook](ARTWORK_BINARY_TRANSFER_RUNBOOK.md) and [repo standing rule](REPO_ACCESS_STANDING_RULE.md): approved ZIP and per-file hashes, exact head, MIME/dimensions and exact diff allowlist, bounded scratch workflow, verification, then intended authorized branch. Do not assume Dropbox source library uses this sharing model.

Backups: preserve previously captured 340 Storage objects and DB recovery evidence; independent final encrypted secondary copy/rehydration acceptance is separate. Do not repeat completed capture/restore absent evidence of drift; do not claim a full production restore from function export metadata.

## 6. Parallel development and ownership

Current durable navigation (verify live branch and agent status each session; no fixed SHA/count as a task):
| Workstream | Branch / authority |
| --- | --- |
| Owner/main interactive development | Owner-selected work; [independent I2J progression](https://github.com/bob8675309/DNDNEXT/tree/research/i2j-levelup-v2-source-preflight-20261123) may have no PR; [PR334/318 preservation](https://github.com/bob8675309/DNDNEXT/tree/agent/forge-j168-pr334-preservation-audit-20261123) separate |
| A — PR Integration | [C34 #379](https://github.com/bob8675309/DNDNEXT/pull/379), `research/c34-clean-main-privacy-forge-joint-source-20261112` |
| B — CI Reliability | [issue #389](https://github.com/bob8675309/DNDNEXT/issues/389), `research/c34-ci-efficiency-independent-20261121` |
| C — Spell & Combat | `research/spell-tactical-preservation-independent-20261123` |
| D — Supervisor | `docs/agent-rollover-registry`, docs/agents/** only; monitor and coordinate owner-approved rollover |

[Agent rollover protocol](https://github.com/bob8675309/DNDNEXT/blob/docs/agent-rollover-registry/docs/agents/ROLLOVER_PROTOCOL.md) and [registry](https://github.com/bob8675309/DNDNEXT/blob/docs/agent-rollover-registry/docs/agents/AGENT_REGISTRY.json) are dated public sanitized recovery aids. Live saved task prompt/status and branch receipts win. Current approved cadence at checkpoint is hourly Central A :05, B :25, C :45 (exact schedule), D :55 (condition-watch intervention only). Do not create duplicate writers or edit another agent's branch/registry; supervisor alone owns registry. Unproductive runs are not proof of exhausted context; verify actual writes/tests/run failures, then bounded correction before rollover. Genuine fresh-chat replacement needs owner-created new chat, one enabled role, verified distinct placement and same scope/schedule. No new agents, schedules, paid service or automated merges authorized by this document. Generated [open PR index](https://github.com/bob8675309/DNDNEXT/blob/docs/agent-status/docs/OPEN_PRS.generated.md) and [health](https://github.com/bob8675309/DNDNEXT/blob/docs/agent-status/docs/PROJECT_HEALTH.generated.md) are dated evidence, not exhaustive live acceptance.

## 7. Session close and release discipline

Every substantial session updates branch-local ACTIVE_WORK top and append-only HANDOFF_LOG, plus relevant dossier; exact branch/head/base, source paths/hashes, actual runs/jobs, negative results, authority and decisions, explicit no-effect statement and one next task. See [receipt template](HANDOFF_RECEIPT_TEMPLATE.md). Prefer a single bounded code/test/docs commit; subsequent evidence-only receipts must identify the actual tested SHA. If remote write/check fails, report incomplete. Document stable workflow changes in this runbook and link from canonical router; do not accumulate competing current task banners or silently rewrite history.

No production SQL including SELECT without separate permission, no world-map edit, no gameplay merge/release, no paid resources, no destructive cleanup, no agent changes outside approved continuity. Vercel READY verifies build/deployment only. Coordinated release requires original contributions, rollback, full relevant roles/ACL/RLS/trigger/browser gates, recovery evidence, and explicit owner approval. A connector permission is a capability, not authorization.

## 8. Copy-ready fresh-chat request

> Take over as my DNDNext full-stack engineering assistant. Start with main docs/NEXT_CHAT_START_HERE.md and CONNECTED_DEVELOPMENT_WORKFLOW.md. Use the connected GitHub, Supabase, Dropbox and Vercel tools; use established GitHub Actions disposable execution when a checkout or signed PostgreSQL/Auth tests are needed. Verify live main, owner-selected work branch (not necessarily a PR), actual PR/CI/deployment metadata, branch-local ACTIVE_WORK and latest HANDOFF_LOG, cited source/tests and relevant agent ownership. Distinguish deployed, historical, research-only and unverified. Preserve all original contributions and protected systems. Use the standing low-risk merge policy for eligible minor changes only. No hosted SQL, gameplay or protected-system merges, manual deployment, map changes, paid resources or agent changes without separate authorization. Do not restart completed work or require owner-local commands just because your chat container lacks executables. Report actual blockers, one next task, and update branch-local handoff after substantial work.

If main has not yet received this documentation refresh, use the same files on the documentation PR branch. Merge only after satisfying the standing low-risk policy and all relevant checks.
