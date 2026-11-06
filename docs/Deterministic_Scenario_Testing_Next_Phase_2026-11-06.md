# DNDNext — Deterministic Scenario Testing: Next Research Phase

**Decision checkpoint:** November 6, 2026. **Status:** proposed first implementation slice, not an existing executable framework or production change. The prior handoff established this as the next engineering direction *after* the free GitHub Project Health/Touchstone milestone. Keep PR #325 (developer-agent orchestration) separate from Forge candidate PR #324; neither is merged.

## Why this phase matters

Repeating independent hand-written Forge test cases and one-trigger-at-a-time investigations does not scale. Build reusable **free deterministic test generation and execution**, so the assistant can investigate new behaviors without repeating J00–J153 or giving AI authority to decide D&D rules. This is a developer test harness, not the future in-game AI or a general-purpose autonomous software engineer.

## Existing assets — preserve and reuse

- The held [Forge PR #324](https://github.com/bob8675309/DNDNEXT/pull/324) contains ~40 SQL/fixture files and genuine local PostgreSQL 17 + GoTrue/PostgREST authenticated tests. The existing J00–J153 acceptance and the exact source function MD5 gates remain the regression baseline. Research is stacked on unmerged [privacy PR #321](https://github.com/bob8675309/DNDNEXT/pull/321).
- [Cross-command lock-order PR #317](https://github.com/bob8675309/DNDNEXT/pull/317) demonstrated an original CP/CS deadlock under orchestrated conditions. A deterministic scenario runner must not imply this is resolved or assume a generic CP-first lock shortcut works for all operations.
- The 31-trigger source census and [research acceptance receipts](https://github.com/bob8675309/DNDNEXT/blob/research/forge-immutable-creation-replay-20261105/scripts/agents/forge_trigger_acceptance_receipts.json) distinguish installed SQL DDL from separately exercised real-JWT handlers. Missing trigger cases should be selected from *latest source-aligned* evidence.
- [Agent PR #325](https://github.com/bob8675309/DNDNEXT/pull/325) provides free status/CI/docs automation and a **manual inactive** paid Codex research option. Do not couple the new runner to a paid model, Work schedule, production Supabase or Vercel.
- Production's original player Forge v2/v3/GM functions, canonical source catalogues and permissions remain source authority. Disposable fixtures intentionally contain reduced local catalog and RLS; identify these reductions in every result.

## One next bounded task — schema and proof of integration

On a separate, reviewable research continuation based on the verified Forge fixture HEAD, **inspect the actual current fixture and test runner contracts first**. Add a small versioned scenario input schema, a deterministic seed resolver and machine-readable result/coverage report without changing the real Forge handler bodies or introducing a new source of rules truth. Prove the runner can reproduce at least a successful creation and one negative/replay case by *invoking the existing source-authentic disposable v2/v3 + real GoTrue suite*, not by simulating successful writes in JavaScript. Keep the original J00–J153 jobs intact.

Candidate scenario record fields (design, not locked source API): stable `scenarioId`, `schemaVersion`, integer `seed`, source/edition identities (e.g. XPHB rather than bare display names), actor/role, target creation RPC, starting sheet/choices, operations (create/replay/mutate), expected authorization/SQLSTATE, observable normalized row changes and rollback expectations. Generated character names/UUIDs must never be treated as rule authority; normalize volatile identifiers in stable test output. Store no secrets, user JWTs, hidden NPC dossiers or personal character payloads in public artifacts.

### First slice acceptance (all required before claiming it works)

1. Same scenario + seed yields the same generated input and normalized expected assertions across two separate executions; changed seed produces a distinguishable but legal case.
2. Execute against a disposable PG17/real local GoTrue/PostgREST instance. A pure Node contract validator alone is **not** authenticated acceptance.
3. Exercise at least one source-qualified happy-path v2 or v3 Forge creation and one immutable-replay/negative case with exact request identity and current editor checks; assert canonical CP/CS/G/GI/I/C/stock changes or *lack* of changes as applicable.
4. Fail closed on original function/trigger/source hashes, missing catalog or RLS dependencies, unexpected SQLSTATE, extra rows/grants/items/currency, or regression-test failures. Never loosen expected source error text to gain a green check.
5. Existing J00–J153 and current focused GitHub Actions gates remain passing at the **new exact executable commit SHA**, not borrowed from a prior head. Record tests and omissions distinctly.
6. No live data/SQL/schema writes, no GitHub `main` merge, Vercel preview/deploy, API key spending, scheduled Work, production permission change or world/town map edit.

## Later bounded scenario families (not first-slice commitments)

- Forge character generation by source-qualified species/background/class/subclass and higher-level replay without bypassing canonical rules.
- Level-up and cross-operation CP/CS/G/GI/I/C grant/inventory concurrency; test historical provenance gaps and edit/revocation semantics instead of silently backfilling.
- Original creation-adjacent triggers still missing from the fixture, source-exact one at a time, with targeted authenticated receipt and explicit reduced-fixture gaps.
- Gear/currency/merchant inventory, equipment materializers, fake/duplicate feat grants, rollback and retry/nonce idempotence.
- Source availability, including XPHB-first and optional 2014 PHB campaign toggle (design only); explicit versus missing `subclassSource`, and raw-RPC versus UI paths.
- Future server-owned tactical legal-action scenarios, never using an AI model to calculate combat outcomes.

## Hand-off and stop conditions

At each continuation record the exact source/base/head branches, run IDs, true signed-in results, source hashes, scenario seeds, delta in coverage and one **next bounded** test. Link current source (not a stale generated snapshot), update the affected living doc and append the factual `docs/HANDOFF_LOG.md` receipt on the same patch. Do not collapse creator privacy (#321), immutable Forge creation (#324), global locks (#317), and developer agents (#325) into a one-click production release. Prototype data is not consent for a shared-database reset.

**Research-only status:** this document makes the next task reproducible. It does not claim the scenario runner or any new JWT scenarios have been built or passed.
