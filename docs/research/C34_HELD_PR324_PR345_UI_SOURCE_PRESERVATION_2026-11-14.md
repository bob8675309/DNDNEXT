# C34 — Held #324 Forge and #345 NPC Profile UI no-loss-work source inventory

**Research/PR custody report, 2026-11-14. READ-ONLY source comparisons; NO integration, merge, close, delete or deploy authorized.** This document preserves testable source/consumer obligations. Different blob ≠ missing behavior; exact blob ≠ production acceptance.

## Immutable review references and method

| Tree | Exact inspected Git HEAD | Tracked blobs |
|---|---|---:|
| Production `main` | `6637b14f807ebec79542deb7eef4b2bc3abfb5fd` | 2,057 |
| [held original #324](https://github.com/bob8675309/DNDNEXT/pull/324) | `f1a2c564046ab93a0bfa0732e3acc2179da9c064` | 1,875 |
| [held original #345](https://github.com/bob8675309/DNDNEXT/pull/345) | `4f5f8ff7587aff1a68f21581ad68a4752789f54a` | 2,071 |
| [C34 held draft #379](https://github.com/bob8675309/DNDNEXT/pull/379) | `111ebce28263f941a0a9bb7b7aea0e06b5466e62` | 2,130 |

Method: fetched untruncated complete Git tree for every exact commit, indexed path→blob SHA, and separately compared each held PR's **actual changed-file list**, its complete HEAD tree and the current `main`/`#379` trees. All 4 trees returned `truncated=false`. Do not infer a source-only/unchanged status from PR title or normal diff pagination. Ref/CI freshness must be rechecked before any later integration.

## Original #324 canonical Forge: immediate PR vs inherited history

PR #324 is **stacked on an earlier NPC privacy/Profile branch (#323)**, not independently based on main. Its immediate changed-file list has **77 paths**: **51 scripts/workflows**, **23 docs**, and **3 SQL candidate paths**; **zero newly changed application UI paths in this immediate PR delta**. The full #324 HEAD differs from `main` across 54 surviving paths and from #379 across 52 surviving paths; its full-tree differing runtime paths count **0** in both comparisons using `components/pages/styles/utils/contexts/hooks/lib/public` prefixes. This does **not** mean #324's Forge UI functions or parent branch features are integrated or proven: common same-blob files may predate its PR, while stacked parents #320–#323 have independent provenance.

For the 77 immediate #324 changed paths compared to #379: **45 exact same Git blobs, 22 wholly absent, 10 present but source-different**. The missing paths include **16 historical Forge source-acceptance/research reports and the legacy/optional content design record**, plus `.github/workflows/forge-trigger-acceptance-audit.yml` and four agents artifacts:

- `scripts/agents/forge_automation_selftest.mjs`
- `scripts/agents/forge_trigger_acceptance_ledger.mjs`
- `scripts/agents/forge_trigger_acceptance_receipts.json`
- `scripts/agents/forge_trigger_audit.mjs`

Other changed paths include `scripts/test_forge_immutable_creation_replay_local_auth.mjs`, `scripts/agents/project_health.mjs`, `scripts/agents/validate_project_health.mjs` and the existing Forge immutable replay workflow, with **different source on #379**. Those differences require **test-case and receipt-by-receipt review**, not blanket discard. Do not run/enable any agent or modify the paused automation merely because artifacts exist. Original #324 retains its immutable creation, source/trigger, nonce, owner attribution, inventory and negative controls; their feature-level complete adoption remains **HOLD**.

## Original #345 NPC Profile/GM privacy: concrete unresolved UI assets

PR #345 immediate changed-file list has **94 paths**: **16 application/UI**, **53 script/workflow**, **22 docs**, **3 SQL candidate**. Compared with #379 the 94 immediate paths are **8 exact Git blobs, 56 absent, 30 present-but-different**. None of the 94 is byte-identical on the examined `main`. The full #345 HEAD differs from #379 on 16 surviving runtime paths.

**Four directly missing application files** (absent in both examined `main` and #379):

| Original #345 file | Inspected source role; cannot be assumed integrated |
|---|---|
| `components/GlobalNpcProfileOverlay.js` | 192-line global Profile overlay with event listener, cached role/profile invalidation and safe narrow character column selection |
| `utils/npcProfileOverlay.js` | 16-line shared open-event helper connecting non-map callers to global overlay |
| `components/CreatorBackstoryPanel.js` | 96-line private creator-authored backstory editor explicitly differentiated from GM Secret/public lore |
| `styles/npc-profile-centered.css` | Centered Profile styling absent in current integration/main source |

**Twelve existing application paths with different #345 blob vs #379 and main** (semantic change needs focused review before promotion):

| Path | Feature / consumer preservation checkpoint |
|---|---|
| `components/MapPageClient.js` | #345 centered map Profile behavior; **owner-protected world-map semantics: do not edit without explicit discussion** |
| `components/NewNpcModalV3.js` | Forge payload/sheet source choice and role/privacy integration; inspect differences, not just existing same function names |
| `components/NewNpcModalV3Refined.js` | Forge UI presentation and creator choices |
| `components/NpcForgeStepContent.js` | Forge step/choice consumers |
| `components/NpcPanel.js` | NPC Profile tabs, GM dossier and safe/visible role controls |
| `components/PlayerCharacterProfilePanelUnified.js` | Unified character profile consumers |
| `components/town/TownCrafterInteractionPanel.js` | Town merchant/crafter Profile-first interactions |
| `pages/_app.js` | #345 explicitly imports/renders `GlobalNpcProfileOverlay`; main and #379 do not |
| `pages/inventory.js` | #345 invokes `openNpcProfile(ownerMeta.profileCharacterId)` from inventory owner UI; main does not |
| `pages/npcs.js` | NPC list/profile controller and creator private presentation |
| `pages/town/[id].js` | #345 makes town Profile a genuine `role=dialog`, focus/escape protection, always starts Profile; main has earlier generic sidepanel behavior |
| `utils/officialCharacterSheetPdf.js` | Character sheet PDF/print path, must compare output/permission behavior |

These differences are not automatically improvements; **separate browser and permission regressions are required**. In particular, #345 `GlobalNpcProfileOverlay.js` explicitly selects only safe `PROFILE_COLUMNS`, invalidates in-flight role/profile responses on session change, and avoids GM-only notes/secrets. Do not replace with an account-level broad `characters.select('*')` read. The creator's `character_backstory_secrets` is distinct from a GM-only dossier and published clues. The new UI is **not** represented by C34 SQL source/trigger success.

## Required feature-level disposition before any PR retirements

1. **Separate source vs function vs consumer parity:** for each #345 file, compare exact exported functions, call sites, security guards, output state and role-specific UI from the held SHA to `main` and a planned new integration; record unique, identical, competing and deferred behavior. No source deletion.
2. **Role matrix:** Admin/GM, creator, another editor, outsider, anonymous; Profile-first NPC/merchant/town/inventory; GM dossier, private Story, public clue; session switch, unauthorized direct RLS read/write, auth latency and stale cache.
3. **Protected map:** map interaction/profile differences must be reviewed with owner before changing `MapPageClient.js`; town UI does not imply world-map change authorization. No old location roster or merchant pill regressions.
4. **Forge:** #324/parent branch and #345 `NewNpcModalV3*` must be compared at source serializer and Browser levels. Preserve canonical `character_sheets` Option A, strict source choice summary matching, feat grant source IDs, nonce/Story, options and negative rollback, **without** restoring account-wide legacy `players.sheet` mirrors.
5. **Ancillary sources:** inspect all 56 absent #345 changed paths and 22 absent #324 paths individually for unique fixtures, reports, visual tests, original source IDs and behavioral acceptance. A newer test with similar title is not adequate proof. Preserve all 44 open and historical closed-unmerged PR heads.
6. **Release:** isolated signed SQL success T1–T18, original DDL 29/31, and Git blob parity are **not** end-to-end source behavior acceptance. Keep production SQL, merges, Vercel, paid agent, protected map, independent encrypted PostgreSQL+340 Storage-object restore and owner go/no-go on HOLD.

## Priority and safe next task

**ONE NEXT BOUNDED TASK:** audit #345's four absent application files and their exact consumers against `main`, then prepare a **separate, scoped proposed patch plan** (not an automatic merge, not world-map edits). Preserve original source paths, test role/cache/privacy behavior, and separately obtain approval before touching protected map behavior. No PR closing or deleting branches.

**Receipt:** this was a GitHub tree/path/source **inspection** only; no behavior-level browser replay or complete 94+77 file semantic audit was performed. The source comparison is a preservation blocker, not a closure certificate. T18 signed executable SHA remains `f687879871ecb684cf3a3f98e991b956ef04fea5`, [green T1–T18 run](https://github.com/bob8675309/DNDNEXT/actions/runs/43621097008). The subsequent docs-only T18 checkpoint SHA was `111ebce28263f941a0a9bb7b7aea0e06b5466e62` and its signed CI [run #43621631432](https://github.com/bob8675309/DNDNEXT/actions/runs/43621631432) also completed SUCCESS.
