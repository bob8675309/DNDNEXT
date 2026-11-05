# P1.3 — Historical Research Recovery, G/I Writer Audit and Delegated-Character Acceptance (2026-11-04)

> **SUPERSEDING OWNER DECISION, later on 2026-11-04:** [Character creation and Admin notices](CHARACTER_CREATION_ADMIN_NOTICE_AND_DELEGATED_RIGHTS_2026-11-04.md) removes the pending-GM-approval requirement for underlings. Reuse the existing Forge, create immediately, notify Admin, then allow GM notes/permission edits in the NPC page. Keep earlier pending-gate statements below as historical research assumptions, not implementation authority.

> **RESEARCH ONLY / NO PRODUCTION SECURITY FIX.** Read-only live `DnDWeb` PostgreSQL 17 source/trigger/ACL inspection on 2026-11-04. The production `main` reference was `51c351a142d03378dff8e47e05182afe21a15622`; active draft #317 started this checkpoint at `56095f80e335fba7e35cda19e627f62e2a1cd1c9`. The research tests from earlier commits remain distinct from tests of any new artifacts. No live SQL mutations, player data writes, grants, gameplay changes, merges, or manual deployments.

## 1. Historical pull requests: don't lose source or mistake archived work for release

| Research | Disposition and relevance |
| --- | --- |
| #251 → #253 → #255 | Closed/unmerged common character effect arithmetic, source-normalized equipment adapter and real-item-catalog fixture parity. Only tested numeric/source contracts; no general deployed effects resolver. |
| #259 | Closed/unmerged documentation readiness matrix; preserves stacking, attunement and source-consumer gaps. |
| #299 | Closed/unmerged atomic Attack controller recheck after participant lock. Do not ship alone without all legacy RPC paths and grants. |
| #304 and held #309 | Unmerged Eldritch Blast/Agonizing Blast and directional LOS research. The held spell design is still a future composable XPHB-first engine, not a production cast. |
| Held #312 | Source-exact and real-GoTrue disposable delegated NPC permission, hidden token, spell visibility v1/v2 and read-RPC research. Do not transplant candidate SQL/UI without coordinated migration and RLS tests. |
| Active #317 | Cross-family transaction/authorization proof. All existing old direct RPCs, triggers, resource refresh and grant revocation must be reconciled before any live cutover. |

Current owner requirements, added 2026-11-04: GM-selectable **full existing-character handoff**, **player Forge creation of underlings pending GM approval**, **temporarily controllable companion NPC with individually concealed sections**, **public-safe unassigned NPC summaries**, and **multiple authorized controllers of a single canonical NPC**. Maintain separately revocable grants for combat, source-sheet viewing, editing, inventory, progression, printing, GM secrets and assignment lifecycle. No automatic creation or `can_edit` → `can_control` backfill.

## 2. Live original writer evidence (SELECT-only; definition MD5)

| Function | Source MD5 | Current ordering / effect |
| --- | --- | --- |
| `public.set_character_inventory_equipment_v1` | `84331beab3ab8a19883b2b8747a24bea` | Checks inventory permission; reads qualifying editor association G in inventory eligibility query, then takes item I `FOR UPDATE` and changes equip state. **Read of G is not G row locking.** |
| `public.transfer_inventory_item_v1` | `8c373a9d6438cb12baabeb375fd35305` | Locks item I `FOR UPDATE` before checking matching G `can_inventory OR can_edit` association, then updates ownership/equipped state. **G read is not a row lock.** |
| `public.accept_trade` | `673aa7390835aec94d01743469b2f444` | Locks trade-request row, then updates inventory I. Include trade rows and I in complete graph. |
| `public.buy_from_merchant` | `1dbe8c24c4c718396d7256f6f7465354` | Locks stock/wallet rows before inserting inventory I. Include stock/wallet and unique/FK waits. |
| `private.complete_craft_plan_v1_impl` | `43383fb3cb93c013d84d133cd235cf24` | Locks craft plan and material I, consumes items and inserts output I. |
| `private.complete_enchanting_craft_plan_v1_impl` | `0dd054d44dc82540ab48c4ec7fce5d59` | Locks plan, base item I and material I, removes/consumes inputs and inserts output. Multiple I rows require stable order. |
| `private.materialize_player_forge_starting_equipment_v1` | `653e1b9d7cc47dcff2cef33a674b97f4` | Locks progression then character sheet, reads first edit-authorized G, and inserts inventory I. Invoked by deferred Forge progression trigger. |
| `private.materialize_player_forge_starting_equipment_trigger_v1` | `23fa54dd0a6d7b42b802d613f39ea27c` | Deferred after progression INSERT; can acquire I after earlier character/sheet locks. |
| `public.create_player_character_v2` | `0351f0a00acae023278e1b8b065b00c9` | Existing PC creation inserts character/sheet, **immediately inserts G with can_edit and can_inventory true**, then progression (which has deferred item materialization). **Not a pending-GM-approval underling workflow.** |
| `private.complete_character_level_up_base_v3` | `e33639d549ef557976a3970ea51f5238` | Locks progression/session/sheet and changes source sheet. Check downstream progression and resource/effect callbacks for character-level lock inversion. |

