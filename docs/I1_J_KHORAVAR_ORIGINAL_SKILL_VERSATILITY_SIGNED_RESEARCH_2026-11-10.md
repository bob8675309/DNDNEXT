# I1-J — Source-original EFA Khoravar Skill Versatility with signed Warlock/Eladrin coexistence

**Date:** 2026-11-10. **Research-only draft:** [PR #358](https://github.com/bob8675309/DNDNEXT/pull/358), stacked directly on [I1-I #357](https://github.com/bob8675309/DNDNEXT/pull/357). Owner's November 9 I0–I6 all-original-PR preservation direction controls. Not a hosted migration or release approval.

## Original live authority and source inventory

The genuine live PostgreSQL 17 `character_progression_materialize_player_forge_khoravar_skill_v` is an **AFTER INSERT DEFERRABLE INITIALLY DEFERRED CONSTRAINT TRIGGER** calling `private.materialize_player_forge_khoravar_skill_versatility_v1()`. It was absent from the I1-I combined signed test fixture. The original function reads the source-serialized `sheet.sourceChoices.species-runtime-khoravar-skill-versatility.fields.proficiency.selections` for `species='Khoravar'`, `speciesSource='EFA'`, and the shared Forge creator marker. It resolves exactly one source-catalog skill or tool into `public.character_runtime_feature_choices` and projects to `sheet.runtimeProficiencies.khoravarSkillVersatility` and linked `public.players.sheet`.

**Read-only live source fingerprints** (captured as byte-identical `pg_get_functiondef` bodies, checked at install):

| Original private function | MD5 |
| --- | --- |
| `materialize_player_forge_khoravar_skill_versatility_v1()` | `9d5fec42e2aefdd39d8a34adf1548460` |
| `normalize_player_choice_name_v1(text)` | `dd8cdd5b47efe99b1cfff9c2bf7635dd` |
| `astral_trance_skill_key_v1(text)` | `68dcc3383c6727020331b9391ec8dde4` |
| `astral_trance_skill_options_v1()` | `08962b553e01fa0c2119b988d33518be` |
| `khoravar_skill_versatility_options_v1()` | `afc3acbe1313d166105794a4be0ebd41` |
| `resolve_khoravar_skill_versatility_v1(text)` | `1d4240ad22fd1c3d017cc8205518bfc9` |
| `set_species_runtime_projection_v1(uuid,text,jsonb)` | `7f6e7d7d99ff79db1372462b4320c21b` |

Existing I1-I original `character_has_species_source_v1(uuid,text,text)` MD5 `d1264573b17e7569ba75371aa7e912eb` is **reused**, not redefined. Existing Eladrin source functions, all three Warlock safeguards/acquisition, Story and Stage4 RLS remain unchanged.

**Source-grounded XPHB catalog specimens** from SELECT-only DnDWeb reference rows:

- Skills: Acrobatics `87d46c71-9858-4731-9715-06b2ff387fc5` / `skill:acrobatics`, Arcana `9fe003bf-37f4-4432-b864-edab79f32686` / `skill:arcana`.
- Tools: Alchemist's Supplies `bd914b52-04de-4cf3-a0ca-0200c9930e06` / `tool:bd914b52-04de-4cf3-a0ca-0200c9930e06`; Dice Set `dbbec469-010d-4915-907e-f5cd220a9f26` / `tool:dbbec469-010d-4915-907e-f5cd220a9f26`.

The original Khoravar options function derives skills from `private.astral_trance_skill_options_v1()` via `public.character_option_catalog_preferred.metadata`, and deduplicates mundane tools in `public.items_catalog` using preferred source ordering. I1-G's reduced preferred view had five columns but lacked `metadata`. The I1-J fixture *appends* this actual source-required column while retaining all existing column order, `security_invoker=true`, and closed anonymous/authenticated grants. It then seeds the four source-identified records. No bespoke resolver, invented proficiencies, or production catalog replacement is used.

## Bounded artifacts and test method

- `scripts/fixtures/i1j_khoravar_original_skill_versatility_pg17.sql`: guarded disposable local PG17-only SQL; requires completed I1-H Warlock and I1-I Eladrin original trigger/source fingerprints; adds the seven unchanged full live-source private function bodies, exact original Khoravar constraint trigger, source-shaped skill/tool catalog data and safe preferred-view metadata extension. Exact MD5, trigger timing, option count and local ACL check must pass.
- `scripts/test_i1g_warlock_original_guards_joint_local_auth.mjs`: appends **I1-J** cases only when `DNDNEXT_I1J_LOCAL_CONFIRM=DISPOSABLE_LOCAL_GOTRUE_PG17_ONLY`, after all older I1-C through I1-I test cases have run unchanged. Uses genuinely authenticated local GoTrue + PostgREST calls, not fake JWTs or service-role per-character grants. Scratch SQL seeds the optional signed user's `public.players` mirror to observe the original projection function; player creation, nonce, Story and runtime state must originate in the real signed request.
- `.github/workflows/validate-i1j-khoravar-original-local-auth.yml`: distinct local-only test via pinned Supabase CLI v2.120.0, PostgreSQL17, GoTrue/PostgREST on loopback. Always discards test services/data.

## Signed acceptance cases (pending exact CI receipt at initial publication)

| Case | Contract |
| --- | --- |
| I1J-01 | Original 7-function source and exact 2 XPHB skills + 2 XPHB tools resolver; strict key/provenance checks |
| I1J-02 | Signed EFA Khoravar Fighter with Acrobatics commits runtime feature row + canonical sheet and **player mirror**, source equipment/currency and private Story+nonce. Identical replay leaves runtime timestamp unchanged; modified Story and outsider denied |
| I1J-03 | Signed source-grounded XPHB Alchemist's Supplies tool grants exactly one canonical Khoravar runtime choice; earlier skill choice unchanged |
| I1J-04 | Single signed EFA Khoravar Warlock COMMIT includes original `khoravar-skill-versatility` state **and** original Warlock Pact Invocation grant, Story/nonce with inert retry |
| I1J-05 | Missing source choice returns original invalid skill/tool error with zero character, Story, nonce, equipment, currency, runtime or player-mirror residue |
| I1J-06 | Empty choices rejected by original exactly-one cardinality check with atomic rollback |
| I1J-07 | Two simultaneous skill/tool choices rejected by original cardinality check with atomic rollback |
| I1J-08 | Invented skill or forged `tool:uuid` denied by original source resolver; zero residue |
| I1J-09 | Non-Khoravar source does not receive feature; original Eladrin seasonal rows, Warlock grants, Wizard/Battle Master, Stage4 inventory policies, original 5 deferred Warlock/Eladrin/Khoravar triggers all preserved |

**Original source NULL nuance:** Like Eladrin, a completely missing JSON selection yields SQL NULL; the original `IF ... <> 'array' OR jsonb_array_length(...) <> 1` is not TRUE, so it falls into the unchanged resolver's **invalid skill/tool** error. An explicitly empty or overpopulated array instead raises **requires exactly one**. The test asserts these exact source-observed errors and full rollback, not replacement of source code.

## Important exclusions / protected boundaries

This is **source-authentic local reduced fixture**, not a full 31/31 source-production trigger graph, full source-priority preferred views, complete 18-skill/74 weapon-tool catalog, full runtime RLS/authorized rest-configuration RPCs, browser selection acceptance, long-rest replacement mechanics, concurrent CP/CS/G/I lock-order evidence, hosted SQL migration, or backup/Storage restoration. No runtime code, world-map route/camping triggers, deployed Vercel, live Supabase, original PR history or paid agent #325 is touched. In particular, **do not claim that a successful initial proficiency materializer test certifies Long Rest skill/tool replacement**. The permanent skill/feat catalog must not be rewritten.

**Next single action:** obtain the exact signed source code CI result, preserve any authentic failure and resolve only bounded fixture/test mistakes without changing source hashes, then add an exact-head receipt and choose another genuinely missing non-map original trigger for I1-K. Remain draft/unmerged, preserve original PR branches, and keep recovery and production release gates separately blocked.
