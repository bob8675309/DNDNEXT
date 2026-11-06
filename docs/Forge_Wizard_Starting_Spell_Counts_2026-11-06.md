# Original XPHB Wizard starting spells — seeded source/GoTrue research

**Research-only, VERIFIED at executable SHA `38edc02f66f17e73a16fd0b62329c161ade4f6a2` via [CI 42308163095](https://github.com/bob8675309/DNDNEXT/actions/runs/42308163095).** First J159 failed at original exactness and its diagnosis is preserved below; full live production/RLS/browser acceptance is NOT claimed. Held branch `research/forge-wizard-spell-counts-20261106` directly based on draft [#329](https://github.com/bob8675309/DNDNEXT/pull/329) source `dbf701d87db738ccaefe4f179f006319b132a3e9`; upstream draft #328, #324 and #321 remain unmerged. No source-original handler changes or production DB writes.

## Final source-exact authenticated Wizard acceptance (2026-11-06)

At `38edc02f66f17e73a16fd0b62329c161ade4f6a2`, [Forge run 42308163095](https://github.com/bob8675309/DNDNEXT/actions/runs/42308163095) completed **SUCCESS in both disposable source-original PG17 and true local JWT GoTrue/PostgREST jobs**, preserving the earlier entire J00–J157 and S001–S003 suite. The test log explicitly confirms:

- **J158 PASS:** all nine XPHB Wizard spell IDs, names, source/class membership and canonical level-1 3/6/4/2 source progression from read-only live data are installed in the guarded disposable specimen. Original starting-spell validator MD5 `6870e810de909209c44aecd02f5c72e2` and *already staged* exactness validator MD5 `ba645ad0f2c17addad0b40e0602c2ac8` are both verified.
- **J159 PASS:** genuine signed-in `create_player_character_v3` creates 3 legal cantrips, 6 legal first-level spellbook entries (4 prepared), original `character_spells` `source_key=wizard` and complete `startingMagicSelections` summary. Assert original source class/level, actor, slots and canonical rows, inert unchanged replay, and changed preparation on the same nonce rejected SQLSTATE `22023`, no extra writes.
- **J160 PASS:** same nine source-valid spells, exactly **3** prepared, rejected by the original **deferred Wizard prepared-count validator** with `Mark exactly 4 starting leveled spell(s) as prepared; received 3.`; no character/CP/CS/G/GI/I/C/spell/stock/nonce leak or mutation of earlier valid Wizard.

The first [failing J159 run 42307389384](https://github.com/bob8675309/DNDNEXT/actions/runs/42307389384) remains a factual regression receipt; the correction filled the complete canonical summary, *not* a change to the source validator. Static deterministic compiler, full baseline, original trigger inventory, Class and handoff registry passed. The short-lived `FORGE_WIZARD_STARTING_SPELLS.json` was uploaded in `forge-jwt-diagnostics-42308163095`, sanitized of actual account/character IDs and JWTs.

**Count unchanged:** `character_progression_validate_player_forge_starting_magic_exac` was already original source-loaded at J103, and starting-spell validator was already source-loaded at J154. This work adds **real Wizard prepared-count branch evidence**, not a seventeenth distinct DDL. Thus still **16/31 original triggers staged, 15 unstaged; four independently receipted handler suites** conservatively. The fixture still uses reduced XPHB-only preferred class view, synthetic local Wizard class UUID with live counts, nine live spell specimens, reduced RLS, and no production browser/global lock-order evidence.

**Next gated engineering action:** independently verify live source/dependencies for `character_progression_validate_player_forge_nested_choices_v1` before attempting any next original-trigger installation. Preserve authoritative handler, existing J00–J160/S001–S003 and original source fingerprints.

## Live source of truth (read-only observations)

Queried live DnDWeb PostgreSQL 17 only via SELECT from the source catalog and progression rows. `public.class_catalog` XPHB Wizard class ID `2995248c-c199-4f44-a400-06ae30d4ec8b` has `spellcasting_ability='int'`. Its `class_level_progression` **level 1** has `cantrips_known=3`, `spells_known=4`, and `spell_slots=[2,0,0,0,0,0,0,0,0]`. The existing source-original `private.validate_player_forge_starting_spells_v1()` (unchanged fingerprint `6870e810de909209c44aecd02f5c72e2`) calculates Wizard spellbook level-1 requirement `6 + greatest(0,level-1)*2` = **6 first-level spells**, and prepared requirement `least(6,spells_known)` = **4**. Unlike its earlier Fighter no-spell tests, this branch explicitly tests those source-derived counts.

Read-only `spells_catalog` XPHB IDs and `classes` inclusion of Wizard:
 
| Cantrips (3) | First-level spellbook (6) |
| --- | --- |
| Fire Bolt — `fe27551a-bebb-4140-8dc0-2ab904f99955` | Detect Magic — `d05171bc-855f-4e03-a074-c3f8f6fc09bf` |
| Mage Hand — `4b84d266-3847-45f9-b154-77fd26695b55` | Feather Fall — `6c7a0380-a32a-4df5-871c-abf42400b045` |
| Ray of Frost — `38ccd26c-f6dc-4bcc-a86d-dc83fb61f177` | Mage Armor — `c9803497-bd5c-4800-aa79-01dbb80922fe` |
| | Magic Missile — `b975c0a7-8b4d-439b-85ff-3e0094656e2f` |
| | Shield — `4d757f8f-88fd-4b6a-9bf2-b6d20788f928` |
| | Sleep — `0fec723c-1a3a-42d9-bdfb-1d338c745676` |

**Test spell preparation choices** (not a claim about a particular real character): Detect Magic, Mage Armor, Magic Missile and Shield prepared. Feather Fall and Sleep in the book, not prepared. The negative case keeps all nine legal spell choices but marks Shield unprepared, yielding three prepared spells. There are no fake Fighter permissions or source-priority bypasses.

## Minimal implementation

- The shared pure SHA-256 `compileSeededIdentity` is extracted from the existing compiler without changing previous S001–S003 identifiers. A strict new Wizard manifest and validator run independently in two Node processes, assert live ID/source/level, full selection membership, progression counts, seed stability and exact local SQL data alignment. Their results are **static contract checks only**.
- Disposable-only SQL `forge_wizard_starting_spells_local_auth_pg17.sql` requires the existing authentic deferred starting-spell handler and trigger; after J157 it sets **only** local synthetic Wizard level-1 progression to the live values and inserts **only** nine read-only source-identified spell records, retaining old 901/902 specimens for the previous suites. It does not replace the earlier reduced preferred-class view or change the source-original handler.
- Signed-in `create_player_character_v3` tests append J158 source-row/slot integrity, J159 positive Wizard level 1 with 3 cantrips/6 leveled/4 prepared, immutable same-nonce no-op, and changed prepared selection nonce SQLSTATE 22023; J160 sends 3 prepared, requiring exact original deferred error `Mark exactly 4 starting leveled spell(s) as prepared; received 3.` and full rollback. The original `character_spells` rows, class source, sheet slots, and signed creator are directly read from disposable PostgreSQL, never synthesized as success.
- Artifacts include only scenario IDs/seeds, expected/observed counts and booleans, not actual UUIDs, JWTs, complete character sheets or PII. Existing J00–J157 and S001–S003 precede new J158–J160 unmodified.

## Release gates / what is NOT covered

This is a **nine-spell source specimen**, not full `class_catalog_preferred` source-priority parity, complete spell catalog, all Wizard levels, all spellbook/prepared cases, shared locks, original 15 missing trigger DDL, live security policies, or authenticated website/browser acceptance. Do not change authoritative function SQL or loosen tests to force green. If earlier staged trigger intercepts either request, report its **actual** guard and fail the original handler attribution rather than assuming it passed.

Before completion: exact-head source-original PG17+real local GoTrue CI, handoff registry, Class and trigger inventory; check sanitized diagnostics and Vercel preview avoidance; append `HANDOFF_LOG.md` and update `ACTIVE_WORK.md` with accepted/rejected status, exact SHA and one bounded next task.

**One next task:** execute and diagnose the exact-head Wizard J158–J160 research CI, then update the permanent handoff on this branch without releasing to production.

## First authenticated Wizard attempt — exactness guard failure (2026-11-06)

At source commit `4db908faf5fc4b90e0847314d6e3a87775cc91f9`, [CI 42307389384](https://github.com/bob8675309/DNDNEXT/actions/runs/42307389384) passed the source/PG17 static job and J00–J157 plus S001–S003; J158 installed and verified the actual source-identified Wizard spell/progression fixture. J159 **FAILED**, returning `Starting magic summary does not match authoritative starting spell rows.` This error is not from the new Wizard prepared-count test. The installed exact original deferred `private.validate_player_forge_starting_magic_exactness_v1()` (source MD5 `ba645ad0f2c17addad0b40e0602c2ac8`) checks `sheet.startingMagicSelections` against every actual v3 `character_spells` row, including `spell_id`, `source_type`, `source_key`, and `prepared`. The first Wizard test provided `[]` while the original v3 function materialized nine spells. This is correctly rejected, and it demonstrates source-original protection rather than a game bug.

**Corrective fixture (pending new exact-head CI):** Require the sheet summary and signed-in `p_magic_selections` to hold the same nine source-qualified `spell_id/source_type=class/source_key=wizard/prepared` choices. For the failing case, preserve all nine entries but mark Shield unprepared, so both original exactness and source/summary authority validators should accept the structure while the **unchanged** original starting-spell count validator must reject 3 prepared. Hash-pin the original exactness handler and its deferred trigger as well. No original function, canonical spell identity, required counts, or new permissions altered.

The original coverage remains **16/31 triggers staged, 15 missing** on the held stack; the starting-magic exactness trigger was previously source-staged at J103 and does not represent newly installed DDL.
