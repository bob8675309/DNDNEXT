# I2J-P2 — Original weapon mastery legacy-account writer source and dependency preflight

**2026-11-23 CST — SOURCE-ONLY HISTORICAL EVIDENCE; NO GENUINE SIGNED TEST.**
Authoritative working head for this independent research was I2J-P1 branch `b3bb3cdbe0d91fa4c309413638768e97e4de85ec`. I2J remains isolated from Agent A (#379), B (Issue #389), C (spell/combat), and original held PR #371.

## New original writer, verified in checked-in source only

The original approved I2-I per-source coverage ledger, Git blob `772af5e05ec494f9526445a5ad9eb05bad0f5d78`, names `public.configure_character_weapon_mastery_v1(p_character_id uuid, p_item_ids uuid[])`, original deployed source MD5 `32fa55b69478af07f8f0002b967a5704`, **status `not_option_a_tested`**. It is ONE of the **22/34 remaining** historical UPDATE writers. Do NOT increase verified coverage merely because of this source investigation.

Historical source `sql/20260808_45_runtime_weapon_mastery.sql` at exact Git blob `8c270f53de4eaf076cbf13b0d42b64eb811e8d90` shows:
- `SECURITY DEFINER` authenticated/service_role RPC, with `private.can_manage_character_progression_v1` authorization; no actual current REST/grant test
- XPHB class/source, class-specific selection capacity, distinct selected IDs, source-legal item validation
- `character_runtime_feature_choices` state as the **authoritative runtime selection** (unique `character_id,feature_key`), with Long Rest gating for replacement and no-op return for unchanged selections
- `character_sheets` per-character JSON projections `weaponMasteries` and `meta.weaponMasteries`
- **A separate account-wide `UPDATE public.players p SET sheet=v_sheet, updated_at=now()`** using `character_permissions.user_id` as fanout. No matching-character predicate for `players.sheet` is present, so an authorized character choice could overwrite unrelated historical sheet snapshots for permitted accounts

Supporting original source pins:
- `sql/20260808_44_runtime_feature_choices_spell_mastery.sql`, blob `0d9ec7d003eca7589cce2f77f09f71432f7d8961`: runtime table and RLS creation
- `sql/20260810_89_pending_rest_runtime_choices.sql`, blob `6c5f4a5f3cfe43a634d3a4daa0592d000e644b1f`: a pending-rest aggregation function reads `get_character_weapon_mastery_v1`. This is source-level **consumer existence** only. No full mounted UI/browser experience has been demonstrated.

## Source gate

`node --test scripts/audits/test_i2j_p2_weapon_mastery_original_writer_source.mjs`

Thirteen tests pin the original four source Git blobs, validate authorization and source-bound count/choice/Long Rest and runtime authority invariants, show the distinct canonical and account mirror paths, test two deliberately altered source-negative specimens (mirror and runtime-upsert), and confirm the writer remains **not_option_a_tested**. These are **synthetic source negatives, not authentic historical signed REDs**.

## Signed local acceptance required before changing any real source

1. Recover independently authenticated, authorized **offline PG17** full `pg_get_functiondef` for original weapon-mastery RPC, MD5 `32fa55b69478af07f8f0002b967a5704`, its permission helper, source-option helper, runtime table, original character_sheets and players.sheet constraints. The checked-in August SQL alone is *not* the restored deployed body.
2. On disposable local PG17/GoTrue/PostgREST with unchanged historical function, verify signed authorized initial choice and changed-after-Long-Rest; **original RED**: canonical runtime state and character sheet succeed but unrelated editable account snapshots/timestamps are overwritten.
3. In an isolated source-MD5-pin scratch change, suppress **only** the account-wide mirror, leaving both `character_runtime_feature_choices` and `character_sheets` unchanged. **GREEN**: verify source-legal weapon choice, exact capacity, no duplicates, Long Rest replacement, replay/no-op, canonical projections, and unchanged historical same-character/unrelated/empty `players.sheet` bytes/timestamps.
4. Negative cases: invalid item/source, too few/duplicate choices, unauthorized outsider, revoked permission, wrong class/level, no qualifying Long Rest, conflicting concurrent updates, rollback after failure and correct REST ACL; preserve original source guards and failed RED evidence.
5. Do not confuse this one writer with I2J original level-up v2 double mirror; no global snapshot freeze until all **34** original UPDATE families, other UPSERT/private writers, 31-trigger nonworld-map Forge, genuine browser, independently restored DB and **340 Storage objects**, and owner-go release gates have been met.

**ONE NEXT BOUNDED TASK:** obtain authentic offline weapon mastery original source and local fixture, then run source-preserving signed RED→scratch GREEN. If original immutable restored source remains inaccessible, keep HOLD and advance only separate original writer *source* auditing, not migration or production SQL.

**Protection:** no hosted SQL even SELECT, no paid services, world map, gameplay/tactical/merchant source, original PR closure or merge, production workflow, main deployment, or agent-owned branch changes.
