# Owner I2J integration candidate — Magic Initiate

## Scope and inheritance

Integrate the historical signed advancement regression and its receipts into owner I2J at `8a6f99d4895148229bf40fe11c3254ee1a93447e`. Reviewed live main `be1b20d9cab2ce45205a4cbe8d25ac540fceebf0` and isolated remote head `36bb1f7878df51dd3bab1cdb13104c67c0eea886`. The candidate keeps the owner workflow byte-identical and changes no runtime code or schema. The historical runner blob matches the signed executable `b28544f007779587c95ff961c60df106a9baa3fa`. Review follows main's onboarding, full-PR protocol and I0/I1 phased plan.

| Original | Immediate base at review | Original head | Live state | Changed paths versus base / main / owner |
|---|---|---|---|---|
| #332 | #331 `7f092ab329653e02dd5436dc7caf4a547d91ce73` | `8f7647535b8e7b900d5884b9256f3465d0933a5e` | Draft | 10 / 272 / 482 |
| #333 | #332 `8f7647535b8e7b900d5884b9256f3465d0933a5e` | `a34e1f23579b2a669004deed022fa6b41287bd97` | Draft | 6 / 272 / 482 |
| #334 | #333 `a34e1f23579b2a669004deed022fa6b41287bd97` | `0527f945269b6df32ad1f5c32fbe0434082d52f8` | Closed on GitHub | 8 / 268 / 479 |

Counts use complete recursive Git tree comparisons and include path additions, deletions, mode changes and blob changes. Main/owner comparisons are endpoint tree diffs, so they also show later target-side changes. The accompanying TSV inventory identifies each changed path, both object IDs and its preservation disposition. An exact blob match establishes source presence. The full inherited tree has not been accepted for feature or release parity.

## Original sources and preserved work

- **#332 — J164–J166.** Source-qualified catalog and dependent Agonizing Blast/Eldritch Blast, signed original v3 creation, omitted dependent child rollback, canonical grants and nonce/stock controls. Main and owner already carry the two exact SQL fixture blobs. Keep the latest J164–J168 runner that includes these cases and the later J79B rollback control. I2J adds signed advancement rollback evidence for nested feat acquisition, a different entry point from creation.
- **#333 — J167.** Main and owner retain the manually constructed source-only payload, no legacy parent, canonical grants/spells and inert replay in the later cumulative test. Preserve this control independently of J168. I2J adds no claim about browser serialization or creation parity.
- **#334 — J168.** Main and owner have the exact serializer wire helper `a90013d3dbb590af4dfae76e87863453daa04d9b`, final specimen `f30c9d25f39acfaab214a3135c6b7be34d21aea6`, validator and Forge workflow. Their signed Forge runner `0535c5d1d5a60ca5b027b3cd3b7e36f19b7e51bf` differs from #334's `3f5db10af33ecb1e635d7f4480053ee9928b6007` only by the additive J79B negative test. Preserve this successor in place. The test uses actual pure serializers. Mounted browser and complete trigger/RLS/catalog parity require separate evidence.
- The I2J bridge, SQL blobs for migrations 08, 24, 26 and 34, original v5 body, historical caller/trigger fixtures and both uniqueness indexes retain the exact pins in the [repeatability dossier](I2J_REPEATABLE_ORIGIN_FEAT_ACQUISITION_2026-11-27.md). No upstream fixture, public SQL or Forge gate is overwritten.

### Immediate path dispositions

`exact_copy` means an existing exact blob on main or owner I2J. `deferred_preserved` means the precise original remains in its pinned head. For older fixture/test versions the descendant behavior is described above. Original worktree handoff prose stays in its original history. The named Forge child-completion dossier is absent at that path on main and owner. Its original receipts remain reachable at the three pinned heads and need a durable documentation disposition in a full Forge preservation review.

