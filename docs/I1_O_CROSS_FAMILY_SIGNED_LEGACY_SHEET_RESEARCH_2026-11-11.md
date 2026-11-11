# I1-O — Cross-family signed legacy-sheet collisions in shared Forge transactions

**Research only: 2026-11-11 UTC.** Base: exact I1-N [#362](https://github.com/bob8675309/DNDNEXT/pull/362) `61f7e8f109f5327049cd1dc7f62322f13e891a2b`, stacked on signed I1-M [#361](https://github.com/bob8675309/DNDNEXT/pull/361) and I1-L [#360](https://github.com/bob8675309/DNDNEXT/pull/360). Preserve all original RED specimens, owner I0–I6 integration-first program, private Story, immutable nonce, canonical source-qualified grants and NPC/merchant/world-map boundaries. **No production migration, hosted SQL, RLS/grant change, deployment, merge, or paid-agent activation.**

> **2026-11-11 verified signed research result:** All **I1O-01–07 PASS** on source/test commit `03888eb9d45ce602e4720dd97a6e629aad3d39b5`, dedicated [I1-O GitHub Actions #42959854990](https://github.com/bob8675309/DNDNEXT/actions/runs/42959854990), job `130323545289`, plus **10/10 exact-head workflows successful** on that code/test commit. I1O-02 and I1O-03 intentionally reproduce two original deployed-source cross-character account-sheet overwrites; I1O-04–07 validate *only the separately installed disposable mirror-predicate candidates*. Original production source is still unchanged. Earlier retained [#42959050249](https://github.com/bob8675309/DNDNEXT/actions/runs/42959050249) failed source DDL separator packaging after I1C–M passed; [#42959420735](https://github.com/bob8675309/DNDNEXT/actions/runs/42959420735) reproduced both NEW original REDs, then correctly failed strict scratch candidate source match because two originals use distinct spaces in the permission predicate; the candidate now handles those exact originals without source normalization. Final **documentation-inclusive** CI will be verified separately before handoff is closed.

## Source and test scope

The I1-N census identified 34 functions writing account-wide `public.players.sheet` on live PostgreSQL 17.4. I1-M demonstrated the original Artificer projection can overwrite a different character's legacy sheet despite the guarded v2 creator copy. I1-O tests **two more independent original live writer functions** in the *same* disposable signed I1-M Forge/Story/Artificer database:

| Writer / dependencies | Live source MD5 | Meaning of signed test |
|---|---|---|
| `public.adjust_character_hit_points_v1(uuid,integer,integer)` | `f855be60d971aa63e32ade327d14c369` | Signed character editor uses original HP RPC on second Artificer |
| `public.set_character_progression_v2(uuid,text,text,integer,bigint,text,text)` | `c4ea1c7993912f6b4c6fe9ee7b25343f` | Signed scratch Admin uses original Admin progression setter on second Artificer |
| `public.set_character_progression_v1(...)` | `eb467b7c7a8d548581a36cfcb0d8f77b` | Original source downstream of v2, **not** modified by candidate |
| `public.get_character_progression_v1(uuid)` | `8df340fa72ee78973e6c6616e32e1ba8` | Original source result reader, not a legacy-sheet reader |
| `public.xp_threshold_for_level_v1(integer)` | `d6111bcc35c85343df319fd5dc3d76e2` | Original progression threshold helper |
| `private.can_manage_character_progression_v1(uuid)` | `ac70e4ec033d86c4e0a254d50d429a45` | Original edit/Admin permission guard |

Source-exact bodies are captured in `scripts/fixtures/i1o_original_progression_hp_shared_forge_pg17.sql`, with **six original MD5 postconditions** and local scratch-only schema additions required by the reduced existing Forge fixture. All source bodies were retrieved via *read-only* `pg_get_functiondef` from live. The Admin actor is given Admin permissions **only in local scratch data**, and both creator and Admin RPC calls use signed local GoTrue/PostgREST. This is not evidence of deployed Admin RLS parity.

The test extension is strictly opt-in with `DNDNEXT_I1O_LOCAL_CONFIRM=DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY`, within `scripts/test_i1g_warlock_original_guards_joint_local_auth.mjs`, after all retained signed I1C–M assertions.

## Acceptance matrix — requires exact-head CI evidence

| ID | Scenario | Expected result |
|---|---|---|
| I1O-01 | Source-exact original HP/Admin/permission functions stage after signed I1M | Six original fingerprints and inherited Artificer source graph unchanged |
| I1O-02 | One signed account creates Fighter A then Artificer B; owner adjusts B HP through original RPC | **Expected SOURCE RED:** original HP writer overwrites A's nonempty account legacy sheet; canonical A remains |
| I1O-03 | Another signed account creates Fighter A then Artificer B; signed local Admin updates B progression through original v2→v1 path | **Expected SOURCE RED:** original Admin progression writer overwrites A's nonempty legacy sheet |
| I1O-04 | Scratch mirror-only candidate applied; signed owner adjusts B HP | **Candidate GREEN:** only B canonical sheet changes; A legacy sheet unchanged |
| I1O-05 | Signed local Admin updates B progression after candidate; owner retries same nonce | **Candidate GREEN:** A legacy remains, B canonical/progression valid, Story/nonce/grants inert |
| I1O-06 | B is the first (and mirrored) character on another account | Both scratch writers may still synchronize legitimate same-character legacy mirror |
| I1O-07 | Signed non-Admin progression attempt, delegated non-editor HP attempt, illegal HP value | Reject, no canonical/legacy/Story/grant mutation |

The candidate `scripts/fixtures/i1o_progression_hp_legacy_mirror_candidate_pg17.sql` installs **only after both original-source RED tests**, with strict checks that it differs from each live original by exactly one account-mirror predicate. It requires `players.sheet = '{}'::jsonb` or a matching stored immutable `sheet.meta.creationRequestId` and `characters.creation_request_id`. It does not change the original canonical character-sheet update, progression calculation, HP arithmetic, editor/Admin checks, Artificer materializer, source catalog or Story/nonce functions.

## Explicit exclusions and current blockers

- **Not** source-original player-earned `complete_character_level_up_v5`; the tested progression endpoint is the *Admin* setter v2. The complete earned-level-up original graph is more extensive and has its own protected historical P1.3 fixtures.
- **Not** source-original Barbarian rage action or short/long rest recovery; HP adjustment is the signed action representative. Further test of rest and level-up is still required before a cross-family release.
- **Not** all 34 `players.sheet` writers, full 31 Forge triggers, complete source precedence/RLS, true browser workflow, global CP/CS/G/I concurrency, owner-chosen legacy mirror authority, or encrypted offsite backup and isolated database+Storage restoration.
- **Not** an authorization to retroactively attach nonempty legacy sheets with missing creation nonce. Such rows must fail closed and receive deliberate owner-reviewed handling.
- The `private.test_admins` row exists *only* in the disposable fixture; no role grant in production. No private Story value or account ID from production was read.

**Release status:** source-exact bounded test research, **not production**. Record exact final CI logs, source RED and scratch GREEN independently. The next owned step after a successful signed run is a source-original earned level-up/rest transaction study and selected-mirror policy decision across the remaining source writers; no broad SQL rewrite until owner chooses freeze / explicit selection / deprecation.
