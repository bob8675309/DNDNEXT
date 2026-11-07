# DNDNext — Owner-approved phase closeout and PR consolidation order

**Owner direction: November 7, 2026.** This document is the canonical ordered **closeout program** (NOT the independent active task): [NEXT_CHAT_START_HERE](NEXT_CHAT_START_HERE.md) → [ACTIVE_WORK](ACTIVE_WORK.md) → this order → [PR dependencies](WORKSTREAMS_AND_PR_DEPENDENCIES.md). Earlier branch-local work queues are historical. Do not run parallel release cutovers merely because a step appears below.

## Status vocabulary and evidence gates

1. **Implementation complete** means the described original vertical slice was installed/deployed, not that the entire next-generation roadmap is fulfilled.
2. **Research accepted** means exact isolated contract/fixture evidence is reviewed. It does not establish live SQL, genuine multi-session browser acceptance, concurrency or 2024 rules parity.
3. **Release accepted** requires current source SHA, real permission/role coverage, suitable disposable original-source tests, rollout/rollback and owner approval. Never treat green CI from an archived branch as an installation receipt.
4. **Closed PR** and **closed phase** are different. Do not close #309/#312/#317/#321–#335 merely to reduce the counter; first extract and independently validate unique data/fixtures. Preserve failed and positive tests.
5. The July 2026 **19 reviewed XPHB per-spell cast adapters** are deployed regression oracles. The October 31 approved **future composable, source-qualified closed-vocabulary Spell Engine** reuses server mechanics and does not create one new RPC for every spell. No production interpreter exists.

## Strict sequential work order — one executable task at a time

