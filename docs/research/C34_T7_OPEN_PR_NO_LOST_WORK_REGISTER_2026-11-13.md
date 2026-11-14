# C34 T7 — open PR register and original source-file preservation inventory

**Timestamp:** November 13, 2026. **Read-only GitHub snapshot** at main `6637b14f807ebec79542deb7eef4b2bc3abfb5fd` and C34 T7 signed code HEAD `9cdf11bdd63a5e214b90939b574ce74216494565`. All eight Git trees (current main and C34, three original PR heads and their three base refs) were retrieved recursively and verified **not truncated**. The head of #379 and all numbers below are frozen at this snapshot; inspect anew when a PR advances.

**Merge rule:** All **44 current open PRs are drafts**. C34 closed **zero**, merged **zero**, and crossed off **zero**. Keep the entire original branch/HEAD untouched and assign each source-file contribution a proven `exact_copy`, `behavioral_successor_verified`, `deferred_preserved`, `superseded_with_source_test`, or `unresolved_blocker` disposition before retirement. This is a raw **Git SHA inventory, NOT feature-semantic signoff**; follow [mandatory full-PR acceptance protocol](../PR_FULL_SCOPE_REVIEW_PROTOCOL.md). A green signed fixture does not permit a production release.

## All open PRs — no exclusions

