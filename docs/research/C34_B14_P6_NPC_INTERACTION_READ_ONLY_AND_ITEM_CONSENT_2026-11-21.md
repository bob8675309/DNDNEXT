# C34 B14-P6 — NPC interaction capability flags, hired read-only backpack, item offers and optional auto-accept

**Date:** November 21, 2026 CST. **Status: research-only signed PG17 tests RUNNING at initial write; NOT approved for runtime.** Active held draft PR [#379](https://github.com/bob8675309/DNDNEXT/pull/379), executable `99087e67f41254a365bd495e9c85c13718a35299`, [Actions #44944487621](https://github.com/bob8675309/DNDNEXT/actions/runs/44944487621). This file is not a production migration or deployment authorization.

## Owner decisions / preserved history

Owner approved **GM-configurable NPC interaction tiers backed by independent capabilities**, including acquaintances (public profile/dialogue/shop with no personal backpack), hired combat companions (can command in combat, see backpack and worn gear read-only, cannot equip/unequip or remove NPC items), trusted and fully delegated companions (individual equipment/withdraw grants), temporary spell control (encounter actions only, no permanent inventory/sheet rights), separately adjudicated Sleight of Hand, and future NPC quest item send/request interactions. Then owner **agreed to independent NPC item offers requiring acceptance, with fully delegated companions eligible for explicit auto-accept**.

No same-account player-character→player-character transfers; controlled NPC henchmen/sidekicks remain valid destinations after current rights check. Real Forge PCs are `kind='npc'` with `player-character` tag and must be excluded as NPC recipient across all paths.

Existing unmerged PR312 `can_control` is **combat-only**, not ownership, inventory access, or acceptance rights. Original `NpcPanel.js` currently sets `canView=canManage` from `can_inventory||can_edit` and cannot express a hired read-only backpack; P6 does **not** edit the page. Prior signed P4 can transfer character gear to controlled NPC without giving read access. Existing `character_stock` shop stock and `inventory_items` personal backpack remain separate. No other original PR, merchant, Town, Forge, map or inventory source changed.

## Candidate source (disposable local PG17 only)

`scripts/integration/c34/candidates/t46_p3_p4b_c2b14_p6_npc_capabilities_and_offers_pg17.sql` defines:

1. PRIVATE test-local RLS-enabled tables `private.c34_b14_p6_npc_grants` and `private.c34_b14_p6_item_offers`, with PUBLIC/anon/authenticated direct table grants revoked. A row in grants has `npc_id/user_id/capability/enabled/granted_by/updated_at`; valid explicit capabilities `view_backpack`, `manage_equipment`, `withdraw_items`, `auto_accept_items`. **This does not create a persistent tier integer.**
2. `public.c34_b14_p6_set_npc_capability_v1`: only canonical `admin/gm/dm` current DB role can grant/revoke; genuine NPC only, never tagged Forge PC; does not grant combat `can_control` or edit secrets.
3. `public.c34_b14_p6_npc_capability_context_v1`: one server-authorized filtered response. Public worn gear contains coarse item names only, **no private inventory ID or card payload**; private backpack rows appear only if explicitly entitled to view or manage/withdraw. Read-only hired player cannot change equipment. Combat control is computed independently from current PR312-style `character_permissions.can_control OR can_edit`. Hidden NPCs not revealed to unauthorized players, and tagged Forge PCs never presented as an NPC.
4. `public.c34_b14_p6_offer_item_v1(request_id,item_id,source_owner_type,source_owner_id,target_npc_id)`: checks caller identity, current source ownership (player account or real source Forge character), source character inventory permission, target NPC tags/visibility, row lock and strict request UUID; **pending** request does not move ownership or unequip. **Immediate accepted** delivery occurs *only* with both GM-issued `auto_accept_items=true` and current NPC `can_control OR can_edit` for that sender, with source authorization still fresh. No client-forged issuer/decision/quest completion.
5. `public.c34_b14_p6_decide_item_offer_v1(request_id,accept)`: only authenticated canonical managers may currently adjudicate independent NPC acceptance/decline. Future story/NPC AI decision service must have its own bounded trusted authorization; an NPC is not an auth.users account. Acceptance locks request + exact item, re-checks current source owner/provenance/authorization, atomically transfers to NPC and unequips; decline leaves item untouched. Duplicate acceptance is rejected. This is **GM adjudication as a safe interim research model**, not a functioning autonomous NPC decision engine.
6. `public.c34_b14_p6_cancel_item_offer_v1`: source user can cancel only their still-pending offer; anyone else denied.
7. **Legacy direct bypass hold:** after unchanged signed B14-P4 baseline tests, P6 scratch stage **revokes authenticated EXECUTE on the old versioned P4 direct-gift RPC** without changing its definition. This blocks that specific bypass in the scratch candidate but **does not close old P2/legacy direct NPC transfer entrypoints** (which also carry other-player/trade behavior). Production cutover must close all overlapping routes without breaking legitimate other-player sends, merchant commerce, crafting, Forge or source-minted item paths. No claim that hosted functions/policies have changed.

**Future quest reuse:** a request is not an acceptance, and neither should complete a quest, grant a reward or mint items. A future separate NPC request ledger will link authorization, acceptance, transfer receipt and quest progress in one server transaction with replay protection; do not repurpose original player↔player `trade_requests`. P5 [quest research](C34_T46_P3_P4B_C2_B14_P5_NPC_QUEST_ITEM_INTERACTION_CONTRACT_2026-11-21.md) remains accepted as an eight-test source-only proposal contract, **not a running quest system**.

## Signed tests and exact acceptance status

New `scripts/integration/c34/run_t46_p3_p4b_c2b14_p6_npc_offers_signed.mjs` runs **after** original P4 positive/negative tests, and before GM demotion in unchanged B14 original signed runner, against genuine local GoTrue/PostgREST + disposable PG17. Workflow `.github/workflows/validate-c34-t46-p3-p4b-c2b-guarded-buy.yml` has both exact files in push/PR paths and Node syntax check.

Planned signed markers:
- `P6-LOCAL`: strict local PG17/GoTrue env, private RLS tables/direct access revoked, anon/no grant, old direct P4 path closed only after its own signed acceptance.
- `P6-READONLY-HIRE`: public worn gear and private backpack separation, authenticated GM grant/revoke, player/observer denied grant, hired controller still cannot change backpack equipment or read hidden/card secrets.
- `P6-CAPABILITY-ORTHOGONAL`: view, manage, withdraw, auto-receive and combat control separate and revocable; full inventory management actions still require their own server-side RPC integration and are NOT enabled by the preview flags.
- `P6-PENDING-CONSENT`: pending independent offer never moves item, signed player/observer cannot approve NPC's choice, GM accepts once and preserves payload+unequip, replay denied.
- `P6-DECLINE-CANCEL`: no ownership change on negative decisions, sender-only cancel.
- `P6-AUTO-EXPLICIT`: only GM-enabled explicit auto-accept plus current delegated control allows direct transfer; no auto from combat control alone or after revocation.
- `P6-CONCURRENCY`: two simultaneous signed GM acceptance requests commit at most once, duplicate pending item offer denied.
- `P6-AUTH`: current source rights, forged NPC/hidden/Forge PC and anonymous denials, original account-owned item pending.
- `P6-SIGNED`: original legacy/P2/P3/P4 role/merchant buyer/function definition hashes unchanged.

**No P6 PASS claim until exact-head Actions conclusion and decoded signed log examined.** Last accepted P4 research executable `bedf62272ff7ba604ff38b97f70cd0c83735bc8f`, Actions #44939531819 SUCCESS; original full Forge joint #44939531822 SUCCESS. P5 source-only #44941845037 SUCCESS 8/8. All three are prior evidence, not proof this P6 candidate is accepted.

## Runtime design recommendation and work sequencing

The NPC panel should call **one effective-interaction context endpoint** after selected NPC changes, projecting coarse public appearance, permitted private inventory summary, button capabilities and proposal-ready target data; keep storefront `character_stock` and item rows separately queried/filtered when appropriate. Explicit UI presets: public stranger; hired controller + read-only backpack; trusted configurable; fully delegated equipped/withdraw with intentional auto-offer acceptance; temporary domination encounter control only. The database must independently authorize every mutation, not rely on UI state.

**Next after signed P6 green:** reconcile this scratch grant/offer model with PR312 delegated control and PR318 Admin permissions editor, PR345 secured NPC Profile, actual source Forge character ownership, original NPC quest dialogue, concurrent permission revoke/offer acceptance, and legacy direct-NPC transfer hardening in a source-preserving merged *test candidate*. Discuss a concrete production migration and runtime UI cutover separately before any hosted SQL. Held original parent PRs, 22/34 legacy sheet writers, 29/31 nonmap + two protected map triggers, independent encrypted PG17 restoration / all 340 Storage objects and owner approval all remain release holds.

No production SQL, protected map/town, gameplay page edits, merge, deployment, paid agents or automations occurred in P6.
