# J117–J124 — Aasimar Light Bearer positive source-magic materialization

**2026-11-05 · held draft PR #324, stacked on #321 · research-only.** This report describes newly prepared J117–J124 acceptance cases; **J117–J124 are not verified until the next exact-head local GoTrue/PostgREST CI run**. Previously verified exact head `8102ebcce73f67b25abcb040c5b3852d3d4fa641` passed J00–J116, including source-positive Warlock Armor of Shadows/Eldritch Mind, source-verified grant instances, unchanged original equipment, market stock, currency and strict replay ([Actions 42148409154](https://github.com/bob8675309/DNDNEXT/actions/runs/42148409154), 4/4 success). Production database, `main`, migration path and application code untouched.

## Targeted original source branch

Original live `private.materialize_player_forge_source_magic_v1()` (PG17 `md5(pg_get_functiondef)` = `4c35eaab8dff7d3d15b64ed71881d4a6`) runs as a deferred AFTER INSERT constraint trigger on `public.character_progression`. Earlier J107 exercised **rejection** of an unsupported spell owner, but no accepted species-owned spell had yet been committed.

The selected 2024 XPHB source is precise and intentionally small:

| Source item | Read-only live identity and content |
| --- | --- |
| Aasimar | `public.character_option_catalog`, UUID `8a29f32a-0695-4aed-b968-9e1616c47a15`, key `species:aasimar\|XPHB` |
| Light Bearer trait | Exact original trait fragment: *You know the Light cantrip. Charisma is your spellcasting ability for it.* The actual trait text is stored with its original `{@spell Light\|XPHB}` source marker in the fixture |
| Additional species magic | Original XPHB `raw_payload.additionalSpells` known at level 1: `light\|xphb#c` |
| Light | Preferred-source **candidate** XPHB `spells_catalog` UUID `2b78bd2c-8d8f-4891-814d-a19631bb6b9f`, cantrip level 0, school Evocation, canonical name Light |

Five helper bodies were copied **verbatim** from live PG17 using SELECT-only `pg_get_functiondef`, then installed in scratch `scripts/fixtures/forge_species_light_original_helpers_pg17.sql` with exact MD5 checks:

- `private.player_forge_best_casting_ability_v1` — `3dce158c3dfe14ff6776855b1ead5022`
- `private.player_forge_json_spell_min_level_v1` — `c6770a82adc7ee3b79151262474b7aed`
- `private.player_forge_species_spell_choice_limit_v1` — `c9bc6081a43c52c44c1cf192886456df`
- `private.player_forge_trait_has_spell_v1` — `deb38940c6249808a39aeb2380e09c16`
- `private.upsert_player_forge_source_magic_spell_v1` — `2a880d642809146678bd391304d9777c`

The original spell-upsert helper expects `uses_max`, `uses_remaining` and `recharge` columns. Those three columns are **missing from the previous reduced fixture only** and are added to scratch `public.character_spells` for this test. The original implementation of `public.is_preferred_spell_version_v1` is **NOT** installed: the earlier reduced local test helper only checks the spell's presence in `spells_catalog`. Consequently, this is not full preferred-version spell catalog/RLS/production parity. The fixture seeds the **exact original Light Bearer trait and additional-spell expression**, but **does not** copy the full species text or all source magic options. The original deferred materializer, source-equipped Fighter/Background/feat G/GI and current combined RLS candidate are unchanged.

## Expected authenticated acceptance J117–J124 (CI pending)

| Case | Expected behavior in real disposable GoTrue/PostgREST |
| --- | --- |
| **J117** | Verify exact five original helper MD5s, safe PG17/scratch constraints and canonical source Aasimar trait + XPHB Light ID, plus spell eligibility at level 1 |
| **J118** | Sign in as player, call unchanged `create_player_character_v3` for Fighter/Soldier/Lucky, choose Aasimar and source-owned Light Bearer. Commit exactly one `character_spells` row with `source_type='species'`, `source_key='species-light-bearer'`, Light ID and source trait/catalog metadata; prepared, known and always available. Source-approved 5 gp market gear from Fighter **vanilla** 155 gp budget → **150 gp**, source stock 3→2, G/GI, nonce and event |
| **J119** | Identical original v3 request replay leaves spell I/C/S immutable; changing the source spell under the same nonce rejects `22023` with no mutation |
| **J120** | Claim the Aasimar source while selecting Elf; original species ownership handler must reject mismatch with atomic rollback |
| **J121** | Use a nonexistent canonical species owner ID; source handler rejects and all character/G/I/C/nonce effects roll back |
| **J122** | Fabricate a source trait absent from canonical Aasimar `Light Bearer` text; source handler rejects and rolls back |
| **J123** | Try to grant the valid catalog spell **Fire Bolt** through Aasimar Light Bearer; original trait check rejects the unearned cantrip with rollback |
| **J124** | Omit required Light selection; original trait-token exactness check rejects missing one currently granted spell with rollback |

Every negative test demands the **specific original handler message** and unchanged pre/post counts for characters, nonce, canonical sheet, CP, level events, G/GI, class grants, spells, inventory, currency, and market stock. An arbitrary upstream error does not qualify. This is a source-authenticated **species-owned** spell, not a class spell, and separate from the J109–J116 Warlock Invocation grants.

## Important identified source-level casting-ability issue

The live XPHB Aasimar Light Bearer text says **Charisma** is the casting ability. However, unchanged `private.materialize_player_forge_source_magic_v1()` sets `v_casting_stat` for a species trait only if its text contains **all three** *Intelligence, Wisdom, and Charisma* (a choice-of-ability trait); otherwise it assigns `NULL`. For Light Bearer's fixed Charisma text, this source logic predicts a `NULL` value in the persisted `character_spells.casting_stat`. **J118 explicitly checks the observed NULL and logs it as a known source defect** rather than falsely claiming complete ability correctness. If the test verifies this behavior, a separately scoped, fully source-aware fix and spellcasting/stat acceptance is required before release; do not silently change the original handler just to pass this research test.

## Remaining release gates / decision

The combined inventory four-policy + obsolete CHECK correction is still only `sql/candidates/20261105_inventory_character_owner_constraint_and_dml_review_v1.sql`, **not** a production migration. Original production triggers across characters, progression, sheets and inventory total 31, and the disposable fixture does not include all of them. No actual player/GM browser flows, feat-owned Magic Initiate spells, variable species lineage cantrips, class spell catalog versions, warlock multi-slot invocation dependencies or #317 global lock-order contention are proven by this test. Any source finding about casting ability must be handled in a separately authorized follow-up.

**Next action:** inspect actual exact-head JWT/J117–J124 CI log; repair only reduced fixture/test-harness mistakes without rewriting original functions; record successful evidence or blockers in a PR comment without a docs-only Vercel push. Then prioritize a controlled browser/staging acceptance plan and the casting-ability defect. No production SQL, merge, deployment, world or town map changes.
