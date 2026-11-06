# Original XPHB Wizard starting spells — seeded source/GoTrue research

**Research-only candidate — 2026-11-06; real CI PENDING.** Held branch `research/forge-wizard-spell-counts-20261106` directly based on draft [#329](https://github.com/bob8675309/DNDNEXT/pull/329) source `dbf701d87db738ccaefe4f179f006319b132a3e9`; upstream draft #328, #324 and #321 remain unmerged. No source-original handler changes or production DB writes.

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
