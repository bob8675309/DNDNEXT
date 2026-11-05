# P1.3 — Original attack roll / timed effects and equipped-weapon authorization (2026-11-03)

> **VERIFIED IN DISPOSABLE REAL-JWT CI ONLY. NOT A PRODUCTION FIX.** [Original attack-roll run 41697462487](https://github.com/bob8675309/DNDNEXT/actions/runs/41697462487) passed cases **106–116** at earlier source/test SHA `b722f0b`. [Combined original roll + weapon run 41698384117](https://github.com/bob8675309/DNDNEXT/actions/runs/41698384117) passed cases **106–128** at source/test SHA `b6acf77e022396e33443f84dfce0913bd878ae71`. Existing earlier cases 48–105 also completed successfully in the same combined GoTrue workflow. The research PR remains [draft #317](https://github.com/bob8675309/DNDNEXT/pull/317), unmerged, against unchanged production `main` baseline `51c351a142d03378dff8e47e05182afe21a15622`.

## Original live source identity, read-only verified

These function definitions were retrieved with SELECT-only queries from live DnDWeb on 2026-11-03. Their original exact bodies run in synthetic PostgreSQL 17 research fixtures:

| Source | Live `md5(pg_get_functiondef(...))` | Fixture |
| --- | --- | --- |
| `private.encounter_resolve_attack_roll_v1` | `25af82e66a082a36e8105bad0187b271` | [exact attack-roll source](../scripts/fixtures/p1_3_original_attack_roll_live_pg17.sql) |
| `public.encounter_weapon_profile_internal_v1` | `6b014bbd7eba8774a5f6837d2bd0b3a6` | [exact weapon source](../scripts/fixtures/p1_3_original_weapon_profile_live_pg17.sql) |
| `public.encounter_opportunity_attack_internal_v1` | `276e5fd1c210b3e6f532b0819b87a62b` | [prior exact source snapshot](../scripts/fixtures/p1_3_reaction_attack_damage_live_pg17.sql) |
| `public.encounter_apply_damage_internal_v1` | `53afa5d760a7b6c1a4cc3f837bc7e067` | same prior source snapshot |

Source names/privileges were independently read from the live database; no live data, source code, EXECUTE grant or auth record was modified.

## A. Real random D20 and timed-effect X consumption

[Scratch fixture](../scripts/fixtures/p1_3_original_roll_timed_effect_pg17.sql) replaces only the **synthetic deterministic roll stub** with the original private attack-roll implementation, and adds the source-required `created_at` column to the disposable timed-effect table. It retains the previously source-exact reaction, unarmed attack and damage processors and authenticated guard; rolls use actual PostgreSQL `random()`, so tests assert properties and derived effects rather than lucky outcomes. [JWT runner](../scripts/test_p1_3_original_roll_timed_effect_local_jwt.mjs), **cases 106–116 PASS**:

| Case | Verified |
| --- | --- |
| 106 | Three distinct genuine GoTrue JWT accounts and real original roll source |
| 107 | Guiding Bolt next-attack advantage locked, consumed, logged and uses higher of two D20 rolls |
| 108 | Vicious Mockery disadvantage locked, consumed, logged and uses lower of two D20 rolls |
| 109 | Advantage and disadvantage cancel; both X effects consumed and logged |
| 110–111 | Exact/simultaneous same-UUID replay returns same random result with one effect and one reaction spend |
| 112 | Suppressed Opportunity Attack rejects without consuming X/HP/reaction or leaving a command ledger |
| 113 | Two different requests racing for one reaction consume one X, one window and one attack |
| 114 | No active X effect rolls one ordinary D20 |
| 115–116 | R2 revocation, outsider, anonymous and direct-source attack access denied in scratch |

**Important limit:** This proves selected original X consumption *behind one isolated E-first guard*. It is **not** the full E/P/W/L/X/S/C global cross-command lock-order proof. A different original writer may acquire X first and deadlock with E/P; attack versus End Turn / Admin / shared slots has not been universally proven.

## B. Exact deployed weapon profile and item authority

[Scratch equipped fixture](../scripts/fixtures/p1_3_original_equipped_weapon_research_pg17.sql) replaces the previous always-null weapon-profile stub with the deployed function and models character inventory, item catalog, equipped status, character sheets, class proficiency and item ownership. The original attack roll, outer reaction, internal Opportunity Attack and damage source execute unchanged. A **separate, scratch-only equipped reaction research RPC** is exposed to signed-in JWTs; the normal guarded candidate's Attack branch remains GM-assisted until release acceptance. [JWT runner](../scripts/test_p1_3_original_equipped_weapon_local_jwt.mjs), **cases 117–128 PASS**:

| Case | Verified |
| --- | --- |
| 117–118 | Real signed JWTs; source-owned, equipped melee weapon uses original proficiency, actual D20 roll, HP damage and one reaction |
| 119–120 | Unequipped weapon and equipped ranged weapon rejected without damage or spent reaction |
| 121 | Weapon equipped by a different actor cannot be substituted; an owned item works afterward |
| 122 | Exact replay succeeds; same UUID with a changed weapon instance fails typed intent check |
| 123–124 | Concurrent same-UUID and different-UUID attack races create only one window/HP/log result; source 10-ft reach profile accepted |
| 125 | R2 controller revocation blocks replay of previously cached equipped attack |
| 126 | **Current source behavior:** player-owned item is rejected when only `can_control=true` and `can_edit=false`, despite active combat controller; after `can_edit=true`, the source permits it |
| 127–128 | Outsider, anonymous and direct internal profile access rejected; independent equipped melee source path passes |

The **case 126 observation is NOT an instruction to grant editing rights**. It exposes a missing combat-only equipment authorization boundary: permitting a character/NPC combat controller to use gear should not require access to private sheets, inventory editing or hidden NPC details. Preserve the existing privacy boundary and design an explicit, server-validated equipped-gear authority before deployment.

## Boundaries and missing proof

- **Synthetic inputs remain:** equipped inventory/item/catalog/character-sheet tables are disposable models; canonical ability stats and equipped damage mitigation remain test doubles, though the original weapon profile, D20 roll, reaction, HP mitigation processor and timed-effect logic are source-exact. No full equipment/class rules parity or browser test is claimed.
- **Inventory source locking remains unproven:** the original weapon profile reads `inventory_items` without a matching `FOR UPDATE` lock. A concurrent unequip/transfer may create stale eligibility even if E/P/W are locked. Prove equip/transfer versus attack and its correct lock class.
- **Full E/P/W/L/X/S/C and grant graph remains open**, including real NPC `can_control`, R3 service principals, character resource bridges, Admin admission, expiry triggers and TC1 Option A. Tests for a few deterministic/signed-in schedules do not establish deadlock freedom.
- **Concealed timing is still open:** owner's preferred player label `Unknown Events` passed a bounded response-projection model, but the timing of responses, hidden first-execution and actual browser subscriptions require separate acceptance.
- **Production unchanged:** legacy public RPCs, their original grants and their known replay problems remain present. No migrations, Supabase SQL, auth/permission changes, PR merge, deployment, world/town maps or AI changes. No Docker installation/manual testing is required from the owner.

**Next single task:** Build a disposable, source-derived equip/transfer versus Opportunity Attack **inventory-row lock race**, and design an explicit combat-only equipped-item permission separate from `can_edit`; then test that design with actual `can_control` JWTs, both hidden and visible actors, and no sheet/inventory disclosure. Integrate that lock into the global E/P/W/L/X/S/C/grant graph alongside the real slot and Admin/expiry writers. Separately resolve concealed-event timing before browser acceptance.
