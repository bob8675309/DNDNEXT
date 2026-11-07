# C2 — Forge character-owned inventory CHECK and RLS: executed evidence, release boundary

**Reconciliation date: 2026-11-07.** This is a current, source-linked *research diagnosis*, **not an approved SQL migration or a passed full production/browser release**. Read it after [NEXT_CHAT_START_HERE](NEXT_CHAT_START_HERE.md) and [ACTIVE_WORK](ACTIVE_WORK.md). The entire J00–J169 test code remains in the held Forge PR stack [#324→#335](https://github.com/bob8675309/DNDNEXT/pull/335); don't bulk-merge the stack to obtain this evidence. Preserve old per-case docs and failed tests.

## C1 is merged; no more duplicate spell baseline work

- Owner approved [PR #337](https://github.com/bob8675309/DNDNEXT/pull/337), merged into main as `dbc7006919f35c8f7b12921bf468c4f949ca77ad`. The resulting Vercel production deployment `dpl_7CMJFxVDkK1hzuBE7AZKG68BbRsn` was independently observed **READY** from that same SHA. 19 original 2024 XPHB tactical keys and 48 baseline validators have a read-only preservation gate; no recipes, authoring interpreter or new cast path installed.
- Main's original tactical implementation can remain **implementation-complete** while future composable recipe/true-Auth release gates remain open. [Spell Engine decisions](SPELL_ENGINE_DECISIONS.md) still govern.

## Read-only production source and schema observations

| Source on live DnDWeb PG17.4 | Verified fact and limitation |
| --- | --- |
| `public.inventory_items` CHECK `inventory_items_owner_type_check` | Validated; accepts `player`, `npc`, `merchant`, `character` |
| CHECK `inventory_items_owner_type_chk` | Older **NOT VALID**, accepts only `player`, `npc`, `merchant`; remains enforced for new INSERT/UPDATE |
| Deferred starting equipment | `private.materialize_player_forge_starting_equipment_v1(uuid)`, original full function MD5 `653e1b9d7cc47dcff2cef33a674b97f4`, inserts `owner_type='character'`; real progression trigger is `DEFERRABLE INITIALLY DEFERRED` |
| Player creation `v2` and `v3` | Live original `md5(pg_get_functiondef)` `0351f0a00acae023278e1b8b065b00c9` and `6ba73e6f12fcf826cc0a739cce45ff40`; `v3` invokes `v2` |
| Inventory RLS | Four permissive authenticated INSERT/SELECT/UPDATE/DELETE policies constrain `user_id=auth.uid()` or Admin, **not `owner_type` and related character access**; RLS enabled, not FORCE; `authenticated` has table-level SELECT/INSERT/UPDATE/DELETE |
| Actual inventory trigger bodies | Two original BEFORE handlers still present: structured crafting `108bfc2599d75e7298f65ce326f16173` and smithing `5d51cf335ff880939ae0df4c4152bdbd`. The reduced fixture executes their no-material fast branch |

All live queries were metadata/SELECT only. No existing player item or NPC data was modified. The observed two overlapping CHECKs and RLS are an independently confirmed schema issue, *not evidence of a successful exploitation attempt on production*.

## What was already PROVEN in held original-source GoTrue/PostgREST CI

[Held #335 original-JWT/PG17 CI run 42345186896](https://github.com/bob8675309/DNDNEXT/actions/runs/42345186896) ran against its exact research source `d3168539b203f5394177df0f343111ba89418807`, **SUCCESS**. Original full source function hashes are checked where loaded, but catalogue, some helper implementations, RLS and 14 of 31 creation-adjacent triggers remain incomplete in the research database.

| Executed cases | Actual observed result in disposable PostgreSQL 17 / real local JWT |
| --- | --- |
| **J78–J84** | Install both live-style CHECKs and original inventory triggers; genuine signed original `create_player_character_v2` plus deferred equipment/feat fails at COMMIT with **SQLSTATE 23514** naming the obsolete CHECK. All characters, creation nonce, grants, inventory and currency roll back. On the disposable database only, removing the old CHECK makes the same request succeed; restoring it makes the next request fail again. Original code not rewritten. |
| **J85–J87** | Demonstrate the security danger of a **constraint-only fix**: with the legacy CHECK removed but old source-shaped RLS, signed non-Admin direct INSERT and UPDATE can create/assign character-owned I for an unrelated character. This was demonstrated *only in disposable local JWT tests*, not production. |
| **J88–J93** | Apply review-only [combined SQL candidate](https://github.com/bob8675309/DNDNEXT/blob/agent/forge-warlock-react-choice-ui-j169-20261107/sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql) to disposable PG17: update all four RLS policies and drop obsolete CHECK within one guarded transaction. Retains validated CHECK; blocks forged character-owned DML while allowing authorized source Forge deferred gear/currency, player-owned CRUD, Admin assignment and permission-revoked SELECT behavior. |
| **J94–J102** | Genuine signed original `create_player_character_v3` succeeds **after the combined scratch candidate** for a source-qualified XPHB Fighter starting-market cart; exact stock, character-owned inventory quantity, 300gp homebrew/155gp vanilla budget, currency, nonce replay and failure rollback cases pass. The source original merchant purchase remains player-owned, distinct from character-owned Forge gear. |
| **J79B — added C2 direct v3 failure control** | Research-only extension on the last held #335 branch at `19d7275d24d26f9641c9e6d98ea24cf9431f4d81`: same source-original signed v3→v2, two original live-style CHECKs, expect 23514 at deferred COMMIT and atomic rollback. **PASS — exact head `19d7275d24d26f9641c9e6d98ea24cf9431f4d81`, [real local JWT / PostgreSQL17 CI 42396598675](https://github.com/bob8675309/DNDNEXT/actions/runs/42396598675).** The job log confirms the expected original-v3 `23514` from the obsolete CHECK and total atomic rollback; both PG17 and local GoTrue jobs passed. |

**Old docs' "J78–J102 pending" labels are historical**: the later exact-head execution log supersedes them for those specific cases. The branch is still unmerged; source-specific signed acceptance is not a browser or deployed-function replacement certificate.

## The release blocker is COMBINED, never a lone constraint drop

A migration that drops only `inventory_items_owner_type_chk` would remove a production data-integrity obstruction **and at the same time** broaden writable character-owned inventory under existing four owner-or-admin RLS policies. Treat inventory ownership and current character authorization as a single security review: INSERT, UPDATE (both USING and WITH CHECK), DELETE, SELECT/revocation, Admin exceptions, SECURITY DEFINER materializer and inventory-management RPCs, player/merchant/crafting paths.

The exact held proposal [Forge Character Inventory Owner Check and RLS Release Review](https://github.com/bob8675309/DNDNEXT/blob/agent/forge-warlock-react-choice-ui-j169-20261107/docs/Forge_Character_Inventory_Owner_Check_RLS_Release_Review_2026-11-05.md) includes a guarded transaction and non-production proof. **Not deployed or owner-approved as a production migration**. No production SQL, RLS, grants, data, manual migration or gameplay code was touched in C2.

## Remaining gates — do not call this release closed

- **C2 diagnosis/reproducer**: historical v2 direct failure, scratch control, RLS issue and source-authentic v3 post-candidate acceptance are verified on the held branch. C2's added **v3 under old-CHECK** negative control J79B **PASSED at exact-head real local JWT CI 42396598675**. The diagnosis/reproduction is complete; it is not a full 31-trigger / production Auth / browser / release gate.
- **Source/full integration:** last held Forge trigger census **17 of 31** source-original DDL staged, **14 missing**; reduced class/Background/equipment catalogues, partial RLS/GM role source, missed cross-transaction CP/CS/G/I lock and legacy populated player sheet cases. Never call any of these accepted because J79–J102 are green.
- **Before any production migration:** exact live fingerprint/roles/procedures recheck; stage the *combined* RLS+constraint candidate with all relevant inventory readers, stock/merchant/crafting/equip/transfer paths; full signed source-authentic v2/v3/GM browser and revoke cases; backup/rollback and source-owned migrations using Supabase CLI; request a **separate explicit owner authorization**. Do not apply held candidate to production now.

## Closeout order after C2 evidence validation

J79B exact-head CI is **GREEN**. Regard **C2 defect diagnosis/reproduction** as complete; leave **C2 production release unapproved** and carry its security/integration gates into the relevant P1 and Forge release workstream. The **one next bounded task** is C3 documentation/source crosswalk: map each open Forge/NPC/security research PR onto a clean main-based destination, identify unique original-source fixtures versus duplicates, and propose what can safely be consolidated/closed **without merging or deploying those research PRs**. [Ordered plan](PHASE_CLOSEOUT_AND_PR_CONSOLIDATION_ORDER_2026-11-07.md).
