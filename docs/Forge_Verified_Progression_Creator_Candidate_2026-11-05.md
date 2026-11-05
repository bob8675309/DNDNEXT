# Verified Forge progression creator binding — unapplied research, 2026-11-05

> **Research only / NOT a migration.** This file describes `sql/candidates/20261105_forge_progression_verified_creator_seed_v1.sql` on [draft PR #324](https://github.com/bob8675309/DNDNEXT/pull/324), stacked on unmerged creator-attribution PR #321. No live SQL, grant, data correction, merge, deployment or browser acceptance is authorized.

## Reproduced original problem (not assumed fixed)

The source-original player creation v2 inserts `public.characters`, then `public.character_sheets`, then upserts `public.character_progression.created_by`. The original sheet INSERT's `AFTER` sync handler inserts the progression row **first, with `created_by = NULL`**. The source-original feat materializer is an immediate progression `AFTER INSERT` trigger. Thus it copies the *premature* `NEW.created_by = NULL` into both `character_option_grant_instances.granted_by` and `character_option_grants.granted_by`.

[Exact preceding source test 42041040368](https://github.com/bob8675309/DNDNEXT/actions/runs/42041040368) proved grant persistence with null provenance. On DnDWeb, read-only aggregate counts: 3/3 feat grant-instance `granted_by` are NULL; all three have current non-NULL progression `created_by`; 3/10 aggregate feat grants NULL. Counts do not establish each historical creation path.

## Why a BEFORE INSERT seed is the smallest bounded candidate

The proposed new `private.seed_verified_forge_progression_creator_v1()` is a `SECURITY DEFINER` **BEFORE INSERT** handler on `public.character_progression`. It does not rewrite original Forge v2/v3, materializer or sheet-sync functions. Only when `NEW.created_by IS NULL`, the *server-stamped* current sheet's `meta.creator` equals `shared_character_forge_player_v2`, the request has non-NULL `auth.uid()`, and immutable `private.character_creator_attribution` contains the **same actor captured in this transaction** (creator `recorded_at = transaction_timestamp()`), it sets `NEW.created_by` to that trusted actor. The original feat `AFTER INSERT` materializer then consumes this non-NULL source value. A forged request payload or `can_edit` alone never determines the actor.

The candidate deliberately has **no dependency on creation_request_id** because the original public v2/v3 interfaces also permit creation without a request nonce. It never edits already inserted progression, grants, character sheets, unrelated or historical characters, and it does not touch Admin NPC/service creations lacking the player Forge marker.

The trigger code makes **only plain MVCC SELECTs** from the already-created sheet and immutable creator-attribution table; no `FOR UPDATE`, DML update, additional grant-row locking or new `CP → G` backfill is introduced by the candidate itself. This is a *bounded source-level lock observation*, **not a global CP/CS/I/G proof**. The existing original Forge sync/materializer already exercise CS→CP→G and deferred CP→CS/I. P1.3 #317 requires an independent coordinated multi-session lock schedule and all remaining original triggers before any release.

## Verified original-source and corrected-path test order

[GitHub Actions run 42046427282](https://github.com/bob8675309/DNDNEXT/actions/runs/42046427282) **SUCCESS**, original PG17 and real GoTrue/PostgREST jobs at exact tested executable SHA **`57ec8c1357c3dece4629c41c3111ea7a33bb0588`**. The original-source J00–J48 fixture runs **unchanged first**, including J39's expected NULL `granted_by` baseline. Only then is the new BEFORE INSERT candidate installed on disposable PostgreSQL17. Authenticated J49–J62 establish:

- New, genuine signed-in player v2 with a valid XPHB Lucky feat has matching `auth.uid()` in progression `created_by`, immutable captured creator, *both* canonical grant tables `granted_by`, and unchanged original feat/equipment materialization.
- Identical nonce retry is inert, changed nonce intent rejects and never updates the attributed grants; new creations **without a nonce** also receive verified attribution.
- Original v3 (nested v2) with source-validated spell + feat, independent account creation, and concurrent same-nonce requests retain one canonical grant/event/item/currency with the correct actor.
- Failed canonical feat constraint rolls back character, immutable creator capture, grant and nonce; Admin NPC and no-identity service paths remain separate; previously NULL historical grant actors are **not backfilled**.
- Current `can_edit` revocation denies cached nonce replay; a current co-editor can edit ordinary sheet notes but cannot rewrite feat authority or become grant creator.
- **J49–J62 PASS at the exact tested source head**, with old J39 still demonstrating the original bug. The five existing additional grant-table hooks and seven original creation-adjacent triggers remain source-limited. All other original trigger graph, real production RLS/ACL, specialized feat runtimes, all-source catalogues and P1.3 locks remain release blockers.

### Executed test-case ledger

- **J49** signed-in original v2 source-valid Lucky feat: `character_progression.created_by` **and both canonical grant-table `granted_by` fields** match the immutable creator captured by #321 in the same transaction.
- **J50–J51** identical request ID leaves both grant-row hashes and event count unchanged; changed feat ownership selection under that ID is rejected without mutation.
- **J52** a valid player v2 creation with **no `creation_request_id`** still receives the signed-in source creator; the candidate does not require nonce reservations to identify a new creator.
- **J53** original v3 nested v2 source properly attributes a Wizard's Lucky feat and preserves Fire Bolt's canonical spell with inert retry.
- **J54–J55** two concurrent real JWT same-nonce calls create one attributed grant/event/item/currency; an invalid grant JSONB shape rolls back the character, private creator record, reservation and grants.
- **J56–J58** two independent authenticated accounts obtain separate actor attributions; original Admin NPC creation remains distinct; original historic NULL source-grant actors are **not** backfilled.
- **J59–J60** revoking current edit permission prevents cached same-nonce replay and an authorized coeditor's ordinary note cannot change feat authority or become the original grant creator.
- **J61** original Forge equipment rejects a privileged local service-style **no-UID** attempt, atomically rolling it back; a genuine plain service NPC without Forge marker stays unattributed. The local service test is **not** a separately authenticated GoTrue session.
- **J62** passing an attacker-controlled `creator_user_id` with a genuinely signed-in player's v2 payload cannot rewrite immutable creator capture or either grant-table actor.

No production `private.seed_verified_forge_progression_creator_v1` function/trigger exists. The scoped candidate has no grant-table UPDATE, row-locking `FOR UPDATE`, historical data repair, or modification to deployed v2/v3/materializer source. These new tests prove bounded actor binding and nonce behavior, **not global P1.3 deadlock freedom**.

## Additional review decisions before any release

Despite J49–J62 passing in isolated genuine Auth, this design still requires source/auth review for legacy player v1 and Admin NPC creation; genuine signed-in browser acceptance for all Forge tabs; full current source-catalogue/deferred equipment behavior; actual original trigger graph; CP/CS/G/I cross-character and level-up/sheet-edit contention; explicit rollback order; and GM/creator-only backstory and private `characters.secret` coordination.

Historical grant `granted_by` rows are **not reconstructed automatically**. That requires separate owner approval on whether and how archival provenance may be recovered. An original creator does not automatically prove who later granted a feat.

**Production effects: NONE.**
