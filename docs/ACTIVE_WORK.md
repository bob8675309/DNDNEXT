# DNDNext — Active Work Contract (one executable task)

**Owner direction 2026-11-07:** close proven implementation/research milestones without equating fixture success to production acceptance. Start from [NEXT_CHAT_START_HERE](NEXT_CHAT_START_HERE.md), [C0–C5 work order](PHASE_CLOSEOUT_AND_PR_CONSOLIDATION_ORDER_2026-11-07.md), and the newest [HANDOFF_LOG](HANDOFF_LOG.md). Historical pre-#338 queues are [archived](ARCHIVED_HANDOFFS_2026-11-07.md).

**Active phase / subphase:** `P1 / P1.3` — C2 Forge inventory-owner CHECK + RLS *research/acceptance boundary*. No production migration or change to live RLS is authorized.

**Status:** C0 documentation closeout COMPLETE (merged #338); C1 19-XPHB preservation COMPLETE (owner-approved merged #337 as `dbc7006919f35c8f7b12921bf468c4f949ca77ad`, Vercel READY same SHA). C2 original signed local-JWT research already proves v2 creation deferred `23514`, old-CHECK causality, RLS security side effect and combined review-only candidate; v3 succeeds under candidate. **C2's direct original-v3 pre-candidate negative case J79B is newly added to held #335 but exact-head CI must be checked**. See [C2 evidence audit](C2_FORGE_CONSTRAINT_AND_RLS_CLOSEOUT_2026-11-07.md).

**Next single action:** Verify held [#335](https://github.com/bob8675309/DNDNEXT/pull/335) head `19d7275d24d26f9641c9e6d98ea24cf9431f4d81`, especially **J79B actual signed original v3→v2 under BOTH live-style CHECKs**, its expected `23514` and full rollback and J95 signed v3 positive after combined scratch candidate. Read latest exact-head workflow/job logs and preserve any failing receipt. If green, declare only C2 *source-authenticated reproduction* complete and move the **one next action** to C3 clean-main PR fixture/consolidation crosswalk; if red, repair only the isolated research fixture and rerun.

**Production safety:** source-live PG17.4 still has both conflicting inventory CHECKs and four RLS policies giving authenticated direct inventory DML based on `user_id` or Admin. **Never drop the old CHECK alone.** Held combined RLS+CHECK SQL is a non-production research candidate; requires separate owner approval, full source/RLS/31-trigger and multi-role/browser acceptance, lock/rollback strategy, and separately generated migration. Do not merge #335 or modify existing Forge inventory, NPC Profile, towns, world map, casts or paid AI.

**Important split:** Original tactical Phase 1A–1Z deployed; 19 adapters/48 baseline validators protected after #337. The later source-qualified composable spell recipe executor, P1.3 replay/locks, GM/creator NPC privacy, Forge full trigger/browser acceptance and item ownership migration remain open separate release gates.

**Handoff:** Use [S0–S7](PHASED_DEVELOPMENT_CHECKLIST.md), [SYSTEM_REGISTRY](SYSTEM_REGISTRY.json), and append [HANDOFF_LOG](HANDOFF_LOG.md); no old branch-local task supersedes this file.
