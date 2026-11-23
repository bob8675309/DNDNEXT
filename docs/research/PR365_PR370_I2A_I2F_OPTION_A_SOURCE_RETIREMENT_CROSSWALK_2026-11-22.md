# Original I2 Option A research PR #365–#370 — full-source retirement custody and continuity crosswalk

**2026-11-22 CST; verified repository `bob8675309/DNDNEXT`.** Current open draft [PR #371](https://github.com/bob8675309/DNDNEXT/pull/371) at immutable head `6db27e720d0c2788774cc37d2f85d14244e61b95` is the **single named, still-open successor**. Active source/custody documentation lives in open [PR #379](https://github.com/bob8675309/DNDNEXT/pull/379). Original #365–370 remain **OPEN** at writing until the separate closure receipt below records actual GitHub state. Research-only archive/retirement, **not** merge, deployment, RLS activation, or Option A release.

## Audit method, all 51 original immediate changed-source entries

1. Re-fetched GitHub's fully paginated immediate Files result for each source PR (all 6 pages fit one page, 51 unique PR-scoped file occurrences), plus each immutable original complete recursive HEAD tree and successor #371 complete recursive HEAD tree. **All seven tree responses non-truncated.** PR original base/source chain inherits #345 Forge/privacy research; closure **does not** rebase those held sources or declare them deployed.
2. Compared every exact original Git blob against #371 same path. **39/51 are SHA-identical** including all source SQL fixtures, signed negative tests, validators, CI workflows, research/owner decisions and per-writer ledgers. The remaining **12/51 are solely `docs/ACTIVE_WORK.md` and `docs/HANDOFF_LOG.md`**. Entire original `ACTIVE_WORK.md` byte sequence for each PR was **verified exactly once as the trailing contiguous suffix of #371's later living document**, and entire original `HANDOFF_LOG.md` byte sequence **exactly once as the leading contiguous prefix of #371's append-only handoff** (complete byte-string comparison, not a section/header search). These 12 differ at file SHA only because successor handoffs add newer history; **every original byte remains present verbatim**. Exact old blobs remain in immutable Git parent history.
3. Explicit GitHub commit ancestry `compare/<original-head>...6db27e720d0c2788774cc37d2f85d14244e61b95` returned `status=ahead`, `behind_by=0` and `merge_base_commit.sha=<original-head>` for **all six** source heads: all original commits remain on the current #371 history. No force-push, base change or branch deletion is authorized.
4. Read the six original research/decision documents and their exact signed-test harness source; inspected the actual exact-head Actions step results and the output from original local GoTrue/PostgREST/PG17 signed jobs, including **ORIGINAL expected overwrite RED before bounded scratch GREEN** and saved source-MD5 guards. Each original branch's exact-head workflows succeeded; #371 itself has **eight exact-head successful workflows**, including its four-stage inherited local signed source chain [#43328856208](https://github.com/bob8675309/DNDNEXT/actions/runs/43328856208) with I2C–I2F original negatives run again. `#371` remains a research branch and cannot promote its narrower tests as production acceptance.
5. The main/source runtime set is untouched by this review; all 51 immediate diffs in the six historical research PRs comprise **CI workflows, research docs/ledgers and disposable audit/test SQL/JS**. No changes to `pages/**`, `components/**`, `sql/**` deployed migrations, public database grants, or protected `MapPageClient.js` originate from these six immediate diffs.

**Result: 51/51 accounted, 39 exact same-path blobs and 12 full verbatim historical living-document bodies; 0 absent, 0 unresolved.** This is full original source-custody evidence, not a line-by-line production API compatibility proof.

## Per-PR original feature, test, source path and destination

### PR #365 — Option A owner decision; preserve old players.sheet bytes and 34 UPDATE+3 UPSERT survey

Original immutable HEAD `04f2bcd34b1c2935125ad2369717e10140025047`; [exact-head successful CI #42968380176](https://github.com/bob8675309/DNDNEXT/actions/runs/42968380176) (6 workflow results at original HEAD). Original negative/control boundaries: planning/read-only; no signed freeze. All 6 immediate source entries are documented below; no original body, fixture, workflow, report or owner decision removed from #371. Original research only, not production.

| Original changed file | Change | Original Git blob | #371 blob | Disposition |
|---|---|---|---|---|
| `.github/workflows/validate-i2a-option-a-freeze-plan.yml` | added | `8fe1e04f77ecf8873ffc3863ada19fcef06feb5d` | `8fe1e04f77ecf8873ffc3863ada19fcef06feb5d` | exact_copy |
| `docs/ACTIVE_WORK.md` | modified | `361abeec65358058a00bb45f1fe820d28ce507fe` | `b5dc62d7ea109e852db8e3d94bf8bcf4c75246de` | verbatim_suffix_in_successor |
| `docs/HANDOFF_LOG.md` | modified | `7901c5548fe417a44a418393665d80f6beb5de1a` | `e567b3238d2d401e6504e846b380ec9c33a00c97` | verbatim_prefix_in_successor |
| `docs/I2_A_CANONICAL_SHEETS_LEGACY_FREEZE_OWNER_DECISION_2026-11-11.md` | added | `a7f4938681cbce7dd8477a5c2f82ea840991a832` | `a7f4938681cbce7dd8477a5c2f82ea840991a832` | exact_copy |
| `scripts/audits/i2a_option_a_legacy_sheet_readonly_readiness.sql` | added | `2fd629646b81331a5e1e94bab1495ea073da62d3` | `2fd629646b81331a5e1e94bab1495ea073da62d3` | exact_copy |
| `scripts/validate_i2a_option_a_legacy_freeze_plan.mjs` | added | `6a7668bb87b56c0c4e1e46b01481c559730cd075` | `6a7668bb87b56c0c4e1e46b01481c559730cd075` | exact_copy |

### PR #366 — Three original earned/rest writer functions, I2B-01–08 signed scratch and profile-column RLS

Original immutable HEAD `e568c43ab39c759847f750f14eb4664a57a824de`; [exact-head successful CI #43026827923](https://github.com/bob8675309/DNDNEXT/actions/runs/43026827923) (6 workflow results at original HEAD). Original negative/control boundaries: P1.3/I1P original RED intact; 31/34 untested at this stage. All 9 immediate source entries are documented below; no original body, fixture, workflow, report or owner decision removed from #371. Original research only, not production.

| Original changed file | Change | Original Git blob | #371 blob | Disposition |
|---|---|---|---|---|
| `.github/workflows/validate-i2b-option-a-first-signed-slice.yml` | added | `9198cce0aa3968834bac84d54084d2e318d0c243` | `9198cce0aa3968834bac84d54084d2e318d0c243` | exact_copy |
| `docs/ACTIVE_WORK.md` | modified | `e5ed749f66bc9265174be4f4ee4b1d92c4927e15` | `b5dc62d7ea109e852db8e3d94bf8bcf4c75246de` | verbatim_suffix_in_successor |
| `docs/HANDOFF_LOG.md` | modified | `e6c3e5601994c796ec245994bf3208d1ebc37f3c` | `e567b3238d2d401e6504e846b380ec9c33a00c97` | verbatim_prefix_in_successor |
| `docs/I2_B_OPTION_A_FIRST_SIGNED_FREEZE_SLICE_2026-11-11.md` | added | `8fe402a742745cf9ca6db4daa2e6292ccd62c98b` | `8fe402a742745cf9ca6db4daa2e6292ccd62c98b` | exact_copy |
| `docs/I2_B_OPTION_A_SOURCE_WRITER_COVERAGE_2026-11-11.json` | added | `dee333f58f01df1ea08da01e7e6e8b3ded009617` | `dee333f58f01df1ea08da01e7e6e8b3ded009617` | exact_copy |
| `scripts/fixtures/i2b_option_a_first_three_writers_scratch_pg17.sql` | added | `7d2ddf2c4bee60ba63f6b5eb3e00d97b4a79e623` | `7d2ddf2c4bee60ba63f6b5eb3e00d97b4a79e623` | exact_copy |
| `scripts/fixtures/i2b_option_a_scratch_player_profile_acl_pg17.sql` | added | `d8f5cd251e4cd312815ab1e3864fefd8b62dff23` | `d8f5cd251e4cd312815ab1e3864fefd8b62dff23` | exact_copy |
| `scripts/test_i2b_option_a_first_slice_local_auth.mjs` | added | `dc9867cdce8df83678f7e9cb2ad982f486e01fc7` | `dc9867cdce8df83678f7e9cb2ad982f486e01fc7` | exact_copy |
| `scripts/validate_i2b_first_slice_scope.mjs` | added | `e31af69ed02596e7814cfbafca4f3cae7dfb503d` | `e31af69ed02596e7814cfbafca4f3cae7dfb503d` | exact_copy |

### PR #367 — Original v1/v2 creation and signup, I2C-01–10 signed creator replay/identity RED→scratch GREEN

Original immutable HEAD `963a04a9bc897e247f7e088ef5a99319c1ae3cdf`; [exact-head successful CI #43101662057](https://github.com/bob8675309/DNDNEXT/actions/runs/43101662057) (6 workflow results at original HEAD). Original negative/control boundaries: client/profile/nonce and original legacy account overwrite negatives. All 10 immediate source entries are documented below; no original body, fixture, workflow, report or owner decision removed from #371. Original research only, not production.

| Original changed file | Change | Original Git blob | #371 blob | Disposition |
|---|---|---|---|---|
| `.github/workflows/validate-i2c-creation-signup-option-a-local-auth.yml` | added | `9098cb7f5d93c1264dc79977375ea31adcb2c35c` | `9098cb7f5d93c1264dc79977375ea31adcb2c35c` | exact_copy |
| `docs/ACTIVE_WORK.md` | modified | `3966550696e97e5fd0cecb4c0fd52dc551e9c607` | `b5dc62d7ea109e852db8e3d94bf8bcf4c75246de` | verbatim_suffix_in_successor |
| `docs/HANDOFF_LOG.md` | modified | `f75e220622039519a6e0a8c8ce715e4393b9d87e` | `e567b3238d2d401e6504e846b380ec9c33a00c97` | verbatim_prefix_in_successor |
| `docs/I2_C_OPTION_A_CREATION_SOURCE_WRITER_COVERAGE_2026-11-11.json` | added | `7b5867aba9cb6daf0f4f6ac0eee64735b99bb2c7` | `7b5867aba9cb6daf0f4f6ac0eee64735b99bb2c7` | exact_copy |
| `docs/I2_C_OPTION_A_CREATOR_SIGNUP_SIGNED_RESEARCH_2026-11-11.md` | added | `4287196fbcbc6241d9bded2d02c35e84db0acd9b` | `4287196fbcbc6241d9bded2d02c35e84db0acd9b` | exact_copy |
| `scripts/fixtures/i2c_option_a_creator_identity_only_scratch_pg17.sql` | added | `c9957a542055ba5aea6e28402c8bc8b6469dcfa7` | `c9957a542055ba5aea6e28402c8bc8b6469dcfa7` | exact_copy |
| `scripts/fixtures/i2c_option_a_signup_profile_acl_scratch_pg17.sql` | added | `4a3b270b1f303698737d5bf2b321eb063a93c481` | `4a3b270b1f303698737d5bf2b321eb063a93c481` | exact_copy |
| `scripts/fixtures/i2c_original_creation_signup_shared_forge_pg17.sql` | added | `1717bbac40bb4f53c87857675bf70c7181982c34` | `1717bbac40bb4f53c87857675bf70c7181982c34` | exact_copy |
| `scripts/test_i2c_option_a_signed_creation_profile.mjs` | added | `4992c7b6d91b3f4682d31c61ad88071136dad298` | `4992c7b6d91b3f4682d31c61ad88071136dad298` | exact_copy |
| `scripts/validate_i2c_creator_source_coverage.mjs` | added | `7e22c35f3b8d188c68327304ef037aff7555171d` | `7e22c35f3b8d188c68327304ef037aff7555171d` | exact_copy |

### PR #368 — Original private v2→v3 Story empty-snapshot overwrite RED and signed I2D-01–11

Original immutable HEAD `88a39d5e7a888dc63ebe53736aa2734a480442ac`; [exact-head successful CI #43144187884](https://github.com/bob8675309/DNDNEXT/actions/runs/43144187884) (5 workflow results at original HEAD). Original negative/control boundaries: private Story, same/changed nonce and invalid Story rollback. All 8 immediate source entries are documented below; no original body, fixture, workflow, report or owner decision removed from #371. Original research only, not production.

| Original changed file | Change | Original Git blob | #371 blob | Disposition |
|---|---|---|---|---|
| `.github/workflows/validate-i2d-private-v3-story-option-a-local-auth.yml` | added | `d9dfb8ef4f343a4fc18dfed548a165462b70ce6e` | `d9dfb8ef4f343a4fc18dfed548a165462b70ce6e` | exact_copy |
| `docs/ACTIVE_WORK.md` | modified | `9a6187a1de03844001e1182e05341a4760698a6c` | `b5dc62d7ea109e852db8e3d94bf8bcf4c75246de` | verbatim_suffix_in_successor |
| `docs/HANDOFF_LOG.md` | modified | `9a05d6b24695ab5f8a95b9d6d1704787b2a88564` | `e567b3238d2d401e6504e846b380ec9c33a00c97` | verbatim_prefix_in_successor |
| `docs/I2_D_OPTION_A_CREATION_SOURCE_COVERAGE_2026-11-11.json` | added | `5848fd601f932da387f2fe119f1eaf3f988e44eb` | `5848fd601f932da387f2fe119f1eaf3f988e44eb` | exact_copy |
| `docs/I2_D_PRIVATE_V3_STORY_OPTION_A_SIGNED_RESEARCH_2026-11-11.md` | added | `ac31f15b826459ba3cab2c3ba0a8388b816967ef` | `ac31f15b826459ba3cab2c3ba0a8388b816967ef` | exact_copy |
| `scripts/fixtures/i2d_option_a_private_forge_source_scratch_pg17.sql` | added | `889b661aef1317ca91a44eeac2d2ef7238d8cad6` | `889b661aef1317ca91a44eeac2d2ef7238d8cad6` | exact_copy |
| `scripts/test_i2d_private_v3_story_option_a_local_auth.mjs` | added | `ff6530fe32d6e64418e60e69b910a5ca7da4a3f4` | `ff6530fe32d6e64418e60e69b910a5ca7da4a3f4` | exact_copy |
| `scripts/validate_i2d_source_coverage.mjs` | added | `da3ab2fff3ee9e4a311e5ccce157e68a30c3c88b` | `da3ab2fff3ee9e4a311e5ccce157e68a30c3c88b` | exact_copy |

### PR #369 — Original HP, Admin progression and Rage RED, scratch GREEN I2E-01–11

Original immutable HEAD `1132a33b64e24197e974276cd58c48cbdded3baa`; [exact-head successful CI #43146817415](https://github.com/bob8675309/DNDNEXT/actions/runs/43146817415) (6 workflow results at original HEAD). Original negative/control boundaries: Rage source shape locally synthetic, not a signed Barbarian Forge. All 9 immediate source entries are documented below; no original body, fixture, workflow, report or owner decision removed from #371. Original research only, not production.

| Original changed file | Change | Original Git blob | #371 blob | Disposition |
|---|---|---|---|---|
| `.github/workflows/validate-i2e-hp-admin-rage-option-a-local-auth.yml` | added | `2b983deb3903909255abf0c9d0c5ecca51c0eb8d` | `2b983deb3903909255abf0c9d0c5ecca51c0eb8d` | exact_copy |
| `docs/ACTIVE_WORK.md` | modified | `3c39881afad7cfac4eac37fb5b81e36d73721c4a` | `b5dc62d7ea109e852db8e3d94bf8bcf4c75246de` | verbatim_suffix_in_successor |
| `docs/HANDOFF_LOG.md` | modified | `6d15561453661fe560bdb6e77c002403643978cb` | `e567b3238d2d401e6504e846b380ec9c33a00c97` | verbatim_prefix_in_successor |
| `docs/I2_E_HP_ADMIN_RAGE_OPTION_A_SIGNED_RESEARCH_2026-11-11.md` | added | `356101659b7c2a069c1f97ae2042f5db27e8b952` | `356101659b7c2a069c1f97ae2042f5db27e8b952` | exact_copy |
| `docs/I2_E_OPTION_A_ACCOUNT_WRITER_COVERAGE_2026-11-11.json` | added | `fc78cb2883056da07d3f5399eca269e27aedaf4b` | `fc78cb2883056da07d3f5399eca269e27aedaf4b` | exact_copy |
| `scripts/fixtures/i2e_option_a_hp_admin_rage_scratch_pg17.sql` | added | `e2fe6a15007b8db786c0f3dc04389630b5de04df` | `e2fe6a15007b8db786c0f3dc04389630b5de04df` | exact_copy |
| `scripts/fixtures/i2e_original_hp_admin_rage_shared_forge_pg17.sql` | added | `1fc10f9ef53bf219ed42a2f8ec6d57de7c4899ea` | `1fc10f9ef53bf219ed42a2f8ec6d57de7c4899ea` | exact_copy |
| `scripts/test_i2e_signed_hp_admin_rage_option_a_local_auth.mjs` | added | `43e87b4de5ed368fd18a583f22187c23100cce52` | `43e87b4de5ed368fd18a583f22187c23100cce52` | exact_copy |
| `scripts/validate_i2e_hp_admin_rage_scope.mjs` | added | `611edac587f4a9fcd390cd2ddef08c1abf0b4399` | `611edac587f4a9fcd390cd2ddef08c1abf0b4399` | exact_copy |

### PR #370 — Original private sourceChoices/species runtime helpers RED→scratch GREEN I2F-01–11

Original immutable HEAD `ea43938da626292cb7b3f8f8459955b426874f9d`; [exact-head successful CI #43151321103](https://github.com/bob8675309/DNDNEXT/actions/runs/43151321103) (6 workflow results at original HEAD). Original negative/control boundaries: helpers invoked by privileged local SQL, not directly signed RPCs. All 9 immediate source entries are documented below; no original body, fixture, workflow, report or owner decision removed from #371. Original research only, not production.

| Original changed file | Change | Original Git blob | #371 blob | Disposition |
|---|---|---|---|---|
| `.github/workflows/validate-i2f-source-species-option-a-local-auth.yml` | added | `19a8ea0d6432a7a13fbfc0838dcf87906874886d` | `19a8ea0d6432a7a13fbfc0838dcf87906874886d` | exact_copy |
| `docs/ACTIVE_WORK.md` | modified | `3e9375b3f6a456219e6c70c2c01a4b2355788c04` | `b5dc62d7ea109e852db8e3d94bf8bcf4c75246de` | verbatim_suffix_in_successor |
| `docs/HANDOFF_LOG.md` | modified | `aa1ea66f9d392bd7fdaed8e582888faea7dfc1b9` | `e567b3238d2d401e6504e846b380ec9c33a00c97` | verbatim_prefix_in_successor |
| `docs/I2_F_ACCOUNT_WRITER_COVERAGE_2026-11-11.json` | added | `5914cb954904e11f3b127cca5b20c422f1197dbc` | `5914cb954904e11f3b127cca5b20c422f1197dbc` | exact_copy |
| `docs/I2_F_SOURCE_SPECIES_PROJECTION_OPTION_A_SIGNED_RESEARCH_2026-11-11.md` | added | `fe089ca30cb74b231cbaaa291502a6d79ff3cd4d` | `fe089ca30cb74b231cbaaa291502a6d79ff3cd4d` | exact_copy |
| `scripts/fixtures/i2f_option_a_source_species_projection_scratch_pg17.sql` | added | `1719715b85f0c1f3f7fc8a99860e22cdda188ad7` | `1719715b85f0c1f3f7fc8a99860e22cdda188ad7` | exact_copy |
| `scripts/fixtures/i2f_original_source_species_projection_shared_forge_pg17.sql` | added | `4662370011a7084a888a861f98f42daca7c689d0` | `4662370011a7084a888a861f98f42daca7c689d0` | exact_copy |
| `scripts/test_i2f_source_species_projection_option_a_local_auth.mjs` | added | `e4ef3f7a0987ece78fe525740dc63ed961eff20d` | `e4ef3f7a0987ece78fe525740dc63ed961eff20d` | exact_copy |
| `scripts/validate_i2f_private_projection_coverage.mjs` | added | `4cb9c3720797e1307353c3bda15c750a53c089cc` | `4cb9c3720797e1307353c3bda15c750a53c089cc` | exact_copy |


## Historical proof and unresolved release contracts

- Original source-verified Option A decision: **`public.character_sheets` per-character canonical; `public.players.sheet` historical account snapshot frozen, both empty and nonempty, including same-character actions.** Preserve `players.name` profile editing, current auth and creator rights, source Story/nonce, sourceChoices/materializer, earned features, inventory and 19 existing tactical spell adapters. Do not silently reinstate previous I1-O/P same-character mirror GREEN as current intended Option A behavior.
- Original source REDs: signed v1 account name+sheet overwrite and v2 sheet UPSERT, private copied v2/v3 empty-snapshot Story creation, signed HP/Admin-v2/Rage cross-user account mirrors; private source/species helpers under **privileged local invocation on signed-created characters**, not directly signed helper RPCs. All are retained in exact original test source, original PR Actions logs, descendant #371 file tree and signed run. Do **not** characterize original RED as a failed research outcome: a passing negative reproduction is evidence.
- Positive scratch GREEN and bounded scope remain honestly separated: #366 three source-writer local freeze, #367 identity-only v1/v2, #368 private v3/Story copy, #369 HP/Admin/Rage (synthetic Rage sheet), #370 source/species private local SQL. #371 extends held I2-G/H/I; historical latest tested **12 of 34** original UPDATE families, **22 not yet bounded-tested**, three original INSERT/UPSERT and copied-private/dynamic writer contracts distinct. These counters are from dated original research, not an assertion of current production data.
- No claim that all I2B–F suites reran on every original/successor head unless specifically logged. They retain source-exact original CI at respective heads and #371 inherited [#43328856208](https://github.com/bob8675309/DNDNEXT/actions/runs/43328856208). Remaining 31 original Forge trigger full graph, real multi-character browser, current role-equivalent Admin/GM/DM revalidation, direct and indirect account-sheet consumer audit, cross-command concurrency/nonce, full production ACL/feature tests and **independent encrypted PG17 + all 340 Storage object bytes restored** remain HOLD.
- **Research-only closure conditions:** The owner expressly prioritizes reducing draft backlog after complete source/test/decision preservation. If closing #365–370, close each **UNMERGED** with its original branch/immutable source commit intact. Keep **#371 open** as their exact inherited source successor, plus #379 as this audit. Closing #370 cannot remove `research/i2f-source-species-projection-option-a-freeze-20261111`, which remains #371's base branch. Before future #371 merge/retirement, separately audit its own 24 immediate files, inherited full security/Forge graph, current main compatibility and real release gates. Do not imply that closing a draft is shipping gameplay.
- **DO NOT** merge to `main`, execute hosted SQL (even SELECT), edit protected world map or Town, manipulate Storage, rebase/force-push, delete branches, run paid agents or deploy.

## Actual GitHub closure receipt

Pending GitHub status recheck and conditional safe `state=closed` (no merge). **Append real closed timestamps/HEAD/ref/remaining count here only after GitHub confirms.** All original parent/source and tests must remain addressable.
