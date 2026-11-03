# P1.3 — Original equip/transfer versus Opportunity Attack: item locks and combat-only authority (2026-11-03)

> **DISPOSABLE RESEARCH ONLY. NOT A PRODUCTION FIX.** Source/test SHA `e1fa098200108bed03069cb0a532d1943c02f0cb` on [draft PR #317](https://github.com/bob8675309/DNDNEXT/pull/317). [GitHub GoTrue/PostgreSQL CI run 41701093404](https://github.com/bob8675309/DNDNEXT/actions/runs/41701093404) **SUCCESS** with **cases 129–141 PASS**, four independently signed-in accounts, while original cases 48–128 continued passing in the same workflow. Live `main` baseline `51c351a142d03378dff8e47e05182afe21a15622` was untouched. **No live SQL, grants, player/GM accounts or game changes.**

## Source-verified original item writers

These existing DnDWeb definitions were read **SELECT-only** and saved unchanged in [exact-source fixture](../scripts/fixtures/p1_3_equipment_mutation_live_pg17.sql):

| Function | Live MD5 of `pg_get_functiondef` | Observed inventory lock |
| --- | --- | --- |
| `public.set_character_inventory_equipment_v1` | `84331beab3ab8a19883b2b8747a24bea` | Selects eligible item `FOR UPDATE` before changing `is_equipped` and slot |
| `public.transfer_inventory_item_v1` | `8c373a9d6438cb12baabeb375fd35305` | Selects item `FOR UPDATE` before changing owner and clearing equipped status |
| `private.can_access_character_v1` | `97b5e6b059e6467e24c4283fe420c83e` | Authorizes inventory operations via `can_inventory OR can_edit`; no combat-controller shortcut |

The deployed `public.encounter_weapon_profile_internal_v1` MD5 is still `6b014bbd7eba8774a5f6837d2bd0b3a6`. Its equipped-item SELECT **does not request a row lock**, and its association for `owner_type='player'` requires an owner `character_permissions.can_edit` row. The actual live `character_permissions` table contains `can_inventory`, `can_edit` and `can_convert`, **not `can_control`**. A combat actor's live assignment is `encounter_participants.controller_user_id` (or existing supported edit/Admin authorities); the previous research fixture had an extra synthetic `can_control` column and must not be described as deployed schema.

## Reproduced overlap and bounded research candidate

The [scratch test model](../scripts/fixtures/p1_3_inventory_race_combat_only_pg17.sql) runs the **original** equip/transfer functions with genuine owner JWTs. A test-only `BEFORE UPDATE` trigger holds a row lock during a controlled 1.1-second mutation; it exists solely to force an observable schedule, not to alter production business logic. The original unguarded weapon-profile call reads a previously committed equipped row while the authenticated mutation is still uncommitted. **This is a source-derived nonblocking stale-read window, not proof of a completed unequip exploit or live production incident**; the action may still linearize before the writer's eventual commit.

The separate scratch candidate acquires shared E → sorted P → immutable request ledger L → selected **inventory row I `FOR UPDATE`** → reaction window W before calling original reaction/damage/roll processors. After waiting for an equip/transfer writer it **revalidates equipment status and character ownership under I lock**. If a writer committed the unequip or transfer, the entire attack request rolls back without HP loss, reaction spending, resolved W, or persistent ledger. This only establishes **the bounded order tested**, not a globally safe E/P/L/I/W/X/S/C/gate graph.

For `owner_type='player'` only, a **private, research-only cloned weapon profile** changes the original association from `can_edit` to `can_edit OR can_inventory` **for the actual item owner associated with the participant's canonical character**. The caller still has to pass the original actor-controller JWT guard, but is **not granted inventory or sheet edit rights**. The original public weapon-profile definition remains unmodified; the source-original attack function is replaced **in the scratch model only** with a copy that calls this private helper. Thus this path is **source-derived with an intentional documented alteration**, not a source-exact deployed attack function. The helper and original public profile are not directly callable by test players.

## JWT evidence: cases 129–141

| Case | Verified disposable outcome |
| --- | --- |
| 129 | Four genuine JWT identities (GM, controller, inventory manager, outsider); combat controller has no character inventory/edit grant |
| 130 | **EXPECTED UNSAFE baseline:** original attacker reads equipped weapon and succeeds while original signed-in unequip holds uncommitted I lock; writer subsequently commits unequip |
| 131 | Locked attack waits for signed-in unequip, rechecks `is_equipped=false`, fails closed with no persistent attack result |
| 132 | Locked attack waits for signed-in transfer, then rejects foreign/unequipped item with W, HP and request ledger intact |
| 133 | Valid owned melee attack and immutable exact retry succeed; changed weapon ID cannot reuse request UUID |
| 134 | Player-owned gear associated with character by owner's `can_inventory` works for a separate actor controller with **no `can_edit`** |
| 135 | Combat-only controller cannot invoke original equip/transfer or directly read raw inventory/sheet/permission tables **under deliberately restrictive scratch grants/RLS** |
| 136 | Actual original equip RPC accepts owner's `can_inventory` independent of `can_edit` |
| 137 | Removed owner inventory association blocks weapon-result access under conservative candidate recheck |
| 138–139 | Distinct-UUID and same-UUID attack contention serialize to one W/resource/result |
| 140 | Removing current actor control blocks cached attack replay (approved R2 model) |
| 141 | Anonymous, outsider, direct original weapon-profile and private-helper bypasses fail in the scratch grant model |

**Source and test artifacts:** [original writers](../scripts/fixtures/p1_3_equipment_mutation_live_pg17.sql), [scratch candidate](../scripts/fixtures/p1_3_inventory_race_combat_only_pg17.sql), [real-JWT race runner](../scripts/test_p1_3_inventory_race_combat_only_local_jwt.mjs), [exact CI run](https://github.com/bob8675309/DNDNEXT/actions/runs/41701093404). Cases 129–141 passed after deterministic source-writer I-row lock overlap; no race failure was hidden or bypassed.

## Security caveats and next proof

1. **Production RLS is NOT reproduced by scratch grants.** Live `inventory_items`, `character_sheets` and `character_permissions` expose authenticated table privileges with RLS on. In particular, the current `character_sheets_select_visible_or_assigned` policy checks whether a `characters` row exists; its effective visibility depends on that relation's RLS. We have **not** proven that real players cannot view NPC/other sheets. Scratch case 135 establishes only that this *candidate adds no edit/read grants* in its intentionally stricter test schema. Audit real view/RLS policies and browser access separately before claiming private-sheet protection.
2. **Race proof is bounded.** A single item I writer does not itself require E/P locks, but other item, equipment-effect, crafting, rest, S/C or Admin paths may lock multiple classes in another order; the candidate's E/P/L/I/W cannot be certified globally safe. Inventory-owner `can_inventory` revocation while a request is in flight has not been fully serialized with a locked grant row.
3. **Combat-only use is a proposed policy, not owner-approved or deployed.** Current live `can_edit` and `can_inventory` are distinct from controlling a combat actor, and `owner_type='player'` association must be grounded in actual ownership/assignment. The private helper must not be exposed directly or used to grant sheet/inventory edits. Post-transfer historic cache redaction is provisional; owner-approved R1/R2 still require universal replay protection.
4. **Other existing gaps:** Original S/C slot-resource/turn trigger, effect X, equipment mitigation and canonical character stats across other writers, PR #317 global lock graph, TC1 Option A admission and P1.5, R3 service-principal treatment and concealed `Unknown Events` timing remain unresolved. Production public legacy RPCs are not hardened by these tests.

**Next single task:** Extend item-lock research to **actual grant revocation and combat-controller reassignment races** under a realistic inventory/sheet/permissions RLS model, then reconcile I+grant ordering with original character S/C equipment/crafting and Admin/expiry writers before proposing production SQL. Do not grant `can_edit` merely to enable a legal combat action.

**Owner testing:** None required; no local Docker installation.
