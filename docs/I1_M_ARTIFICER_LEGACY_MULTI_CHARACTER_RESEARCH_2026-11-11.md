# I1-M — Artificer sheet projection versus multi-character legacy player snapshot

**Research-only.** This study is based on I1-L draft #360 final head `4763a00a6a9afc387090b2853754dd22a7544b80`, with the November 9 owner-approved I0–I6 integration-first queue controlling. The original I1-L source RED and exact one-condition Artificer NULL-safe candidate remain unchanged. No hosted SQL, data edits, app runtime, world-map change, merge or deployment is authorized.

## Problem and source identity

Merged documentation-only PR #319 preserved a candidate one-clause safeguard for the original `public.create_player_character_v2(jsonb,jsonb)` account-wide `public.players.sheet` UPSERT:

```sql
ON CONFLICT (user_id) DO UPDATE
SET sheet = EXCLUDED.sheet, updated_at = now()
WHERE public.players.sheet = '{}'::jsonb;
```

The original `private.sync_character_artificer_plan_projection_v1(uuid)` executes after the v2 source function inside the original deferred Artificer progression trigger, then unconditionally updates **all matching** account-wide `players.sheet` rows by `character_permissions.user_id`. The #319 guard cannot stop a later independent writer. The canonical per-character `character_sheets.sheet` must still be projected correctly. The original Artificer materializer hash is `67766989a466b82f170b5e00f9154e24`. Source original projection hash is `5ebf572db01143e9b523c7dba0d43ad5`.

Read-only live inspection on November 10 found 34 stored functions containing account-wide `UPDATE public.players`, three populated legacy sheets, and at least one account with multiple editable player characters. This is a **shared historical compatibility risk**: changing only Artificer does not solve all other writers. No per-user private sheet contents were exported.

## Bound source/test sequence

1. Retain **all** original signed I1C–I1L acceptance and negative fixtures. In particular I1L-02 reproduces the original projection defect with four normalized grants but missing canonical projection. I1L-03–12 exercise the existing one-condition NULL-safe scratch candidate.
2. Capture a signed first-character Fighter with populated `players.sheet`. **Source finding:** the #324 private v2 source body already contains the exact #319 UPSERT clause; use a source-hash guard to verify that clause is present without replacing v2 again. Keep the public v2/v3 wrappers unchanged.
3. Create an Artificer as that same account using signed GoTrue/PostgREST. **Expected source RED:** despite the existing #319 UPSERT guard, I1-L's Artificer projection replaces the legacy Fighter snapshot. Preserve this as negative regression evidence, not as a passing product contract.
4. Apply a second **disposable-only** Artificer projection candidate that extends only the legacy-mirror update predicate. It updates `players.sheet` only when it is empty or the existing `sheet.meta.creationRequestId` equals the newly projected character's immutable `characters.creation_request_id`. The canonical character sheet update, original grant materializer, and I1-L NULL-safe initializer remain untouched. Any missing identity fails closed instead of silently overwriting a legacy snapshot.
5. Signed GREEN: after creating a second Artificer, its canonical sheet has all four plans; prior Fighter legacy sheet is byte-identical; Story/nonce replay and rollback remain unchanged. A **first** Artificer remains able to update its own newly initialized mirror to include the four plans. Privileged **local-only** delegated-permission specimen proves that an unrelated account's mirror is not rewritten when its permission row references the Artificer.
6. Negative deferred duplicate plan selection must still reject the full transaction without consuming nonce, grants, inventory, Story or either legacy snapshot.

## Important caveats

- This is a **hypothesis backed by source**, and not accepted until actual I1-M exact-head job logs display the source RED plus candidate GREEN. Do not mark tests passed from file existence or a green unrelated CI workflow.
- The delegated permission specimen is installed by privileged scratch SQL after the signed creation. It is *not* proof that a real delegated user can call the private projection function.
- This bounded candidate does not decide the longer-term semantics of `public.players.sheet`. At least 34 live functions write to the account-wide mirror. A separate full caller/readers census, source-authority decision, original trigger co-residency, signed multi-user browser, cross-command concurrency and backup/Storage recovery are prerequisites to live migration.
- Existing original Artificer source and the #319, #324, #345 research documents must not be overwritten or retired. No world/town/tactical map code is touched.

## Validation and ownership

Proposed workflow: `.github/workflows/validate-i1m-artificer-legacy-local-auth.yml`. Test extension: `scripts/test_i1g_warlock_original_guards_joint_local_auth.mjs`, opt-in `DNDNEXT_I1M_LOCAL_CONFIRM=DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY`.

The source-check-only fixture performs no v2 function replacement because #319's clause was already incorporated into #324's private original-v2 source. The two independent disposable SQL artifacts are `scripts/fixtures/i1m_legacy_v2_source_guard_local_pg17.sql` and `scripts/fixtures/i1m_artificer_legacy_projection_candidate_pg17.sql`. The original I1-L isolated test and five helper hashes remain unchanged.

**Release status: RESEARCH ONLY, NOT DEPLOYED.** Complete the exact-head signed CI, inspect diagnostic logs, and correct any failing source constraints without modifying the original RED evidence. Then consider a narrow compatible candidate for further original-trigger/role/browser validation under the owner's I0–I6 program.
