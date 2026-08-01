# Crafting → Equipment → Character Sheet → Tactical Combat Pipeline

Updated: 2026-08-01  
Status: living architecture handoff; required reading before changing Smithing completion, canonical inventory/equip state, character-sheet item bonuses, encounter participant staging, or tactical weapon profiles.

## Purpose

These systems form one pipeline:

```text
items_catalog
  ↓ dynamic Forge recipe
craft plan
  ↓ guarded attempt report
successful or critical-success attempt
  ↓ guarded completion
inventory_items canonical row
  ↓ equip mutation
shared numeric equipment-effects resolver
  ├─→ Character Sheet numeric overlay
  └─→ Tactical canonical snapshot
          ↓ participant staged
        immutable encounter-local snapshot
          ↓ equipped weapon profile
        guarded tactical attack RPC
```

The character sheet already had mature equipped-item parsing before tactical combat gained armor support. Tactical weapon profiles were independently authoritative for weapons. The risk was drift: the sheet could show one AC or ability modifier while combat used another.

The current design separates two responsibilities:

- **Postgres owns numeric authority**: ability-score bonuses, direct ability-modifier bonuses, AC, saves, skills, initiative, armor, shields, and tactical weapon modifiers.
- **The browser owns presentation parsing**: explanatory breakdowns, reminders, warnings, and conservative text-derived Advantage/Disadvantage hints.

Encounter participants remain immutable encounter-local snapshots. Equipping an item does not rewrite a combatant already inside an active encounter.

## Non-negotiable boundaries

1. Do not create inventory rows directly just to make tactical testing convenient. Exercise the public crafting flow unless the task is an explicit data repair.
2. Do not calculate tactical attack bonus, damage, AC, or weapon legality from browser state.
3. Do not persist equipment bonuses into `character_sheets.sheet`; they remain computed overlays.
4. Do not automatically rewrite active `encounter_participants` when canonical equipment changes.
5. Realtime is synchronization only, never authority.
6. Do not touch world-map routes, travel, camping, weather, or town/city-map movement while changing this pipeline.
7. Do not restore retired source-mutating patch scripts to bypass current source and migrations.

---

## 1. Item catalogue and dynamic Smithing recipes

`public.items_catalog` stores canonical item payloads.

Physical Smithing recipes are generated at runtime in `components/CraftingWorkspace.js` through `forgeRecipe(item, flavorOverrides)`. The canonical item payload is retained under:

```js
recipe.catalog_item
```

A generated Forge recipe includes:

- `Forge <item name>`;
- discipline `Smithing`;
- kind `forge`;
- category and family;
- mundane rarity;
- damage, armor, range, properties, weight, cost, and source;
- a user-facing `item_preview`.

An empty `public.recipes` table does not prove that Smithing recipes are missing. Inspect `CraftingWorkspace.js` and `items_catalog` before seeding static recipe rows.

---

## 2. Craft-plan lifecycle

The browser builds a plan through `craftPlanInsertPayload(...)` and submits the public RPC shape produced by `craftPlanRpcPayload(...)`.

### Public workflow

```sql
submit_craft_plan(...)
submit_crafting_attempt_report(...)
complete_craft_plan_v1(...)
```

### Canonical tables

- `public.craft_plans`
- `public.crafting_attempts`
- `public.inventory_items`

### Required sequence

1. Submit the plan.
2. Record an attempt.
3. A failed attempt must not be completable.
4. Record a successful or critical-success attempt.
5. Complete through `complete_craft_plan_v1`.
6. Completion creates the canonical inventory row and completion receipt.

Do not bypass the attempt layer. Failed-attempt rejection is an authority boundary.

### Crafter versus recipient

The actual crafter is stored in:

```text
craft_plans.plan_payload.crafter.id
craft_plans.plan_payload.crafter.name
```

The recipient becomes the inventory owner. The crafter receives attribution in the successful attempt, completion report, and completed receipt. These roles must not be conflated.

### Completion normalization

Migration:

