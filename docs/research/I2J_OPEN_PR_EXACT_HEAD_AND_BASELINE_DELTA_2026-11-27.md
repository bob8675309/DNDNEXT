# Open PR exact-head and baseline delta — 2026-11-27 Central

Read-only audit receipt, not release or retirement authorization. Main `be1b20d9cab2ce45205a4cbe8d25ac540fceebf0`; I2J `acbaf8b6fcf27c81cb532d258031e5aea2ac6be8`; C34 `1220fac9292c1ef8c0a1fe02e439331660392bb1`; Agent C `6b3e6bce1c2ce3978b9512a25521149726d95fb1`. This continues the prior incomplete exact-head inventory; it does not rerun the signed lifecycle or Dropbox export review.

## 32 open PRs — exact heads, CI and file inventory

31 drafts, one non-draft (#392). GitHub Actions runs queried by exact head SHA, 244 returned, all success. These are workflow run records, not counts of individual job/check assertions or proof that every required check is configured. Earlier RED/failed evidence remains preserved. PR files endpoint paginated (including #379 442 paths and #317 138); the counts below are PR-path entries, not unique files across stacked PRs. Non-doc excludes docs/ and Markdown files. E/D/A = exact blob / present but different / absent at same path. Different or absent does not prove lost behavior; a later revision or separate branch may preserve it. Full semantic/ancestry/consumer disposition remains required.

| PR | Exact HEAD | CI success | Total paths | Non-doc | Main E/D/A | I2J E/D/A |
|---|---|---:|---:|---:|---|---|
| #392 | `be74d870b2440060e801a1814371dd8c135af5b8` | 7 | 7 | 0 | 0/0/0 | 0/0/0 |
| #379 | `1220fac9292c1ef8c0a1fe02e439331660392bb1` | 3 | 442 | 324 | 7/1/316 | 9/4/311 |
| #371 | `6db27e720d0c2788774cc37d2f85d14244e61b95` | 9 | 24 | 16 | 0/0/16 | 16/0/0 |
| #364 | `f969af0a15cc8a7e517808cb2eeeefea3119f6fd` | 7 | 7 | 4 | 0/0/4 | 4/0/0 |
| #363 | `0c413bc5b0d1378a55891f070f76e74394bd0044` | 14 | 7 | 4 | 0/0/4 | 3/1/0 |
| #362 | `61f7e8f109f5327049cd1dc7f62322f13e891a2b` | 7 | 7 | 3 | 0/0/3 | 3/0/0 |
| #361 | `99f8000994fd9194ebe21ab0801636ad24ad6760` | 13 | 7 | 4 | 0/0/4 | 3/1/0 |
| #360 | `4763a00a6a9afc387090b2853754dd22a7544b80` | 12 | 7 | 4 | 0/0/4 | 3/1/0 |
| #359 | `d0f6aad93772cbadee5c5547b37cbaf18de3ddd2` | 11 | 6 | 3 | 0/0/3 | 2/1/0 |
| #358 | `969dd5b00ed4b8dc4491fed412e37288e4d5fdbf` | 10 | 6 | 3 | 0/0/3 | 2/1/0 |
| #357 | `57730a4ae1e8a577ff88f2ab0f108188fa170bed` | 9 | 6 | 3 | 0/0/3 | 2/1/0 |
| #356 | `f6fe276a305e292ed343b1bae122924983fedc2d` | 8 | 6 | 3 | 0/0/3 | 1/2/0 |
| #355 | `71840f27c68f5e34937b91f95ed88d3859ba06c4` | 5 | 7 | 6 | 0/0/6 | 5/1/0 |
| #354 | `83aa403c725b3a05e6f32b1623801b8ffccf64b8` | 5 | 5 | 4 | 0/0/4 | 4/0/0 |
| #353 | `2b10b86f1237de484974d686acbd16d47c29a1d6` | 5 | 5 | 4 | 0/0/4 | 4/0/0 |
| #352 | `79c9607d12c6bc186f8208d9a3e715242060d806` | 6 | 6 | 4 | 0/0/4 | 4/0/0 |
| #351 | `5561d0e5e941f44d6a2f2e4fea99166ba92fdcc7` | 6 | 4 | 3 | 0/0/3 | 3/0/0 |
| #350 | `503e95a1cc1ee7151b5f16f8de60a45645bb818c` | 5 | 3 | 2 | 0/0/2 | 2/0/0 |
| #345 | `4f5f8ff7587aff1a68f21581ad68a4752789f54a` | 27 | 94 | 72 | 0/24/48 | 72/0/0 |
| #334 | `0527f945269b6df32ad1f5c32fbe0434082d52f8` | 6 | 8 | 5 | 4/1/0 | 2/3/0 |
| #333 | `a34e1f23579b2a669004deed022fa6b41287bd97` | 6 | 6 | 3 | 0/3/0 | 0/3/0 |
| #332 | `8f7647535b8e7b900d5884b9256f3465d0933a5e` | 6 | 10 | 6 | 2/4/0 | 2/4/0 |
| #331 | `7f092ab329653e02dd5436dc7caf4a547d91ce73` | 6 | 10 | 6 | 4/2/0 | 4/2/0 |
| #330 | `8bdc77a8eecacaf15c9e94c2828d64f03dbee34a` | 6 | 10 | 6 | 4/2/0 | 4/2/0 |
| #329 | `dbf701d87db738ccaefe4f179f006319b132a3e9` | 6 | 10 | 6 | 4/2/0 | 4/2/0 |
| #328 | `16ebd9ba1b952d8f21505c91782d0d18aa0c8263` | 6 | 8 | 5 | 2/3/0 | 2/3/0 |
| #325 | `449f6871a1d2f630355a1d1f2d8cb9ba46060a3c` | 1 | 27 | 11 | 2/5/4 | 3/3/5 |
| #324 | `f1a2c564046ab93a0bfa0732e3acc2179da9c064` | 7 | 77 | 54 | 48/6/0 | 42/7/5 |
| #318 | `ec741eca901aef062f3d472b33c5a8b451cec299` | 4 | 11 | 10 | 0/2/8 | 0/2/8 |
| #317 | `69e741d7c7d8874c22467e2d30791e30c009ff6e` | 10 | 138 | 101 | 98/3/0 | 98/3/0 |
| #312 | `26d2f278b9e85e8fc0b0c04307b7a87bdd2e8254` | 5 | 65 | 51 | 0/3/48 | 0/3/48 |
| #309 | `a24006624380570bd693a768e97a0c689f1d42b5` | 6 | 47 | 35 | 5/2/28 | 0/2/33 |

## Newly identified baseline delta (main to I2J)

24 non-doc paths present on main but absent from I2J; 29 same-path non-doc blobs differ. This is an older research-base difference, not an instruction to rebase or bulk merge. Ten missing paths are exact original #309/#324 contributions already on main. Keep main as the base of eventual release review. Do not remove these accepted main paths or overwrite current shared runtime files when extracting I2J. The following manifest records all missing paths with exact main blob identities:

| Path | Main blob |
|---|---|
| `.github/workflows/audit-pr-full-inheritance.yml` | `a3cb8c70e87f010afeedb106f7579b40a6ba9ad2` |
| `.github/workflows/forge-trigger-acceptance-audit.yml` | `e752a5cc2626346726db3a86c56ffda0c9ae8ddd` |
| `.github/workflows/validate-handoff-continuity.yml` | `a2c9fbffaa739c41654af9d0f0becaab2bedeb76` |
| `.github/workflows/validate-spell-engine-original-pr-preservation.yml` | `0f924850f08fafad75e33a9ac2d5b6b34c6782ff` |
| `.github/workflows/validate-spell-recipe-p1-extraction.yml` | `ebfffc41036229c39a8fb81c1bed73e57de5a561` |
| `.github/workflows/validate-t28-p0-epoch-source.yml` | `1b6fbd5280b7a96e51ef42c6455a85e7d94e7954` |
| `scripts/agents/check_handoff_continuity.mjs` | `ea63a734ecf17a2215c9362376d464232929c953` |
| `scripts/agents/forge_automation_selftest.mjs` | `6d4dc315449958a3862130de739ed691773b00cf` |
| `scripts/agents/forge_trigger_acceptance_ledger.mjs` | `3a12039f69d25eb968b37eda39c09839a13cb8ae` |
| `scripts/agents/forge_trigger_acceptance_receipts.json` | `ddcd17bc15aaf4f75e8c0aa07c7faed69f86fe5e` |
| `scripts/agents/forge_trigger_audit.mjs` | `d5fbf344c5e92f8dc3e620806baded0fbb31f7ae` |
| `scripts/agents/render_open_pr_index.mjs` | `60690570eb72cab441b9e38bca1281afb8a6fe2e` |
| `scripts/agents/test_handoff_continuity.mjs` | `302d8efb684237a9a7714f67ba4b08858f2976d9` |
| `scripts/agents/validate_open_pr_index.mjs` | `ae0032dbf0aa9cb64856991d218b3ceab8c4e015` |
| `scripts/audits/review_pr_full_scope.mjs` | `796df91417b4304280085b6ae9c8e6bdecb99666` |
| `scripts/audits/validate_recent_pr_scope_register.mjs` | `a8b642e36545114eafa6f0d6cf0fadd6c5db39b8` |
| `scripts/audits/validate_spell_engine_full_pr_preservation.mjs` | `f9b09412af630584baaf093b7951484545addb3a` |
| `scripts/fixtures/spell_recipe_p1_examples.mjs` | `7f17794e64ed4e7fad868dbfdc6f22598d93cf2c` |
| `scripts/integration/c34/test_t28_actor_epoch_candidate.mjs` | `96fd56e9688d9fcd9b1fe39ffb111268e0241750` |
| `scripts/validate_spell_recipe_preflight_p1.mjs` | `096b5a9b8f21209fa5f5dc24b81290f5f2f3435f` |
| `scripts/validate_spell_recipe_schema_p1.mjs` | `9f9a906e77cb87497e81a894c1a62f523b6966a6` |
| `utils/c34/actorRequestEpochCandidate.mjs` | `0ec38f07fd3c84c59289c00f76748ab326b37834` |
| `utils/spellRecipes/preflightSpellRecipe.mjs` | `67293267ea85196642e81b0e0e7bba2760620c0c` |
| `utils/spellRecipes/validateSpellRecipe.mjs` | `7946af0e8aafca8ea15f5a0c08c8ae715b91ea39` |

All 29 different same-path non-doc paths (require individual reconciliation, not automatic overwrite):

- `.github/workflows/research-docs-maintenance.yml` — main `bdb98018fc4077da4a59fa594d3359a54c7e298b`, I2J `ccd79fe4a3b3f26edf6d71c964cbaf27278112b9`
- `.github/workflows/validate-forge-immutable-creation-replay.yml` — main `839154a9c7c942e90fbb46b3d9c068ff056cc042`, I2J `da309d1e8494f2a5efa6b90fe3bbff8b2f78117c`
- `components/MapPageClient.js` — main `61f8738da2ca3d8635b5a413bfdc18c094228a0a`, I2J `3e6bf39d48de6f28aac90f6bac1400fa9a00bf1f`
- `components/NewNpcModalV3.js` — main `5b4f3cc4e56a0055b57d7ae792ed77c7d3fdcead`, I2J `27c8aa95bf95c88adeb80274e7139dbe17270098`
- `components/NewNpcModalV3Refined.js` — main `1772c63392532cfde5661d5d7c5a95352bff25e6`, I2J `3ddcbb6672d9a1655de1bca626317b1bb857bd34`
- `components/NpcForgeStepContent.js` — main `c4899549592e898ebbf5f07a9627c9378afec446`, I2J `a7b17e898c4634aacb98d33ca1db399039866295`
- `components/NpcPanel.js` — main `e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db`, I2J `606db96649dcdf6646afbd4d24f67a6fc54426eb`
- `components/PlayerCharacterProfilePanelUnified.js` — main `8a561e51eafd9e8507db7a4d3f15fd4699d6d1b8`, I2J `d4500ee5aacb11e69bb666b33d587fd8a4b4839a`
- `components/town/TownCrafterInteractionPanel.js` — main `345629409b45cd5da5bf305a8124fbbe46ec0d15`, I2J `6be8eb9e041d74f784d136e672c0df9d2d27774d`
- `pages/_app.js` — main `e5f68c0abb293089d6ad09d4e3e4035612eac598`, I2J `5a1981d58af0f0b99519538093157d27a0d60d35`
- `pages/inventory.js` — main `02d52821d0f22aa82ad92263c5014712906ee385`, I2J `de0a9e7d787365998a7f08815a330d706bc8f54d`
- `pages/npcs.js` — main `7fc00b9b3ace6233d1648a3d017f8a05e072d722`, I2J `2e08fa07384958478f323516c4e1b342228bd436`
- `pages/town/[id].js` — main `a4e790e5941afb16660a112ee9189e4a84d4afb7`, I2J `22aeb1c18f148ab84e24d1da67b9a2f9d47949ce`
- `scripts/agents/project_health.mjs` — main `14dea3a29291e959ebba7f37a3c8a98a8b4c17fa`, I2J `3ad86c916e7495529d1df1b7d939cbb007d96b43`
- `scripts/agents/validate_research_docs_maintainer.mjs` — main `1fc5ae82f3f6e3da6cbb61aebd4cb01efc2a163a`, I2J `bceaee41d7536a288d33c5fe501c7d3576a9373f`
- `scripts/fixtures/forge_creation_replay_local_auth_pg17.sql` — main `3da82b85babbb37d4aee1744e22ec24716082997`, I2J `aa701c679712475cd4f04d4e0a01fedc4616bafa`
- `scripts/test_forge_immutable_creation_replay_local_auth.mjs` — main `0535c5d1d5a60ca5b027b3cd3b7e36f19b7e51bf`, I2J `e065b455edb2703829a307697aac1d3c902460cf`
- `scripts/validate_character_forge_resilience.mjs` — main `f53515db442a198bea6baa90d2ed40142b63d2ae`, I2J `3b726eced223cbca4528a54221a643569bb447d8`
- `scripts/validate_forge_immutable_creation_replay.mjs` — main `00d85baf34bac0813036724dfe57d29c32b712ad`, I2J `f206e6250aef3075049ea619e117ad38709d7f34`
- `scripts/validate_forge_inventory_ui_release_contract.mjs` — main `2f44b365b84ebe8611baad5299e2b7040a8cd81f`, I2J `9fb2bcb008d700659503710da77945c2e449a364`
- `scripts/validate_forge_seeded_warlock_child_completion.mjs` — main `86e6be9502fdc37ad1fc073ee2461198a414c463`, I2J `d469363de4f20983386f733ca05d43356cbfaf74`
- `scripts/validate_handoff_registry.mjs` — main `65f7603eff4719aa0995d0908db51cd3982f44cd`, I2J `23c9206e04f2653ea6e693ce61e3c11f01dc70ed`
- `scripts/validate_player_forge_multi_legacy_sheet_candidate.mjs` — main `c1e2be5818c72b413c6ea662f2dcf6e928b9bc7d`, I2J `95a537f19cc8f822e801082cc5a9600b43e330fb`
- `scripts/validate_player_forge_starting_magic_v3.mjs` — main `3a47944d093c357137f22126c318e5b931f8132b`, I2J `e66ab7f7d38a3ceb1482a9a15f9f22a5f30f48d7`
- `scripts/validate_printable_character_sheet.mjs` — main `5f2580d6c3b559d9b3c1459f28c3625d2b6138de`, I2J `1d3825a0a540eb6fb42482376b018c05d7d79917`
- `scripts/validate_security_hardening_roadmap.mjs` — main `b216a78fb116edc5ec325cd48af961e7ca190bba`, I2J `f7b2b39ed6bfb38694af5f8d341d72acf7bace3d`
- `scripts/validate_town_crafter_interaction_component.mjs` — main `df5e99047c1d2b483e2c52085eb1e82cc500efb4`, I2J `25d6d25e4b088d5f0f55be8e328343a163b4d401`
- `scripts/validate_unified_character_forge.mjs` — main `2dd655d9ee9bb81fa8c62d73c29ee63b392b91f2`, I2J `e124d1d752254099fa756388cefe1a47997d8293`
- `utils/officialCharacterSheetPdf.js` — main `a11c3432b40aa938c572d543ecb2e9316878cce2`, I2J `c3ba3651e2e3d8aafbae3b4ad195d53ee25199f0`

## Decisions / remaining scope

- #371/#364/#363/#362/#361/#360: all 35 non-doc PR-path entries present on I2J; 32 exact, three changed. #352–359: all 30 entries present, 24 exact, six changed; five PRs share the evolving I1-G runner, #356 additionally has a changed workflow. Do not claim these later runner revisions are semantically equivalent without reviewing inherited assertions.
- #345: all 72 non-doc entries exact on I2J; C34 has eight exact, 24 different, 40 absent. This establishes preservation on I2J, not approval of privacy/Stage4 release.
- #379: 324 non-doc entries exact on its own head; main seven exact, one different, 316 absent; independent Agent A scope remains intact.
- #309: 28 same-path non-doc entries absent on main, C34 and Agent C. #312: 48 absent in all three. Agent C has five exact and three different #309 entries, and three different #312 entries. This is not a judgment on Agent C's independent docs/ledger work. Original refs remain intact; preserve full spell and delegation depth, not just extracted P1 utilities.
- #318: eight absent on main, I2J, C34, Agent C; two shared paths different. Independent Admin inbox and scoped permissions feature remains held. No duplicate agent work or cross-branch writes.
- #325: four original paid-agent workflow/controller files absent in main, I2J and C34. Integrate last only with separate authorization; do not activate.
- #392: seven documentation paths, seven successful workflow runs; unmerged at observation. Do not infer policy merge or expand permissions from CI alone.
- The completed Dropbox archive inventory is not repeated. No private file contents or fingerprints copied from Dropbox in this receipt. No hosted SQL, production runtime, map, agent, original branch/PR disposition or deployment change.
- **ONE NEXT unchanged:** additive source-pinned disposable UI read/catalog composition and actual mounted Story Forge-to-v5 acceptance on same created ID. Prior LIFE-01–04 remains accepted at its tested scope. Full historical line-by-line review and source/consumer parity are not complete; source counts do not authorize retirement.
