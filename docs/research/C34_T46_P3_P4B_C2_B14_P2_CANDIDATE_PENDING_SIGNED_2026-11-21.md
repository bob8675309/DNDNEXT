# C34 T46-P3-P4B-C2-B14-P2 — versioned inventory authority candidate; signed acceptance PENDING

**Date:** November 21, 2026 CST. **State: RESEARCH-ONLY IMPLEMENTED, NOT ACCEPTED.** Active held PR #379 on `research/c34-clean-main-privacy-forge-joint-source-20261112`. No hosted SQL, map changes, deploy, merge, paid agents, or original gameplay files edited.

## Why P2 exists and what was preserved

Accepted B14-P1 at executable `53ed027adab7b56acc3e1d7beffe627f093a51c0` and Actions #44928308535 established genuine six-role historical signed behavior on disposable PostgreSQL 17/Auth/PostgREST. The original UUID overload of `public.is_admin(uid)` treats unknown non-player role `observer` as elevated. The original definer `public.transfer_inventory_item_v1` consequently accepts a foreign player's item→merchant transfer by an unexpected role even when table RLS rejects raw SELECT. Original `pages/inventory.js` also has an any-error RPC→raw UPDATE fallback for one item and bypasses transfer RPC with a bulk raw UPDATE. These are **historical source/local-fixture facts**, not a verified hosted production vulnerability.

All original policies, June transfer function and admin overloads, `pages/inventory.js`, Town crafting/Forge item source, `components/AssignItemButton.js`, merchant source, and protected `components/MapPageClient.js` are left unchanged by P2 commits. Original B2–B12 acceptance is historical and must pass again on the changed head.

## New candidate artifacts, held branch only

1. `scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p2_inventory_authority_pg17.sql`: disposable-only **versioned** manager predicate requiring database role exactly `admin/gm/dm` (unknown role denied), definer single transfer with locked source item and expected-owner compare-and-swap, validated player/NPC/merchant destination, source owner or delegated NPC manager authorization, and atomic limited 1–50 item deterministic-order bulk with duplicate/missing denial. It does **not** replace original `is_admin`/transfer or alter RLS. Only the versioned RPC signatures gain `authenticated` EXECUTE; `anon` denied.
2. `scripts/integration/c34/run_t46_p3_p4b_c2b14_p2_inventory_signed.mjs`: genuine signed GoTrue/PostgREST six-actor checks, strict canonical roles, unexpected observer and other-player denial, own send/unequip, stale owner fail, merchant restriction, NPC grant/revoke, multi-item atomicity, duplicate/missing/mixed-owner rollback, same-JWT demotion, anon denial, and before/after original buyer/stock/qty/transfer/helper MD5s.
3. `scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p2_inventory_client_fail_closed.mjs` and `scripts/integration/c34/test_t46_p3_p4b_c2b14_p2_inventory_client.mjs`: **not imported by production page**, explicit one-RPC-only, no raw mutation fallback, bulk one-call semantics and receipt validation; Node unit tests for rejection and parameter rules.
4. The existing B2–B14 signed runner now invokes P2 **after** unchanged B14-P1; the existing `validate-c34-t46-p3-p4b-c2b-guarded-buy.yml` push/PR globs and checks include P2 scripts/candidate.

**Exact new commit sequence:** `45490376524b99b7691c8f40e619167b287b8620` SQL, `8658614d82197a974b55c02e548c53a96723c8c9` signed tests, `72abed7ccc8cc7333b1a0e183258e434a78ad47e` signed harness wiring, `1bce2383e21008f5fad04c64d423a45384bdb8ea` CI wiring, `31da01ce01d76c0af8828a58b3505b52c6147b2a` fail-closed client candidate, `5479f260f6fca173b61745fcd451927c942bef4f` Node tests, `b33e88166bc0f86973598a8865ff3a451fbc1650` CI globs/test.

## Acceptance gates and open contract questions

**NO NEW GREEN CLAIM.** Immediately after latest code push, connected GitHub `fetch_commit_workflow_runs` returned zero *PR-triggered* runs for `b33e881...` (this accessor explicitly omits push-triggered runs). Therefore a successful exact-head CI job, decoded signed logs, and actual SQL compile and local runner results **have not been verified**. Do not label B14-P2 accepted; preserve B14-P1 as last accepted executable checkpoint.

