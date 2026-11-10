# I1-G — Original XPHB Warlock legacy-invocation guard + normalized validator

**DRAFT RESEARCH ONLY. No production SQL, application runtime change, world-map modification, original PR closure or main merge.** Stacked after the source-authentic [I1-F #354](https://github.com/bob8675309/DNDNEXT/pull/354) on the owner-approved [November 9 I0–I6 original PR integration plan](PR_INTEGRATION_PRIORITIZED_PHASED_PLAN_2026-11-09.md). Keep #325 last with paid use OFF.

## Source-provenance and trigger semantics

`scripts/fixtures/i1g_warlock_original_functions_pg17.sql` contains three **unchanged original** functions captured via **SELECT-only `pg_get_functiondef`** from DnDWeb PostgreSQL 17, and fails closed if original `md5(pg_get_functiondef)` drifts.

| Original `private` source | MD5 |
|---|---|
| `reject_unmarked_legacy_warlock_invocations_v1()` | `631fbb585f47e71a619ca8ac8e212407` |
| `validate_existing_normalized_warlock_invocations_v2()` | `4f1752db655b6ba490113f604c7583ef` |
| `xphb_warlock_invocation_count_v1(integer)` | `61c83f0172b33386f0a50435c2fe1ddb` |

Preexisting original `normalize_player_choice_name_v1(text)` (MD5 `dd8cdd5b47efe99b1cfff9c2bf7635dd`) is also required and hash-verified. Both trigger names, events, and deferrable timings were independently read-only verified against live `pg_get_triggerdef`:

- `character_progression_reject_unmarked_legacy_warlock_invocation` — AFTER INSERT OR UPDATE OF `class_id,class_level,level_choices`, **DEFERRABLE INITIALLY DEFERRED**.
- `character_progression_validate_player_forge_class_options_v2` — AFTER UPDATE OF `class_id,class_level,level_choices`, **DEFERRABLE INITIALLY DEFERRED**.

**Critical limitation:** The original normalized validator is **UPDATE-only**. This test does **not** install the separate source-owned Invocation acquisition/materialization trigger. Signed Forge creates Warlock character/Story/nonce; canonical invocation rows are subsequently injected **only by privileged disposable SQL**, then validated through the source-original deferred UPDATE validator. A creation without the acquisition materializer has zero normalized invocation rows and must never be mislabeled production-accepted. Full initial creation/acquisition is a later mandatory release gate.

## Original data provenance and scope

`scripts/fixtures/i1g_warlock_invocation_joint_setup_pg17.sql` requires the existing successful local I1-F PostgreSQL 17 + real GoTrue/PostgREST environment and Stage4 four RLS/owner CHECK. It adds the production-original XPHB Warlock class identifier and source-backed starting equipment options (package **B = 10,000 copper**) and exact source-owned level1/2/5 progression data. Sixteen live-catalog XPHB Eldritch Invocation **IDs, keys, repeatable flags, level/prerequisite JSON and dependent-choice schemas** were read SELECT-only. The real Warlock cantrip identifiers include XPHB Eldritch Blast and Poison Spray, and XPHB Origin feat samples include Alert and Lucky. The original private legacy compatibility table shape (character PK/FK + `recorded_at`) is reproduced in private.

**Reduced test dependencies (not real production parity):** original `class_feature_option_catalog`/normalized grants are expanded only from I1-F's minimal tables; `character_option_catalog_preferred` is a scoped source-XPHB security-invoker view, not the entire live version-preference policy; the existing `public.is_preferred_spell_version_v1` remains the bounded test placeholder, not true PHB/XPHB source arbitration; `character_option_grant_instances` is a reduced privilege-locked test row shape without all original feature materializers or RLS. **Original two Warlock handlers and count function are unchanged**, not simulated. Public reduced tables have direct authenticated INSERT revoked and RLS enabled for new grants.

## Signed and deferred source-original test matrix

`scripts/test_i1g_warlock_original_guards_joint_local_auth.mjs`, CI `.github/workflows/validate-i1g-warlock-original-local-auth.yml`, pins Supabase CLI `2.120.0`, Node 22, localhost GoTrue and PostgreSQL17 with *I1-G-only* API/db/shadow ports **55621 / 55622 / 55620**. It reruns actual signed original-source I1C, I1D, I1E and I1F suites **before** I1G tests in the same disposable DB.

| Case | Source-original acceptance contract |
|---|---|
| I1G-01 | Signed new Warlock with only unmarked legacy `classFeatureChoices` Invocation bucket rejected at deferred COMMIT, character/Story/nonce rolled back |
| I1G-02 | Signed lvl1 source-owned Warlock, original guard positive; explicitly privileged Pact of the Blade grant, valid deferred UPDATE, inert identical Story nonce, changed-only Story rejected |
| I1G-03 | Signed lvl2 source-owned Warlock; **privileged scratch** original-catalog three normalized grants and valid deferred UPDATE; identical nonce inert |
| I1G-04 | Delete one grant + UPDATE, original count validator rejects at COMMIT, deletion rolls back |
| I1G-05 | Duplicate nonrepeatable canonical Invocation rejected and rolled back |
| I1G-06 | Level5 Thirsting Blade at lvl2 rejected by original `minClassLevel` |
| I1G-07 | Privileged five-instance attempted lvl5 upgrade, missing required Pact of Blade for Eldritch Smite, rejects and rolls back class level + every grant |
| I1G-08 | Valid XPHB Warlock damage cantrip child accepted; malformed UUID and Wizard-only cantrip rejected |
| I1G-09 | Repeatable Agonizing Blast with same child spell rejected, distinct two original Warlock spell IDs accepted |
| I1G-10 | Lessons of the First Ones Origin-feat child requires both source-valid feat and matching class-option-owned grant; privileged positive specimen, missing-grant negative |
| I1G-11 | Unmarked retroactive legacy bucket rejected; source-original private server legacy marker permits existing valid record without losing normalized grants |
| I1G-12 | Changing class while retaining Invocation grants rejected at deferred COMMIT |
| I1G-13 | Outsider signed nonce replay and direct forged-grant privileges denied; original Wizard/Battle Master and Stage4 four-policy source hashes intact |
| I1C/I1D/I1E/I1F | All prior genuine signed private Story/nonce, deferred Forge gear/currency, Stage4 CHECK/four RLS, Wizard Signature, Battle Master, creator/outsider/Admin/rollback regression preserved |

The adversarial postcreation updates and acquisition inserts are **local privileged psql transactions**. They exercise original deferred validation integrity and rollback, **not** an assertion that signed browser users may edit canonical grants directly. Newly introduced reduced public tables have RLS enabled and direct client grants revoked.

## Original 31-trigger source ledger

Unchanged #349 census: 31 original noninternal triggers across `character_progression`, `character_sheets`, `characters`, `inventory_items`; 17 original DDLS were staged in separate Forge fixture files, and 14 were historically absent. I1-D has three extra original C3.3 trigger signed tests, I1-E one Wizard finalizer, I1-F **two** Battle Master safeguards, and I1-G **two** Warlock safeguards. **Only after exact-head I1-G CI actually passes**, those eight of the historical 14 may be described as separately joined-tested. Two remaining original world-map motion/rest triggers remain protected and **four other non-map original handlers** still require exact source/dependency coverage. This is **NOT** a combined 25/31 signed database test, not all original feat/grant/schema/option/catalog protections, not full 31/31, and not production deployment approval.

Original all-PR integration, source-preferred PHB/XPHB catalogs, complete Warlock acquisition, entire original 31-trigger coexistence, CP/CS/G/I deadlock and races, genuine full 10-step Forge Chromium, second encrypted backup and isolated full PostgreSQL+340 Storage-byte restore remain mandatory. No authorization to merge/close drafts, migrate hosted SQL, change world map or activate paid agent.