| PR | Immediate path | Original blob | Main blob | Owner blob | Disposition |
|---|---|---|---|---|---|
| #332 | `.github/workflows/validate-forge-immutable-creation-replay.yml` | `fee2f6cd7e9b849bd854255a16778c97573a8051` | `839154a9c7c942e90fbb46b3d9c068ff056cc042` | `839154a9c7c942e90fbb46b3d9c068ff056cc042` | deferred_preserved |
| #332 | `docs/ACTIVE_WORK.md` | `bfaa82fac651c26b7d768cd912ad6b7cddda47a8` | `46054fd4d9f66e53ab3f7241446cac7ae554bff2` | `a0f367afc256314018bae786c8e887e306ced991` | deferred_preserved |
| #332 | `docs/Forge_Original_Creation_Trigger_Coverage_2026-11-05.md` | `5d3a32c5b6661e47b36794bfe7723296c4b0631b` | `5d3a32c5b6661e47b36794bfe7723296c4b0631b` | `5d3a32c5b6661e47b36794bfe7723296c4b0631b` | exact_copy |
| #332 | `docs/Forge_Warlock_Child_Completion_2026-11-06.md` | `f17aa8fb573581ef1fc40f9af869646d0e8a9b03` | `—` | `—` | deferred_preserved |
| #332 | `docs/HANDOFF_LOG.md` | `eef183e555a37cfef4f57b892841d580943c40ee` | `11b84b944cdadd115abf90ef3035c6901592c731` | `89fdd12132405835bdceff750927b0ca689d067a` | deferred_preserved |
| #332 | `scripts/fixtures/forge_seeded_warlock_child_completion_v1.json` | `9b8d222774854a44b2a0c968a9fb48582489505f` | `f30c9d25f39acfaab214a3135c6b7be34d21aea6` | `f30c9d25f39acfaab214a3135c6b7be34d21aea6` | deferred_preserved |
| #332 | `scripts/fixtures/forge_warlock_child_completion_local_auth_pg17.sql` | `94fa076d8e3e075aab551a5610bcff79393f3460` | `94fa076d8e3e075aab551a5610bcff79393f3460` | `94fa076d8e3e075aab551a5610bcff79393f3460` | exact_copy |
| #332 | `scripts/fixtures/forge_warlock_preferred_spell_original_pg17.sql` | `f9bf748582986a452110f9b5c326cead61e76374` | `f9bf748582986a452110f9b5c326cead61e76374` | `f9bf748582986a452110f9b5c326cead61e76374` | exact_copy |
| #332 | `scripts/test_forge_immutable_creation_replay_local_auth.mjs` | `8ea8fbf960fe031fadaa841f8eccec825e4ba9e3` | `0535c5d1d5a60ca5b027b3cd3b7e36f19b7e51bf` | `0535c5d1d5a60ca5b027b3cd3b7e36f19b7e51bf` | deferred_preserved |
| #332 | `scripts/validate_forge_seeded_warlock_child_completion.mjs` | `09748f626fd33c04ea2dfc626878bc9cbe4323cd` | `86e6be9502fdc37ad1fc073ee2461198a414c463` | `d469363de4f20983386f733ca05d43356cbfaf74` | deferred_preserved |
| #333 | `docs/ACTIVE_WORK.md` | `4c3621978fc8b7028704a5335b78665d81808968` | `46054fd4d9f66e53ab3f7241446cac7ae554bff2` | `a0f367afc256314018bae786c8e887e306ced991` | deferred_preserved |
| #333 | `docs/Forge_Warlock_Child_Completion_2026-11-06.md` | `dfbb84cc5b65fd2cedd08ea6d9837efed4815c9a` | `—` | `—` | deferred_preserved |
| #333 | `docs/HANDOFF_LOG.md` | `422c53b99cfe530894815bbeb0be182b0dd2e9bf` | `11b84b944cdadd115abf90ef3035c6901592c731` | `89fdd12132405835bdceff750927b0ca689d067a` | deferred_preserved |
| #333 | `scripts/fixtures/forge_seeded_warlock_child_completion_v1.json` | `b6a8c90f1d6ac4ba756d81531d7db7c97cd8d8e4` | `f30c9d25f39acfaab214a3135c6b7be34d21aea6` | `f30c9d25f39acfaab214a3135c6b7be34d21aea6` | deferred_preserved |
| #333 | `scripts/test_forge_immutable_creation_replay_local_auth.mjs` | `a398c5d42f2e3aa420b804f2b8c0284d90981014` | `0535c5d1d5a60ca5b027b3cd3b7e36f19b7e51bf` | `0535c5d1d5a60ca5b027b3cd3b7e36f19b7e51bf` | deferred_preserved |
| #333 | `scripts/validate_forge_seeded_warlock_child_completion.mjs` | `4b17edb5ee0af57328db02a6ecf15b0078015f3c` | `86e6be9502fdc37ad1fc073ee2461198a414c463` | `d469363de4f20983386f733ca05d43356cbfaf74` | deferred_preserved |
| #334 | `.github/workflows/validate-forge-immutable-creation-replay.yml` | `839154a9c7c942e90fbb46b3d9c068ff056cc042` | `839154a9c7c942e90fbb46b3d9c068ff056cc042` | `839154a9c7c942e90fbb46b3d9c068ff056cc042` | exact_copy |
| #334 | `docs/ACTIVE_WORK.md` | `0ac548ef88b359eb22869f6f997a624af65b5b4d` | `46054fd4d9f66e53ab3f7241446cac7ae554bff2` | `a0f367afc256314018bae786c8e887e306ced991` | deferred_preserved |
| #334 | `docs/Forge_Warlock_Child_Completion_2026-11-06.md` | `fe2fd5083d94649ebe01eef6607742404aab751d` | `—` | `—` | deferred_preserved |
| #334 | `docs/HANDOFF_LOG.md` | `8bf97b01892f11d1754ffa616bcdd82d93121b44` | `11b84b944cdadd115abf90ef3035c6901592c731` | `89fdd12132405835bdceff750927b0ca689d067a` | deferred_preserved |
| #334 | `scripts/agents/forge_warlock_client_wire.mjs` | `a90013d3dbb590af4dfae76e87863453daa04d9b` | `a90013d3dbb590af4dfae76e87863453daa04d9b` | `a90013d3dbb590af4dfae76e87863453daa04d9b` | exact_copy |
| #334 | `scripts/fixtures/forge_seeded_warlock_child_completion_v1.json` | `f30c9d25f39acfaab214a3135c6b7be34d21aea6` | `f30c9d25f39acfaab214a3135c6b7be34d21aea6` | `f30c9d25f39acfaab214a3135c6b7be34d21aea6` | exact_copy |
| #334 | `scripts/test_forge_immutable_creation_replay_local_auth.mjs` | `3f5db10af33ecb1e635d7f4480053ee9928b6007` | `0535c5d1d5a60ca5b027b3cd3b7e36f19b7e51bf` | `0535c5d1d5a60ca5b027b3cd3b7e36f19b7e51bf` | deferred_preserved |
| #334 | `scripts/validate_forge_seeded_warlock_child_completion.mjs` | `86e6be9502fdc37ad1fc073ee2461198a414c463` | `86e6be9502fdc37ad1fc073ee2461198a414c463` | `d469363de4f20983386f733ca05d43356cbfaf74` | exact_copy |

