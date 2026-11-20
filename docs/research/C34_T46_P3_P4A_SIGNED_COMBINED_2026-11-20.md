# C34 T46-P3-P4A — Combined signed real NPC manager, held #345 Profile, Print, Intel and merchant return

**2026-11-20 America/Chicago. Signed disposable integration ACCEPTED for the enumerated P4A test cases. Production HOLD.**

[Draft PR #379](https://github.com/bob8675309/DNDNEXT/pull/379) on `research/c34-clean-main-privacy-forge-joint-source-20261112`. Executable P4A commit **`1e8968d597d210f16882b74b1fd77b082fd13c46`**, [GitHub Actions run #44796089920](https://github.com/bob8675309/DNDNEXT/actions/runs/44796089920), job `136495875700`, **SUCCESS**. This result is specific to the exact executable commit, not automatically to later documentation-only commits. `main` remains `bb3939eeb9a38cf416996a1dca3b196b156b2915` at the post-run check.

## What ran (no application source committed)

The P4A signed runner mounts the **actual current `pages/npcs.js`** in a temporary Next Pages Router route. In a disposable Next/Chromium and **PostgreSQL 17 + GoTrue/PostgREST** environment, it installs the original held #345 **Stage 1→2→3 SQL bytes** and the separately validated T46 player-scoped discovery and manager roster/authority/GM-alias functions. It temporarily composes:

- P3-P3B's exact-original current-manager overlay: signed server-assembled NPC/merchant roster, on-demand per-selected-character Sheet with signed authorization before and after the fetch, no all-Sheet preload, server-derived `admin/gm/dm` identity and focus/12-second actor/grant scrub.
- Byte-exact held #345 `NpcPanel.js` and `CreatorBackstoryPanel.js` as source-preserved input to an opt-in research compositor. The Profile keeps the original GM Dossier vs player public projection and Profile-first selection. On the **Profile** view only, the unmounted-original `DiscoveredProgressionIntel.jsx` is displayed using its existing per-user server projection and the separately GM-published Stage3 clue (not source GM Secret).
- The **same** double server/actor revalidation PDF-onClick candidate in **both** real `CharacterSheetPanel` consumers: manager Sheet and held #345 Profile Sheet. Authorization occurs before creating a printable model and again before exposing PDF Blob bytes. The research candidate handles expected denials as normal UI without producing a new PDF.
- The current manager's previous private-Sheet-error-only state gains a public **Open public Profile** route without granting `can_edit`; the merchant's manager shortcut is **Profile-first**. Original `MerchantPanel` accepts an `onBackToProfile` callback but did not display it; the **CI-only** candidate exposes the existing callback as **Return to Profile** without removing stock/action code.

The runner verifies exact original Git blobs **before** transformations and restores all modified temporary checkout files in `finally`: `pages/npcs.js`, `components/NpcPanel.js`, `components/CharacterSheetPanel.js`, `components/MerchantPanel.js`; removes the temporary `components/CreatorBackstoryPanel.js` and test Next route. The original `MapPageClient.js` never changes.

## Original and signed positive/negative evidence

| Gate | Actual signed P4A outcome |
|---|---|
| GM real manager PDF | **PASS**: clicks actual Sheet Print, captures original pdf-lib Blob and Chromium popup, validates `%PDF-`, exactly 3 pages, correct signed character title |
| GM held #345 Profile PDF | **PASS**: opens actual NPC Profile from manager, clicks original Profile's `Sheet & Rolls`, captures and validates another independent 3-page PDF with current actor |
| GM role demotion, same JWT | **PASS**: NEW PDF denied even with stale Sheet still mounted; focus-triggered manager check clears GM secrets/hidden roster/private Sheet/Print without page reload or remount |
| Narrow editor grant and revocation | **PASS**: authorized editor can print original PDF; same-JWT `can_edit=false` rejects NEW PDF; focus removes cached Sheet and Print. `can_edit` never promotes user to GM dossier |
| Public class-only disclosure | **PASS**: outsider opens actual player-safe Profile via denial fallback; sees only GM-adjudicated **Fighter** class and independent GM-published safe clue, not level, XP, private Sheet, private Story or level event |
| Merchant navigation | **PASS**: actual merchant roster → held NPC Profile → Talk's **Let me browse your wares** → real merchant Shop → **Return to Profile**, with no prior NPC GM secret retained. **No stock purchase or inventory transfer verified.** |
| Signed viewer switch | **PASS**: another player receives `t46-undiscovered` for unrevealed class but the same public clue, without inheriting the first viewer's discovered Fighter class |
| Invariants | **PASS**: canonical Sheet + progression fingerprints unchanged, no protected map trigger introduced, no unexpected runtime page errors or unapproved off-loopback browser requests, exact original source restored in CI |

The prior original RED for unauthorized raw Sheets and same-JWT export (#44673071627, #44673900655) and separately signed P3-P2 Print and P3-P3 server/manager studies remain preserved. They are **not** superseded or deleted.

## Failed original P4A attempts — retain, do not silently claim green

The following runs failed at distinct **test control/fixture** boundaries; source-original privacy checks were not weakened: [#44793160678](https://github.com/bob8675309/DNDNEXT/actions/runs/44793160678) (unscoped Profile heading selector), [#44793835321](https://github.com/bob8675309/DNDNEXT/actions/runs/44793835321) (actual NPC vs persistent hidden Forge shell shared class), [#44794291945](https://github.com/bob8675309/DNDNEXT/actions/runs/44794291945) (Profile Print readiness mistakenly inferred from manager Print), [#44794855452](https://github.com/bob8675309/DNDNEXT/actions/runs/44794855452) (merchant return/intel assertion), [#44795388765](https://github.com/bob8675309/DNDNEXT/actions/runs/44795388765) (merchant Profile reappearance assertion). Later test-only changes scoped the actual NPC modal, awaited the exact Profile Print control, removed disposable Next development portal interference, and checked merchant Profile reentry by its native content. Only **#44796089920 on `1e8968d597d210f16882b74b1fd77b082fd13c46`** is the full P4A **SUCCESS**.

## Exact original source custody

| Original path | Git blob (unchanged on current research branch) |
|---|---|
| `pages/npcs.js` | `7fc00b9b3ace6233d1648a3d017f8a05e072d722` |
| `components/NpcPanel.js` | `e4cde1ae8bf8d9bb7b03fdf855cdb0ef9e6cb1db` |
| `components/CharacterSheetPanel.js` | `cb3511bf25a97be3a07c6e5d93ee62bb16570327` |
| `components/MerchantPanel.js` | `22e4d0810603bc0322904573cb5fe0c14bad1f88` |
| Protected `components/MapPageClient.js` | `61f8738da2ca3d8635b5a413bfdc18c094228a0a` |
| Held original #345 `NpcPanel.js` (test-only fixture) | `606db96649dcdf6646afbd4d24f67a6fc54426eb` |
| Held original #345 `CreatorBackstoryPanel.js` (test-only fixture) | `23b0e86aab7a80b7243365ba107c1d37a5ec5812` |

P4A research paths only: `scripts/integration/c34/candidates/t46_p3_p4a_composed_overlays.mjs`, `scripts/integration/c34/test_t46_p3_p4a_real_manager_profile_print_intel_signed.mjs`, `.github/workflows/validate-c34-t46-p3-p4a_combined-npc-profile-print-browser.yml`, and this document / branch handoff. No live client import or game-route feature flag changed.

## Still NOT approved or demonstrated

- The **real town** `pages/town/[id].js` remains on its existing default-off T28/T33 research flags; the active town merchant/profile panel and shopper identity/ACL require signed source-exact browser parity. No protected `MapPageClient.js` or either protected world-map Forge trigger may be changed without separate owner discussion.
- P4A tested a **bounded NPC/merchant fixture**, not full original manager feature equivalence: creation/delete, GM narrative and personal creator Story editing, hidden inventory, merchant stock/buy/return, notes, equipment, portraits, sprites, locations, route controls, sheet mutations, all class/features/spells/account tabs, multi-controller and all race/permission permutations remain separate gates.
- Existing official PDF downloads cannot be revoked. The manager checks grant on focus and at 12-second intervals, **not instant server-push**; an open private DOM can remain visible before it revalidates. The fresh Print action prevents NEW export during that window in tested cases. Other print/export pathways must be audited.
- The current public T46 GM adjudication RPC accepts `dialogue` and `ability_check` metadata from a signed GM only; it **does not prove** an actual rolled check or trusted game event, and no automatic dialogue publisher has been activated.
- Supabase source-schema/ACL/role dependency drift against hosted PG17 has not been accepted. The candidate uses existing scratch source constructs, including `auth.role()`, which require current API/security review before any production migration.
- **Hard HOLD:** original `players.sheet` writer ledger **22/34 unresolved**, **29/31** nonmap Forge trigger coverage plus **two separately protected world-map triggers**, independent encrypted PG17 restore and **all 340 Storage object bytes** verified, full original PR/consumer parity/rollback, and explicit owner GO/NO-GO. No hosted SQL/RLS/Storage change, production deployment, main merge, original PR closure, paid agent activation or paused automation restart.

## ONE NEXT T46-P3-P4B

Signed disposable **town/merchant/creator and source-complete consumer parity**, preserving unchanged original T28/T33 defaults. Compare current `pages/town/[id].js` actual NPC/shop entrypoints and held original #345 Profile/Creator source, scoped nonmap-only permissions and role revocation (including `admin/gm/dm`), source-qualified GM Story and curated clue, merchant stock/buy/back, inventory-only and delegated control restrictions, and trusted GM adjudicated roll/dialogue origin. Test full original NPC editor/Sheet/saving, class/features/spells and browser/Print negatives; then propose atomic reviewed migration+rollback **only after all release gates**, never silently cut over production.
