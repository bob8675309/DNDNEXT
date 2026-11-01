# P2 NPC Indirect Character-Resource Read Audit — Held Research

_2026-11-01. Draft PR #312 stacked on held #309; never a production migration or deployment._

## Scope and source

This follow-up audits **additional authenticated, public SECURITY DEFINER reads** capable of exposing source-character resources after a player is assigned `can_control` for an NPC. Only **read-only** live Supabase metadata/function definitions were inspected. The candidate authorization was exercised in the **free disposable local GoTrue/PostgREST** environment, not DnDWeb production.

The previous [cross-RPC visibility/rollout audit](Spell_Recipe_P2_NPC_RPC_Visibility_Rollout_2026-11-01.md) already discovered why `encounter_spellcasting_profile_v1` redaction alone is insufficient: `encounter_spellcasting_profile_v2` appends persistent resource data. Both profile versions are covered by separate held candidates and genuine-local-JWT tests; the GM's delegated spell-list disclosure policy remains unapproved.

### Original live function bodies now added to the JWT fixture

| Function | Live `pg_get_functiondef` MD5 | Authorization observed |
| --- | --- | --- |
| `private.can_manage_character_progression_v1` | `ac70e4ec033d86c4e0a254d50d429a45` | Admin or `character_permissions.can_edit`; **not** `can_control` |
| `character_sheet_resource_profile_v1` | `7f1fb0b71ec2ff91d0f2a213afa02ecf` | Calls progression guard **before** persistent slot synchronization and full sheet-resource profile |
| `character_sheet_resource_profile_v2` | `b846e3b2a2e94bfd905da6da64ea6e0d` | Calls guarded v1 first, then adds active-encounter and Wizard Spell Mastery metadata |
| `get_character_currency_v1` | `3b6361dcdce22bb8cb4a0602d51c34d0` | Requires `private.can_access_character_v1(...,'inventory')` |
| `get_character_inventory_v1` | `d958dc1b685836117421fea5b8749478` | Requires signed-in user with inventory permission, except the existing service role |
| `character_equipment_effects_v1` | `5f459de66d5b429ddbd5ee629fbc9ef1` | Requires Admin, service, or `private.can_access_character_v1(...,'read')` |

The full original definitions are frozen in **`scripts/fixtures/npc_indirect_resource_read_rpc_parity_pg17.sql`**. The fixture adds local shape-only NPC inventory/currency records containing values a delegated player should never retrieve. SQL definitions are copied from production, properly terminated and EXECUTE-scoped to authenticated users only. They are **not** installed in production.

The signed-in test `scripts/test_npc_delegated_control_local_auth.mjs` now calls all five protected public resource RPCs (in addition to earlier source sheet, secrets and player-character RPCs) **before granting, after granting both players, and after revoking one**. Each must return SQLSTATE `42501`; the test fails if a response succeeds or errors for a different reason. The original `private.can_manage_character_progression_v1` logic runs inside the local SQL functions. This test **does not** verify the full underlying private sync/equipment computation for an Admin or editor; those should be covered by existing release tests and later production-shaped acceptance.

## Real client call-site review

Reviewed direct consumers in the repository, preserving their original behavior:

- `components/TacticalCharacterResourceBridge.js` calls `encounter_spellcasting_profile_v2`. It renders linked Sheet & Rolls resource counts **only when** `persistentResourcesLinked` is present/truthy. A delegated-combat-scoped v2 response intentionally omits `characterId`, `persistentSlotState`, and `persistentResourcesLinked`, so the source ledger is neither displayed nor subscribed to by this panel. The battleboard still receives slot counts from `slotSnapshot`. **Not a complete browser-interaction test**.
- `components/CharacterSheetResourceTracker.js` calls `character_sheet_resource_profile_v2` and depends on the original full sheet-resource contract. The proposed NPC `can_control` bit alone must never authorize that RPC or change its response.
- `components/NpcPanel.js` and `hooks/useNpcSheetActionData.js` use `get_character_inventory_v1` for source inventory/action data; this remains controlled by **inventory** permission, not delegated combat control.
- `components/CharacterCurrencyBadge.js` calls `get_character_currency_v1`; it already handles SQLSTATE `42501` as a non-display state, consistent with independent inventory permission.
- Existing `get_my_player_characters_v2` can return a full sheet to a user with prior `can_inventory` or `can_convert` rights. That is the legacy source authorization contract, not newly conferred by `can_control`.

These are named consumers found via repository search and source inspection; not exhaustive proof that every client path or nested SQL function is safe.

## What this does NOT authorize

- No production SQL/schema/RLS/GRANT, combat-resource change, new test accounts in DnDWeb, merge, deployment, browser-side release, new feature flag or house-rule choice.
- No claim that direct caller denial proves all indirect `SECURITY DEFINER` helpers safe; the broad live function inventory includes more public endpoints, including some with `anon` EXECUTE but internal authorization guards.
- No claim that the local test reproduces the **actual persistent slot synchronization** logic; the local fixture intentionally uses a reduced fail-closed sync helper for delegated v2, while the sheet resource-read functions are only exercised on their denial paths.
- No automatic reconciliation of **one character in two concurrently active encounters** or the existing legacy public command ledger replay / mixed-lock ordering.

## Next gate

Verify all five exact-head CI workflows after the latest changes. Then audit **the remaining action/encounter RPCs that call tactical profile v1** for whether they use the profile strictly for eligibility (not source disclosure or stale replay), and reconcile a single transaction/lock contract **across every public command entry point**. Separately obtain GM approval of the conservative known/ready NPC spell disclosure and same-character overlapping-encounter policy. Keep research PR #312 unmerged, with all cutovers and rollbacks owner-reviewed.
