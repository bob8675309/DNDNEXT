# Deferred UI / Polish Backlog

This file tracks known follow-up items that should not be mixed into build-runner cleanup unless they become blocking. Keep these separate from source-bake cleanup to reduce regression risk.

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

## Merchant admin / storefront follow-up

### Merchant type and inventory reroll controls

- Observed: current storefront still has admin stock/travel controls and a `Reroll stock` button, but the merchant type/theme controls are not clear enough in the new UI.
- Desired: restore an obvious admin flow to choose or change merchant type/theme, such as Alchemy, General Goods, Fletcher, Weapons and Armor, Relics, Tailor/Clothier, Stable, Jeweler, Arcane/Relic Broker, etc.
- Desired: admin can reroll merchant inventory after selecting the merchant type/theme, and the resulting stock should match that selected theme.
- Likely area: `components/MerchantPanel.js`, `utils/merchantTheme.js`, merchant character fields such as `theme`, `merchant_theme`, `icon`, `tags`, `role`, `storefront_title`, and the existing reroll RPC/fallback path.
- Risk notes: keep purchase flow, inventory grants, wallet updates, route/travel controls, and merchant stock DB schema unchanged unless a focused migration is explicitly needed.

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

- Build-runner source-mutating patch cleanup is now complete; continue with focused feature and polish branches/passes.
- Keep deferred UI/polish fixes separate unless they become blocking.
- Validate storefront/profile/crafter changes with `npm run build:vercel` and a quick browser check before moving to the next feature pass.
