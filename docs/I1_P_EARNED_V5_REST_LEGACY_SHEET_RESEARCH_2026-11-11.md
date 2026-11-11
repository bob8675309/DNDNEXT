# I1-P — Signed original player-earned level-up and rest versus multiple legacy player sheets

**Research only / 2026-11-11 UTC.** This work stacks on [I1-O #363](https://github.com/bob8675309/DNDNEXT/pull/363), and continues the owner-approved [Nov 9 I0–I6 integration-first plan #348](https://github.com/bob8675309/DNDNEXT/pull/348). No hosted database, release migrations, app runtime, frontend, Vercel, world/town/tactical maps, paid agents, or unrelated PRs are changed.

## Scope

I1-O [signed results](https://github.com/bob8675309/DNDNEXT/actions/runs/42960316507) proved the original **Admin** `set_character_progression_v2` and the original HP action overwrite another character's legacy account-wide `players.sheet`; the test did **not** exercise player-earned level-up or actual rest.

I1-P uses the **existing original P1.3 earned-v5** signed PostgreSQL 17 / GoTrue / PostgREST test database, preserving its F06–F28 regression and original v5→v4→v3→base-v3 chain, original CP/CS contention tests, G/GI progression and merchant inventory tests. A *separate* I1-P signed runner executes after the original suite finishes; the original P1.3 test code and workflow remain unchanged.

Four further **exact live** functions are installed in that disposable database from read-only `pg_get_functiondef` with source-hash postconditions:

| Original source | Live MD5 |
|---|---|
| `public.complete_character_rest_v1(uuid,text)` | `fffbf0705d640a7d2bfb08aa78ad521a` |
| `private.restore_character_rest_action_state_v1(uuid,text)` | `d75edf2ac583e3790882155c702e2165` |
| `private.sync_character_spell_slots_v1(uuid)` | `6c276ab2135fb90894fd8684e39ce1c3` |
| `private.character_sheet_resource_profile_json_v1(uuid)` | `2c798f8351282d80e63ab8e9e9019272` |

The existing P1.3 original `public.complete_character_level_up_v5(uuid,jsonb)` hash stays `02d74b973a763c53c595be20e35e512f`. The two source-original legacy mirror writers used during earned-v5 are:

- `private.complete_character_level_up_base_v3(uuid,jsonb)`, MD5 `e33639d549ef557976a3970ea51f5238`
- `private.sync_player_forge_class_spell_summary_v1(uuid)`, MD5 `5b1b275a268a57591a2e35a05ce7480d`

The original rest orchestrator's Rage restoration helper is the third account-wide mirror writer in scope. None of their source-original RED functions has been modified in the source fixture.

## Test design (source RED before scratch candidate GREEN)

Real locally authenticated actors: owner, coeditor, outsider. Six separate source-shaped characters are seeded with **local privileged SQL**: owner mirror Fighter A, coeditor mirror Barbarian D, original earned-v5 Fighter B, original Rage-rest Barbarian C, and separate candidate Fighter B / Barbarian C specimens. Each character receives a scratch-only unique `characters.creation_request_id` and matching `character_sheets.sheet.meta.creationRequestId`. `players.sheet` is populated from the user's own initial A/D character, then signed RPC calls target a **different** character.

| Acceptance ID | What the signed test must demonstrate |
|---|---|
| I1P-01 | Exact original earned-v5 chain, rest orchestrator, three rest helpers, and all seven original source hashes |
| I1P-02 — SOURCE RED | Genuine `complete_character_level_up_v5` on second Fighter B overwrites both unrelated owner A and coeditor D populated account sheets; A/D canonical sheets unchanged; one earned level/history |
| I1P-03 — SOURCE RED | Genuine `complete_character_rest_v1(...,'short_rest')` on Barbarian C restores one Rage use and writes one rest log but overwrites both A/D legacy sheets |
| I1P-04 | Install exactly three independently source-locked, *disposable-only* legacy mirror predicates after both REDs; public v5 and rest orchestration remain byte-identical |
| I1P-05 | Signed earned-v5 advances B's canonical level and event once; both unrelated account mirrors remain byte-identical; duplicate level-up rejected |
| I1P-06 | Signed short rest restores C's canonical Rage use and writes one log, without touching A/D legacy sheets |
| I1P-07 | Earned level-up for mirrored A and long rest for mirrored D still update their **own matching account mirrors**, not the other editor account |
| I1P-08 | Outsider, unsupported rest, and duplicate advancement remain denied/atomic without canonical/legacy/history mutation |

The candidate requires an empty account mirror or an exact existing `meta.creationRequestId` match against `characters.creation_request_id`. **It is research evidence for three writers, not a blanket policy for 34 functions.** Its SQL verifies every original `pg_get_functiondef` hash and ensures that reverting only the new WHERE clause produces exactly the original hash. It cannot be applied to live Supabase.

## Critical limitations

- This P1.3 fixture does **not** use signed `create_player_character_v2/v3` or real private Story/nonce reservation. **Actual level-up and rest are signed**, but the characters and matching identity markers are locally seeded source-shaped rows. The separate I1-M/I1-O Forge tests cover signed creation and Story independently. Full **single-transaction original Forge+earned-v5+rest** co-residency remains unproven.
- Rest invokes exact original `complete_character_rest_v1` and original private spell-slot and Rage helpers. It exercises **non-spellcaster XPHB Barbarian Rage** short/long recovery. The reduced scratch schema has no active-encounter rest-log veto trigger or complete spell-caster catalogue. No global spell-rest, encounter isolation or source-rich catalog acceptance is claimed.
- Earned v5 uses the existing reduced **featureless Fighter 1→2** helper tails. The original live v5/v4/v3/base-v3 chain is unchanged; this does not prove every subclass/feat/Warlock/Artificer level-up.
- Lock-order, cross-writer concurrency, production RLS, all 31 Forge creation triggers, account-level migration of old nonempty sheets missing nonce, authenticated browser scenarios and encrypted offsite backup + isolated database/Storage restoration remain open.
- Owner still must choose whether legacy `players.sheet` is frozen, explicitly selected, or deprecated before proposing any coordinated I2 deployment. No release authorization is implied.

## Files and verification

- `scripts/fixtures/i1p_original_rest_shared_p13_pg17.sql`: exact four original rest functions, source hash locks, reduced scratch schema.
- `scripts/test_i1p_earned_rest_local_auth.mjs`: independent signed I1P-01–08 test, after unchanged F06–F28.
- `scripts/fixtures/i1p_earned_levelup_rest_mirror_candidate_pg17.sql`: three exact source-original private functions with mirror-only predicates, scratch-only.
- `.github/workflows/validate-i1p-earned-v5-rest-legacy-local-auth.yml`: dedicated pinned local Supabase 2.120.0 PG17 with disposable Auth, strict opt-in, complete original tests, new signed suite and cleanup.

**Acceptance pending exact-head job logs.** Do not mark the candidate GREEN merely because source files exist. Preserve all failed source-identity attempts and never weaken original RED assertions.

**Next bounded task:** verify I1P-01–08 at exact final head; then review owner decision and source-authentic concurrent rest/earned level-up permissions across the remaining account-mirror writer graph before any I2 release.
