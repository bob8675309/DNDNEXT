# C34 B14-P4 — owner-directed player-character equipment sends to controlled henchmen and sidekicks

**Owner decision received November 21, 2026:** “not characters on the same account but to henchmen and sidekicks they control and everyone else is fine.”

**Implementation interpretation for research:** Do **not** add same-account player-character → player-character transfers. Permit an authenticated player's existing **character-scoped** Forge item to be donated to an **NPC/henchman/sidekick they currently control**. Keep transfers to other players and all other existing authorized transfer/trade flows unchanged rather than restricting recipients globally. The owner did not authorize indiscriminate character-to-character migrations or merging/deploying any gameplay code.

**Candidate status: SIGNED CI PENDING**, held draft [PR #379](https://github.com/bob8675309/DNDNEXT/pull/379). All changes below are **research-only**, isolated to new versioned SQL/test source and CI wiring. No hosted production SQL, world map, Forge or inventory runtime change.

## Source evidence and important separation

- Actual original Forge starter/market materializers create `public.inventory_items` with `owner_type='character', owner_id=player_character_uuid, user_id=creator_auth_uuid`. The existing account-inventory and Town craft flow use `owner_type='player', owner_id=auth_user_uuid`. Preserve both contracts; do not rename or bulk rewrite the original gear.
- Source-locked private `can_access_character_v1(uuid,'inventory')` authorizes inventory by `character_permissions.can_inventory OR can_edit`; it does **not** check combat `can_control`.
- Original held [PR #312](https://github.com/bob8675309/DNDNEXT/pull/312), exact source `sql/candidates/20261101_npc_delegated_control_candidate.sql` SHA `29e700c8bf2008c1b46abc5dc74a266547473cf7`, proposes `character_permissions.can_control boolean NOT NULL DEFAULT false` for **combat delegation separately** from `can_inventory` and `can_edit`; it has NOT been adopted as a production permission. PR312's controlling-actor rule explicitly recognizes either `can_control` or `can_edit`. Never backfill control from edit.
- This is a narrowly scoped **item donation**, not inventory viewing or equipping: a controlled target may receive one transferred item using this RPC without gaining source item creation, receiving NPC inventory SELECT, edit, sheet, spells, or hidden secrets. `can_inventory` alone for the *recipient* does not prove control.
- Existing B14-P2 already handles ordinary player-account → other-account transfers and existing NPC/merchant source manager transfers. Player↔player trade requests remain independent and unchanged.

## New research-only candidate

`scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p4_controlled_npc_gear_pg17.sql`

- Reproduces **only the held PR312 independent `can_control` column** in local disposable PG17 (not the entire PR312 combat SQL).
- Adds versioned `public.c34_b14_p4_send_character_gear_to_controlled_npc_v1(item_id,expected_source_character_id,target_npc_id)`, not installed in any runtime page or hosted DB.
- Verifies signed `auth.uid()`, explicit `owner_type='character'`, compare-and-swap `owner_id=expected_source_character_uuid`, original `characters.tags` containing `player-character`, and **both** current source-character inventory permission and source row `user_id=auth.uid()` for nonmanager. The provenance check prevents trusting stale account identity alone.
- Destination is explicitly `characters.kind='npc'`, preventing even same-account player-character destination; ordinary players cannot target `is_hidden` or `state='hidden'` NPCs.
- Recipient current **`can_control OR can_edit`** is required for nonmanager, sourced from the held PR312 combat-control semantics. This does not grant recipient inventory access. Manager authority remains explicit `admin/gm/dm`.
- Source row is locked, recipient/source permission rows read `FOR SHARE`, mutation is a single transaction that sets NPC owner and clears `user_id`, `is_equipped`, `equip_slot` while retaining item card payload. DB functions and policies already present are left untouched; anonymous EXECUTE revoked.
- Client-side role declarations or stale cached capabilities never authorize the write. Coordinated global row-lock order, role/recipient revocation races, and the full 29/31 nonmap + 2 protected-map dependencies must still be reviewed before deploy.

`scripts/integration/c34/run_t46_p3_p4b_c2b14_p4_controlled_gear_signed.mjs` is wired into the existing full signed local GoTrue/PostgREST PG17 runner **after B14-P3 but before GM demotion**, with expected positive/negative cases:

1. Signed owner character → explicitly controlled sidekick, payload intact/auto unequip, no recipient inventory SELECT from control alone.
2. Recipient controlled through the **existing `can_edit`** independently; `can_inventory`-only recipient denied.
3. Foreign-origin Forge gear denied even with a separately delegated inventory permission.
4. Same-account second player character as destination denied.
5. Hidden controlled NPC and wrong expected source denied.
6. Same JWT with target control revoked or source inventory access revoked cannot send.
7. Genuine concurrent sends to two controlled NPCs: one commit, loser `40001`, no duplicated gear.
8. Original **other-account player→player** B14-P2 send still succeeds; anonymous new RPC denied.
9. Original P2/P3/legacy transfer, UUID is_admin and merchant buyer function hashes unchanged.

**No new signed success claim until this exact executable's GitHub Actions job and full decoded logs are inspected.** Previous completed [B14-P3 signed #44933928798](https://github.com/bob8675309/DNDNEXT/actions/runs/44933928798), job 136936346543, **SUCCESS**, full 97,502-character decoded log: P3 context privacy, hidden delegated owner, NPC revocation, same-JWT GM role revocation PASS. Its separate original [joint Forge #44933928800](https://github.com/bob8675309/DNDNEXT/actions/runs/44933928800), job 136936346753, **SUCCESS**, full 268,497-character log confirms signed v3 creation/deferred equipment only in its different review-only combined CHECK/RLS fixture.

## Integration guidance / UI improvement

The new single-RPC context should eventually distinguish `may_view_inventory`, `may_manage_inventory`, and `may_receive_item` for a destination, rather than equating combat control with inventory permissions. For source `owner_type='character'`, candidate eligibility should be computed by **the backend** and displayed as a narrow *Send to controlled henchman/sidekick* action. The original independent player trade flows should remain available. Keep item rows paginated/realtime separately; never use front-end capability flags to bypass transactional authorization.

**Open release work:** combine actual original Forge `character` CHECK/RLS policy contract with this versioned donation API; ensure item creation and craft provenance, both source and destination permission revocation under concurrent writes, account-specific character identity, protected map trigger preservation, and full original PR source parity. Owner signoff required for any actual runtime schema/page changes, merging or deployment. Independent CI-efficiency #389 and both disabled automations remain separate.
