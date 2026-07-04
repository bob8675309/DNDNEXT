# Deferred UI / Polish Backlog

This file tracks known follow-up items that should not be mixed into the current build-runner cleanup unless they become blocking. Keep these separate from source-bake cleanup to reduce regression risk.

## Visual / layout polish

### Town map fallback flash

- Observed: town map briefly loads the default/fallback map before updating to the stored town map.
- Desired: hold a neutral loading state or defer the fallback so the wrong town map does not flash before the stored map resolves.
- Likely area: town map image resolution/loading state in the town sheet/map panel.
- Risk notes: do not touch world-map movement, world route advancement, camps, weather, or travel windows.

### NPC profile portrait placement

- Observed: NPC portrait appears in the upper-left header area of the profile view.
- Desired: portrait should live in the Description/profile-content section, with portrait on the left and description/background text on the right. Text should wrap and continue below the portrait when needed.
- Likely area: `components/character/CharacterInteractionPanel.js`, `components/NpcPanel.js`, and/or `styles/npc-profile-panel.css`.
- Risk notes: keep Profile, Sheet & Rolls, Inventory, Shop, and Craft tab behavior unchanged.

### Merchant / profile portrait sizing pass

- Observed earlier: some shop/profile portraits were visually too large.
- Desired: consistent portrait scale between merchant shops, NPC profiles, and crafter storefronts.
- Likely area: profile/shop CSS only.
- Risk notes: avoid merchant stock, inventory, purchase flow, and DB changes.

## NPC crafter / town workshop polish

### Admin known-recipes management

- Desired: admin can select which recipes an NPC crafter knows.
- Proposed UI: small `Known` checkbox column in the admin recipe table, with column-header sorting.
- Existing DB support: `npc_known_recipes` exists and currently supports character/recipe-key mapping.
- Risk notes: do not grant all recipes by default; generic NPCs should not appear as workshop providers without a crafter role.

### NPC crafter player-facing workflow cleanup

- Desired: player using an NPC crafter should use the same crafting rules/workflow, but the skill/profession should come from the NPC crafter.
- Desired removals from player-facing NPC crafter view: NPC materials access, NPC craft receipts, Discovery, and other player-irrelevant admin/self-crafting controls.
- Desired receipt behavior: notify Admin and place receipt in the player personal craft receipt tab, not the NPC crafter's tab.
- Risk notes: do not change crafting formulas, DCs, material consumption, inventory grants, or profession math during a pure layout pass.

### Crafter storefront header/content polish

- Desired: top Crafting Hub tab/header should be replaced with information about the assisting crafter.
- Desired: remove unused middle area from NPC crafter storefront and move recipe list/workflow upward.
- Desired: preserve the separate shop/workshop aesthetic using crafter portrait/storefront styling.
- Risk notes: keep the shared Craft tab and `CharacterInteractionPanel` handoff intact.

## Cleanup sequencing notes

- Continue source-bake cleanup in small batches.
- Prefer deleting retired patch files only after their runner entries are removed, Vercel is green, and docs/validators are aligned.
- Current larger cleanup targets still need separate care:
  - CraftingWorkspace extraction cleanup.
  - Merchant/crafter storefront polish mutators.
  - Retired map/page boot loading patch deletion and docs alignment.
