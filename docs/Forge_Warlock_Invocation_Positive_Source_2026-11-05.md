# J109–J116 — Positive original XPHB Warlock Invocation acquisition with market-backed Forge

**2026-11-05 research-only, held draft PR #324 stacked on #321.** This document is written **before new exact-head CI**, so J109–J116 are CANDIDATES, not PASS. The previously accepted [J103–J108 local GoTrue/PG17 run](https://github.com/bob8675309/DNDNEXT/actions/runs/42146546579) passed 4/4 workflows at head `d0cdfa544b6855aca7013b653d6b2aa2ace2c0db`. No production SQL, RLS, permissions, data, application runtime, `main`, deployment or merge is authorized.

## Source-first scope

Prior J103–J108 already installed exact original deferred `private.validate_and_materialize_player_forge_class_options_v1()` MD5 `6df5aee6f0519c9c77758d6e887ed8e4`, original `private.materialize_player_forge_source_magic_v1()` `4c35eaab8dff7d3d15b64ed71881d4a6`, and original `private.validate_player_forge_starting_magic_exactness_v1()` `ba645ad0f2c17addad0b40e0602c2ac8`. However J106 only proved a non-Warlock rejection, not successful Invocation acquisition.

The **positive** source branch specifically exercises original `class_options` handler with:
- The **read-only verified live XPHB Warlock** class catalog specimen `6792abd0-1fd9-44fb-ae4c-56c307ab791a`, level 1, Charisma casting, hit die d8, 2024 ruleset and exact `startingEquipment.defaultData`: option A gear +15gp; cash-only **option B=100 gp (10,000 copper)**.
- Three **source-original** `public.class_feature_option_catalog` option records: **Armor of Shadows** `3abe1beb-5669-46a8-9743-49a47b8de126` (no prerequisites or permanent child selection), **Eldritch Mind** `c6f61c62-d36c-4a9b-b44a-cbafd4ff47d0` (also level 1 legal), and **Devil's Sight** `391a8820-aea1-495a-a532-05f9811b14d4` (`prerequisites.minClassLevel=2`).
- Two copied **verbatim** live PG17 helper definitions: `private.xphb_warlock_invocation_count_v1(integer)` MD5 `61c83f0172b33386f0a50435c2fe1ddb` and `private.xphb_warlock_invocation_slot_level_v1(integer)` MD5 `942dd3a4e08b8874f3e42cbbb8323038`. Level 1 has exactly **one** slot acquired at level 1.
- The unchanged original signed JWT `public.create_player_character_v3` → original v2 body → source-tag and progression triggers → original class-option INSERT → deferred starting market stock/I/C, using already accepted Soldier/Lucky background/feat specimen and combined four-policy inventory RLS/obsolete CHECK **review candidate**.

The source records are seeded **only in a disposable GoTrue/PostgREST PG17 fixture**. The class catalog uses minimal table columns already present in that fixture; this is **not** full Warlock class feature/spell catalogue reproduction, full sheet UI acceptance, Warlock level 2/3 multi-slot acquisition, or all 31 original creation-adjacent triggers. The original source handler and original server price are never altered.

## Test contract, pending exact-head GitHub Actions

| Case | Genuine signed-in source operation and expected result |
| --- | --- |
| J109 | Install original live slot functions and Warlock class/options, hash-verify and prove level 1→1 slot, level 2→3 slots, original Warlock option B 10,000 copper. |
| J110 | Signed-in v3 Warlock with `sourceChoices.warlock-invocation-slot-1` selecting **Armor of Shadows** commits exactly one row in `character_class_option_grant_instances`, with the original option catalog FK, level 1, empty dependent choices, and source metadata. Verify Soldier/Lucky G/GI, deferred starting-market character-owned I, original merchant S reduction, canonical C 10,000−900=9,100 copper, one event and nonce. |
| J111 | Exact same request nonce and original source choice replays inert. Change Invocation with same nonce → `22023`, no new instance, item, currency or stock movement. |
| J112 | Signed Warlock omits required level-1 Invocation group: original class-options handler rejects **0 instead of 1 source-owned instances**, with full character/nonce/CP/CS/G/GI/classGI/I/C/S rollback. |
| J113 | Signed Warlock tries level-2 **Devil's Sight** in level-1 slot: exact handler rejects acquisition-level prerequisite, no partial creation. |
| J114 | Signed Warlock submits a fabricated Invocation option key: original catalog lookup rejects it, with rollback. |
| J115 | Signed Warlock adds an unearned permanent dependent choice to **Armor of Shadows**, whose original schema forbids it: exact handler rejects it and rolls back. |
| J116 | A second valid signed Warlock selects **Eldritch Mind**, mints exactly one distinct authoritative instance, and purchases genuine market equipment at the source price. Replaying is inert, and the earlier Armor of Shadows character's grant fingerprint is unchanged. |

For negative tests, **an error alone is not evidence**. Each check demands a specific original handler error message and identical pre/post counts across characters, nonce reservations, canonical sheets, CP, level events, G, GI, class-option instances, inventory, currency and stock. The example source packet uses `warlock-invocation-slot-1` with metadata family `eldritch-invocation`, slot/acquisition level 1 and field `invocation.selections[0].key` equal to the exact original `option_key`. UI source serialization is separately audited; this is a valid source shape under the installed original handler, **not a real browser test**.

## Installation and hard safety gate

New research paths: `scripts/fixtures/forge_warlock_invocation_original_slot_helpers_pg17.sql`, `scripts/fixtures/forge_warlock_invocation_positive_local_auth_pg17.sql`, plus appended real JWT runner assertions and strict static validator/workflow inputs. The SQL fixture only runs after J108 original CP trigger proof, after original Forge v3 market and four-policy RLS candidate, requires throwaway `postgres` PG17, local `auth.users` and `private.test_admins`, exact original class-option source handler MD5, no old owner CHECK, and no existing Warlock row; no production identifiers/credentials are embedded. Its `NOTIFY pgrst,'reload schema'` refreshes only the throwaway local REST cache.

## Release limitations and next action

A positive Warlock Invocation proves the source handler's normal level-1 class-option acquisition and the absence of a direct inventory/regression conflict **for those narrow catalog rows**. It does not prove all catalog prerequisite families, dependent cantrip/Origin feat choices, positive species/feat source-magic spells, actual Pact of the Tome runtime selection, v3 Wizard starting magic exactness, all original triggers and RLS, the #317 global lock-order contention problem, or owner/GM browser click-through. Those remain explicit release blockers.

**Single next action:** inspect exact-head J109–J116 GoTrue/PG17 CI logs, repair fixture errors without rewriting original source, then choose an owner-approved controlled browser/staging review plan. Do not merge/release; avoid documentation-only Vercel builds. Log final results on PR #324 once accepted.

**Production effects: NONE.** The public DnDWeb SQL endpoints were queried only with SELECT/metadata to capture original source and test catalog records.
