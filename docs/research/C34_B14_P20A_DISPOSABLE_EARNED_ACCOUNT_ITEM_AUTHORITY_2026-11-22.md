# C34 B14-P20A — disposable earned account-item receipt and original writer compatibility

Date: November 22, 2026. Research-only continuation of draft PR #379, based on the accepted P19 signed fixture and P20 original source RED. This is **NOT** a production migration, runtime authorization fix, hosted exploit, or owner rollout approval.

## Exact source and inherited evidence

- Production main remained bb3939eeb9a38cf416996a1dca3b196b156b2915 when this research began. Original /admin page, AssignItemButton, Town crafter and held #345 Stage4 source Git blobs are pinned by the P20A static regression.
- Accepted P19 genuine JWT/PG17 run #45053692275 proved genuine self-account unearned raw INSERT, original Admin assignment, original GM/DM no-user-id RED, temporary manager-only policy GREEN, GM SELECT-HOLD and full P19/P18/P16 cleanup. Do not rewrite that original test or erase its earlier harness failure receipts.
- The P20 original /admin blank-target and self-account INSERT source audit #45054115488 was static; actual mounted authenticated /admin browser and hosted database policy bodies have not been verified.

## New bounded disposable-only candidate

The new SQL file scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p20a_disposable_earned_receipt_gate_pg17.sql has explicit PG17/auth/P16/P18/4-policy preflight, a RESTRICTIVE authenticated direct INSERT policy, private server-written receipt table, and a separately granted signed claimant RPC with fixed search_path and row-level receipt lock. No original policy is rewritten, no inventory table INSERT grant is globally revoked, and no constraint or gameplay file is modified. In the signed fixture a privileged local postgres connection alone creates a receipt, deliberately modeling the future trusted earned-item event seam without inventing Town recipe validation.

The genuine signed runner uses the **same original P16/P18 GoTrue/PostgREST fixture** and executes strictly after unchanged P19 RED/GREEN/cleanup, before P18 teardown. Expected markers: P20A-ORIGINAL-SIGNED-RED, P20A-RAW-DENY, P20A-RECEIPT-GREEN, P20A-TOWN-RELEASE-HOLD, P20A-MANAGER-PRESERVE-READ-HOLD, P20A-RESTORE. These markers must be observed in actual Actions job logs before anyone claims signed acceptance. Source-only node assertions alone cannot establish them.

## Release blockers deliberately exposed

1. Current Town client page consumes raw account inventory, then performs direct INSERT for the crafted item and direct INSERT for rollback. The new restrictive policy intentionally rejects these until an **atomic server-side craft/rollback** validates true consumed source ingredients, recipe and result and issues the matching entitlement. Never ship only the restrictive policy.
2. This candidate tests a trusted seeded receipt and its idempotent claim, not the creation/authorization of a receipt from actual Town, loot, merchant buy or accepted trade. A client-provided receipt id, origin, owner or card_payload must never be treated as earned proof.
3. Original full create_player_character_v3, latest October homebrew/market equipment, held #345 Stage4 **all four policies plus old invalid CHECK**, private GM/DM SELECT/UPDATE/DELETE, merchant stock/wallet, P16 consent, account-trade and complete browser /admin remain distinct regression gates. Earlier suites running before P20A cannot alone prove co-residence during its restrictive policy.
4. The old #345 Stage4 policies have never been installed with P18/P19/P20A as one approved production cutover; their history and original negative cases must survive. Privileged RPCs must review EXECUTE/PUBLIC/grants and exact current caller roles.
5. No hosted Supabase SQL even read-only, main merge, deployed application file, world-map movement/presentation change, original PR retirement or paid-agent activation. Current 22/34 account sheet writer debt and independent encrypted PG17 plus 340 Storage object-byte restore remain HOLD.

## Next step after genuine signed evidence

If all P20A signed markers pass, advance to source-authentic **atomic Town crafting/rollback and merchant/grant issue-event writers**, then jointly exercise original Forge v3/Stage4 and private GM/DM readers with full authenticated browser. If a test fails, preserve the failed log and patch only the actual fixture/source issue; no approval to promote to hosted RLS.
