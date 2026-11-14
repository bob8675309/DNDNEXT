# C34 T13 — original MPMM Eladrin initial-season materializer (signed RED→GREEN; HOLD)

**November 13, 2026 America/Chicago / November 14 UTC.** Research-only draft [#379](https://github.com/bob8675309/DNDNEXT/pull/379), branch `research/c34-clean-main-privacy-forge-joint-source-20261112`. **Exact tested executable commit:** `9d6db1c078d964aa1e3bc8d552b798bd72ee8248`, still based on `main` `6637b14f807ebec79542deb7eef4b2bc3abfb5fd`. No main merge, hosted SQL/Storage changes, Vercel deploy, map changes or PR retirement.

## Original source identity / T12 compatibility

- Source preserved byte-for-byte from held original [I1-I #357](https://github.com/bob8675309/DNDNEXT/pull/357): original Git blob **`323ef20258d8b3a7c7bc96e0b1d279ba755fcce5`**, copied to `scripts/integration/c34/sources/07_i1i_original_eladrin_season_pg17.sql`. The original held PR is not retired or modified.
- T13 C34-only adapter `scripts/integration/c34/c34_original_eladrin_season_pg17.sql` reuses the source-original T12 canonical `character_runtime_feature_choices` table and `private.character_has_species_source_v1(uuid,text,text)` **MD5 `d1264573b17e7569ba75371aa7e912eb`**; it does not import I1-I's earlier disposable table or any held after-Long-Rest RPC.
- All **four original private function bodies are unchanged**, with runtime `pg_get_functiondef` MD5 guards: `eladrin_season_options_v1()` `a142c557fa028eb1b7a087c7802a7afb`; `resolve_eladrin_season_v1(text)` `5f351b120410855845d72586dc66c62b`; `set_eladrin_season_projection_v1(uuid,jsonb)` `eb1da99fed6f0785266eb061ce8bad39`; `materialize_player_forge_eladrin_season_v1()` `b866a8dff88bbfe6fb2c4f6d4c102fee`.
- Exact original `character_progression_materialize_eladrin_season_v1` **AFTER INSERT DEFERRABLE INITIALLY DEFERRED** constraint trigger; no trigger retiming. A test-only preflight requires exactly the prior 23 enabled triggers (20 original + three held) and explicitly excludes the two world-map movement/rest/camp triggers; postflight requires 24 enabled (21 original + three held).
- `verify_original_trigger_coverage.mjs` confirms the SHA-pinned source, exact function bodies, runtime table nonduplication, original trigger name/handler/event/timing and census; five new negative mutation tests (N33–N37) reject source, event, timing, projection and MD5 drift.

## Real authenticated RED→GREEN, not hypothetical

- **Before T13 installer:** genuine signed `create_player_character_v3` accepts an MPMM Eladrin with Winter selected but has **no** species season runtime row or canonical sheet projection. Captured character/progression/runtime row hashes remain unchanged after prospective trigger installation, with **no historical backfill**.
- **After installer:** genuine signed JWT creation for **Autumn, Winter, Spring and Summer**, each with exactly one `public.character_runtime_feature_choices` row (`source=MPMM`, `cadence=long_rest`, `configured=true`, `initial=true`) and corresponding `character_sheets.sheet.runtimeFeatures.eladrinSeason` projection. Same-nonce replay preserves canonical runtime, sheet, spell, feat and progression hashes.
- Original handler rejects **missing, empty, double and fabricated seasonal choices**; each signed negative atomically rolls back character, immutable nonce, grant-instance/aggregate, equipment, spells and runtime rows. A non-Eladrin XPHB Elf receives no MPMM Eladrin season state. Truly concurrent same-JWT/same-nonce creation yields exactly one character, nonce and season row.
- Historic nonempty account-level `public.players.sheet` snapshot stays unchanged, consistent with the owner's **Option A** direction for this Eladrin path; GM secret stays GM-only. This does **not** resolve the 22 untested account-sheet writers elsewhere.
- Verified real signed regressions from **T1 through T12** pass in the same PG17/GoTrue/PostgREST disposable test job. **46/46 source/static/negative tests PASS**.

### Verified exact-code-head CI

All five GitHub Actions checks succeeded for **`9d6db1c078d964aa1e3bc8d552b798bd72ee8248`**:

- [Signed PostgreSQL 17 + GoTrue/PostgREST integration #43558475837](https://github.com/bob8675309/DNDNEXT/actions/runs/43558475837)
- [Exact source integrity and 46 static/negative tests #43558475801](https://github.com/bob8675309/DNDNEXT/actions/runs/43558475801)
- [Tactical spell preservation #43558475804](https://github.com/bob8675309/DNDNEXT/actions/runs/43558475804)
- [Class browser polish #43558475827](https://github.com/bob8675309/DNDNEXT/actions/runs/43558475827)
- [Handoff registry #43558475890](https://github.com/bob8675309/DNDNEXT/actions/runs/43558475890)

The first attempt at the new source-only workflow failed because **three pre-existing static assertions still expected T12's 20/31 count**, while the actual census was already 21/31; no signed integration run was started on that unsuccessful attempt. Assertions were updated to 21/31, 10 missing and 24 total original+held while retaining the fail-closed negative cases. All five workflows passed at the above final executable head.

## Census and remaining gates

**21 of 31** original live creation trigger definitions now coexist in disposable PG17: progression **11/19**, character sheets 4/4, characters 4/6, inventory 2/2. **10 remain**: eight non-world-map progression and the two owner-protected world-map movement/rest/camp triggers. Two held NPC privacy triggers + one held original-source-adjacent creator seed trigger + five original downstream grant-table hooks remain separate from the original 31.

**Not yet accepted:** complete live catalog/rules/source permissions, real player and Admin/NPC browser role matrix, original PR/consumer source dispositions, cross-system concurrency/lock graph, 22/34 unverified legacy account-sheet writers (especially original Khoravar helper's `UPDATE public.players`), post-Long-Rest Eladrin season/trance RPCs, independent PG17 + all 340 Storage object restore, production migration/rollback proof, 31/31 complete graph. Original #357 remains intact. Draft PR #379 and original 44 drafts remain **HOLD**.

**Next bounded step:** source-authentically review original `character_progression_materialize_player_forge_khoravar_skill_v` in held #358 but **do not blindly install its original `private.set_species_runtime_projection_v1`**, because its original implementation writes `public.players.sheet` for every linked permission user. Prepare owner Option A compatibility and freeze/no-account-overwrite negative tests before a prospective original-handler installation. Preserve exact original source, explicitly distinguish any replacement helper from source-original, and use real signed RED/GREEN. Alternatively select an independent class-specialization source trigger if Khoravar dependencies require a separate release decision. No protected map, main/hosted SQL, deletion, deployment or paid agent.