The live `character_permissions` table has **zero user-defined triggers**. Inventory has two card-payload-normalization triggers; `character_progression` has **19 user triggers**, including deferred materialization/validation. A direct DML search in public/private function bodies identified `create_player_character_v1/v2` as direct G writers; **Admin table-policy-authorized updates are another G writer**, and dynamic/indirect callers have not been exhaustively ruled out.

**Interpretation:** We have confirmed different *read/check versus lock* orders, but **not** a production `G↔I` row-lock deadlock. Treating a plain G `SELECT` as if it acquired G `FOR UPDATE` would be an invalid graph edge. The known bounded failure mode is revocation and stale grant checks while I is locked; the scratch #317 `I→G FOR UPDATE` positive control resolves that single schedule but is not globally certified. Prove actual row overlaps, triggers, FK/unique waits and transaction lifecycle before committing a global order.

## 3. Source-sensitive read endpoints, not merely NPC UI tabs

- `public.encounter_spellcasting_profile_v1` MD5 `e4d6eac7759720b05af0de9dc6c6fc4e`: an authorized actor controller can get **all assigned source spells**, not necessarily just GM-approved combat-ready spells.
- `public.encounter_spellcasting_profile_v2` MD5 `d2a41429785f5c55f6c5b941d6ed6d88`: calls v1 and then syncs/reads **persistent character spell slots**. Both v1 and v2 need caller-scoped projections without invoking unauthorized resource sync.
- `public.get_my_player_characters_v2` MD5 `deca87aaad0dce214743c87cdca03f36`: authenticated `SECURITY DEFINER` returns `to_jsonb(c)` (whole source character record), `character_sheet` (whole sheet), and permission JSON for `player-character`-tagged characters where `can_edit OR can_inventory OR can_convert`. Its `to_jsonb(c)` includes any `characters.secret` field in source data. **Do not assert a full handoff or inventory-only grant conceals GM secrets while this path remains reachable.** Visibility requires source-specific genuine JWT testing; no evidence of actual unauthorized player retrieval is claimed.
- `public.get_my_player_character_v1` is similarly full-source for an edit-authorized tagged player-character. `public.get_character_inventory_v1` and `public.character_equipment_effects_v1` have distinct inventory/source read gates, not `can_control`.
- `characters` has no general authenticated table-wide SELECT; `character_sheets.sheet` has authenticated SELECT, with a policy tied to existence of a visible/assigned character. Both table ACL *and* RLS/column privileges matter. Existing `pages/npcs.js` reads raw sheets and caches them; if a row reaches the client, React concealment is insufficient.

**Scope/ownership rule:** Existing PC records may legitimately need full player-visible sheets. Preserve this behavior for genuinely owned PCs while separating hidden GM narrative from data returned to players. Do not unilaterally restrict current public NPC sheet policy without owner-approved compatibility and signed-in acceptance tests.

## 4. Delegation and race acceptance contract (design only)

These IDs are *required future test cases*, **not tests run by this document**. The companion machine-readable matrix is `scripts/fixtures/p1_3_delegation_acceptance_matrix.json`.

| ID group | Acceptance |
| --- | --- |
| D01–D02 | Public visible NPC returns safe summary only; hidden unassigned NPC discloses no source sheet or secrets. |
| D03–D04 | Full handoff grants independently selected player rights; revoke must preserve other independent grants. |
| D05–D06 | Underling creation remains pending GM approval; approval materializes one canonical character, exact permissions and idempotent acceptance. |
| D07–D08 | Temporary combat authority has scoped expiry and immediate R2 private-cache denial, no implicit edit/inventory. |
| D09–D11 | Shared controller single Action/reaction/slot and immutable typed command identity with R1/R2. |
| D12–D14 | Both spell profiles, full-player read RPCs, RLS, export/print, Realtime and logs cannot bypass per-viewer projection. |
| D15–D18 | Combat-only equipped use; item transfer/equip versus attack; revocation race; actual G/I row lock and FK waits. |
| D19–D20 | Source C→S refresh versus S→C spend; TC1 active admission and paused resume. |
| D21–D24 | Concealed Unknown Events projection/timing, GM full original authority, full legacy-RPC bypass closure, separate R3 service approval. |

## 5. Next one task and stop conditions

**P1.3 next single bounded task:** Source-faithfully reproduce an **Admin G revocation versus original item I equip/transfer** and **Forge deferred starting-equipment materialization versus change in G/sheet** using disposable PG17 with *real* GoTrue identities. Identify actual concrete blocked rows, FK/unique waits and order; cross-check combat E/P/L/I/G/W/X and character S/C paths before claiming one global lock order.

Reference SELECT-only metadata query: `scripts/audits/p1_3_inventory_grant_visibility_readonly.sql`. Results above are source-inspection observations, not new race test passes. Preserve #317 as unmerged draft; no schema change, public RPC rewrite, production grant/RLS policy mutation, AI, map changes, manual staging activity or owner browser test was performed here.

**Additional owner policy still open:** which subset of an NPC's prepared/known spells and sheet fields should be revealed to each temporary controller; the newly approved access modes establish least-privilege *defaults*, not a final exhaustive field-by-field mapping. R3 service principals and concealed-event timing remain unresolved. 
