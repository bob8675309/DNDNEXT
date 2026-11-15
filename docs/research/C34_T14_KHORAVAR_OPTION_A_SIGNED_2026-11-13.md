# C34 T14 — original Khoravar Skill Versatility account mirror RED / scoped Option A GREEN (signed; RELEASE HOLD)

**Date:** November 13, 2026 America/Chicago (signed GitHub Actions ran November 14 UTC). **Research PR:** [#379](https://github.com/bob8675309/DNDNEXT/pull/379), still a draft. **Exact verified executable code SHA:** `0a998b3f6c58c2ec37c6307998fa14b172698b38`. Nothing merged to `main`; no hosted SQL, RLS, Storage, Vercel or protected world-map runtime changes.

## Source custody and deliberate Option A change

- The **unchanged original held I1-J #358** [signed source fixture](https://github.com/bob8675309/DNDNEXT/pull/358) is copied byte-for-byte into `scripts/integration/c34/sources/08_i1j_original_khoravar_skill_pg17.sql`, Git blob **`d84d149b5bc4ef0e62f69a048ab77620f472a94a`**. Original historical PR #358 and source remain open/untouched.
- `scripts/integration/c34/c34_original_khoravar_skill_with_legacy_mirror_pg17.sql` uses six original I1-J private function bodies unchanged and the original `character_progression_materialize_player_forge_khoravar_skill_v` **AFTER INSERT / DEFERRABLE INITIALLY DEFERRED** trigger. The seventh unchanged original dependency `private.normalize_player_choice_name_v1(text)`, MD5 `dd8cdd5b47efe99b1cfff9c2bf7635dd`, is already provided by original T5, and original `character_has_species_source_v1` is reused from T12. Source original materializer MD5 **`9d5fec42e2aefdd39d8a34adf1548460`**. Original legacy account projection helper MD5 **`7f6e7d7d99ff79db1372462b4320c21b`**.
- `scripts/integration/c34/c34_khoravar_source_skill_tool_specimen_pg17.sql` seeds **four real original source-identified XPHB** skill/tool rows (Acrobatics, Arcana, Alchemist's Supplies, Dice Set) into test-only reduced catalog, without replacing T5's production-shaped 13-column preferred-view precedence. This does **not** assert complete live catalog parity.
- After exercising the original helper with genuinely signed JWTs, `scripts/integration/c34/c34_khoravar_option_a_character_scoped_projection_candidate_pg17.sql` installs a **deliberately non-original helper** under the exact runtime name `private.set_species_runtime_projection_v1(uuid,text,jsonb)`. Its full function body differs from the original **only by removing the two-line UPDATE of `public.players.sheet` for all linked permission users**, replaced by an explanatory comment. It retains the original canonical `character_sheets.sheet` lock/projection, restricted function EXECUTE and SECURITY DEFINER context. This is an **Option A design candidate**, not an original-source-complete deployed replacement.
- Explicit test/source audits pin the full original blob, all original function bodies, handler timing and fingerprints, the precise helper difference, catalog IDs and the absence of reintroduced account writes. Six new static tamper tests N38–N43 ensure original-source and compatibility guard drift fail closed.

## Real signed original defect RED (not hypothetical)

1. Authenticated PG17/GoTrue/PostgREST creation with an existing legacy account `players.sheet` carrying `HISTORIC_ACCOUNT_FROZEN` succeeds using original Khoravar Skill Versatility and mirrors the selected proficiency from the new character into `players.sheet`, **losing the unrelated historical account marker**. [Signed workflow #43561113457](https://github.com/bob8675309/DNDNEXT/actions/runs/43561113457), RED01.
2. A separate authenticated co-editor with their own historic account sheet receives linked character permissions; invoking the original privileged species projection in the **disposable local DB only** overwrites that second user's distinct account sheet as well. RED02. The second witnessed source call correctly updates the canonical row timestamp; the test hash checkpoint was moved **after** both intentional RED calls, before asserting the compatibility installer had no migration/backfill side effects. No hosted accounts were affected.

## Authenticated Option A candidate GREEN

After installing the explicitly changed projection helper, the **unchanged original Khoravar materializer, deferred trigger and source catalog resolver** pass:

- Source-owned **Acrobatics** choice creates exactly one `EFA / long_rest` runtime proficiency and per-character `sheet.runtimeProficiencies.khoravarSkillVersatility`; original historical account sheet hash remains unchanged. Identical signed creation nonce replay is inert across canonical sheet, runtime, progression, spells and feat grants. GREEN01/02.
- Source-identified **Alchemist's Supplies** tool choice creates another character independently, without overwriting the first character's chosen skill or the shared account snapshot. A linked co-editor's separate account sheet also remains unchanged when the privileged projection is invoked against the canonical character. GREEN03/04.
- Missing proficiency, empty array, two simultaneous selections, invented `skill:astrology` and a forged item UUID reject via the **original source resolver/cardinality logic**, atomically rolling back characters, nonce, equipment, spells, feat grants, runtime rows and account snapshots. GREEN05.
- A source-valid non-Khoravar Elf creates **no Khoravar runtime state**. Two real concurrent authenticated same-nonce Khoravar creations produce just one character, reservation and runtime row. GM secret, world-map movement exclusion and uninstalled post-rest RPC boundary stay intact. GREEN06/07.

**All original T1–T13 signed regression cases also passed in the same disposable PG17/GoTrue/PostgREST test job**. The full original I1-C source/private Story and immutable nonce tests remained active. Exact code head `0a998b3f6c58c2ec37c6307998fa14b172698b38` passed **52/52 source/static+negative tests**, including all six T14 source tamper cases.

## Five exact-head GitHub Actions receipts

All **SUCCESS** at executable `0a998b3f6c58c2ec37c6307998fa14b172698b38`:
- [Full signed PG17/GoTrue/PostgREST, RED/GREEN and T1–T13 #43561113457](https://github.com/bob8675309/DNDNEXT/actions/runs/43561113457)
- [Source-integrity 52/52 and no-release tests #43561113443](https://github.com/bob8675309/DNDNEXT/actions/runs/43561113443)
- [Tactical original spell preservation #43561113448](https://github.com/bob8675309/DNDNEXT/actions/runs/43561113448)
- [Class browser validation #43561113437](https://github.com/bob8675309/DNDNEXT/actions/runs/43561113437)
- [DNDNext handoff registry #43561113460](https://github.com/bob8675309/DNDNEXT/actions/runs/43561113460)

Earlier exact-head failures retained: first signed test failed an invalid **test hash checkpoint** (captured before a second intentional RED writer call updated `character_sheets.updated_at`), not original handler; second signed test passed GREEN01–05 but used a Human negative control that correctly failed its separate **Human Skillful required-choice** rule. That control was changed to an already-proven valid Elf. Final executable SHA above is green. No original source was weakened or altered to resolve either harness issue.

## Coverage and release HOLD

**22/31 original live trigger definitions** now co-reside in disposable C34 (progression **12/19**, sheets 4/4, characters 4/6, inventory 2/2). **Nine remain: seven non-map progression and two explicitly protected world-map movement/rest/camping triggers.** Two separately held NPC privacy, one held verified creator-seed trigger, and five original downstream grant triggers are separate. **Census is DDL presence**, not source-perfect production behavior: T14's projection helper is intentionally modified while all original source is preserved for review.

The shared helper in historical `sql/20260808_63_species_rest_proficiency_runtime.sql` also feeds public Githyanki Astral Knowledge and Khoravar after-Long-Rest configuration and a rest-expiry trigger. Those routes, real source-first browser consumers, all 34 old `players.sheet` writer paths (12 bounded-tested; **22 still unverified**), all-class catalogs, role revocation, cross-character lock/contention and real browser workflows are **NOT independently accepted** here. Full original 44-PR disposition, restored and verified PG17 dump + all 340 Storage objects, backup secondary copy, production-shaped staged migration/rollback and explicit release go/no-go remain outstanding.

**NEXT bounded feature-complete research:** inspect held [#354 I1-F](https://github.com/bob8675309/DNDNEXT/pull/354) Battle Master **paired original** `character_progression_materialize_battle_master_maneuvers_v1` and `character_progression_validate_battle_master_maneuvers_v1` (five source-original private functions, 12 source-identified XPHB maneuvers, new grant-table dependencies). Keep the pair together for signed RED/GREEN, preserve original source, no legacy mirror, full prior T1–T14 regression. No production SQL or protected world map. The hourly DNDNext Safe Development scheduled automation remains **paused**.
