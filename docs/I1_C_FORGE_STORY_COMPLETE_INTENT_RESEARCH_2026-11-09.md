# I1-C — Creator-private Story included in immutable Forge creation intent (signed research)

**Status: source/test candidate only. NOT installed, merged, or deployment-approved.**
Follow [I0–I6 original-PR integration](PR_INTEGRATION_PRIORITIZED_PHASED_PLAN_2026-11-09.md) on draft #348. This independent source-only candidate is stacked on [I1-B #350](https://github.com/bob8675309/DNDNEXT/pull/350), which is itself stacked on [secure NPC C3.3 #345](https://github.com/bob8675309/DNDNEXT/pull/345). It does NOT discard any original #324/#328–#335 fixture, nor does it close a historical PR.

## Verified signed RED-to-GREEN result — November 9 local / November 10 UTC

**SUCCESS at source/test head `3a71ba7ea03ef98a868994eb56f686819398190d`.** [Exact-head original signed PG17/GoTrue Actions run 42753688755](https://github.com/bob8675309/DNDNEXT/actions/runs/42753688755) completed **five successful checks and one skipped Supabase Preview**, including original source validation, handoff registry, preservation, and new `story-complete-intent-signed` job. Disposable local services were shut down. No hosted Supabase was contacted.

- **I1C-03 RED-to-GREEN:** previously confirmed #350 I1B-03 changed-only private Story under same nonce now rejects with `22023`, returns no stale canonical ID, and does not modify Story; only opaque final nonce SHA256 is stored.
- **I1C-01/02/04/05/06 PASS:** signed original Forge/creator attribution and one-row creation; altered base intent and cross-account denied; legitimate identical retry after later Story edit is inert; overlong Story atomically rolls back both character and reservation; revoked editor denied.
- **I1C-07/08/09/10/11 PASS:** original public v3 unchanged, old/new mixed API nonce incompatibility fails closed, client cannot forge internal digest marker, two concurrent changed-Story calls yield exactly one creation/one rejection, concurrent identical calls yield one canonical result, NULL/blank Story canonicalizes consistently.
- **Limit:** The test invokes the source-original Forge v2/v3 and source-verified SQL through genuine local GoTrue/PostgREST against a reduced disposable PG17 schema. This is **not** the complete 31/31 original trigger environment, Stage4 inventory CHECK/RLS join, full ten-step browser, verified isolated backup restore or production release. No hosted data, code or permissions changed.

**ONE NEXT TASK (I1-D):** inventory all 31 original trigger definitions (17 previously present, 14 absent in the original scratch environment), then compose the exact missing original trigger/source dependencies and #345 Stage4 inventory CHECK + four RLS policies into an isolated signed Forge/Story integration fixture. Do not bulk-install SQL into production or silently replace original triggers. Preserve old positive/negative control receipts, source fingerprints and current creator/nonce semantics.

## Confirmed baseline defect and security contract

The genuine signed local GoTrue/PostgREST/PG17 [I1-B run 42740333918](https://github.com/bob8675309/DNDNEXT/actions/runs/42740333918) reproduced I1B-03: #324's reservation digest covers public v3 payload/spell/magic, not the separately supplied #345 Story text. Under the same nonce, an altered Story returned the prior character and was silently discarded by #345's intentional `ON CONFLICT DO NOTHING`. This is a complete-intent **failure**, even though all I1-B characterization checks were green.

The required invariant is: **same nonce and genuinely identical complete submitted intent returns the same canonical character with zero writes; changed Story or other content rejects before returning a character; post-creation explicit edits are never overwritten by a stale retry.** Unauthorized callers, forged grant/creator data and legacy unverifiable nonce retries remain denied; GM-only `characters.secret` stays separate from creator Story.

## Proposed bounded source design (research, not a live migration)

- `sql/candidates/20261109_player_story_complete_intent_i1c_research.sql` is a deliberately **UNAPPLIED, disposable-only candidate**, guarded for PG17, existing #345 privacy Stage1–3 and #324 source/nonce reservations. It does not create a Supabase migration.
- Public `create_player_character_v2` and public `create_player_character_v3` remain **unchanged**, including the original #324 function, source-validated internal v2/v3 and original reservation, completion, lock order and fail-closed replay semantics.
- The new PRIVATE helper takes the actual Story text, canonicalizes blank input to absent Story, calculates a SHA256 on an unambiguous versioned JSONB representation of nonempty Story, and adds its **hash** as a reserved field to a **transient copy** of the original payload. The existing `private.reserve_player_creation_intent_v1` hashes the augmented payload into its ONE already-private `intent_sha256` reservation row. **Neither Story text nor direct Story digest is stored in that row; client cannot supply the reserved field.** Actual original v3 receives the **unchanged payload** and runs through source-original private Forge v3, so no Story key can seep into characters/sheets, inventory or spells.
- Creation and completion occur inside the same original nonce reservation transaction. A competing direct-v3 or different-Story call with the same nonce reaches the same row lock and is rejected on changed digest/creation API, not silently accepted. The private helper has explicit authenticated EXECUTE, anon/PUBLIC revoked, authenticated `auth.uid()` and GM-secret checks, pinned search_path and no exposed `public` RPC endpoint. This definer bridge deserves an explicit security and PostgREST-exposed-schema review before production.
- The public Story wrapper remains `SECURITY INVOKER` and inserts the creator Story via the existing `character_backstory_secrets` RLS and creator-role check, in the **same PostgREST transaction**. `ON CONFLICT DO NOTHING` preserves a later authorized edit after an identical old creation retry. Failed Story length/RLS/trigger mutations roll back character, nonce and creator attribution.
- Source-compatible nonce-less original-v3 creation remains possible, but such calls inherently do not promise idempotent replay. Normalize NULL or wholly blank Story to no Story; preserve exact nonblank text including whitespace for intent equality. Mixed pre/post wrapper client versions and direct v3 against a Story nonce **fail closed**, so client cutover must be coordinated.

## Real source and test matrix

`scripts/test_i1c_forge_private_story_nonce_local_auth.mjs` is derived from #350's original signed test and runs only with explicit local CI environment identity: `127.0.0.1:54321/54322`, `postgres` PG17, `DNDNEXT_I1C_LOCAL_CONFIRM=DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY`. CI uses pinned Supabase CLI `2.120.0`, GoTrue-issued JWT, and source-original SQL held candidates; it does not write to any hosted project.

| Case | Required expected behavior |
|---|---|
| I1C-01/02 | Signed original creation, one sheet/Story/nonce/trusted creator; changed base payload and foreign nonce rejected |
| I1C-03 | **Red-to-green**: changed-only Story, same nonce yields `22023`; Story remains unchanged; nonce row stores only opaque hash |
| I1C-04 | True identical retry after explicit creator edit returns original without clobbering later Story |
| I1C-05 | Invalid Story length fails and rolls back original character, sheet and nonce |
| I1C-06 | Revoked creator/editor replay is denied; no new grants or Story mutation |
| I1C-07 | Direct original public v3 and Story wrapper cannot replay each other's original nonce |
| I1C-08 | Client-supplied reserved Story digest field is rejected |
| I1C-09/10 | Two genuine concurrent signed sessions/requests: conflicting Story gives one creation/one `22023`; identical Story gives one canonical character |
| I1C-11 | NULL and wholly blank Story normalize to the same empty intent |

**Source checks:** Original source v2/v3 MD5s are confirmed before staged SQL; original #324 public wrappers and inner source function SHA/MD5 are checked unchanged after this candidate. Real Auth role-claims from local GoTrue, table/RLS privileges and creator attribution are tested rather than mocked. Prior I1-B negative and original-source failures remain preserved unmodified on their own PR.

## Explicit limitations and release gates

This is a *targeted original-source subset*, NOT full original 31-trigger acceptance. Historic 17/31 original trigger definitions staged, 14 missing; separate C3.3 fixture adds two original paths only across tests. PR #345 Stage4 inventory CHECK/four-policy replacement, source-original 31/31 trigger scope, full ten-step Forge/print/merchant/town browser, old-v3 client cutover, nonces from previously created live characters, race among mixed-version clients, and protected database/Storage recovery are independent blockers. Even a GREEN test is **not** a go/no-go for production SQL, user data or PR retirement.

**NEXT after exact-head CI:** review every failing assertion and fix only the bounded candidate; verify source/role/lock contracts and add original 31-trigger/Stage4 fixtures before I2. Owner approval required for any main merge, coordinated migration, Vercel deployment, world-map UI change, and PR retirement. Paid agent #325 stays disabled and scheduled last.
