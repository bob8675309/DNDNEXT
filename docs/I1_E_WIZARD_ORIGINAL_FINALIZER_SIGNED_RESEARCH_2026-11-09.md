# I1-E — Source-original Wizard Savant + Signature finalizer (signed research)

**Research only; not a production migration.** This work stacks on [draft I1-D #352](https://github.com/bob8675309/DNDNEXT/pull/352) and preserves all earlier I1-B/I1-C/I1-D signed negative controls. Original owner direction is [November 9 I0–I6 all-PR integration](PR_INTEGRATION_PRIORITIZED_PHASED_PLAN_2026-11-09.md). The independent original [#349 31-trigger census](Forge_Original_Creation_Trigger_Coverage_2026-11-05.md) is unchanged.

## Read-only original source extraction

The original DnDWeb hosted PG17.4 functions were retrieved using **SELECT-only `pg_get_functiondef`**. No hosted data or schema was mutated. `scripts/fixtures/i1e_wizard_original_functions_pg17.sql` contains the complete eight original function bodies, with unmodified function signatures, bodies and security attributes, and fails closed if their executable `md5(pg_get_functiondef)` values deviate from these exact original hashes:

| Exact original function under `private` | Live function MD5 | Role |
|---|---|---|
| `normalize_player_choice_name_v1(text)` | `dd8cdd5b47efe99b1cfff9c2bf7635dd` | Source-owned choice normalization |
| `wizard_savant_school_v1(text)` | `39cb0f3c7041e7d5f63538f03c6abb7f` | Map XPHB Wizard subclass to Savant school |
| `highest_spell_level_from_slots_v1(jsonb)` | `84ff66ed7dcdeccc6593c05a6d24c4cb` | Starting slot-level check |
| `wizard_spellbook_has_spell_v1(uuid,uuid)` | `f902c2d45de3ae7b9c63132117fc99e0` | Canonical Wizard spellbook membership check |
| `apply_wizard_signature_spell_ids_v1(uuid,jsonb,text,text)` | `c6d23dc8eccb824e9199ca027139a7da` | Signature state in canonical spell records and sheet |
| `materialize_player_forge_wizard_savant_for_character_v1(uuid)` | `49594930f540d308b43ce00461462829` | Original Savant deferred materializer |
| `materialize_player_forge_wizard_signature_for_character_v1(uuid)` | `02395e9d544ef6d5d1e6e5436d080294` | Original Signature source validator / writer |
| `materialize_player_forge_wizard_final_v1()` | `3c71ad65cde45d74bef4ea63f25847ac` | Original deferred AFTER INSERT Wizard trigger dispatcher |

The original Wizard finalizer trigger is `character_progression_materialize_player_forge_wizard_final_v1`, a `CONSTRAINT TRIGGER` on `character_progression`, AFTER INSERT, DEFERRABLE INITIALLY DEFERRED. The **real source** calls Savant then Signature, and a failure in the second must roll back the first, the Forge character, Story and immutable nonce as one transaction.

## Source-subset dependency composition

`scripts/fixtures/i1e_wizard_joint_setup_pg17.sql` adds this exact original Wizard finalizer and the pre-existing **unmodified** source-original `apply_character_forge_subclass_choice_v1` BEFORE INSERT progression trigger (MD5 `273be29420a7274d997642e302604cb7`). This is necessary because the old minimal Forge subset did not assign `character_progression.subclass_name`: Savant would otherwise silently return before testing any real school-specific choices.

For trustworthy positive/negative testing, the fixture adds the original Wizard source-required progression/character_spells fields, a bounded XPHB Evoker subclass specimen, canonical spell IDs, Evocation level-1–8 Wizard specimen spells and level-3/level-20 starting slots. The installed Wizard functions are unchanged. **However, `class_feature_catalog` and `spells_catalog_preferred` remain test-reduced.** The preferred view is a scratch `SELECT * FROM spells_catalog` for one-version-per-name synthetic sources, **not** the original production source-priority view and not a proof of PHB/XPHB duplicate-resolution semantics. Historical UI, real catalogs, feats, grants, all 31 triggers and world-map movement are untouched.

The signed fixture runs after I1-D has installed the **exact unchanged Stage4 inventory CHECK/four RLS** candidate in a disposable PG17 database. It uses genuine GoTrue-issued JWT via PostgREST and executes the original #324 nonce + #345 Story + I1-C corrected immutable complete intent. No production/staging endpoint is accepted. The workflow remains pinned to CLI `supabase@2.120.0`, avoiding the November 2026 CLI v3 breaking target/default changes.

## Signed test matrix

| Case | Positive / negative contract |
|---|---|
| I1E-SETUP | All eight exact function MD5s, original subclass BEFORE INSERT and deferred Wizard CONSTRAINT trigger timing; original Stage4 still present |
| I1E-01 | Genuine player Wizard Evoker level3, two legal Evocation Savant spellbook records, correct provenance, complete nonce + private Story, inert identical retry, changed-only Story rejection |
| I1E-02 | Level3 missing required Savant group fails at original deferred COMMIT; no character/Story/nonce survives |
| I1E-03 | Duplicate spell choices are rejected by original source; full transaction rollback |
| I1E-04 | Legal Wizard level20 exact Savant chronology (9 distinct spells) plus 2 level-3 Signature Spells, each flagged prepared, always-available and one short-rest use in canonical assignments; sheet summary saved |
| I1E-05 | Level20 missing Signature choice after Savant inserts rejects entire transaction; no character/Story/nonce or orphan spells |
| I1E-06 | Identical replay after explicit Story edit preserves exact spell assignments/uses and later Story; changed-only Story rejected by original immutable nonce |
| I1C-01–11 + I1D-01–11 | Original negative and positive Forge/privacy/Stage4 rollback, RLS, merchant inventory preservation, same-nonce concurrency, three C3.3 original guards remain unchanged |

**Evidence discipline:** As with I1-D, a green source-subset run is not full original 31-trigger acceptance, original source-priority catalog parity, all character class/school variations, global CP/CS/G/I deadlock-order proof, or authorization to touch the production database. Test failures remain preserved and diagnosed before adjusting scoped fixtures.

## Accounting and next blocker

Original #349 source census remains **31 original triggers**. Its historical Forge-only SQL fixtures contain **17 staged DDL / 14 historically absent**, not one 17-trigger signed database. I1-D independently source-tested three of the historical 14. I1-E stages one more (`Wizard finalizer`) and reuses the existing Forge-original subclass handler, while **two map movement/resting original triggers remain protected** and **eight other uncomposed non-map original handlers** still require source-original dependencies and acceptance. This accounting must not be represented as 21/31 signed in a single PG17 environment.

**Next after exact-head signed CI:** review any source/fixture failures without replacing original handlers; then choose ONE remaining source-original non-map trigger with the highest functional risk (e.g. Battle Master maneuvers or Warlock normalized invocations), preserving genuine source-qualified catalogs and trigger/RLS/rollback evidence. Separately require source-authentic 31/31 full combined environment, complete ten-step browser, encrypted second backup, full database/340 Storage byte restore rehearsal and explicit owner go/no-go before a coordinated production SQL/merge release.

**No production SQL or data writes. No main merge. No world-map modifications. No paid agent or original PR retirement.**
