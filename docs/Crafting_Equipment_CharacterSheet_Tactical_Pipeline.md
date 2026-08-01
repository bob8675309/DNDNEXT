# Crafting → Equipment → Character Sheet → Tactical Combat Pipeline

Updated: 2026-08-01  
Status: living architecture handoff; read before changing crafting completion, inventory equipment, character-sheet item bonuses, encounter participant staging, or tactical weapon profiles.

## Why this document exists

These systems are deliberately interwoven:

```text
items_catalog
  ↓ dynamic Forge recipe
craft plan
  ↓ guarded attempt report
successful/critical-success attempt
  ↓ guarded completion
inventory_items canonical row
  ↓ equip mutation
shared numeric equipment-effects resolver
  ├─→ Character Sheet presentation
  └─→ Tactical canonical snapshot
          ↓ participant staged into encounter
        immutable encounter-local combat snapshot
          ↓ equipped weapon profile
        guarded tactical attack RPC
```

Before this handoff was written, the character sheet already derived armor, shields, ability bonuses, saves, skills, initiative, and descriptive effects from equipped inventory. Tactical combat independently resolved equipped weapons and later gained a smaller armor-only calculation. That overlap made it easy for one surface to become correct while another silently drifted.

The architecture now separates **numeric authority** from **presentation parsing**:

- Postgres is authoritative for numeric equipment effects used by both character sheets and tactical combat.
- The browser continues to parse descriptive text, reminders, warnings, and conservative Advantage/Disadvantage hints for display.
- Encounter participants retain immutable encounter-local snapshots. Equipping an item does not rewrite a combatant already inside an active encounter.

## Non-negotiable boundaries

1. Do not create equipment directly in `inventory_items` merely to make tactical testing convenient. Exercise the public crafting workflow unless the task is explicitly a data repair.
2. Do not calculate tactical weapon or AC values from browser state.
3. Do not persist equipped-item bonuses into `character_sheets.sheet`; they remain computed overlays.
4. Do not mutate active `encounter_participants` when canonical equipment changes.
5. Do not make Realtime the authority. Realtime only tells clients to reload authoritative rows.
6. Do not touch world-map routes, world travel, camping, weather, or town/city-map movement while changing this pipeline.
7. Do not restore retired source-mutating patch scripts as a shortcut around current source and migrations.

---

## 1. Canonical item source and dynamic Smithing recipes

### Item catalogue

`public.items_catalog` stores canonical item payloads. Physical Smithing recipes are not required to exist as static rows in `public.recipes`.

`components/CraftingWorkspace.js` creates Forge recipes at runtime from item-catalog entries through `forgeRecipe(item, flavorOverrides)`. The recipe preserves the source catalogue payload under:

```js
recipe.catalog_item
```

The generated recipe includes:

- `name`: `Forge <item name>`;
- `discipline`: `Smithing`;
- `kind`: `forge`;
- normalized category/family;
- mundane rarity;
- canonical damage, armor, range, property, weight, cost, and source data;
- `item_preview` for user-facing review.

An empty shared `recipes` table therefore does not prove that Smithing is unavailable. Inspect `CraftingWorkspace.js` and the item catalogue before seeding static recipes.

---

## 2. Craft-plan lifecycle

The browser builds the plan payload with `craftPlanInsertPayload(...)` and submits only the public RPC shape produced by `craftPlanRpcPayload(...)`.

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

### Required lifecycle

1. Submit a plan.
2. Record an actual attempt.
3. A failed attempt must not be completable.
4. Record a successful or critical-success attempt.
5. Complete the plan through `complete_craft_plan_v1`.
6. Completion creates the canonical inventory row and an auditable completion receipt.

Do not skip the attempt layer. The failed-attempt rejection is an important authority boundary, not optional UI ceremony.

### Crafter attribution

The actual crafter is carried in:

```text
craft_plans.plan_payload.crafter.id
craft_plans.plan_payload.crafter.name
```

Completion must attribute the final report and completed receipt to that crafter. The recipient remains the owner of the resulting item; recipient and crafter are not interchangeable roles.

### Completion normalization

Migration:

```text
sql/20260801_01_crafting_completion_normalization.sql
```

The completion function:

- prefers user-facing `uiType` / `ui_type` metadata;
- avoids storing raw catalogue codes such as `M|XPHB` as the inventory display type;
- normalizes empty, `none`, and mundane rarity values to `Mundane`;
- preserves the actual crafter in completion reports and completed receipts;
- repairs prior completed Smithing rows generically, without generated fixture IDs.

---

## 3. Canonical inventory and equipment state

`public.inventory_items` is the source of truth for ownership and equipment state.

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
- Legacy/general character support: `owner_type = 'character'`
- Player inventory: `owner_type = 'player'`, permission-linked through the player user ID

### Equipment mutation

The inventory pages and panels use the same mutation shape:

```js
{
  is_equipped: true,
  equip_slot: "body" | "weapon_1" | "weapon_2" | ...,
  updated_at: new Date().toISOString(),
}
```