Next: inspect exact-head GitHub Actions run including push-triggered workflow (or execute this workflow in strictly disposable local PG17); verify P2 suite and original B2–B14-P1 all passed and inspect full decoded logs; repair candidate only, not preserved runtime. Independently exercise simultaneous conflicting transfers/concurrency and role downgrade under live requests; current tests prove mixed-owner rollback if green but **do not yet implement concurrent race injection**. Add signed preservation of Town crafting raw INSERT / Forge staged equipment and original AssignItemButton behavior before any runtime integration. Verify hosted installed ACLs via **read-only approved contract inspection**, because historical SQL cannot prove current production. The versioned endpoints do NOT close the old vulnerable API while the original RPC remains accessible, and the fail-closed client adapter does not protect users until integrated; neither integration is authorized by these research commits.

**HOLD** on source retirement, production SQL or grants, modifying `pages/inventory.js`, world map, feature flags, merge/deploy; await owner-approved contract and full original-source parity. Independent issue #389 CI-filter research and owner/admin branch protection check remain separate. Both hourly automations remain disabled.

## Verified subsequent evidence: P2 BASELINE signed GREEN, concurrent extension PENDING

**Baseline executable `b33e88166bc0f86973598a8865ff3a451fbc1650`** completed [signed Actions #44931578305](https://github.com/bob8675309/DNDNEXT/actions/runs/44931578305), job **136929147373 SUCCESS**. Complete **95,614-character** decoded job log inspected (1,183 lines). P2 accepted markers:

- `P2-LOCAL-SOURCE`: candidate versioned functions installed only on disposable PG17, anon EXECUTE denied.
- `P2-ROLE`: genuine signed `admin/gm/dm` manager transfers succeed; `observer` and nonowner player return `42501`, no item changed.
- `P2-OWNER`: own send/unequip, stale-owner `40001`, and direct nonmanager merchant `42501`.
- `P2-DELEGATION`: signed NPC delegate can transfer before permission revoke, denied afterward.
- `P2-BULK`: two-owner-matched items moved atomically and unequipped; mixed owner, duplicate and nonexistent item rejections preserve source.
- `P2-SIGNED`: anon denies, original helper/transfer/buyer/stock/qty function body MD5s remain unchanged.
- Source-side Node `test_t46_p3_p4b_c2b14_p2_inventory_client.mjs`: **5 tests PASS / 0 failures**, including no RPC error→raw UPDATE fallback.
- Original B14-P1 nine signed markers and preceding B2–B12 positive/expected-RED passed in same job. This is **source-local acceptance**, NOT production cutover or complete release.

**Newer executable `c2568e16524afd6e9337bad18509c528f1c3c362`** adds two independently concurrently submitted real PostgREST requests for a single source item, and two overlapping bulk requests (exactly one commit, one `40001` stale conflict, losing batch's disjoint item must remain unchanged), plus genuine signed owner insert with card payload and byte-pinned `components/AssignItemButton.js`, Forge character-scoped materializer, and starting-market source. [Extended signed Actions #44932279525](https://github.com/bob8675309/DNDNEXT/actions/runs/44932279525) and [joint original Forge/Auth #44932279895](https://github.com/bob8675309/DNDNEXT/actions/runs/44932279895) were **IN PROGRESS at time of this checkpoint**; **do not claim extended green until exact jobs/logs checked**.

**Scope clarification:** The new signed player INSERT is a *source-shaped positive* for ordinary ownership and card payload; it is **not** a completed Town craft-plan RPC. Forge writes `owner_type = 'character'` (a distinct character UUID ownership contract) and must not be folded into the player/NPC/merchant transfer API without separately tested owner authorization and owner approval. `pages/inventory.js` still uses its historical broad role/UI fallback and direct bulk DML; the P2 adapter is still NOT imported. Versioned P2 RPCs do not disable the old broad helper or legacy transfer function. Hosted actual function bodies/GRANTs remain unverified; read-only Supabase `list_tables` only confirmed relevant table RLS enabled.
