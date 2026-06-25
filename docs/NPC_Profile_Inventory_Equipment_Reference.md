# NPC Profile, Inventory, and Equipment Manager Reference

Purpose: quick refresher for future ChatGPT sessions or maintainers working on the NPC profile panel, character sheet panel, inventory page, item-card preview, equipment diagram, and item-transfer flow.

## Scope and guardrails

This section covers the profile/inventory/equipment UI only. Do not change world-map movement, travel, camping, route advancement, or town/city-map behavior while working here unless the user explicitly asks. The current workbench is meant to be a presentation and management layer over existing inventory rows; it should not alter crafting rules, merchant stock rules, or map route systems.

## Main user-facing flows

### 1. NPC profile panel from map

`components/NpcPanel.js` is the panel used on the map when an NPC or merchant profile is opened. It owns the tab buttons for:

- Profile
- Sheet & Rolls
- Inventory

The panel loads the selected character from `public.characters`, pulls the character sheet from `public.character_sheets`, loads equipped and full inventory rows from `public.inventory_items`, then renders profile lore, the character sheet, or the embedded equipment manager depending on `activeView`.

The inventory tab in `NpcPanel` renders `EquipmentDiagram` directly. This is the preferred in-panel inventory experience, so users do not have to navigate away from the map just to inspect, equip, unequip, or send items.

### 2. NPC profile panel from `/npcs`

`pages/npcs.js` is the larger NPC management page. It also embeds the same `NpcPanel` in an overlay shell named `.npc-page-profile-panel-shell`. The profile overlay is intentionally styled separately from the Bootstrap offcanvas ID used by the map panel, so CSS that targets only `#npcPanel` will not affect the `/npcs` overlay.

If the profile panel displays correctly from the map but not from `/npcs`, check `styles/npc-profile-panel.css` for selectors under `.npc-page-profile-panel-shell`.

### 3. Full inventory page

`pages/inventory.js` supports player, NPC, and merchant inventories through query params:

```text
/inventory?ownerType=player&ownerId=<user_id>
/inventory?ownerType=npc&ownerId=<character_id>
/inventory?ownerType=merchant&ownerId=<character_id>
```

The page still shows the full inventory list below the workbench only if CSS allows it. The preferred interactive equipment area is `EquipmentDiagram` near the top.

## Core components

### `components/EquipmentDiagram.js`

This is the central equipment manager component.

Responsibilities:

- Defines canonical equipment slots in `EQUIPMENT_SLOTS`.
- Infers default slots for items with `inferEquipmentSlot(row)`.
- Assigns currently equipped rows to diagram slots with `assignEquipmentSlots(rows)`.
- Handles drag/drop:
  - Drag a backpack row to an equipment slot to equip or move it.
  - Drag an equipped slot item out of the stage to unequip it.
- Renders the selected item preview using `ItemCard`.
- Renders compact backpack rows.
- Calls parent callbacks instead of writing to Supabase directly.

Important callback contracts:

```js
onAssignEquipSlot(rowId, slotKey)
onUnequip(rowId)
onTransferItem(rowId, targetKey)
```

Do not move Supabase mutations into `EquipmentDiagram`; keep it reusable and parent-controlled.

### `components/ItemCard.js`

This is the shared item-card renderer used by merchants, admin views, inventory, and equipment previews. It normalizes catalog rows, crafted item payloads, and inventory row payloads into one card structure.

Visual standard:

- The card frame is neutral purple/dark.
- Rarity color belongs to the header gradient, header top inset, rarity text, and header underline.
- Rarity color should not create bright vertical bands down the left or right side of the card body.
- Equipment-manager preview shells should not add extra colored gutters around `ItemCard`.

Relevant CSS:

- `styles/card-compact.css`: shared item-card color standard.
- `styles/equipment-send-controls.css`: final equipment-preview gutter cleanup and send-control ordering.

### `components/CharacterSheetPanel.js`

This renders the sheet header and the 5e sheet body. It accepts a parent-controlled profile action:

```js
profileHref
profileText
onOpenProfile
inventoryHref
storeHref
```

If `onOpenProfile` is present, it should be the authoritative profile action. Avoid rendering duplicate Profile buttons from both `profileHref` and `onOpenProfile`.

### `components/NpcPanel.js`

This panel coordinates the profile, sheet, and inventory views for a character. For the inventory tab, it renders:

```jsx
<EquipmentDiagram
  rows={inventoryRows}
  ownerName={view.name || "Character"}
  canManage={inventoryAccess.canManage}
  canTransfer={inventoryAccess.canManage || isAdmin}
  transferTargets={panelTransferTargets}
  onTransferItem={transferInventoryItem}
  onUnequip={(rowId) => toggleEquipped(rowId, false)}
  onAssignEquipSlot={assignEquipSlot}
/>
```

`NpcPanel` should remain the single place where the profile-panel inventory tab is wired. If the embedded inventory behaves differently from `/inventory`, inspect parent callbacks first before editing `EquipmentDiagram`.

## Database touchpoints

### `public.characters`

Used to identify NPCs and merchants and to load profile panel metadata. Key columns for this section include:

- `id`
- `kind` (`npc` or `merchant`)
- `name`
- `race`, `role`, `affiliation`, `description`, `background`, quick-hook fields
- `portrait_url`, `portrait_storage_path`, `portrait_thumb_url`, `portrait_shop_url`
- `map_icon_id`, `sprite_path`

