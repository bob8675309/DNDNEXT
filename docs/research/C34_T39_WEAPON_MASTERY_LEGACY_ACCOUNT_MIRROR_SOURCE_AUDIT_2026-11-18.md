# C34 T39 — source-original Weapon Mastery legacy-account mirror characterization

**2026-11-18 CST. Draft research [PR #379](https://github.com/bob8675309/DNDNEXT/pull/379).** Exact source-only executable `9fec9578808d1d42d5d7cc6fc377ad3b5a74a41d`. [GitHub Actions static source workflow #44388545165](https://github.com/bob8675309/DNDNEXT/actions/runs/44388545165) **SUCCESS (7/7 new T39 source/mutation tests; all preceding inherited source tests also passed)**. This is **source characterization**, NOT a signed PostgreSQL demonstration, Option A replacement, deployed runtime, or release approval. Hourly autonomous DNDNext Safe Development automation was explicitly **PAUSED by owner request** before this audit; its prompt and schedule were preserved.

## Review of the latest hourly agent work and live repository

- Last recorded scheduled agent run (2026-11-18 20:02 UTC) was read-only and identified `public.configure_character_weapon_mastery_v1(uuid,uuid[])` in `sql/20260808_45_runtime_weapon_mastery.sql` as a candidate outstanding legacy-sheet writer. The agent did not submit a code or database mutation. Live PR #379 remained at `2436cf7a1a946bea7ced34a41595817266cb93b2` after the prior T38-R5 handoff. Its source-only checks and docs were already green. `main` stayed `bb3939eeb9a38cf416996a1dca3b196b156b2915`; protected world-map code is untouched.
- At T39 start, original SQL Git blob `8c270f53de4eaf076cbf13b0d42b64eb811e8d90` matched byte-for-byte in current `main` and draft #379. The SQL is the ORIGINAL runtime adapter and is **NOT** modified by T39. There is no new application feature, host migration, production query or activation.
- Default-branch GitHub code search returned exactly one literal `configure_character_weapon_mastery_v1` occurrence (its SQL definition); `get_character_weapon_mastery_v1` occurs in that definition and `sql/20260810_89_pending_rest_runtime_choices.sql` for rest options. Each of the **19** application source files immediately changed on PR #379 (`pages/`, `components/`, `utils/`) was also inspected; none contained a direct literal Weapon Mastery configuration caller. Searches and source-file samples do **not** exclude indirect/dynamic RPC, other historical PR branches, external clients, or future UI callers. No positive browser route acceptance is claimed.

## Exact source-path finding — bounded but material

The original privileged `public.configure_character_weapon_mastery_v1` authenticates through `private.can_manage_character_progression_v1(p_character_id)`, locks the target `character_progression`, validates XPHB class/level and eligible weapons, enforces distinct capacity, rest-cycle single replacement, and stores authoritative `character_runtime_feature_choices`. It correctly writes derived `weaponMasteries` and `meta.weaponMasteries` to the **specific** `character_sheets` row:

```sql
update public.character_sheets set sheet=v_sheet,updated_at=now() where character_id=p_character_id;
```

**But it subsequently replaces the complete account-wide legacy Sheet for EVERY linked permission account:**

```sql
update public.players p set sheet=v_sheet,updated_at=now()
where p.user_id in(select cp.user_id from public.character_permissions cp where cp.character_id=p_character_id);
```

The second statement has **no** `players.sheet` emptiness/first-character ownership check and no identity relationship between an account's existing legacy snapshot and the target character. On a successful permitted configuration call, any matching legacy account rows are overwritten regardless of their prior Sheet identity. This is a **source-proven unsafe update scope**, not evidence that a production account has been changed or that every hypothetical actor can call the RPC.

This risk is independent of the already characterized `create_player_character_v2` legacy overwrite and T14 Khoravar, T16 Wizard Signature, T17 Artificer Option A research. Those signed RED/GREEN results demonstrate the design pattern but **do not** count T39 as a signed executable RED/GREEN or close another original writer. Count remains **22/34 legacy writers unresolved** until verified reconciliation and positive/negative test acceptance.

## T39 source-only tests and scoped limitations

New `scripts/integration/c34/test_t39_weapon_mastery_legacy_sheet_source.mjs` is wired into `.github/workflows/validate-c34-joint-source-research.yml`, preserving all inherited CI steps. It checks exact Git blob, SECDEF function/EXECUTE grant, target permission and row-lock gates, Long Rest/no-op rules, runtime state, canonical per-character projection and the **historical overbroad** account mirror. Three in-memory negative-mutation groups detect removed account-mirror provenance, canonical target scoping, auth/locking, and Long Rest gates. The first newly authored CI [run 44388294230](https://github.com/bob8675309/DNDNEXT/actions/runs/44388294230) failed only T39-N03 because its mutation hit the earlier GET function's duplicate permission guard, not the CONFIGURE function. Test-only commit `9fec9578808d1d42d5d7cc6fc377ad3b5a74a41d` restricts the mutation to CONFIGURE; [source CI #44388545165](https://github.com/bob8675309/DNDNEXT/actions/runs/44388545165) passed. This was a **test error**, not a source-auth bypass or application defect.

**What passes:** exact original-source and source-mutation contract tests. **What remains unproven:** any original full PostgreSQL/JWT execution of the Weapon Mastery RPC, whether production data actually has the hazardous configuration, option-legal weapon IDs under full live catalog, current UI callers beyond inspected sources, transactional co-editor/account behavior, valid rest cadence, and a safe, integrated production fix.

## ONE next bounded engineering task: signed original RED / explicit Option A GREEN (disposable only)

1. Build a deliberately disposable, schema/source-fingerprint-guarded PG17/GoTrue/PostgREST fixture using the exact original blob and authoritative catalog/permissions. Use one Fighter level 1 target with **three source-legal distinct XPHB mastery weapon IDs** (and no unrelated gameplay movement triggers). Set two signed user accounts linked to that target, each with distinct historical nonempty `players.sheet` markers, plus a **second independently authorized character** with a distinct canonical Sheet for one account.
2. Execute original `configure_character_weapon_mastery_v1` with the authorized actor and real JWT, assert canonical target `character_runtime_feature_choices` and `character_sheets` are correct, assert unrelated character's canonical Sheet remains unchanged, and explicitly capture original **RED**: both independently seeded legacy account snapshots are overwritten. Also test direct anonymous/outsider deny without mutation, wrong count/duplicate/illegal source weapon, and no-op/rest single-replacement behavior.
3. Only after original signed RED is independently reproducible, create a **separate, explicitly NON-ORIGINAL** candidate with the original account-wide `players.sheet` mirror removed while keeping all other original function content, ACL, locks, source/level validation, runtime choices, canonical target projection, no-op/Long Rest behavior and original `get_character_weapon_mastery_v1`. Pin original-to-candidate exact single-clause difference. Run new positive and denial/revocation/replay/rollback signed **GREEN**, plus all inherited regression suites in free existing CI.
4. Do not alter `main`, protected world map, held original PRs, hosted Supabase SQL/RLS/data/Storage, deployment, finance/paid agent, or original file itself. Preserve owner authorization policy (`admin/gm/dm` equal application tier; delegated rights narrowly character-scoped) and all source custodianship. Independent encrypted DB restore + **340 Storage objects**, remaining legacy writer census, full route/role compatibility and explicit owner go/no-go keep release **HOLD**.
