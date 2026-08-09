# Astral Trance Runtime Status

Status date: 2026-08-08
PR: #170 (`agent/character-forge-resilience-presentation`)
Live migrations: 52-54

## Scope

This document is the controlling evidence for the AAG Astral Elf **Astral Trance** proficiency choice.

Astral Trance is a runtime Long-Rest choice. It is **not** a permanent Character Forge choice and must not be written into `speciesTraitChoices`, permanent skill proficiencies, permanent weapon proficiencies, or permanent tool proficiencies.

Source rule represented by this implementation:

- after finishing a Long Rest / trance, choose one skill proficiency;
- also choose one weapon or tool proficiency from the PHB equipment list;
- both proficiencies last until the next Long Rest;
- when the next Long Rest finishes, the old pair expires before a new pair is chosen.

DNDNext uses its preferred XPHB catalogue rows for equivalent PHB equipment identities. Firearms remain excluded by campaign-platform policy.

## Runtime storage

Astral Trance reuses the existing generic `character_runtime_feature_choices` table.

The row uses:

- `feature_key='astral-trance'`;
- `feature_name='Astral Trance'`;
- `source='AAG'`;
- `cadence='long_rest'`.

The current projection is stored under:

`character_sheets.sheet.runtimeProficiencies.astralTrance`

This is an overlay only. The server never rewrites permanent proficiency acquisition fields.

## Rest semantics

Migration 52 attaches `character_rest_expire_astral_trance_v1` as an AFTER INSERT trigger on `character_rest_log`.

When `complete_character_rest_v1(..., 'long_rest')` inserts the canonical Long-Rest log row for an eligible Astral Elf:

1. the current Astral Trance sheet overlay is removed;
2. the runtime row is retained for audit but marked `configured=false`;
3. the previous skill/training pair and expiry timestamp are retained in runtime state;
4. the character may configure one new pair for the completed Long Rest.

A Short Rest does not expire or reopen Astral Trance.

A second Astral Trance configuration during the same Long-Rest cycle is rejected.

This differs intentionally from Spell Mastery / Weapon Mastery replacement semantics. Astral Trance source text causes the temporary proficiencies to end when the next Long Rest finishes; the old pair does not remain active until the player manually changes it.

## Source eligibility

`private.character_has_astral_trance_v1(character_id)` requires:

- species = Astral Elf after canonical normalization;
- `sheet.meta.speciesSource='AAG'`.

Migration 54 corrects the compact species normalization to `astralelf`.

A non-Astral Elf receives `available=false` from the getter and cannot call the configure RPC successfully.

## Skill catalogue

Astral Trance exposes all 18 normal skills through `private.astral_trance_skill_options_v1()`.

The sheet uses existing skill keys, including:

- `animalHandling`;
- `sleightOfHand`;
- the remaining single-word skill keys already used by the character sheet.

Migration 53 corrects the two multiword mappings because `normalize_player_choice_name_v1` strips spaces:

- `Animal Handling -> animalhandling -> animalHandling`;
- `Sleight of Hand -> sleightofhand -> sleightOfHand`.

The live post-deploy audit reports exactly 18 skill options.

## Weapon / tool catalogue

`private.astral_trance_training_options_v1()` resolves mundane preferred XPHB catalogue rows representing the PHB weapon/tool list.

The current live catalogue returns 74 legal weapon/tool/instrument options.

The campaign's removed firearm identities are explicitly excluded:

- Musket;
- Pistol.

The configure RPC validates the submitted item UUID against the server-generated option list. A caller cannot submit an arbitrary item id and gain proficiency.

## Public runtime RPCs

### `get_character_astral_trance_v1(character_id)`

Returns:

- availability;
- current configured state;
- whether configuration is currently allowed;
- latest Long-Rest timestamp;
- current runtime skill/training pair;
- all 18 skill options;
- source-legal weapon/tool options;
- cadence/help text.

The caller must satisfy `can_manage_character_progression_v1`.

### `configure_character_astral_trance_v1(character_id, skill_key, training_item_id)`

Validates:

- caller permission;
- AAG Astral Elf eligibility;
- source-legal skill;
- source-legal weapon/tool;
- existence of a completed Long Rest;
- no already-configured pair for the current rest cycle.

It writes only the runtime feature row and `sheet.runtimeProficiencies.astralTrance`.

## Character-sheet behavior

`CharacterAstralTrancePanel.js` is mounted in `CharacterSheetPanel.js`, not in the Character Forge.

The panel:

- appears only for AAG Astral Elf sheet identity;
- shows the current pair when configured;
- instructs the player to finish a Long Rest when configuration is unavailable;
- offers one skill and one weapon/tool selector after a Long Rest;
- calls the guarded configure RPC;
- refreshes the canonical character sheet after configuration.

No Astral Trance state was added to:

- `NpcForgeCoreSupport.js`;
- `useNpcForgeController.js`;
- `useNpcForgeDerivedModel.js`.

That Forge exclusion is enforced by the dedicated validator.

## Non-destructive mechanical projection

`utils/characterRuntimeProficiencies.js` provides display/action overlays.

### Skill

In normal sheet view, `projectCharacterSheetRuntimeProficiencies()` clones the sheet and marks the selected runtime skill as proficient.

