# Source-only PR disposition: #347 exact-main copies and #349 original Forge ledger

**2026-11-15, pending review/CI of bounded integration.** This is a source-preservation and closure dossier, NOT an assertion that held Spell Engine, Forge, NPC, P1.3 or Stage1–3 SQL was released. Current main before this attempt: `4a09b0d85e9309c428533b2d46d61d9bc889d6a7`.

## Original [#347](https://github.com/bob8675309/DNDNEXT/pull/347) — source-only P1 recipe validator

Original **draft HEAD** `18e889ffc668ee9af45d04b6faf24d93f2d9f8ae` has exactly **eight** immediate changed paths. Reopened all file blobs from #347 and from main at this checkpoint. **Six of eight are already byte-for-byte identical on main**:

| Original path | Original #347 Git blob SHA | Main SHA | Disposition |
|---|---|---|---|
| `.github/workflows/validate-spell-recipe-p1-extraction.yml` | `ebfffc41036229c39a8fb81c1bed73e57de5a561` | Same | `exact_copy` |
| `utils/spellRecipes/validateSpellRecipe.mjs` | `7946af0e8aafca8ea15f5a0c08c8ae715b91ea39` | Same | `exact_copy` |
| `utils/spellRecipes/preflightSpellRecipe.mjs` | `67293267ea85196642e81b0e0e7bba2760620c0c` | Same | `exact_copy` |
| `scripts/fixtures/spell_recipe_p1_examples.mjs` | `7f17794e64ed4e7fad868dbfdc6f22598d93cf2c` | Same | `exact_copy` |
| `scripts/validate_spell_recipe_schema_p1.mjs` | `9f9a906e77cb87497e81a894c1a62f523b6966` | Same | `exact_copy` |
| `scripts/validate_spell_recipe_preflight_p1.mjs` | `096b5a9b8f21209fa5f5dc24b81290f5f2f3435f` | Same | `exact_copy` |
| `docs/ACTIVE_WORK.md` | `74f18b8dae541b8853d35818f4f6887f6101c0d7` | Newer main handoff | `superseded_with_source_test`: preserve historical original at linked immutable #347 SHA; never overwrite live task |
| `docs/HANDOFF_LOG.md` | `e8ca989f910097a05c14d6f00efcdeb0cc535a83` | Newer append-only main log | `superseded_with_source_test`: original C4 source-extraction receipt and original historic log retained at linked immutable #347 SHA; see below |

The original #347 final handoff records a November 9, 2026 **C4 Spell Recipe P1 clean-main source-only extraction** from source #309 `a24006624380570bd693a768e97a0c689f1d42b5`, five pinned pure parser/fixture files and one free Node22 workflow; 12 **synthetic** recipe-shaped fixtures, not official D&D 2024 mechanical acceptance. The shipped parser's manifest is explicitly `executable:false`, `approved:false` and `requiresServerAuthorization:true`. It **does not** include original #309 Eldritch Blast LOS/targeting, #312 P2 Fire Bolt/other seven-spell parity, NPC delegation, executable Spell Engine, RPCs, database DDL, or 19 live XPHB adapter change. Source history on main independently attributes `utils/spellRecipes/validateSpellRecipe.mjs` copy to commit `5591d4ec2f10261fb76aa88a43ce7c3ee873e5fe` and schema validator to `1e3e7527019e9177983d574edc753df6e46f6ae9` (both November 12). Do not merge #347's old handoff snapshots and overwrite present-day `ACTIVE_WORK` and `HANDOFF_LOG`.

**Disposition for owner-directed backlog retirement:** six source-path exact copies and two historical authoring snapshots accounted for. Original #347 is a suitable candidate for **close as source-integrated/superseded**, **not** mark as a fresh GitHub merged PR, provided the current blob comparison and passing original main-workflow tests remain true at closure. Keep the immutable PR and branch/commit provenance; do **not** delete branch or erase historical source. #309/#312 remain open/unreleased.

## Original [#349](https://github.com/bob8675309/DNDNEXT/pull/349) — offline original 31-trigger evidence ledger

Original **draft HEAD** `c9a60f9d1a10d1e2459df18f0afe217f35d84a5a` has exactly **nine** immediate changed paths. Prior to this integration the following **seven source/doc paths were absent from main**, and are proposed as an **exact original Git-blob copy**, with no ported game logic:

