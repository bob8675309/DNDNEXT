# Deferred UI / Polish Backlog

Reconciled: 2026-08-02. This file distinguishes verified completed presentation work from remaining follow-up items. Do not reopen completed items without a current browser reproduction.

## Visual / layout polish

### Town map fallback flash

- Previously observed: town map briefly loaded the default/fallback map before updating to the stored town map.
- First step: reproduce on the current source and a cold browser load. Do not assume the old report is still active.
- Desired: hold a neutral loading state or defer the fallback so the wrong town map does not flash before the stored map resolves.
- Likely area: town map image resolution/loading state in the town sheet/map panel.
- Risk notes: do not touch world-map movement, world route advancement, camps, weather, or travel windows.

### NPC profile portrait placement — COMPLETE

- The direct `/npcs` page uses an inline portrait inside the Description card, with narrative text wrapping beside and below it.
- The shared Profile panel uses the same content model and no longer keeps a separate full-height portrait plus duplicate About/Description card.
- Source ownership: `pages/npcs.js`, `components/NpcPanel.js`, `styles/npc-page-controls.css`, and `styles/npc-profile-panel.css`.
- Reopen only for a specific current browser regression; keep Profile, Sheet & Rolls, Inventory, Shop, and Craft routing unchanged.

### Merchant / profile portrait sizing pass — COMPLETE

- Profile portrait sizing and responsive behavior are source-owned.
- Crafter and merchant portrait sizing/bleed are source-owned in `profile-craft-crafter-frame.css` and `profile-portrait-bleed-overrides.css`.
- Reopen only with a current screenshot and route-specific reproduction; do not change stock, purchase, crafting, or inventory semantics during a visual pass.

## Sheet & Rolls presentation status

- Combined attack and attached damage output uses the shared high-contrast roll-result component.
- Weapons, Cantrips, Prepared Spells, and Abilities can be collapsed independently while keeping each subheader visible.
- Dual melee/thrown weapon Details explicitly explain the mode-pill toggle.
- The pinned Description content stays at the top-left with a small header buffer and slightly larger body text.
- Live spell descriptions contain no literal bracketed source marker such as `[XPHB]`; 75 class-feature catalog rows still lack descriptions and remain content-repair debt rather than a sheet-layout defect.

## Merchant admin / storefront follow-up

### Merchant type and inventory reroll controls

- Observed: current storefront still has admin stock/travel controls and a `Reroll stock` button, but the merchant type/theme controls are not clear enough in the new UI.
- Desired: restore an obvious admin flow to choose or change merchant type/theme, such as Alchemy, General Goods, Fletcher, Weapons and Armor, Relics, Tailor/Clothier, Stable, Jeweler, Arcane/Relic Broker, etc.
- Desired: admin can reroll merchant inventory after selecting the merchant type/theme, and the resulting stock should match that selected theme.
- Likely area: `components/MerchantPanel.js`, `utils/merchantTheme.js`, merchant character fields such as `theme`, `merchant_theme`, `icon`, `tags`, `role`, `storefront_title`, and the existing reroll RPC/fallback path.
- Risk notes: keep purchase flow, inventory grants, wallet updates, route/travel controls, and merchant stock DB schema unchanged unless a focused migration is explicitly needed.

## NPC crafter / town workshop polish

### Admin known-recipes management

- Implemented in source: `components/CraftingWorkspace.js` owns DB-backed known-recipe controls and the sortable `Known` column.
- Live data state: the table currently has no configured recipe rows, so the remaining task is campaign data setup and browser validation rather than rebuilding the control.
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

- Build-runner source-mutating patch cleanup is now complete; continue with focused feature and polish branches/passes.
- Keep deferred UI/polish fixes separate unless they become blocking.
- Validate storefront/profile/crafter changes with `npm run build:vercel` and a quick browser check before moving to the next feature pass.