`components/EquipmentDiagram.js` infers and displays slots, but parent pages/panels perform Supabase writes. Do not move persistence into the diagram component.

### Combat-significant slots

- Body armor contributes only when equipped in `body`.
- Equipped weapons are resolved from canonical equipped inventory.
- One highest valid equipped shield contributes to AC.
- An item marked equipped in an invalid armor slot must not become tactical armor merely because its payload says `Armor`.

---

## 4. Shared numeric equipment authority

Migrations:

```text
sql/20260801_03_shared_equipment_effects_pipeline.sql
sql/20260801_04_shared_equipment_effects_tactical_modifiers.sql
```

### Private resolver

```sql
private.character_equipment_effects_v1(p_character_id uuid) returns jsonb
```

This is the server-authoritative numeric resolver. It:

1. reads base ability scores and stored base/unarmored AC from `character_sheets.sheet`;
2. resolves equipped inventory using the same character/player ownership rules as equipped weapon profiles;
3. merges preferred `items_catalog.payload` with `inventory_items.card_payload`;
4. aggregates numeric item effects;
5. selects valid armor and shield contributions;
6. returns one structured numeric result.

### Public read wrapper

```sql
public.character_equipment_effects_v1(p_character_id uuid) returns jsonb
```

The wrapper is callable by:

- `service_role`;
- administrators;
- authenticated users who can read the character through `private.can_access_character_v1`.

The private resolver is not granted to ordinary clients.

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

### Supported numeric payload fields

The resolver mirrors the established character-sheet conventions:

- `bonusAc`, `acBonus`, `bonus_ac`
- `bonusSavingThrow`, `saveBonus`, `bonus_saving_throw`
- `bonusInitiative`, `initiativeBonus`, `bonus_initiative`
- `modifiers.abilities` / `modifiers.abilityScores`
- `modifiers.abilityMods` / `modifiers.abilityModifiers`
- `modifiers.saves`
- `modifiers.checks`
- `modifiers.initiative` / `modifiers.init`

Do not invent a new numeric payload convention without updating both the resolver contract and its validators.

### AC rules

- No armor: stored base AC when present, otherwise `10 + effective DEX modifier`.
- Light armor: armor base + full effective DEX modifier.
- Medium armor: armor base + `min(effective DEX modifier, 2)`; negative DEX remains negative.
- Heavy armor: fixed armor base.
- Shield: highest equipped valid shield bonus.
- Other numeric AC bonuses: added after armor and shield.

---

## 5. Character-sheet integration

### Existing presentation parser

```text
utils/equipmentEffects.js
```

This remains responsible for presentation-oriented behavior:

- conservative text-derived Advantage/Disadvantage;
- reminders;
- warnings;
- armor Stealth disadvantage display;
- user-facing item breakdown strings;
- fallback local numeric display if the authoritative RPC is unavailable.

It is not the final numeric authority.

### Authoritative client adapter

```text
utils/authoritativeEquipmentEffects.js
components/CharacterSheetPanel.js
components/CharacterSheetPanelBase.js
```

`CharacterSheetPanel.js` is now a thin adapter at the existing import path. Current callers require no new prop.

The adapter:

1. derives the character UUID from the existing `effectsKey`;
2. calls `character_equipment_effects_v1`;
3. replaces local numeric values with the server result;
4. preserves local Advantage/Disadvantage, warnings, reminders, and breakdown text;
5. passes the merged overlay into `CharacterSheetPanelBase`;
6. falls back to the existing local result when the RPC is temporarily unavailable.

`CharacterSheetPanelBase.js` preserves the prior sheet editing and rendering behavior. Keep numeric authority out of the base component.

### Important non-persistence rule

Equipment overlays must not be saved into `character_sheets.sheet`. Equipping or unequipping changes inventory rows; the sheet reads the computed result.

---

## 6. Tactical canonical snapshot and weapon profiles

### Canonical combat snapshot

```sql
public.encounter_canonical_combat_snapshot_v1(p_character_id uuid)
```

The snapshot consumes the shared resolver and returns at least:

- effective Strength score;
- effective Dexterity score;
- effective Strength modifier;
- effective Dexterity modifier;
- proficiency bonus;
- equipment-derived AC;
- canonical HP.

The original keys remain compatible. Modifier keys are explicit so direct `abilityMods` bonuses are not lost by reconstructing a modifier from an adjusted score.

### Equipped weapon profile

```sql
public.encounter_weapon_profile_internal_v1(
  p_participant_id uuid,
  p_inventory_item_id uuid
)
```

This function remains server-authoritative for:

- item ownership and equipped state;
- catalogue/card payload merge;
- weapon classification;
- damage die and damage type;
- reach and ranged/thrown distance;
- Finesse choice;
- weapon proficiency;
- proficiency bonus;
- magic weapon bonus;
- final attack bonus.

Finesse must compare the effective Strength and Dexterity **modifiers**, not only scores. This matters when an item grants a direct modifier bonus.

---

