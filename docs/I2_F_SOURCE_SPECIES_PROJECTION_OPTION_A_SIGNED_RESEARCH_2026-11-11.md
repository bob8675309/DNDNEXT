# I2-F — SourceChoices and species runtime-projection legacy-sheet freeze research

**Research-only draft, November 11, 2026 (America/Chicago).** This continues owner-approved **Option A**: `public.character_sheets` is authoritative per character; preserve every existing `public.players.sheet`, empty or populated, without automatic writes even when it belongs to the active character. Separate consumer/source audits and owner production release approval remain mandatory. This branch stacks on signed I2-E #369, I2-D #368, I2-C #367, I2-B #366 and approved planning #365; no inherited original-source RED or historical GREEN tests are rewritten.

> **2026-11-11 America/Chicago / 2026-11-12 UTC — ORIGINAL SOURCE RED AND OPTION A SCRATCH GREEN VERIFIED.** [Dedicated local PG17/GoTrue/PostgREST Actions #43150417164](https://github.com/bob8675309/DNDNEXT/actions/runs/43150417164), job `130957990966`, **SUCCESS**, code/test commit `b5a8fc220c035347f63f30715f567146f3a82155`. The entire unchanged historical I1-B–O signed Forge/Story/nonce suite, I2C-01–10, I2D-01–11 and I2E-01–11 ran first. **I2F-01–11 ALL PASS**. Original I2F-03/04 source REDs confirm the two private helpers can update canonical target sheets and overwrite **two unrelated editor legacy accounts**, when executed through privileged local SQL on genuine signed-created characters. Only after both REDs, the source-exact original-MD5-reversible candidate removes their two old account UPDATEs. The GREEN cases verify same-character and different-character snapshot freeze, existing sourceChoices idempotence, species runtime projection add/remove, original missing-character/error/no-op behavior, denied authenticated direct helper execution and legacy-sheet updates, unchanged original Story/nonce and profile-name edit compatibility. **Private helper calls are privileged local SQL, NOT signed helper RPCs or actual full species/class-feature trigger acceptance.** Only **9/34 original UPDATE functions** are bounded Option A researched; **25 remain untested**. The documentation-inclusive final PR head still requires a fresh exact-head CI check.

> **Retained failed research receipt:** [first run #43149979952](https://github.com/bob8675309/DNDNEXT/actions/runs/43149979952) passed all old suites, I2F-01–05 (including BOTH original source REDs and the scratch source/MD5 proof), then failed on a **new test comparison mistake**: the canonical B sheet was compared to its pre-removal JSON after `sourceChoices` was deliberately removed and then restored to the same `{}` value. Fixed only the I2F test to compare the restored sheet against the snapshot taken **immediately after removal**, while additionally asserting B initially had a valid object. That preserves the genuine missing-to-valid transition and does not weaken any source hash, account preservation, permissions, or original RED assertion. No original SQL, prior tests or production data modified.

## Narrow source-original audit

Read-only live PG17 introspection verified these exact original private functions:

| Source-original function | MD5 of `pg_get_functiondef` | Intended canonical behavior |
|---|---|---|
| `private.ensure_character_source_choices_v1(uuid)` | `69bedf66148d2ce3dab97baa5de606cc` | On a character missing an object at `sheet.sourceChoices`, initialize it to `{}`. Do nothing when already an object; error when the character sheet does not exist |
| `private.set_species_runtime_projection_v1(uuid,text,jsonb)` | `7f6e7d7d99ff79db1372462b4320c21b` | Add, replace, or remove one key in `sheet.runtimeProficiencies`, creating the parent object if necessary; return when no canonical sheet exists |

Both are `SECURITY DEFINER`, and the original account mirroring statement follows their canonical update. Neither subsequently branches on `FOUND` or uses `ROW_COUNT` from the legacy account UPDATE. **Importantly, neither function is directly executable by the authenticated database role in the observed live privileges** (source/role metadata inspection confirmed `has_function_privilege=false`). They are internal helper functions, not public RPCs.

We do **not** widen authenticated SQL privileges to test them. Real characters and private Stories are created through **signed local GoTrue + PostgREST modern v3 Forge**; only the private helper invocations are made through controlled **local privileged PostgreSQL SQL** inside the disposable test stack. These private helper calls are **not signed user RPCs**, so this cannot certify live species/level-up trigger invocation or client authorization. The test also uses privileged local SQL to remove `sourceChoices` from a signed-created character and to seed synthetic archived legacy rows. Both are deliberately labeled test specimens, not authentic species character-creation outcomes.

### Exact source and scratch candidate

`scripts/fixtures/i2f_original_source_species_projection_shared_forge_pg17.sql` contains both complete original live-source bodies and verifies their MD5 hashes **after all inherited original Forge, I2C, I2D, I2E suites have passed**. It also explicitly revokes direct authenticated/anonymous/private helper `EXECUTE` in the disposable stack and checks that these privileges remain denied.

`scripts/fixtures/i2f_option_a_source_species_projection_scratch_pg17.sql` is applied **only after both original overwrite RED witnesses**. It source-verifies that the original legacy UPDATE appears exactly once in each function, replaces that statement with a `NULL;` no-op and requires restoring only that statement to recover the **exact original function MD5**. Original canonical JSON projection code, error/no-op behavior, prior v3 Forge/Story/nonce sources and player profile ACLs remain unchanged.

### Acceptance cases (pending signed CI)

| Test | Evidence required |
|---|---|
| I2F-01 | Both exact live original helper MD5s installed after earlier signed suites; direct authenticated EXECUTE still denied |
| I2F-02 | Genuine signed modern v3 Fighter A/B/D, Story/nonce/equipment, editable B shared across owner and editor, synthetic missing-`sourceChoices` B and historical unmarked account |
| I2F-03 — original SOURCE RED | Privileged-local original `ensure_character_source_choices_v1(B)` initializes canonical B but clobbers both unrelated owner/editor populated historical account sheets |
| I2F-04 — original SOURCE RED | Privileged-local original species runtime helper updates B's canonical runtime JSON but clobbers both unrelated editable account sheets |
| I2F-05 | After REDs, install exact source-reversible two-writer scratch no-mirror candidate, preserving denied direct EXECUTE |
| I2F-06 | Same-character owner and editor projection initializations change only target canonicals; legacy snapshots and account `updated_at` remain identical |
| I2F-07 | Already-valid `sourceChoices` object is idempotent: no unnecessary canonical timestamp change and no legacy write |
| I2F-08 | Two species runtime-projection add/replace operations change only intended canonical state, leaving matching and unrelated historical sheets intact |
| I2F-09 | Removing species runtime state via SQL NULL removes only the selected projection; absent character is a no-op; no legacy writes |
| I2F-10 | Missing character sheet still raises expected error; signed direct legacy write denied; private helper execution remains restricted; historical row and private Story remain unchanged |
| I2F-11 | Signed profile-name editing succeeds without sheet replacement; original modern v3, private v2 copied creator and Story/nonce source fingerprints remain unchanged |

The runtime projection keys and values in this test are **synthetic JSON**, not a source-authentic High Elf, Khoravar, Goliath or other species-specific materialization. This research validates the **helper's canonical projection algorithm**, not species eligibility, source catalogs, subclass feature acquisition, level-up selection, or full Forge trigger parity.

### Release truth and next work

The [I2-F exact source writer ledger](I2_F_ACCOUNT_WRITER_COVERAGE_2026-11-11.json) includes **9 of 34 original `UPDATE public.players` functions** with bounded Option A research after these two helpers, leaving **25 original UPDATE writers untested**. Historical I1-M/O/P conditional same-character mirror tests remain preserved; their former GREEN does **not** define final Option A acceptance. The extra modern private copied v2 creation UPSERT is tracked separately from this 34-function UPDATE census, and dynamic/indirect writers may remain undiscovered.

No full original 31-trigger Forge graph, authentic signed species/class materializer, complete production Admin/RLS/service roles, real browser/profile switching, full writer concurrency/rollback, independent encrypted backup and DB+Storage restore have been certified. **No production SQL/data/Auth/RLS/ACL, application runtime, world/town/tactical maps, PR merge, deployment or paid agent changes were made.**

**Acceptance status:** signed-created + privileged-local private projection I2F-01–11 source RED / scratch GREEN **PASSED** in Actions #43150417164; final documentation-inclusive CI remains pending. Next bounded action after recording results: audit a small class-feature-specific/level-up family with authentic signed gameplay entrypoints where possible, preserving the same original RED → source-exact scratch GREEN discipline. Production remains blocked until separate owner approval.
