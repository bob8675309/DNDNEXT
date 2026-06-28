# Town Crafter / Character Panel Remaining Brief

Last updated from green baseline: `0bb23d1f9404c98388bc1ca993754aa8736cad38`.

## Current position

The repo is green with the wrapper path in place but not yet visible to users.

Completed and green:

- Real `/items` workflow is extracted during build into `components/CraftingWorkspace.js`.
- Discipline locking is applied to the extracted workflow.
- Shared profession resolution exists in `utils/craftProfession.js`.
- `NpcPanel` craft surface validation exists and is active.
- `CharacterInteractionPanel` wrapper exists and validates.
- Wrapper has:
  - craft capability detection
  - safe interaction view state
  - interaction tab model
  - inert tab renderer
  - inert craft shell renderer
  - inactive wrapper-owned panel shell branch
- Visible production UI is still unchanged.

## What remains

### 1. Adopt wrapper one caller at a time

Move callers from direct `NpcPanel` usage to `CharacterInteractionPanel` only where behavior can remain visually unchanged.

Likely order:

1. NPC page profile overlay.
2. Map page NPC profile panel.
3. Town/crafter panel caller.

Each adoption must be its own small commit and Vercel must pass before continuing.

### 2. Let the wrapper own visible tabs

After at least one caller is safely routed through the wrapper, allow the wrapper-hosted tab bar to replace the hardcoded panel tabs.

Rules:

- Shop appears only for merchant/storefront characters.
- Craft appears only for crafter-capable characters.
- Non-crafters must never enter Craft view.
- Existing Profile, Sheet, Inventory, and Shop behavior must remain unchanged.

### 3. Wire Craft shell before real workspace

Expose the Craft tab first with the inert wrapper-owned craft shell, not the real crafting workspace.

Purpose:

- Validate tab visibility and view switching safely.
- Confirm no profile, sheet, inventory, or shop regressions.
- Confirm crafters are detected by profession/capability, not by name.

### 4. Import `CraftingWorkspace` only after shell behavior passes

Once the Craft shell is green and verified:

- Import `CraftingWorkspace` into the wrapper.
- Render it only for `interactionView === "craft"` and `hasCraftCapability === true`.
- Pass `disciplineLock={craftProfession}`.
- Keep `/items` unlocked and unchanged.

### 5. Replace legacy town crafter modal

Only after the shared panel Craft tab is stable:

- Move town crafter clicks into the shared interaction panel with initial Craft view.
- Keep portraits and shop-style presentation.
- Remove legacy town crafter modal only after all behavior is covered.

### 6. Remove bridges one at a time

After town crafter replacement is verified:

- Source-bake `CraftingWorkspace` instead of build-time extraction.
- Remove obsolete crafter presentation patches one at a time.
- Shrink the Vercel runner one script at a time.
- Verify green after each removal.

## Risk notes

- Direct broad `NpcPanel` Craft-tab transforms failed Vercel and must remain inactive.
- Do not reactivate:
  - `scripts/patch_npc_panel_craft_tab_v1.mjs`
  - `scripts/patch_npc_panel_craft_capability_v1.mjs`
- Avoid large file rewrites for large pages such as `pages/npcs.js`; use narrow patch scripts or source edits that preserve the full file.
- Do not touch world-map movement, routes, camping, travel, or town-map label behavior.
- Do not change crafting rules, formulas, DCs, materials, merchant stock, or inventory ownership behavior during panel integration.

## Immediate next safest action

Create a narrow, validated adoption step for the NPC page profile overlay that changes only the import target from `NpcPanel` to the wrapper while preserving the same component name and props. Because `CharacterInteractionPanel` defaults back to `NpcPanel`, this should be behavior-preserving, but it must be done with a narrow edit and validated before any further caller is moved.