In edit mode, `CharacterSheetPanel` passes the underlying permanent draft instead of the projection. This prevents temporary Astral Trance proficiency from being manually saved as permanent character training.

### Weapon

`characterSheetActions.js` checks `hasRuntimeWeaponProficiency(sheet, weaponName)` before normal explicit/class weapon-proficiency fallback.

The runtime choice therefore **adds** proficiency with one exact weapon while preserving all existing class rules such as Fighter broad weapon training, Monk/Rogue fallback behavior, and any explicit permanent weapon proficiency data.

### Tool

The selected tool is retained in runtime state for use by runtime/tool-check presentation. It is not appended to permanent `sheet.tools`.

## Migration corrections

### Migration 52 — core runtime authority

Introduced the runtime table adapter, Long-Rest expiry trigger, getter/configure RPCs, sheet overlay, and client mechanical/UI integration.

### Migration 53 — multiword skill keys

A post-deploy audit found only 16 skills because the shared choice-name normalizer strips spaces. The migration corrects Animal Handling and Sleight of Hand. Live count became 18.

### Migration 54 — Astral Elf identity normalization

The first behavior fixture then exposed that `Astral Elf` also normalizes without spaces (`astralelf`). Migration 54 corrects eligibility.

Both defects failed closed: before the fixes, missing options/eligibility prevented an unauthorized or incorrect proficiency grant. They were corrected before this slice was accepted as complete.

## CI / build gates

The dedicated `Validate Astral Trance runtime` workflow validates:

- AAG source identity;
- Long-Rest cadence and automatic expiry;
- complete skill mappings;
- compact Astral Elf identity mapping;
- firearm exclusion;
- public/private ACL design markers;
- sheet-side configuration UI;
- non-destructive skill projection;
- runtime weapon proficiency integration;
- explicit Forge exclusion;
- protected world-map/travel boundaries.

The workflow also runs unified Character Forge validation and the full repository `npm run build:vercel` production build gate.

Before the final deployed corrections, exact-head CI was green across all eleven relevant shared workflows, including Astral Trance, Player Forge starting magic/equipment, Wizard Spell Mastery, NPC Forge, and progression validators.

## Live-schema compile evidence

Before deployment, migration 52's getter, configure RPC, clear helper, and rest trigger compiled successfully against the live production schema inside an explicit rollback transaction.

Migrations 53 and 54 were likewise compiled/tested in rollback before application.

## Rollback-only behavior proof

The final deployed-state proof used the real public rest/configuration RPCs with temporary characters and real `character_permissions`, then rolled the entire transaction back.

### Before first Long Rest

Verified:

- Astral Elf availability is true;
- configuration is not yet allowed;
- configure RPC rejects a pre-rest attempt.

### First Long Rest

After `complete_character_rest_v1(..., 'long_rest')`:

- configuration becomes available;
- Arcana + Longsword can be selected;
- the runtime sheet projection contains Arcana/Longsword;
- permanent Arcana proficiency remains untouched;
- permanent `tools` remains unchanged;
- no permanent `weaponProficiencies` field is created.

A second configuration during that same rest cycle is rejected.

### Short Rest

After `complete_character_rest_v1(..., 'short_rest')`:

- Arcana/Longsword remains active;
- Short Rest does not open another Astral Trance choice.

### Next Long Rest

After the next Long Rest:

- the Arcana/Longsword overlay is removed automatically;
- the runtime row is marked `configured=false`;
- configuration reopens for the new Long-Rest cycle.

### Second pair

Verified:

- direct Pistol UUID submission is rejected as non-source-legal;
- Animal Handling + a canonical tool succeeds;
- the corrected multiword skill key is preserved;
- permanent Animal Handling proficiency remains untouched.

### Non-Astral Elf

A Human/XPHB synthetic character:

- receives `available=false`;
- cannot configure Astral Trance.

The four fail-closed cases were:

1. configuration before a Long Rest;
2. second configuration in the same rest cycle;
3. firearm selection;
4. non-Astral Elf configuration.

## Final production integrity

After rollback fixtures and migrations 52-54:

- migrations 52 / 53 / 54 registered;
- 18 skill options;
- 74 weapon/tool options;
- firearms present: false;
- live Astral Trance runtime rows from QA: 0;
- synthetic Astral proof characters: 0;
- 7 characters;
- 7 character sheets;
- 30 character-spell assignments;
- 7 progression rows;
- 0 open level-up sessions;
- 20 world locations;
- 4 map routes;
- 9 map route points.

ACL audit:

- public getter/configure: owner/postgres + authenticated + service_role;
- private Astral helpers/trigger functions: owner/postgres + service_role only.

## Status

Astral Trance runtime choice authority is **complete and live**.

Do not add Astral Trance back to Character Forge persistent choices.

Remaining runtime-cadence families should be modeled according to their own source semantics. In particular:

- Primal Companion: may summon/change beast after Long Rest;
- Dread Allegiance: may change allegiance after Long Rest, but the existing choice remains until changed;
- Fiendish Resilience: may change after Short or Long Rest;
- Steps of the Fey: per-use choice when casting Misty Step, not rest-stored configuration.
