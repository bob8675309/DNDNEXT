# DNDNext — Full open-PR preservation catalog

**Owner-locked November 9, 2026.** Current documentation-only draft, not a merge, production migration, or release authorization. Every dossier is sourced from the exact original PR head and its immediate-base PR Files API; it lists *every changed file*, Git blob SHA, feature/test contents, cross-system links, unique evidence and blockers. Reverify live heads and checks before copying.

## Approved decisions

- Integrate Spell Engine #309/#312/#347; NPC/familiar/sidekick independent shared control in #312; global security/concurrency #317 and #312; Admin notices/rights #318; NPC Profile/privacy #320–#323/#345; and immutable Forge/original source tests #324/#328–#335.
- Integrate #325 developer-agent research **last in I6**, not discard it; no paid API calls, model-key setup, or AI activation without separate owner approval.
- Delegation-only NPC tactical spell visibility: **known and currently available only**, in both spell profile RPC v1 and v2. No unprepared/unknown/GM secrets or other source permissions.
- Centered NPC Profile design is retained, **world-map backdrop/visual behavior must be reviewed before actual production approval**.
- Owner policies TC1 one active encounter/character; R1 fail-closed unverifiable replay; R2 current-authority recheck for cached results; concealment wording Unknown Events; no GM approval for player creation, informational Admin notice; creator-only private Story with active edit/GM and separate GM Secret.

## All 20 open PRs — independent detailed dossiers