| Path | Original #349 Git blob SHA | Disposition |
|---|---|---|
| `.github/workflows/forge-trigger-acceptance-audit.yml` | `e752a5cc2626346726db3a86c56ffda0c9ae8ddd` | `exact_copy` after merged current-main integration and CI |
| `scripts/agents/forge_automation_selftest.mjs` | `6d4dc315449958a3862130de739ed691773b00cf` | `exact_copy` |
| `scripts/agents/forge_trigger_acceptance_ledger.mjs` | `3a12039f69d25eb968b37eda39c09839a13cb8ae` | `exact_copy` |
| `scripts/agents/forge_trigger_acceptance_receipts.json` | `ddcd17bc15aaf4f75e8c0aa07c7faed69f86fe5e` | `exact_copy` |
| `scripts/agents/forge_trigger_audit.mjs` | `d5fbf344c5e92f8dc3e620806baded0fbb31f7ae` | `exact_copy` |
| `docs/I1_A_FORGE_TRIGGER_LEDGER_SOURCE_EXTRACTION.md` | `a510c47de4162956eddbaf34c3644502c88d8219` | `exact_copy` |
| `docs/Forge_Original_Creation_Trigger_Coverage_2026-11-05.md` | `5d3a32c5b6661e47b36794bfe7723296c4b0631b` | `exact_copy` |
| `docs/ACTIVE_WORK.md` | `2baace6aba38b09b9712844492f70b8c74f79cc6` | `superseded_with_source_test`: retained old draft checkpoint, preserve live main status |
| `docs/HANDOFF_LOG.md` | `fbfb5ada81764284d638f2a57764cffcc6655797` | `superseded_with_source_test`: retain original immutable source and append this reviewed integration receipt |

**Source graph:** new `forge_automation_selftest.mjs` only imports new offline `forge_trigger_audit.mjs`, new `forge_trigger_acceptance_ledger.mjs` and **existing main** `forge_ci_diagnostics.mjs` (`55cf7ab71d16aecada03c231bc4fe7491e7cd78a`). The workflow uses pinned `actions/checkout` and Node 22, `contents: read` only, offline ledger/selftest and uploads a short three-day report. No agent/model tool, SQL execution, network calls, Supabase credentials, migration, RPC, server data mutation, or paid API. Writes reports only to a CI artifact folder. Exact original census has **31** creation-adjacent triggers: 19 progression, 4 sheets, 6 characters, 2 inventory. The receipts JSON names only **three** original signed-JWT targeted proof suites (tags J125–J132, portraits J133–J141, subclass J142–J153) with immutable original test commit/run IDs. A fixture CREATE TRIGGER **is not an authenticated executable receipt**. Historical 31/fixture totals depend on the checked-in fixture set; current C34 29/31 co-resident evidence across research fixtures is **not** full production restore parity or a change to the two owner-protected world-map triggers.

The seven source paths are still absent from current main before this candidate merge and must NOT be claimed to be merged until a reviewed exact-head source PR's workflow (including negative fingerprints and read-only assertion) **passes**, the PR is merged, and the new main SHA and auto Vercel docs/test-only deployment are verified. Original #349 may then be **closed as integrated by a scoped successor**, not misrepresented as directly merged into main; retain its original head and every historical comment.

## Risk, exclusion and follow-up boundaries

- Source-only means **no new gameplay engine integration**. No `MapPageClient` changes, town map, NPC privacy/Profile SQL, hosted Supabase RLS/grants/data or Storage changes, merchant purchase/wallet runtime, 2024 spell adapter/executable code, new admin notice path, paid research agent, or PR deletion.
- **Do not close** #309/#312, #317/#318, #320–#325, #345, #350–#371, or C34 #379 merely because their test/metadata is copied. Their distinct source/feature and signed release work remains. #325 paid AI must stay off.
- Required source acceptance: diff of **all original immediate paths and inherited source** vs current main, preserve original #347 and #349 branch logs at exact commits, exact-blobs seven copied #349, current main's original six #347 copies, static offline selftest and checkout-level source trigger ledger, full PR preservation audit, handoff registry and tactical/Class independent checks. Recheck main HEAD before merge or closure. If original ledger fails due to fixture evolution, preserve its RED, diagnose, and adjust a **new** bounded successor with explicit tests, not historical fingerprints or SQL grants.
- Current **domain priority continues C34 T28**, actual signed non-map manager/town/inventory Profile/shop/wallet actor/request-generation preflight on held #379, with world-map protected and production release HOLD. 22/34 account-level sheet writers, original Forge 29/31 nonmap DDL (two map triggers protected), independent encrypted DB+340 Storage restore and complete mounted-role/browser/source/rollback tests are still blockers.
- Closing a PR only retires an already integrated **source-only slice**, not the parent feature PRs. The full historical GitHub PR conversation remains accessible.

**Actual closure/merge statuses must be verified against live GitHub**, not assumed from this proposed review dossier.