## Changes intentionally deferred

| Candidate path | Owner disposition |
|---|---|
| `scripts/integration/i2j/test_origin_feat_pair_historical_signed.mjs` | Take the exact 26-case signed executable blob, with catalog identities, positive cases and expected negative evidence. Main lacks this runner at its reviewed head. |
| `docs/research/I2J_REPEATABLE_ORIGIN_FEAT_ACQUISITION_2026-11-27.md` and this dossier | Carry the historical receipt and review decisions. |
| `docs/ACTIVE_WORK.md`, `docs/HANDOFF_LOG.md` | Prepend the I2J acceptance checkpoint and append receipts while preserving the owner base content. |
| `.github/workflows/validate-i2j-origin-feat-pair-historical.yml` | Leave owner blob `c372365cf665da499bb4d83085461c28fa8c66c7` intact. Omit isolated branch admission. Owner push path already selects the runner. |
| Original Forge and remaining inherited paths | Keep target files in place and original variants in pinned PR trees. Transfer no additional source in this slice. |

The slice can be consolidated as research after owner review and exact-head signed CI. It does not retire #332 or #333, and #334's observed Closed state does not certify that all its inherited paths or feature behavior are integrated. The full Forge decision still needs inherited #324/#328–#331 dispositions, source-authentic creation and modern payload controls in the intended merged graph, mounted browser evidence as applicable, and original trigger, ACL, catalog and recovery gates. The exact source/behavior of historical I2J is bounded by the scratch Option A mirror and validator composition. Restored-source parity, actual casting and rest, replacement and reversible removal are held.

### Proposed shared acquisition contract