```text
sql/20260801_01_crafting_completion_normalization.sql
```

It ensures completed physical crafts:

- prefer user-facing `uiType` / `ui_type`;
- do not expose raw catalogue codes such as `M|XPHB` as display type;
- normalize empty, `none`, and mundane rarity to `Mundane`;
- credit the actual crafter;
- generically repair earlier completed Smithing rows without generated fixture IDs.

---

## 3. Canonical inventory and equip state

`public.inventory_items` is authoritative for ownership and equipment state.

Important columns:

- `id`
- `owner_type`
- `owner_id`
- `user_id`
- `item_id`
- `item_name`
- `item_type`
- `item_rarity`
- `card_payload`
- `is_equipped`
- `equip_slot`
- `updated_at`

### Owner conventions

- NPC: `owner_type = 'npc'`, `owner_id = characters.id`
- Merchant: `owner_type = 'merchant'`, `owner_id = characters.id`
- General character compatibility: `owner_type = 'character'`
- Player: `owner_type = 'player'`, linked through the owning user and character permissions

### Equip mutation

Inventory pages and profile panels use the same mutation shape:

```js
{
  is_equipped: true,
  equip_slot: "body" | "weapon_1" | "weapon_2" | "...",
  updated_at: new Date().toISOString(),
}
```

`components/EquipmentDiagram.js` displays and infers slots. Parent pages/panels own Supabase writes.

### Combat-significant rules

- Body armor contributes only from `equip_slot = 'body'`.
- Equipped weapons are resolved from canonical inventory.
- One highest valid equipped shield contributes.
- Payload text alone cannot make an item tactical armor when it is equipped in the wrong slot.

---

## 4. Shared numeric authority

Migrations:

```text
sql/20260801_03_shared_equipment_effects_pipeline.sql
sql/20260801_04_shared_equipment_effects_tactical_modifiers.sql
```

### Private resolver

```sql
private.character_equipment_effects_v1(p_character_id uuid) returns jsonb
```

It:

1. reads base ability scores and stored base/unarmored AC from `character_sheets.sheet`;
2. resolves equipped inventory with the same character/player ownership model used by weapon profiles;
3. merges preferred `items_catalog.payload` with `inventory_items.card_payload`;
4. aggregates structured numeric effects;
5. enforces armor-slot rules;
6. selects armor and shield contributions;
7. returns one structured numeric result.

### Authorized public wrapper

```sql
public.character_equipment_effects_v1(p_character_id uuid) returns jsonb
```

Allowed callers:

- `service_role`;
- administrators;
- authenticated users authorized to read the character through `private.can_access_character_v1`.

The private resolver is not granted to normal clients.

### Result contract

Representative shape:

```json
{
  "schemaVersion": 1,
  "abilities": {
    "str": {
      "base": 15,
      "scoreBonus": 2,
      "effectiveScore": 17,
      "modBonus": 1,
      "effectiveMod": 4
    }
  },
  "ac": {
    "total": 19,
    "base": 16,
    "dexApplied": 0,
    "armorCategory": "heavy",
    "armorBase": 16,
    "armorItemId": "...",
    "armorName": "Chain Mail",
    "shieldBonus": 2,
    "shieldItemId": "...",
    "shieldName": "Shield",
    "otherBonus": 1
  },
  "savesAll": 0,
  "saves": {},
  "skillsAll": 0,
  "skills": {},
  "initiative": 0,
  "equippedItemIds": []
}
```

### Supported numeric fields

- `bonusAc`, `acBonus`, `bonus_ac`
- `bonusSavingThrow`, `saveBonus`, `bonus_saving_throw`
- `bonusInitiative`, `initiativeBonus`, `bonus_initiative`
- `modifiers.abilities` / `modifiers.abilityScores`
- `modifiers.abilityMods` / `modifiers.abilityModifiers`
- `modifiers.saves`
- `modifiers.checks`
- `modifiers.initiative` / `modifiers.init`

Do not add a new numeric payload convention without updating the resolver, client adapter, validators, and this document.

