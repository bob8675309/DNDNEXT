# Verified Forge progression creator binding — unapplied research, 2026-11-05

> **Research only / NOT a migration.** This file describes `sql/candidates/20261105_forge_progression_verified_creator_seed_v1.sql` on [draft PR #324](https://github.com/bob8675309/DNDNEXT/pull/324), stacked on unmerged creator-attribution PR #321. No live SQL, grant, data correction, merge, deployment or browser acceptance is authorized.

## Reproduced original problem (not assumed fixed)

The source-original player creation v2 inserts `public.characters`, then `public.character_sheets`, then upserts `public.character_progression.created_by`. The original sheet INSERT's `AFTER` sync handler inserts the progression row **first, with `created_by = NULL`**. The source-original feat materializer is an immediate progression `AFTER INSERT` trigger. Thus it copies the *premature* `NEW.created_by = NULL` into both `character_option_grant_instances.granted_by` and `character_option_grants.granted_by`.

[Exact preceding source test 42041040368](https://github.com/bob8675309/DNDNEXT/actions/runs/42041040368) proved grant persistence with null provenance. On DnDWeb, read-only aggregate counts: 3/3 feat grant-instance `granted_by` are NULL; all three have current non-NULL progression `created_by`; 3/10 aggregate feat grants NULL. Counts do not establish each historical creation path.

## Why a BEFORE INSERT seed is the smallest bounded candidate

The proposed new `private.seed_verified_forge_progression_creator_v1()` is a `SECURITY DEFINER` **BEFORE INSERT** handler on `public.character_progression`. It does not rewrite original Forge v2/v3, materializer or sheet-sync functions. Only when `NEW.created_by IS NULL`, the *server-stamped* current sheet's `meta.creator` equals `shared_character_forge_player_v2`, the request has non-NULL `auth.uid()`, and immutable `private.character_creator_attribution` contains the **same actor captured in this transaction** (creator `recorded_at = transaction_timestamp()`), it sets `NEW.created_by` to that trusted actor. The original feat `AFTER INSERT` materializer then consumes this non-NULL source value. A forged request payload or `can_edit` alone never determines the actor.

The candidate deliberately has **no dependency on creation_request_id** because the original public v2/v3 interfaces also permit creation without a request nonce. It never edits already inserted progression, grants, character sheets, unrelated or historical characters, and it does not touch Admin NPC/service creations lacking the player Forge marker.

The trigger code makes **only plain MVCC SELECTs** from the already-created sheet and immutable creator-attribution table; no `FOR UPDATE`, DML update, additional grant-row locking or new `CP → G` backfill is introduced by the candidate itself. This is a *bounded source-level lock observation*, **not a global CP/CS/I/G proof**. The existing original Forge sync/materializer already exercise CS→CP→G and deferred CP→CS/I. P1.3 #317 requires an independent coordinated multi-session lock schedule and all remaining original triggers before any release.

## Exact test order and acceptance contract

The full original-source real GoTrue J00–J48 fixture is run **unchanged first**, including J39's expected NULL `granted_by` baseline. Then the candidate is installed only in the disposable local PostgreSQL17 database. J49+ must establish:

- New, genuine signed-in player v2 with a valid XPHB Lucky feat has matching `auth.uid()` in progression `created_by`, immutable captured creator, *both* canonical grant tables `granted_by`, and unchanged original feat/equipment materialization.
- Identical nonce retry is inert, changed nonce intent rejects and never updates the attributed grants; new creations **without a nonce** also receive verified attribution.
- Original v3 (nested v2) with source-validated spell + feat, independent account creation, and concurrent same-nonce requests retain one canonical grant/event/item/currency with the correct actor.
- Failed canonical feat constraint rolls back character, immutable creator capture, grant and nonce; Admin NPC and no-identity service paths remain separate; previously NULL historical grant actors are **not backfilled**.
- Current `can_edit` revocation denies cached nonce replay; a current co-editor can edit ordinary sheet notes but cannot rewrite feat authority or become grant creator.
- **NO PASS may be claimed until the exact executable-head local JWT and original PG17 workflows finish successfully.** All other live original trigger graph, real production RLS/ACL, specialized feat runtimes and P1.3 locks remain release blockers.

## Additional review decisions before any release

Even when J49+ passes, this design must undergo source/auth review for legacy player v1 and Admin NPC creation; genuine signed-in browser acceptance for all Forge tabs; full current source-catalogue/deferred equipment behavior; actual original trigger graph; CP/CS/G/I cross-character and level-up/sheet-edit contention; explicit rollback order; and GM/creator-only backstory and private `characters.secret` coordination.

Historical grant `granted_by` rows are **not reconstructed automatically**. That requires separate owner approval on whether and how archival provenance may be recovered. An original creator does not automatically prove who later granted a feat.

**Production effects: NONE.**
