# GM review and custody-transfer invalidation — attunement evidence gate (2026-10-24)

**Staged draft only.** Depends on PR #264 → #263 → #262 → #261 → #260 → #257. It is separate from the #251 → #253 → #255 common-effects arithmetic chain. No production migration, gameplay, combat, map, UI or attunement-bond changes were made.

## What the rules and live database establish

The 2024 [Equipment—Attunement](https://www.dndbeyond.com/sources/dnd/br-2024/equipment) rule requires an uninterrupted Short Rest in physical contact with one focused item, distinct from identifying it. The 2024 [Short Rest glossary](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary/) specifies that rolling Initiative, casting a non-cantrip spell or taking damage interrupts the rest.

Read-only live inspection confirmed character_rest_log, encounter_combat_log and world_events exist, but these records cannot, as currently shaped, prove the character maintained contact or that all possible interruptions were absent for a full game-world hour. The campaign world clock advances at 4× real time; completed_at uses real server time. Do not equate the clocks.

## Staged implementation

- A private, append-only attunement_focus_gm_reviews_v1 table ties each reviewed attempt to its **exact canonical Short Rest** log ID, reviewing admin identity, signed decision, explicit contact/continuity/identification confirmation, game-world timestamp and meaningful explanation.
- private.review_attunement_focused_rest_v1 is **SECURITY INVOKER, service-role-only**, and also requires a signed-in authorized administrator. Unknown clients, unprivileged players and service key alone cannot create approvals. Approval requires all three explicit GM judgments; reject records remain possible. Existing completed rest, current custody/source/class and active encounter gates are rechecked.
- One immutable review per attempt; replay with identical values returns the same review. Contradictory updates are rejected. This is manual **DM adjudication**, not automatic proof derived from event logs.
- A dedicated inventory ownership-transfer trigger invalidates an active or rest-logged focus **even if the item later returns to its previous owner**, closing the simple snapshot-custody gap. Historic review rows remain audited but cannot reactivate an invalid focus.
- All review results unconditionally return attunementReady=false and canCreateBond=false. The original attunement writer is unchanged and current magical bonuses remain inactive.

## Isolated PostgreSQL tests

Tests cover player/service-only denial, correct authenticated admin, missing contact or interrupted/same-identification denial, wrong character, active encounter denial, exact rest UUID, rejected review, immutable decision/reason, idempotent replay, transfer-out-and-back invalidation, existing canonical rest/resource behavior, no bonds created, private ACL.

## Remaining release gates

1. Decide GM confirmation controls and audit/UX in a real signed-in session. No free-form player JSON or arbitrary AI claims as trusted rule evidence.
2. Connect observable initiative, spell and damage interrupt events if they can be verified for the entire world-time period. Reconcile clock pauses and item identification while respecting existing tactical authority and leaving world-map routing unchanged.
3. Only then replace the original #257 boolean attunement write path with an atomic, source/attestation/class/cap/Artificer/curse/transfer-rechecked writer. Existing #257 remains an unsafe activation bypass if deployed alone.
4. Verify genuine character and active encounter parity, spell DC/equipment/weapon and typed resistance/DR before activating any effect; keep future AI tools read-only.
