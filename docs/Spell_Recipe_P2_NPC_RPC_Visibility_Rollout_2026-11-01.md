# P2 NPC Control — Cross-RPC Visibility Audit and Reversible Rollout Plan

_2026-11-01 · held research PR #312 stacked on unmerged #309. READ ONLY on production; **this is not authorization to deploy, migrate or merge**. Previous six spell-engine owner decisions remain binding._

## Why the v1-only profile proposal was incomplete

Read-only live database inspection established two public authenticated SECURITY DEFINER profile functions, **not just one**:

| Entry point | Live definition MD5 | Source behavior |
| --- | --- | --- |
| `public.encounter_spellcasting_profile_v1(uuid)` | `e4d6eac7759720b05af0de9dc6c6fc4e` | Checks encounter controller, returns all spell assignment records, source and class detail, encounter slot snapshots |
| `public.encounter_spellcasting_profile_v2(uuid)` | `d2a41429785f5c55f6c5b941d6ed6d88` | Calls v1, **then synchronizes persistent character spell slots**, compares character/encounter balances and appends `persistentSlotState`, `persistentSlotMismatch`, `resourceBridgeVersion`, `persistentResourcesLinked` |

**Critical design finding:** a delegation-only user who received a filtered v1 but could still call unchanged v2 would receive appended character-persistent resource metadata and reach a resource-sync code path. A v1-only redaction is therefore **not a complete visibility boundary**. This is a **proven source-level bypass of the proposed v1-only projection**, not a claim that live DnDWeb has already deployed delegation or that current users have newly exploitable access.

`sql/candidates/20261101_npc_spell_profile_v2_visibility_candidate.sql` snapshots the exact v2 body as a private ungranted helper. Its proposed public v2 wrapper obtains the v1 visibility scope first:
- `visibilityScope='delegated-combat'`: return that restricted v1 JSON **unchanged**. No `persistentSlotState` fields and no v2 synchronization call.
- All other existing authorized caller types (Admin, service, direct encounter controller, character-sheet authorized): use the frozen original v2 logic and preserve current persistent-resource fields.
- Authorization denial flows through guarded v1. No second public unfiltered profile endpoint, and private original v2 is not executable by normal players.

This is an unapplied research candidate. The `private.sync_character_spell_slots_v1` function is real in production. The local test uses a **reduced fail-closed helper model**, not the complete deployed sync implementation. That limitation is a release blocker for full persistent-resource parity.

## Other read RPCs checked

SELECT-only `pg_proc` review found **180** authenticated-executable SECURITY DEFINER public functions at this checkpoint. Direct-source search identified **21** mentioning `character_sheets`, **28** mentioning `character_spells`, and **12** mentioning `encounter_spellcasting_profile_v1`; **12** such public SECURITY DEFINER functions are anonymously executable. These are broad source-text counts, not 180 code-proven vulnerabilities or an exhaustive call graph (functions may delegate dynamically or use helpers without those strings).

Focused live source review:

| Function | Live MD5 | Authorization/visibility check observed |
| --- | --- | --- |
| `get_character_secrets_v1(uuid[])` | `2f28c77dcda18aed1c654515b26ec438` | Returns secrets **only** when `private.can_access_character_v1(character,'edit')` |
| `get_my_player_character_v1()` | `b6049deb0b4d59daf15d7dd6e8ac1079` | Requires user's `can_edit` and `player-character` tag |
| `get_my_player_characters_v2()` | `deca87aaad0dce214743c87cdca03f36` | Requires same user's `can_edit OR can_inventory OR can_convert` and player-character tag, then returns **the complete sheet** |
| `get_character_inventory_v1(uuid)` | `d958dc1b685836117421fea5b8749478` | Requires existing `can_access_character_v1(...,'inventory')` |
| `get_character_currency_v1(uuid)` | `3b6361dcdce22bb8cb4a0602d51c34d` | Requires existing inventory permission |
| `get_character_invocation_recovery_v1(uuid)` | `7a70b2e99f8dbf5ecdbdb5fbdffec271` | Requires progression-management permission, even though function is currently executable by `anon` role |
| `character_equipment_effects_v1(uuid)` | `5f459de66d5b429ddbd5ee629fbc9ef1` | Requires Admin, service, or source-character read permission |
| `get_character_class_option_grants_v1(uuid)` | `6bed1fb26cda25602d1de426716d8518` | Requires progression-management permission, even though function is currently executable by `anon` role |

The existing `get_my_player_characters_v2` full-sheet response for inventory/convert permissions **predates NPC delegated-control**, but it is a separate existing disclosure contract. Do **not** claim no non-editor can see full sheets. Review existing permissions before changing that endpoint.

The above do not reference the new `can_control` bit (not present in the live schema). **No new privilege was found from delegation in these direct source readers.** That is not proof that all 180 function bodies and nested helpers are safe. Anonymous EXECUTE to functions with internal checks deserves later least-privilege hardening, not an unreviewed global REVOKE.

`scripts/audits/npc_sensitive_rpc_readonly_p2.sql` reproduces live function fingerprints, direct-source counts, ACLs and RLS policies with SELECT only. A SQL/definition change after this checkpoint requires revalidation.

## New isolated true-JWT regression

`scripts/fixtures/npc_source_read_rpc_parity_pg17.sql` loads **the original live definitions** of all three secret/player-sheet RPCs into the free local GoTrue/PostgREST test fixture. It marks a hidden test NPC with a deliberately adversarial `player-character` tag, so tag checks alone do not hide a flawed permission predicate. Three signed-in JWT principals verify, before delegation, after grants, and after revocation:

