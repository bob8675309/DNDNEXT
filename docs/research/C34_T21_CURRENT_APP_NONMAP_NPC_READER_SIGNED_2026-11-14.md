# C34 T21 — Current-app unmounted non-map NPC Profile source-authorized reader

**2026-11-14. Research-only, RELEASE HOLD.** [Draft PR #379](https://github.com/bob8675309/DNDNEXT/pull/379). Successfully tested exact executable commit **`60b1b43b44e7f79fc35c5c450565569099ffe61f`**. Seven out of seven GitHub workflows **SUCCESS**, including [genuine PG17/GoTrue/PostgREST signed test #43633395331](https://github.com/bob8675309/DNDNEXT/actions/runs/43633395331), original T1–T20, historical held [#345](https://github.com/bob8675309/DNDNEXT/pull/345) real Chromium Next town/inventory + synthetic PDF QA, source-negative and PR full-inheritance audits. **No production, map, active app, live DB/Storage, merge or PR closure changes.**

## Why the shared component is NOT swapped wholesale

Full exact-head source was reopened and compared from original held #345 `4f5f8ff7587aff1a68f21581ad68a4752789f54a` against this T20-derived #379:

- Current `components/NpcPanel.js` raw `public.characters` SELECT contains `background,motivation,quirk,mannerism,voice`; its `loadCharacterSecrets` async fallback can populate `secret` in React state. Held #345 instead calls **`get_npc_profile_visible_v1`** or signed **`get_npc_dossier_admin_v1`**, never raw fallback. Current Profile reads canonical Sheet before editor permission check; held #345 enforces editor-only RLS and separately mounts `CreatorBackstoryPanel`.
- Current `pages/npcs.js` roster SELECT bulk-loads those private narrative columns and `loadCharacterSecrets` for **every** NPC. Held #345 keeps a public/basic roster and reads GM dossier for **the selected character only**. Held #345 uses **`get_character_editor_narrative_v1`** for non-GM current `can_edit`. An NPC page-specific migration is **separate** from a new non-map safe-reader module.
- The shared `NpcPanel.js` and `CharacterInteractionPanel` are also consumed by protected map/town/merchant systems. Replacing this file wholesale or globally importing `npc-profile-centered.css` before explicit map review would violate the owner’s isolation rules and risk regressions in world-map sprites, in-town rosters and Profile-first merchant behavior.
- Held #345's global Profile overlay, UUID event helper, creator-backstory panel and centered CSS are four **byte-identical inactive** archived originals under `scripts/integration/c34/preserved/held345/`; their browser original scripts are separately pinned. T20 proved held app behavior with those original source bytes, **not** the current #379 app UI.
- Held original #345 stage1 allowlisted NPC Profile/canonical Sheet editor RLS, stage2 GM dossier/editor narrative and authenticated private-column ACL, stage3 immutable creator-private backstory/GM-only secret guard already coexist in the **disposable signed** C34 fixture; no new SQL was run against production or original source rewritten.

## Actual T21 change: one new reader + tests, NOT a UI cutover

Added **`utils/c34/readNonMapNpcProfileCandidate.mjs`** as a deliberately **NON-ORIGINAL, UNMOUNTED current-app candidate**. It is not imported from `pages/_app.js`, `pages/npcs.js`, `pages/inventory.js`, `pages/town/[id].js`, `components/NpcPanel.js`, or `components/MapPageClient.js`. No current application, world-map, town, merchant, print or portrait source was edited.

The pure ESM candidate:
- Validates a UUID and verifies a real signed-in user with `auth.getUser()`; handles anonymous/malformed/unavailable and clears the entire result after a user-account switch detected by a final identity check. React consumers must **also** invalidate in-flight work and clear privileged UI synchronously on SIGNED_OUT, as the original #345 does.
- Calls the **original** `get_npc_profile_visible_v1` for player-safe projection; allowlists only source-approved fields and published lore, forcibly strips legacy `secret` and `lore.secret` even when a stale `profileReveal.secret` flag is present. On missing/denied RPC, fails closed — **no raw `characters` or legacy secret fallback**.
- When explicitly requested, verifies the signed account identity through `is_admin` and calls original protected `get_npc_dossier_admin_v1` for GM-only dossier in a **separate** result slot. Client-supplied `isAdmin` is never trusted.
- Uses original `get_character_editor_narrative_v1` current-`can_edit` authority **and** an independent canonical `character_sheets.sheet` RLS read for editor Sheet/Print. Inventory-only/convert-only is not enough.
- Uses original `can_edit_creator_backstory_v1` **and** RLS-protected `character_backstory_secrets.secret_text` read for creator/GM personal Story; unauthorized row remains `null`. GM Secret and personal Story cannot be confused.
- Uses only explicit named data columns, no `select('*')`, no service-role credentials, no browser-origin code or active page mounts.

Added four source tests to `scripts/integration/c34/test_source_contract.mjs`:
- **C34-T21-S01:** malicious legacy GM/secret fields never enter public projection; outsider can neither Sheet nor Story nor dossier.
- **S02:** independently verified GM, editor and creator rights use only the intended named RPC, Sheet and personal Story table.
- **N01:** signed-out actor, malformed ID, missing Profile and changed session are fail-closed without cached private data.
- **N02:** candidate cannot directly read `characters`/legacy secrets and **no protected map or active application importer exists**.

Added four **genuine signed GoTrue/PostgREST** tests at the END of unchanged T1–T19 integration:
- **GREEN01:** outsider reads only public NPC; private canonical Sheet, Story and historical GM secret remain absent.
- **GREEN02:** genuine editor gets canonical Sheet/Print but no original creator-private Story or GM dossier.
- **GREEN03:** inventory-only, convert-only and revoked original creator are denied private/Sheet escalation.
- **GREEN04:** authenticated GM obtains guarded NPC dossier and personal Story separately, never leaks GM secret in public projection; anonymous denied.

The signed logs in [run #43633395331](https://github.com/bob8675309/DNDNEXT/actions/runs/43633395331) explicitly show four GREEN checkpoints. All inherited T1–T20 checks and original held #345 true Next town/merchant/Inventory/Print/Chromium and synthetic 3-page PDF remained green in the same disposable CI. All seven exact-head workflows succeeded. **29/31 source-original non-map DDL** remain, two protected world-map triggers deliberately unstaged.

## Release, integration and rollback boundaries

This is **source/permission foundation only**. No current #379 real Next.js UI was mounted or tested with the new reader. Current `NpcPanel.js`, NPC manager roster/secret reads, inventory/town interactions, original secret editing APIs, creator Forge serialization and PDF access paths still require a **coordinated, feature-by-feature** source/security cutover and real-current-app role/browser acceptance. Do not drop prior original functions or reinstate historical `players.sheet` mirrors; Option A writer census 22/34 incomplete. Full XPHB source catalog, distinct 44 open+80 closed-unmerged historical PR dispositions, owner-protected map original triggers, actual current app/role matrix, independent encrypted PG17 plus all 340 Storage object byte restore, migration rehearsal, Vercel pairing and owner release approval remain HOLD. The runtime has **no import** of this reader, so no user-visible behavior has changed.

**ONE NEXT BOUNDED TASK:** stage a separate **non-map, explicitly unmounted current-app Profile/creator UI shell** consuming `readNonMapNpcProfileCandidate`, with actual signed browser testing against T21 PG17 on current #379's Next source (not historical checkout). Preserve creator Story separate, coeditor Sheet/Print and GM dossier privileges; implement full synchronous SIGNED_OUT/account-switch wipe, async request invalidation and Profile→Shop→Profile. Use Bootstrap/SCSS only. Do not import held global centered map CSS, mount shell in `_app`/map, edit `MapPageClient.js`, or modify main/production until independently verified and owner authorizes that specific active consumer cutover.
