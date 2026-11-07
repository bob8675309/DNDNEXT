# DNDNext — Active Work Contract (one executable task)

**Owner direction reconfirmed 2026-11-07:** close implemented milestones, reduce unnecessary open research stacks, and preserve working systems. Current priorities are recorded in [NEXT_CHAT_START_HERE.md](NEXT_CHAT_START_HERE.md), the [sequential closeout plan](PHASE_CLOSEOUT_AND_PR_CONSOLIDATION_ORDER_2026-11-07.md), and [PR dependency map](WORKSTREAMS_AND_PR_DEPENDENCIES.md). The full earlier active-work text is retained unmodified as [historical evidence](archive/historical_handoffs/2026-11-07__ACTIVE_WORK.md); **none of its old "next" headers overrides this file**.

**Active phase / subphase:** `P2 / P2.1` — deployed 19-spell baseline / source-qualified composable Spell Engine preservation, *non-executing research/review only*.

**Status:** `SOURCE RESEARCH IMPLEMENTED IN HELD #337 / OWNER MERGE REVIEW NEXT`. The current original tactical implementation is already deployed; the future recipe executor is not. The documentation clean-up PR has a **separate** user-approved merge path and must not be mistaken for approval of #337.

**Next single action:** Re-fetch [PR #337](https://github.com/bob8675309/DNDNEXT/pull/337) exact head/base, 3 CI runs, and source/evidence diff; verify 19 source-qualified spell keys, original RPC/validator/SQL anchors, 48-suite registration, real named smoke vs historical rollback and the held Acid Splash + cantrip-scaling review gaps. Present the narrow review result and request a distinct **owner approval for #337 merge**; until approved leave it unmerged. Do not rewrite the 19 adapters or switch to P2 execution or #309/#312 wholesale.

**Latest dated evidence:** GitHub `main` `2d2135ced24bcb4fbb4d8ccefc27bda70e91eb05`; Vercel production READY `dpl_4DT1FX8sc4NjGbFQYTWiUzVXu2Lc` from same source; draft #337 `e10fed97936e03c7c6fd416ef64dbb5d2605f58c` with 3 green Actions at audit. **These SHAs are not live monitors**; after the documentation merge re-fetch current main, PR and CI before acting.

**Then, not now:** C2 is the independently confirmed inventory constraint conflict affecting original Forge deferred equipment: run a disposable source-authentic PG17 transaction reproducer and propose safely reviewed correction/rollback **without touching production**. Only after that consider selective PR research consolidation and future P1 pure recipe extraction. Follow the ordered [C0–C5 ledger](PHASE_CLOSEOUT_AND_PR_CONSOLIDATION_ORDER_2026-11-07.md).

**Preserved blockers:** P1.3 replay/locks (held #317), NPC secret/private-reader authorization (#321→#323 plus #320), Forge full modal/J169/triggers (#324→#335), unverified modern full-spell browser and multiclass parity, owner R4 shared-character policy, no installed recipe interpreter. No map, town, tactical cast or production SQL change authorized by this queue.

**Handoff discipline:** Complete [S0–S7](PHASED_DEVELOPMENT_CHECKLIST.md); inspect actual source and [SYSTEM_REGISTRY.json](SYSTEM_REGISTRY.json) / [PROJECT_STATE.md](PROJECT_STATE.md); update this single task and **append** [HANDOFF_LOG.md](HANDOFF_LOG.md) on the same implementation branch. One current step; preserve past receipts, negative tests, and all source/edition invariants.