| PR | Original title | Immediate base branch | Full HEAD SHA | Current disposition |
|---|---|---|---|---|
| [#379](https://github.com/bob8675309/DNDNEXT/pull/379) | C34 T6 HOLD: signed original 15/31 Forge + feat grants; verified NULL creator provenance gap | `main` | `9cdf11bdd63a5e214b90939b574ce74216494565` | T7 integration; HOLD |
| [#371](https://github.com/bob8675309/DNDNEXT/pull/371) | I2-G research: original signed level-up v1 account-overwrite RED and Option A no-mirror scratch GREEN | `research/i2f-source-species-projection-option-a-freeze-20261111` | `6db27e720d0c2788774cc37d2f85d14244e61b95` | Option A HELD |
| [#370](https://github.com/bob8675309/DNDNEXT/pull/370) | I2-F research: sourceChoices/species runtime private projection Option A no-mirror RED/GREEN | `research/i2e-hp-admin-rage-action-option-a-freeze-20261111` | `ea43938da626292cb7b3f8f8459955b426874f9d` | Option A HELD |
| [#369](https://github.com/bob8675309/DNDNEXT/pull/369) | I2-E research: signed original HP/Admin/Rage account-overwrite RED and Option A no-mirror GREEN | `research/i2d-private-forge-v3-option-a-freeze-20261111` | `1132a33b64e24197e974276cd58c48cbdded3baa` | Option A HELD |
| [#368](https://github.com/bob8675309/DNDNEXT/pull/368) | I2-D research: signed modern v3/Story private Forge Option A freeze for empty legacy sheets | `research/i2c-creation-signup-option-a-freeze-20261111` | `88a39d5e7a888dc63ebe53736aa2734a480442ac` | Option A HELD |
| [#367](https://github.com/bob8675309/DNDNEXT/pull/367) | I2-C research: signed original v1/v2 creation and signup Option A freeze RED/GREEN | `research/i2b-frozen-legacy-sheet-first-signed-slice-20261111` | `963a04a9bc897e247f7e088ef5a99319c1ae3cdf` | Option A HELD |
| [#366](https://github.com/bob8675309/DNDNEXT/pull/366) | I2-B research: signed Option A frozen legacy-sheet first slice (3 original writers + profile ACL) | `research/i2a-canonical-sheets-legacy-freeze-owner-decision-20261111` | `e568c43ab39c759847f750f14eb4664a57a824de` | Option A HELD |
| [#365](https://github.com/bob8675309/DNDNEXT/pull/365) | I2-A research: owner-approved canonical per-character sheets and frozen legacy snapshot plan | `research/i1p-earned-levelup-rest-legacy-sheet-20261111` | `04f2bcd34b1c2935125ad2369717e10140025047` | Option A HELD |
| [#364](https://github.com/bob8675309/DNDNEXT/pull/364) | I1-P research: signed original earned level-up v5 and Rage-rest cross-character mirror RED/GREEN | `research/i1o-cross-family-legacy-sheet-signed-20261111` | `f969af0a15cc8a7e517808cb2eeeefea3119f6fd` | Legacy writers HELD |
| [#363](https://github.com/bob8675309/DNDNEXT/pull/363) | I1-O research: signed cross-family legacy-sheet RED/GREEN for HP and Admin progression | `research/i1n-legacy-sheet-writer-reader-census-20261111` | `0c413bc5b0d1378a55891f070f76e74394bd0044` | Legacy writers HELD |
| [#362](https://github.com/bob8675309/DNDNEXT/pull/362) | I1-N research: 34 legacy player-sheet writer census and canonical authority contract | `research/i1m-artificer-legacy-sheet-20261111` | `61f7e8f109f5327049cd1dc7f62322f13e891a2b` | Legacy writers HELD |
| [#361](https://github.com/bob8675309/DNDNEXT/pull/361) | I1-M research: signed Artificer multi-character legacy-sheet RED/GREEN compatibility | `research/i1l-artificer-original-plans-20261110` | `99f8000994fd9194ebe21ab0801636ad24ad6760` | Legacy writers HELD |
| [#360](https://github.com/bob8675309/DNDNEXT/pull/360) | I1-L research: original EFA Artificer Magic Item Plans at signed first creation | `research/i1k-species-cantrip-original-materializer-20261110` | `4763a00a6a9afc387090b2853754dd22a7544b80` | I1 research stack HELD |
| [#359](https://github.com/bob8675309/DNDNEXT/pull/359) | I1-K research: original High Elf and Khoravar species cantrip first-creation with Warlock coexistence | `research/i1j-khoravar-original-skill-versatility-20261110` | `d0f6aad93772cbadee5c5547b37cbaf18de3ddd2` | I1 research stack HELD |
| [#358](https://github.com/bob8675309/DNDNEXT/pull/358) | I1-J research: source-original Khoravar skill/tool materializer with signed Eladrin and Warlock coexistence | `research/i1i-eladrin-original-season-materializer-20261110` | `969dd5b00ed4b8dc4491fed412e37288e4d5fdbf` | I1 research stack HELD |
| [#357](https://github.com/bob8675309/DNDNEXT/pull/357) | I1-I research: source-original Eladrin season materializer with signed Warlock coexistence | `research/i1h-warlock-original-acquisition-20261110` | `57730a4ae1e8a577ff88f2ab0f108188fa170bed` | I1 research stack HELD |
| [#356](https://github.com/bob8675309/DNDNEXT/pull/356) | I1-H research: original Warlock acquisition with both deferred safeguards at first creation | `research/i1g-warlock-original-invocation-guards-20261109` | `f6fe276a305e292ed343b1bae122924983fedc2d` | I1 research stack HELD |
| [#355](https://github.com/bob8675309/DNDNEXT/pull/355) | I1-G research: source-original Warlock legacy Invocation guard plus deferred normalized validator | `research/i1f-battle-master-original-maneuver-grants-20261109` | `71840f27c68f5e34937b91f95ed88d3859ba06c4` | I1 research stack HELD |
| [#354](https://github.com/bob8675309/DNDNEXT/pull/354) | I1-F research: source-original Battle Master maneuver grants and deferred validator signed regression | `research/i1e-wizard-original-finalizer-signed-20261109` | `83aa403c725b3a05e6f32b1623801b8ffccf64b8` | I1 research stack HELD |
| [#353](https://github.com/bob8675309/DNDNEXT/pull/353) | I1-E research: source-original Wizard Savant + Signature finalizer with signed PG17 Stage4 tests | `research/i1d-forge-trigger-inventory-joint-20261109` | `2b10b86f1237de484974d686acbd16d47c29a1d6` | I1 research stack HELD |
| [#352](https://github.com/bob8675309/DNDNEXT/pull/352) | I1-D research: original Forge trigger gap census plus signed Story nonce × Stage4 inventory integration | `research/i1c-forge-story-complete-intent-20261109` | `79c9607d12c6bc186f8208d9a3e715242060d806` | I1 research stack HELD |
| [#351](https://github.com/bob8675309/DNDNEXT/pull/351) | I1-C research: Story-inclusive immutable Forge nonce with real signed PG17 concurrency regression | `research/i1b-forge-story-nonce-joint-auth-20261109` | `5561d0e5e941f44d6a2f2e4fea99166ba92fdcc7` | I1 research stack HELD |
| [#350](https://github.com/bob8675309/DNDNEXT/pull/350) | I1-B research: source-locked GoTrue/PG17 Forge nonce + private Story negative fixture | `feature/c3-3-npc-secure-profile-candidate-20261107` | `503e95a1cc1ee7151b5f16f8de60a45645bb818c` | I1 research stack HELD |
| [#349](https://github.com/bob8675309/DNDNEXT/pull/349) | I1 research: preserve original Forge 31-trigger static evidence ledger and no-cost CI | `main` | `c9a60f9d1a10d1e2459df18f0afe217f35d84a5a` | I1 research stack HELD |
| [#347](https://github.com/bob8675309/DNDNEXT/pull/347) | C4 research: extract source-only P1 Spell Recipe validator and preflight | `main` | `18e889ffc668ee9af45d04b6faf24d93f2d9f8ae` | Spell Engine HELD |
| [#345](https://github.com/bob8675309/DNDNEXT/pull/345) | C3.3 research: unified secure NPC reader/GM secrets/creator backstory and centered Profile-first UI | `main` | `4f5f8ff7587aff1a68f21581ad68a4752789f54a` | NPC privacy/UX HELD |
| [#335](https://github.com/bob8675309/DNDNEXT/pull/335) | Research: J169 real Chromium clicks on Warlock source-choice React UI | `agent/forge-warlock-client-wire-j168-20261107` | `19d7275d24d26f9641c9e6d98ea24cf9431f4d81` | Forge component/choice HELD |
| [#334](https://github.com/bob8675309/DNDNEXT/pull/334) | Research: J168 execute actual Forge Warlock source serializers under signed original v3 | `agent/forge-warlock-j167-ci-20261107` | `0527f945269b6df32ad1f5c32fbe0434082d52f8` | Forge component/choice HELD |
| [#333](https://github.com/bob8675309/DNDNEXT/pull/333) | Research: J167 source-only Warlock2 signed Forge browser-shape acceptance | `research/forge-warlock-child-completion-20261106` | `a34e1f23579b2a669004deed022fa6b41287bd97` | Forge component/choice HELD |
| [#332](https://github.com/bob8675309/DNDNEXT/pull/332) | Research: source-authentic level-2 Warlock Invocation dependent child through real JWT | `research/forge-nested-choice-dependent-20261106` | `8f7647535b8e7b900d5884b9256f3465d0933a5e` | Forge component/choice HELD |
| [#331](https://github.com/bob8675309/DNDNEXT/pull/331) | Research: original deferred Forge nested-choice dependency, deterministic signed JWT cases | `research/forge-wizard-spell-counts-20261106` | `7f092ab329653e02dd5436dc7caf4a547d91ce73` | Forge component/choice HELD |
| [#330](https://github.com/bob8675309/DNDNEXT/pull/330) | Research: live-source XPHB Wizard starting spell counts through genuine JWT | `research/forge-starting-spells-seeded-20261106` | `8bdc77a8eecacaf15c9e94c2828d64f03dbee34a` | Forge component/choice HELD |
| [#329](https://github.com/bob8675309/DNDNEXT/pull/329) | Research: original deferred Forge starting-spell validator, seeded real JWT coverage | `research/forge-seeded-scenarios-20261106` | `dbf701d87db738ccaefe4f179f006319b132a3e9` | Forge component/choice HELD |
| [#328](https://github.com/bob8675309/DNDNEXT/pull/328) | Research: deterministic seeded Forge scenarios through real JWT J153 fixture | `research/forge-immutable-creation-replay-20261105` | `16ebd9ba1b952d8f21505c91782d0d18aa0c8263` | Forge component/choice HELD |
| [#325](https://github.com/bob8675309/DNDNEXT/pull/325) | Draft: supervised research agent + DNDNext agent opportunities audit | `main` | `449f6871a1d2f630355a1d1f2d8cb9ba46060a3c` | Paid agent OFF |
| [#324](https://github.com/bob8675309/DNDNEXT/pull/324) | Draft research: immutable player Forge creation request replay with original RPC fixtures | `research/p1-3-npc-profile-safe-rls-20261104` | `f1a2c564046ab93a0bfa0732e3acc2179da9c064` | Original Forge HELD |
| [#323](https://github.com/bob8675309/DNDNEXT/pull/323) | Draft (stacked): reconcile centered NPC Profile-first UX with server-safe GM/creator access | `feature/npc-private-profile-readers-20261104` | `07ff6a4f68418a37d89527be79925922cb1a6775` | NPC privacy/UX HELD |
| [#322](https://github.com/bob8675309/DNDNEXT/pull/322) | Draft (stacked): server-safe NPC Profile, GM dossier, and creator-only backstory UI | `research/p1-3-npc-profile-safe-rls-20261104` | `4f4b8788744754ccf19af0e29546944f8ed8b3a3` | NPC privacy/UX HELD |
| [#321](https://github.com/bob8675309/DNDNEXT/pull/321) | Draft: signed-in NPC safe Profile projection and full-sheet RLS research | `main` | `b220fb5ecbc9570f63bd85a95da8706340abd153` | NPC privacy/UX HELD |
| [#320](https://github.com/bob8675309/DNDNEXT/pull/320) | Draft: centered Profile-first NPC interactions across map, town and inventory | `main` | `e7a64e827bfb2458bdfc5323b9d8706f44c100b4` | NPC privacy/UX HELD |
| [#318](https://github.com/bob8675309/DNDNEXT/pull/318) | Draft: Admin inbox for player character creation notices (additive) | `main` | `ec741eca901aef062f3d472b33c5a8b451cec299` | Admin notices HELD |
| [#317](https://github.com/bob8675309/DNDNEXT/pull/317) | docs(security): P1.3 cross-command lock graph and concurrency proof gates | `main` | `69e741d7c7d8874c22467e2d30791e30c009ff6e` | Tactical locks HELD |
| [#312](https://github.com/bob8675309/DNDNEXT/pull/312) | Draft research: P2 spell recipe shadow-parity contracts (non-executing) | `work/eldritch-blast-los-regression-20261030` | `26d2f278b9e85e8fc0b0c04307b7a87bdd2e8254` | Spell Engine HELD |
| [#309](https://github.com/bob8675309/DNDNEXT/pull/309) | Draft: directional ranged-attack LOS regression for held Eldritch Blast | `work/consolidated-encounter-research-20261030` | `a24006624380570bd693a768e97a0c689f1d42b5` | Spell Engine HELD |

## Root source crosswalk — original #324, #345, #351 and C34 #379

Immediate changed-files metadata is fully retrieved with pagination capacity 100; the four PRs have fewer than 100 files each. `Exact/different/absent` tests the original HEAD file **entire Git blob** against the same path in current main or C34. `headVsBase` and `headVsMain` compare *all* raw HEAD blob paths with base/main and include unrelated later history; not a count of lost features.

| PR | Immediate changed files | All HEAD blobs differing from its base | All HEAD blobs differing from main | Main exact/different/absent | C34 exact/different/absent |
|---|---:|---:|---:|---|---|
| [#324](https://github.com/bob8675309/DNDNEXT/pull/324) | 77 | 77 | 54 | 45/10/22 | 45/10/22 |
| [#345](https://github.com/bob8675309/DNDNEXT/pull/345) | 94 | 94 | 101 | 0/30/64 | 8/30/56 |
| [#351](https://github.com/bob8675309/DNDNEXT/pull/351) | 4 | 4 | 108 | 0/0/4 | 1/0/3 |
| [#379](https://github.com/bob8675309/DNDNEXT/pull/379) | 36 | 36 | 36 | 0/2/34 | 36/0/0 |

**Feature-level known incomplete items (retained on original branches):**

- **#324 — 77 files:** T1–T7 retain source-exact immutable player Forge nonce/Story, 15 of 31 original triggers, selected feat/starting equipment/catalog/inventory handlers and both grant tables. Remaining original progression, classes, species, Warlock, wizard, shop/merchant, source-choice and original trigger matrix cases remain `deferred_preserved`; exact SHA parity of a helper does not accept all of its branches.
- **#345 — 94 files:** three NPC privacy/GM dossier/creator Story SQL stages and selected original fixtures tested in C34, while centered Profile-first runtime UI, town and inventory consumers, PDF/print, all player/GM browser paths, release/backup and migration-history cuts are still `deferred_preserved`. This original PR currently has merge conflicts.
- **#351 — 4 immediate files, stacked:** original corrected Story-complete nonce SQL and signed JS test copied at unchanged SHA. Its workflow/docs and all inherited branch/SQL/RPC consumers remain held and require full HEAD/base/main review. Never close merely because T7 uses the unchanged test.
- **#379 — C34 T7:** research-only nonproduction subset, 15/31 **original** Forge triggers, 2 separately held privacy candidates, 1 separately held verified progression-creator seed and 5 grant-table downstream original hooks; **16 original Forge triggers remain unstaged**. Signed T6 RED `granted_by=NULL` and T7 GREEN fresh actor provenance without historical backfill proved on disposable genuine PG17/GoTrue. Research release gate refuses production. Not eligible for main merge.

**Other original PR families remain open and unretired:** #320–323 secure NPC Profile/consumer stacks; #328–335 Forge signed/Chromium/source-choice stacks; #349–360 original 31-trigger, Story, Wizard, Warlock, Battle Master, Eladrin, Khoravar and Artificer research; #361–371 Option A canonical sheets (**22 of 34** account writers untested); #309/#312/#317 tactical spells/locks/delegation; #347 P1 research distinct from already-merged #374 source-only parser; #318 Admin inbox; #325 supervised paid agent OFF.

## Full changed-file-by-file original SHA and same-path parity (211 paths)

A path marked `different` or `absent` retains its source in the intact original PR; it is **NOT** approved to retire. Conversely, `exact` at a path is a blob check, **not a claim that the feature is deployed, reachable, secure, tested or complete**. For transformed/renamed features a human source and consumer review is still required.

| Original PR | Original immediate changed path | Original HEAD blob SHA | Same path on main | Same path on C34 |
|---|---|---|---|---|
| #324 | `.github/workflows/forge-trigger-acceptance-audit.yml` | `e752a5cc2626346726db3a86c56ffda0c9ae8ddd` | absent | absent |
| #324 | `.github/workflows/research-docs-maintenance.yml` | `ccd79fe4a3b3f26edf6d71c964cbaf27278112b9` | exact | exact |
| #324 | `.github/workflows/validate-forge-immutable-creation-replay.yml` | `4fc4a603c10a5bc098c4196eb2a217aa9506b07a` | different | different |
| #324 | `docs/ACTIVE_WORK.md` | `c5aa5d78dee590e4e36019f803a71434924902cf` | different | different |
| #324 | `docs/Forge_Aasimar_Light_Bearer_Positive_Source_2026-11-05.md` | `93f17b6eca0a3b4be548babc02ee586464cd15c8` | absent | absent |
| #324 | `docs/Forge_Character_Inventory_Owner_Check_RLS_Release_Review_2026-11-05.md` | `e46ccccc1addd9de371e20d00faad7c769cac41d` | absent | absent |
| #324 | `docs/Forge_Characters_Portrait_Source_Acceptance_2026-11-05.md` | `5f5ded44ffbc28b423fc2ad4b38bb45050015e29` | absent | absent |
| #324 | `docs/Forge_Characters_Tag_Guard_Original_Acceptance_2026-11-05.md` | `0b0455d73d1f0c974cac96faab03961ac0c44578` | absent | absent |
| #324 | `docs/Forge_Feat_Grant_Provenance_Gap_2026-11-05.md` | `67f371a1297fc59ac7d01a5fb4f3d3bd7e043880` | absent | absent |
| #324 | `docs/Forge_GI_JWT_Source_Concurrency_2026-11-05.md` | `627c1f042962afb274fc7d6cd7814d61481eb431` | absent | absent |
| #324 | `docs/Forge_High_Risk_Progression_Trigger_Parity_2026-11-05.md` | `ea09588425828fd0ebc8b1f759793a9c358e109b` | absent | absent |
| #324 | `docs/Forge_Original_Creation_Trigger_Coverage_2026-11-05.md` | `296e178fc951e261f48b6b9d63e48ee3012ee232` | absent | absent |
| #324 | `docs/Forge_Original_Deferred_Creation_Owner_Check_2026-11-05.md` | `2de06843e330deb8279670c9f6034d3595cfc061` | absent | absent |
| #324 | `docs/Forge_Original_Merchant_Inventory_Concurrent_Writes_2026-11-05.md` | `1000eddc1a2c112a760abbde38ea296891c1f541` | absent | absent |
| #324 | `docs/Forge_Subclass_Original_Acceptance_2026-11-06.md` | `57193773ce662d731786943661b9627210c5024b` | absent | absent |
| #324 | `docs/Forge_V3_Source_Market_Inventory_RLS_Research_2026-11-05.md` | `9eebb1755df8eb4bfaa69b2105efcfd5e25c7eaa` | absent | absent |
| #324 | `docs/Forge_Verified_Progression_Creator_Candidate_2026-11-05.md` | `2978b5aad8418d91450bac0824665248ef6be0bd` | absent | absent |
| #324 | `docs/Forge_Warlock_Invocation_Positive_Source_2026-11-05.md` | `e7ab7739e1d218f87e5c9ed13dfc7db6d5947324` | absent | absent |
| #324 | `docs/Forge_Zero_Cost_Acceptance_Automation_2026-11-06.md` | `a6b24a8409a8a29d00e6db25afd13e2df5bd77d7` | absent | absent |
| #324 | `docs/HANDOFF_LOG.md` | `692aca81e3ac3bcfb8c5e29c0ff0295ab4204638` | different | different |
| #324 | `docs/Legacy_PHB_Optional_Content_Design_2026-11-06.md` | `115d5ad7061a788140dc45466bb3e20e0c351773` | absent | absent |
| #324 | `docs/Player_Forge_Immutable_Creation_Intent_Candidate_2026-11-05.md` | `2f95078b0ed37cca5773f23d6e5fe687b48f90ec` | absent | absent |
| #324 | `docs/README.md` | `f78e8a06ec1c496e0d367ccddd6863a7a4cf0e49` | different | different |
| #324 | `docs/Research_Docs_Maintenance_2026-11-06.md` | `946df7e71fc0511004f397df4ebfa13ac5802297` | different | different |
| #324 | `docs/START_HERE_ACTIVE_HANDOFF.md` | `4d97a272be6f79812b07a914e9fa331d7a94ffc4` | different | different |
| #324 | `docs/SYSTEM_REGISTRY.json` | `e0109f2f0175f137e56110dc6f92a340b8cf82c5` | different | different |
| #324 | `scripts/agents/forge_automation_selftest.mjs` | `6d4dc315449958a3862130de739ed691773b00cf` | absent | absent |
| #324 | `scripts/agents/forge_ci_diagnostics.mjs` | `55cf7ab71d16aecada03c231bc4fe7491e7cd78a` | exact | exact |
| #324 | `scripts/agents/forge_trigger_acceptance_ledger.mjs` | `3a12039f69d25eb968b37eda39c09839a13cb8ae` | absent | absent |
| #324 | `scripts/agents/forge_trigger_acceptance_receipts.json` | `ddcd17bc15aaf4f75e8c0aa07c7faed69f86fe5e` | absent | absent |
| #324 | `scripts/agents/forge_trigger_audit.mjs` | `d5fbf344c5e92f8dc3e620806baded0fbb31f7ae` | absent | absent |
| #324 | `scripts/agents/project_health.mjs` | `5bcb19c5f49ad9d5591b363f995f059bec46846f` | different | different |
| #324 | `scripts/agents/research_docs_maintainer.mjs` | `9b0de9a058a925fa94938eb7d5ab4db1e2bd2705` | exact | exact |
| #324 | `scripts/agents/validate_project_health.mjs` | `25ce56e389fe3611faae2e7209e08f368f7f7771` | different | different |
| #324 | `scripts/agents/validate_research_docs_maintainer.mjs` | `bceaee41d7536a288d33c5fe501c7d3576a9373f` | exact | exact |
| #324 | `scripts/fixtures/forge_characters_portrait_sync_local_auth_pg17.sql` | `2517db705bdc1a19f59747c4d976cb437d9428c9` | exact | exact |
| #324 | `scripts/fixtures/forge_characters_portrait_sync_original_pg17.sql` | `849ba03462e28c5d05b6bffd24a3384654af0393` | exact | exact |
| #324 | `scripts/fixtures/forge_characters_tag_guard_local_auth_pg17.sql` | `3886459350b2fadc515d27c4801d0c7ae273ee22` | exact | exact |
| #324 | `scripts/fixtures/forge_characters_tag_guard_original_pg17.sql` | `de29cc239ccaaf46241aa78d52e52a53e75f7637` | exact | exact |
| #324 | `scripts/fixtures/forge_creation_original_functions_pg17.sql` | `6c64683e14ee148daf5c874a7e6e3c7ff606138c` | exact | exact |
| #324 | `scripts/fixtures/forge_creation_replay_candidate_pg17.sql` | `590329eb87f5f86990829eb1b0ed496d0cbf9623` | exact | exact |
| #324 | `scripts/fixtures/forge_creation_replay_local_auth_pg17.sql` | `3da82b85babbb37d4aee1744e22ec24716082997` | exact | exact |
| #324 | `scripts/fixtures/forge_creator_trigger_original_stage3_pg17.sql` | `e31fff4ee3641cbf5388950d486ca5bf50bd2c96` | exact | exact |
| #324 | `scripts/fixtures/forge_equipment_validator_local_auth_extension_pg17.sql` | `ef7c25d2bb3c83708e80eed0b244ded500f78772` | exact | exact |
| #324 | `scripts/fixtures/forge_equipment_validator_original_pg17.sql` | `01c0a4e5f7ff48266e3e41c3a500de4592d122fe` | exact | exact |
| #324 | `scripts/fixtures/forge_feat_materializer_discriminators_original_pg17.sql` | `b73e418b1f3b7fdbab528a9d52efe375af72e1e8` | exact | exact |
| #324 | `scripts/fixtures/forge_feat_materializer_local_auth_extension_pg17.sql` | `e6d574baa68dea6ad93f997941b3f062a234ff98` | exact | exact |
| #324 | `scripts/fixtures/forge_feat_materializer_original_pg17.sql` | `aa60a2699796fea20213dca55c5191e2beaa24ac` | exact | exact |
| #324 | `scripts/fixtures/forge_gi_cp_cs_local_jwt_race_pg17.sql` | `203acdb3b8fa6362d2a7e666e1059d1af0a5dc0b` | exact | exact |
| #324 | `scripts/fixtures/forge_high_risk_original_progression_triggers_pg17.sql` | `9da41b637b077ce5ab3f80e6308e0ca9b91fd002` | exact | exact |
| #324 | `scripts/fixtures/forge_high_risk_progression_local_auth_pg17.sql` | `27345348ff4587e7dbd8b26f4e3e7c6f3cc8f8bb` | exact | exact |
| #324 | `scripts/fixtures/forge_inventory_access_original_pg17.sql` | `930036668d4e889b85f1c5ad0abeed79793a5c09` | exact | exact |
| #324 | `scripts/fixtures/forge_inventory_policy_source_local_auth_pg17.sql` | `e077a2b103fbbf1c1e5b5e437c8e877e6f619990` | exact | exact |
| #324 | `scripts/fixtures/forge_market_cash_original_functions_pg17.sql` | `6cf2e51820166bc88bb24ee544a8bb1403a6ea41` | exact | exact |
| #324 | `scripts/fixtures/forge_materializer_local_auth_extension_pg17.sql` | `dad4f97a1a9ba8a2ed99b8ba8b6ac6cdd534103e` | exact | exact |
| #324 | `scripts/fixtures/forge_materializer_original_functions_pg17.sql` | `d6f5ac4f0cfd571edaa926b4168847eb85e18640` | exact | exact |
| #324 | `scripts/fixtures/forge_merchant_inventory_live_writer_local_auth_pg17.sql` | `ca43da924a30deb9ca51e9606b237fe5ebfe80bd` | exact | exact |
| #324 | `scripts/fixtures/forge_original_merchant_buy_source_pg17.sql` | `72fd9f0f80a83adaec67caf80a762e238f1dcd8c` | exact | exact |
| #324 | `scripts/fixtures/forge_owner_constraint_deferred_creation_local_auth_pg17.sql` | `faa20bc3052b4529c00eb81deb2b7ef3d0f5d128` | exact | exact |
| #324 | `scripts/fixtures/forge_owner_constraint_original_inventory_handlers_pg17.sql` | `aafbfea03d565dfaa1599875ab49c3c485611c51` | exact | exact |
| #324 | `scripts/fixtures/forge_progression_authority_local_auth_extension_pg17.sql` | `413a82dc3c1913cb5f71c28531d31e19da89e02d` | exact | exact |
| #324 | `scripts/fixtures/forge_progression_authority_original_pg17.sql` | `3a0b6caeb6712f67af7895433df15f1439b19581` | exact | exact |
| #324 | `scripts/fixtures/forge_sheet_authority_tags_local_auth_extension_pg17.sql` | `f3bf99af569a45ea496e48d06db954d8ea1309fb` | exact | exact |
| #324 | `scripts/fixtures/forge_sheet_authority_tags_original_pg17.sql` | `b02285f75d446f5874341cf3bc694ac256e1f732` | exact | exact |
| #324 | `scripts/fixtures/forge_species_light_original_helpers_pg17.sql` | `860ea07abb4729c297ea2aaa391dabd4bd2b1b07` | exact | exact |
| #324 | `scripts/fixtures/forge_species_light_positive_local_auth_pg17.sql` | `5ed4919ab84cad0a4b38bd7d1260ec6a75c8d225` | exact | exact |
| #324 | `scripts/fixtures/forge_subclass_choice_local_auth_pg17.sql` | `6b34510b16b86aa4e06c40946732a83679cbea1c` | exact | exact |
| #324 | `scripts/fixtures/forge_subclass_choice_original_pg17.sql` | `2b7da3a5e4f7c926c09312efb98f61a1244b0bc6` | exact | exact |
| #324 | `scripts/fixtures/forge_v3_market_source_local_auth_extension_pg17.sql` | `7b592be1c2f177c15051e9c2156c865ddb20902d` | exact | exact |
| #324 | `scripts/fixtures/forge_warlock_invocation_original_slot_helpers_pg17.sql` | `4ee8fe49717f812f58140307b83d9f43d5c5a25e` | exact | exact |
| #324 | `scripts/fixtures/forge_warlock_invocation_positive_local_auth_pg17.sql` | `cf6cfc99cfe6bb7498c81cda614ecc01dcd991ec` | exact | exact |
| #324 | `scripts/test_forge_immutable_creation_replay_local_auth.mjs` | `4849c8490775711c9b09228d5cbfaac2b02d7e76` | different | different |
| #324 | `scripts/validate_forge_immutable_creation_replay.mjs` | `00d85baf34bac0813036724dfe57d29c32b712ad` | exact | exact |
| #324 | `scripts/validate_forge_inventory_ui_release_contract.mjs` | `2f44b365b84ebe8611baad5299e2b7040a8cd81f` | exact | exact |
| #324 | `sql/candidates/20261105_forge_progression_verified_creator_seed_v1.sql` | `ecddcd514917a4d379d14b02477dfb41dbf44f29` | exact | exact |
| #324 | `sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql` | `4532ddb8db642d0d0ab14646a3e87c034d4134c6` | exact | exact |
| #324 | `sql/candidates/20261105_player_creation_immutable_intent_v1.sql` | `99bceee24c1718570237e70a65fe3172f4c9fbc9` | exact | exact |
| #345 | `.github/workflows/validate-c3-3-atomic-disposable.yml` | `e255863d55840dfe7ec2f23bfd21d834185dc2cb` | absent | absent |
| #345 | `.github/workflows/validate-c3-3-forge-privacy-original.yml` | `5bff721b87e73f29bbccdf6f2b3f7d0931038498` | absent | absent |
| #345 | `.github/workflows/validate-c3-3-npc-pdf-visual.yml` | `5d72663fff20556cb7a5a1909b5e6b902cbfefe0` | absent | absent |
| #345 | `.github/workflows/validate-centered-npc-profile.yml` | `565419d081144869754de43856a9ab8483f4be03` | absent | absent |
| #345 | `.github/workflows/validate-npc-private-profile-cutover.yml` | `35e37eebd4a9ebe756bc21cf7b66e35a93ba4523` | absent | absent |
| #345 | `.github/workflows/validate-p1-3-npc-profile-rls.yml` | `93f94bbb4d5debc59a682b2fa46bab8bf2fd2e20` | absent | absent |
| #345 | `components/CreatorBackstoryPanel.js` | `23b0e86aab7a80b7243365ba107c1d37a5ec5812` | absent | absent |
| #345 | `components/GlobalNpcProfileOverlay.js` | `a0e133a7c2446cba3f8c672a1df78f6a5aa73763` | absent | absent |
| #345 | `components/MapPageClient.js` | `3e6bf39d48de6f28aac90f6bac1400fa9a00bf1f` | different | different |
| #345 | `components/NewNpcModalV3.js` | `27c8aa95bf95c88adeb80274e7139dbe17270098` | different | different |
| #345 | `components/NewNpcModalV3Refined.js` | `3ddcbb6672d9a1655de1bca626317b1bb857bd34` | different | different |
| #345 | `components/NpcForgeStepContent.js` | `a7b17e898c4634aacb98d33ca1db399039866295` | different | different |
| #345 | `components/NpcPanel.js` | `606db96649dcdf6646afbd4d24f67a6fc54426eb` | different | different |
| #345 | `components/PlayerCharacterProfilePanelUnified.js` | `d4500ee5aacb11e69bb666b33d587fd8a4b4839a` | different | different |
| #345 | `components/town/TownCrafterInteractionPanel.js` | `6be8eb9e041d74f784d136e672c0df9d2d27774d` | different | different |
| #345 | `docs/ACTIVE_WORK.md` | `09a4b4619734067a04a5bed1ec46d2bba1f161f9` | different | different |
| #345 | `docs/BACKUP_RECOVERY_CHECKPOINT_2026-11-09.md` | `a0a1560c8b2a21d497d43152073504d3b148d4f1` | absent | absent |
| #345 | `docs/C3_3_ATOMIC_DISPOSABLE_COMMIT_2026-11-08.md` | `15fe744db6ad1764f69b409aba0b298aa78ba9aa` | absent | absent |
| #345 | `docs/C3_3_FREE_PLAN_MANUAL_BACKUP_2026-11-08.md` | `402bd78c778cdae31c9004bffd031506f9c73c5e` | absent | absent |
| #345 | `docs/C3_3_MIGRATION_HISTORY_RECONCILIATION_2026-11-08.md` | `120684b15a56a7cd07571ead1713b3efd4f4e466` | absent | absent |
| #345 | `docs/C3_3_NPC_PRINT_VISUAL_QA_2026-11-08.md` | `a63ed29cdf9e21d0c16350cd2e18c7ea254772f7` | absent | absent |
| #345 | `docs/C3_3_NPC_PRIVACY_INVENTORY_RELEASE_PREFLIGHT_2026-11-08.md` | `0a68beb8be79deacbea1ddd8ec6c964942c92a90` | absent | absent |
| #345 | `docs/C3_3_NPC_PRIVACY_RELEASE_GATES_2026-11-07.md` | `6005fea0dfd6dde361a65f1dc1b988b304e410ac` | different | different |
| #345 | `docs/C3_3_NPC_PROFILE_INTEGRATION_REVIEW_2026-11-07.md` | `4ab3be51c90184a3e7dd9bba28ade0282d708a63` | absent | absent |
| #345 | `docs/C3_3_NPC_PROFILE_SOURCE_PROVENANCE_2026-11-07.json` | `72998dc396f775b8b173835033e2220b6aaac789` | absent | absent |
| #345 | `docs/C3_3_NPC_READER_COMPATIBILITY_MATRIX_2026-11-07.md` | `66b7306eb217d175331b5eb43d5d419a747069e3` | absent | absent |
| #345 | `docs/C3_3_OWNER_RELEASE_DECISION_PACKET_2026-11-08.md` | `336718bf170ea32ddbce205c15aa8114ed608252` | absent | absent |
| #345 | `docs/C3_3_PROTOTYPE_SPELL_ITEM_PRESERVATION_2026-11-08.md` | `3ca0ae9c16469bc626926259c52fa4fad4bb6ddb` | absent | absent |
| #345 | `docs/HANDOFF_LOG.md` | `8a6c4c30ac26aabcb0930b1b794d4ed3246c1bfc` | different | different |
| #345 | `docs/NEXT_CHAT_START_HERE.md` | `e88bccc1fee25e84920f4c5a931bcd64f672e39d` | different | different |
| #345 | `docs/README.md` | `de534035ee80867ac2d69b3d1eb5997e4e9f5ee5` | different | different |
| #345 | `docs/SYSTEM_REGISTRY.json` | `e5abadc50cd76e0fae0878bcd721382b2d3e2f6b` | different | different |
| #345 | `docs/archive/npc_secure_profile_2026-11-04/Centered_Secure_NPC_Profile_Integration_2026-11-04.md` | `fd1f2282ca721c4eca26a932cfe44fb6a2d026c6` | absent | absent |
| #345 | `docs/archive/npc_secure_profile_2026-11-04/NPC_Private_Reader_Client_Cutover_2026-11-04.md` | `f13fe5ae3c26230fe7f0ed6adff9c9c6df4b69d4` | absent | absent |
| #345 | `docs/archive/npc_secure_profile_2026-11-04/NPC_Profile_First_Centered_Overlay_2026-11-04.md` | `994cdbe09230cd71c652fe6d676d50b82e63f2de` | absent | absent |
| #345 | `docs/archive/npc_secure_profile_2026-11-04/P1_3_NPC_Profile_Server_Visibility_Research_2026-11-04.md` | `4c6fe3ea0918b15afc53a4707f5c2cfcc27cf748` | absent | absent |
| #345 | `docs/data/c33_migration_history_snapshot_2026-11-08.json` | `ac0fb111963c0eed79f8bd7634b5bac8b3f7ec9f` | absent | absent |
| #345 | `pages/_app.js` | `5a1981d58af0f0b99519538093157d27a0d60d35` | different | different |
| #345 | `pages/inventory.js` | `de0a9e7d787365998a7f08815a330d706bc8f54d` | different | different |
| #345 | `pages/npcs.js` | `2e08fa07384958478f323516c4e1b342228bd436` | different | different |
| #345 | `pages/town/[id].js` | `22aeb1c18f148ab84e24d1da67b9a2f9d47949ce` | different | different |
| #345 | `scripts/browser/c33_creator_backstory_dom.jsx` | `6ed044d5039b98ccc9f8c805b1d4e81b931df907` | absent | absent |
| #345 | `scripts/browser/c33_next_dynamic_shim.js` | `fed89a73a1b65075b338b34a341e05c6aee68430` | absent | absent |
| #345 | `scripts/browser/c33_next_router_shim.js` | `84cd9a1ed82699255bc793b64668ac8f087526f9` | absent | absent |
| #345 | `scripts/browser/c33_original_forge_full_dom.jsx` | `8faf3946e94721cdce3b8686d269a1322d4e1524` | absent | absent |
| #345 | `scripts/browser/verify_c33_creator_backstory_dom.mjs` | `7b3a813d11d4b9e0fcd1ba8aef9d4e8463f58aa4` | absent | absent |
| #345 | `scripts/browser/verify_c33_next_town_route.mjs` | `d19b134fdb4e4b58833fe339f918c027959eae02` | absent | absent |
| #345 | `scripts/browser/verify_c33_npc_pdf_visual.mjs` | `1ee0f29a5c017906f2029eff25a9b1c1b88c5760` | absent | absent |
| #345 | `scripts/browser/verify_c33_original_forge_full_dom.mjs` | `238093e708b49d9c970f005daa5fd43d91e52405` | absent | absent |
| #345 | `scripts/browser/verify_c33_privacy_stage_abort_pg17.mjs` | `9f65ac6c523c27c69e8bf451c2182d4bd8714f64` | absent | absent |
| #345 | `scripts/diagnostics/c33_migration_history_audit.mjs` | `3519a95fbf8ab3e8dbb961c000a735388e388433` | absent | absent |
| #345 | `scripts/diagnostics/c33_prototype_spell_item_preservation_readonly.sql` | `a9467f3502105c88298a1d884423815a7f2c0fb3` | absent | absent |
| #345 | `scripts/diagnostics/c33_release_preflight_readonly.sql` | `e430abbd2e56bf9b6b47c379b3a74c93a74f8c68` | absent | absent |
| #345 | `scripts/fixtures/c33_atomic_preprivacy_inventory_pg17.sql` | `bab4b9f1ae5f923fcbebbe23d7ebd5df87b8387d` | absent | absent |
| #345 | `scripts/fixtures/c33_forge_full_component_browser_catalog_pg17.sql` | `d64b85f8d38ef45bff31a247d20993b18a9822af` | absent | absent |
| #345 | `scripts/fixtures/c33_forge_original_levelup_cancel_local_pg17.sql` | `354ad33e1d86881244c48d090317e1906e3ed671` | absent | exact |
| #345 | `scripts/fixtures/c33_forge_original_mog_guard_local_pg17.sql` | `53bd80d36e94d3ac0f97d02d16a85881bdcf6b15` | absent | exact |
| #345 | `scripts/fixtures/c33_forge_original_sprite_guard_local_pg17.sql` | `d2f925129d198a443f1cea29d73ea56bff8b7a76` | absent | exact |
| #345 | `scripts/fixtures/c33_forge_privacy_inventory_join_setup_pg17.sql` | `a874ec87f3fc177a9dc7647a504f8e0b735827b2` | absent | absent |
| #345 | `scripts/fixtures/c33_forge_privacy_original_policy_join_pg17.sql` | `12612c4acbe861817037e1ab5a79ddb7c40a55e9` | absent | exact |
| #345 | `scripts/fixtures/c33_next_town_route_pg17.sql` | `0d3f1b261b7600944121c9be6f808fa190e8dddc` | absent | absent |
| #345 | `scripts/fixtures/forge_creation_replay_local_auth_pg17.sql` | `aa701c679712475cd4f04d4e0a01fedc4616bafa` | different | different |
| #345 | `scripts/fixtures/p1_3_npc_creator_replay_fixture_pg17.sql` | `7fc70929c7b7b21f836a8347139e356ed7e906dd` | absent | absent |
| #345 | `scripts/fixtures/p1_3_npc_safe_profile_local_auth_pg17.sql` | `2355ceaf306d6dde1ec90c634f71e919894d3859` | absent | absent |
| #345 | `scripts/fixtures/p1_3_npc_visible_sheet_original_functions_pg17.sql` | `9c479d3f044268f73da3a5515d229096ce03f94a` | absent | exact |
| #345 | `scripts/release/c33_capture_sensitive_db_backup_windows.ps1` | `37df430cc6c5eda8a43db84beabd7661e25379a2` | absent | absent |
| #345 | `scripts/release/c33_compose_disposable_joint_sql.mjs` | `1c677929faebf9fb31fbdacdde790ab2b63ee26c` | absent | absent |
| #345 | `scripts/release/c33_compose_production_review_sql.mjs` | `68cbbdfbd70c0ea4af366c5127d88e7c73ccd262` | absent | absent |
| #345 | `scripts/release/test_c33_compose_disposable_joint_sql.mjs` | `d97b31e3f05bbbe13124626d3bc9f02ac7756f62` | absent | absent |
| #345 | `scripts/release/test_c33_compose_production_review_sql.mjs` | `0da97c8a790b8151e56e72e57e703715fa28271f` | absent | absent |
| #345 | `scripts/test_c33_forge_privacy_original_local_auth.mjs` | `c8314cb9311d5e00e7b377f91484941536dd9e87` | absent | absent |
| #345 | `scripts/test_p1_3_npc_profile_safe_local_auth.mjs` | `949da8a7047db370e48bbf024d8acd89e89d26fa` | absent | absent |
| #345 | `scripts/validate_centered_npc_profile_entrypoints.mjs` | `b814ff42ff4cfb349b42d2072cffe2f574bcae60` | absent | absent |
| #345 | `scripts/validate_character_forge_resilience.mjs` | `3b726eced223cbca4528a54221a643569bb447d8` | different | different |
| #345 | `scripts/validate_forge_immutable_creation_replay.mjs` | `f206e6250aef3075049ea619e117ad38709d7f34` | different | different |
| #345 | `scripts/validate_forge_inventory_ui_release_contract.mjs` | `9fb2bcb008d700659503710da77945c2e449a364` | different | different |
| #345 | `scripts/validate_forge_seeded_warlock_child_completion.mjs` | `d469363de4f20983386f733ca05d43356cbfaf74` | different | different |
| #345 | `scripts/validate_handoff_registry.mjs` | `23c9206e04f2653ea6e693ce61e3c11f01dc70ed` | different | different |
| #345 | `scripts/validate_npc_private_profile_cutover.mjs` | `ee6915116ea49597449de4652b5f50f10450c90d` | absent | absent |
| #345 | `scripts/validate_npc_profile_consumer_acl.mjs` | `dd779d9e89703f427ca96e1556e616b8cfc30fc4` | absent | absent |
| #345 | `scripts/validate_npc_secure_centered_integration.mjs` | `5d841ac6efa7914f0b7e5b33defc8c55f03e8d46` | absent | absent |
| #345 | `scripts/validate_p1_3_npc_profile_rls_source.mjs` | `8d44b78b9e21184bd68884a86274bb736fceb618` | absent | absent |
| #345 | `scripts/validate_player_forge_multi_legacy_sheet_candidate.mjs` | `95a537f19cc8f822e801082cc5a9600b43e330fb` | different | different |
| #345 | `scripts/validate_player_forge_starting_magic_v3.mjs` | `e66ab7f7d38a3ceb1482a9a15f9f22a5f30f48d7` | different | different |
| #345 | `scripts/validate_printable_character_sheet.mjs` | `1d3825a0a540eb6fb42482376b018c05d7d79917` | different | different |
| #345 | `scripts/validate_security_hardening_roadmap.mjs` | `f7b2b39ed6bfb38694af5f8d341d72acf7bace3d` | different | different |
| #345 | `scripts/validate_town_crafter_interaction_component.mjs` | `25d6d25e4b088d5f0f55be8e328343a163b4d401` | different | different |
| #345 | `scripts/validate_unified_character_forge.mjs` | `e124d1d752254099fa756388cefe1a47997d8293` | different | different |
| #345 | `sql/candidates/20261104_gm_vs_player_backstory_secrets_stage3.sql` | `01e48823ac3a46aa5880e98200e97c2595501ce7` | absent | exact |
| #345 | `sql/candidates/20261104_npc_gm_dossier_column_acl_stage2.sql` | `afdd2849c3ae2be5929fd8c11c9b4e19f4f6a7ac` | absent | exact |
| #345 | `sql/candidates/20261104_npc_player_safe_profile_rls_v1.sql` | `9dfe44eee49df6ead8c8ccfc7a0454a996b8bee3` | absent | exact |
| #345 | `styles/npc-profile-centered.css` | `150eb9ad78aeba268be955e63c8451e3c0ed0e14` | absent | absent |
| #345 | `utils/npcProfileOverlay.js` | `3d809c47a9aaae18d0e7e5ec6500199a9266baac` | absent | absent |
| #345 | `utils/officialCharacterSheetPdf.js` | `c3ba3651e2e3d8aafbae3b4ad195d53ee25199f0` | different | different |
| #351 | `.github/workflows/validate-i1c-forge-story-nonce-local-auth.yml` | `d2287a9bc689018bb54c1f484b65d68b1ebbbe6e` | absent | absent |
| #351 | `docs/I1_C_FORGE_STORY_COMPLETE_INTENT_RESEARCH_2026-11-09.md` | `627ef4000ef4c339d46df2a80f237e017bdc6ed4` | absent | absent |
| #351 | `scripts/test_i1c_forge_private_story_nonce_local_auth.mjs` | `90fb3058bc1c93ef72a331bad0747920c3c1202e` | absent | absent |
| #351 | `sql/candidates/20261109_player_story_complete_intent_i1c_research.sql` | `91f5fb918bf205f2d4462e2ff0089f656601328e` | absent | exact |
| #379 | `.github/workflows/validate-c34-joint-local-auth.yml` | `4d7908b564b9482413d40efed843adcb270e85a1` | absent | exact |
| #379 | `.github/workflows/validate-c34-joint-source-research.yml` | `fa06fef1df1487110e0b4961d3abf516f81838bb` | absent | exact |
| #379 | `docs/ACTIVE_WORK.md` | `0df75af6b296ac3f0ccbaca512aeb1a7de372a2c` | different | exact |
| #379 | `docs/C34_CLEAN_MAIN_PRIVACY_FORGE_SOURCE_RESEARCH_2026-11-13.md` | `4bf8237416323cbb2f56b0d5c259da49da99eeef` | absent | exact |
| #379 | `docs/HANDOFF_LOG.md` | `3cbd111597fe39dbc5f1e97616d12c2d4f583c25` | different | exact |
| #379 | `docs/research/C34_ORIGINAL_31_TRIGGER_CENSUS_CAPTURE_2026-11-05.md` | `296e178fc951e261f48b6b9d63e48ee3012ee232` | absent | exact |
| #379 | `scripts/fixtures/c33_forge_original_levelup_cancel_local_pg17.sql` | `354ad33e1d86881244c48d090317e1906e3ed671` | absent | exact |
| #379 | `scripts/fixtures/c33_forge_original_mog_guard_local_pg17.sql` | `53bd80d36e94d3ac0f97d02d16a85881bdcf6b15` | absent | exact |
| #379 | `scripts/fixtures/c33_forge_original_sprite_guard_local_pg17.sql` | `d2f925129d198a443f1cea29d73ea56bff8b7a76` | absent | exact |
| #379 | `scripts/fixtures/c33_forge_privacy_original_policy_join_pg17.sql` | `12612c4acbe861817037e1ab5a79ddb7c40a55e9` | absent | exact |
| #379 | `scripts/fixtures/p1_3_npc_visible_sheet_original_functions_pg17.sql` | `9c479d3f044268f73da3a5515d229096ce03f94a` | absent | exact |
| #379 | `scripts/integration/c34/c34_five_original_sheet_character_triggers_pg17.sql` | `e58e81c096757a20343233638c4482d9e07ec97c` | absent | exact |
| #379 | `scripts/integration/c34/c34_inventory_materializer_setup_pg17.sql` | `9581ffbcb5aef42cde0780db754eaec2fd9bc836` | absent | exact |
| #379 | `scripts/integration/c34/c34_inventory_original_policy_baseline_pg17.sql` | `ce1d51134c2dfaf8c071759d3f2da3b8feecd3a0` | absent | exact |
| #379 | `scripts/integration/c34/c34_original_deferred_progression_authority_pg17.sql` | `32101fe64c47730ccdad1cfa85ae2842c6cfd578` | absent | exact |
| #379 | `scripts/integration/c34/c34_original_feat_grant_materializer_pg17.sql` | `a1fcd13a29bb68777ac9cb47a4152a90a66abb7a` | absent | exact |
| #379 | `scripts/integration/c34/c34_original_fighter_subclass_choice_pg17.sql` | `a0d4aa8cf4b71cd6f70725bc1e579f6626d326f6` | absent | exact |
| #379 | `scripts/integration/c34/c34_original_verified_creator_seed_pg17.sql` | `eb0f323970e34fb42bb388182b1bfce503c22133` | absent | exact |
| #379 | `scripts/integration/c34/c34_three_original_sprite_mog_levelup_triggers_pg17.sql` | `002d3efa2ef2c0540adead6e5b1eae5c59baca75` | absent | exact |
| #379 | `scripts/integration/c34/fixtures/forge_creation_replay_local_auth_pr351_pg17.sql` | `aa701c679712475cd4f04d4e0a01fedc4616bafa` | absent | exact |
| #379 | `scripts/integration/c34/fixtures/original_i1c_forge_private_story_nonce_local_auth.mjs` | `90fb3058bc1c93ef72a331bad0747920c3c1202e` | absent | exact |
| #379 | `scripts/integration/c34/sources/01_forge_immutable_intent.sql` | `99bceee24c1718570237e70a65fe3172f4c9fbc9` | absent | exact |
| #379 | `scripts/integration/c34/sources/02_npc_profile_stage1.sql` | `9dfe44eee49df6ead8c8ccfc7a0454a996b8bee3` | absent | exact |
| #379 | `scripts/integration/c34/sources/03_npc_dossier_stage2.sql` | `afdd2849c3ae2be5929fd8c11c9b4e19f4f6a7ac` | absent | exact |
| #379 | `scripts/integration/c34/sources/04_private_story_stage3.sql` | `01e48823ac3a46aa5880e98200e97c2595501ce7` | absent | exact |
| #379 | `scripts/integration/c34/sources/05_inventory_constraint_rls.sql` | `4532ddb8db642d0d0ab14646a3e87c034d4134c6` | absent | exact |
| #379 | `scripts/integration/c34/sources/06_story_complete_nonce_i1c.sql` | `91f5fb918bf205f2d4462e2ff0089f656601328e` | absent | exact |
| #379 | `scripts/integration/c34/test_joint_pg17_local_auth.mjs` | `4cd99262eef12eefd3d11c747887631fda569f64` | absent | exact |
| #379 | `scripts/integration/c34/test_source_contract.mjs` | `a705594625786d6d27359b3b79d9c48005fe87e5` | absent | exact |
| #379 | `scripts/integration/c34/validate_joint_fixture_blobs.mjs` | `35c265cf3bdf5a9b47776b9f1135e2af3821cff7` | absent | exact |
| #379 | `scripts/integration/c34/validate_source_contract.mjs` | `18702c6948ad90772fd680585331fdaff9d2a7a9` | absent | exact |
| #379 | `scripts/integration/c34/verify_original_trigger_coverage.mjs` | `8d9a44f0391f70743a48723ef098e2db70b73265` | absent | exact |
| #379 | `sql/candidates/20261104_gm_vs_player_backstory_secrets_stage3.sql` | `01e48823ac3a46aa5880e98200e97c2595501ce7` | absent | exact |
| #379 | `sql/candidates/20261104_npc_gm_dossier_column_acl_stage2.sql` | `afdd2849c3ae2be5929fd8c11c9b4e19f4f6a7ac` | absent | exact |
| #379 | `sql/candidates/20261104_npc_player_safe_profile_rls_v1.sql` | `9dfe44eee49df6ead8c8ccfc7a0454a996b8bee3` | absent | exact |
| #379 | `sql/candidates/20261109_player_story_complete_intent_i1c_research.sql` | `91f5fb918bf205f2d4462e2ff0089f656601328e` | absent | exact |

## Merge/retirement decision at this snapshot

**HOLD all 44 original drafts, including #379.** None has received the full original feature-by-feature HEAD/base/main and browser/role/lock/recovery acceptance required by the [protocol](../PR_FULL_SCOPE_REVIEW_PROTOCOL.md); the new T7 signed creator-seed RED→GREEN proves only its bounded safe correction. In particular #379 contains unreleased SQL/fixture candidates and merging into main could trigger automatic Vercel build/deploy without compatible production database state. No PR will be crossed off, merged, closed or rebased until its full original source and inherited features, tests and negative cases have explicit verified dispositions, source locked release gates and an independently accepted rollback path.

**Next bounded work:** expand original Forge progression trigger set toward 31 using source-exact signed fixtures; separately audit and release-safe cut over NPC centered Profile and Option A 22 untested account writers; preserve 19 production source-qualified tactical spell adapters and all world-map movement invariants. The two original world-map movement triggers are explicitly excluded absent discussion. No paid agent.
