# I1-A — Complete original Forge vs C3.3 source/trigger/fixture reconciliation

> **2026-11-09 I1-A–I1-C completed research evidence / I1-D NEXT:** SHA/source crosswalk and independent #349 original 31-trigger read-only ledger verified. Signed #350 reproduced I1B-03 changed-only private Story same-nonce failure; signed [#351](https://github.com/bob8675309/DNDNEXT/pull/351) fixed it in 11 local GoTrue/PG17 source-subset cases. [ACTIVE_WORK](ACTIVE_WORK.md) next requires exact original 31-trigger (17 staged, 14 absent) plus Stage4 inventory CHECK/four RLS source/role/deferred signed coverage. No full 31-trigger or live SQL acceptance implied.

**Dated owner integration-first research, November 9, 2026. No production action authorized.** This is an evidence and dependency audit of the independent [Forge #324](https://github.com/bob8675309/DNDNEXT/pull/324), the stacked [Forge #328–#335 terminal](https://github.com/bob8675309/DNDNEXT/pull/335), and main-based secure [C3.3 #345](https://github.com/bob8675309/DNDNEXT/pull/345). It implements the I1-A step in the [approved I0–I6 plan](PR_INTEGRATION_PRIORITIZED_PHASED_PLAN_2026-11-09.md) and complements [20 original PR dossiers](pr-integration/README.md). Preserve all original source failures and positive tests. No source equality is deployment acceptance.

## Reproducible exact-head source inventory

| Git tree | Exact source SHA | Meaning |
| --- | --- | --- |
| Current main | 9437b9d0a2bedc3ba78110c612543f6033674a72 | Already consolidated source-only Forge research; still original live player creation SQL |
| PR #324 root | f1a2c564046ab93a0bfa0732e3acc2179da9c064 | Immutable nonce, feat attribution, initial trigger/JWT work, old #321 privacy ancestor |
| PR #335 terminal | 19d7275d24d26f9641c9e6d98ea24cf9431f4d81 | Cumulative original #328–#335 source, client serializer and Chromium checks |
| PR #345 secure | 4f5f8ff7587aff1a68f21581ad68a4752789f54a | Later revised GM/creator privacy Stage1–3, Stage4 inventory, Forge Story client, official PDF, town/inventory |

GitHub's actual nine immediate PR file lists give **146 changed-path appearances and 104 unique paths** across #324 and #328–#335. Full Git trees were fetched (not truncated) and compared using exact file blob SHA. The resulting audit assets are [104-path machine SHA classification](evidence/I1_A_FORGE_BLOB_CROSSWALK_2026-11-09.json) and [all nine original incremental PR changed-file inventories](evidence/I1_A_FORGE_INCREMENTAL_PR_FILES_2026-11-09.json). Each row records original PR IDs, classification and blobs on main, #324, #335 and #345.

| Classification | Distinct paths | Safe action |
| --- | ---: | --- |
| Identical on main, terminal Forge and #345 | 65 | Already preserved as source; do not cherry-pick duplicates |
| Original source identical to main, intentionally revised in #345 | 4 | Retain newer C3.3 integration assertions |
| Missing on both main and #345 | 27 | Five no-cost audit source/workflow files plus 22 historical documents; preserve original blobs/doc provenance |
| Older branch variants conflict with newer main | 8 | Two project-health helper/validator source versions and six old handoff/registry/docs entrypoints; keep newer main |

The 22 missing historical documents have exact Git blob pins in the machine inventory. One is the original 31-trigger census required to run the static auditor and is being extracted now. **The other 21 must not be forgotten or silently classified as disposable:** preserve/source-archive them in a subsequent docs-only slice before any original PR retirement. Original PRs remain OPEN.

## Incremental Forge capabilities — not nine redundant PRs

| PR | Unique proof and connected system |
| --- | --- |
| #324 | Server immutable v2/v3 creation intent, exact original replay vs changed nonce rejection, creator and feat-grant actor attribution, alternate legacy account sheet, Background and equipment deferred COMMIT, source-valid class/feat/spell/subclass, GI/stock/currency/merchant and inventory RLS/CHECK/locking. Original 31-trigger census and JWT J-series |
| #328 | Deterministic no-model source-qualified Fighter Champion S001–S003: nonce/replay, provenance, grants, inventory, rollback. Compiler and source manifest already on main |
| #329 | Original starting-spell deferred handler, correct error ownership, malformed selection/noncaster test J154–J157 |
| #330 | XPHB Wizard 1 original 3 cantrips, 6 spellbook, 4 prepared and 2 first-level slots; underprepared rollback J158–J160 |
| #331 | Nested parent/child feature condition; Fighter Defense valid and invalid missing parent denied by ORIGINAL deferred validator J161–J163 |
| #332 | Source-original Warlock2 three Invocations, Agonizing Blast with Eldritch Blast dependent spell, grants and nested child completion J164–J166 |
| #333 | Real signed JWT original v3 with hand-built *client-shaped* source choice and no obsolete invocation parent J167 |
| #334 | Actual production pure client source-choice builder/serializer into original v3/JWT and canonical grants/stock J168 |
| #335 | Real Chromium interaction with unchanged SourceChoiceFields React: select, required child, remove stale child and reselect; J169. This is not full NewNpcModalV3 creation/browser RPC capture |

The pure seeded compilers, Warlock/Wizard fixtures, original signed-JWT tests, actual Chromium test and source validators are present with matching blobs in both main and #345, except four deliberate C3.3 changes below. Preserve their old success and *initial failed negative-control* run provenance, but do not overwrite working main code with earlier stacked branch versions.

## Four exact C3.3 source differences (inspected line by line)

| File | #345 change | Preservation rule |
| --- | --- | --- |
| scripts/fixtures/forge_creation_replay_local_auth_pg17.sql | Adds seven source lines to conditionally avoid a duplicate historical creator trigger when the new Stage3 installs its own authoritative trigger | Keep both original standalone and joined Stage3 test paths |
| scripts/validate_forge_immutable_creation_replay.mjs | Adds the private Story wrapper and Story parameter to original source assertions | Additive; original intent and negative replay assertions remain |
| scripts/validate_forge_inventory_ui_release_contract.mjs | Changes expected client creation RPC from direct v3 to create_player_character_with_private_backstory_v1 | Later security API/entrypoint, must still execute original v3 internally |
| scripts/validate_forge_seeded_warlock_child_completion.mjs | Same source expected client wrapper; Warlock/Invocation domain assertions unchanged | Keep J164–J169 source and browser coverage intact |

The two older project-health scripts on the Forge terminal differ from newer main; preserve main's version. Six old branch-local handoff, README, registry and status files must not override the current owner I0–I6 queue. This is a source-preservation reconciliation, not an instruction to discard those historical records.

## Critical cross-PR SQL, role and trigger contracts

**Original v2/v3 immutable nonce versus Stage3 private Story.** PR #324's source-locked, UNAPPLIED player creation candidate is already present on main and #345 as sql/candidates/20261105_player_creation_immutable_intent_v1.sql (Git blob 99bceee24c1718570237e70a65fe3172f4c9fbc9). Its SHA-256 request reservation hashes API version, original v3 payload, spell choices and starting-magic selections; it does **not** have a separate Story argument. PR #345's UNAPPLIED Stage3 introduces create_player_character_with_private_backstory_v1, which rejects player payload GM secrets, calls public v3 in the same transaction and inserts a separate private Story under creator authorization. Its ON CONFLICT DO NOTHING preserves later explicit creator edits on a retry.

**Combined-test hypothesis requiring proof:** When Story text alone changes under the same creation nonce, the inner #324 v3 fingerprint may be identical and Stage3 may return the original character while leaving the first Story untouched. That would not establish the owner's complete creation-intent invariant without a deliberate Story-aware outer request contract. Neither isolated green PR establishes the combined behavior. **Do not silently decide the API policy or alter public SQL before a source-locked PG17 plus genuine local GoTrue negative test.** Also preserve Stage3's explicit no-stale-overwrite behavior. This is *not* an allegation of live production impact: both SQL candidates are UNAPPLIED.

**Creator provenance and grants.** #345's Stage3 creates the server-attributed private creator identity from signed characters INSERT; its GM-only characters.secret and creator-private Story are separate. #324's source-locked, unapplied sql/candidates/20261105_forge_progression_verified_creator_seed_v1.sql (Git blob ecddcd514917a4d379d14b02477dfb41dbf44f29) sets trusted progression created_by BEFORE INSERT so immediate original feat grant materializer no longer emits NULL granted_by. Preserve original signed J39 failure baseline and J49–J62 corrected cases, including forged creator field denial, revoked coeditor, Admin NPC and historical NULL rows. Compose creator identity and progression triggers in one real transaction/fixture; do not fix historical grants through an unapproved backfill.

**Inventory and economy.** #345's Stage4 candidate replaces four RLS policies together with retirement of the obsolete NOT VALID inventory_items owner_type constraint. Existing validated check alone does not enable character-owned starting equipment, and dropping the old CHECK alone is an unsafe policy shortcut. Preserve original signed Forge owner-CHECK negative tests, merchant buy/stock two-user concurrency, equipment/currency, deferred COMMIT and rollback. No catalog, stock, recipe, inventory or Storage deletion.

**Original 31-trigger graph.** Historical source census: **19 character_progression + 4 character_sheets + 6 characters + 2 inventory_items**. Held terminal #335 research ran a **17/31 original source DDL** local fixture, leaving 14 absent. The integrated #345 tests two additional original character trigger paths in *separate joined fixtures* (cross-fixture 19/31); this is NOT a single 19/31 production-shaped environment, all-trigger real Auth acceptance, or completed global CP/CS/G/GI/I/C locking proof. Respect deferred trigger timing, original function fingerprints and exact negative rollback results.

**Role and UI authority.** Keep signed original Forge v2/v3 and later Story/CreatorBackstoryPanel, GM-only dossier, full sheet RLS, five-column narrative ACL revocation, town/merchant Profile-first/Shop, inventory, PDF and global logout cleanup as one coordinated Stage1–4 client/SQL release candidate. A test using browser-pure source serializer or a subset of React SourceChoiceFields is different from #345's ten-step rendered Forge, and neither verifies production complete 31-trigger/source catalog or SQL rollback. Do not give a coeditor, inventory-only, NPC battle controller or outsider creator Story or GM Secret access. World-map centered Profile/backdrop still requires owner visual approval before release.

## I1-A first bounded extraction and later I2 gates

The six original blob-exact files missing on main/#345 and needed for one bounded free test are being preserved on independent clean-main-based [draft PR #349](https://github.com/bob8675309/DNDNEXT/pull/349): the no-cost forge-trigger-acceptance-audit workflow, pure forge_automation_selftest and forge_trigger_audit and forge_trigger_acceptance_ledger modules, the original three-entry targeted-JWT receipt JSON and the historical 31-trigger census. **The workflow does not connect to database, run SQL, invoke models, change application runtime or grant character authority.** Its report distinguishes original DDL text, source/MD5 presence and separately receipted JWT execution; three receipts are NOT all 31 tests.

Before considering any coordinated Stage1–4 + #324 production rollout: (1) exact-head free PR #349 CI and dependency-complete ledger; (2) isolated real GoTrue/PostgreSQL17 combined source-locked v2/v3, immutable nonce plus private Story, creator feat attribution, inventory CHECK/RLS and negative/role cases; (3) original trigger matrix and all canonical catalog/stock/item preservation hashes; (4) full Next/browser/merchant/GM visibility and World Map centered Profile visual review; (5) protected second copy, tested isolated PostgreSQL and actual 340 Storage bytes recovery; (6) explicit owner merge/SQL/deployment go/no-go. No historical research PR will be closed until each of its unique source/tests/docs is positively accounted for and owner authorizes retirement.

**Status: I1-A source reconciliation documented; source-only extraction is draft pending exact-head CI. No production SQL, main merge, map, Storage or paid-agent change.**
