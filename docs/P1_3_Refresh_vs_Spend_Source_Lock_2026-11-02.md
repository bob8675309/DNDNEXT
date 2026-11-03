# P1.3 — Source-Derived Encounter Refresh C→S Versus Spell Spend S→C

**Verified in disposable PostgreSQL 16, NOT production.** [GitHub run 41558043789](https://github.com/bob8675309/DNDNEXT/actions/runs/41558043789) / [job 125661626514](https://github.com/bob8675309/DNDNEXT/actions/runs/41558043789/job/125661626514), tested commit 4831a8e746cae106a0689e1c311cf46914de555b, **all seven GitHub checks PASS**. Tests 17 and 18 passed using deployed function bodies with minimal scratch tables. No deployed app SQL or campaign records were changed.

## Read-only source evidence (2026-11-02)

| Live source | pg_get_functiondef MD5 | Relevant locks and side effects |
| --- | --- | --- |
| private.refresh_encounter_spell_slots_from_characters_v1 | d16af751b63fc3214b2b5d6cc9621160 | Calls sync_character_spell_slots_v1 first (C upsert/delete/unique waits); then deletes and upserts encounter_spell_slots (S), potentially locking S |
| private.refresh_encounter_spell_slots_on_activation_v1 | 2c167384bbd138656a28c342eec8710b | Delegates to refresh helper when activation trigger fires |
| private.mirror_encounter_spell_slot_spend_v1 | b30565d75b05b042c1ad8f9803284486 | Trigger on S decrease, then syncs/locks canonical character slots C |
| private.sync_character_spell_slots_v1 | 6c276ab2135fb90894fd8684e39ce1c3 | Upserts or deletes persistent character spell pools |

The deployed activation triggers are **encounter_spell_slots_refresh_after_active_insert** (AFTER INSERT active) and **encounter_spell_slots_refresh_on_activation** (AFTER UPDATE when entering active). Those source definitions were inspected and are included as comments in [source snapshot](../scripts/fixtures/p1_3_real_refresh_source_pg16.sql), but **were not installed/exercised in this particular fixture**. This distinction matters: a legitimate activation and cast may have status/encounter locks that prevent the two transactions overlapping in the same way. No real gameplay overlap was proven.

The test uses [scratch setup](../scripts/fixtures/p1_3_real_refresh_setup_pg16.sql) and [two-connection runner](../scripts/fixtures/p1_3_real_refresh_race_pg16.sh) after existing [spell bridge fixture](P1_3_Spell_Slot_and_Revocation_PG16_2026-11-01.md). The setup corrects the scratch encounter slot schema to match the actual live id default gen_random_uuid(), adds the required source metadata columns and uniqueness constraint, and uses isolated character/participant/slot IDs.

## Exact PostgreSQL observations

**Case 17 — negative source-derived concurrency test: PASS.** Transaction A first acquires the persistent character spell-slot row C to establish a deterministic schedule, then calls the **verbatim deployed refresh helper**, which synchronizes C and updates snapshot S. Transaction B decreases the **same** S snapshot, firing the verbatim deployed mirror trigger that synchronizes/updates the **same** C pool. PostgreSQL detects a real deadlock in the disposable service and aborts one transaction; an assertion confirms the committed encounter snapshot and canonical slot balances remain consistent. Both function bodies are deployed source, although the external prelock and direct refresh invocation are test orchestration.

**Case 18 — scoped same-order control: PASS.** A disposable transaction locks S before calling the same original refresh helper; another session attempts to spend that S snapshot and waits. Both commit in sequence; S and C balances reach zero as expected. **This is a positive control for just this row pair, not an endorsed universal S-first locking protocol.** Other writers take E/P/W/L/X/permission locks and may require different coordinated ordering.

**First CI attempt and correction:** [run 41557839112](https://github.com/bob8675309/DNDNEXT/actions/runs/41557839112) failed **before the intended race** because the earlier minimal scratch encounter_spell_slots table omitted the deployed id UUID default. This was a fixture mismatch, not a production defect. After verifying the live default via a SELECT-only information_schema query, the fixture was corrected to gen_random_uuid(); rerun 41558043789 passed both tests.

## Actual maintenance writers and permission model

Further live SELECT-only review found public.update_character_spell_slot_v1 and public.complete_character_rest_v1: both synchronize/change persistent character pools C but **do not directly update encounter snapshot S** in their inspected bodies. They enforce separate active-encounter restrictions via the character-spell-slot UPDATE and rest-log guard triggers, and must still be included in the global lock/permission audit. Do not falsely classify those RPCs as a proven C→S route merely because they update C.

The actual C→S route shown here is private.refresh_encounter_spell_slots_from_characters_v1, used by activation triggers. At the audit checkpoint, the live character_permissions RLS included authenticated Admin write policy character_permissions_admin_write and self/Admin select policy character_permissions_select_self; no row-locking revocation contract is thereby established. Source RLS policy alone does not prove transaction-scoped authorization for command replay.

## Safety limits and next gate

**No production deadlock or security exploit was observed.** The fixture's exact deployed refresh/spend functions are executed with mocked schemas and externally forced locks, without real activation/cast RPCs, permission changes, JWT users or the complete trigger graph. Character ownership TC1 Option A is still **one character per active encounter**; this fixture uses a single character/encounter and does not change that policy. The existing historical live overlap remains untouched for explicit GM review.

**P1.3 and P1.5 remain OPEN.** Next task: trace the actual activation-call graph E→C→S against cast command S→C with real public RPC entry paths and valid encounter/turn status; establish whether the inversion is reachable during actual gameplay, then extend genuine signed-in JWT revocation and mixed-version attack/reaction tests. Only afterward consider a single global lock design and separately authorized reversible migration. Do not merge draft PR #317 as an implementation patch.
