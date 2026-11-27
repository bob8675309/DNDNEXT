# Signed standalone rest and shared spell recharge

## Source and scope

Owner I2J `8ef9388dc935dcb20b397a9034f72450864189c8` already contains the accepted repeatability and resource stages. The owner signed workflow [46036041096 / job 140631582292](https://github.com/bob8675309/DNDNEXT/actions/runs/46036041096/job/140631582292) now reports success for the integrated signed step and teardown. No duplicate transfer. This isolated stage follows all 39 existing checks in the same disposable runner and leaves their bytes unchanged.

Migration 03 (`f96a3788334fe306374dfd4b5fdf4e00992d3924`) supplied initial rest, resource tables, slot sync, slot/use RPCs and public ACL. Migration 90 (`2bd48d73398a3e9095b61ee288c0377d464edfc6`) is the latest located public rest orchestrator on the reviewed branch and main. It extends rest with the source-backed Rage helper. The checked-in I1-P capture (`039868c4ac5cdd62e0efc1e46f584df2bdc34a9c`) supplies the previously recorded original function definitions. The runner compares their bodies to the public migrations and checks installed full definition MD5s:

| Function | Expected MD5 |
|---|---|
| `public.complete_character_rest_v1(uuid,text)` | `fffbf0705d640a7d2bfb08aa78ad521a` |
| `private.restore_character_rest_action_state_v1(uuid,text)` | `d75edf2ac583e3790882155c702e2165` |
| `private.character_sheet_resource_profile_json_v1(uuid)` | `2c798f8351282d80e63ab8e9e9019272` |
| `private.sync_character_spell_slots_v1(uuid)` | `6c276ab2135fb90894fd8684e39ce1c3` |
| `private.can_manage_character_progression_v1(uuid)` | `ac70e4ec033d86c4e0a254d50d429a45` |

Migration 43 resource-label serializer (`e05efb5a320f0e0981103c9d41b4f1402e5336f4`) is part of the captured profile chain. The fixture composes original migration 06 (`be7844fe16b14b73f4fb03f68069f9eb0af3dbf8`) active-encounter guards and profile v2 over minimal disposable encounter rows. No competing rest logic, synthetic auth claims, maps or tactical spend mirror are installed. The short-rest spell is a synthetic resource row input to the real rest and use RPCs. Warlock exercises the unchanged non-Barbarian branch of the original helper. It does not exercise Rage or its account mirror writes. The recorded body parity demonstrates a bounded historical/captured composition, not current restored production graph parity.

Later rest consumers include pending choice projection (89), Wizard Memorize (74/75), Cartomancer (72/73), and species/feat expiry triggers (52, 63/65, 68 and 71). These rely on rest receipts or their own source effects. Their trigger graph was not installed or inferred from standalone spell recharging. The Wizard Signature overlay trigger is also outside the synthetic Warlock cohort.

## Consumer and consolidation requirements

| Consumer | Compatibility requirement |
|---|---|
| Character Sheet Enhancements and Resource Tracker | Preserve signed rest RPC, busy-state guard and profile v2 encounter lock. Keep assignment identity in summary updates instead of name-only matching, and refresh both the profile and source-disambiguated display after rest. |
| Spellbook | Catalogue lookup may use spell ID. Known rows and assignment actions need assignment ID so two grants can display independent recharge and remaining uses. |
| Tactical UI and adapters | Preserve existing deployed adapters, picker assignment ID and encounter authority. The rest-log veto and profile lock are tested on synthetic encounter rows. Actual casts, slot mirroring, tactical snapshots and same-name presentation need separate signed/browser evidence. |
| Later feature families | Reuse cadence, assignment-delta and rollback assertions through their actual resource authorities and rest-log consumers. Test each source's policy without cloning the rest operation. |

The owner acceptance slice is this stage, its evidence and minimal invocation in the existing owner workflow after the already consolidated stages. Leave the owner branch admission policy intact. Verify the exact owner head with all stages and teardown before research consolidation is accepted. Preserve original PR creation/advancement, source pins and negative evidence. No claims of original PR completion, deployment or restored production parity.

**Next executable deliverable:** stage the original migration-34 `private.remove_source_owned_origin_feat_v1(uuid,text,text,text)` helper on a disposable signed path and verify it removes only the selected occurrence's spell assignments and effect claims while preserving the sibling source and shared proficiency.

## Signed evidence

Exact executable `eaf33448bb899a4ff4c176b4709c1e76b43897b3` passed [signed run 46039510266, job 140643347799](https://github.com/bob8675309/DNDNEXT/actions/runs/46039510266/job/140643347799#step:7:1). GitHub reports success for disposable startup, the unchanged 39 cases, REST-01..07 and teardown. [Tactical preservation 46039510317](https://github.com/bob8675309/DNDNEXT/actions/runs/46039510317) and [research docs 46039510343](https://github.com/bob8675309/DNDNEXT/actions/runs/46039510343) succeeded. Direct step-log retrieval returned HTTP 404. The completed fail-closed signed runner required these outcomes.

| Check | Result |
|---|---|
| REST-01 | Both Magic Initiate assignments began at 0/1, the short-rest fixture at 0/2, and signed slot use left pact capacity at 1/2. |
| REST-02 | Short rest restored two short-rest uses and one pact slot. The two long-rest assignments stayed exhausted and byte-identical. |
| REST-03 | Invalid rest type and viewer/outsider requests failed with `22023` and `42501`, preserving state. |
| REST-04 | Long rest restored both Magic Initiate assignments, one expended short-rest use and one pact slot. Assignment identity, casting stats, source metadata and previous receipts were preserved. |
| REST-05 | At-cap rest restored zero uses or slots and recorded exactly one new receipt without duplicating or modifying spell grants. |
| REST-06 | Original guard blocked the signed rest at full pools with `55000`, rolling back the attempted rest receipt and any slot-sync change. Profile v2 reported the synthetic active encounter. |
| REST-07 | Subsequent assignment-ID spend changed only the INT assignment. WIS and short-rest rows, other characters, associated effects, sheets, account state and function fingerprints stayed intact. |
