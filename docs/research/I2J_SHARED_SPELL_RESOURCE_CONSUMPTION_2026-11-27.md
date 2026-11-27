# Signed consumption of independently granted copies of a spell

## Source and fixture

The existing isolated workflow runs the 26 historical and seven candidate checks first, then this consumer stage against the same synthetic character. The first two scripts remain byte-identical. The new stage extracts original slot and rest-log DDL, slot sync, resource profile and limited-use RPC definitions and ACLs from public migration `sql/20260802_03_character_sheet_spell_resources.sql`, blob `f96a3788334fe306374dfd4b5fdf4e00992d3924`. It uses the previously pinned progression-edit permission function MD5 `ac70e4ec033d86c4e0a254d50d429a45` with real signed editor/owner/viewer/outsider sessions. Reduced fixture admin returns false. The only metadata addition is synthetic Warlock `caster_progression='pact'` for the original slot-sync helper. No alternative resource RPC, manual JWT claims, production data, production grant change, or rest function installation.

The protected write resolves `character_spells.id` and `character_id` together, verifies a limited-use assignment and locks the row. Only its remaining uses and update time change. The private profile returns both `assignmentId` and catalogue `spellId`. Signed profile bootstrap exercises real pact-slot sync before mutation snapshots. RESOURCE-01..06 check each assignment-pool response, preservation of sibling and unrelated rows/slots/rest history, full rollback on denial, original Lessons policy and fingerprints. Negative probes cover exhausted, invalid UUID, unknown UUID, catalogued spell ID substitution, authorized editor with mismatched character, viewer and outsider. Actual tactical casting, rest execution, role-backed admin acceptance and restored-source parity remain separate.

## Consumer compatibility

| Consumer | Verified source behavior | Integration requirement |
|---|---|---|
| `components/CharacterSheetEnhancements.js` resource operations | Calls `update_character_spell_use_v1` with `entry.assignmentId`. Busy-state also uses the assignment ID. The DOM summary helper instead builds a map keyed by normalized name. Same-name assignments can overwrite each other's summary. | Keep assignment ID through summary row construction and updates. Show source/list or casting ability for disambiguation. Add mounted two-assignment checks. |
| `components/CharacterSpellbookPanel.js` | `assignmentBySpellId` stores one assignment for each spell ID. Known selection and details use the catalogue ID. This can collapse two independent grants and target the wrong assignment in details. | Keep catalogue browsing spell-keyed, use assignment-keyed known controls, carry row identity through action payloads, preserve legacy single-row behavior. |
| `pages/encounters/combat.js`, tactical SQL migrations 12/13 | Picker value and RPC parameter are assignment ID. Picker text begins with name and spell level, which may be identical for sibling grants. Tactical SQL binds assignment to caster character. | Preserve deployed adapters. Test visible source disambiguation and actual tactical use with independent resources in a separate signed stage. |
| Resource profile and rest path | Original profile contains separate assignment IDs and source labels but no casting ability in limited-use entries. Migration 03 and later rest SQL restore per row based on cadence. | Verify the scope of consumer changes, add backward-compatible discriminator presentation if needed, and prove actual rest and sheet/tactical states independently. |

## Consolidation

Owner I2J `91d0355a8307dec8ce676225c4c936124e3d53ba` already holds the exact historical runner and signed job 140607517615 per owner verification. Transfer only the candidate and resource stage files plus the reviewed handoff/evidence. Keep the 26-case runner byte-identical. Integrate both stages in order under the owner guard and existing disposable job if approved. Remove the isolated-branch admission rather than cloning the workflow or creating a new branch. Re-run all stages and teardown at the exact owner head. No actual owner write is part of this patch. The earlier compatibility matrix and source-identity policy remain prerequisites for production review.

**2026-11-27 Central correction:** The preceding integration dossier reported #334 Closed. The interactive assistant independently rechecked GitHub and confirmed #334 remains open and unmerged at `0527f945269b6df32ad1f5c32fbe0434082d52f8`. The live head ref matches. The earlier receipt is preserved for history, and source dispositions are unchanged. No PR retirement or state action occurred.

## Evidence

Exact executable `686ad80d12821b1d1253b651f6fe4e61123f1098` passed [signed run 46033844609, job 140624142020](https://github.com/bob8675309/DNDNEXT/actions/runs/46033844609/job/140624142020#step:7:1). Disposable startup, 26 historical cases, seven repeatability cases, RESOURCE-01..06 and teardown reported success. [Docs run 46033844568](https://github.com/bob8675309/DNDNEXT/actions/runs/46033844568) and [tactical run 46033844586](https://github.com/bob8675309/DNDNEXT/actions/runs/46033844586) also succeeded. Direct step logs returned HTTP 404 from this session. The following outcomes were required assertions in the passing runner.

| Marker | Signed result |
|---|---|
| RESOURCE-01 | Original signed resource profile returned both same-spell assignment IDs at 1/1 and the expected pact slot pool. |
| RESOURCE-02 | Editor spent INT to 0/1. The WIS sibling remained byte-identical at 1/1. |
| RESOURCE-03 | Exhausted INT assignment rejected with `22023` and unchanged state. |
| RESOURCE-04 | Malformed UUID rejected with `22P02`. Unknown assignment, catalog spell ID and wrong character binding rejected with `P0002`. |
| RESOURCE-05 | Viewer and outsider rejected with `42501` while the WIS assignment still had a use. |
| RESOURCE-06 | Owner spent WIS independently. INT stayed at 0/1. Unrelated assignments, pact slots, rest history, sheets, accounts, original Lessons policy, triggers and function fingerprints remained unchanged. |

**Next executable deliverable:** on an owner-approved I2J integration head, run the existing disposable job with both added stages, all 39 cases and teardown. Keep the 26-case owner's runner intact and omit isolated branch admission.