### `public.character_sheets`

Stores `sheet` JSON for the 5e sheet and NPC reveal state. The profile reveal state is stored under:

```js
sheet.profileReveal
```

The reveal map controls which NPC lore fields players can see once the admin reveals them.

### `public.inventory_items`

This is the source of truth for item ownership and equipment state.

Important columns:

- `id`
- `owner_type` (`player`, `npc`, `merchant`)
- `owner_id`
- `user_id` for player-owned rows
- `card_payload`
- `is_equipped`
- `equip_slot`
- `updated_at`

Equipping is not a separate table. A row is equipped when `is_equipped` is true and placed by `equip_slot`.

### `public.character_permissions`

Used for player access to NPC inventories. Admins bypass this. Player-facing NPC inventory access depends on permission rows such as `can_inventory` and `can_edit`.

## Item transfer flow

There are two related but different item-movement systems:

1. Player trade requests, shown on a player-owned `/inventory` page through `TradeRequestsPanel` and `OfferTradeButton`.
2. Direct item send / ownership transfer for NPC or admin inventory management, used by the equipment manager.

For direct sending from the equipment manager, the current preferred path is the Supabase RPC:

```sql
transfer_inventory_item_v1(p_item_id, p_target_type, p_target_id)
```

Target lists are loaded with:

```sql
list_item_send_targets_v1()
```

When an item is sent, it should be unequipped and moved to the target owner. If the item remains equipped on the old owner, check the RPC or fallback update path.

## CSS and visual layering

Import order in `pages/_app.js` matters:

1. `globals.scss`
2. `npc-forge.scss`
3. `card-compact.css`
4. `npc-profile-panel.css`
5. `equipment-diagram.css`
6. `equipment-diagram-three-column.css`
7. `equipment-clean-overrides.css`
8. `equipment-send-controls.css`

Later files win. Use `equipment-send-controls.css` for last-mile equipment-manager preview/send-control polish. Use `card-compact.css` for sitewide `ItemCard` standards. Use `npc-profile-panel.css` for profile panel and `/npcs` overlay shell rules.

Current equipment-manager visual intent:

- Three-column layout: equipment stage, slim backpack list, selected item preview.
- Backpack list is compact one-line rows.
- Equipped items are hidden from backpack by default; the Equipped toggle can show them.
- Item preview uses the shared `ItemCard` format.
- Rarity color should be visible in the card header treatment, not as side gutters.
- The equipment stage uses `public/media/equipment/equipment-stage-bg.png` and `equipment-shadow-figure.png`.

## Prebuild patch chain

`package.json` runs several patch scripts during `predev` and `prebuild`. This project currently uses those scripts as durable code transforms, so order matters.

Important scripts for this section:

- `patch_npc_profile_portrait_picker_v1.mjs`
- `patch_npc_page_profile_layout_v1.mjs`
- `patch_npc_page_sheet_header_polish_v1.mjs`
- `patch_npc_page_sheet_controls_final_v1.mjs`
- `patch_inventory_equipment_diagram_v1.mjs`
- `patch_npc_equipment_profile_finish_v1.mjs`
- `patch_npc_profile_readability_dedupe_v1.mjs`

When a bug appears only after deployment, check whether a source file looks different before and after the prebuild patches. The generated build may include transformations not obvious from the committed base source.

## Common troubleshooting map

### Profile works from map but not from `/npcs`

Likely CSS scope. Compare `#npcPanel` rules and `.npc-page-profile-panel-shell` rules in `styles/npc-profile-panel.css`.

### Duplicate Profile button on sheet header

Likely `CharacterSheetPanel` received both old and new profile action insertions. Keep a single `onOpenProfile` button and remove legacy duplicated Profile href action.

### Item card preview has colored left/right gutters

Check:

- `styles/card-compact.css` for `.sitem-card` border color.
- `styles/equipment-send-controls.css` for `.equipment-workbench__item-preview` shell padding/background/border.

The intended fix is neutral card frame + rarity-colored header only + transparent equipment preview shell.

### Item equips into wrong slot

Check `inferEquipmentSlot(row)` and `itemBlob(row)` in `EquipmentDiagram.js`. For explicit corrections, ensure `inventory_items.equip_slot` is updated by the parent callback.

### Sending item does nothing

Check that `transferTargets` are populated. In the profile panel this comes from `list_item_send_targets_v1()`. Then check that `transfer_inventory_item_v1()` exists and is callable with the current user role.

### NPC inventory empty in profile panel but not on `/inventory`

Check owner identity:

- NPC rows use `owner_type = 'npc'` and `owner_id = characters.id`.
- Merchant rows use `owner_type = 'merchant'` and `owner_id = characters.id`.
- Player rows use `owner_type = 'player'` or null legacy rows plus `user_id`.

## Safe edit rule

For future changes, prefer this order:

1. Read `EquipmentDiagram.js` and parent page/panel callbacks.
2. Confirm whether the issue is source code, generated prebuild output, CSS import order, or database state.
3. Patch the narrowest layer possible.
4. Do not change world-map movement or town/city-map behavior for inventory/profile UI bugs.
5. If adding visual polish, put global ItemCard rules in `card-compact.css` and equipment-only overrides in `equipment-send-controls.css` or `equipment-clean-overrides.css` depending on desired import order.
