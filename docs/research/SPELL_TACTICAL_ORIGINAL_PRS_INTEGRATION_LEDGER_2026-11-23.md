# Original spell/tactical PR preservation ledger
2026-11-24 — Agent C, release HOLD. Incremental custody supplement, not a replacement for the November 12 audits or PR dossiers.

## Exact source custody
Fresh branch pre-write HEAD: bb3939eeb9a38cf416996a1dca3b196b156b2915. Target ledger absent (contents API 404).
Fresh immutable file reads: scripts/test_eldritch_blast_local_auth.mjs at #309 a24006624380570bd693a768e97a0c689f1d42b5 and #312 26d2f278b9e85e8fc0b0c04307b7a87bdd2e8254 both returned blob 18a1add79e10876332ecb7febd39085dabce42ea. Disposition: exact_copy between these original commits only; deferred_preserved for release. Current main/#379/#317 inclusion not verified.
- [Original #309 source](https://github.com/bob8675309/DNDNEXT/blob/a24006624380570bd693a768e97a0c689f1d42b5/scripts/test_eldritch_blast_local_auth.mjs)
- [Inherited #312 source](https://github.com/bob8675309/DNDNEXT/blob/26d2f278b9e85e8fc0b0c04307b7a87bdd2e8254/scripts/test_eldritch_blast_local_auth.mjs)
- [Historical signed run/job](https://github.com/bob8675309/DNDNEXT/actions/runs/41216758552/job/124582782428): prior owner-supplied verified log evidence, T2 historical, not rerun today. Editor grant/cast, revoke with same JWT, new cast and prior replay denial; repeated targets, mitigation, cover, Guiding Bolt/Vicious Mockery and canonical attack ability. Preserve genuine negatives and fixture activation ordering.
- #309 scripts/lib/eldritchBlastSignedInAssertions.mjs blob ac8243452d2d880f4274744316d81ee7beaa4034 and scripts/test_eldritch_blast_real_auth.mjs blob f731d1043caab416ab675e09781ce1b2cfc7e68e: prior inspection, deferred_preserved; separate harness does not itself establish revocation.

## Release dependency rows
| Contract | Disposition | Evidence / remaining gate |
|---|---|---|
| Same-JWT editor grant/revoke and replay denial | deferred_preserved | historical T2; retain original harness |
| Complete mutation snapshot after revoked cached replay | unresolved_blocker | independently compare state/log/ledger after replay |
| Hidden target after successful cast then replay | unresolved_blocker | signed visibility transition and no disclosure/mutation; no reproduced exploit claimed |
| can_control-only delegated NPC | unresolved_blocker | reconcile #312 with #318/#345 and #379 consent; can_edit is not equivalent |
| Multiclass total-level beam scaling | unresolved_blocker | class_level fixture alone insufficient |
| Global cross-command lock ordering #317 | unresolved_blocker | historical HEAD 69e741d7c7d8874c22467e2d30791e30c009ff6e; require source graph and genuine concurrency negatives, not hypothetical deadlock claims |
| Total-cover denial specificity | unresolved_blocker | retain rollback/ledger checks and require intended error |
| Original 19 deployed XPHB adapters | deferred_preserved | historical regression oracles; do not equate P1 validators with P2 executor |
| Archived generic/equipment/effect research | deferred_preserved | retain November 12 manifest and originally failing SQL controls |

Agent A: preserve original signed tests, reconcile R1/R2/TC1 and delegated consent before release. Agent B: retain real Auth and activated SQL negatives, no heavy rerun requested. No gameplay changes, hosted SQL or new runtime tests. Fresh evidence today T0 only. Historical main and #379 not certified by this ledger. Next bounded task: compare local Auth harness against current main/#379/#317 and inspect hidden-target replay guard and fixture. Preserve original branches.

## Incremental negative-case specification — revoked cached replay
Fresh T0 inspection of original #309 blob 18a1add79e10876332ecb7febd39085dabce42ea, lines 79–91: new revoked request has before/after mutation assertion and zero command count; prior editor replay checks 42501 only. These are distinct assertions. Proposed missing regression: immediately before replay of editorId, capture readEldritchSignedInState using the original editor request context; after 42501, compare with assertNoEldritchCombatMutation and separately verify original command row remains unchanged (not zero). Do not reuse the fresh revokedId for the cached command ledger assertion. This is a source-backed test specification, not executed or a demonstrated exploit. Disposition unresolved_blocker; historical T2 denial retained, no new T2 claim. Fresh main ref bb3939eeb9a38cf416996a1dca3b196b156b2915. Next: inspect snapshot helper fields and verify whether original command payload is included before implementing isolated regression.

## Snapshot observation boundary — 2026-11-24
Original #309 assertion helper `scripts/lib/eldritchBlastSignedInAssertions.mjs`, blob `ac8243452d2d880f4274744316d81ee7beaa4034`, freshly retrieved. The existing comparator observes encounter version, action availability, target HP/temp HP and request-specific logs. Active participant identity is selected but not retained in the snapshot; private command payload and timed effects are not observed. A revoked cached replay negative must independently compare active participant, original command row and timed effects, in addition to the existing helper. Preserve the helper unchanged as original evidence. Negative control: deliberately alter only one omitted field and require the extended comparator to reject it; the original comparator alone is insufficient. Disposition unresolved_blocker; T0 source inspection only, no runtime defect or new signed acceptance claimed. Next: inspect original SQL replay/visibility ordering and specify hidden-target transition negative.