### AC formula

- No armor: stored base AC when present; otherwise `10 + effective DEX modifier`.
- Light armor: armor base + full effective DEX modifier.
- Medium armor: armor base + `min(effective DEX modifier, 2)`; negative DEX remains negative.
- Heavy armor: fixed armor base.
- Shield: highest valid equipped shield bonus.
- Other AC bonus: added after armor and shield.

---

## 5. Character-sheet integration

### Local presentation parser

```text
utils/equipmentEffects.js
```

It remains responsible for:

- conservative text-derived Advantage/Disadvantage;
- reminders;
- warnings;
- armor Stealth disadvantage display;
- user-facing equipment breakdown strings;
- temporary local numeric fallback when the authoritative RPC cannot be loaded.

It is not final numeric authority.

### Server numeric adapter

```text
utils/authoritativeEquipmentEffects.js
components/CharacterSheetPanel.js
```

`CharacterSheetPanel.js` remains the established full sheet component. Existing callers require no new prop.

Its narrow authoritative overlay:

1. extracts the character UUID from the existing `effectsKey`;
2. calls `character_equipment_effects_v1`;
3. merges server numeric values over locally parsed numeric values;
4. preserves local Advantage/Disadvantage, reminders, warnings, armor descriptive flags, and breakdown text;
5. passes the merged overlay to `CharacterSheet5e`;
6. falls back to the existing local result when the RPC is unavailable or the caller has no character UUID.

The sheet's prior editing, profile, inventory, store, location, save, roll, and enhancement contracts remain in the same source file.

### Non-persistence rule

Equipment overlays must never be saved into `character_sheets.sheet`. Equip/unequip changes inventory rows; the sheet reads computed effects.

---

## 6. Tactical snapshot and weapon profiles

### Canonical combat snapshot

```sql
public.encounter_canonical_combat_snapshot_v1(p_character_id uuid)
```

It consumes the shared resolver and returns:

- effective Strength score;
- effective Dexterity score;
- effective Strength modifier;
- effective Dexterity modifier;
- proficiency bonus;
- equipment-derived AC;
- canonical HP.

Existing keys remain compatible. Explicit modifier keys prevent direct `abilityMods` bonuses from being lost by reconstructing modifiers from scores.

### Equipped weapon profile

```sql
public.encounter_weapon_profile_internal_v1(
  p_participant_id uuid,
  p_inventory_item_id uuid
)
```

It remains authoritative for:

- ownership and equipped state;
- catalogue/card payload merge;
- weapon classification;
- damage die/type;
- reach and ranged/thrown distance;
- Finesse choice;
- proficiency;
- magic weapon bonus;
- final attack bonus.

Finesse compares effective Strength and Dexterity modifiers, not only scores. This is required for direct modifier bonuses.

---

## 7. Encounter snapshot boundary

### Staging

`admin_add_encounter_participant_v1` reads `encounter_canonical_combat_snapshot_v1` and stores encounter-local HP and AC in `encounter_participants`.

### During an encounter

The participant row is an immutable encounter-local snapshot. Crafting, enchanting, equipping, or changing canonical gear must not silently rewrite:

- encounter AC;
- current HP;
- initiative;
- turn resources;
- position;
- conditions.

A future GM refresh/resnapshot feature would need a guarded, explicit, logged RPC. Never implement automatic inventory-triggered encounter updates.

### Weapon reads

Current guarded weapon commands derive equipped weapon profiles from canonical equipped inventory at command time. This is separate from staged AC/HP. Changing that rule requires an explicit architecture decision.

---

## 8. Production acceptance evidence — 2026-08-01

A full Smithing/equipment/combat sequence was exercised:

