# C34 T44 — Actual Next.js Level Up choice component signed original public v5 browser (ACCEPTED research, release HOLD)

**When:** 2026-11-18 CST / 2026-11-19 UTC.  
**Branch/PR:** [draft #379](https://github.com/bob8675309/DNDNEXT/pull/379), `research/c34-clean-main-privacy-forge-joint-source-20261112`.  
**Accepted executable SHA:** `88e8c988287843fc63f3c5a386f928978f199ebd`.  
**Full local signed PostgreSQL17/GoTrue/PostgREST/Next16/Chromium:** [Actions #44464347573](https://github.com/bob8675309/DNDNEXT/actions/runs/44464347573), [job #135358402508](https://github.com/bob8675309/DNDNEXT/actions/runs/44464347573/job/135358402508), **SUCCESS**.  
**Release approval:** NOT REQUESTED, NOT GRANTED. **No application source or production SQL changed.**

## 1. Why this is distinct from T41–T43

T41 and T42 proved distinct Rest and private additional-class-choice linked-account projection defects with genuine signed RPC and smaller test fixtures. T43 then exercised **actual original signed public `complete_character_level_up_v5`** for Sorcerer and Warlock in disposable PG17, with source fingerprints and three private legacy writer RED → local Option A GREEN. T43 did **not** click the actual Next UI.

T44 pins the actual current source components:
- `components/CharacterLevelUpChoices.js` Git blob `3fa76acd1811a77b0c3e93711906bfb5afb17584`;
- `components/SourceChoiceFields.js` Git blob `31128be6bdded46542aea1b62f7ea3c78b6839a7`;
- `components/CharacterInvocationRecovery.js` blob `c58774853c6140981592fa84b9040c0fcb4a8c58`;
- `components/CharacterClassPanel.js` blob `d39d2bceab944d3d4ec42cc2cfda92609ce51a2b` (inspected as real parent, **not mounted**);
- `utils/supabaseClient.js` blob `13b3339c4c99702bc667f1a1bc9b2ea36a70b18b`.

The test uses `next dev --webpack` on the repository's current Next 16 app. It creates `pages/__c34_t44_level_up_probe.jsx` **at runtime only**, checks no existing route is overwritten, dynamically imports the real production `CharacterLevelUpChoices` unchanged, and deletes the generated page in a `finally` block. A real local Chromium page obtains the same `utils/supabaseClient.js` instance used by the component and authenticates genuine users through loopback GoTrue using real JWTs. Off-loopback requests are blocked, including any hosted Supabase URL.

**Critical distinction:** This is real component-browser interaction, **not full application navigation or the true parent review lifecycle**. The local-only page injects a synthetic `review` prop that faithfully supplies `metadataReady`, `canComplete`, `preview` level, and the actual locally seeded session ID. It does not call `public.get_character_level_up_review_v1`, `begin_character_level_up_v1`, `cancel_character_level_up_v1`, or mount the original `CharacterClassPanel`. This limitation is enforced by a test assertion; nobody should infer that original review authorization or session creation is browser-accepted.

## 2. Source-original signed backend custody and scratch-only SELECT surfaces

The workflow runs the unchanged `scripts/fixtures/p1_3_levelup_v5_local_auth_pg17.sql` and `scripts/test_p1_3_levelup_v5_real_jwt_local.mjs` (**F06–F28**, including original Level Up, lock/deadlock and merchant inventory), then the accepted `scripts/integration/c34/test_t43_earned_v5_signed_pg17.mjs`. Only once both pass does T44 run.

T44 checks unchanged `scripts/fixtures/p1_3_levelup_v5_original_source_pg17.sql` Git blob `b3168d0c9ec92ae1c0c389ccf55655209f2841f8` and `sql/20260808_18_metamagic_mystic_arcanum_progression.sql` blob `ce7d4ec3f37eeb0a29b8a07cd64609ee9627642f`. Original public v5, v4, v3 fingerprints remain `02d74b973a763c53c595be20e35e512f`, `f8338ef170c6e27b972e777eeae406b8`, `4467e166234c67fc12dd73da0e46b379`. Base source `e33639d549ef557976a3970ea51f5238` and spell summary `5b1b275a268a57591a2e35a05ce7480d` restored and source checked for the original RED; source-authored private permission helper `ac70e4ec033d86c4e0a254d50d429a45` remains. Original private class-choice mirror source preserved.

The UI performs five independent signed catalog/source queries. P1.3's reduced fixture lacks some table/view columns, so T44 adds **explicitly synthetic, disposable-only** SELECT surfaces (`spells_catalog_preferred`, `character_spells`, `character_sheets`, empty items and class feature catalogs) with signed user SELECT grants and RLS for character-owned spells. This enables actual current UI code to load without pretending to provide the hosted full class/spell/Warlock Pact Magic catalog. The source-owned Metamagic and Arcanum options themselves originate from the **original** `public.get_character_level_class_choice_options_v1` RPC; the current UI's missing v2 falls back to source-original v1. The synthetic Warlock sixth-level example is clearly labeled `T43 Synthetic XPHB Warlock Sixth`, NOT a real named campaign spell.

## 3. Signed Next/Chromium ORIGINAL RED and validation

Exact log markers in [job #135358402508](https://github.com/bob8675309/DNDNEXT/actions/runs/44464347573/job/135358402508):

- `PASS T44-ORIGINAL-SOURCE`: original component sources/fingerprints and all three private linked-account writers are intact; real public v5 is granted only to authenticated, not anonymous.
- `PASS T44-UI-CATALOG-STAGE`: synthetic local-only browser SELECT surfaces and signed RLS established without service-role credentials in browser.
- `PASS T44-SIGNED-FIXTURES`: genuine independently signed owner, editor, read-only-linked, and outsider accounts plus pre-opened local review sessions and separately marked historical account Sheets.
- `PASS T44-NEXT-READY`: real current Next16 app compiles the temporary test route importing unchanged Level Up component.
- `PASS T44-ORIGINAL-UI-SORCERER-RED`: the player clicks **Apply Level 2** with incomplete permanent options and receives the expected client validation message; **no RPC fires**. Clicking Quickened Spell and Subtle Spell via the real RichField selection UI then sends one actual `/rest/v1/rpc/complete_character_level_up_v5` with source-owned two keys and fixed HP; signed original v5 commits canonical Sorcerer 1→2 and single event/session, while three independent owner/editor/read-only `players.sheet` snapshots are overwritten. Unrelated canonical characters and tests are unaffected.

## 4. Distinct, expressly NON-ORIGINAL local Option A GREEN

After the authentic browser RED, T44 installs **only inside scratch PG17** three separate private-function copies whose single whole-account `UPDATE public.players` statement has been omitted: `private.apply_additional_level_class_choices_v1`, `private.complete_character_level_up_base_v3`, and `private.sync_player_forge_class_spell_summary_v1`. The original public v5/v4/v3 MD5s remain unchanged. This is **not** a proposed patch to apply directly to production; all original SQL history remains untouched.

- `PASS T44-OPTION-A-SOURCE`: only three historical account mirrors omitted in scratch; original public RPC source identity preserved.
- `PASS T44-OPTION-A-UI-SORCERER`: a different genuine signed browser owner repeats the real Metamagic selection flow; original public v5 commits HP/class/event/session and retains **all three** independently populated historical account snapshots.
- `PASS T44-OPTION-A-UI-WARLOCK`: browser uses actual SourceChoiceFields source-spell picker to choose the synthetic sixth-level XPHB Warlock Arcanum. Original signed v5 writes the canonical class choice and a properly typed `character_spells` row with `recharge='long-rest'`; historical account history remains intact.
- `PASS T44-UI-REVOKE`: an original valid Warlock option is chosen and then the signed owner's edit permission is revoked in local PG without changing the existing browser JWT. The original v5 request returns 42501/HTTP403, and no canonical/progression/event/session mutation occurs. Another currently authorized signed editor remounts the actual component, selects the Arcanum and commits real v5; historical account histories stay frozen.
- `PASS T44-UI-READONLY`: a linked read-only user is given synthetic review display props in the test-only route (a scenario the actual parent would ordinarily prevent); original class-choice getter denies the user and the form emits **zero** `complete_character_level_up_v5` writes. No unexpected browser page errors or outside Supabase traffic. The generated Next test route is deleted on exit.

## 5. Failed-run provenance preserved; no tests weakened

First attempted [workflow #44463360579](https://github.com/bob8675309/DNDNEXT/actions/runs/44463360579) passed P1.3, T43, source, Next compilation and actual UI loading, but the new test incorrectly asserted no alert **after deliberately causing** the expected client-side incomplete-choice validation. It was corrected to allow precisely that expected alert without allowing other errors.

Second attempted [workflow #44463818239](https://github.com/bob8675309/DNDNEXT/actions/runs/44463818239) passed the genuine browser original Sorcerer RED, scratch Option A Sorcerer GREEN, and synthetic Warlock GREEN, then failed on a **temporary test-page lifecycle**: the synthetic route reused the exact same React component key/review session when signing out the revoked owner and signing in a permitted editor. This retained the owner's earlier 42501 error in component state and was not representative of a real page remount. The generated test route now increments a local-only `mountNonce` on each actor/openCase; actual application component remains unchanged. Final [workflow #44464347573](https://github.com/bob8675309/DNDNEXT/actions/runs/44464347573) PASSes all inherited and new signed checks, and cleanup succeeds.

## 6. Release HOLD, preserved systems and ONE next task

Committed T44 files are **only** `scripts/integration/c34/test_t44_level_up_signed_next_browser.mjs`, `scripts/integration/c34/test_t44_level_up_browser_source.mjs`, and `.github/workflows/validate-c34-t44-real-level-up-browser.yml`. Source-original game app files, original SQL migrations, T1–T43 evidence, previous original PR contributions, 19 deployed XPHB tactical spell adapters, inventory/merchant, town map and protected world map remain untouched. No production Supabase SQL/data/read, production RLS or Storage modification, Vercel deploy, paid agent or PR merge performed.

**Still unproved:** original `CharacterClassPanel` **review/XP lifecycle** (`get_character_progression_v1`, `can_manage_character_progression_v1`, `begin_character_level_up_v1`, `get_character_level_up_review_v1`, `cancel_character_level_up_v1`), real source-qualified spell and Warlock Invocation/Pact Magic catalog, real player Forge/Story nonce, original UI navigation and all backend triggers, hosted RLS and independently restored backup. The global **22/34 legacy `players.sheet` writer compatibility release gate remains OPEN**. Independent encrypted PostgreSQL17 backup restore plus **all 340 Storage objects**, complete original PR feature preservation and explicit owner production go/no-go are still required.

**ONE NEXT T45 TASK:** audit, stage and source-pin the REAL `CharacterClassPanel` parent `get_character_progression_v1` reader and review open/get/cancel RPC graph in a separate signed Next/Chromium scratch fixture; no manual `review` prop injection. Verify editor, GM/DM/Admin equivalence where original source supports it, read-only and outsider denial, XP/session stale/replay/rollback, and preserve actual T44 choice-component/reduced catalog proof without modifying production routes. Do not claim full catalog parity without separate evidence.
