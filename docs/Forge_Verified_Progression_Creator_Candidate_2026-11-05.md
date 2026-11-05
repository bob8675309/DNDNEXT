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

## P1.3 original Admin CP/CS race — separate research, not fixed here

[Held #317 exact-original PostgreSQL17 run 42049546692](https://github.com/bob8675309/DNDNEXT/actions/runs/42049546692) **SUCCESS**, tested source SHA `c7ba39df492bce3b64a5547aa1da0fbaee10aefa`. F04 reproduced a PostgreSQL **40P01** collision between deployed `public.set_character_progression_v1` (**CP first, then CS**) and the original CS AFTER UPDATE `private.sync_character_progression_from_sheet_v1` (**CS first, then CP**) under a test-only CP row prelock/sleep. F05 synthetic CP-first ordering control completed without deadlock. [Full original-source lock and fixture report](https://github.com/bob8675309/DNDNEXT/blob/docs/p1-3-global-lock-order-design-20261101/docs/P1_3_Admin_Progression_Sheet_CP_CS_Race_2026-11-05.md).

This verified-source inversion **predates** this creator candidate. The new `seed_verified_forge_progression_creator_v1` is `BEFORE INSERT` on CP **only** and is **not invoked** by F04's existing-row CP UPDATE path. **No creator-seed source was installed in the #317 F04 test**, so this observation neither invalidates J49–J62's isolated actor-binding success nor grants a global lock-order acceptance. Real signed-in player level-up/GM coediting, all 24 omitted original Forge triggers, source grant G/inventory I paths and production ACL/RLS/browser acceptance remain separate release gates. Do not merge/release until a coordinated P1.3 lock solution is tested.

## P1.3 authenticated player level-up v5 CP/CS race — separate source proof

[Held PR #317 genuine local JWT + PG17 CI 42055043840](https://github.com/bob8675309/DNDNEXT/actions/runs/42055043840) **SUCCESS** at executable SHA `d09b3981f04ceceb09ff0a1489f589041a441164`. Original deployed **`complete_character_level_up_v5` → v4 → v3 → `complete_character_level_up_base_v3`** (plus original permission helper and sheet-sync functions, 7 source MD5s runtime verified) handles an authorized Fighter level 1→2 under real GoTrue authentication. Signed-in outsider/revoked editor deny, and under an explicitly **test-only CP prelock/advisory marker plus CS hold**, two genuinely signed-in owner/coeditor calls cause PostgreSQL `40P01` in the original **CP→CS vs CS→CP** source path (F10), one transaction aborted, no duplicate completion event after retry. Natural unforced concurrency also completed in an earlier run; the timing fixture does not prove production frequency. [Source/fixture/limits report](https://github.com/bob8675309/DNDNEXT/blob/docs/p1-3-global-lock-order-design-20261101/docs/P1_3_Player_Levelup_V5_Signed_Editor_CP_CS_Race_2026-11-05.md).

This is distinct from [held #324's JWT-tested creator seed J49–J62](https://github.com/bob8675309/DNDNEXT/pull/324), which runs **only on CP INSERT** and therefore does **not** participate in or correct a later level-up **CP UPDATE** versus coeditor **CS UPDATE** inversion. F10 did **not** install the #324 seed or integrate original feat grant G/inventory I; specialized progression helpers were limited to a no-options Fighter level2 and editor-only local RLS, not full production behavior. The combined global row-lock, current authorization, rollback and migration policy remain a blocker. No held code was merged between branches, deployed, or applied to DnDWeb.
