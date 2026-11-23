# I2J-P3 — mounted Warlock Invocation recovery: account-snapshot writer and canonical-grant preservation

**2026-11-23 CST. SOURCE-ONLY audit, NOT a signed transaction or deployed acceptance.** This research-only branch is distinct from Agent A (#379), Agent B (Issue #389), Agent C (original spell/combat), and original #371. No production SQL, runtime, world/town/tactical gameplay, grants, or main branch changes.

## New mounting and authorization evidence

- Original UI `components/CharacterClassPanel.js` (Git blob d39d2bceab944d3d4ec42cc2cfda92609ce51a2b) renders `CharacterLevelUpChoices` in the level-up review flow. That component (blob 3fa76acd1811a77b0c3e93711906bfb5afb17584) renders `CharacterInvocationRecovery`. This is a **source-grounded mounted UI path**, not evidence of live browser success.
- `CharacterInvocationRecovery.js` (blob c58774853c6140981592fa84b9040c0fcb4a8c58) calls signed Supabase RPC `get_character_invocation_recovery_v1` and, only when `required`, `recoverable`, and selections complete, mutation RPC `recover_character_invocations_v1`. Successful recovery resets the choice state and notifies parent; no live session tested.
- Historical SQL `sql/20260808_28_legacy_warlock_invocation_recovery.sql` (blob 292acd8000ada950ebcd14e1a917b55918499edb) defines `public.recover_character_invocations_v1`, `SECURITY DEFINER`, explicit management permission and class XPHB Warlock checks. It row-locks progression and returns before mutation for already normalized history; partial histories and legacy `Lessons of the First Ones` must be reconciled by GM.
- Original function validates class-feature option catalogue, unique/repeatable invocations, source-qualified damaging/attack cantrip children, prerequisites, and parity of recorded legacy invocation names before inserting canonical `character_class_option_grant_instances` with `recoveredCurrentState=true`, `historicalOrderUnknown=true`. These are **must-preserve positive and negative behaviors**.
- Original code writes **per-character** `character_sheets` invocation names and recovery metadata, then calls `UPDATE public.players p SET sheet=v_sheet,updated_at=now() WHERE p.user_id IN (SELECT cp.user_id FROM public.character_permissions cp WHERE cp.character_id=p_character_id)`. The second update is account-scoped, not a guarantee that `players.sheet` is the selected character's historical sheet. Existing Option A owner policy freezes all account snapshots while retaining canonical state.
- The I2-I immutable ledger (blob 772af5e05ec494f9526445a5ad9eb05bad0f5d78) records `public.recover_character_invocations_v1(p_character_id uuid,p_selections jsonb)` original deployed MD5 **05f6d19a7e2f45d890c62c27cb419e7f** and status **not_option_a_tested**. Original 34 UPDATE signatures: 12 bounded signed scratch-tested, 22 remaining. **No increase in count** from this audit.

## Executable proof and next signed matrix

Pure source audit: `node --test scripts/audits/test_i2j_p3_invocation_recovery_source.mjs`. Six pinned Git blobs, UI-to-RPC path, authorization, original fail-closed choice/Warlock rules, canonical grants and history flags, account fanout, and two synthetic-negative mutations. These source mutations are **not** original signed REDs.

To obtain genuine signed acceptance, first independently authenticate approved **offline PG17** original `public.recover_character_invocations_v1` MD5 05f6d19a7e2f45d890c62c27cb419e7f with original helper bodies, table/role/trigger graph and signed local GoTrue/PostgREST. Never substitute checked-in historical SQL for a restored function without proving parity.

1. Original signed RED: a legitimate creator/coeditor normalizes an unnormalized source-legal Warlock; canonical grants, recovered metadata, and invocation names succeed, while unrelated editable historical `players.sheet` snapshots/timestamps are overwritten.
2. Historical negative cases: partial normalized invocations, recorded name mismatch, legacy Lessons of the First Ones, invalid/repeated and inappropriate cantrip child choices, revoked editor/outsider/anonymous, prerequisites and request replay all fail closed with exact rollback.
3. Only after RED, one exact-source-MD5 reversible **scratch-only** account-mirror bypass. Signed GREEN preserves grant instances, history markers, canonical sheet and permission checks while all same-character/unrelated/empty historical account snapshots/timestamps are unchanged.
4. Recheck current v5 level-up, class source UI/choice renderer, normalizer and full role/31-trigger graph. This does not authorize production Option A, release or closure. Independent DB+340 Storage object restore and owner GO remain mandatory.

**ONE NEXT BOUNDED TASK:** obtain/restored-offline source authority or, until authentic restore exists, prioritize existing mounted/unmounted untested original writers for independent signed tests rather than repeatedly declaring static tests as executable acceptance.
