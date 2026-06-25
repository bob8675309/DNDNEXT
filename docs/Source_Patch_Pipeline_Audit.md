# Source Patch Pipeline Audit

Purpose: quick maintainer reference for the current `predev` / `prebuild` mutation chain, why it is risky, what was consolidated during the NPC profile/inventory cleanup, and what still needs a careful follow-up pass.

## Why this exists

The project currently uses several `scripts/patch_*.mjs` files inside both `predev` and `prebuild`. Those scripts mutate tracked source files immediately before local dev or production build. That pattern works as a short-term bridge, but it makes the deployed source equal to:

```text
committed source files + generated prebuild mutations + patch order side effects
```

This is risky because a later patch can miss an anchor or partially apply after another patch changes a nearby line. The recent `portraitPickerOpen is not defined` and `selectedPortrait is not defined` crashes were both symptoms of that pattern.

## Current package state

As of this audit, `package.json` still runs a long predev/prebuild chain. The first cleanup did **not** remove every patch script at once because several older patches still touch broad systems outside the NPC profile/equipment area. Removing all of them in one commit would risk regressing merchants, town crafters, smithing, alchemy card details, and NPC page wiring.

The current approach is staged:

1. Bake a narrow feature area into real source.
2. Prove deployment still succeeds.
3. Remove only scripts that are no longer needed for that area.
4. Repeat for the next feature area.

## Completed during this cleanup

### Baked into real source

These changes are now owned by actual source files rather than by the final shop/portrait hotfix patches:

- `components/CharacterSheetPanel.js`
  - Owns `onOpenStore` directly.
  - Store button can now open an in-panel store view just like Profile opens an in-panel profile view.

- `components/NpcPanel.js`
  - Owns the profile, sheet, inventory, and merchant shop tab state.
  - Owns `initialView` so callers can open directly to `profile`, `sheet`, `inventory`, or `shop`.
  - Owns the inventory workbench wiring.
  - Loads `MerchantPanel` with `next/dynamic` and `ssr: false` so the in-panel Shop tab does not force merchant storefront code into server rendering.

- `components/EquipmentDiagram.js`
  - Owns the current slot layout.
  - Empty equipment slots show the slot label only.
  - Backpack column owns the `Send selected item` controls.
  - Selected item preview is display-only and uses `ItemCard`.

- `styles/card-compact.css`
  - Shared `ItemCard` visual standard.
  - Rarity-colored border is consistent around all sides of the card.
  - Header keeps rarity wash/underline treatment.

- `styles/equipment-send-controls.css`
  - Equipment preview gutters are neutral/transparent.
  - The item card itself owns the visual frame.

### Removed from the repo

These scripts were obsolete after the source bake and are no longer present:

- `scripts/patch_npc_profile_shop_tab_v1.mjs`
- `scripts/patch_npc_panel_portrait_state_hotfix_v1.mjs`

### Removed from predev/prebuild

`patch_npc_profile_shop_tab_v1.mjs` has been removed from both `predev` and `prebuild`.

`patch_npc_panel_portrait_state_hotfix_v1.mjs` had already been removed from the package chain earlier and is now deleted from the repo.

## Still in predev/prebuild and why

These scripts remain intentionally for now. They should be cleaned up in future focused passes, not deleted blindly.

### Asset/default generation

- `generate_npc_portrait_pack.mjs`
  - Generates default SVG portraits under `public/npc-portraits`.
  - Candidate cleanup: commit generated assets permanently, move this to a manual script, remove from prebuild.

### Smithing / item page

- `patch_smithing_base_dice.mjs`
  - Mutates `pages/items.js` to preserve original base dice for smithing temper/material scaling.
  - Candidate cleanup: bake its `weaponBaseDamageProfile`, `weaponSecondaryDamageProfile`, and original-base-damage payload changes into `pages/items.js`, then remove.

### Town merchant / market / crafter storefront UI

- `patch_town_merchant_storefront.mjs`
- `patch_merchant_market_ui.mjs`
- `patch_merchant_market_polish.mjs`
- `patch_crafter_shop_presentation.mjs`
- `patch_town_profile_crafter_ui_v1.mjs`
  - These likely mutate town sheet, merchant storefront, and crafter presentation code.
  - Candidate cleanup: inspect affected components as a group, bake final storefront/crafter UI into source, then remove the related scripts together.