| Order | Smallest concrete deliverable | Status / exit evidence | Never conflate |
| --- | --- | --- | --- |
| **C0 — durable cleanup** | Retire stale handoff queues from active paths, archive full source, reconcile P0/P1.2/original combat milestone labels, link one work queue and PR tree | **This documentation-only PR**; completed only when final main merge, exact-head docs CI and resulting main SHA are confirmed | No gameplay, SQL, migration or other research PR merge |
| **C1 — preservation gate** | Inspect [PR #337](https://github.com/bob8675309/DNDNEXT/pull/337) exact-head source/CI, 19-spell/XPHB evidence tiers, preserved #299 failure, held Acid Splash classifier mismatch and level-scaling gap; obtain owner decision on **separate** merge | **NEXT after C0.** #337 is currently open draft at `e10fed97936e03c7c6fd416ef64dbb5d2605f58c`, with 3 green checks at audit; re-fetch live | Static drift coverage ≠ newly authenticated casts; no #309/#312 bulk merge |
| **C2 — Forge schema blocker** | Reproduce actual original `create_player_character_v3` → deferred starting-equipment materializer path using both existing `inventory_items.owner_type` constraints in **disposable PG17**. Show expected failure and safely proposed correction, source hashes, full rollback and genuine Auth where feasible. | Reproducer/review first, **separate approved migration** later. 2026-11-07 live SELECT confirmed contradictory constraints and original materializer's `'character'` insert path | No live constraint drop, no speculative production data repair |
| **C3 — consolidate stacked research** | Move uniquely useful verified Forge J00–J169, NPC safe-profile, P1.3 command/security and other draft tests onto small main-based review branches, preserving exact parent/test provenance. Build a merge/retire crosswalk before closing source PRs. | No branch merge until original SQL/caller/role and scoped browser/rollback gates pass. [Dependencies](WORKSTREAMS_AND_PR_DEPENDENCIES.md). | Green child synthetic fixture ≠ production coverage of 31 triggers or all NPC secret readers |
| **C4 — composable engine extraction** | On clean current main after C1 review, selectively extract **non-executing** P1 schema/closed vocabulary/preflight and then seven-spell P2 shadow parity from #309/#312, correcting known XPHB taxonomy gaps. | Separate source-only tests, versioning, adversarial fixtures and owner-controlled review. Executor requires P1 command authorization security before release. | No unreviewed auto-casting, AI, client rolls or interpreter migration |
| **C5 — optional independent deliverables** | Admin notices #318, alternate-player legacy-sheet preservation #319, visual polyhedra, sprites and other approved runtime consumers | Each as a separate focused release/acceptance decision; no blocking C1/C2 unless real dependency discovered. | No blanket CSS or world/town map changes |

**C1 is the only next executable engineering task** after this documentation merge. Do not automatically start C2, C3, C4 or another PR from an older branch-local `ACTIVE_WORK.md`; update the canonical active work only after the preceding action is concluded and the owner directs it.

## Milestone closure ledger — original implementation versus later gaps

| Milestone | Closure classification | Still outside its implementation exit |
| --- | --- | --- |
| **P0.1–P0.7** | **COMPLETE**, source/CI/production docs foundation accepted (merged #313 and later continuity #326/#327/#336) | Current/live status checks remain session-specific |
| **Original tactical Phase 1A–1Z implementation** | **Implementation completed** through the reviewed deployed July slices, including 19 XPHB adapters, 48 tactical validators and existing shared attack/save/LOS/mitigation/conditions/effects hooks | Full 19-spell modern signed-in browser re-run, shared P1 replay/locks, future recipe executor, unsupported source exceptions. These belong to P1–P3, not a re-open of July's original milestones |
| **P1.1** | **Completed audit**, deployed command-writer census and original read-only live evidence | Does not fix replay/authorization behavior |
| **P1.2** | **Design contract accepted for research**: merged #316; owner-approved protective R1–R3 defaults for follow-on proposals; immutable typed intent/revocation rules specified. **Mark only the design checkbox complete.** | Nothing installed: current request ledger lacks `request_intent`; P1.3 lock ordering and R4 same-character/two-encounters policy deferred to P1.5 |
| **P1.3–P1.9** | **OPEN release/security program** despite isolated signed-JWT and lock-graph research on held #317 | Coordinated production authorization/replay/locks, trigger order, true Auth concurrency, compatibility, RLS, rollback |
| **P2** | **OPEN shared-engine program** with accepted architecture and held synthetic graph/shadow evidence; original 19 adapters are not a replacement | Non-executing P1 extraction and P2 parity; later interpreter separately authorized |
| **P3 / P4** | **OPEN broader integrations**; many individual spells/class/sheet/effect primitives already deployed | Specific missing lifecycle, GM-assisted cases, feature tactical consumption |
| **P5 / P6** | **Independent future/partial streams**; do not rework accepted cube dice, printed sheet or shipped runtime spells | Full polyhedra, approved Dawn artwork, advanced Admin recipe editor and later opt-in Actor AI |

## Mandatory blocker register (dated; must reverify)

- **Inventory owner-type conflict, live checked 2026-11-07:** `public.inventory_items` has validated `inventory_items_owner_type_check` permitting `character`, and older NOT VALID `inventory_items_owner_type_chk` excluding it. PostgreSQL still enforces NOT VALID CHECKs on new rows. Original deployed `private.materialize_player_forge_starting_equipment_v1(p_character_id uuid)` contains an insert with `'character'` owner type (source MD5 `653e1b9d7cc47dcff2cef33a674b97f4`). **Likely Forge path failure, not independently proven full original transaction failure**. Held #317 F22–F28 previously reproduced reduced scratch conflict. No live write performed.
- **NPC privacy:** staged #321→#322→#323 incorporates presentation changes #320; must release server ACL/RLS, creator-only vs GM-only secrets, authorized RPC readers and client together. Current original raw readers can disclose lore/sheet under their grants. Do not merge UI-only #320 as a privacy repair.
- **Forge:** held #324→#328→#335 represents J00–J168 signed original-source PG17/GoTrue and J169 Chromium **SourceChoiceFields component**, not whole NewNpcModalV3 browser-to-RPC acceptance. Latest stated trigger census 17/31 staged; 14 absent. Preserve exact JWT evidence and missing coverage.
- **P1 cross-command security:** held #317 contains source-original mixed CP/CS/G/GI/I and replay/lock research; no universal lock protocol installed. Request original intent/revocation/permission checks and two-active-encounter resource policy remain release gates.
- **Old Spell Engine:** #309 24 XPHB attack candidates/22 exception labels + 12 synthetic preflight fixtures; #312 seven-spell nonexecuting parity. A held #309 Acid Splash `limited-number-of-targets` classification conflicts with deployed XPHB 5-ft point Sphere affecting all eligible creatures. Original cantrip `classLevel` vs total level warrants separate multiclass parity inspection. Never promote held classifier as casting authority without source review.
- **Historic spell smoke:** preserved Round 6/version64 resolved example, 8 recorded casts from only a documented subset of 19, not new signed-browser acceptance. Archived #294 green checks coexist with #299 terminal two PG fixture FAILURES; never erase failure evidence.

## Merge/retirement rules

- Only **this documentation clean-up** is owner-approved for merge after exact-head validation; it **does not** authorize #337 or gameplay/security/Forge merges, deletion of historical spell/phase/failed-test evidence, Supabase writes, Vercel manual deployment or paid AI.
- Old handoff pages are replaced by conspicuous route-only stubs and **full original files retained** under [historical handoff archive](ARCHIVED_HANDOFFS_2026-11-07.md). This is archival retirement of conflicting active instructions, not data deletion.
- Before actually closing any other PR: name target source and destination base, verify git ancestry and inbound references, extract unique fixtures/contracts, re-run exact-source tests, record role/browser/rollback limitations, and secure owner decision. Branch-source CI cannot be copied as a passing main result.