- Dawn Whiteflame was recorded as the crafter.
- Ten physical items were created through plan → attempt → completion.
- An intentional failed Rapier attempt could not be completed.
- Ordinary success and critical-success completion both passed.
- Completion created canonical rows with user-facing type, `Mundane` rarity, and correct crafter receipts.
- All ten items were equipped through the inventory mutation shape.
- Server weapon profiles resolved for all four smoke characters.
- Canonical AC resolved as:
  - Pip Quillspark: 11
  - Letho: 17
  - Raska Stonejaw: 18
  - Aurelia Dawnmere: 15
- Pip attacked Raska with the crafted Dagger:
  - `1d4` Piercing;
  - Finesse selected Dexterity;
  - attack bonus `+3`;
  - Dodge imposed Disadvantage;
  - rolled 18 and 10, kept 10;
  - total 13 vs encounter AC 13;
  - hit for 4 Piercing;
  - one Action consumed;
  - Combat Log Details showed the same math.

The active encounter retained its original AC snapshots, confirming the canonical-versus-encounter boundary.

---

## 9. Source map

### Crafting

- `components/CraftingWorkspace.js`
- `public.items_catalog`
- `public.craft_plans`
- `public.crafting_attempts`
- `submit_craft_plan`
- `submit_crafting_attempt_report`
- `complete_craft_plan_v1`
- `sql/20260801_01_crafting_completion_normalization.sql`

### Inventory/equipment

- `components/EquipmentDiagram.js`
- `pages/inventory.js`
- `components/NpcPanel.js`
- `pages/npcs.js`
- `public.inventory_items`
- `public.character_permissions`

### Character sheet

- `utils/equipmentEffects.js`
- `utils/authoritativeEquipmentEffects.js`
- `components/CharacterSheetPanel.js`
- `components/CharacterSheet5e.js`

### Tactical

- `private.character_equipment_effects_v1`
- `public.character_equipment_effects_v1`
- `public.encounter_canonical_combat_snapshot_v1`
- `public.encounter_weapon_profile_internal_v1`
- `public.encounter_equipped_weapon_profiles_v1`
- `admin_add_encounter_participant_v1`
- guarded weapon attack RPCs
- `sql/20260801_02_equipped_armor_canonical_ac.sql`
- `sql/20260801_03_shared_equipment_effects_pipeline.sql`
- `sql/20260801_04_shared_equipment_effects_tactical_modifiers.sql`

---

## 10. Safe change procedure

1. Read this document.
2. Inspect current GitHub `main` and live Supabase definitions.
3. Identify the owning layer: catalogue, craft lifecycle, inventory/equip, numeric resolver, presentation parser, staging snapshot, weapon profile, guarded command, or log UI.
4. State the encounter snapshot boundary explicitly.
5. Patch the narrowest layer.
6. Add or update parity validation.
7. Test failure and success paths.
8. Verify protected world and canonical counts.
9. Confirm no world-map or town/city-map file/function entered the diff.
10. Update this document when the contract changes.

### Minimum regression matrix

- unarmored;
- light armor with positive DEX;
- medium armor with DEX above +2;
- medium armor with negative DEX;
- heavy armor;
- shield;
- other AC bonus;
- ability-score bonus;
- direct ability-modifier bonus;
- save/skill/initiative bonus;
- armor outside `body`;
- multiple armors/shields;
- Finesse selection;
- failed craft completion rejection;
- normal and critical-success completion;
- active encounter snapshot unchanged.

---

## 11. Anti-patterns

Do not:

- insert tactical test weapons directly when the crafting workflow is under test;
- trust displayed sheet AC as tactical command input;
- duplicate armor formulas in another component or RPC;
- reconstruct a direct modifier bonus from an ability score;
- let the browser submit attack bonus, damage die, target AC, or Disadvantage as authority;
- update active participants from an inventory trigger;
- expose raw catalogue type codes as display metadata;
- confuse recipient with crafter;
- assume an empty static recipe table means Smithing is absent;
- alter world/town movement to solve crafting, inventory, sheet, or tactical equipment problems.

## Current limitation

Text-derived conditional effects remain presentation-only unless a reviewed tactical adapter explicitly supports them. The shared resolver covers structured numeric effects; it must not infer combat automation from ambiguous prose.