### Item card alchemy details

- `patch_itemcard_alchemy_details.mjs`
  - Mutates shared card display behavior.
  - Candidate cleanup: verify its final output is already in `components/ItemCard.js` and `styles/card-compact.css`; if so, remove.

### NPC Forge / creation / portrait foundation

- `patch_npc_forge_creation_details.mjs`
- `patch_npc_portrait_foundation_v2.mjs`
  - Touch NPC creation/profile foundation and portrait support.
  - Candidate cleanup: review `components/NewNpcModal.js`, `utils/characterCreation.js`, `utils/characterPortraits.js`, SQL migration notes, and NPC page integration before removing.

### NPC page profile/sheet controls

- `patch_npc_profile_portrait_picker_v1.mjs`
- `patch_npc_page_profile_layout_v1.mjs`
- `patch_npc_page_sheet_header_polish_v1.mjs`
- `patch_npc_page_sheet_controls_final_v1.mjs`
- `patch_npc_profile_readability_dedupe_v1.mjs`
  - These still mutate `pages/npcs.js`, `CharacterSheetPanel`, and profile-panel CSS.
  - Candidate cleanup: this is the next highest-value target because `/npcs` is a large page and has been the source of several generated-state bugs.
  - Important: do **not** remove these until `pages/npcs.js` directly imports/renders `NpcPanel`, owns `profilePanelOpen`, owns profile initial view, owns sprite/portrait picker state, and passes clean sheet header props without needing generated insertion.

### Inventory/equipment page

- `patch_inventory_equipment_diagram_v1.mjs`
- `patch_npc_equipment_profile_finish_v1.mjs`
  - These still mutate `/inventory`, equipment workbench integration, and NPC-page overlay parity.
  - Candidate cleanup: verify `pages/inventory.js`, `components/EquipmentDiagram.js`, `components/NpcPanel.js`, and equipment CSS already contain the final output. Then remove only after deploy passes without them.

## Cleanup order recommendation

1. **NPC page consolidation pass**
   - Bake profile overlay, portrait picker, sprite picker, sheet header controls, profile initial tab, and profile readability rules into `pages/npcs.js` plus source CSS.
   - Then remove:
     - `patch_npc_profile_portrait_picker_v1.mjs`
     - `patch_npc_page_profile_layout_v1.mjs`
     - `patch_npc_page_sheet_header_polish_v1.mjs`
     - `patch_npc_page_sheet_controls_final_v1.mjs`
     - `patch_npc_profile_readability_dedupe_v1.mjs`

2. **Inventory/equipment page consolidation pass**
   - Bake `/inventory` workbench, transfer RPC path, equip-slot helpers, and final CSS into source.
   - Then remove:
     - `patch_inventory_equipment_diagram_v1.mjs`
     - `patch_npc_equipment_profile_finish_v1.mjs`

3. **Town/merchant/crafter storefront consolidation pass**
   - Bake town merchant and crafter presentation source.
   - Then remove related town/merchant patch scripts.

4. **Crafting/card/smithing cleanup pass**
   - Bake smithing base dice and card details source.
   - Remove the remaining item/smithing patch scripts.

5. **Asset generation cleanup**
   - Commit generated default portrait assets, then move `generate_npc_portrait_pack.mjs` out of prebuild.

## Safety rule for future work

Before removing any source-mutating prebuild script:

1. Read the script and list every target file it modifies.
2. Confirm the target files already contain the final intended code.
3. Remove the script from `predev` and `prebuild` only after the source file is baked.
4. Leave the script file in the repo for one deploy if rollback risk is high, then delete it after the deploy passes.
5. Check Vercel status after each small removal.

Do not remove unrelated patch scripts in a bulk commit. That is more dangerous than the current debt.

## Known good status from this pass

The component-level source bake initially failed when `NpcPanel` imported `MerchantPanel` directly. The fix was to load `MerchantPanel` with `next/dynamic({ ssr: false })`, keeping the in-panel Shop tab client-side. After that change, Vercel reported a successful deploy.