| PR | Document | PR-scoped changed files | Distinct contribution | Owner disposition |
| --- | --- | ---: | --- | --- |
| [#309](https://github.com/bob8675309/DNDNEXT/pull/309) | [PR-309.md](PR-309.md) | 47 | Spell P1 and Eldritch Blast | INTEGRATE |
| [#312](https://github.com/bob8675309/DNDNEXT/pull/312) | [PR-312.md](PR-312.md) | 65 | Spell P2, shared NPC controllers, replay, known/ready visibility | INTEGRATE |
| [#317](https://github.com/bob8675309/DNDNEXT/pull/317) | [PR-317.md](PR-317.md) | 138 | Cross-command authorization, concurrency and original source regressions | INTEGRATE |
| [#318](https://github.com/bob8675309/DNDNEXT/pull/318) | [PR-318.md](PR-318.md) | 11 | Admin post-create notices and GM right editor | INTEGRATE |
| [#320](https://github.com/bob8675309/DNDNEXT/pull/320) | [PR-320.md](PR-320.md) | 13 | Centered Profile UX (preserve via secure integrated successor) | INTEGRATE / world-map visual review |
| [#321](https://github.com/bob8675309/DNDNEXT/pull/321) | [PR-321.md](PR-321.md) | 10 | Original unsafe baseline and NPC privacy Stages 1-3 | INTEGRATE revised source only |
| [#322](https://github.com/bob8675309/DNDNEXT/pull/322) | [PR-322.md](PR-322.md) | 10 | Safe NPC client and creator Story access | INTEGRATE |
| [#323](https://github.com/bob8675309/DNDNEXT/pull/323) | [PR-323.md](PR-323.md) | 15 | Secure centered Profile reconciliation | INTEGRATE via #345 |
| [#324](https://github.com/bob8675309/DNDNEXT/pull/324) | [PR-324.md](PR-324.md) | 77 | Immutable Forge requests, grants, materials, merchant/inventory proof | INTEGRATE |
| [#325](https://github.com/bob8675309/DNDNEXT/pull/325) | [PR-325.md](PR-325.md) | 27 | Developer AI agent and in-game AI concept | INTEGRATE LAST (I6); paid activation separate |
| [#328](https://github.com/bob8675309/DNDNEXT/pull/328) | [PR-328.md](PR-328.md) | 8 | Deterministic Forge signed seed harness | INTEGRATE |
| [#329](https://github.com/bob8675309/DNDNEXT/pull/329) | [PR-329.md](PR-329.md) | 10 | Original starting-spell deferred validation | INTEGRATE |
| [#330](https://github.com/bob8675309/DNDNEXT/pull/330) | [PR-330.md](PR-330.md) | 10 | XPHB Wizard source-valid spell counts | INTEGRATE |
| [#331](https://github.com/bob8675309/DNDNEXT/pull/331) | [PR-331.md](PR-331.md) | 10 | Nested feature-choice source dependencies | INTEGRATE |
| [#332](https://github.com/bob8675309/DNDNEXT/pull/332) | [PR-332.md](PR-332.md) | 10 | Warlock Invocation child source validation | INTEGRATE |
| [#333](https://github.com/bob8675309/DNDNEXT/pull/333) | [PR-333.md](PR-333.md) | 6 | Warlock source-shaped signed Forge request | INTEGRATE |
| [#334](https://github.com/bob8675309/DNDNEXT/pull/334) | [PR-334.md](PR-334.md) | 8 | Production client choice serializers into signed v3 | INTEGRATE |
| [#335](https://github.com/bob8675309/DNDNEXT/pull/335) | [PR-335.md](PR-335.md) | 7 | Real Chromium option clicks and old owner-CHECK negative | INTEGRATE |
| [#345](https://github.com/bob8675309/DNDNEXT/pull/345) | [PR-345.md](PR-345.md) | 94 | Integrated secure NPC/Forge/Print/inventory & backup candidate | INTEGRATE / coordinated release |
| [#347](https://github.com/bob8675309/DNDNEXT/pull/347) | [PR-347.md](PR-347.md) | 8 | Clean-main non-executing Spell P1 extraction | KEEP / INTEGRATE |

**Source completeness:** 20 full dossiers; **584 changed-file entries across the immediate PR diffs**, including repeat paths across stacked PRs. This is **not 584 distinct files**. Every inspected exact-head check-run had no failures on November 9; this is a dated result, not proof of production release. Original negative-control failures and their corrective tests remain preservation assets.

## Branch relationships and precedence

- Held encounter archive → #309 → #312; #347 is a narrow main-based source-only extraction of only five #309 P1 blobs, not its Eldritch Blast/P2 functionality.
- Old main → #317 (separate security research); old main → #318 (Admin); old main → #325 (optional agent).
- Old main → #320 (centered UX); old main → #321 (original privacy) → #322 (revised story/client) → #323 (combines secure reader with centered UX); current-main-based #345 further integrates newer tests/SQL/Forge/PDF.
- #321 → #324 → #328 → #329 → #330 → #331 → #332 → #333 → #334 → #335. Terminal #335 inherits the **older** #321 Stage3, not #322/#345 revisions; it must not be wholesale merged onto #345.
- Important overlaps: #312 and #318 both change GM access management; #345/#324 both touch Forge nonce/creator but protect **different** contracts; #317 security must precede delegated battle actions and any new executable Spell Engine.

## Rules for preservation and future retirement

1. Compare source blobs, imported helpers, original SQL/fixtures, workflow steps and exact-head results against current main and chosen integrated successors. Mark each item copied unchanged, behaviorally ported, superseded with evidence, or retained as deferred research.
2. Separate original live source, source-only assertion, reduced SQL fixture, real local GoTrue JWT, component browser, full application browser, and actual deployed behavior. Never claim a branch test installs an RPC or verifies source rules.
3. Preserve all positive/negative tests, historic failures, original GM/creator permission design, developer visual controls, 19 deployed XPHB adapters and sensitive spells/items/inventory/merchant-stock/crafting/Storage data.
4. Do not close any original draft just to reduce PR count. PR retirement, main merge, live SQL/grants/Storage mutation, Vercel promotion, paid agent activation and world-map UI release each require explicit owner approval.

**Current execution order:** [PR Integration-First Phased Plan](../PR_INTEGRATION_PRIORITIZED_PHASED_PLAN_2026-11-09.md).