## 7. Encounter snapshot boundary

### Staging

`admin_add_encounter_participant_v1` reads `encounter_canonical_combat_snapshot_v1` and stores encounter-local values such as HP and AC in `encounter_participants`.

### After staging

Once staged, the participant row is the encounter-local combat snapshot.

Equipping, crafting, enchanting, or changing canonical gear after that point does not silently rewrite:

- encounter AC;
- current HP;
- initiative;
- turn resources;
- position;
- conditions.

This prevents out-of-band inventory edits from altering an encounter already in progress.

A future explicit GM refresh/resnapshot feature may be designed, but it must be a guarded, logged action. Do not implement it as an automatic inventory trigger.

### Weapon reads during combat

Equipped weapon profiles are derived from current canonical equipped inventory when the guarded weapon command runs. This is intentionally separate from the staged AC/HP snapshot. Changes to that rule require an explicit architecture decision and migration; do not alter it casually.

---

## 8. Live acceptance evidence from 2026-08-01

A full Smithing/equipment/combat sequence was exercised against production:

- A legitimate Artificer, Dawn Whiteflame, was recorded as crafter.
- Ten physical items were created through plan → attempt → completion.
- An intentional failed Rapier attempt could not be completed.
- Ordinary success and critical-success completion paths both worked.
- Completion created canonical inventory rows with user-facing type, `Mundane` rarity, and correct crafter receipts.
- All ten items were equipped through the inventory mutation shape.
- Canonical equipped weapon profiles resolved for all four smoke characters.
- Canonical AC resolved as:
  - Pip Quillspark: 11
  - Letho: 17
  - Raska Stonejaw: 18
  - Aurelia Dawnmere: 15
- Pip attacked Raska with the crafted Dagger:
  - `1d4` Piercing;
  - Finesse selected Dexterity;
  - attack bonus `+3`;
  - Raska's Dodge imposed Disadvantage;
  - rolls 18 and 10, kept 10;
  - total 13 vs encounter AC 13;
  - hit for 4 Piercing damage;
  - one Action consumed;
  - Combat Log Details showed the same authoritative math.

The active encounter retained its original encounter-local AC snapshots, proving that canonical equipment changes did not rewrite an encounter already in progress.

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

### Inventory and equipment

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
- `components/CharacterSheetPanelBase.js`
- `components/CharacterSheet5e.js`

### Tactical

- `private.character_equipment_effects_v1`
- `public.character_equipment_effects_v1`
- `public.encounter_canonical_combat_snapshot_v1`
- `public.encounter_weapon_profile_internal_v1`
- `public.encounter_equipped_weapon_profiles_v1`
- `admin_add_encounter_participant_v1`
- guarded weapon-attack RPCs
- `sql/20260801_02_equipped_armor_canonical_ac.sql`
- `sql/20260801_03_shared_equipment_effects_pipeline.sql`
- `sql/20260801_04_shared_equipment_effects_tactical_modifiers.sql`

---

## 10. Safe change procedure

Before modifying any part of this pipeline:

1. Read this document.
2. Inspect current GitHub `main` and live Supabase definitions.
3. Identify which layer owns the defect:
   - catalogue/recipe;
   - plan/attempt/completion;
   - inventory ownership/equip slot;
   - numeric resolver;
   - presentation parser;
   - encounter staging snapshot;
   - weapon profile;
   - guarded command;
   - Combat Log presentation.
4. State the snapshot boundary explicitly.
5. Patch the narrowest layer.
6. Add or update parity validation.
7. Test a failure path as well as success.
8. Verify protected world and canonical counts.
9. Confirm no world-map or town/city-map file/function entered the diff.
10. Update this document when the contract changes.

### Minimum regression matrix

- unarmored character;
- light armor with positive DEX;
- medium armor with positive DEX above +2;
- medium armor with negative DEX;
- heavy armor;
- shield;
- other AC bonus;
- ability-score bonus;
- direct ability-modifier bonus;
- save/skill/initiative numeric bonus;
- armor equipped outside `body`;
- multiple armors/shields;
- Finesse weapon ability choice;
- failed craft completion rejection;
- successful and critical-success completion;
- existing encounter snapshot remains unchanged.

---

## 11. Anti-patterns

Do not:

- insert tactical test weapons directly into inventory when the crafting workflow is under test;
- trust the sheet's displayed AC as the tactical command input;
- duplicate armor formulas in a new component or RPC;
- recompute direct ability-modifier bonuses from scores;
- let the client submit attack bonus, damage die, target AC, or disadvantage as authority;
- update active encounter participants from an inventory trigger;
- assume a raw item `type` code is user-facing metadata;
- treat recipient and crafter as the same actor;
- infer that an empty static recipe table means dynamic Smithing is absent;
- change world/town movement to solve a crafting, inventory, or tactical equipment problem.

## Current limitation

Text-derived conditional effects remain presentation-only unless a reviewed tactical adapter explicitly supports them. The shared resolver covers structured numeric effects; it must not guess combat automation from ambiguous prose.
