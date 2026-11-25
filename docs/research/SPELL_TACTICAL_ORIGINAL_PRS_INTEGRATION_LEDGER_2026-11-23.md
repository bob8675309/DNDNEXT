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

## Hidden-target cached replay — 2026-11-24
Fresh T0 reads of [#309 atomic candidate](https://github.com/bob8675309/DNDNEXT/blob/a24006624380570bd693a768e97a0c689f1d42b5/sql/candidates/20261029_eldritch_blast_atomic_candidate.sql) and [#312 inherited candidate](https://github.com/bob8675309/DNDNEXT/blob/26d2f278b9e85e8fc0b0c04307b7a87bdd2e8254/sql/candidates/20261029_eldritch_blast_atomic_candidate.sql) both returned blob a41e34c545e7c84c607b383061847b048fa1a764 (exact_copy; deferred_preserved). Lines 58–81 verify signed role and caster control/editor/admin; lines 85–95 match cached request owner, actor, spell, assignment and target intent and return the stored result before target visibility checks at 161–169. The conflict replay at 177–188 instead follows those checks. Lines 236–251 include targetName, targetId, AC, damage and targeting in the stored beam response; 265 persists it. Thus a previously authorized caster retaining caster access can reach the early cached return without current target visibility validation. This is a static candidate disclosure risk, not a reproduced exploit or a claim about deployed code or separate #312 wrappers.
Required signed negative: in disposable fixture, non-admin caster not controlling target casts while target visible; confirm same-intent replay while visible succeeds without consuming another Action. Authorized fixture operator hides target without revoking caster access; verify same JWT and current RLS concealment, then replay original UUID and unchanged target list. Require denial or owner-approved masking with no hidden identity/targeting/damage disclosure; compare full combat/effect/log/command snapshots taken AFTER concealment and BEFORE replay, including original ledger row unchanged. Fresh hidden-target cast must independently deny 42501 with no inserted command. Restore visibility and verify ordinary idempotency, including spent Action. Do not require fresh-turn or alive-target eligibility for legitimate replay merely to fix visibility. Test both early and conflict paths where feasible; preserve original signed revocation negatives. Disposition unresolved_blocker; no new T2 run. Next: inspect #312 wrapper and can_control-only delegation consumer before deciding whether it mitigates this inherited path.


### 2026-11-25 — #312 delegated visibility and guarded replay boundary (T0)

Prior invocation inspected original #312 at `26d2f278b9e85e8fc0b0c04307b7a87bdd2e8254`. Preserve these exact source receipts (historical inspection, not new signed execution):

| Candidate under sql/candidates/ | Blob | Disposition |
|---|---|---|
| 20261101_npc_delegated_control_candidate.sql | 29e700c8bf2008c1b46abc5dc74a266547473cf7 | deferred_preserved |
| 20261031_fire_bolt_guarded_replay_candidate.sql | a6967455c624a27a169bb20bda5668ce217ae2e6 | deferred_preserved |
| 20261101_npc_spell_profile_v2_visibility_candidate.sql | ea7067fe22b6997cd9f600d2ecd6d7e2d682b73f | deferred_preserved |

Fire Bolt wrapper is restricted to fire-bolt|xphb and is not a behavioral successor for inherited Eldritch Blast replay. Delegated participant RLS recognizes can_control/can_edit, whereas the wrapper hidden-target guard recognizes direct controller/admin. Profile v2 delegated-combat early return avoids full persistent-slot projection and synchronization. Cross-candidate compatibility remains unresolved_blocker; no live defect demonstrated.

Required signed negative: using synthetic local fixtures, grant can_control only (can_edit false), verify assigned NPC control and restricted profile without persistent-slot writes; verify unrelated hidden target remains concealed. Revoke delegation without replacing JWT; reject fresh and cached commands and compare complete combat/effect/log/ledger state. Positive control: direct controller and authorized delegated NPC visibility must follow owner-approved policy; do not broaden unrelated target access. Compare wrapper and direct public RPC entry points separately. Preserve original #309 signed editor negatives; they do not establish this contract. Agent A must reconcile with consent integration; Agent B should retain genuine signed negatives. Release HOLD. No new runtime execution.