- Ordinary delegated-only users receive **zero** `get_character_secrets_v1` rows, **NULL** `get_my_player_character_v1` and **empty** `get_my_player_characters_v2`, despite having the NPC combat token and an unusual source tag.
- Admin may read the fixture NPC secret (positive control).
- The test still proves that the same delegated controller can act in combat; neither the NPC's source sheet nor GM inventory is made readable.

`scripts/fixtures/npc_spell_profile_v2_source_shape_pg17.sql` loads the original live v2 function body and the held wrapper. It models persistent slots and defines a **test-only helper that deliberately raises** if delegation-only code reaches persistent slot synchronization. It verifies Admin and direct-PC v2 retain original resource fields; delegated v2 is identical to filtered v1; denied and revoked JWTs cannot call either version.

These fixtures contain no campaign identities or production user data. They use real local GoTrue-signed JWTs but a reduced SQL schema. A green local CI test is meaningful authorization evidence, **not** full production cutover clearance.

## Proposed rollout — not executable until explicit owner approval

The owner has **not yet approved** the conservative known/ready-only NPC spell visibility default. All phases below are a design checklist, not instructions to run against DnDWeb.

**Phase 0 — freeze and preflight.** Hold current main and draft PRs; get explicit GM visibility decision. Recheck live pg_proc MD5s for **both** profiles, controller and source-access helper; snapshot their full `pg_get_functiondef` bodies, `pg_get_policydef` / `pg_policy` text, grants/owner, function and column dependencies, current field defaults, RLS and table size. Obtain tested rollback artifacts in a real isolated production-shaped environment. Confirm known same-character overlapping-active-encounter records and unresolved global replay/lock hazards; do not claim they have been fixed by the NPC controls.

**Phase 1 — server expansion without UI exposure.** In one owner-reviewed transactional SQL migration: add `can_control NOT NULL DEFAULT false`; preserve legacy editing/inventory/convert bits; install and explicitly permission-gate the Admin assignment RPC, encounter controller predicate, participant hidden-token RLS, **both** delegated profile wrappers and inaccessible private original bodies. Check execution roles, `search_path`, RLS dependencies, lock timeouts, row policy composition, and canonical source field availability. Never introduce a temporary public unfiltered profile as a fallback. No unconditional backfill of `can_edit` into `can_control` is required for legacy control to remain functional because the controller predicate already accepts `can_edit`; if keeping the candidate's currently included backfill, formally acknowledge that switching the new toggle off does not remove legacy editor access.

**Phase 2 — staged acceptance.** Before any real player sees toggles, run genuine three-user GoTrue/PostgREST tests for Admin grant/revoke, two players controlling one NPC, denial of secret/source-sheet/inventory reads, legacy PC/Admin v1/v2 response parity, filtered v1/v2, unchanged-JWT immediate revocation, hidden encounter token reads, and race of one Action with owner-bound request results. Then full Next.js browser tests, with the Admin panel closed to normal players and direct/legacy access semantics verified.

**Phase 3 — activate UI and observe.** Deploy the reviewed server/schema bundle **before** enabling its matching Admin UI, preferably behind a server-backed feature flag; verify data/API schema cache refresh. Alert on unauthorized read, unexpected grant persistence and combat resource contention. Player switching control between actors must not copy their sheet or source permissions. Only make actual campaign assignments after GM confirmation.

### Reversal of a partially or fully activated rollout

1. **Disable the new Admin toggle / delegated feature first** and preserve audit trail. Do not delete character permissions, player accounts or encounters. Existing direct-controller/`can_edit` access still works.
2. In one verified transaction **restore both original public v1 and v2 spellcasting profile definitions**, original `encounter_can_control_participant_v1`, original participant RLS policy and their grants from the preflight snapshots. Revoke/drop only the newly added Admin grant RPC and private helper wrappers after checking dependencies; do not revoke other historic RPCs.
3. **Retain the `can_control` column and its historical values** during emergency rollback to avoid destructive migration/permission data loss. It becomes dormant after restoring old controller/profile predicates; schedule later cleanup with separate audit and explicit sign-off.
4. Re-run negative tests for revoked JWTs, original PC/Admin profile output, anonymous EXECUTE denial, full initial RLS policies and old UI stability. Verify no live cast/action/version drift. If old clients still invoke the new grant RPC, they must fail explicitly; do not silently accept an unsigned or no-op mutation.
5. If any in-flight lock-order work was released alongside this change, **do not** claim this visibility rollback reverses it. Revert command-ledger/slot changes by their independent owner-reviewed migration/rollback plan.

**Migration-specific blocker:** Current draft candidates are separate SQL files, not a validated atomic migration, and `private` full-profile snapshots, function ownership, RLS policy grants, service-role/anonymous ACLs and method dependencies require full production-shaped rehearsal. The historically mixed actor/encounter lock order and stale command-ledger replay behavior remain release blockers.

## Single next task

After exact-head free CI is green, **inspect remaining public profile/secret-equivalent read endpoints and client call sites for alternate sensitive disclosures**, especially anonymous-executable SECURITY DEFINER readers and `encounter_spellcasting_profile_v2` resource synchronization interactions. Obtain the owner's explicit delegated spell visibility decision, then prepare an approved reversible migration only after testing against a complete isolated schema. Do not touch production without approval.