| Contract rule | Representative behavior |
|---|---|
| Identity and validation | Resolve a canonical source-qualified option and an authorized acquisition slot on the server. Normalize typed choices from catalog data, then validate prerequisites and option-specific policy before any materialization. Persist stable occurrence ID, acquisition owner, canonical option, normalized choices, policy version and effect claims. A repeated submission of the same request is inert. |
| Nonrepeatable | Reject an existing active grant for the canonical option even if the caller supplies another slot or display alias. Keep the existing Alert/Lucky rollback control. |
| Unrestricted repeatability | Skilled may acquire separate occurrences. Require distinct picks within each occurrence by its rules. Track grants to each occurrence even when a proficiency projection is already true. Do not infer unrestricted permission from a source label or user JSON. |
| Distinct choice | Magic Initiate uses canonical spell list. Elemental Adept uses its rules-valid damage type. Uniqueness is over canonical option family plus normalized discriminator across active grants and all pending grants in one transaction. The acquisition provider may add stricter restrictions, including Lessons requiring a different Origin feat. |
| Cumulative cap | ASI uses validated per-ability deltas. Apply against the locked effective score and source-specific cap with all pending deltas included. Persist the deltas and leave unrelated modifiers intact. Cap checks and concurrency are prospective tests. |
| Source-owned effects and resources | Apply spell and proficiency effects under the occurrence identity. Key spell assignment by character, spell, source type and source key. Treat labels as presentation. Persist per-assignment casting stat, use pool and cadence. Remove an occurrence's own assignments and recalculate shared proficiency from baseline plus surviving claims. Never subtract a shared flag or reset another pool blindly. |

This is a proposed contract. Signed evidence covers the historical acquisition/rollback, repeat discriminator behavior, normalized ownership, and free-cast metadata in the dossier. It does not establish legacy data compatibility, removal or pool consumption and recharge.

### Smallest candidate corrections for disposable testing

1. **Child choice.** Keep the current option-ID check on Lessons and existing cantrip-dependent invocations. Lessons' different-Origin-feat rule requires an explicit source/rules decision before any exception. Where a provider permits repeat picks of one canonical feat, add an opt-in server-derived discriminator policy to the common acquisition validator. Resolve the list or damage type from validated choices, enforce it against persisted active grants and in-flight selections under the character lock, and reject client aliases. Apply before any writes. Staged creation and earned advancement should share the policy. Trace `utils/warlockInvocationChoices.js` filtering and serializers, migration 21 creation and deferred checks, migration 26 earned caller, and migrations 24/34 validation/materialization. For old grants without a normalized key, derive it from recorded source-valid choices or fail closed and report ambiguous rows. Never infer a new key from the display label.
2. **Spell identity.** Keep both original indexes for the baseline RED. In a separate scratch candidate, retain `character_spells_source_identity_uidx` as canonical uniqueness and test replacing the label index with equivalent legacy protection narrowed to rows without normalized feat-instance ownership. Leave display labels/row UUIDs and existing uses untouched. Review migration 08 source-key backfill, migration 04 Forge writers, migration 19 advancement writers, migration 34 upsert/removal, and any SQL conflict targets and label-based lookup before changing index predicate. Verify catalog/RLS and restore impact before considering DDL. Trace assignment-ID consuming updates and resource profile JSON in `sql/20260802_03_character_sheet_spell_resources.sql`, rest dispatch, tactical spell selection and sheet projections. Never merge grants or use pools during backfill. Inventory blank, defaulted, duplicate-key and orphan source rows. Validate constraints and writer compatibility in scratch, then test concurrent writes and downgrade with same-label duplicates explicitly. A rollback that restores the old uniqueness rule after overlap is written needs an explicit data plan.

## Testing and evidence

Prior job [140590379985](https://github.com/bob8675309/DNDNEXT/actions/runs/46023944467/job/140590379985#step:7:1) passed 26 cases and teardown at the exact executable. Owner reports independent retrieval of the case logs, including both rejection paths and teardown. The patch reuses those executable bytes. This is not an owner-branch CI run. On the integrated head run the existing disposable signed workflow and check all 26 cases, body pins, unrelated-character rollback and teardown. Preserve J164–J168 plus J79B in the Forge suite.

For a future scratch correction add signed RED-to-GREEN tests for provider restrictions, canonical duplicate discriminator across independent slots, distinct list/damage-type acceptance where authorized, same-spell independent row IDs and remaining-use pools, invalid second-choice rollback and concurrent duplicate writes. Add source projection and old-payload compatibility checks. Retain original RED assertions in the historical runner.

## Release and rollback

This patch adds research tests and documentation only. Revert the research commit on the target if it must be withdrawn. No schema data rollback is needed. Owner acceptance of the candidate and exact-head existing signed CI are the integration gates. Production schema/behavior, deployment, release, and PR state changes are outside the slice.

**Next executable deliverable:** apply this research patch to the owner-approved I2J head and run the unchanged 26-case disposable workflow, confirming the exact integrated commit with rollback and teardown receipts.
